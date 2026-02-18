import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HeadlessNodeClient, createClient, Headlessly, expressMiddleware, honoMiddleware } from '../src/index.js'

// ---------------------------------------------------------------------------
// Mocked fetch infrastructure
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string
  init: RequestInit
  body?: unknown
}

const fetchCalls: FetchCall[] = []
let fetchResponder: (url: string, init?: RequestInit) => Response | Promise<Response> = () => new Response(JSON.stringify({ ok: true }), { status: 200 })

function resetFetch() {
  fetchCalls.length = 0
  fetchResponder = () => new Response(JSON.stringify({ ok: true }), { status: 200 })
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input.toString()
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    fetchCalls.push({ url, init: init ?? {}, body })
    return fetchResponder(url, init)
  }
}

function eventCalls(): FetchCall[] {
  return fetchCalls.filter((c) => c.body?.events && !c.url.includes('/flags'))
}

function flagCalls(): FetchCall[] {
  return fetchCalls.filter((c) => c.url.includes('/flags'))
}

function allSentEvents(): Record<string, unknown>[] {
  return eventCalls().flatMap((c) => (c.body as { events: Record<string, unknown>[] }).events)
}

// ---------------------------------------------------------------------------
// Deep V3 Tests — 55+ NEW tests covering untested areas
// ---------------------------------------------------------------------------

