/**
 * DONounProvider — bridges Noun() proxy to Durable Object storage via rpc.do
 *
 * Uses capnweb promise pipelining for single-round-trip chains.
 * All CRUD + verb operations go through the rpc.do transport layer,
 * which handles batching, pipelining, and pass-by-reference automatically.
 */

import type { NounProvider, NounInstance } from 'digital-objects'
import { RPC } from 'rpc.do'
import type { RpcProxy, RpcOptions } from 'rpc.do'

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
 * - $.contacts.put('contact_abc', { ... })
 */
export class DONounProvider implements NounProvider {
  private rpc: RpcProxy<Record<string, unknown>>
  private context: string

  constructor(options: DONounProviderOptions) {
    this.context = options.context ?? 'https://headless.ly'

    if (options.doFetch) {
      // Legacy compatibility: wrap doFetch as a custom transport
      // This path exists for backward compat but should be migrated
      const doFetch = options.doFetch
      const basePath = options.basePath ?? ''
      this.rpc = new Proxy({} as RpcProxy<Record<string, unknown>>, {
        get: (_, prop: string) => {
          return {
            find: async (where?: Record<string, unknown>) => {
              const collection = prop
              let path = `${basePath}/${collection}`
              if (where && Object.keys(where).length > 0) {
                const params = new URLSearchParams()
                for (const [key, value] of Object.entries(where)) {
                  if (typeof value === 'object' && value !== null) {
                    for (const [op, opValue] of Object.entries(value as Record<string, unknown>)) {
                      params.set(`${key}[${op}]`, Array.isArray(opValue) ? opValue.join(',') : String(opValue))
                    }
                  } else {
                    params.set(key, String(value))
                  }
                }
                path += `?${params.toString()}`
              }
              const response = await doFetch(path, { method: 'GET', headers: { 'X-Context': this.context } })
              if (!response.ok) throw new DOProviderError(`find failed`, response.status)
              const body = await response.json() as Record<string, unknown>
              const data = (body?.data ?? body?.items ?? body) as unknown[]
              return Array.isArray(data) ? data : []
            },
            get: async (id: string) => {
              const collection = prop
              const response = await doFetch(`${basePath}/${collection}/${encodeURIComponent(id)}`, {
                method: 'GET',
                headers: { 'X-Context': this.context },
              })
              if (response.status === 404) return null
              if (!response.ok) throw new DOProviderError(`get failed`, response.status)
              const body = await response.json() as Record<string, unknown>
              return body?.data ?? body
            },
            put: async (id: string, data: Record<string, unknown>) => {
              const collection = prop
              const response = await doFetch(`${basePath}/${collection}/${encodeURIComponent(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Context': this.context },
                body: JSON.stringify(data),
              })
              if (!response.ok) throw new DOProviderError(`update failed`, response.status)
              const body = await response.json() as Record<string, unknown>
              return body?.data ?? body
            },
            create: async (data: Record<string, unknown>) => {
              const collection = prop
              const response = await doFetch(`${basePath}/${collection}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Context': this.context },
                body: JSON.stringify(data),
              })
              if (!response.ok) throw new DOProviderError(`create failed`, response.status)
              const body = await response.json() as Record<string, unknown>
              return body?.data ?? body
            },
            delete: async (id: string) => {
              const collection = prop
              const response = await doFetch(`${basePath}/${collection}/${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: { 'X-Context': this.context },
              })
              if (response.status === 404) return false
              if (!response.ok) throw new DOProviderError(`delete failed`, response.status)
              return true
            },
          }
        },
      })
    } else {
      // Modern path: use rpc.do with capnweb
      const rpcOptions: RpcOptions = {}
      if (options.apiKey) {
        rpcOptions.auth = options.apiKey
      }

      const protocol = options.transport === 'ws' ? 'wss' : 'https'
      const url = options.endpoint.replace(/^https?/, protocol)
      this.rpc = RPC(url, rpcOptions) as RpcProxy<Record<string, unknown>>
    }
  }

  async create(type: string, data: Record<string, unknown>): Promise<NounInstance> {
    const collection = toCollectionName(type)
    const ns = this.rpc[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.create(data)
    return toNounInstance(result)
  }

  async get(type: string, id: string): Promise<NounInstance | null> {
    const collection = toCollectionName(type)
    const ns = this.rpc[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.get(id)
    if (!result) return null
    return toNounInstance(result)
  }

  async find(type: string, where?: Record<string, unknown>): Promise<NounInstance[]> {
    const collection = toCollectionName(type)
    const ns = this.rpc[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.find(where ?? {}) as unknown[]
    if (Array.isArray(result)) return result.map(toNounInstance)
    return []
  }

  async update(type: string, id: string, data: Record<string, unknown>): Promise<NounInstance> {
    const collection = toCollectionName(type)
    const ns = this.rpc[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.put(id, data)
    return toNounInstance(result)
  }

  async delete(type: string, id: string): Promise<boolean> {
    const collection = toCollectionName(type)
    const ns = this.rpc[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns.delete(id)
    return result !== false
  }

  async perform(type: string, verb: string, id: string, data?: Record<string, unknown>): Promise<NounInstance> {
    // Verbs go through the entity's verb method: $.contacts.qualify('contact_abc', {...})
    const collection = toCollectionName(type)
    const ns = this.rpc[collection] as Record<string, (...args: unknown[]) => Promise<unknown>>
    const result = await ns[verb](id, data ?? {})
    return toNounInstance(result)
  }
}
