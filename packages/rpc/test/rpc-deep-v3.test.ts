import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  headlessly,
  RPC,
  $,
  http,
  capnweb,
  binding,
  composite,
  createDOClient,
  createRPCClient,
  buildHeadlesslyConfig,
} from '../src/index.js'

import type {
  Transport,
  HeadlesslyRpcOptions,
  HttpTransportOptions,
  CapnwebTransportOptions,
} from '../src/index.js'

// =============================================================================
// 1. Error Classes — ConnectionError (~8 tests)
// =============================================================================

describe('Error Classes — ConnectionError', () => {
  let ConnectionError: typeof import('rpc.do/errors').ConnectionError

  beforeEach(async () => {
    const mod = await import('rpc.do/errors')
    ConnectionError = mod.ConnectionError
  })

  it('ConnectionError.timeout creates a retryable timeout error', () => {
    const err = ConnectionError.timeout(5000)
    expect(err).toBeInstanceOf(ConnectionError)
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('CONNECTION_TIMEOUT')
    expect(err.retryable).toBe(true)
    expect(err.message).toContain('5000')
  })

  it('ConnectionError.authFailed creates a non-retryable auth error', () => {
    const err = ConnectionError.authFailed('bad token')
    expect(err.code).toBe('AUTH_FAILED')
    expect(err.retryable).toBe(false)
    expect(err.message).toContain('bad token')
  })

  it('ConnectionError.authFailed uses default message when none given', () => {
    const err = ConnectionError.authFailed()
    expect(err.message).toBe('Authentication failed')
    expect(err.code).toBe('AUTH_FAILED')
  })

  it('ConnectionError.connectionLost is retryable', () => {
    const err = ConnectionError.connectionLost('network down')
    expect(err.code).toBe('CONNECTION_LOST')
    expect(err.retryable).toBe(true)
    expect(err.message).toContain('network down')
  })

  it('ConnectionError.reconnectFailed is not retryable', () => {
    const err = ConnectionError.reconnectFailed(10)
    expect(err.code).toBe('RECONNECT_FAILED')
    expect(err.retryable).toBe(false)
    expect(err.message).toContain('10')
  })

  it('ConnectionError.heartbeatTimeout is retryable', () => {
    const err = ConnectionError.heartbeatTimeout()
    expect(err.code).toBe('HEARTBEAT_TIMEOUT')
    expect(err.retryable).toBe(true)
    expect(err.message).toContain('heartbeat')
  })

  it('ConnectionError.insecureConnection is not retryable', () => {
    const err = ConnectionError.insecureConnection()
    expect(err.code).toBe('INSECURE_CONNECTION')
    expect(err.retryable).toBe(false)
    expect(err.message).toContain('SECURITY')
  })

  it('ConnectionError.requestTimeout is retryable', () => {
    const err = ConnectionError.requestTimeout(3000)
    expect(err.code).toBe('REQUEST_TIMEOUT')
    expect(err.retryable).toBe(true)
    expect(err.message).toContain('3000')
  })
})

// =============================================================================
// 2. Error Classes — RPCError, AuthenticationError, RateLimitError (~8 tests)
// =============================================================================

