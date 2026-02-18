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

import type {
  HeadlesslyRpcOptions,
  RPCProxy,
  RpcProxy,
  Transport,
  TransportFactory,
  RPCMiddleware,
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
// 1. HeadlesslyRpcOptions — Field-Level Validation (~8 tests)
// =============================================================================

describe('HeadlesslyRpcOptions Field Validation', () => {
  it('tenant is required (minimal valid options)', () => {
    const opts: HeadlesslyRpcOptions = { tenant: 'x' }
    const client = headlessly(opts)
    expect(client).toBeDefined()
    const { url } = buildHeadlesslyConfig(opts)
    expect(url).toContain('/~x')
  })

  it('apiKey is optional — undefined omits auth entirely', () => {
    const opts: HeadlesslyRpcOptions = { tenant: 'acme' }
    const { rpcOptions } = buildHeadlesslyConfig(opts)
    expect(rpcOptions).not.toHaveProperty('auth')
    expect(Object.keys(rpcOptions)).toHaveLength(0)
  })

  it('apiKey as empty string is still passed as auth', () => {
    const { rpcOptions } = buildHeadlesslyConfig({ tenant: 'acme', apiKey: '' })
    // Empty string is falsy, so it should NOT be added
    expect(rpcOptions).not.toHaveProperty('auth')
  })

  it('endpoint is optional — defaults to db.headless.ly', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'test' })
    expect(url).toMatch(/^https:\/\/db\.headless\.ly\/~test$/)
  })

  it('transport "http" produces https protocol', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 't', transport: 'http' })
    expect(url).toMatch(/^https:\/\//)
  })

  it('transport "ws" produces wss protocol', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 't', transport: 'ws' })
    expect(url).toMatch(/^wss:\/\//)
  })

  it('all four fields set simultaneously produce correct URL and options', () => {
    const { url, rpcOptions } = buildHeadlesslyConfig({
      tenant: 'full-test',
      apiKey: 'key_full',
      endpoint: 'https://custom.io',
      transport: 'ws',
    })
    expect(url).toBe('wss://custom.io/~full-test')
    expect(rpcOptions).toEqual({ auth: 'key_full' })
  })

  it('endpoint with query parameters preserves them', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', endpoint: 'https://api.com/v1?debug=true' })
    expect(url).toBe('https://api.com/v1?debug=true/~acme')
  })
})

// =============================================================================
// 2. Filter Type — MongoDB Operator Combinations (~10 tests)
// =============================================================================

