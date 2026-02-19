// Ambient declarations for rpc.do — used until rpc.do ships its own .d.ts files

declare module 'rpc.do' {
  export interface RpcOptions {
    auth?: string | (() => string | null | Promise<string | null>)
    timeout?: number
    reconnect?: boolean
    middleware?: RPCMiddleware[]
    headers?: Record<string, string>
    [key: string]: unknown
  }

  export interface RPCOptions extends RpcOptions {}

  export type RPCProxy<T extends object = Record<string, unknown>> = T & {
    [key: string]: unknown
  }

  export type RpcProxy<T extends object = Record<string, unknown>> = RPCProxy<T>

  export interface RpcPromise<T = unknown> extends Promise<T> {
    [key: string]: unknown
  }
  export type RPCPromise<T = unknown> = RpcPromise<T>
  export type RpcPipelined<T = unknown> = T
  export type RpcArrayMethods<T = unknown> = T[]
  export type RpcMapCallback<T = unknown, U = unknown> = (item: T) => U
  export type RpcArrayPromise<T = unknown> = Promise<T[]>
  export type MagicMap<K = unknown, V = unknown> = Map<K, V>
  export type MutableMagicMap<K = unknown, V = unknown> = Map<K, V>

  export interface Transport {
    call: (method: string, args: unknown[]) => Promise<unknown>
    close?: () => void
  }
  export type TransportFactory = (url: string, options?: Record<string, unknown>) => Transport

  export interface RPCMiddleware {
    (ctx: unknown, next: () => Promise<unknown>): Promise<unknown>
  }

  export type RPCClient = RPCProxy
  export type RPCServer = unknown
  export type RPCClientConfig = RpcOptions
  export type RPCServerConfig = unknown
  export type RPCMethodHandler = unknown
  export type RPCHandlerContext = unknown
  export type CapnWebConfig = unknown
  export type ProxyOptions = unknown

  export interface HttpTransportOptions {
    auth?: string
    headers?: Record<string, string>
    timeout?: number
  }

  export interface CapnwebTransportOptions {
    auth?: string
    reconnect?: boolean
  }

  export interface DOClient {
    sql: SqlQuery
    storage: RemoteStorage
    collections: Record<string, RemoteCollection>
  }

  export interface SqlQuery {
    exec(query: string, ...params: unknown[]): Promise<unknown>
  }

  export interface RemoteStorage {
    get(key: string): Promise<unknown>
    put(key: string, value: unknown): Promise<void>
    delete(key: string): Promise<boolean>
    list(options?: Record<string, unknown>): Promise<Map<string, unknown>>
  }

  export interface RemoteCollection {
    find(filter?: Record<string, unknown>): Promise<unknown[]>
    findOne(filter?: Record<string, unknown>): Promise<unknown>
    create(data: Record<string, unknown>): Promise<unknown>
    update(id: string, data: Record<string, unknown>): Promise<unknown>
    delete(id: string): Promise<unknown>
  }

  export interface Filter {
    [key: string]: unknown
  }

  export interface QueryOptions {
    limit?: number
    offset?: number
    sort?: Record<string, 1 | -1>
  }

  export function RPC<T extends object = Record<string, unknown>>(url: string, options?: RpcOptions): RPCProxy<T>
  export function createRPCClient<T extends object = Record<string, unknown>>(url: string, options?: RpcOptions): RPCProxy<T>
  export function createDOClient(stub: unknown, options?: Record<string, unknown>): DOClient
  export function connectDO(stub: unknown, options?: Record<string, unknown>): DOClient

  export const $: RPCProxy

  export function http(url: string, options?: HttpTransportOptions): Transport
  export function capnweb(url: string, options?: CapnwebTransportOptions): Transport
  export function binding(stub: unknown): Transport
  export function composite(...transports: Transport[]): Transport
}

declare module 'rpc.do/transports' {
  import type { Transport, HttpTransportOptions, CapnwebTransportOptions } from 'rpc.do'
  export function http(url: string, opts?: HttpTransportOptions): Transport
  export function capnweb(url: string, opts?: CapnwebTransportOptions): Transport
}

declare module 'rpc.do/middleware' {
  import type { Transport } from 'rpc.do'
  export function withBatching(
    transport: Transport,
    opts?: { windowMs?: number; maxBatchSize?: number },
  ): Transport
}
