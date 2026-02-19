declare module 'rpc.do' {
  export interface RPCOptions {
    auth?: string | (() => string | null | Promise<string | null>)
    reconnect?: boolean
    headers?: Record<string, string>
    [key: string]: unknown
  }

  export type RPCProxy<T extends object = Record<string, unknown>> = T & {
    [key: string]: unknown
  }

  export function RPC<T extends object = Record<string, unknown>>(
    urlOrTransport: string | { call: (method: string, args: unknown[]) => Promise<unknown>; close?: () => void },
    options?: RPCOptions,
  ): RPCProxy<T>
}

declare module 'rpc.do/transports' {
  export function http(
    url: string,
    opts?: { auth?: string },
  ): {
    call: (method: string, args: unknown[]) => Promise<unknown>
    close?: () => void
  }
}

declare module 'rpc.do/middleware' {
  export function withBatching(
    transport: { call: (method: string, args: unknown[]) => Promise<unknown>; close?: () => void },
    opts?: { windowMs?: number; maxBatchSize?: number },
  ): {
    call: (method: string, args: unknown[]) => Promise<unknown>
    close?: () => void
  }
}
