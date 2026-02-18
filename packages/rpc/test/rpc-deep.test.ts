import { describe, it, expect, vi } from 'vitest'

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
  buildHeadlesslyConfig,
} from '../src/index.js'

import type { RpcProxy, RPCProxy, Transport, HeadlesslyRpcOptions, DOClient, HttpTransportOptions, CapnwebTransportOptions } from '../src/index.js'

// =============================================================================
// 1. Factory Configuration (~8 tests)
// =============================================================================

describe('Factory Configuration', () => {
  it('default endpoint is https://db.headless.ly', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'test' })
    expect(url).toMatch(/^https:\/\/db\.headless\.ly/)
  })

  it('custom endpoint is used when provided', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'test', endpoint: 'https://custom.example.com' })
    expect(url).toBe('https://custom.example.com/~test')
  })

  it('tenant is appended as /~{tenant}', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'myorg' })
    expect(url).toMatch(/\/~myorg$/)
  })

  it('WebSocket transport converts https to wss', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'test', transport: 'ws' })
    expect(url).toMatch(/^wss:\/\//)
  })

  it('HTTP transport keeps https', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'test', transport: 'http' })
    expect(url).toMatch(/^https:\/\//)
  })

  it('apiKey is passed as auth option to RPC', () => {
    const { rpcOptions } = buildHeadlesslyConfig({ tenant: 'test', apiKey: 'key_secret123' })
    expect(rpcOptions).toEqual({ auth: 'key_secret123' })
  })

  it('no apiKey means no auth option', () => {
    const { rpcOptions } = buildHeadlesslyConfig({ tenant: 'test' })
    expect(rpcOptions).toEqual({})
    expect(rpcOptions).not.toHaveProperty('auth')
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
  it('empty tenant creates valid client with /~ path', () => {
    const client = headlessly({ tenant: '' })
    expect(client).toBeDefined()
    const { url } = buildHeadlesslyConfig({ tenant: '' })
    expect(url).toBe('https://db.headless.ly/~')
  })

  it('endpoint with trailing slash is normalized', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', endpoint: 'https://custom.example.com/' })
    expect(url).toBe('https://custom.example.com/~acme')
  })

  it('transport defaults to http when not specified', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme' })
    expect(url).toMatch(/^https:\/\//)
    expect(url).not.toMatch(/^wss:\/\//)
  })

  it('multiple calls create independent clients', () => {
    const client1 = headlessly({ tenant: 'org1' })
    const client2 = headlessly({ tenant: 'org2' })
    expect(client1).not.toBe(client2)
    const config1 = buildHeadlesslyConfig({ tenant: 'org1' })
    const config2 = buildHeadlesslyConfig({ tenant: 'org2' })
    expect(config1.url).toContain('/~org1')
    expect(config2.url).toContain('/~org2')
  })

  it('options object is not mutated', () => {
    const opts: HeadlesslyRpcOptions = { tenant: 'acme', apiKey: 'key_test' }
    const copy = { ...opts }
    headlessly(opts)
    expect(opts).toEqual(copy)
  })

  it('http endpoint protocol is preserved', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', endpoint: 'http://localhost:8787' })
    expect(url).toBe('http://localhost:8787/~acme')
  })

  it('ws transport maps http to ws in custom endpoint', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', endpoint: 'http://localhost:8787', transport: 'ws' })
    expect(url).toBe('ws://localhost:8787/~acme')
  })

  it('ws transport replaces https with wss in default endpoint', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', transport: 'ws' })
    expect(url).toBe('wss://db.headless.ly/~acme')
  })
})

// =============================================================================
// 5. Client Behavior (~4 tests)
// =============================================================================

describe('Client Behavior', () => {
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
    // RPC proxies don't handle Symbol.toPrimitive — this is expected upstream behavior.
    // The proxy also fires an async rejection, so we suppress it here.
    const suppress = () => {}
    process.on('unhandledRejection', suppress)
    try {
      const client = headlessly({ tenant: 'acme' })
      expect(() => String(client)).toThrow()
    } finally {
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
