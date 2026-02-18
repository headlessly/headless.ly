/**
 * E2E Tests for @headlessly/node — Node.js SDK
 *
 * Validates exports, constructors, client API surface, and middleware factories.
 * Tests run in Node.js — no external services required for structural tests.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { HeadlessNodeClient, createClient, headlessly, expressMiddleware, honoMiddleware, Headlessly } from '../src/index.js'
import type { NodeConfig } from '../src/index.js'

// =============================================================================
// 1. Exports exist
// =============================================================================

describe('@headlessly/node exports', () => {
  it('exports HeadlessNodeClient as a class', () => {
    expect(HeadlessNodeClient).toBeDefined()
    expect(typeof HeadlessNodeClient).toBe('function')
  })

  it('exports createClient as a function', () => {
    expect(createClient).toBeDefined()
    expect(typeof createClient).toBe('function')
  })

  it('exports headlessly as a function', () => {
    expect(headlessly).toBeDefined()
    expect(typeof headlessly).toBe('function')
  })

  it('exports expressMiddleware as a function', () => {
    expect(expressMiddleware).toBeDefined()
    expect(typeof expressMiddleware).toBe('function')
  })

  it('exports honoMiddleware as a function', () => {
    expect(honoMiddleware).toBeDefined()
    expect(typeof honoMiddleware).toBe('function')
  })

  it('exports Headlessly singleton manager', () => {
    expect(Headlessly).toBeDefined()
    expect(typeof Headlessly.init).toBe('function')
    expect(typeof Headlessly.reset).toBe('function')
  })
})

// =============================================================================
// 2. createClient factory
// =============================================================================

describe('createClient()', () => {
  it('returns a HeadlessNodeClient instance', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e' })
    expect(client).toBeInstanceOf(HeadlessNodeClient)
  })

  it('sets apiKey and default endpoint', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e' })
    expect(client.apiKey).toBe('hl_test_node_e2e')
    expect(client.endpoint).toBe('https://headless.ly/e')
  })

  it('accepts custom endpoint', () => {
    const client = createClient({ apiKey: 'hl_test', endpoint: 'https://custom.example.com/e' })
    expect(client.endpoint).toBe('https://custom.example.com/e')
  })
})

// =============================================================================
// 3. Client methods do not throw
// =============================================================================

describe('client.track() and client.identify()', () => {
  it('track does not throw', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e', maxQueueSize: 100 })
    expect(() => client.track('test_event', { plan: 'pro' })).not.toThrow()
    expect(() => client.track('signup', { source: 'cli' }, 'user_abc')).not.toThrow()
  })

  it('identify does not throw', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e', maxQueueSize: 100 })
    expect(() => client.identify('user_abc', { email: 'test@example.com' })).not.toThrow()
  })

  it('group does not throw', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e', maxQueueSize: 100 })
    expect(() => client.group('org_xyz', { name: 'Acme' })).not.toThrow()
  })

  it('captureException does not throw and returns an event ID', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e', maxQueueSize: 100 })
    const id = client.captureException(new Error('test error'))
    expect(typeof id).toBe('string')
    expect(id.length).toBe(32)
  })

  it('captureMessage does not throw and returns an event ID', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e', maxQueueSize: 100 })
    const id = client.captureMessage('test message', 'warning')
    expect(typeof id).toBe('string')
    expect(id.length).toBe(32)
  })

  it('setTag and setTags do not throw', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e' })
    expect(() => client.setTag('env', 'test')).not.toThrow()
    expect(() => client.setTags({ region: 'us-east', tier: 'free' })).not.toThrow()
  })

  it('queueSize reflects enqueued events', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e', maxQueueSize: 100, batchSize: 100 })
    expect(client.queueSize).toBe(0)
    client.track('e1')
    client.track('e2')
    expect(client.queueSize).toBe(2)
  })

  it('shutdown resolves cleanly', async () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e' })
    client.track('pre_shutdown')
    await expect(client.shutdown()).resolves.toBeUndefined()
  })
})

// =============================================================================
// 4. expressMiddleware
// =============================================================================

describe('expressMiddleware()', () => {
  it('returns a function', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e' })
    const mw = expressMiddleware(client)
    expect(typeof mw).toBe('function')
  })

  it('middleware accepts (req, res, next) signature', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e', maxQueueSize: 100 })
    const mw = expressMiddleware(client)
    // The middleware function should accept 3 parameters
    expect(mw.length).toBe(3)
  })

  it('middleware calls next()', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e', maxQueueSize: 100 })
    const mw = expressMiddleware(client)

    let nextCalled = false
    const req = { method: 'GET', url: '/test', path: '/test', headers: {} as Record<string, string> }
    const res = {
      statusCode: 200,
      on: (_event: string, cb: () => void) => {
        if (_event === 'finish') cb()
      },
    }

    mw(req, res, () => {
      nextCalled = true
    })
    expect(nextCalled).toBe(true)
  })
})

// =============================================================================
// 5. honoMiddleware
// =============================================================================

describe('honoMiddleware()', () => {
  it('returns a function', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e' })
    const mw = honoMiddleware(client)
    expect(typeof mw).toBe('function')
  })

  it('middleware is async', () => {
    const client = createClient({ apiKey: 'hl_test_node_e2e' })
    const mw = honoMiddleware(client)

    const ctx = {
      req: { method: 'GET', path: '/api/test', url: 'https://example.com/api/test', header: () => undefined },
      res: { status: 200 },
    }

    const result = mw(ctx, async () => {})
    expect(result).toBeInstanceOf(Promise)
  })
})

// =============================================================================
// 6. Headlessly singleton
// =============================================================================

describe('Headlessly singleton', () => {
  afterEach(async () => {
    await Headlessly.reset()
  })

  it('Headlessly.init() returns a HeadlessNodeClient', () => {
    const client = Headlessly.init({ apiKey: 'hl_singleton_test' })
    expect(client).toBeInstanceOf(HeadlessNodeClient)
  })

  it('Headlessly.init() throws without apiKey', () => {
    expect(() => Headlessly.init({} as NodeConfig)).toThrow('apiKey is required')
  })

  it('Headlessly.init() returns same instance on second call', () => {
    const a = Headlessly.init({ apiKey: 'hl_singleton_test' })
    const b = Headlessly.init({ apiKey: 'hl_singleton_test_2' })
    expect(a).toBe(b)
  })

  it('Headlessly.reset() allows re-initialization', async () => {
    const a = Headlessly.init({ apiKey: 'hl_singleton_a' })
    await Headlessly.reset()
    const b = Headlessly.init({ apiKey: 'hl_singleton_b' })
    expect(a).not.toBe(b)
    expect(b.apiKey).toBe('hl_singleton_b')
  })
})