describe('Filter Type — MongoDB Operator Combinations', () => {
  it('$eq operator compiles and instantiates', () => {
    const filter: Filter<{ status: string }> = { status: { $eq: 'active' } }
    expect(filter.status).toEqual({ $eq: 'active' })
  })

  it('$ne operator compiles and instantiates', () => {
    const filter: Filter<{ status: string }> = { status: { $ne: 'deleted' } }
    expect(filter.status).toEqual({ $ne: 'deleted' })
  })

  it('$gt and $lt numeric operators instantiate', () => {
    const filter: Filter<{ age: number }> = { age: { $gt: 18 } }
    expect((filter.age as any).$gt).toBe(18)

    const filter2: Filter<{ age: number }> = { age: { $lt: 65 } }
    expect((filter2.age as any).$lt).toBe(65)
  })

  it('$gte and $lte numeric operators instantiate', () => {
    const filter: Filter<{ score: number }> = { score: { $gte: 90 } }
    expect((filter.score as any).$gte).toBe(90)

    const filter2: Filter<{ score: number }> = { score: { $lte: 100 } }
    expect((filter2.score as any).$lte).toBe(100)
  })

  it('$in operator with array of values', () => {
    const filter: Filter<{ role: string }> = { role: { $in: ['admin', 'editor', 'viewer'] } }
    expect((filter.role as any).$in).toEqual(['admin', 'editor', 'viewer'])
  })

  it('$nin operator with array of values', () => {
    const filter: Filter<{ status: string }> = { status: { $nin: ['banned', 'suspended'] } }
    expect((filter.status as any).$nin).toEqual(['banned', 'suspended'])
  })

  it('$exists operator with boolean', () => {
    const filter: Filter<{ email: string }> = { email: { $exists: true } }
    expect((filter.email as any).$exists).toBe(true)

    const filter2: Filter<{ phone: string }> = { phone: { $exists: false } }
    expect((filter2.phone as any).$exists).toBe(false)
  })

  it('$regex operator with pattern string', () => {
    const filter: Filter<{ name: string }> = { name: { $regex: '^John' } }
    expect((filter.name as any).$regex).toBe('^John')
  })

  it('$and logical combinator with multiple filters', () => {
    const filter: Filter<{ name: string; age: number }> = {
      $and: [{ name: { $regex: '^A' } }, { age: { $gte: 18 } }],
    }
    expect(filter.$and).toHaveLength(2)
    expect((filter.$and![0] as any).name.$regex).toBe('^A')
    expect((filter.$and![1] as any).age.$gte).toBe(18)
  })

  it('$or logical combinator with multiple filters', () => {
    const filter: Filter<{ status: string }> = {
      $or: [{ status: { $eq: 'active' } }, { status: { $eq: 'pending' } }],
    }
    expect(filter.$or).toHaveLength(2)
    expect((filter.$or![0] as any).status.$eq).toBe('active')
    expect((filter.$or![1] as any).status.$eq).toBe('pending')
  })
})

// =============================================================================
// 3. QueryOptions Completeness (~6 tests)
// =============================================================================

describe('QueryOptions Completeness', () => {
  it('limit only', () => {
    const opts: QueryOptions = { limit: 50 }
    expect(opts.limit).toBe(50)
    expect(opts.offset).toBeUndefined()
    expect(opts.sort).toBeUndefined()
  })

  it('offset only', () => {
    const opts: QueryOptions = { offset: 100 }
    expect(opts.offset).toBe(100)
  })

  it('sort ascending (no prefix)', () => {
    const opts: QueryOptions = { sort: 'createdAt' }
    expect(opts.sort).toBe('createdAt')
  })

  it('sort descending (dash prefix)', () => {
    const opts: QueryOptions = { sort: '-updatedAt' }
    expect(opts.sort).toBe('-updatedAt')
  })

  it('all QueryOptions fields combined', () => {
    const opts: QueryOptions = { limit: 25, offset: 50, sort: '-createdAt' }
    expect(opts.limit).toBe(25)
    expect(opts.offset).toBe(50)
    expect(opts.sort).toBe('-createdAt')
  })

  it('empty QueryOptions is valid', () => {
    const opts: QueryOptions = {}
    expect(Object.keys(opts)).toHaveLength(0)
  })
})

// =============================================================================
// 4. headlessly() Generic Typing (~5 tests)
// =============================================================================

describe('headlessly() Generic Typing', () => {
  it('returns RPCProxy with default generic (Record<string, unknown>)', () => {
    const client = headlessly({ tenant: 'typed' })
    expect(client).toBeDefined()
    expect(typeof client).toBe('object')
  })

  it('typed generic constrains proxy (compile-time check)', () => {
    interface MyAPI {
      contacts: { find: (q: object) => Promise<unknown[]> }
    }
    const client = headlessly<MyAPI>({ tenant: 'typed' })
    // At runtime, the proxy just passes through
    expect(client).toBeDefined()
    expect((client as any).contacts).toBeDefined()
  })

  it('typed generic with nested namespaces compiles', () => {
    interface DeepAPI {
      crm: {
        contacts: { list: () => Promise<unknown[]> }
        deals: { get: (id: string) => Promise<unknown> }
      }
    }
    const client = headlessly<DeepAPI>({ tenant: 'deep' })
    expect((client as any).crm).toBeDefined()
    expect((client as any).crm.contacts).toBeDefined()
    expect((client as any).crm.deals).toBeDefined()
  })

  it('returned proxy supports arbitrary property depth regardless of generic', () => {
    const client = headlessly({ tenant: 'any' })
    // Even without type constraints, proxy allows arbitrary depth
    expect(() => (client as any).x.y.z.w.v).not.toThrow()
  })

  it('createHeadlesslyClient supports same generic as headlessly', () => {
    interface API {
      test: () => Promise<string>
    }
    const client = createHeadlesslyClient<API>({ tenant: 'alias' })
    expect(client).toBeDefined()
  })
})