describe('Error Classes — RPCError, AuthenticationError, RateLimitError', () => {
  let RPCError: typeof import('rpc.do/errors').RPCError
  let AuthenticationError: typeof import('rpc.do/errors').AuthenticationError
  let RateLimitError: typeof import('rpc.do/errors').RateLimitError

  beforeEach(async () => {
    const mod = await import('rpc.do/errors')
    RPCError = mod.RPCError
    AuthenticationError = mod.AuthenticationError
    RateLimitError = mod.RateLimitError
  })

  it('RPCError carries code and data', () => {
    const err = new RPCError('method not found', 'METHOD_NOT_FOUND', { path: 'users.get' })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('RPCError')
    expect(err.code).toBe('METHOD_NOT_FOUND')
    expect(err.data).toEqual({ path: 'users.get' })
    expect(err.message).toBe('method not found')
  })

  it('RPCError without data defaults to undefined', () => {
    const err = new RPCError('fail', 'UNKNOWN')
    expect(err.data).toBeUndefined()
  })

  it('AuthenticationError has status 401 and correct name', () => {
    const err = new AuthenticationError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('AuthenticationError')
    expect(err.status).toBe(401)
    expect(err.message).toBe('Authentication failed')
  })

  it('AuthenticationError accepts custom message', () => {
    const err = new AuthenticationError('Token expired')
    expect(err.message).toBe('Token expired')
    expect(err.status).toBe(401)
  })

  it('RateLimitError has status 429', () => {
    const err = new RateLimitError()
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('RateLimitError')
    expect(err.status).toBe(429)
  })

  it('RateLimitError carries retryAfter seconds', () => {
    const err = new RateLimitError('slow down', 60)
    expect(err.retryAfter).toBe(60)
    expect(err.message).toBe('slow down')
  })

  it('RateLimitError without retryAfter has undefined', () => {
    const err = new RateLimitError('limit exceeded')
    expect(err.retryAfter).toBeUndefined()
  })

  it('RateLimitError default message is "Rate limit exceeded"', () => {
    const err = new RateLimitError()
    expect(err.message).toBe('Rate limit exceeded')
  })
})

// =============================================================================
// 3. Error Classes — ProtocolVersionError (~5 tests)
// =============================================================================

describe('Error Classes — ProtocolVersionError', () => {
  let ProtocolVersionError: typeof import('rpc.do/errors').ProtocolVersionError

  beforeEach(async () => {
    const mod = await import('rpc.do/errors')
    ProtocolVersionError = mod.ProtocolVersionError
  })

  it('detects major version mismatch', () => {
    const err = new ProtocolVersionError('1.0.0', '2.0.0')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ProtocolVersionError')
    expect(err.clientVersion).toBe('1.0.0')
    expect(err.serverVersion).toBe('2.0.0')
    expect(err.isMajorMismatch).toBe(true)
    expect(err.message).toContain('incompatible')
  })

  it('detects minor version difference without major mismatch', () => {
    const err = new ProtocolVersionError('1.0.0', '1.2.0')
    expect(err.isMajorMismatch).toBe(false)
    expect(err.message).toContain('Minor version')
  })

  it('areCompatible returns true for same major version', () => {
    expect(ProtocolVersionError.areCompatible('1.0.0', '1.5.2')).toBe(true)
    expect(ProtocolVersionError.areCompatible('2.1.0', '2.9.9')).toBe(true)
  })

  it('areCompatible returns false for different major versions', () => {
    expect(ProtocolVersionError.areCompatible('1.0.0', '2.0.0')).toBe(false)
    expect(ProtocolVersionError.areCompatible('3.0.0', '1.0.0')).toBe(false)
  })

  it('handles non-semver version strings gracefully', () => {
    const err = new ProtocolVersionError('abc', 'xyz')
    // Both parse to major version 0
    expect(err.isMajorMismatch).toBe(false)
  })
})

// =============================================================================
// 4. HTTP Transport Creation & Options (~6 tests)
// =============================================================================

describe('HTTP Transport Creation', () => {
  it('http() returns a transport with call and close methods', () => {
    const transport = http('https://example.com/rpc')
    expect(transport).toBeDefined()
    expect(typeof transport.call).toBe('function')
    expect(typeof transport.close).toBe('function')
  })

  it('http() accepts string auth as second argument', () => {
    const transport = http('https://example.com/rpc', 'my-token')
    expect(transport).toBeDefined()
    expect(typeof transport.call).toBe('function')
  })

  it('http() accepts options object with auth string', () => {
    const transport = http('https://example.com/rpc', { auth: 'my-token', timeout: 5000 })
    expect(transport).toBeDefined()
    expect(typeof transport.call).toBe('function')
  })

  it('http() accepts options object with auth function', () => {
    const authFn = () => 'dynamic-token'
    const transport = http('https://example.com/rpc', { auth: authFn })
    expect(transport).toBeDefined()
    expect(typeof transport.call).toBe('function')
  })

  it('http() close can be called without error even if never used', () => {
    const transport = http('https://example.com/rpc')
    expect(() => transport.close!()).not.toThrow()
  })

  it('http() close can be called multiple times', () => {
    const transport = http('https://example.com/rpc')
    expect(() => {
      transport.close!()
      transport.close!()
    }).not.toThrow()
  })
})

