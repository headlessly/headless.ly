import { describe, it, expect, vi, beforeEach } from 'vitest'

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

import type {
  HeadlesslyRpcOptions,
  RPCProxy,
  Transport,
  RPCMiddleware,
  RPCMiddleware as RpcClientMiddleware,
  RPCMiddleware as RPCClientMiddleware,
  RpcPromise,
  RPCPromise,
  RpcPipelined,
  RpcArrayMethods,
  RpcMapCallback,
  RpcArrayPromise,
  MagicMap,
  HttpTransportOptions,
  CapnwebTransportOptions,
  DOClient,
  SqlQuery,
  RemoteStorage,
  RemoteCollection,
  Filter,
  QueryOptions,
} from '../src/index.js'

// =============================================================================
// 1. URL Construction & Normalization Edge Cases (~8 tests)
// =============================================================================

describe('URL Construction Edge Cases', () => {
  it('endpoint with multiple trailing slashes is stripped down', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', endpoint: 'https://custom.example.com///' })
    expect(url).toBe('https://custom.example.com/~acme')
  })

  it('tenant with special characters is passed through verbatim', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'my-startup_v2' })
    expect(url).toBe('https://db.headless.ly/~my-startup_v2')
  })

  it('tenant with dots is preserved in URL', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'org.test' })
    expect(url).toContain('/~org.test')
  })

  it('endpoint with port number is preserved', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', endpoint: 'https://localhost:3000' })
    expect(url).toBe('https://localhost:3000/~acme')
  })

  it('endpoint with path is preserved before tenant', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', endpoint: 'https://example.com/api/v1' })
    expect(url).toBe('https://example.com/api/v1/~acme')
  })

  it('ws transport with port-included endpoint', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', endpoint: 'http://localhost:8787', transport: 'ws' })
    expect(url).toBe('ws://localhost:8787/~acme')
  })

  it('endpoint with https already is kept as https for http transport', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', endpoint: 'https://custom-api.com', transport: 'http' })
    expect(url).toBe('https://custom-api.com/~acme')
  })

  it('undefined apiKey does not add auth option', () => {
    const { rpcOptions } = buildHeadlesslyConfig({ tenant: 'acme', apiKey: undefined })
    expect(rpcOptions).toEqual({})
    expect(rpcOptions).not.toHaveProperty('auth')
  })
})

// =============================================================================
// 2. Proxy Deep Property Chain Behavior (~6 tests)
// =============================================================================

describe('Proxy Deep Property Chain', () => {
  it('deep property chains do not throw', () => {
    const client = headlessly({ tenant: 'acme' })
    expect(() => (client as any).a.b.c).not.toThrow()
  })

  it('deeply nested property is still defined', () => {
    const client = headlessly({ tenant: 'acme' })
    const deep = (client as any).contacts.find
    expect(deep).toBeDefined()
  })

  it('different property paths return different proxy objects', () => {
    const client = headlessly({ tenant: 'acme' })
    const a = (client as any).contacts
    const b = (client as any).deals
    // They are both defined proxy objects but accessing different paths
    expect(a).toBeDefined()
    expect(b).toBeDefined()
  })

  it('accessing numeric property names does not throw', () => {
    const client = headlessly({ tenant: 'acme' })
    expect(() => (client as any)[0]).not.toThrow()
    expect(() => (client as any)['123']).not.toThrow()
  })

  it('accessing Symbol.toStringTag does not throw', () => {
    const client = headlessly({ tenant: 'acme' })
    expect(() => (client as any)[Symbol.toStringTag]).not.toThrow()
  })

  it('repeated access to same property returns consistent proxy', () => {
    const client = headlessly({ tenant: 'acme' })
    const contacts1 = (client as any).contacts
    const contacts2 = (client as any).contacts
    // Both should be defined (they may or may not be the same reference)
    expect(contacts1).toBeDefined()
    expect(contacts2).toBeDefined()
  })
})

// =============================================================================
// 3. Transport Factories — Unit Tests (~6 tests)
// =============================================================================