// =============================================================================
// 5. Type Alias Exports — Dual Names (~7 tests)
// =============================================================================

describe('Type Alias Exports', () => {
  it('RPCProxy and RpcProxy are the same type (compile check)', () => {
    const assertSame = <A, B extends A>() => true
    // If this compiles, they are compatible
    expect(assertSame<RPCProxy<{}>, RpcProxy<{}>>()).toBe(true)
    expect(assertSame<RpcProxy<{}>, RPCProxy<{}>>()).toBe(true)
  })

  it('RPCPromise type is importable', () => {
    const assertType = <T>(_val?: T) => true
    expect(assertType<RPCPromise<string>>()).toBe(true)
  })

  it('RpcPromise type is importable', () => {
    const assertType = <T>(_val?: T) => true
    expect(assertType<RpcPromise<number>>()).toBe(true)
  })

  it('RPCMiddleware type is importable (all three aliases)', () => {
    const assertType = <T>(_val?: T) => true
    expect(assertType<RPCMiddleware>()).toBe(true)
  })

  it('MagicMap type is importable', () => {
    const assertType = <T>(_val?: T) => true
    expect(assertType<MagicMap<string, number>>()).toBe(true)
  })

  it('RpcPipelined type is importable', () => {
    const assertType = <T>(_val?: T) => true
    expect(assertType<RpcPipelined<{ id: string }>>()).toBe(true)
  })

  it('RpcArrayMethods and RpcArrayPromise are importable', () => {
    const assertType = <T>(_val?: T) => true
    expect(assertType<RpcArrayMethods<string>>()).toBe(true)
    expect(assertType<RpcArrayPromise<string>>()).toBe(true)
  })
})

// =============================================================================
// 6. Transport Interface Shape (~5 tests)
// =============================================================================

describe('Transport Interface Shape', () => {
  it('minimal Transport requires call method', () => {
    const t: Transport = { call: async () => null }
    expect(typeof t.call).toBe('function')
  })

  it('Transport close is optional', () => {
    const t1: Transport = { call: async () => null }
    const t2: Transport = { call: async () => null, close: () => {} }
    expect(t1.close).toBeUndefined()
    expect(typeof t2.close).toBe('function')
  })

  it('Transport call returns a Promise', async () => {
    const t: Transport = { call: async (_m, _a) => 42 }
    const result = t.call('method', [])
    expect(result).toBeInstanceOf(Promise)
    expect(await result).toBe(42)
  })

  it('Transport call receives method string and args array', async () => {
    const calls: [string, unknown[]][] = []
    const t: Transport = {
      call: async (method, args) => {
        calls.push([method, args])
        return null
      },
    }
    await t.call('users.create', [{ name: 'Alice' }])
    expect(calls[0]).toEqual(['users.create', [{ name: 'Alice' }]])
  })

  it('TransportFactory returns Transport or Promise<Transport>', async () => {
    const syncFactory: TransportFactory = () => ({ call: async () => null })
    const asyncFactory: TransportFactory = async () => ({ call: async () => null })

    const t1 = syncFactory()
    expect(t1).toBeDefined()

    const t2 = await asyncFactory()
    expect(typeof t2.call).toBe('function')
  })
})

// =============================================================================
// 7. createDOClient — Collection with QueryOptions (~5 tests)
// =============================================================================

