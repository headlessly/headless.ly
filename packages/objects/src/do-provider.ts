/**
 * DONounProvider — bridges Noun() proxy to Durable Object storage via rpc.do
 *
 * Uses capnweb promise pipelining for single-round-trip chains.
 * All CRUD + verb operations go through the rpc.do transport layer,
 * which handles batching, pipelining, and pass-by-reference automatically.
 */

import type { NounProvider, NounInstance } from 'digital-objects'
import { RPC } from 'rpc.do'
import type { RPCProxy, RPCOptions } from 'rpc.do'

/**
 * Pluralize a word (matches @dotdo/api convention)
 */
function pluralize(word: string): string {
  if (word.endsWith('y') && !['ay', 'ey', 'oy', 'uy'].some((s) => word.endsWith(s))) {
    return word.slice(0, -1) + 'ies'
  }
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) {
    return word + 'es'
  }
  return word + 's'
}

/**
 * Convert PascalCase type name to a camelCase plural collection name
 * e.g., 'Contact' -> 'contacts', 'FeatureFlag' -> 'featureFlags'
 */
function toCollectionName(type: string): string {
  const camel = type.charAt(0).toLowerCase() + type.slice(1)
  return pluralize(camel)
}

/**
 * Options for creating a DONounProvider
 */
export interface DONounProviderOptions {
  /** RPC endpoint URL (e.g., 'https://db.headless.ly/~acme') */
  endpoint: string
  /** API key for authentication */
  apiKey?: string
  /** Transport type: 'http' (default) or 'ws' for real-time */
  transport?: 'http' | 'ws'
  /**
   * Legacy: Fetch function to reach the DO.
   * @deprecated Use endpoint + apiKey instead. rpc.do handles transport.
   */
  doFetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  /** Tenant context URL (defaults to 'https://headless.ly') */
  context?: string
  /** Base path prefix for routes (defaults to '') */
  basePath?: string
}

/**
 * Error thrown when DO operations fail
 */
export class DOProviderError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: string,
  ) {
    super(message)
    this.name = 'DOProviderError'
  }
}

/**
 * Normalize a raw object into a NounInstance shape
 */
function toNounInstance(raw: unknown): NounInstance {
  const obj = raw as Record<string, unknown>
  return {
    $id: (obj.$id as string) ?? '',
    $type: (obj.$type as string) ?? '',
    $context: (obj.$context as string) ?? '',
    $version: (obj.$version as number) ?? 1,
    $createdAt: (obj.$createdAt as string) ?? '',
    $updatedAt: (obj.$updatedAt as string) ?? '',
    ...obj,
  }
}

/**
 * DONounProvider — NounProvider backed by a Durable Object via rpc.do
 *
 * Uses capnweb promise pipelining for efficient transport.
 * Collection operations map to the DO's collection API:
 * - $.contacts.find({ stage: 'Lead' })
 * - $.contacts.get('contact_abc')
 * - $.contacts.update('contact_abc', { ... })
 */
export class DONounProvider implements NounProvider {
  private context: string
  private rpcUrl: string
  private rpcOptions: RPCOptions
  public readonly endpoint: string

  constructor(options: DONounProviderOptions) {
    this.context = options.context ?? 'https://headless.ly'
    this.endpoint = options.endpoint

    // Build capnweb URL and options
    const rpcOptions: RPCOptions = {}
    if (options.apiKey) {
      rpcOptions.auth = options.apiKey
    }
    this.rpcOptions = rpcOptions

    const isSecure = /^https:\/\//.test(options.endpoint)
    const protocol = options.transport === 'ws' ? (isSecure ? 'wss' : 'ws') : isSecure ? 'https' : 'http'
    this.rpcUrl = options.endpoint.replace(/^https?:\/\//, `${protocol}://`)
  }

  /**
   * Create a fresh RPC proxy for each operation.
   * Capnweb HTTP batch sessions are one-shot — they send all collected
   * promises in a single request on the next microtask tick, then the
   * session ends. Sequential awaits need fresh sessions.
   */
  private rpc(): RPCProxy<Record<string, unknown>> {
    return RPC(this.rpcUrl, this.rpcOptions) as RPCProxy<Record<string, unknown>>
  }

  async create(type: string, data: Record<string, unknown>): Promise<NounInstance> {
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.create(data)
    return toNounInstance(result)
  }

  async get(type: string, id: string): Promise<NounInstance | null> {
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.get(id)
    if (!result) return null
    return toNounInstance(result)
  }

  async find(type: string, where?: Record<string, unknown>): Promise<NounInstance[]> {
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = (await ns.find(where ?? {})) as unknown[]
    if (Array.isArray(result)) return result.map(toNounInstance)
    return []
  }

  async update(type: string, id: string, data: Record<string, unknown>): Promise<NounInstance> {
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.update(id, data)
    return toNounInstance(result)
  }

  async delete(type: string, id: string): Promise<boolean> {
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.delete(id)
    return result !== false
  }

  async findOne(type: string, where?: Record<string, unknown>): Promise<NounInstance | null> {
    const results = await this.find(type, where)
    return results[0] ?? null
  }

  async rollback(type: string, id: string, toVersion: number): Promise<NounInstance> {
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.rollback(id, toVersion)
    return toNounInstance(result)
  }

  async perform(type: string, verb: string, id: string, data?: Record<string, unknown>): Promise<NounInstance> {
    // Verbs go through the entity's verb method: $.contacts.qualify('contact_abc', {...})
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns[verb](id, data ?? {})
    return toNounInstance(result)
  }
}