// =============================================================================
// 5. Binding Transport Edge Cases (~7 tests)
// =============================================================================

describe('Binding Transport Edge Cases', () => {
  it('binding supports async methods on the bound object', async () => {
    const mockService = {
      asyncOp: vi.fn(async (x: number) => x * 2),
    }
    const transport = binding(mockService)
    const result = await transport.call('asyncOp', [21])
    expect(result).toBe(42)
  })

  it('binding supports deeply nested namespaces (3 levels)', async () => {
    const mockService = {
      api: { v2: { users: { list: vi.fn(() => ['alice', 'bob']) } } },
    }
    const transport = binding(mockService)
    const result = await transport.call('api.v2.users.list', [])
    expect(result).toEqual(['alice', 'bob'])
  })

  it('binding passes multiple arguments correctly', async () => {
    const mockService = {
      add: vi.fn((a: number, b: number) => a + b),
    }
    const transport = binding(mockService)
    const result = await transport.call('add', [3, 4])
    expect(result).toBe(7)
    expect(mockService.add).toHaveBeenCalledWith(3, 4)
  })

  it('binding passes zero arguments correctly', async () => {
    const mockService = {
      now: vi.fn(() => 1234567890),
    }
    const transport = binding(mockService)
    const result = await transport.call('now', [])
    expect(result).toBe(1234567890)
    expect(mockService.now).toHaveBeenCalledWith()
  })

  it('binding propagates errors from bound methods', async () => {
    const mockService = {
      fail: () => {
        throw new Error('intentional failure')
      },
    }
    const transport = binding(mockService)
    await expect(transport.call('fail', [])).rejects.toThrow('intentional failure')
  })

  it('binding propagates async rejections from bound methods', async () => {
    const mockService = {
      failAsync: async () => {
        throw new Error('async failure')
      },
    }
    const transport = binding(mockService)
    await expect(transport.call('failAsync', [])).rejects.toThrow('async failure')
  })

  it('binding does not have a close method', () => {
    const transport = binding({ x: () => 1 })
    expect(transport.close).toBeUndefined()
  })
})

// =============================================================================
// 6. Composite Transport Advanced (~7 tests)
// =============================================================================