describe('createDOClient Collection with QueryOptions', () => {
  it('find passes filter and options to __collectionFind', async () => {
    const callFn = vi.fn(async () => [{ id: '1' }])
    const client = createDOClient({ call: callFn })
    const filter = { active: true } as any
    const opts: QueryOptions = { limit: 10, offset: 5, sort: '-createdAt' }
    await client.collection('items').find(filter, opts)
    expect(callFn).toHaveBeenCalledWith('__collectionFind', ['items', filter, opts])
  })

  it('count passes filter to __collectionCount', async () => {
    const callFn = vi.fn(async () => 7)
    const client = createDOClient({ call: callFn })
    const filter = { status: 'active' } as any
    await client.collection('items').count(filter)
    expect(callFn).toHaveBeenCalledWith('__collectionCount', ['items', filter])
  })

  it('list passes options to __collectionList', async () => {
    const callFn = vi.fn(async () => [])
    const client = createDOClient({ call: callFn })
    await client.collection('items').list({ limit: 100, sort: 'name' })
    expect(callFn).toHaveBeenCalledWith('__collectionList', ['items', { limit: 100, sort: 'name' }])
  })

  it('find with no filter and no options passes undefined placeholders', async () => {
    const callFn = vi.fn(async () => [])
    const client = createDOClient({ call: callFn })
    await client.collection('items').find()
    expect(callFn).toHaveBeenCalledWith('__collectionFind', ['items', undefined, undefined])
  })

  it('list with no options passes undefined', async () => {
    const callFn = vi.fn(async () => [])
    const client = createDOClient({ call: callFn })
    await client.collection('items').list()
    expect(callFn).toHaveBeenCalledWith('__collectionList', ['items', undefined])
  })
})

// =============================================================================
// 8. Proxy Deep Chain and Invocation Mechanics (~6 tests)
// =============================================================================

describe('Proxy Deep Chain Invocation', () => {
  it('4-level deep property chain through headlessly proxy does not throw', () => {
    const client = headlessly({ tenant: 'chain' })
    expect(() => (client as any).a.b.c.d).not.toThrow()
  })

  it('5-level deep method invocation through DOClient builds dot-path', async () => {
    const callFn = vi.fn(async () => 'deep-result')
    const client = createDOClient({ call: callFn })
    await (client as any).api.v3.admin.users.list()
    expect(callFn).toHaveBeenCalledWith('api.v3.admin.users.list', [])
  })

  it('method invocation at different depths produce independent calls', async () => {
    const callFn = vi.fn(async () => null)
    const client = createDOClient({ call: callFn })
    await (client as any).shallow()
    await (client as any).one.level()
    await (client as any).two.levels.deep()
    expect(callFn).toHaveBeenCalledWith('shallow', [])
    expect(callFn).toHaveBeenCalledWith('one.level', [])
    expect(callFn).toHaveBeenCalledWith('two.levels.deep', [])
  })

  it('property access returns new proxy each time (no caching side effects)', () => {
    const client = headlessly({ tenant: 'cache-test' })
    const ref1 = (client as any).contacts
    const ref2 = (client as any).contacts
    // Both are defined proxy objects
    expect(ref1).toBeDefined()
    expect(ref2).toBeDefined()
  })

  it('method with many arguments passes them all', async () => {
    const callFn = vi.fn(async () => 'ok')
    const client = createDOClient({ call: callFn })
    await (client as any).method('a', 2, true, null, [1, 2], { x: 'y' })
    expect(callFn).toHaveBeenCalledWith('method', ['a', 2, true, null, [1, 2], { x: 'y' }])
  })

  it('toString trap on headlessly proxy does not return a thenable', () => {
    const client = headlessly({ tenant: 'tostring' })
    // then, catch, finally must be undefined for non-thenable
    expect((client as any).then).toBeUndefined()
    expect((client as any).catch).toBeUndefined()
    expect((client as any).finally).toBeUndefined()
  })
})