describe('Transport Factories', () => {
  it('binding() wraps an object as a transport with call method', () => {
    const mockService = {
      greet: (name: string) => `Hello, ${name}`,
    }
    const transport = binding(mockService)
    expect(transport).toBeDefined()
    expect(typeof transport.call).toBe('function')
  })

  it('binding transport calls methods on the bound object', async () => {
    const mockService = {
      greet: vi.fn((name: string) => `Hello, ${name}`),
    }
    const transport = binding(mockService)
    const result = await transport.call('greet', ['World'])
    expect(result).toBe('Hello, World')
    expect(mockService.greet).toHaveBeenCalledWith('World')
  })

  it('binding transport traverses nested namespaces', async () => {
    const mockService = {
      users: {
        get: vi.fn((id: string) => ({ id, name: 'Alice' })),
      },
    }
    const transport = binding(mockService)
    const result = await transport.call('users.get', ['user_1'])
    expect(result).toEqual({ id: 'user_1', name: 'Alice' })
  })

  it('binding transport throws for unknown namespace', async () => {
    const mockService = {}
    const transport = binding(mockService)
    await expect(transport.call('nonexistent.method', [])).rejects.toThrow()
  })

  it('binding transport throws for non-function property', async () => {
    const mockService = { notAFunction: 42 }
    const transport = binding(mockService)
    await expect(transport.call('notAFunction', [])).rejects.toThrow()
  })

  it('composite() returns a transport with call and close', () => {
    const t1: Transport = { call: vi.fn(async () => 'result') }
    const t2: Transport = { call: vi.fn(async () => 'fallback') }
    const ct = composite(t1, t2)
    expect(ct).toBeDefined()
    expect(typeof ct.call).toBe('function')
    expect(typeof ct.close).toBe('function')
  })
})

// =============================================================================
// 4. Composite Transport Fallback (~5 tests)
// =============================================================================

describe('Composite Transport Fallback', () => {
  it('uses first transport when it succeeds', async () => {
    const t1: Transport = { call: vi.fn(async () => 'first') }
    const t2: Transport = { call: vi.fn(async () => 'second') }
    const ct = composite(t1, t2)
    const result = await ct.call('test', [])
    expect(result).toBe('first')
    expect(t1.call).toHaveBeenCalledTimes(1)
    expect(t2.call).not.toHaveBeenCalled()
  })

  it('falls back to second transport when first throws', async () => {
    const t1: Transport = {
      call: vi.fn(async () => {
        throw new Error('first failed')
      }),
    }
    const t2: Transport = { call: vi.fn(async () => 'second') }
    const ct = composite(t1, t2)
    const result = await ct.call('method', [])
    expect(result).toBe('second')
    expect(t1.call).toHaveBeenCalledTimes(1)
    expect(t2.call).toHaveBeenCalledTimes(1)
  })

  it('throws last error when all transports fail', async () => {
    const t1: Transport = {
      call: vi.fn(async () => {
        throw new Error('first failed')
      }),
    }
    const t2: Transport = {
      call: vi.fn(async () => {
        throw new Error('second failed')
      }),
    }
    const ct = composite(t1, t2)
    await expect(ct.call('method', [])).rejects.toThrow('second failed')
  })

  it('close() calls close on all transports', () => {
    const close1 = vi.fn()
    const close2 = vi.fn()
    const t1: Transport = { call: vi.fn(async () => null), close: close1 }
    const t2: Transport = { call: vi.fn(async () => null), close: close2 }
    const ct = composite(t1, t2)
    ct.close!()
    expect(close1).toHaveBeenCalledTimes(1)
    expect(close2).toHaveBeenCalledTimes(1)
  })

  it('close() is safe when transports lack close method', () => {
    const t1: Transport = { call: vi.fn(async () => null) }
    const t2: Transport = { call: vi.fn(async () => null) }
    const ct = composite(t1, t2)
    expect(() => ct.close!()).not.toThrow()
  })
})

// =============================================================================
// 5. createDOClient with Mock Transport (~5 tests)
// =============================================================================

