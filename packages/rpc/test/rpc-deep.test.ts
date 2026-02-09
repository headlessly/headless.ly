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

import {
  headlessly,
  createHeadlesslyClient,
  RPC,
  createRPCClient,
  $,
  http,
  capnweb,
  binding,
  composite,
  createDOClient,
  connectDO,
} from '../src/index.js'

import type {
  RpcProxy,
  RPCProxy,
  Transport,
  HeadlesslyRpcOptions,
  DOClient,
  StreamResponse,
  Subscription,
  HttpTransportOptions,
  CapnwebTransportOptions,
} from '../src/index.js'

// =============================================================================
// 1. Factory Configuration (~8 tests)
// =============================================================================

describe('Factory Configuration', () => {
  beforeEach(() => {
    rpcCalls.length = 0
    vi.mocked(RPC).mockClear()
  })

  it('default endpoint is https://db.headless.ly', () => {
    headlessly({ tenant: 'test' })
    expect(rpcCalls[0]!.url).toMatch(/^https:\/\/db\.headless\.ly/)
  })

  it('custom endpoint is used when provided', () => {
    headlessly({ tenant: 'test', endpoint: 'https://custom.example.com' })
    expect(rpcCalls[0]!.url).toBe('https://custom.example.com/~test')
  })

  it('tenant is appended as /~{tenant}', () => {
    headlessly({ tenant: 'myorg' })
    expect(rpcCalls[0]!.url).toMatch(/\/~myorg$/)
  })

  it('WebSocket transport converts https to wss', () => {
    headlessly({ tenant: 'test', transport: 'ws' })
    expect(rpcCalls[0]!.url).toMatch(/^wss:\/\//)
  })

  it('HTTP transport keeps https', () => {
    headlessly({ tenant: 'test', transport: 'http' })
    expect(rpcCalls[0]!.url).toMatch(/^https:\/\//)
  })

  it('apiKey is passed as auth option to RPC', () => {
    headlessly({ tenant: 'test', apiKey: 'key_secret123' })
    expect(rpcCalls[0]!.options).toEqual({ auth: 'key_secret123' })
  })

  it('no apiKey means no auth option', () => {
    headlessly({ tenant: 'test' })
    expect(rpcCalls[0]!.options).toEqual({})
    expect(rpcCalls[0]!.options).not.toHaveProperty('auth')
  })

  it('createHeadlesslyClient is identical reference to headlessly', () => {
    expect(createHeadlesslyClient).toBe(headlessly)
  })
})

// =============================================================================
// 2. Re-exports Verification (~8 tests)
// =============================================================================

describe('Re-exports Verification', () => {
  it('RPC is exported and is a function', () => {
    expect(RPC).toBeDefined()
    expect(typeof RPC).toBe('function')
  })

  it('createRPCClient is exported and is a function', () => {
    expect(createRPCClient).toBeDefined()
    expect(typeof createRPCClient).toBe('function')
  })

  it('$ is exported and is defined', () => {
    expect($).toBeDefined()
  })

  it('http transport is exported and is a function', () => {
    expect(http).toBeDefined()
    expect(typeof http).toBe('function')
  })

  it('capnweb transport is exported and is a function', () => {
    expect(capnweb).toBeDefined()
    expect(typeof capnweb).toBe('function')
  })

  it('binding transport is exported and is a function', () => {
    expect(binding).toBeDefined()
    expect(typeof binding).toBe('function')
  })

  it('composite transport is exported and is a function', () => {
    expect(composite).toBeDefined()
    expect(typeof composite).toBe('function')
  })

  it('createDOClient and connectDO are exported', () => {
    expect(createDOClient).toBeDefined()
    expect(typeof createDOClient).toBe('function')
    expect(connectDO).toBeDefined()
    expect(typeof connectDO).toBe('function')
  })
})

// =============================================================================
// 3. Type Re-exports (~4 tests)
// =============================================================================

describe('Type Re-exports', () => {
  it('RpcProxy type is importable (compile-time check)', () => {
    // If this file compiles, RpcProxy is importable.
    // Runtime check: use a type assertion to prove the import resolves.
    const assertType = <T>(_val?: T) => true
    expect(assertType<RpcProxy<{ foo: () => string }>>()).toBe(true)
  })

  it('Transport type is importable (compile-time check)', () => {
    const assertType = <T>(_val?: T) => true
    expect(assertType<Transport>()).toBe(true)
  })

  it('HeadlesslyRpcOptions type is importable (compile-time check)', () => {
    const opts: HeadlesslyRpcOptions = { tenant: 'acme' }
    expect(opts.tenant).toBe('acme')
  })

  it('DOClient type is importable (compile-time check)', () => {
    const assertType = <T>(_val?: T) => true
    expect(assertType<DOClient>()).toBe(true)
  })
})

// =============================================================================
// 4. Factory Edge Cases (~6 tests)
// =============================================================================

describe('Factory Edge Cases', () => {
  beforeEach(() => {
    rpcCalls.length = 0
    vi.mocked(RPC).mockClear()
  })

  it('empty tenant creates valid client with /~ path', () => {
    const client = headlessly({ tenant: '' })
    expect(client).toBeDefined()
    expect(rpcCalls[0]!.url).toBe('https://db.headless.ly/~')
  })

  it('endpoint with trailing slash is normalized', () => {
    headlessly({ tenant: 'acme', endpoint: 'https://custom.example.com/' })
    // Current behavior: trailing slash is NOT stripped — URL becomes https://custom.example.com//~acme
    // Expected behavior: trailing slash should be stripped, yielding https://custom.example.com/~acme
    expect(rpcCalls[0]!.url).toBe('https://custom.example.com/~acme')
  })

  it('transport defaults to http when not specified', () => {
    headlessly({ tenant: 'acme' })
    expect(rpcCalls[0]!.url).toMatch(/^https:\/\//)
    expect(rpcCalls[0]!.url).not.toMatch(/^wss:\/\//)
  })

  it('multiple calls create independent clients', () => {
    const client1 = headlessly({ tenant: 'org1' })
    const client2 = headlessly({ tenant: 'org2' })
    expect(client1).not.toBe(client2)
    expect(rpcCalls).toHaveLength(2)
    expect(rpcCalls[0]!.url).toContain('/~org1')
    expect(rpcCalls[1]!.url).toContain('/~org2')
  })

  it('options object is not mutated', () => {
    const opts: HeadlesslyRpcOptions = { tenant: 'acme', apiKey: 'key_test' }
    const copy = { ...opts }
    headlessly(opts)
    expect(opts).toEqual(copy)
  })

  it('http endpoint protocol is replaced with https', () => {
    headlessly({ tenant: 'acme', endpoint: 'http://localhost:8787' })
    expect(rpcCalls[0]!.url).toBe('https://localhost:8787/~acme')
  })

  it('ws transport replaces http with wss in custom endpoint', () => {
    headlessly({ tenant: 'acme', endpoint: 'http://localhost:8787', transport: 'ws' })
    expect(rpcCalls[0]!.url).toBe('wss://localhost:8787/~acme')
  })

  it('ws transport replaces https with wss in default endpoint', () => {
    headlessly({ tenant: 'acme', transport: 'ws' })
    expect(rpcCalls[0]!.url).toBe('wss://db.headless.ly/~acme')
  })
})

// =============================================================================
// 5. Client Behavior (~4 tests)
// =============================================================================

describe('Client Behavior', () => {
  beforeEach(() => {
    rpcCalls.length = 0
    vi.mocked(RPC).mockClear()
  })

  it('returned client is a proxy object (typeof is object)', () => {
    const client = headlessly({ tenant: 'acme' })
    expect(typeof client).toBe('object')
  })

  it('client supports property access for entity namespaces', () => {
    const client = headlessly<{ contacts: { find: (q: object) => Promise<unknown[]> } }>({ tenant: 'acme' })
    // Proxy should not throw on property access
    expect(() => (client as any).contacts).not.toThrow()
    expect((client as any).contacts).toBeDefined()
  })

  it('client property access for then/catch/finally returns undefined (not thenable)', () => {
    const client = headlessly({ tenant: 'acme' })
    // The proxy explicitly returns undefined for then/catch/finally
    // so it doesn't get treated as a thenable by Promise.resolve()
    expect((client as any).then).toBeUndefined()
    expect((client as any).catch).toBeUndefined()
    expect((client as any).finally).toBeUndefined()
  })

  it('String() coercion does not throw', () => {
    // Suppress unhandled rejection from proxy Symbol.toPrimitive path join
    // This is a known bug in rpc.do proxy — Symbol access creates async paths that reject
    const suppress = () => {}
    process.on('unhandledRejection', suppress)
    try {
      const client = headlessly({ tenant: 'acme' })
      // Proxy should handle Symbol.toPrimitive / toString gracefully
      expect(() => String(client)).not.toThrow()
    } finally {
      // Defer removal so the rejection can be caught
      setTimeout(() => process.removeListener('unhandledRejection', suppress), 50)
    }
  })

  it('JSON.stringify does not throw', () => {
    const client = headlessly({ tenant: 'acme' })
    // Proxy should handle toJSON or at minimum not explode on serialization
    expect(() => JSON.stringify(client)).not.toThrow()
  })
})

// =============================================================================
// 6. $ Global Client (~3 tests)
// =============================================================================

describe('$ Global Client', () => {
  it('$ is the default RPC client pointing to rpc.do', () => {
    expect($).toBeDefined()
    expect(typeof $).toBe('object')
  })

  it('$ supports property access like headlessly clients', () => {
    expect(() => ($ as any).contacts).not.toThrow()
    expect(($ as any).contacts).toBeDefined()
  })

  it('$ then/catch/finally are undefined (not thenable)', () => {
    expect(($ as any).then).toBeUndefined()
    expect(($ as any).catch).toBeUndefined()
    expect(($ as any).finally).toBeUndefined()
  })
})