describe('Composite Transport Advanced', () => {
  it('composite with 3 transports falls through to third on failure', async () => {
    const t1: Transport = { call: vi.fn(async () => { throw new Error('t1 fail') }) }
    const t2: Transport = { call: vi.fn(async () => { throw new Error('t2 fail') }) }
    const t3: Transport = { call: vi.fn(async () => 'third') }
    const ct = composite(t1, t2, t3)
    const result = await ct.call('method', [])
    expect(result).toBe('third')
    expect(t1.call).toHaveBeenCalledTimes(1)
    expect(t2.call).toHaveBeenCalledTimes(1)
    expect(t3.call).toHaveBeenCalledTimes(1)
  })

  it('composite passes method name and args to each transport', async () => {
    const t1: Transport = { call: vi.fn(async () => { throw new Error('fail') }) }
    const t2: Transport = { call: vi.fn(async () => 'ok') }
    const ct = composite(t1, t2)
    await ct.call('users.list', [{ active: true }])
    expect(t1.call).toHaveBeenCalledWith('users.list', [{ active: true }])
    expect(t2.call).toHaveBeenCalledWith('users.list', [{ active: true }])
  })

  it('composite with single transport behaves like that transport', async () => {
    const t: Transport = { call: vi.fn(async () => 'single') }
    const ct = composite(t)
    const result = await ct.call('method', [])
    expect(result).toBe('single')
  })

  it('composite returns first non-null result (does not skip null)', async () => {
    const t1: Transport = { call: vi.fn(async () => null) }
    const t2: Transport = { call: vi.fn(async () => 'second') }
    const ct = composite(t1, t2)
    const result = await ct.call('method', [])
    // First transport succeeds with null — composite should return null, not try t2
    expect(result).toBeNull()
    expect(t2.call).not.toHaveBeenCalled()
  })

  it('composite returns undefined from first transport (does not skip)', async () => {
    const t1: Transport = { call: vi.fn(async () => undefined) }
    const t2: Transport = { call: vi.fn(async () => 'second') }
    const ct = composite(t1, t2)
    const result = await ct.call('method', [])
    expect(result).toBeUndefined()
    expect(t2.call).not.toHaveBeenCalled()
  })

  it('composite close tolerates mix of transports with and without close', () => {
    const closeFn = vi.fn()
    const t1: Transport = { call: vi.fn(async () => null), close: closeFn }
    const t2: Transport = { call: vi.fn(async () => null) }
    const t3: Transport = { call: vi.fn(async () => null), close: closeFn }
    const ct = composite(t1, t2, t3)
    expect(() => ct.close!()).not.toThrow()
    expect(closeFn).toHaveBeenCalledTimes(2)
  })

  it('composite preserves error type from last transport', async () => {
    const t1: Transport = { call: vi.fn(async () => { throw new TypeError('type error') }) }
    const t2: Transport = { call: vi.fn(async () => { throw new RangeError('range error') }) }
    const ct = composite(t1, t2)
    try {
      await ct.call('method', [])
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(RangeError)
      expect((e as Error).message).toBe('range error')
    }
  })
})

// =============================================================================
// 7. createDOClient with TransportFactory (~5 tests)
// =============================================================================

describe('createDOClient with TransportFactory', () => {
  it('accepts a sync factory function', async () => {
    const callFn = vi.fn(async () => 'result')
    const factory = () => ({ call: callFn })
    const client = createDOClient(factory)
    const result = await (client as any).doSomething()
    expect(callFn).toHaveBeenCalledWith('doSomething', [])
    expect(result).toBe('result')
  })

  it('accepts an async factory function', async () => {
    const callFn = vi.fn(async () => 'async-result')
    const factory = async () => ({ call: callFn })
    const client = createDOClient(factory)
    const result = await (client as any).doSomething()
    expect(result).toBe('async-result')
  })

  it('factory is called only once across multiple method calls', async () => {
    const callFn = vi.fn(async () => 'result')
    const factoryFn = vi.fn(() => ({ call: callFn }))
    const client = createDOClient(factoryFn)
    await (client as any).method1()
    await (client as any).method2()
    await (client as any).method3()
    expect(factoryFn).toHaveBeenCalledTimes(1)
    expect(callFn).toHaveBeenCalledTimes(3)
  })

  it('sql access throws when transport factory not yet resolved', () => {
    const factory = async () => ({ call: vi.fn(async () => null) })
    const client = createDOClient(factory)
    // sql uses getTransportSync which throws if factory-based transport isn't initialized
    expect(() => client.sql`SELECT 1`.all()).toThrow()
  })

  it('storage access throws when transport factory not yet resolved', () => {
    const factory = async () => ({ call: vi.fn(async () => null) })
    const client = createDOClient(factory)
    // storage uses getTransportSync
    expect(() => client.storage.get('key')).toThrow()
  })
})

// =============================================================================
// 8. Collection Proxy — Additional Methods (~6 tests)
// =============================================================================