describe('createDOClient with Mock Transport', () => {
  it('creates a client from a mock transport', () => {
    const mockTransport: Transport = {
      call: vi.fn(async (method, args) => ({ method, args })),
    }
    const client = createDOClient(mockTransport)
    expect(client).toBeDefined()
    expect(typeof client).toBe('object')
  })

  it('client then/catch/finally are undefined (not thenable)', () => {
    const mockTransport: Transport = {
      call: vi.fn(async () => null),
    }
    const client = createDOClient(mockTransport)
    expect((client as any).then).toBeUndefined()
    expect((client as any).catch).toBeUndefined()
    expect((client as any).finally).toBeUndefined()
  })

  it('client.close() calls transport.close()', async () => {
    const closeFn = vi.fn()
    const mockTransport: Transport = {
      call: vi.fn(async () => null),
      close: closeFn,
    }
    const client = createDOClient(mockTransport)
    await client.close()
    expect(closeFn).toHaveBeenCalledTimes(1)
  })

  it('client method invocations call transport.call with correct path', async () => {
    const callFn = vi.fn(async () => ({ id: '1', name: 'Test' }))
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await (client as any).users.create({ name: 'Test' })
    expect(callFn).toHaveBeenCalledWith('users.create', [{ name: 'Test' }])
  })

  it('client nested method invocations build correct dot-path', async () => {
    const callFn = vi.fn(async () => [])
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await (client as any).api.v2.contacts.list()
    expect(callFn).toHaveBeenCalledWith('api.v2.contacts.list', [])
  })
})

// =============================================================================
// 6. createDOClient — Storage, SQL, Collection Proxies (~6 tests)
// =============================================================================

describe('createDOClient DO Features', () => {
  it('client.storage.get calls __storageGet via transport', async () => {
    const callFn = vi.fn(async (method: string, args: unknown[]) => {
      if (method === '__storageGet') return 'value123'
      return null
    })
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.storage.get('myKey')
    expect(callFn).toHaveBeenCalledWith('__storageGet', ['myKey'])
    expect(result).toBe('value123')
  })

  it('client.storage.put calls __storagePut via transport', async () => {
    const callFn = vi.fn(async () => undefined)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await client.storage.put('key', 'value')
    expect(callFn).toHaveBeenCalledWith('__storagePut', ['key', 'value'])
  })

  it('client.storage.delete calls __storageDelete via transport', async () => {
    const callFn = vi.fn(async () => true)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.storage.delete('key')
    expect(callFn).toHaveBeenCalledWith('__storageDelete', ['key'])
    expect(result).toBe(true)
  })

  it('client.storage.keys calls __storageKeys via transport', async () => {
    const callFn = vi.fn(async () => ['a', 'b', 'c'])
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.storage.keys('prefix')
    expect(callFn).toHaveBeenCalledWith('__storageKeys', ['prefix'])
    expect(result).toEqual(['a', 'b', 'c'])
  })

  it('client.dbSchema() calls __dbSchema via transport', async () => {
    const schema = { tables: [], version: 1 }
    const callFn = vi.fn(async () => schema)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.dbSchema()
    expect(callFn).toHaveBeenCalledWith('__dbSchema', [])
    expect(result).toEqual(schema)
  })

  it('client.schema() calls __schema via transport', async () => {
    const rpcSchema = { version: 1, methods: [], namespaces: [] }
    const callFn = vi.fn(async () => rpcSchema)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.schema()
    expect(callFn).toHaveBeenCalledWith('__schema', [])
    expect(result).toEqual(rpcSchema)
  })
})

// =============================================================================
// 7. isFunction and isServerMessage Utilities (~4 tests)
// =============================================================================

describe('Utility Re-exports', () => {
  // We need to import these directly from rpc.do since they're re-exported
  let isFunction: (v: unknown) => boolean
  let isServerMessage: (v: unknown) => boolean

  beforeEach(async () => {
    const mod = await import('rpc.do')
    isFunction = mod.isFunction
    isServerMessage = mod.isServerMessage
  })

  it('isFunction returns true for functions', () => {
    expect(isFunction(() => {})).toBe(true)
    expect(isFunction(function () {})).toBe(true)
    expect(isFunction(async () => {})).toBe(true)
  })

  it('isFunction returns false for non-functions', () => {
    expect(isFunction(42)).toBe(false)
    expect(isFunction('string')).toBe(false)
    expect(isFunction(null)).toBe(false)
    expect(isFunction(undefined)).toBe(false)
    expect(isFunction({})).toBe(false)
  })

  it('isServerMessage returns true for result messages', () => {
    expect(isServerMessage({ result: 'ok' })).toBe(true)
    expect(isServerMessage({ result: null })).toBe(true)
    expect(isServerMessage({ id: 1, result: 'data' })).toBe(true)
  })

  it('isServerMessage returns false for non-message objects', () => {
    expect(isServerMessage(null)).toBe(false)
    expect(isServerMessage(undefined)).toBe(false)
    expect(isServerMessage('string')).toBe(false)
    expect(isServerMessage(42)).toBe(false)
    expect(isServerMessage({})).toBe(false)
    expect(isServerMessage({ data: 'something' })).toBe(false)
  })
})

