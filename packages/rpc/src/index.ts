/**
 * @headlessly/rpc — Preconfigured rpc.do client for headless.ly
 *
 * Built on rpc.do + capnweb for promise pipelining, magic .map(),
 * pass-by-reference, and automatic batching. One round-trip for
 * chains of dependent operations.
 *
 * @example
 * ```typescript
 * import { headlessly } from '@headlessly/rpc'
 *
 * const $ = headlessly({ tenant: 'acme', apiKey: 'key_...' })
 *
 * // Promise pipelining — one round-trip, not three
 * const deals = await $.contacts.find({ stage: 'Qualified' })
 *   .map(c => $.deals.find({ contact: c.$id }))
 *
 * // CRUD with capnweb batching
 * const [contacts, deals] = await Promise.all([
 *   $.contacts.find({ stage: 'Lead' }),
 *   $.deals.find({ stage: 'Open' }),
 * ])
 * ```
 *
 * @packageDocumentation
 */

export { RPC, createRPCClient, $ } from 'rpc.do'
export type {
  RpcProxy,
  RPCProxy,
  RpcPromise,
  RPCPromise,
  RpcPipelined,
  RpcArrayMethods,
  RpcMapCallback,
  RpcArrayPromise,
  MagicMap,
  Transport,
  RpcClientMiddleware,
  RPCClientMiddleware,
  StreamResponse,
  Subscription,
} from 'rpc.do'

export { http, capnweb, binding, composite } from 'rpc.do'
export type { HttpTransportOptions, CapnwebTransportOptions } from 'rpc.do'

export {
  createDOClient,
  connectDO,
} from 'rpc.do'
export type {
  DOClient,
  SqlQuery,
  RemoteStorage,
  RemoteCollection,
  Filter,
  QueryOptions,
} from 'rpc.do'

import { RPC } from 'rpc.do'
import type { RpcProxy, RpcOptions } from 'rpc.do'

// =============================================================================
// Headlessly-specific client factory
// =============================================================================

export interface HeadlesslyRpcOptions {
  /** Tenant identifier (e.g., 'acme') */
  tenant: string
  /** API key for authentication (format: 'key_...') */
  apiKey?: string
  /** Endpoint override (default: https://db.headless.ly) */
  endpoint?: string
  /** Transport: 'http' (default) or 'ws' for real-time */
  transport?: 'http' | 'ws'
}

/**
 * Create a preconfigured rpc.do client for a headless.ly tenant.
 *
 * Uses capnweb promise pipelining under the hood — chain dependent
 * operations and they execute in a single round-trip.
 *
 * @example
 * ```typescript
 * const $ = headlessly({ tenant: 'acme', apiKey: 'key_...' })
 *
 * // One round-trip for the whole chain
 * const qualified = await $.contacts.find({ stage: 'Qualified' })
 * const deals = await $.deals.find({ stage: 'Open' }).map(d => d.value)
 * ```
 */
export function headlessly<T extends object = Record<string, unknown>>(
  options: HeadlesslyRpcOptions,
): RpcProxy<T> {
  const base = options.endpoint ?? 'https://db.headless.ly'
  const protocol = options.transport === 'ws' ? 'wss' : 'https'
  const url = base.replace(/^https?/, protocol)

  const rpcOptions: RpcOptions = {}
  if (options.apiKey) {
    rpcOptions.auth = options.apiKey
  }

  return RPC<T>(`${url}/~${options.tenant}`, rpcOptions) as RpcProxy<T>
}

/**
 * Create a headless.ly RPC client (alias for headlessly())
 */
export const createHeadlesslyClient = headlessly
