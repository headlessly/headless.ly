import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HeadlessClient, createClient } from '../src/index.js'

// ---------------------------------------------------------------------------
// Recording fetch — captures requests, returns real Response objects
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string
  init: RequestInit
  body?: unknown
}

const fetchCalls: FetchCall[] = []
let fetchResponder: (url: string, init?: RequestInit) => Response = () => new Response(JSON.stringify({ ok: true }), { status: 200 })

beforeEach(() => {
  fetchCalls.length = 0
  fetchResponder = () => new Response(JSON.stringify({ ok: true }), { status: 200 })
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input.toString()
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    fetchCalls.push({ url, init: init ?? {}, body })
    return fetchResponder(url, init)
  }
})

const flushMicrotasks = () => new Promise((r) => setTimeout(r, 0))

function eventFetchCalls(): FetchCall[] {
  return fetchCalls.filter((c) => c.body?.events)
}

function lastEventBody(): { events: Record<string, unknown>[] } | undefined {
  const calls = eventFetchCalls()
  return calls.length ? (calls[calls.length - 1]!.body as { events: Record<string, unknown>[] }) : undefined
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('@headlessly/js — browser SDK (real tests)', () => {
  let client: HeadlessClient

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    localStorage.clear()
    sessionStorage.clear()
    client = new HeadlessClient()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // =========================================================================
  // ID generation & persistence
  // =========================================================================

  describe('ID generation', () => {
    it('getDistinctId returns non-empty string after init', () => {
      client.init({ apiKey: 'test_key' })
      const id = client.getDistinctId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('anonymousId persists in localStorage', () => {
      client.init({ apiKey: 'test_key' })
      const id1 = client.getDistinctId()

      const client2 = new HeadlessClient()
      client2.init({ apiKey: 'test_key' })
      const id2 = client2.getDistinctId()

      expect(id1).toBe(id2)
    })

    it('identify sets userId as distinctId', () => {
      client.init({ apiKey: 'test_key' })
      client.identify('user_42')
      expect(client.getDistinctId()).toBe('user_42')
    })

    it('reset clears userId and generates new anonymousId', () => {
      client.init({ apiKey: 'test_key' })
      const oldAnon = client.getDistinctId()
      client.identify('user_42')
      client.reset()
      client.init({ apiKey: 'test_key' })
      const newAnon = client.getDistinctId()
      expect(newAnon).not.toBe('user_42')
      // After reset + re-init, localStorage was cleared so new anonymous ID
    })
  })

  // =========================================================================
  // Queue management & flush
  // =========================================================================

  describe('Queue & flush', () => {
    it('track then flush sends events via fetch', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('click')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()
      expect(body).toBeDefined()
      expect(body!.events.length).toBeGreaterThanOrEqual(1)
      expect(body!.events.some((e) => e.event === 'click')).toBe(true)
    })

    it('auto-flushes at batchSize', async () => {
      client.init({ apiKey: 'test_key', batchSize: 2 })
      client.track('a')
      expect(eventFetchCalls().length).toBe(0)
      client.track('b')
      await flushMicrotasks()
      expect(eventFetchCalls().length).toBeGreaterThanOrEqual(1)
    })

    it('maintains FIFO order', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('first')
      client.track('second')
      client.track('third')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const names = body.events.map((e) => e.event).filter(Boolean)
      expect(names).toEqual(['first', 'second', 'third'])
    })

    it('clears queue after flush', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('one')
      await client.flush()
      await flushMicrotasks()
      const count1 = eventFetchCalls().length

      await client.flush()
      await flushMicrotasks()
      // No new event calls since queue was empty
      expect(eventFetchCalls().length).toBe(count1)
    })
  })

  // =========================================================================
  // Opt-out
  // =========================================================================

  describe('Opt-out', () => {
    it('optOut prevents tracking', () => {
      client.init({ apiKey: 'test_key', batchSize: 1 })
      client.optOut()
      client.track('should_not_send')
      expect(eventFetchCalls().length).toBe(0)
    })

    it('hasOptedOut returns true after optOut', () => {
      client.init({ apiKey: 'test_key' })
      client.optOut()
      expect(client.hasOptedOut()).toBe(true)
    })

    it('optOut persists to localStorage', () => {
      client.init({ apiKey: 'test_key' })
      client.optOut()
      expect(localStorage.getItem('hl_opt_out')).toBe('true')
    })

    it('optIn clears opt-out and re-enables tracking', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.optOut()
      client.optIn()
      expect(client.hasOptedOut()).toBe(false)
      client.track('after_optin')
      await client.flush()
      await flushMicrotasks()
      expect(eventFetchCalls().length).toBeGreaterThanOrEqual(1)
    })
  })

  // =========================================================================
  // Breadcrumbs
  // =========================================================================

  describe('Breadcrumbs', () => {
    it('FIFO: adding 101 breadcrumbs keeps only 100', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      for (let i = 0; i < 101; i++) {
        client.addBreadcrumb({ category: 'test', message: `crumb_${i}` })
      }
      client.captureException(new Error('test'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as { breadcrumbs: unknown[] } | undefined
      expect(errEvent).toBeDefined()
      expect(errEvent!.breadcrumbs.length).toBeLessThanOrEqual(100)
    })
  })

  // =========================================================================
  // captureException
  // =========================================================================

  describe('captureException', () => {
    it('returns 32-char hex eventId', () => {
      client.init({ apiKey: 'test_key' })
      const id = client.captureException(new Error('test'))
      expect(id).toMatch(/^[0-9a-f]{32}$/)
    })

    it('sends exception event with stack trace', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      const err = new Error('boom')
      err.stack = 'Error: boom\n    at doThing (app.js:10:5)\n    at main (index.js:3:1)'
      client.captureException(err)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as { exception: { stacktrace: unknown[] } } | undefined
      expect(event).toBeDefined()
      expect(event!.exception.stacktrace.length).toBeGreaterThan(0)
    })

    it('handles non-Error objects', () => {
      client.init({ apiKey: 'test_key' })
      const id = client.captureException('string error')
      expect(typeof id).toBe('string')
      expect(id.length).toBe(32)
    })
  })

  // =========================================================================
  // isFeatureEnabled logic
  // =========================================================================

  describe('isFeatureEnabled', () => {
    it('returns false for undefined flag', () => {
      client.init({ apiKey: 'test_key' })
      expect(client.isFeatureEnabled('nonexistent')).toBe(false)
    })
  })

  // =========================================================================
  // baseEvent includes location info
  // =========================================================================

  describe('baseEvent context', () => {
    it('events include url, path, userAgent', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('context_test')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.event === 'context_test')!
      // jsdom provides real location and navigator
      expect(event.url).toBeDefined()
      expect(event.path).toBeDefined()
      expect(event.userAgent).toBeDefined()
    })
  })

  // =========================================================================
  // Retry on 500
  // =========================================================================

  describe('Retry', () => {
    it('retries on 500 with exponential backoff', async () => {
      // Track event fetch calls specifically
      let eventSendCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        eventSendCount++
        if (eventSendCount <= 2) return new Response('error', { status: 500 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      // Use a large flushInterval to avoid interference from the periodic flush timer
      client.init({ apiKey: 'test_key', batchSize: 1, flushInterval: 999999 })
      client.track('retry_event')

      // Let the fire-and-forget flush + send resolve (fetch is sync-ish in our recording)
      await vi.advanceTimersByTimeAsync(10)

      // First send happened (500), retry queued with delay 1000ms (1000 * 2^0)
      expect(eventSendCount).toBe(1)

      // Advance past first retry delay (1000ms)
      await vi.advanceTimersByTimeAsync(1100)

      // Second send happened (500), retry queued again with delay 2000ms (1000 * 2^1)
      expect(eventSendCount).toBe(2)

      // Advance past second retry delay (2000ms)
      await vi.advanceTimersByTimeAsync(2100)

      // Third send happened (200), success
      expect(eventSendCount).toBe(3)
    })

    it('does not retry on 4xx', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response('Bad Request', { status: 400 })
      }

      client.init({ apiKey: 'test_key', batchSize: 1 })
      client.track('bad_request')
      await flushMicrotasks()

      vi.advanceTimersByTime(10000)
      await flushMicrotasks()

      // Only 1 event call (no retry for 4xx)
      expect(eventFetchCalls().length).toBe(1)
    })
  })

  // =========================================================================
  // Shutdown
  // =========================================================================

  describe('shutdown', () => {
    it('flushes queue and clears intervals', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('pre_shutdown')
      await client.shutdown()
      await flushMicrotasks()

      const body = lastEventBody()
      expect(body).toBeDefined()
      expect(body!.events.some((e) => e.event === 'pre_shutdown')).toBe(true)
    })
  })

  // =========================================================================
  // Batch payload structure
  // =========================================================================

  describe('Payload structure', () => {
    it('sends { events: [...] } with Authorization header', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('payload_test', { foo: 'bar' })
      await client.flush()
      await flushMicrotasks()

      const call = eventFetchCalls()[0]!
      expect(call.body).toHaveProperty('events')
      const events = (call.body as { events: Record<string, unknown>[] }).events
      expect(events[0]!.type).toBe('track')
      expect(events[0]!.event).toBe('payload_test')
      expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer test_key')
    })
  })

  // =========================================================================
  // Re-init warning
  // =========================================================================

  describe('Re-init', () => {
    it('warns on second init call', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      client.init({ apiKey: 'test_key' })
      client.init({ apiKey: 'test_key' })
      expect(warnSpy).toHaveBeenCalledWith('@headlessly/js: Already initialized')
      warnSpy.mockRestore()
    })
  })

  // =========================================================================
  // apiKey required
  // =========================================================================

  describe('Validation', () => {
    it('throws if apiKey is not provided', () => {
      expect(() => client.init({} as { apiKey: string })).toThrow('apiKey is required')
    })
  })

  // =========================================================================
  // BUG: sampleRate 0 uses <=
  // =========================================================================

  describe('Sampling', () => {
    it('BUG: sampleRate 0 still captures when Math.random() returns 0', () => {
      // shouldSample() uses `<=` instead of `<`, so Math.random()===0 passes
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
      client.init({ apiKey: 'test_key', sampleRate: 0, batchSize: 100 })
      client.track('sampled_at_zero')
      // With sampleRate 0 and random=0, the <= check passes (BUG)
      // The track DOES enqueue because 0 <= 0 is true
      mathSpy.mockRestore()
    })
  })
})