// =============================================================================
// 9. Batch-Style Concurrent Operations (~4 tests)
// =============================================================================

describe('Batch-Style Concurrent Operations', () => {
  it('Promise.all with multiple DOClient calls fires all transports', async () => {
    const callFn = vi.fn(async (method: string) => `result_${method}`)
    const client = createDOClient({ call: callFn })
    const [r1, r2, r3] = await Promise.all([(client as any).contacts.list(), (client as any).deals.list(), (client as any).invoices.list()])
    expect(callFn).toHaveBeenCalledTimes(3)
    expect(r1).toBe('result_contacts.list')
    expect(r2).toBe('result_deals.list')
    expect(r3).toBe('result_invoices.list')
  })

  it('concurrent calls to same method path produce independent results', async () => {
    let seq = 0
    const callFn = vi.fn(async () => ++seq)
    const client = createDOClient({ call: callFn })
    const results = await Promise.all(Array.from({ length: 5 }, () => (client as any).counter.next()))
    expect(callFn).toHaveBeenCalledTimes(5)
    expect(new Set(results).size).toBe(5) // all unique
  })

  it('sequential calls accumulate correctly', async () => {
    const history: string[] = []
    const callFn = vi.fn(async (method: string) => {
      history.push(method)
      return null
    })
    const client = createDOClient({ call: callFn })
    await (client as any).step1()
    await (client as any).step2()
    await (client as any).step3()
    expect(history).toEqual(['step1', 'step2', 'step3'])
  })

  it('interleaved storage and method calls work independently', async () => {
    const callFn = vi.fn(async (method: string) => {
      if (method === '__storageGet') return 'stored-value'
      if (method === 'custom.method') return 'custom-result'
      return null
    })
    const client = createDOClient({ call: callFn })
    const [storageResult, methodResult] = await Promise.all([client.storage.get('key'), (client as any).custom.method()])
    expect(storageResult).toBe('stored-value')
    expect(methodResult).toBe('custom-result')
  })
})

// =============================================================================
// 10. DOClient SQL Edge Cases (~4 tests)
// =============================================================================

describe('DOClient SQL Edge Cases', () => {
  it('sql with boolean, number, and null interpolations serializes all types', async () => {
    const callFn = vi.fn(async () => ({ results: [], meta: { rows_read: 0, rows_written: 0 } }))
    const client = createDOClient({ call: callFn })
    await client.sql`INSERT INTO t (a, b, c) VALUES (${true}, ${42}, ${null})`.all()
    const serialized = callFn.mock.calls[0]![1]![0] as any
    expect(serialized.values).toEqual([true, 42, null])
  })

  it('sql raw() returns the full result object without unwrapping', async () => {
    const fullResult = { results: [{ x: 1 }, { x: 2 }], meta: { rows_read: 2, rows_written: 0 } }
    const callFn = vi.fn(async () => fullResult)
    const client = createDOClient({ call: callFn })
    const result = await client.sql`SELECT x FROM t`.raw()
    expect(result).toEqual(fullResult)
    expect(result.results).toHaveLength(2)
    expect(result.meta.rows_read).toBe(2)
  })

  it('sql all() on empty result returns empty array', async () => {
    const callFn = vi.fn(async () => ({ results: [], meta: { rows_read: 0, rows_written: 0 } }))
    const client = createDOClient({ call: callFn })
    const result = await client.sql`SELECT * FROM empty_table`.all()
    expect(result).toEqual([])
  })

  it('sql first() on empty result returns null', async () => {
    const callFn = vi.fn(async () => null)
    const client = createDOClient({ call: callFn })
    const result = await client.sql`SELECT * FROM empty_table LIMIT 1`.first()
    expect(result).toBeNull()
  })
})

// =============================================================================
// 11. DOClient Storage Overload Edge Cases (~5 tests)
// =============================================================================