describe('createDOClient Collection — Additional Methods', () => {
  it('client.collection(name).delete calls __collectionDelete', async () => {
    const callFn = vi.fn(async () => true)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.collection('users').delete('doc_1')
    expect(callFn).toHaveBeenCalledWith('__collectionDelete', ['users', 'doc_1'])
    expect(result).toBe(true)
  })

  it('client.collection(name).has calls __collectionHas', async () => {
    const callFn = vi.fn(async () => true)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.collection('users').has('doc_1')
    expect(callFn).toHaveBeenCalledWith('__collectionHas', ['users', 'doc_1'])
    expect(result).toBe(true)
  })

  it('client.collection(name).list calls __collectionList', async () => {
    const callFn = vi.fn(async () => [{ id: '1' }, { id: '2' }])
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.collection('users').list({ limit: 10 })
    expect(callFn).toHaveBeenCalledWith('__collectionList', ['users', { limit: 10 }])
    expect(result).toHaveLength(2)
  })

  it('client.collection(name).keys calls __collectionKeys', async () => {
    const callFn = vi.fn(async () => ['doc_1', 'doc_2', 'doc_3'])
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.collection('users').keys()
    expect(callFn).toHaveBeenCalledWith('__collectionKeys', ['users'])
    expect(result).toEqual(['doc_1', 'doc_2', 'doc_3'])
  })

  it('client.collection(name).clear calls __collectionClear', async () => {
    const callFn = vi.fn(async () => 15)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.collection('users').clear()
    expect(callFn).toHaveBeenCalledWith('__collectionClear', ['users'])
    expect(result).toBe(15)
  })

  it('client.collection.names() calls __collectionNames', async () => {
    const callFn = vi.fn(async () => ['users', 'posts', 'comments'])
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.collection.names()
    expect(callFn).toHaveBeenCalledWith('__collectionNames', [])
    expect(result).toEqual(['users', 'posts', 'comments'])
  })
})

// =============================================================================
// 9. Collections Manager (~3 tests)
// =============================================================================

describe('createDOClient Collections Manager', () => {
  it('client.collection.stats() calls __collectionStats', async () => {
    const stats = [{ name: 'users', count: 100, size: 4096 }]
    const callFn = vi.fn(async () => stats)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.collection.stats()
    expect(callFn).toHaveBeenCalledWith('__collectionStats', [])
    expect(result).toEqual(stats)
  })

  it('client.collection is callable as a function', () => {
    const callFn = vi.fn(async () => null)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const collection = client.collection('myCollection')
    expect(collection).toBeDefined()
    expect(typeof collection.get).toBe('function')
    expect(typeof collection.put).toBe('function')
    expect(typeof collection.find).toBe('function')
  })

  it('different collection names route to different __collection* calls', async () => {
    const callFn = vi.fn(async () => null)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await client.collection('users').get('u1')
    await client.collection('posts').get('p1')
    expect(callFn).toHaveBeenCalledWith('__collectionGet', ['users', 'u1'])
    expect(callFn).toHaveBeenCalledWith('__collectionGet', ['posts', 'p1'])
  })
})

// =============================================================================
// 10. Storage Proxy — Additional Methods (~4 tests)
// =============================================================================

describe('createDOClient Storage — Additional Methods', () => {
  it('client.storage.delete with array calls __storageDeleteMultiple', async () => {
    const callFn = vi.fn(async () => 3)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.storage.delete(['a', 'b', 'c'])
    expect(callFn).toHaveBeenCalledWith('__storageDeleteMultiple', [['a', 'b', 'c']])
    expect(result).toBe(3)
  })

  it('client.storage.list without options passes undefined', async () => {
    const callFn = vi.fn(async () => ({}))
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await client.storage.list()
    expect(callFn).toHaveBeenCalledWith('__storageList', [undefined])
  })

  it('client.storage.list with limit and start options', async () => {
    const callFn = vi.fn(async () => ({ k1: 'v1' }))
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.storage.list({ limit: 5, start: 'prefix_' })
    expect(callFn).toHaveBeenCalledWith('__storageList', [{ limit: 5, start: 'prefix_' }])
    expect(result).toBeInstanceOf(Map)
  })

  it('client.storage.keys without prefix passes undefined', async () => {
    const callFn = vi.fn(async () => [])
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await client.storage.keys()
    expect(callFn).toHaveBeenCalledWith('__storageKeys', [undefined])
  })
})