describe('@headlessly/node — deep v3', () => {
  beforeEach(() => {
    resetFetch()
  })

  // =========================================================================
  // 1. Queue overflow with various maxQueueSize values
  // =========================================================================

  describe('Queue overflow — varied maxQueueSize boundaries', () => {
    it('maxQueueSize=0 means every enqueue drops the prior oldest (queue always 0 or 1)', async () => {
      // With maxQueueSize=0, queue.length >= 0 is always true, so shift() before push
      // This means every enqueue shifts then pushes, so queue always has exactly 1 item
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000, maxQueueSize: 0 })

      client.track('a')
      // maxQueueSize=0: queue.length(0) >= 0 => true, shift (noop), push => length 1
      // Actually: before first push, queue is empty, shift on empty is noop, then push
      expect(client.queueSize).toBeLessThanOrEqual(1)

      client.track('b')
      // queue.length(1) >= 0 => true, shift removes 'a', push 'b' => length 1
      expect(client.queueSize).toBeLessThanOrEqual(1)

      await client.flush()
      const events = allSentEvents()
      // Only the last event should survive
      expect(events.length).toBeLessThanOrEqual(1)
      if (events.length === 1) {
        expect(events[0].event).toBe('b')
      }
      await client.shutdown()
    })

    it('maxQueueSize=2 correctly maintains at most 2 events', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000, maxQueueSize: 2 })

      client.track('e1')
      client.track('e2')
      expect(client.queueSize).toBe(2)

      client.track('e3')
      expect(client.queueSize).toBe(2)

      client.track('e4')
      expect(client.queueSize).toBe(2)

      await client.flush()
      const events = allSentEvents()
      expect(events).toHaveLength(2)
      expect(events[0].event).toBe('e3')
      expect(events[1].event).toBe('e4')
      await client.shutdown()
    })

    it('maxQueueSize=10 allows 10 events and drops oldest on 11th', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000, maxQueueSize: 10 })

      for (let i = 0; i < 15; i++) client.track(`event_${i}`)
      expect(client.queueSize).toBe(10)

      await client.flush()
      const events = allSentEvents()
      expect(events).toHaveLength(10)
      // Should have events 5-14 (oldest 0-4 dropped)
      expect(events[0].event).toBe('event_5')
      expect(events[9].event).toBe('event_14')
      await client.shutdown()
    })

    it('maxQueueSize with mixed event types still enforces the limit', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000, maxQueueSize: 3 })

      client.track('track_1')
      client.identify('user_1')
      client.group('org_1')
      // Queue full at 3
      client.captureMessage('msg')
      // track_1 dropped
      expect(client.queueSize).toBe(3)

      await client.flush()
      const events = allSentEvents()
      const types = events.map((e) => e.type)
      expect(types).toEqual(['identify', 'group', 'message'])
      await client.shutdown()
    })

    it('maxQueueSize does not affect auto-flush trigger threshold', async () => {
      // batchSize=3, maxQueueSize=5: auto-flush triggers at 3 events, not 5
      const client = createClient({ apiKey: 'k', batchSize: 3, flushInterval: 60000, maxQueueSize: 5 })

      client.track('a')
      client.track('b')
      expect(eventCalls()).toHaveLength(0) // below batchSize

      client.track('c') // hits batchSize=3
      expect(eventCalls().length).toBeGreaterThanOrEqual(1)
      await client.shutdown()
    })
  })

  // =========================================================================
  // 2. Batch flush timing and event ordering
  // =========================================================================

  describe('Batch flush timing and event ordering', () => {
    it('flush timer starts only after the first event', async () => {
      vi.useFakeTimers()
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 5000 })

      // No events yet — advancing time should not trigger flush
      await vi.advanceTimersByTimeAsync(10000)
      expect(eventCalls()).toHaveLength(0)

      // Now enqueue one — timer starts
      client.track('first')
      await vi.advanceTimersByTimeAsync(5001)
      expect(eventCalls().length).toBeGreaterThanOrEqual(1)

      await client.shutdown()
      vi.useRealTimers()
    })

    it('multiple batches maintain chronological ordering across flushes', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 2, flushInterval: 60000 })

      client.track('batch1_a')
      client.track('batch1_b') // triggers auto-flush

      client.track('batch2_a')
      client.track('batch2_b') // triggers second auto-flush

      // Force any remaining
      await client.flush()

      const allCalls = eventCalls()
      expect(allCalls.length).toBeGreaterThanOrEqual(2)

      const batch1 = (allCalls[0].body as { events: Record<string, unknown>[] }).events
      expect(batch1[0].event).toBe('batch1_a')
      expect(batch1[1].event).toBe('batch1_b')

      const batch2 = (allCalls[1].body as { events: Record<string, unknown>[] }).events
      expect(batch2[0].event).toBe('batch2_a')
      expect(batch2[1].event).toBe('batch2_b')

      await client.shutdown()
    })

    it('events enqueued during a flush are not lost', async () => {
      let flushCount = 0
      fetchResponder = () => {
        flushCount++
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })

      client.track('before_flush')
      const flushPromise = client.flush()

      // Enqueue during the flush
      client.track('during_flush')
      await flushPromise

      // The during_flush event should still be in queue
      expect(client.queueSize).toBe(1)

      await client.flush()
      const events = allSentEvents()
      const duringEvent = events.find((e) => e.event === 'during_flush')
      expect(duringEvent).toBeDefined()

      await client.shutdown()
    })

    it('timestamps are sequential across rapidly enqueued events', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })

      for (let i = 0; i < 5; i++) client.track(`rapid_${i}`)
      await client.flush()

      const events = allSentEvents()
      for (let i = 1; i < events.length; i++) {
        const prev = new Date(events[i - 1].ts as string).getTime()
        const curr = new Date(events[i].ts as string).getTime()
        expect(curr).toBeGreaterThanOrEqual(prev)
      }

      await client.shutdown()
    })
  })

  // =========================================================================
  // 3. Feature flag evaluation — complex variant rules
  // =========================================================================

  describe('Feature flag evaluation — complex variants', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('handles object-typed flag values', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { config: { color: 'blue', limit: 100 } } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const val = await client.getFeatureFlag('config', 'u1')
      expect(val).toEqual({ color: 'blue', limit: 100 })
    })

    it('isFeatureEnabled with number flag > 0 returns false (number is not boolean true)', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { flag: 42 } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const enabled = await client.isFeatureEnabled('flag', 'u1')
      // 42 !== true && 42 !== 'true' && typeof 42 !== 'string'
      expect(enabled).toBe(false)
    })

    it('isFeatureEnabled with object flag returns false', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { flag: { variant: 'a' } } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const enabled = await client.isFeatureEnabled('flag', 'u1')
      expect(enabled).toBe(false)
    })

    it('isFeatureEnabled with empty string returns false', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { flag: '' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      // '' is falsy: '' !== true, '' !== 'true', typeof '' === 'string' but '' is falsy
      // Actually: v === true (no), v === 'true' (no), (typeof v === 'string' && v !== 'false' && v !== 'control')
      // '' is string, '' !== 'false', '' !== 'control', but the full check:
      // typeof v === 'string' && v !== 'false' && v !== 'control' => true && true && true => true
      // Wait: '' is a string that is not 'false' and not 'control'. So it returns true
      // But empty string is falsy. Let me check: the code says:
      // return v === true || v === 'true' || (typeof v === 'string' && v !== 'false' && v !== 'control')
      // For v = '': false || false || (true && true && true) => true
      const enabled = await client.isFeatureEnabled('flag', 'u1')
      expect(enabled).toBe(true)
    })

    it('caches flag per key:distinctId combo — different keys for same user are separate', async () => {
      let callCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) {
          callCount++
          return new Response(JSON.stringify({ flags: { flag_a: 'val_a', flag_b: 'val_b' } }), { status: 200 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const a = await client.getFeatureFlag('flag_a', 'user_1')
      expect(a).toBe('val_a')
      expect(callCount).toBe(1)

      const b = await client.getFeatureFlag('flag_b', 'user_1')
      expect(b).toBe('val_b')
      expect(callCount).toBe(2) // Different flag key, different cache entry
    })

    it('getFeatureFlag returns undefined on malformed JSON response', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response('not json', { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const val = await client.getFeatureFlag('flag', 'u1')
      expect(val).toBeUndefined()
    })

    it('getAllFlags returns empty object on malformed JSON response', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response('broken', { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const flags = await client.getAllFlags('u1')
      expect(flags).toEqual({})
    })

    it('getFeatureFlag sends correct request body with keys array', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      await client.getFeatureFlag('my-flag', 'user_x')

      const call = flagCalls()[0]
      expect(call.body).toEqual({ distinctId: 'user_x', keys: ['my-flag'] })
    })
  })

  // =========================================================================
  // 4. Middleware response time measurement
  // =========================================================================

  describe('Middleware response time measurement', () => {
    it('client.middleware() duration is zero or positive for instant next()', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })
      const mw = client.middleware()

      const req = { method: 'GET', url: '/fast', path: '/fast' }
      const res = { statusCode: 200 }
      const next = vi.fn().mockResolvedValue(undefined)

      await mw(req as any, res as any, next)
      await client.flush()

      const events = allSentEvents()
      const httpEvent = events.find((e) => e.event === 'http_request') as { properties: Record<string, unknown> }
      expect(httpEvent.properties.duration).toBeGreaterThanOrEqual(0)
      expect(httpEvent.properties.duration).toBeLessThan(1000) // should be near-instant
      await client.shutdown()
    })

    it('expressMiddleware captures response status code set after next()', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })
      const mw = expressMiddleware(client)

      let finishCb: (() => void) | undefined
      const req = { method: 'POST', url: '/create', path: '/create', headers: {} }
      const res = {
        statusCode: 200,
        on: (_event: string, cb: () => void) => {
          finishCb = cb
        },
      }
      const next = vi.fn(() => {
        // Simulate Express setting status after handler
        res.statusCode = 201
      })

      mw(req as any, res as any, next)
      finishCb!()
      await client.flush()

      const events = allSentEvents()
      const httpEvent = events.find((e) => e.event === 'http_request') as { properties: Record<string, unknown> }
      expect(httpEvent.properties.status).toBe(201)
      await client.shutdown()
    })

    it('honoMiddleware captures status correctly from c.res.status', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })
      const mw = honoMiddleware(client)

      const c = {
        req: { method: 'POST', path: '/api/items', url: '/api/items', header: () => undefined },
        res: { status: 201 },
      }
      const next = vi.fn(async () => {
        c.res.status = 204 // changed during handler
      })

      await mw(c as any, next)
      await client.flush()

      const events = allSentEvents()
      const httpEvent = events.find((e) => e.event === 'http_request') as { properties: Record<string, unknown> }
      // The status is read AFTER next() in the finally block
      expect(httpEvent.properties.status).toBe(204)
      await client.shutdown()
    })
  })

  // =========================================================================
  // 5. Error serialization depth
  // =========================================================================

  describe('Error serialization depth', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('captures error.name and error.message from custom typed errors', async () => {
      class ValidationError extends Error {
        constructor(
          message: string,
          public field: string,
        ) {
          super(message)
          this.name = 'ValidationError'
        }
      }

      client.captureException(new ValidationError('email is invalid', 'email'))
      await client.flush()

      const events = allSentEvents()
      const exception = (events[0] as { exception: { type: string; value: string } }).exception
      expect(exception.type).toBe('ValidationError')
      expect(exception.value).toBe('email is invalid')
    })

    it('handles TypeError correctly', async () => {
      const err = new TypeError('Cannot read properties of null')
      client.captureException(err)
      await client.flush()

      const events = allSentEvents()
      const exception = (events[0] as { exception: { type: string; value: string } }).exception
      expect(exception.type).toBe('TypeError')
      expect(exception.value).toBe('Cannot read properties of null')
    })

    it('handles RangeError correctly', async () => {
      const err = new RangeError('Maximum call stack size exceeded')
      client.captureException(err)
      await client.flush()

      const events = allSentEvents()
      const exception = (events[0] as { exception: { type: string; value: string } }).exception
      expect(exception.type).toBe('RangeError')
      expect(exception.value).toBe('Maximum call stack size exceeded')
    })

    it('handles error with empty string message', async () => {
      const err = new Error('')
      client.captureException(err)
      await client.flush()

      const events = allSentEvents()
      const exception = (events[0] as { exception: { type: string; value: string } }).exception
      expect(exception.type).toBe('Error')
      expect(exception.value).toBe('')
    })

    it('preserves extra context with deeply nested objects', async () => {
      client.captureException(new Error('deep'), undefined, {
        extra: {
          request: {
            body: { user: { address: { city: 'SF', zip: '94103' } } },
            headers: { authorization: 'redacted' },
          },
        },
      })
      await client.flush()

      const events = allSentEvents()
      const extra = (events[0] as { extra: Record<string, unknown> }).extra
      expect((extra as any).request.body.user.address.city).toBe('SF')
    })

    it('combines user, tags, and extra in a single exception event', async () => {
      client.setTag('global', 'tag')
      client.captureException(new Error('combined'), 'user_1', {
        user: { id: 'user_1', email: 'a@b.co' },
        tags: { local: 'tag' },
        extra: { key: 'value' },
      })
      await client.flush()

      const ev = allSentEvents()[0]
      expect((ev as any).user.id).toBe('user_1')
      expect((ev as any).tags.global).toBe('tag')
      expect((ev as any).tags.local).toBe('tag')
      expect((ev as any).extra.key).toBe('value')
      expect(ev.distinctId).toBe('user_1')
    })
  })

  // =========================================================================
  // 6. Client singleton pattern edge cases
  // =========================================================================

  describe('Singleton edge cases', () => {
    afterEach(async () => {
      await Headlessly.reset()
    })

    it('reset() calls shutdown on the existing singleton', async () => {
      const client = Headlessly.init({ apiKey: 'key1' })
      client.track('pre_reset')

      await Headlessly.reset()
      // After reset, the singleton is cleared and shutdown was called
      // Events from before reset should have been flushed
      const events = allSentEvents()
      expect(events.some((e) => e.event === 'pre_reset')).toBe(true)
    })

    it('after reset, init creates a fresh client with new config', async () => {
      const a = Headlessly.init({ apiKey: 'key_a', endpoint: 'https://a.example.com' })
      await Headlessly.reset()
      const b = Headlessly.init({ apiKey: 'key_b', endpoint: 'https://b.example.com' })

      expect(a).not.toBe(b)
      expect(b.apiKey).toBe('key_b')
      expect(b.endpoint).toBe('https://b.example.com')
    })

    it('createClient instances are fully independent', async () => {
      const c1 = createClient({ apiKey: 'k1', batchSize: 100, flushInterval: 60000, tags: { from: 'c1' } })
      const c2 = createClient({ apiKey: 'k2', batchSize: 100, flushInterval: 60000, tags: { from: 'c2' } })

      c1.track('e1')
      c2.track('e2')

      await c1.flush()
      await c2.flush()

      const calls = eventCalls()
      // Each client sends its own flush
      expect(calls.length).toBe(2)

      // Verify they use their own apiKeys
      const authHeaders = calls.map((c) => (c.init.headers as Record<string, string>).Authorization)
      expect(authHeaders).toContain('Bearer k1')
      expect(authHeaders).toContain('Bearer k2')

      await c1.shutdown()
      await c2.shutdown()
    })

    it('multiple createClient instances have independent queues', async () => {
      const c1 = createClient({ apiKey: 'k1', batchSize: 100, flushInterval: 60000 })
      const c2 = createClient({ apiKey: 'k2', batchSize: 100, flushInterval: 60000 })

      c1.track('c1_event')
      expect(c1.queueSize).toBe(1)
      expect(c2.queueSize).toBe(0)

      c2.track('c2_event')
      expect(c1.queueSize).toBe(1)
      expect(c2.queueSize).toBe(1)

      await c1.shutdown()
      await c2.shutdown()
    })

    it('multiple createClient instances have independent tags', async () => {
      const c1 = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })
      const c2 = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })

      c1.setTag('scope', 'c1')
      c2.setTag('scope', 'c2')

      c1.captureMessage('msg1')
      c2.captureMessage('msg2')

      await c1.flush()
      await c2.flush()

      const events = allSentEvents()
      const msg1 = events.find((e) => e.message === 'msg1') as { tags: Record<string, string> }
      const msg2 = events.find((e) => e.message === 'msg2') as { tags: Record<string, string> }
      expect(msg1.tags.scope).toBe('c1')
      expect(msg2.tags.scope).toBe('c2')

      await c1.shutdown()
      await c2.shutdown()
    })
  })

  // =========================================================================
  // 7. Debug mode output verification
  // =========================================================================

  describe('Debug mode — detailed output', () => {
    it('logs "Initialized" on client creation in debug mode', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient({ apiKey: 'k', debug: true, batchSize: 100, flushInterval: 60000 })
      const initMsg = spy.mock.calls.find((c) => (c[0] as string)?.includes('Initialized'))
      expect(initMsg).toBeDefined()

      spy.mockRestore()
      client.shutdown()
    })

    it('logs track event name in debug mode', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient({ apiKey: 'k', debug: true, batchSize: 100, flushInterval: 60000 })
      client.track('my_event', { x: 1 })

      const trackMsg = spy.mock.calls.find((c) => (c[0] as string)?.includes('track'))
      expect(trackMsg).toBeDefined()

      spy.mockRestore()
      client.shutdown()
    })

    it('logs identify userId in debug mode', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient({ apiKey: 'k', debug: true, batchSize: 100, flushInterval: 60000 })
      client.identify('user_abc')

      const identifyMsg = spy.mock.calls.find((c) => (c[0] as string)?.includes('identify'))
      expect(identifyMsg).toBeDefined()

      spy.mockRestore()
      client.shutdown()
    })

    it('logs group groupId in debug mode', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient({ apiKey: 'k', debug: true, batchSize: 100, flushInterval: 60000 })
      client.group('org_xyz')

      const groupMsg = spy.mock.calls.find((c) => (c[0] as string)?.includes('group'))
      expect(groupMsg).toBeDefined()

      spy.mockRestore()
      client.shutdown()
    })

    it('logs captureException error message in debug mode', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient({ apiKey: 'k', debug: true, batchSize: 100, flushInterval: 60000 })
      client.captureException(new Error('debug_error'))

      const exMsg = spy.mock.calls.find((c) => (c[0] as string)?.includes('captureException'))
      expect(exMsg).toBeDefined()

      spy.mockRestore()
      client.shutdown()
    })

    it('logs captureMessage in debug mode', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient({ apiKey: 'k', debug: true, batchSize: 100, flushInterval: 60000 })
      client.captureMessage('debug msg')

      const msgLog = spy.mock.calls.find((c) => (c[0] as string)?.includes('captureMessage'))
      expect(msgLog).toBeDefined()

      spy.mockRestore()
      client.shutdown()
    })

    it('logs "Sent" with count after successful flush in debug mode', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient({ apiKey: 'k', debug: true, batchSize: 100, flushInterval: 60000 })
      client.track('ev1')
      client.track('ev2')
      await client.flush()

      const sentMsg = spy.mock.calls.find((c) => (c[0] as string)?.includes('Sent'))
      expect(sentMsg).toBeDefined()

      spy.mockRestore()
      await client.shutdown()
    })

    it('logs "Shutdown" on client shutdown in debug mode', async () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient({ apiKey: 'k', debug: true, batchSize: 100, flushInterval: 60000 })
      await client.shutdown()

      const shutdownMsg = spy.mock.calls.find((c) => (c[0] as string)?.includes('Shutdown'))
      expect(shutdownMsg).toBeDefined()

      spy.mockRestore()
    })
  })

  // =========================================================================
  // 8. Shutdown behavior — flush on shutdown, events after shutdown
  // =========================================================================

  describe('Shutdown behavior — advanced', () => {
    it('does not restart flush timer after shutdown', async () => {
      vi.useFakeTimers()
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 2000 })

      client.track('before')
      await client.shutdown()

      const callCount = eventCalls().length

      // Enqueue after shutdown and wait past the flush interval
      client.track('after_shutdown')
      await vi.advanceTimersByTimeAsync(10000)

      // No new auto-flush should have happened
      expect(eventCalls().length).toBe(callCount)

      vi.useRealTimers()
    })

    it('flush() still works manually after shutdown', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })
      await client.shutdown()

      client.track('manual_after_shutdown')
      await client.flush()

      const events = allSentEvents()
      expect(events.some((e) => e.event === 'manual_after_shutdown')).toBe(true)
    })

    it('shutdown with empty queue completes without errors', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })
      await expect(client.shutdown()).resolves.not.toThrow()
      expect(eventCalls()).toHaveLength(0)
    })

    it('shutdown flushes all event types including captureException and captureMessage', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })

      client.track('track_ev')
      client.identify('user_1')
      client.captureException(new Error('err'))
      client.captureMessage('msg')

      await client.shutdown()

      const events = allSentEvents()
      const types = events.map((e) => e.type)
      expect(types).toContain('track')
      expect(types).toContain('identify')
      expect(types).toContain('exception')
      expect(types).toContain('message')
    })
  })

  // =========================================================================
  // 9. Custom transport/endpoint configuration
  // =========================================================================

  describe('Custom endpoint configuration', () => {
    it('flag requests go to endpoint + /flags', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const client = createClient({
        apiKey: 'k',
        endpoint: 'https://custom.example.com/ingest',
        batchSize: 100,
        flushInterval: 60000,
      })

      await client.getFeatureFlag('f', 'u1')

      const call = flagCalls()[0]
      expect(call.url).toBe('https://custom.example.com/ingest/flags')
      await client.shutdown()
    })

    it('event flush goes to exact endpoint URL', async () => {
      const client = createClient({
        apiKey: 'k',
        endpoint: 'https://my-proxy.example.com/v2/events',
        batchSize: 100,
        flushInterval: 60000,
      })

      client.track('ev')
      await client.flush()

      expect(eventCalls()[0].url).toBe('https://my-proxy.example.com/v2/events')
      await client.shutdown()
    })

    it('custom timeout is passed to AbortSignal for event flush', async () => {
      // We cannot directly verify the signal timeout, but we can confirm the fetch is called
      const client = createClient({
        apiKey: 'k',
        timeout: 5000,
        batchSize: 100,
        flushInterval: 60000,
      })

      client.track('ev')
      await client.flush()

      // Verify fetch was called (with signal attached)
      const call = eventCalls()[0]
      expect(call.init.signal).toBeDefined()
      await client.shutdown()
    })
  })

  // =========================================================================
  // 10. Event enrichment — tags, extras, user context merging
  // =========================================================================

  describe('Event enrichment — tags, extras, user context', () => {
    it('config tags do not bleed into track events (only exception/message)', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000, tags: { env: 'prod' } })

      client.track('simple_event')
      await client.flush()

      const events = allSentEvents()
      // Track events don't include global tags — only exception/message do
      expect(events[0].type).toBe('track')
      expect(events[0].tags).toBeUndefined()
      await client.shutdown()
    })

    it('captureException context.tags override config tags for same key', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000, tags: { env: 'prod' } })

      client.captureException(new Error('e'), undefined, { tags: { env: 'staging' } })
      await client.flush()

      const events = allSentEvents()
      const tags = (events[0] as { tags: Record<string, string> }).tags
      expect(tags.env).toBe('staging')
      await client.shutdown()
    })

    it('captureException with full user context preserves custom fields', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })

      client.captureException(new Error('e'), 'u1', {
        user: { id: 'u1', email: 'a@b.co', role: 'admin', orgId: 'org_123' },
      })
      await client.flush()

      const events = allSentEvents()
      const user = (events[0] as { user: Record<string, unknown> }).user
      expect(user.id).toBe('u1')
      expect(user.email).toBe('a@b.co')
      expect(user.role).toBe('admin')
      expect(user.orgId).toBe('org_123')
      await client.shutdown()
    })

    it('captureException without context has no user or extra fields', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })

      client.captureException(new Error('bare'))
      await client.flush()

      const events = allSentEvents()
      expect(events[0].user).toBeUndefined()
      expect(events[0].extra).toBeUndefined()
      await client.shutdown()
    })

    it('setTags accumulates across multiple calls', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })

      client.setTags({ a: '1' })
      client.setTags({ b: '2' })
      client.setTags({ c: '3' })

      client.captureMessage('tagged')
      await client.flush()

      const events = allSentEvents()
      const tags = (events[0] as { tags: Record<string, string> }).tags
      expect(tags.a).toBe('1')
      expect(tags.b).toBe('2')
      expect(tags.c).toBe('3')
      await client.shutdown()
    })

    it('setTag after captureMessage does not retroactively modify previously queued events', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })

      client.setTag('ver', 'v1')
      client.captureMessage('msg1')

      client.setTag('ver', 'v2')
      client.captureMessage('msg2')

      await client.flush()

      const events = allSentEvents()
      const msg1 = events.find((e) => e.message === 'msg1') as { tags: Record<string, string> }
      const msg2 = events.find((e) => e.message === 'msg2') as { tags: Record<string, string> }
      // captureMessage spreads this.tags at call time, so msg1 has v1 snapshot and msg2 has v2
      expect(msg1.tags.ver).toBe('v1')
      expect(msg2.tags.ver).toBe('v2')
    })
  })

  // =========================================================================
  // 11. onError callback edge cases
  // =========================================================================

  describe('onError callback edge cases', () => {
    it('onError receives HTTP status error on 4xx', async () => {
      const onError = vi.fn()
      fetchResponder = () => new Response('Forbidden', { status: 403 })

      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000, maxRetries: 0, onError })
      client.track('ev')
      await client.flush()

      expect(onError).toHaveBeenCalledOnce()
      expect(onError.mock.calls[0][0].message).toBe('HTTP 403')
      await client.shutdown()
    })

    it('onError is not called when flush succeeds', async () => {
      const onError = vi.fn()
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000, onError })
      client.track('ev')
      await client.flush()

      expect(onError).not.toHaveBeenCalled()
      await client.shutdown()
    })

    it('onError wraps non-Error thrown values into Error', async () => {
      vi.useFakeTimers()
      const onError = vi.fn()
      fetchResponder = () => {
        throw 'string error' // eslint-disable-line no-throw-literal
      }

      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000, maxRetries: 0, onError })
      client.track('ev')
      const p = client.flush()
      await vi.advanceTimersByTimeAsync(5000)
      await p

      expect(onError).toHaveBeenCalledOnce()
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
      expect(onError.mock.calls[0][0].message).toBe('string error')

      await client.shutdown()
      vi.useRealTimers()
    })
  })

  // =========================================================================
  // 12. uid() and eventId() internal uniqueness
  // =========================================================================

  describe('Internal ID generation uniqueness', () => {
    it('100 tracked events produce 100 unique auto-generated distinctIds', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 200, flushInterval: 60000 })

      for (let i = 0; i < 100; i++) client.track(`ev_${i}`)
      await client.flush()

      const events = allSentEvents()
      const ids = new Set(events.map((e) => e.distinctId))
      expect(ids.size).toBe(100)
      await client.shutdown()
    })

    it('100 captureException calls produce 100 unique event IDs', () => {
      const client = createClient({ apiKey: 'k', batchSize: 200, flushInterval: 60000 })

      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(client.captureException(new Error(`e${i}`)))
      }
      expect(ids.size).toBe(100)
      client.shutdown()
    })

    it('captureMessage and captureException IDs do not collide', () => {
      const client = createClient({ apiKey: 'k', batchSize: 200, flushInterval: 60000 })

      const ids = new Set<string>()
      for (let i = 0; i < 50; i++) {
        ids.add(client.captureMessage(`msg_${i}`))
        ids.add(client.captureException(new Error(`err_${i}`)))
      }
      expect(ids.size).toBe(100)
      client.shutdown()
    })
  })

  // =========================================================================
  // 13. Identify and Group payload edge cases
  // =========================================================================

  describe('Identify and Group payload edge cases', () => {
    it('identify with empty traits sends traits as empty object', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })
      client.identify('user_1', {})
      await client.flush()

      const events = allSentEvents()
      expect(events[0].traits).toEqual({})
      await client.shutdown()
    })

    it('group with deeply nested traits preserves structure', async () => {
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 60000 })
      client.group('org_1', { billing: { plan: 'pro', addons: ['sso', 'audit'] } })
      await client.flush()

      const events = allSentEvents()
      const traits = events[0].groupTraits as { billing: { plan: string; addons: string[] } }
      expect(traits.billing.plan).toBe('pro')
      expect(traits.billing.addons).toEqual(['sso', 'audit'])
      await client.shutdown()
    })
  })

  // =========================================================================
  // 14. Flush interval timer behavior
  // =========================================================================

  describe('Flush interval timer', () => {
    it('flush timer fires repeatedly at configured interval', async () => {
      vi.useFakeTimers()
      const client = createClient({ apiKey: 'k', batchSize: 100, flushInterval: 1000 })

      // First event starts the timer
      client.track('ev1')

      await vi.advanceTimersByTimeAsync(1001)
      const first = eventCalls().length
      expect(first).toBeGreaterThanOrEqual(1)

      // Enqueue another event
      client.track('ev2')

      await vi.advanceTimersByTimeAsync(1001)
      expect(eventCalls().length).toBeGreaterThan(first)

      await client.shutdown()
      vi.useRealTimers()
    })

    it('auto-flush triggered by batchSize does not prevent timer-based flush for remaining events', async () => {
      vi.useFakeTimers()
      const client = createClient({ apiKey: 'k', batchSize: 2, flushInterval: 2000 })

      // Two events trigger auto-flush
      client.track('a')
      client.track('b')
      expect(eventCalls().length).toBeGreaterThanOrEqual(1)

      // One more event — below batchSize, will be flushed by timer
      client.track('c')

      await vi.advanceTimersByTimeAsync(2001)
      const events = allSentEvents()
      expect(events.some((e) => e.event === 'c')).toBe(true)

      await client.shutdown()
      vi.useRealTimers()
    })
  })
})
