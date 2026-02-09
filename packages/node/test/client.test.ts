import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HeadlessNodeClient, createClient, Headlessly, expressMiddleware, honoMiddleware } from '../src/index.js'

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

function eventFetchCalls(): FetchCall[] {
  return fetchCalls.filter((c) => c.body?.events && !c.url.includes('/flags'))
}

function flagFetchCalls(): FetchCall[] {
  return fetchCalls.filter((c) => c.url.includes('/flags'))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('@headlessly/node — real tests', () => {
  // =========================================================================
  // Client creation
  // =========================================================================

  describe('Client creation', () => {
    it('createClient returns HeadlessNodeClient instance', () => {
      const client = createClient({ apiKey: 'test_key' })
      expect(client).toBeInstanceOf(HeadlessNodeClient)
      client.shutdown()
    })

    it('stores apiKey and default endpoint', () => {
      const client = createClient({ apiKey: 'test_key' })
      expect(client.apiKey).toBe('test_key')
      expect(client.endpoint).toBe('https://headless.ly/e')
      client.shutdown()
    })

    it('uses custom endpoint', () => {
      const client = createClient({ apiKey: 'test_key', endpoint: 'https://custom.example.com' })
      expect(client.endpoint).toBe('https://custom.example.com')
      client.shutdown()
    })
  })

  // =========================================================================
  // Queue management
  // =========================================================================

  describe('Queue', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('queueSize tracks events', () => {
      expect(client.queueSize).toBe(0)
      client.track('a')
      expect(client.queueSize).toBe(1)
      client.track('b')
      expect(client.queueSize).toBe(2)
    })

    it('auto-flushes at batchSize', () => {
      const small = createClient({ apiKey: 'test_key', batchSize: 2, flushInterval: 60000 })
      small.track('a')
      small.track('b')
      // Should have auto-flushed
      expect(eventFetchCalls().length).toBeGreaterThanOrEqual(1)
      small.shutdown()
    })
  })

  // =========================================================================
  // Track payload
  // =========================================================================

  describe('Track', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('sends track event with correct structure', async () => {
      client.track('page_view', { path: '/home' })
      await client.flush()

      const call = eventFetchCalls()[0]!
      const events = (call.body as { events: Record<string, unknown>[] }).events
      expect(events[0]!.type).toBe('track')
      expect(events[0]!.event).toBe('page_view')
      expect(events[0]!.properties).toEqual({ path: '/home' })
      expect(events[0]!.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('sends Authorization header', async () => {
      client.track('auth_test')
      await client.flush()

      const call = eventFetchCalls()[0]!
      expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer test_key')
    })

    it('accepts optional distinctId', async () => {
      client.track('signup', { plan: 'pro' }, 'user_fX9bL5nRd')
      await client.flush()

      const events = (eventFetchCalls()[0]!.body as { events: Record<string, unknown>[] }).events
      expect(events[0]!.distinctId).toBe('user_fX9bL5nRd')
    })
  })

  // =========================================================================
  // Identify payload
  // =========================================================================

  describe('Identify', () => {
    it('sends identify event with userId and traits', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.identify('user_fX9bL5nRd', { email: 'alice@acme.co' })
      await client.flush()

      const events = (eventFetchCalls()[0]!.body as { events: Record<string, unknown>[] }).events
      expect(events[0]!.type).toBe('identify')
      expect(events[0]!.userId).toBe('user_fX9bL5nRd')
      expect(events[0]!.traits).toEqual({ email: 'alice@acme.co' })
      await client.shutdown()
    })
  })

  // =========================================================================
  // captureException
  // =========================================================================

  describe('captureException', () => {
    it('returns 32-char hex eventId', () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      const id = client.captureException(new Error('test'))
      expect(id).toMatch(/^[0-9a-f]{32}$/)
      client.shutdown()
    })

    it('sends exception event with parsed stack trace', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      const err = new Error('real error')
      client.captureException(err)
      await client.flush()

      const events = (eventFetchCalls()[0]!.body as { events: Record<string, unknown>[] }).events
      const exEvent = events[0] as { exception: { type: string; value: string; stacktrace?: unknown[] } }
      expect(exEvent.exception.type).toBe('Error')
      expect(exEvent.exception.value).toBe('real error')
      // Real error has a real stack trace
      expect(exEvent.exception.stacktrace).toBeDefined()
      await client.shutdown()
    })

    it('includes tags set via setTag', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.setTag('env', 'test')
      client.captureException(new Error('tagged'))
      await client.flush()

      const events = (eventFetchCalls()[0]!.body as { events: Record<string, unknown>[] }).events
      expect((events[0] as { tags: Record<string, string> }).tags.env).toBe('test')
      await client.shutdown()
    })
  })

  // =========================================================================
  // Feature flags
  // =========================================================================

  describe('Feature flags', () => {
    it('fetches from /flags endpoint', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { 'dark-mode': true } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      const value = await client.getFeatureFlag('dark-mode', 'user_1')
      expect(value).toBe(true)
      expect(flagFetchCalls().length).toBeGreaterThanOrEqual(1)
      await client.shutdown()
    })

    it('caches flag values', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { cached: 'yes' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      await client.getFeatureFlag('cached', 'user_1')
      const before = flagFetchCalls().length
      await client.getFeatureFlag('cached', 'user_1')
      // No new flag fetch — cached
      expect(flagFetchCalls().length).toBe(before)
      await client.shutdown()
    })

    it('isFeatureEnabled returns boolean', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { on: true, off: false, ctrl: 'control' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      expect(await client.isFeatureEnabled('on', 'u1')).toBe(true)
      expect(await client.isFeatureEnabled('off', 'u1')).toBe(false)
      expect(await client.isFeatureEnabled('ctrl', 'u1')).toBe(false)
      await client.shutdown()
    })

    it('returns undefined on network error', async () => {
      fetchResponder = () => {
        throw new Error('DNS failure')
      }

      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      const value = await client.getFeatureFlag('flag', 'u1')
      expect(value).toBeUndefined()
      await client.shutdown()
    })
  })

  // =========================================================================
  // Express middleware
  // =========================================================================

  describe('Express middleware', () => {
    it('calls next and tracks http_request on finish', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      const mw = expressMiddleware(client)

      let finishCb: (() => void) | undefined
      const req = { method: 'GET', url: '/api/contacts', path: '/api/contacts', headers: { 'user-agent': 'TestBot' } }
      const res = {
        statusCode: 200,
        on: (event: string, cb: () => void) => {
          if (event === 'finish') finishCb = cb
        },
      }
      const next = vi.fn()

      mw(req as any, res as any, next)
      expect(next).toHaveBeenCalled()

      finishCb!()
      await client.flush()

      const events = (eventFetchCalls()[0]!.body as { events: Record<string, unknown>[] }).events
      const httpEvent = events.find((e) => e.event === 'http_request') as { properties: Record<string, unknown> }
      expect(httpEvent).toBeDefined()
      expect(httpEvent.properties.method).toBe('GET')
      expect(httpEvent.properties.path).toBe('/api/contacts')
      expect(httpEvent.properties.status).toBe(200)
      expect(httpEvent.properties.userAgent).toBe('TestBot')
      expect(typeof httpEvent.properties.duration).toBe('number')
      await client.shutdown()
    })

    it('captures thrown errors and re-throws', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      const mw = expressMiddleware(client)

      const req = { method: 'GET', url: '/crash', path: '/crash', headers: {} }
      const res = { statusCode: 500, on: vi.fn() }
      const next = () => {
        throw new Error('downstream crash')
      }

      expect(() => mw(req as any, res as any, next)).toThrow('downstream crash')
      await client.flush()

      const events = (eventFetchCalls()[0]!.body as { events: Record<string, unknown>[] }).events
      const exEvent = events.find((e) => e.type === 'exception') as { exception: { value: string } }
      expect(exEvent).toBeDefined()
      expect(exEvent.exception.value).toBe('downstream crash')
      await client.shutdown()
    })
  })

  // =========================================================================
  // Hono middleware
  // =========================================================================

  describe('Hono middleware', () => {
    it('calls next and tracks http_request', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      const mw = honoMiddleware(client)

      const next = vi.fn().mockResolvedValue(undefined)
      const c = {
        req: { method: 'PUT', path: '/api/deals', url: '/api/deals', header: (name: string) => (name === 'user-agent' ? 'HonoBot' : undefined) },
        res: { status: 200 },
      }

      await mw(c as any, next)
      expect(next).toHaveBeenCalled()

      await client.flush()

      const events = (eventFetchCalls()[0]!.body as { events: Record<string, unknown>[] }).events
      const httpEvent = events.find((e) => e.event === 'http_request') as { properties: Record<string, unknown> }
      expect(httpEvent.properties.method).toBe('PUT')
      expect(httpEvent.properties.path).toBe('/api/deals')
      expect(httpEvent.properties.userAgent).toBe('HonoBot')
      await client.shutdown()
    })
  })

  // =========================================================================
  // Shutdown
  // =========================================================================

  describe('Shutdown', () => {
    it('flushes remaining events on shutdown', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.track('pre_shutdown')
      await client.shutdown()

      const events = (eventFetchCalls()[0]!.body as { events: Record<string, unknown>[] }).events
      expect(events.some((e) => e.event === 'pre_shutdown')).toBe(true)
    })

    it('is idempotent', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.track('event')
      await client.shutdown()
      const count = eventFetchCalls().length
      await client.shutdown()
      await client.shutdown()
      expect(eventFetchCalls().length).toBe(count)
    })
  })

  // =========================================================================
  // Retry
  // =========================================================================

  describe('Retry', () => {
    it('retries on 500 with backoff', async () => {
      vi.useFakeTimers()
      let attempt = 0
      fetchResponder = () => {
        attempt++
        if (attempt <= 2) return new Response('error', { status: 500 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000, maxRetries: 3 })
      client.track('retry_event')
      const flushPromise = client.flush()

      // Advance past backoff delays
      await vi.advanceTimersByTimeAsync(10000)
      await flushPromise

      expect(eventFetchCalls().length).toBeGreaterThanOrEqual(3)
      await client.shutdown()
      vi.useRealTimers()
    })

    it('does not retry on 4xx', async () => {
      vi.useFakeTimers()
      fetchResponder = () => new Response('Bad Request', { status: 400 })
      const onError = vi.fn()
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000, maxRetries: 3, onError })
      client.track('bad')
      const flushPromise = client.flush()
      await vi.advanceTimersByTimeAsync(10000)
      await flushPromise

      expect(eventFetchCalls().length).toBe(1)
      expect(onError).toHaveBeenCalled()
      await client.shutdown()
      vi.useRealTimers()
    })
  })

  // =========================================================================
  // maxQueueSize overflow
  // =========================================================================

  describe('Queue overflow', () => {
    it('drops oldest events when queue exceeds maxQueueSize', () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000, maxQueueSize: 5 })
      for (let i = 0; i < 10; i++) client.track(`event_${i}`)
      expect(client.queueSize).toBeLessThanOrEqual(5)
      client.shutdown()
    })
  })
})