// =============================================================================
// 11. SQL Proxy — raw() and interpolation (~4 tests)
// =============================================================================

describe('createDOClient SQL — raw and interpolation', () => {
  it('client.sql`...`.raw() calls __sql and returns full result', async () => {
    const fullResult = { results: [{ id: 1 }], meta: { rows_read: 1, rows_written: 0 } }
    const callFn = vi.fn(async () => fullResult)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await client.sql`SELECT * FROM users`.raw()
    expect(callFn).toHaveBeenCalledTimes(1)
    expect(callFn.mock.calls[0]![0]).toBe('__sql')
    expect(result).toEqual(fullResult)
  })

  it('sql serializes template strings array', async () => {
    const callFn = vi.fn(async () => ({ results: [], meta: { rows_read: 0, rows_written: 0 } }))
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const name = 'Alice'
    await client.sql`SELECT * FROM users WHERE name = ${name}`.all()
    const serialized = callFn.mock.calls[0]![1]![0] as any
    expect(serialized.strings).toEqual(['SELECT * FROM users WHERE name = ', ''])
    expect(serialized.values).toEqual(['Alice'])
  })

  it('sql with multiple interpolations serializes all values', async () => {
    const callFn = vi.fn(async () => ({ results: [], meta: { rows_read: 0, rows_written: 0 } }))
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await client.sql`INSERT INTO users (name, age) VALUES (${`Bob`}, ${30})`.run()
    const serialized = callFn.mock.calls[0]![1]![0] as any
    expect(serialized.values).toEqual(['Bob', 30])
    expect(serialized.strings).toHaveLength(3)
  })

  it('sql with no interpolation sends empty values', async () => {
    const callFn = vi.fn(async () => null)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await client.sql`SELECT 1`.first()
    const serialized = callFn.mock.calls[0]![1]![0] as any
    expect(serialized.values).toEqual([])
    expect(serialized.strings).toEqual(['SELECT 1'])
  })
})

// =============================================================================
// 12. RPC() with Transport/TransportFactory (~5 tests)
// =============================================================================

describe('RPC() with Transport and TransportFactory', () => {
  it('RPC() with a direct Transport object returns a DOClient via createDOClient', () => {
    const mockTransport: Transport = { call: vi.fn(async () => null) }
    // createDOClient accepts a Transport directly (same as RPC with transport arg)
    const client = createDOClient(mockTransport)
    expect(client).toBeDefined()
    expect(typeof client).toBe('object')
    expect((client as any).then).toBeUndefined()
  })

  it('RPC() with a Transport delegates calls through it via createDOClient', async () => {
    const callFn = vi.fn(async () => ({ id: 'user_1', name: 'Test' }))
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await (client as any).users.get('user_1')
    expect(callFn).toHaveBeenCalledWith('users.get', ['user_1'])
  })

  it('RPC() with a TransportFactory resolves lazily via createDOClient', async () => {
    const callFn = vi.fn(async () => 'result')
    const factoryFn = vi.fn(() => ({ call: callFn }))
    const client = createDOClient(factoryFn)
    expect(factoryFn).not.toHaveBeenCalled()
    await (client as any).test()
    expect(factoryFn).toHaveBeenCalledTimes(1)
  })

  it('headlessly() with http transport creates HTTPS URL', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', transport: 'http' })
    expect(url).toMatch(/^https:\/\//)
    expect(url).toContain('/~acme')
  })

  it('createRPCClient delegates to RPC with baseUrl', () => {
    const client = createRPCClient({ baseUrl: 'https://example.com', auth: 'tok', timeout: 1000 })
    expect(client).toBeDefined()
    expect(typeof client).toBe('object')
  })
})

