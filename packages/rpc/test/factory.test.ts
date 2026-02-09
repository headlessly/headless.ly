import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track RPC calls by intercepting the module
const rpcCalls: { url: string; options: Record<string, unknown> }[] = []
vi.mock('rpc.do', async (importOriginal) => {
  const orig = await importOriginal<typeof import('rpc.do')>()
  return {
    ...orig,
    RPC: vi.fn((...args: unknown[]) => {
      rpcCalls.push({ url: args[0] as string, options: (args[1] ?? {}) as Record<string, unknown> })
      return orig.RPC(...(args as Parameters<typeof orig.RPC>))
    }),
  }
})

import { headlessly, createHeadlesslyClient, RPC } from '../src/index.js'

describe('headlessly()', () => {
  beforeEach(() => {
    rpcCalls.length = 0
    vi.mocked(RPC).mockClear()
  })

  it('returns a defined proxy object', () => {
    const client = headlessly({ tenant: 'acme' })
    expect(client).toBeDefined()
  })

  it('createHeadlesslyClient is an alias for headlessly', () => {
    expect(createHeadlesslyClient).toBe(headlessly)
  })

  it('constructs default URL: https://db.headless.ly/~{tenant}', () => {
    headlessly({ tenant: 'acme' })
    expect(rpcCalls[0]!.url).toBe('https://db.headless.ly/~acme')
    expect(rpcCalls[0]!.options).toEqual({})
  })

  it('passes apiKey as auth option', () => {
    headlessly({ tenant: 'acme', apiKey: 'key_test' })
    expect(rpcCalls[0]!.url).toBe('https://db.headless.ly/~acme')
    expect(rpcCalls[0]!.options).toEqual({ auth: 'key_test' })
  })

  it('uses ws transport: wss protocol', () => {
    headlessly({ tenant: 'acme', transport: 'ws' })
    expect(rpcCalls[0]!.url).toBe('wss://db.headless.ly/~acme')
  })

  it('uses custom endpoint', () => {
    headlessly({ tenant: 'acme', endpoint: 'http://localhost:8787' })
    expect(rpcCalls[0]!.url).toBe('https://localhost:8787/~acme')
  })

  it('uses custom endpoint with ws transport', () => {
    headlessly({ tenant: 'acme', endpoint: 'http://localhost:8787', transport: 'ws' })
    expect(rpcCalls[0]!.url).toBe('wss://localhost:8787/~acme')
  })

  it('combines apiKey and ws transport', () => {
    headlessly({ tenant: 'acme', apiKey: 'key_test', transport: 'ws' })
    expect(rpcCalls[0]!.url).toBe('wss://db.headless.ly/~acme')
    expect(rpcCalls[0]!.options).toEqual({ auth: 'key_test' })
  })

  it('re-exports RPC from rpc.do', () => {
    expect(RPC).toBeDefined()
    expect(typeof RPC).toBe('function')
  })
})
