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
  /** Transport type: 'ws' (default, persistent connection) or 'http' (single-use per request) */
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
  /**
   * Enable timer-based batching for sequential-but-close calls.
   * Wraps the transport with rpc.do's `withBatching` middleware, which
   * collects calls within a time window and sends them as a single `__batch`
   * request. Requires the server to implement a `__batch` handler.
   *
   * Without this, only concurrent calls (Promise.all) are batched automatically
   * by capnweb's microtask-level session sharing.
   */
  batching?: { windowMs?: number; maxBatchSize?: number }
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
  private _rpc: RPCProxy<Record<string, unknown>>
  public readonly endpoint: string

  constructor(options: DONounProviderOptions) {
    this.context = options.context ?? 'https://headless.ly'
    this.endpoint = options.endpoint

    // Build capnweb URL and options
    const rpcOptions: RPCOptions = {}
    if (options.apiKey) {
      rpcOptions.auth = options.apiKey
    }
    // Default to WebSocket — persistent connection avoids TLS handshake per request
    const useWs = options.transport !== 'http'
    if (useWs) {
      rpcOptions.reconnect = !!options.apiKey
    }
    this.rpcOptions = rpcOptions

    // Ensure endpoint has /rpc suffix for capnweb transport
    let normalizedEndpoint = options.endpoint.replace(/\/+$/, '')
    if (!normalizedEndpoint.endsWith('/rpc')) {
      normalizedEndpoint += '/rpc'
    }

    const isSecure = /^https:\/\//.test(normalizedEndpoint)
    const protocol = useWs ? (isSecure ? 'wss' : 'ws') : isSecure ? 'https' : 'http'
    this.rpcUrl = normalizedEndpoint.replace(/^https?:\/\//, `${protocol}://`)

    // Share a single RPC instance — the http() transport in rpc.do already
    // manages session lifecycle correctly: it caches sessionPromise and resets
    // it in `finally` after each batch completes. Concurrent callers share the
    // session (enabling automatic batching); sequential callers get fresh
    // sessions automatically. Creating separate RPC() instances per call
    // defeated this batching entirely.
    this._rpc = RPC(this.rpcUrl, this.rpcOptions) as RPCProxy<Record<string, unknown>>

    // If timer-based batching is requested, upgrade the transport asynchronously.
    // This wraps the transport with withBatching middleware to collect
    // sequential-but-close calls within a time window into a single __batch request.
    if (options.batching) {
      const batchOpts = options.batching
      this._rpcReady = this.initBatchedTransport(batchOpts)
    }
  }

  /**
   * Dynamically import rpc.do/middleware and rpc.do/transports to set up
   * timer-based batching. These subpath exports may not be available in
   * all published versions of rpc.do.
   */
  private async initBatchedTransport(batchOpts: { windowMs?: number; maxBatchSize?: number }): Promise<void> {
    try {
      const [{ http }, { withBatching }] = await Promise.all([
        import('rpc.do/transports') as Promise<{
          http: (url: string, opts?: { auth?: string }) => { call: (method: string, args: unknown[]) => Promise<unknown>; close?: () => void }
        }>,
        import('rpc.do/middleware') as Promise<{
          withBatching: (
            transport: { call: (method: string, args: unknown[]) => Promise<unknown>; close?: () => void },
            opts?: { windowMs?: number; maxBatchSize?: number },
          ) => { call: (method: string, args: unknown[]) => Promise<unknown>; close?: () => void }
        }>,
      ])
      const baseTransport = http(this.rpcUrl, this.rpcOptions.auth ? { auth: this.rpcOptions.auth as string } : undefined)
      const batchedTransport = withBatching(baseTransport, {
        windowMs: batchOpts.windowMs ?? 10,
        maxBatchSize: batchOpts.maxBatchSize ?? 100,
      })
      this._rpc = RPC(batchedTransport, this.rpcOptions) as RPCProxy<Record<string, unknown>>
    } catch {
      // rpc.do/middleware not available — fall back to default session sharing
    }
  }

  /** Promise that resolves when batched transport is initialized (if requested) */
  private _rpcReady?: Promise<void>

  /**
   * Ensure the batched transport is initialized before making RPC calls.
   * No-op when batching is not enabled.
   */
  private async ensureReady(): Promise<void> {
    if (this._rpcReady) await this._rpcReady
  }

  /**
   * Return the shared RPC proxy.
   * The underlying http() transport handles session lifecycle — concurrent
   * calls within the same microtask share a session (automatic batching),
   * while sequential awaits get fresh sessions via the transport's
   * sessionPromise reset in its `finally` block.
   */
  private rpc(): RPCProxy<Record<string, unknown>> {
    return this._rpc
  }

  async create(type: string, data: Record<string, unknown>): Promise<NounInstance> {
    await this.ensureReady()
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.create(data)
    return toNounInstance(result)
  }

  async get(type: string, id: string): Promise<NounInstance | null> {
    await this.ensureReady()
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.get(id)
    if (!result) return null
    return toNounInstance(result)
  }

  async find(type: string, where?: Record<string, unknown>): Promise<NounInstance[]> {
    await this.ensureReady()
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.find(where ?? {})
    // Capnweb returns { data: [...], meta: {...} } — extract the data array
    if (result && typeof result === 'object' && 'data' in (result as Record<string, unknown>)) {
      const items = (result as Record<string, unknown>).data as unknown[]
      return Array.isArray(items) ? items.map(toNounInstance) : []
    }
    if (Array.isArray(result)) return (result as unknown[]).map(toNounInstance)
    return []
  }

  async update(type: string, id: string, data: Record<string, unknown>): Promise<NounInstance> {
    await this.ensureReady()
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.update(id, data)
    return toNounInstance(result)
  }

  async delete(type: string, id: string): Promise<boolean> {
    await this.ensureReady()
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
    await this.ensureReady()
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.rollback(id, toVersion)
    return toNounInstance(result)
  }

  async perform(type: string, verb: string, id: string, data?: Record<string, unknown>): Promise<NounInstance> {
    await this.ensureReady()
    // Verbs route through the collection's perform() method on the capnweb target
    const collection = toCollectionName(type)
    const ns = this.rpc()[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    // Try collection.perform(id, verb, data) first (capnweb CollectionTarget),
    // fall back to collection[verb](id, data) for direct verb methods
    const result = typeof ns.perform === 'function' ? await ns.perform(id, verb, data ?? {}) : await ns[verb](id, data ?? {})
    return toNounInstance(result)
  }
}