// =============================================================================
// 13. isServerMessage Advanced (~4 tests)
// =============================================================================

describe('isServerMessage — Edge Cases', () => {
  let isServerMessage: (v: unknown) => boolean

  beforeEach(async () => {
    const mod = await import('rpc.do')
    isServerMessage = mod.isServerMessage
  })

  it('returns true for error messages with code', () => {
    expect(isServerMessage({ error: { message: 'not found', code: 404 } })).toBe(true)
  })

  it('returns true for error messages with data', () => {
    expect(isServerMessage({ id: 5, error: { message: 'invalid', data: { field: 'name' } } })).toBe(true)
  })

  it('returns false for array', () => {
    expect(isServerMessage([{ result: 'ok' }])).toBe(false)
  })

  it('returns false for objects with error as non-object', () => {
    // error must be an object with message, not a string
    expect(isServerMessage({ error: 'string error' })).toBe(false)
  })
})

// =============================================================================
// 14. isFunction Advanced (~3 tests)
// =============================================================================

describe('isFunction — Edge Cases', () => {
  let isFunction: (v: unknown) => boolean

  beforeEach(async () => {
    const mod = await import('rpc.do')
    isFunction = mod.isFunction
  })

  it('returns true for generator functions', () => {
    expect(isFunction(function* () {})).toBe(true)
  })

  it('returns true for async generator functions', () => {
    expect(isFunction(async function* () {})).toBe(true)
  })

  it('returns true for class constructors', () => {
    expect(isFunction(class Foo {})).toBe(true)
  })
})

// =============================================================================
// 15. DOClient Method Proxy — Argument Passing (~5 tests)
// =============================================================================

describe('DOClient Method Proxy — Arguments', () => {
  it('passes complex nested objects as arguments', async () => {
    const callFn = vi.fn(async () => [])
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const filter = { stage: 'Lead', metadata: { tags: ['vip', 'new'] } }
    await (client as any).contacts.find(filter)
    expect(callFn).toHaveBeenCalledWith('contacts.find', [filter])
  })

  it('passes null and undefined arguments through', async () => {
    const callFn = vi.fn(async () => null)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await (client as any).method(null, undefined, 0, '')
    expect(callFn).toHaveBeenCalledWith('method', [null, undefined, 0, ''])
  })

  it('method proxy returns the transport call result', async () => {
    const data = { id: 'deal_abc', value: 50000, stage: 'Open' }
    const callFn = vi.fn(async () => data)
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const result = await (client as any).deals.get('deal_abc')
    expect(result).toEqual(data)
  })

  it('method proxy propagates transport errors', async () => {
    const callFn = vi.fn(async () => { throw new Error('transport error') })
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    await expect((client as any).fails()).rejects.toThrow('transport error')
  })

  it('concurrent method calls each reach the transport independently', async () => {
    let callCount = 0
    const callFn = vi.fn(async (method: string) => {
      callCount++
      return { method, seq: callCount }
    })
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const [r1, r2, r3] = await Promise.all([
      (client as any).a(),
      (client as any).b(),
      (client as any).c(),
    ])
    expect(callFn).toHaveBeenCalledTimes(3)
    expect(r1.method).toBe('a')
    expect(r2.method).toBe('b')
    expect(r3.method).toBe('c')
  })
})

// =============================================================================
// 16. DOClient close behavior (~3 tests)
// =============================================================================

