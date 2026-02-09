import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Browser global mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
vi.stubGlobal('fetch', mockFetch)

const mockSendBeacon = vi.fn().mockReturnValue(true)
vi.stubGlobal('navigator', {
  sendBeacon: mockSendBeacon,
  userAgent: 'test-agent',
  doNotTrack: null,
})

const localStore: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((k: string) => localStore[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { localStore[k] = v }),
  removeItem: vi.fn((k: string) => { delete localStore[k] }),
})

const sessionStore: Record<string, string> = {}
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn((k: string) => sessionStore[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { sessionStore[k] = v }),
  removeItem: vi.fn((k: string) => { delete sessionStore[k] }),
})

vi.stubGlobal('location', {
  href: 'https://example.com/page?q=1',
  pathname: '/page',
  search: '?q=1',
  hash: '',
  origin: 'https://example.com',
})

vi.stubGlobal('document', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  visibilityState: 'visible',
  referrer: 'https://google.com',
  title: 'Test Page',
  cookie: '',
})

vi.stubGlobal('window', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  location: { href: 'https://example.com/page?q=1', pathname: '/page' },
  navigator: { userAgent: 'test-agent', doNotTrack: null },
  PerformanceObserver: undefined,
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const flushPromises = () => new Promise((r) => setTimeout(r, 0))

const getLastFetchBody = (): Record<string, unknown> => {
  const calls = mockFetch.mock.calls
  if (!calls.length) return {}
  const last = calls[calls.length - 1]
  const body = last[1]?.body
  return body ? JSON.parse(body as string) : {}
}

const getAllFetchBodies = (): Record<string, unknown>[] => {
  return mockFetch.mock.calls
    .filter((c: unknown[]) => c[1]?.body)
    .map((c: unknown[]) => JSON.parse(c[1].body as string))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('@headlessly/js — browser SDK (RED)', () => {
  let mod: typeof import('../src/index')

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    Object.keys(localStore).forEach((k) => delete localStore[k])
    Object.keys(sessionStore).forEach((k) => delete sessionStore[k])
    // Dynamic import to get fresh module reference
    mod = await import('../src/index')
    mod.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // =========================================================================
  // 1. Initialization
  // =========================================================================

  describe('Initialization', () => {
    it('createClient returns a HeadlessClient instance', () => {
      // createClient is a factory function that returns an independent client
      const { createClient } = mod as unknown as { createClient: (cfg: { apiKey: string }) => unknown }
      expect(typeof createClient).toBe('function')
      const client = createClient({ apiKey: 'hl_test_123' })
      expect(client).toBeDefined()
      expect(client).toHaveProperty('track')
      expect(client).toHaveProperty('page')
    })

    it('defaults endpoint to https://headless.ly/e', () => {
      mod.init({ apiKey: 'hl_test_123' })
      mod.track('test_event')
      mod.flush()
      expect(mockFetch).toHaveBeenCalledWith(
        'https://headless.ly/e',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('uses custom endpoint when provided', () => {
      mod.init({ apiKey: 'hl_test_123', endpoint: 'https://custom.example.com/events' })
      mod.track('test_event')
      mod.flush()
      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.example.com/events',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('throws if apiKey is not provided', () => {
      expect(() => mod.init({} as { apiKey: string })).toThrow()
    })

    it('creates independent instances via createClient', () => {
      // Two separate clients should not share state
      const { createClient } = mod as unknown as { createClient: (cfg: { apiKey: string }) => { track: (e: string) => void; flush: () => Promise<void> } }
      const client1 = createClient({ apiKey: 'hl_key_1' })
      const client2 = createClient({ apiKey: 'hl_key_2' })
      client1.track('event_from_1')
      client2.track('event_from_2')
      // They should maintain separate queues
      expect(client1).not.toBe(client2)
    })
  })

  // =========================================================================
  // 2. page() tracking
  // =========================================================================

  describe('page() tracking', () => {
    beforeEach(() => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 1 })
    })

    it('sends a pageview event with type "page"', async () => {
      mod.page()
      await flushPromises()
      const body = getLastFetchBody()
      expect(body.events).toBeDefined()
      const events = body.events as { type: string }[]
      expect(events[0].type).toBe('page')
    })

    it('includes current URL from window.location', async () => {
      mod.page()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { url: string }[]
      expect(events[0].url).toBe('https://example.com/page?q=1')
    })

    it('includes document.referrer', async () => {
      mod.page()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { referrer: string }[]
      expect(events[0].referrer).toBe('https://google.com')
    })

    it('includes document.title', async () => {
      mod.page()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { title: string }[]
      expect(events[0].title).toBe('Test Page')
    })

    it('includes an ISO timestamp', async () => {
      mod.page()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { ts: string }[]
      expect(events[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('includes custom properties when provided', async () => {
      mod.page('Dashboard', { section: 'analytics', tab: 'overview' })
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { properties: Record<string, unknown>; event: string }[]
      expect(events[0].event).toBe('Dashboard')
      expect(events[0].properties).toEqual(
        expect.objectContaining({ section: 'analytics', tab: 'overview' }),
      )
    })
  })

  // =========================================================================
  // 3. track() events
  // =========================================================================

  describe('track() events', () => {
    beforeEach(() => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 100 })
    })

    it('sends a custom event with the given name', async () => {
      mod.track('signup_completed')
      await mod.flush()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { type: string; event: string }[]
      expect(events[0].type).toBe('track')
      expect(events[0].event).toBe('signup_completed')
    })

    it('includes properties in the event payload', async () => {
      mod.track('button_click', { buttonId: 'cta', variant: 'blue' })
      await mod.flush()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { properties: Record<string, unknown> }[]
      expect(events[0].properties).toEqual(
        expect.objectContaining({ buttonId: 'cta', variant: 'blue' }),
      )
    })

    it('includes a timestamp in ISO format', async () => {
      mod.track('test')
      await mod.flush()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { ts: string }[]
      expect(events[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('includes distinctId derived from userId when identified', async () => {
      mod.identify('user_abc')
      mod.track('after_identify')
      await mod.flush()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { distinctId: string; userId: string }[]
      const trackEvent = events.find((e: { event?: string }) => (e as { event?: string }).event === 'after_identify')
      expect(trackEvent?.distinctId ?? trackEvent?.userId).toBe('user_abc')
    })

    it('auto-generates an anonymousId', async () => {
      mod.track('anon_event')
      await mod.flush()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { anonymousId: string }[]
      expect(events[0].anonymousId).toBeDefined()
      expect(typeof events[0].anonymousId).toBe('string')
      expect(events[0].anonymousId.length).toBeGreaterThan(0)
    })

    it('persists anonymousId across track calls', async () => {
      mod.track('first')
      mod.track('second')
      await mod.flush()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { anonymousId: string }[]
      expect(events[0].anonymousId).toBe(events[1].anonymousId)
    })

    it('does not flush immediately when queue is below batchSize', () => {
      // batchSize is 100 in this describe block
      mod.track('queued_event')
      // fetch should not have been called for this event (only init flag fetch)
      const trackCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => c[1]?.body && JSON.parse(c[1].body as string).events,
      )
      expect(trackCalls.length).toBe(0)
    })

    it('includes the apiKey in the Authorization header', async () => {
      mod.track('auth_test')
      await mod.flush()
      await flushPromises()
      const call = mockFetch.mock.calls.find(
        (c: unknown[]) => c[1]?.body && JSON.parse(c[1].body as string).events,
      )
      expect(call).toBeDefined()
      expect(call![1].headers).toEqual(
        expect.objectContaining({ Authorization: 'Bearer hl_test_123' }),
      )
    })
  })

  // =========================================================================
  // 4. identify()
  // =========================================================================

  describe('identify()', () => {
    beforeEach(() => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 1 })
    })

    it('sends an identify event', async () => {
      mod.identify('user_42')
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { type: string }[]
      expect(events[0].type).toBe('identify')
    })

    it('includes userId and traits', async () => {
      mod.identify('user_42', { email: 'bob@test.com', plan: 'pro' })
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { userId: string; traits: Record<string, unknown> }[]
      expect(events[0].userId).toBe('user_42')
      expect(events[0].traits).toEqual(
        expect.objectContaining({ email: 'bob@test.com', plan: 'pro' }),
      )
    })

    it('sets userId for all subsequent track calls', async () => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 100 })
      mod.identify('user_42')
      mod.track('post_identify')
      await mod.flush()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { userId: string; event?: string }[]
      const trackEvent = events.find((e) => e.event === 'post_identify')
      expect(trackEvent?.userId).toBe('user_42')
    })

    it('merges traits from multiple identify calls', async () => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 100 })
      mod.identify('user_42', { email: 'bob@test.com' })
      mod.identify('user_42', { plan: 'enterprise' })
      // The merged user object should have both traits
      const instance = mod.getInstance()
      const user = (instance as unknown as { user: { email?: string; plan?: string } }).user
      expect(user).toEqual(
        expect.objectContaining({ email: 'bob@test.com', plan: 'enterprise' }),
      )
    })

    it('works without traits parameter', async () => {
      mod.identify('user_42')
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { userId: string; traits?: unknown }[]
      expect(events[0].userId).toBe('user_42')
    })
  })

  // =========================================================================
  // 5. captureException()
  // =========================================================================

  describe('captureException()', () => {
    beforeEach(() => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 1 })
    })

    it('sends an error event with type "exception"', async () => {
      mod.captureException(new Error('boom'))
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { type: string }[]
      expect(events[0].type).toBe('exception')
    })

    it('includes error name and message', async () => {
      const err = new TypeError('bad input')
      mod.captureException(err)
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { exception: { type: string; value: string } }[]
      expect(events[0].exception.type).toBe('TypeError')
      expect(events[0].exception.value).toBe('bad input')
    })

    it('includes stack trace when available', async () => {
      const err = new Error('with stack')
      err.stack = 'Error: with stack\n    at doThing (app.js:10:5)\n    at main (index.js:3:1)'
      mod.captureException(err)
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { exception: { stacktrace: unknown[] } }[]
      expect(events[0].exception.stacktrace).toBeDefined()
      expect(events[0].exception.stacktrace.length).toBeGreaterThan(0)
    })

    it('includes breadcrumbs accumulated before the error', async () => {
      mod.addBreadcrumb({ category: 'ui', message: 'clicked button' })
      mod.addBreadcrumb({ category: 'http', message: 'GET /api/data' })
      mod.captureException(new Error('after breadcrumbs'))
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { breadcrumbs: { message: string }[] }[]
      expect(events[0].breadcrumbs.length).toBeGreaterThanOrEqual(2)
      expect(events[0].breadcrumbs.some((b) => b.message === 'clicked button')).toBe(true)
    })

    it('supports severity levels via captureMessage', async () => {
      mod.captureMessage('warning message', 'warning')
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { level: string }[]
      expect(events[0].level).toBe('warning')
    })

    it('handles non-Error objects passed to captureException', async () => {
      // Passing a string/object instead of an Error should still work
      const captureAny = mod.captureException as (err: unknown) => string
      const result = captureAny('string error')
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { exception: { value: string } }[]
      expect(events[0].exception.value).toContain('string error')
      expect(typeof result).toBe('string')
    })

    it('captures unhandled promise rejections automatically', async () => {
      mod.init({ apiKey: 'hl_test_123', captureErrors: true, batchSize: 1 })
      // Simulate an unhandledrejection event
      const handler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => c[0] === 'unhandledrejection',
      )
      expect(handler).toBeDefined()
      // The handler callback should be registered
      expect(typeof handler![1]).toBe('function')
    })
  })

  // =========================================================================
  // 6. Batch queue
  // =========================================================================

  describe('Batch queue', () => {
    it('batches multiple events into a single request', async () => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 5 })
      mod.track('e1')
      mod.track('e2')
      mod.track('e3')
      await mod.flush()
      await flushPromises()
      const bodies = getAllFetchBodies()
      const batchBody = bodies.find((b) => (b.events as unknown[])?.length >= 3)
      expect(batchBody).toBeDefined()
      expect((batchBody!.events as unknown[]).length).toBeGreaterThanOrEqual(3)
    })

    it('auto-flushes when batchSize is reached', async () => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 3 })
      mockFetch.mockClear()
      mod.track('a')
      mod.track('b')
      mod.track('c') // should trigger auto-flush at 3
      await flushPromises()
      const eventCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => c[1]?.body && JSON.parse(c[1].body as string).events,
      )
      expect(eventCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('auto-flushes at the configured interval', async () => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 100, flushInterval: 2000 })
      mockFetch.mockClear()
      mod.track('interval_event')
      // No immediate flush (batchSize=100)
      expect(mockFetch.mock.calls.filter(
        (c: unknown[]) => c[1]?.body && JSON.parse(c[1].body as string).events,
      ).length).toBe(0)
      // Advance past the flush interval
      vi.advanceTimersByTime(2500)
      await flushPromises()
      const eventCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => c[1]?.body && JSON.parse(c[1].body as string).events,
      )
      expect(eventCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('flush() sends all queued events immediately', async () => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 100 })
      mod.track('manual_flush')
      mockFetch.mockClear()
      await mod.flush()
      await flushPromises()
      const eventCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => c[1]?.body && JSON.parse(c[1].body as string).events,
      )
      expect(eventCalls.length).toBe(1)
    })

    it('maintains FIFO order of events', async () => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 100 })
      mod.track('first')
      mod.track('second')
      mod.track('third')
      await mod.flush()
      await flushPromises()
      const body = getLastFetchBody()
      const events = body.events as { event: string }[]
      const names = events.map((e) => e.event).filter(Boolean)
      expect(names).toEqual(['first', 'second', 'third'])
    })

    it('clears the queue after a successful flush', async () => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 100 })
      mod.track('cleared')
      await mod.flush()
      await flushPromises()
      mockFetch.mockClear()
      // Second flush should send nothing
      await mod.flush()
      await flushPromises()
      const eventCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => c[1]?.body && JSON.parse(c[1].body as string).events,
      )
      expect(eventCalls.length).toBe(0)
    })
  })

  // =========================================================================
  // 7. Network resilience
  // =========================================================================

  describe('Network resilience', () => {
    beforeEach(() => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 1 })
    })

    it('retries on network failure', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ flags: {} }), { status: 200 })) // init flags
        .mockRejectedValueOnce(new Error('network error')) // first attempt
        .mockResolvedValueOnce(new Response('ok', { status: 200 })) // retry
      mod.track('retry_event')
      await flushPromises()
      vi.advanceTimersByTime(5000)
      await flushPromises()
      // Should have attempted more than once
      const eventCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => c[1]?.body && JSON.parse(c[1].body as string).events,
      )
      expect(eventCalls.length).toBeGreaterThanOrEqual(2)
    })

    it('uses exponential backoff between retries', async () => {
      mockFetch.mockRejectedValue(new Error('fail'))
      mod.init({ apiKey: 'hl_test_123', batchSize: 1 })
      mod.track('backoff_event')
      await flushPromises()

      // First retry after ~1s (2^0 * 1000)
      vi.advanceTimersByTime(1000)
      await flushPromises()
      const callsAt1s = mockFetch.mock.calls.length

      // Second retry after ~2s more (2^1 * 1000)
      vi.advanceTimersByTime(2000)
      await flushPromises()
      const callsAt3s = mockFetch.mock.calls.length

      expect(callsAt3s).toBeGreaterThan(callsAt1s)
    })

    it('drops events after maxRetries attempts', async () => {
      const onError = vi.fn()
      mod.init({ apiKey: 'hl_test_123', batchSize: 1, onError } as unknown as Parameters<typeof mod.init>[0])
      mockFetch.mockRejectedValue(new Error('persistent failure'))
      mod.track('doomed_event')
      // Advance through all retries
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(10000)
        await flushPromises()
      }
      expect(onError).toHaveBeenCalled()
    })

    it('does not retry on 4xx client errors', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ flags: {} }), { status: 200 })) // init flags
        .mockResolvedValueOnce(new Response('Bad Request', { status: 400 }))
      mod.track('bad_request_event')
      await flushPromises()
      vi.advanceTimersByTime(10000)
      await flushPromises()
      // Should NOT have retried — only 1 event call
      const eventCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => {
          try {
            return c[1]?.body && JSON.parse(c[1].body as string).events
          } catch { return false }
        },
      )
      // For 4xx, the SDK should NOT retry, so exactly 1 event call
      expect(eventCalls.length).toBe(1)
    })

    it('uses navigator.sendBeacon on page unload', async () => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 100 })
      mod.track('beacon_event')
      // Call flush with beacon=true (simulating pagehide)
      const instance = mod.getInstance()
      await instance.flush(true)
      expect(mockSendBeacon).toHaveBeenCalled()
      const beaconBody = JSON.parse(mockSendBeacon.mock.calls[0][1] as string)
      expect(beaconBody.events).toBeDefined()
    })
  })

  // =========================================================================
  // 8. Feature flags
  // =========================================================================

  describe('Feature flags', () => {
    it('getFeatureFlag fetches flags from the /flags endpoint', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ flags: { 'new-ui': true, 'beta': 'variant-a' } }), { status: 200 }),
      )
      mod.init({ apiKey: 'hl_test_123' })
      await flushPromises()
      // The init should have triggered a POST to /flags
      const flagCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('/flags'),
      )
      expect(flagCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('caches feature flag values after initial fetch', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ flags: { 'cached-flag': 'yes' } }), { status: 200 }),
      )
      mod.init({ apiKey: 'hl_test_123' })
      await flushPromises()
      // Multiple reads should not trigger additional fetches
      const before = mockFetch.mock.calls.length
      mod.getFeatureFlag('cached-flag')
      mod.getFeatureFlag('cached-flag')
      await flushPromises()
      const flagFetchesAfter = mockFetch.mock.calls
        .slice(before)
        .filter((c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('/flags'))
      expect(flagFetchesAfter.length).toBe(0)
    })

    it('respects TTL and re-fetches after expiry', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ flags: { 'ttl-flag': true } }), { status: 200 }),
      )
      mod.init({ apiKey: 'hl_test_123', flagsTTL: 30000 } as unknown as Parameters<typeof mod.init>[0])
      await flushPromises()
      const callsAfterInit = mockFetch.mock.calls.length

      // Advance past the TTL
      vi.advanceTimersByTime(35000)
      mod.getFeatureFlag('ttl-flag')
      await flushPromises()

      // Should have re-fetched flags
      const newFlagCalls = mockFetch.mock.calls
        .slice(callsAfterInit)
        .filter((c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('/flags'))
      expect(newFlagCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('isFeatureEnabled returns boolean for truthy values', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ flags: { 'enabled-flag': true, 'disabled-flag': false } }), { status: 200 }),
      )
      mod.init({ apiKey: 'hl_test_123' })
      await flushPromises()
      expect(mod.isFeatureEnabled('enabled-flag')).toBe(true)
      expect(mod.isFeatureEnabled('disabled-flag')).toBe(false)
    })

    it('onFlagChange registers a callback for flag updates', async () => {
      const callback = vi.fn()
      const onFlagChange = (mod as unknown as { onFlagChange: (key: string, cb: (v: unknown) => void) => void }).onFlagChange
      expect(typeof onFlagChange).toBe('function')

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ flags: { 'watched-flag': 'v1' } }), { status: 200 }),
      )
      mod.init({ apiKey: 'hl_test_123' })
      onFlagChange('watched-flag', callback)
      await flushPromises()

      // Simulate flag change via reload
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ flags: { 'watched-flag': 'v2' } }), { status: 200 }),
      )
      await mod.reloadFeatureFlags()
      await flushPromises()
      expect(callback).toHaveBeenCalledWith('v2')
    })
  })

  // =========================================================================
  // 9. Privacy
  // =========================================================================

  describe('Privacy', () => {
    it('respects navigator.doNotTrack when set to "1"', () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        doNotTrack: '1',
        sendBeacon: vi.fn(),
        userAgent: 'test-agent',
      })
      mod.init({ apiKey: 'hl_test_123', respectDoNotTrack: true } as unknown as Parameters<typeof mod.init>[0])
      mod.track('should_not_track')
      mod.flush()
      const eventCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => {
          try { return c[1]?.body && JSON.parse(c[1].body as string).events } catch { return false }
        },
      )
      expect(eventCalls.length).toBe(0)
      // Restore navigator
      vi.stubGlobal('navigator', {
        sendBeacon: mockSendBeacon,
        userAgent: 'test-agent',
        doNotTrack: null,
      })
    })

    it('optOut disables all tracking', async () => {
      mod.init({ apiKey: 'hl_test_123', batchSize: 1 })
      mod.optOut()
      mockFetch.mockClear()
      mod.track('should_not_track')
      mod.page()
      mod.identify('user_x')
      await mod.flush()
      await flushPromises()
      const eventCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => {
          try { return c[1]?.body && JSON.parse(c[1].body as string).events } catch { return false }
        },
      )
      expect(eventCalls.length).toBe(0)
    })

    it('persists opt-out preference to localStorage', () => {
      mod.init({ apiKey: 'hl_test_123' })
      mod.optOut()
      expect(localStorage.setItem).toHaveBeenCalledWith('hl_opt_out', 'true')
    })

    it('integrates with cookie consent via consentGranted/consentRevoked', () => {
      const instance = mod.getInstance() as unknown as {
        consentGranted: () => void
        consentRevoked: () => void
      }
      expect(typeof instance.consentGranted).toBe('function')
      expect(typeof instance.consentRevoked).toBe('function')

      mod.init({ apiKey: 'hl_test_123' })
      instance.consentRevoked()
      mod.track('no_consent')
      // Should not track after consent is revoked
      const eventCalls = mockFetch.mock.calls.filter(
        (c: unknown[]) => {
          try { return c[1]?.body && JSON.parse(c[1].body as string).events } catch { return false }
        },
      )
      expect(eventCalls.length).toBe(0)
    })
  })

  // =========================================================================
  // 10. SSR safety
  // =========================================================================

  describe('SSR safety', () => {
    it('no errors when window is undefined', async () => {
      const savedWindow = globalThis.window
      vi.stubGlobal('window', undefined)
      const { HeadlessClient } = await import('../src/client')
      const client = new HeadlessClient()
      expect(() => client.init({ apiKey: 'hl_test_123' })).not.toThrow()
      expect(() => client.track('ssr_event')).not.toThrow()
      expect(() => client.page()).not.toThrow()
      vi.stubGlobal('window', savedWindow)
    })

    it('no errors when document is undefined', async () => {
      const savedDocument = globalThis.document
      vi.stubGlobal('document', undefined)
      const { HeadlessClient } = await import('../src/client')
      const client = new HeadlessClient()
      expect(() => client.init({ apiKey: 'hl_test_123' })).not.toThrow()
      expect(() => client.page()).not.toThrow()
      vi.stubGlobal('document', savedDocument)
    })

    it('no errors when navigator is undefined', async () => {
      const savedNavigator = globalThis.navigator
      vi.stubGlobal('navigator', undefined)
      const { HeadlessClient } = await import('../src/client')
      const client = new HeadlessClient()
      expect(() => client.init({ apiKey: 'hl_test_123' })).not.toThrow()
      expect(() => client.track('nav_undefined')).not.toThrow()
      await expect(client.flush(true)).resolves.not.toThrow()
      vi.stubGlobal('navigator', savedNavigator)
    })
  })
})