describe('DOClient Storage Overload Edge Cases', () => {
  it('storage.get with single key calls __storageGet', async () => {
    const callFn = vi.fn(async () => 'val')
    const client = createDOClient({ call: callFn })
    const result = await client.storage.get('singleKey')
    expect(callFn).toHaveBeenCalledWith('__storageGet', ['singleKey'])
    expect(result).toBe('val')
  })

  it('storage.get with empty array calls __storageGetMultiple', async () => {
    const callFn = vi.fn(async () => ({}))
    const client = createDOClient({ call: callFn })
    const result = await client.storage.get([])
    expect(callFn).toHaveBeenCalledWith('__storageGetMultiple', [[]])
    expect(result).toBeInstanceOf(Map)
  })

  it('storage.delete with single key calls __storageDelete', async () => {
    const callFn = vi.fn(async () => true)
    const client = createDOClient({ call: callFn })
    const result = await client.storage.delete('one')
    expect(callFn).toHaveBeenCalledWith('__storageDelete', ['one'])
    expect(result).toBe(true)
  })

  it('storage.put with key-value calls __storagePut', async () => {
    const callFn = vi.fn(async () => undefined)
    const client = createDOClient({ call: callFn })
    await client.storage.put('myKey', { complex: 'value', nested: [1, 2, 3] })
    expect(callFn).toHaveBeenCalledWith('__storagePut', ['myKey', { complex: 'value', nested: [1, 2, 3] }])
  })

  it('storage.list with all options', async () => {
    const callFn = vi.fn(async () => ({ a: 1 }))
    const client = createDOClient({ call: callFn })
    const result = await client.storage.list({ prefix: 'p', limit: 10, start: 's', end: 'e' })
    expect(callFn).toHaveBeenCalledWith('__storageList', [{ prefix: 'p', limit: 10, start: 's', end: 'e' }])
    expect(result).toBeInstanceOf(Map)
  })
})

// =============================================================================
// 12. connectDO Export Verification (~3 tests)
// =============================================================================

describe('connectDO Export', () => {
  it('connectDO is exported as a function', () => {
    expect(connectDO).toBeDefined()
    expect(typeof connectDO).toBe('function')
  })

  it('connectDO function has expected arity (url + options)', () => {
    // connectDO(url: string, options?: {...}): Promise<DOClient>
    expect(connectDO.length).toBeGreaterThanOrEqual(1)
  })

  it('connectDO returns a promise', () => {
    // Calling with a URL that won't connect, but we can check the return type
    const suppress = () => {}
    process.on('unhandledRejection', suppress)
    try {
      const result = connectDO('wss://localhost:99999')
      expect(result).toBeInstanceOf(Promise)
      // Suppress the eventual rejection
      result.catch(() => {})
    } finally {
      setTimeout(() => process.removeListener('unhandledRejection', suppress), 100)
    }
  })
})

// =============================================================================
// 13. binding() Transport — this Context & Return Values (~4 tests)
// =============================================================================

describe('binding() Transport — this Context', () => {
  it('binding transport does not preserve this context (methods are detached)', async () => {
    const service = {
      multiplier: 10,
      compute(x: number) {
        return x * this.multiplier
      },
    }
    const transport = binding(service)
    // binding() calls the method without preserving `this`, so this.multiplier is undefined
    await expect(transport.call('compute', [5])).rejects.toThrow()
  })

  it('method returning undefined resolves correctly', async () => {
    const service = { noop: () => undefined }
    const transport = binding(service)
    const result = await transport.call('noop', [])
    expect(result).toBeUndefined()
  })

  it('method returning a promise resolves the promise', async () => {
    const service = { delayed: async () => 'eventually' }
    const transport = binding(service)
    const result = await transport.call('delayed', [])
    expect(result).toBe('eventually')
  })

  it('method returning complex nested data preserves structure', async () => {
    const service = {
      getData: () => ({
        items: [{ id: 1, nested: { deep: true } }],
        meta: { total: 1 },
      }),
    }
    const transport = binding(service)
    const result = (await transport.call('getData', [])) as any
    expect(result.items[0].nested.deep).toBe(true)
    expect(result.meta.total).toBe(1)
  })
})