describe('DOClient close behavior', () => {
  it('close() is safe when transport has no close method', async () => {
    const mockTransport: Transport = { call: vi.fn(async () => null) }
    const client = createDOClient(mockTransport)
    // close should not throw even if transport.close is undefined
    await expect(client.close()).resolves.toBeUndefined()
  })

  it('close() invokes transport close exactly once', async () => {
    const closeFn = vi.fn()
    const mockTransport: Transport = { call: vi.fn(async () => null), close: closeFn }
    const client = createDOClient(mockTransport)
    await client.close()
    expect(closeFn).toHaveBeenCalledTimes(1)
  })

  it('dbSchema and schema call the correct internal methods', async () => {
    const callFn = vi.fn(async (method: string) => {
      if (method === '__dbSchema') return { tables: [], version: 2 }
      if (method === '__schema') return { version: 1, methods: [], namespaces: [] }
      return null
    })
    const mockTransport: Transport = { call: callFn }
    const client = createDOClient(mockTransport)
    const db = await client.dbSchema()
    const rpc = await client.schema()
    expect(db).toEqual({ tables: [], version: 2 })
    expect(rpc).toEqual({ version: 1, methods: [], namespaces: [] })
  })
})

// =============================================================================
// 17. Capnweb Transport Factory (~3 tests)
// =============================================================================

describe('Capnweb Transport Factory', () => {
  it('capnweb() returns a transport with call and close', () => {
    const transport = capnweb('https://example.com/rpc', { websocket: false })
    expect(transport).toBeDefined()
    expect(typeof transport.call).toBe('function')
    expect(typeof transport.close).toBe('function')
  })

  it('capnweb() close can be called without error when not initialized', () => {
    const transport = capnweb('https://example.com/rpc', { websocket: false })
    expect(() => transport.close!()).not.toThrow()
  })

  it('capnweb() with reconnect returns transport with close', () => {
    const transport = capnweb('wss://example.com/rpc', {
      reconnect: true,
      reconnectOptions: { maxReconnectAttempts: 3 },
    })
    expect(transport).toBeDefined()
    expect(typeof transport.call).toBe('function')
    expect(typeof transport.close).toBe('function')
  })
})

// =============================================================================
// 18. ReconnectingWebSocketTransport (~3 tests)
// =============================================================================

describe('ReconnectingWebSocketTransport', () => {
  let ReconnectingWebSocketTransport: typeof import('rpc.do').ReconnectingWebSocketTransport
  let reconnectingWs: typeof import('rpc.do').reconnectingWs

  beforeEach(async () => {
    const mod = await import('rpc.do')
    ReconnectingWebSocketTransport = mod.ReconnectingWebSocketTransport
    reconnectingWs = mod.reconnectingWs
  })

  it('can be instantiated with just a URL', () => {
    const transport = new ReconnectingWebSocketTransport('wss://example.com/rpc')
    expect(transport).toBeDefined()
    expect(transport.getState()).toBe('disconnected')
    expect(transport.isConnected()).toBe(false)
    transport.close()
  })

  it('reconnectingWs factory creates a transport instance', () => {
    const transport = reconnectingWs('wss://example.com/rpc', {
      autoReconnect: false,
      maxReconnectAttempts: 5,
    })
    expect(transport).toBeInstanceOf(ReconnectingWebSocketTransport)
    expect(transport.getState()).toBe('disconnected')
    transport.close()
  })

  it('close transitions state to closed', () => {
    const transport = new ReconnectingWebSocketTransport('wss://example.com/rpc')
    expect(transport.getState()).toBe('disconnected')
    transport.close()
    expect(transport.getState()).toBe('closed')
  })
})

// =============================================================================
// 19. headlessly() tenant URL encoding (~3 tests)
// =============================================================================

describe('headlessly() — tenant URL encoding edge cases', () => {
  it('tenant with unicode characters is passed through verbatim', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'caf\u00e9' })
    expect(url).toContain('/~caf\u00e9')
  })

  it('tenant with spaces is passed through verbatim', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'my org' })
    expect(url).toContain('/~my org')
  })

  it('very long tenant name works', () => {
    const longTenant = 'a'.repeat(200)
    const { url } = buildHeadlesslyConfig({ tenant: longTenant })
    expect(url).toContain(`/~${longTenant}`)
  })
})