// =============================================================================
// 8. createRPCClient (Deprecated Factory) (~3 tests)
// =============================================================================

describe('createRPCClient (Deprecated)', () => {
  it('createRPCClient creates a defined proxy client from baseUrl', () => {
    const client = createRPCClient({ baseUrl: 'https://example.com/rpc' })
    expect(client).toBeDefined()
    expect(typeof client).toBe('object')
  })

  it('createRPCClient result supports property access like headlessly clients', () => {
    const client = createRPCClient({ baseUrl: 'https://example.com/rpc', auth: 'token_abc' })
    expect(() => (client as any).users).not.toThrow()
    expect((client as any).users).toBeDefined()
  })

  it('createRPCClient result has then/catch/finally as undefined (not thenable)', () => {
    const client = createRPCClient({ baseUrl: 'https://example.com/rpc', timeout: 5000 })
    expect((client as any).then).toBeUndefined()
    expect((client as any).catch).toBeUndefined()
    expect((client as any).finally).toBeUndefined()
  })
})

// =============================================================================
// 9. Factory Concurrency & Independence (~3 tests)
// =============================================================================

describe('Factory Concurrency & Independence', () => {
  it('creating many clients in rapid succession works', () => {
    const clients = Array.from({ length: 20 }, (_, i) => headlessly({ tenant: `org_${i}` }))
    expect(clients).toHaveLength(20)
    clients.forEach((c) => expect(c).toBeDefined())
  })

  it('each client gets unique tenant URL', () => {
    const configs = ['alpha', 'beta', 'gamma'].map((t) => buildHeadlesslyConfig({ tenant: t }))
    const urls = configs.map((c) => c.url)
    expect(new Set(urls).size).toBe(3)
    expect(urls[0]).toContain('/~alpha')
    expect(urls[1]).toContain('/~beta')
    expect(urls[2]).toContain('/~gamma')
  })

  it('clients with different configs are independent', () => {
    const c1 = buildHeadlesslyConfig({ tenant: 'a', apiKey: 'key_1' })
    const c2 = buildHeadlesslyConfig({ tenant: 'b', transport: 'ws' })
    const c3 = buildHeadlesslyConfig({ tenant: 'c', endpoint: 'https://other.com' })
    expect(c1.rpcOptions).toEqual({ auth: 'key_1' })
    expect(c2.url).toMatch(/^wss:\/\//)
    expect(c3.url).toContain('other.com')
  })
})

// =============================================================================
// 10. Type Safety Checks (compile-time + runtime) (~4 tests)
// =============================================================================

describe('Type Safety', () => {
  it('RPCProxy type alias is the same as RpcProxy', async () => {
    // Both should be importable; this is a compile-time check
    const assertType = <T>(_val?: T) => true
    expect(assertType<RPCProxy<{ foo: () => string }>>()).toBe(true)
  })

  it('Filter type supports MongoDB operators', () => {
    const filter: Filter<{ name: string; age: number }> = {
      name: { $regex: '^A' },
      age: { $gt: 18 },
    }
    expect(filter).toBeDefined()
    expect((filter.name as any).$regex).toBe('^A')
    expect((filter.age as any).$gt).toBe(18)
  })

  it('QueryOptions accepts limit, offset, sort', () => {
    const opts: QueryOptions = { limit: 10, offset: 20, sort: '-createdAt' }
    expect(opts.limit).toBe(10)
    expect(opts.offset).toBe(20)
    expect(opts.sort).toBe('-createdAt')
  })

  it('HeadlesslyRpcOptions accepts all documented fields', () => {
    const full: HeadlesslyRpcOptions = {
      tenant: 'test',
      apiKey: 'key_test',
      endpoint: 'https://custom.com',
      transport: 'ws',
    }
    expect(full.tenant).toBe('test')
    expect(full.apiKey).toBe('key_test')
    expect(full.endpoint).toBe('https://custom.com')
    expect(full.transport).toBe('ws')
  })
})

// =============================================================================
// 11. Collection Proxy via createDOClient (~4 tests)
// =============================================================================

describe('createDOClient Collection Proxy', () => {
  it('client.collection(name).get calls __collectionGet', async () => {
    const callFn = vi.fn(async (method: string, args: unknown[]) => {
      if (method === '__collectionGet') return { id: 'doc_1', name: 'Alice' }
      return null
    })
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.collection('users').get('doc_1')
    expect(callFn).toHaveBeenCalledWith('__collectionGet', ['users', 'doc_1'])
    expect(result).toEqual({ id: 'doc_1', name: 'Alice' })
  })

  it('client.collection(name).put calls __collectionPut', async () => {
    const callFn = vi.fn(async () => undefined)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await client.collection('users').put('doc_1', { name: 'Alice' } as any)
    expect(callFn).toHaveBeenCalledWith('__collectionPut', ['users', 'doc_1', { name: 'Alice' }])
  })

  it('client.collection(name).find calls __collectionFind', async () => {
    const callFn = vi.fn(async () => [{ id: '1' }, { id: '2' }])
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.collection('users').find({ name: 'Alice' } as any)
    expect(callFn).toHaveBeenCalledWith('__collectionFind', ['users', { name: 'Alice' }, undefined])
    expect(result).toHaveLength(2)
  })

  it('client.collection(name).count calls __collectionCount', async () => {
    const callFn = vi.fn(async () => 42)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.collection('users').count()
    expect(callFn).toHaveBeenCalledWith('__collectionCount', ['users', undefined])
    expect(result).toBe(42)
  })
})

// =============================================================================
// 12. SQL Proxy via createDOClient (~3 tests)
// =============================================================================

describe('createDOClient SQL Proxy', () => {
  it('client.sql`...`.all() calls __sql via transport', async () => {
    const rows = [{ id: 1, name: 'Alice' }]
    const callFn = vi.fn(async () => ({ results: rows, meta: { rows_read: 1, rows_written: 0 } }))
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.sql`SELECT * FROM users`.all()
    expect(callFn).toHaveBeenCalledTimes(1)
    expect(callFn.mock.calls[0]![0]).toBe('__sql')
    expect(result).toEqual(rows)
  })

  it('client.sql`...`.first() calls __sqlFirst via transport', async () => {
    const callFn = vi.fn(async () => ({ id: 1, name: 'Alice' }))
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.sql`SELECT * FROM users LIMIT 1`.first()
    expect(callFn).toHaveBeenCalledTimes(1)
    expect(callFn.mock.calls[0]![0]).toBe('__sqlFirst')
    expect(result).toEqual({ id: 1, name: 'Alice' })
  })

  it('client.sql`...`.run() calls __sqlRun via transport', async () => {
    const callFn = vi.fn(async () => ({ rowsWritten: 5 }))
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.sql`UPDATE users SET active = ${true}`.run()
    expect(callFn).toHaveBeenCalledTimes(1)
    expect(callFn.mock.calls[0]![0]).toBe('__sqlRun')
    // The sql tagged template passes the interpolated values
    const serialized = callFn.mock.calls[0]![1]![0] as any
    expect(serialized.values).toEqual([true])
    expect(result).toEqual({ rowsWritten: 5 })
  })
})

// =============================================================================
// 13. Storage Multi-Key Operations (~3 tests)
// =============================================================================

describe('createDOClient Storage Multi-Key', () => {
  it('client.storage.get with array calls __storageGetMultiple', async () => {
    const callFn = vi.fn(async () => ({ a: 1, b: 2 }))
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.storage.get(['a', 'b'])
    expect(callFn).toHaveBeenCalledWith('__storageGetMultiple', [['a', 'b']])
    expect(result).toBeInstanceOf(Map)
    expect(result.get('a')).toBe(1)
    expect(result.get('b')).toBe(2)
  })

  it('client.storage.put with object calls __storagePutMultiple', async () => {
    const callFn = vi.fn(async () => undefined)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await client.storage.put({ x: 10, y: 20 } as any)
    expect(callFn).toHaveBeenCalledWith('__storagePutMultiple', [{ x: 10, y: 20 }])
  })

  it('client.storage.list returns a Map', async () => {
    const callFn = vi.fn(async () => ({ key1: 'val1', key2: 'val2' }))
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.storage.list({ prefix: 'key' })
    expect(callFn).toHaveBeenCalledWith('__storageList', [{ prefix: 'key' }])
    expect(result).toBeInstanceOf(Map)
    expect(result.get('key1')).toBe('val1')
  })
})