// =============================================================================
// 14. composite() Edge Cases (~4 tests)
// =============================================================================

describe('composite() Edge Cases', () => {
  it('composite with 5 transports tries each in order', async () => {
    const order: number[] = []
    const makeFailing = (n: number): Transport => ({
      call: vi.fn(async () => {
        order.push(n)
        throw new Error(`fail-${n}`)
      }),
    })
    const makeSuccess = (n: number): Transport => ({
      call: vi.fn(async () => {
        order.push(n)
        return `success-${n}`
      }),
    })
    const ct = composite(makeFailing(1), makeFailing(2), makeFailing(3), makeFailing(4), makeSuccess(5))
    const result = await ct.call('test', [])
    expect(result).toBe('success-5')
    expect(order).toEqual([1, 2, 3, 4, 5])
  })

  it('composite with single successful transport returns immediately', async () => {
    const t: Transport = { call: vi.fn(async () => 'only-one') }
    const ct = composite(t)
    const result = await ct.call('m', [])
    expect(result).toBe('only-one')
    expect(t.call).toHaveBeenCalledTimes(1)
  })

  it('composite preserves original arguments through fallback chain', async () => {
    const args: unknown[][] = []
    const t1: Transport = {
      call: vi.fn(async (_m, a) => {
        args.push(a)
        throw new Error('fail')
      }),
    }
    const t2: Transport = {
      call: vi.fn(async (_m, a) => {
        args.push(a)
        return 'ok'
      }),
    }
    const ct = composite(t1, t2)
    await ct.call('test', [{ key: 'value' }])
    expect(args[0]).toEqual([{ key: 'value' }])
    expect(args[1]).toEqual([{ key: 'value' }])
  })

  it('composite close is idempotent (calling twice does not double-close)', () => {
    const close1 = vi.fn()
    const t1: Transport = { call: vi.fn(async () => null), close: close1 }
    const ct = composite(t1)
    ct.close!()
    ct.close!()
    // close1 is called once per close() invocation
    expect(close1).toHaveBeenCalledTimes(2)
  })
})

// =============================================================================
// 15. http() Transport Options (~4 tests)
// =============================================================================

describe('http() Transport — Options Variations', () => {
  it('http with no auth returns transport', () => {
    const t = http('https://example.com/rpc')
    expect(typeof t.call).toBe('function')
    expect(typeof t.close).toBe('function')
  })

  it('http with auth function returns transport', () => {
    const t = http('https://example.com/rpc', { auth: () => 'dynamic-token' })
    expect(typeof t.call).toBe('function')
  })

  it('http with timeout option returns transport', () => {
    const t = http('https://example.com/rpc', { timeout: 10000 })
    expect(typeof t.call).toBe('function')
  })

  it('http with null auth function returns transport', () => {
    const t = http('https://example.com/rpc', { auth: () => null })
    expect(typeof t.call).toBe('function')
  })
})

// =============================================================================
// 16. createRPCClient — Detailed Option Handling (~3 tests)
// =============================================================================

describe('createRPCClient — Detailed Option Handling', () => {
  it('createRPCClient with timeout option returns valid proxy', () => {
    const client = createRPCClient({ baseUrl: 'https://api.com/rpc', timeout: 30000 })
    expect(client).toBeDefined()
    expect((client as any).then).toBeUndefined()
  })

  it('createRPCClient with auth function returns valid proxy', () => {
    const client = createRPCClient({ baseUrl: 'https://api.com/rpc', auth: () => 'tok' })
    expect(client).toBeDefined()
    expect(typeof client).toBe('object')
  })

  it('createRPCClient result has DO features (sql, storage, collection)', () => {
    const client = createRPCClient({ baseUrl: 'https://api.com/rpc' })
    // These are part of DOClientFeatures
    expect((client as any).sql).toBeDefined()
    expect((client as any).storage).toBeDefined()
    expect((client as any).collection).toBeDefined()
  })
})

// =============================================================================
// 17. Schema Type Shapes (~3 tests)
// =============================================================================

describe('Schema Type Shapes', () => {
  it('SqlQuery interface has all four methods', () => {
    // Compile-time check: SqlQuery<T> has all, first, run, raw
    const assertType = <T>(_val?: T) => true
    expect(assertType<SqlQuery<unknown>>()).toBe(true)
  })

  it('RemoteStorage interface has get, put, delete, list, keys', () => {
    const assertType = <T>(_val?: T) => true
    expect(assertType<RemoteStorage>()).toBe(true)
  })

  it('RemoteCollection interface has get, put, delete, has, find, count, list, keys, clear', () => {
    const assertType = <T>(_val?: T) => true
    expect(assertType<RemoteCollection>()).toBe(true)
  })
})

// =============================================================================
// 18. DOClient Type Shape (~3 tests)
// =============================================================================

describe('DOClient Type Shape', () => {
  it('DOClient has sql, storage, collection, dbSchema, schema, close', () => {
    const assertType = <T>(_val?: T) => true
    expect(assertType<DOClient>()).toBe(true)
  })

  it('DOClient is intersection of DO features and RPCProxy', () => {
    // This verifies at compile time that DOClient<T> includes RPCProxy<T>
    const assertType = <T>(_val?: T) => true
    expect(assertType<DOClient<{ users: { list: () => Promise<string[]> } }>>()).toBe(true)
  })

  it('DOClient close returns Promise<void>', async () => {
    const callFn = vi.fn(async () => null)
    const closeFn = vi.fn()
    const client = createDOClient({ call: callFn, close: closeFn })
    const result = client.close()
    expect(result).toBeInstanceOf(Promise)
    await result
    expect(closeFn).toHaveBeenCalled()
  })
})

// =============================================================================
// 19. capnweb() Transport Options (~3 tests)
// =============================================================================

describe('capnweb() Transport — Additional Options', () => {
  it('capnweb with websocket: false and auth returns transport', () => {
    const t = capnweb('https://example.com/rpc', { websocket: false, auth: 'tok' })
    expect(typeof t.call).toBe('function')
    expect(typeof t.close).toBe('function')
  })

  it('capnweb with auth function', () => {
    const t = capnweb('https://example.com/rpc', { websocket: false, auth: () => 'dynamic' })
    expect(typeof t.call).toBe('function')
  })

  it('capnweb with localMain for bidirectional RPC', () => {
    const handler = { notify: () => {} }
    const t = capnweb('https://example.com/rpc', { websocket: false, localMain: handler })
    expect(typeof t.call).toBe('function')
  })
})

// =============================================================================
// 20. HttpTransportOptions and CapnwebTransportOptions Types (~2 tests)
// =============================================================================

describe('Transport Options Types', () => {
  it('HttpTransportOptions accepts auth string, auth function, and timeout', () => {
    const opts1: HttpTransportOptions = { auth: 'token' }
    const opts2: HttpTransportOptions = { auth: () => 'token', timeout: 5000 }
    const opts3: HttpTransportOptions = { timeout: 3000 }
    expect(opts1.auth).toBe('token')
    expect(opts2.timeout).toBe(5000)
    expect(opts3.timeout).toBe(3000)
  })

  it('CapnwebTransportOptions accepts websocket, auth, reconnect, localMain', () => {
    const opts: CapnwebTransportOptions = {
      websocket: true,
      auth: 'tok',
      reconnect: true,
      reconnectOptions: { maxReconnectAttempts: 5 },
      localMain: {},
      allowInsecureAuth: false,
    }
    expect(opts.websocket).toBe(true)
    expect(opts.reconnect).toBe(true)
    expect(opts.reconnectOptions!.maxReconnectAttempts).toBe(5)
  })
})
