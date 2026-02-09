import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// RED TDD tests for @headlessly/node — Node.js server-side SDK
//
// These tests define the DESIRED API surface and behavior. They should ALL
// FAIL initially (Red phase), then drive the implementation (Green phase).
// ---------------------------------------------------------------------------

// Mock fetch globally before any imports
const mockFetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
vi.stubGlobal('fetch', mockFetch)

// Mock process event handlers for shutdown tests
const processOnSpy = vi.spyOn(process, 'on')
const processOnceSpy = vi.spyOn(process, 'once')

import {
  Headlessly,
  createClient,
  HeadlessNodeClient,
  expressMiddleware,
  honoMiddleware,
} from '../src/index'
import type { NodeConfig } from '../src/index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function okResponse(body: unknown = { ok: true }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function flagsResponse(flags: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ flags }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(status = 500): Response {
  return new Response('Internal Server Error', { status })
}

// ---------------------------------------------------------------------------
// 1. Headlessly.init({ apiKey, endpoint })
// ---------------------------------------------------------------------------

describe('Headlessly.init({ apiKey, endpoint })', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue(okResponse())
    Headlessly.reset()
  })

  afterEach(() => {
    Headlessly.reset()
  })

  it('returns a HeadlessNodeClient instance', () => {
    const client = Headlessly.init({ apiKey: 'hly_sk_test123', endpoint: 'https://db.headless.ly' })
    expect(client).toBeInstanceOf(HeadlessNodeClient)
  })

  it('stores the API key on the returned client', () => {
    const client = Headlessly.init({ apiKey: 'hly_sk_test123', endpoint: 'https://db.headless.ly' })
    expect(client.apiKey).toBe('hly_sk_test123')
  })

  it('stores the endpoint on the returned client', () => {
    const client = Headlessly.init({ apiKey: 'hly_sk_test123', endpoint: 'https://db.headless.ly' })
    expect(client.endpoint).toBe('https://db.headless.ly')
  })

  it('defaults endpoint to https://headless.ly/e when omitted', () => {
    const client = Headlessly.init({ apiKey: 'hly_sk_test123' })
    expect(client.endpoint).toBe('https://headless.ly/e')
  })

  it('throws if apiKey is missing', () => {
    expect(() => Headlessly.init({ apiKey: '' })).toThrow(/apiKey/)
  })

  it('returns the same singleton on repeated calls', () => {
    const a = Headlessly.init({ apiKey: 'hly_sk_test123' })
    const b = Headlessly.init({ apiKey: 'hly_sk_test123' })
    expect(a).toBe(b)
  })

  it('registers SIGTERM and SIGINT shutdown hooks', () => {
    Headlessly.init({ apiKey: 'hly_sk_test123' })
    const registeredEvents = processOnceSpy.mock.calls.map(([event]) => event)
    expect(registeredEvents).toContain('SIGTERM')
    expect(registeredEvents).toContain('SIGINT')
  })
})

// ---------------------------------------------------------------------------
// 2. track(event, properties)
// ---------------------------------------------------------------------------

describe('track(event, properties)', () => {
  let client: HeadlessNodeClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue(okResponse())
    client = createClient({ apiKey: 'hly_sk_test123', endpoint: 'https://db.headless.ly', flushInterval: 60000, batchSize: 100 })
  })

  afterEach(async () => {
    await client.shutdown()
  })

  it('enqueues a track event with type "track"', async () => {
    client.track('page_view', { path: '/home' })
    await client.flush()

    expect(mockFetch).toHaveBeenCalledOnce()
    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events).toHaveLength(1)
    expect(body.events[0].type).toBe('track')
    expect(body.events[0].event).toBe('page_view')
  })

  it('includes properties in the event payload', async () => {
    client.track('button_click', { buttonId: 'cta-primary', page: '/pricing' })
    await client.flush()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events[0].properties).toEqual({ buttonId: 'cta-primary', page: '/pricing' })
  })

  it('includes an ISO timestamp', async () => {
    client.track('test_event')
    await client.flush()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('sends Authorization header with Bearer token', async () => {
    client.track('test_event')
    await client.flush()

    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer hly_sk_test123')
  })

  it('sends Content-Type application/json', async () => {
    client.track('test_event')
    await client.flush()

    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('accepts an optional distinctId as the third argument', async () => {
    client.track('signup', { plan: 'pro' }, 'user_fX9bL5nRd')
    await client.flush()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events[0].distinctId).toBe('user_fX9bL5nRd')
  })
})

// ---------------------------------------------------------------------------
// 3. identify(userId, traits)
// ---------------------------------------------------------------------------

describe('identify(userId, traits)', () => {
  let client: HeadlessNodeClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue(okResponse())
    client = createClient({ apiKey: 'hly_sk_test123', endpoint: 'https://db.headless.ly', flushInterval: 60000, batchSize: 100 })
  })

  afterEach(async () => {
    await client.shutdown()
  })

  it('enqueues an identify event with type "identify"', async () => {
    client.identify('user_fX9bL5nRd', { email: 'alice@acme.co', name: 'Alice' })
    await client.flush()

    expect(mockFetch).toHaveBeenCalledOnce()
    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events[0].type).toBe('identify')
    expect(body.events[0].userId).toBe('user_fX9bL5nRd')
  })

  it('includes traits in the event payload', async () => {
    client.identify('user_fX9bL5nRd', { email: 'alice@acme.co', plan: 'enterprise' })
    await client.flush()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events[0].traits).toEqual({ email: 'alice@acme.co', plan: 'enterprise' })
  })

  it('works without traits', async () => {
    client.identify('user_fX9bL5nRd')
    await client.flush()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events[0].userId).toBe('user_fX9bL5nRd')
    expect(body.events[0].traits).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 4. Express middleware
// ---------------------------------------------------------------------------

describe('Express middleware', () => {
  let client: HeadlessNodeClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue(okResponse())
    client = createClient({ apiKey: 'hly_sk_test123', endpoint: 'https://db.headless.ly', flushInterval: 60000, batchSize: 100 })
  })

  afterEach(async () => {
    await client.shutdown()
  })

  it('expressMiddleware is exported as a named function', () => {
    expect(typeof expressMiddleware).toBe('function')
  })

  it('returns a function with arity 3 (req, res, next)', () => {
    const mw = expressMiddleware(client)
    expect(mw.length).toBe(3)
  })

  it('calls next() to pass control downstream', async () => {
    const mw = expressMiddleware(client)
    const req = { method: 'GET', url: '/api/contacts', path: '/api/contacts', headers: {} }
    const res = { statusCode: 200, on: vi.fn() }
    const next = vi.fn()

    mw(req as any, res as any, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('tracks http_request with method, path, status, and duration', async () => {
    const mw = expressMiddleware(client)
    const req = { method: 'POST', url: '/api/deals', path: '/api/deals', headers: {} }
    const finishCallback = vi.fn()
    const res = {
      statusCode: 201,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishCallback.mockImplementation(cb)
      }),
    }
    const next = vi.fn()

    mw(req as any, res as any, next)
    // Simulate response finish
    finishCallback()
    await client.flush()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    const trackEvent = body.events.find((e: any) => e.event === 'http_request')
    expect(trackEvent).toBeDefined()
    expect(trackEvent.properties.method).toBe('POST')
    expect(trackEvent.properties.path).toBe('/api/deals')
    expect(trackEvent.properties.status).toBe(201)
    expect(typeof trackEvent.properties.duration).toBe('number')
  })

  it('captures exceptions thrown in downstream middleware', async () => {
    const mw = expressMiddleware(client)
    const req = { method: 'GET', url: '/api/crash', path: '/api/crash', headers: {} }
    const res = { statusCode: 500, on: vi.fn() }
    const error = new Error('downstream crash')
    const next = vi.fn(() => { throw error })

    expect(() => mw(req as any, res as any, next)).toThrow('downstream crash')

    await client.flush()
    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    const exceptionEvent = body.events.find((e: any) => e.type === 'exception')
    expect(exceptionEvent).toBeDefined()
    expect(exceptionEvent.exception.value).toBe('downstream crash')
  })

  it('extracts user-agent from request headers', async () => {
    const mw = expressMiddleware(client)
    const req = { method: 'GET', url: '/', path: '/', headers: { 'user-agent': 'TestBot/1.0' } }
    const finishCb = vi.fn()
    const res = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') finishCb.mockImplementation(cb)
      }),
    }
    const next = vi.fn()

    mw(req as any, res as any, next)
    finishCb()
    await client.flush()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    const trackEvent = body.events.find((e: any) => e.event === 'http_request')
    expect(trackEvent.properties.userAgent).toBe('TestBot/1.0')
  })
})

// ---------------------------------------------------------------------------
// 5. Hono middleware
// ---------------------------------------------------------------------------

describe('Hono middleware', () => {
  let client: HeadlessNodeClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue(okResponse())
    client = createClient({ apiKey: 'hly_sk_test123', endpoint: 'https://db.headless.ly', flushInterval: 60000, batchSize: 100 })
  })

  afterEach(async () => {
    await client.shutdown()
  })

  it('honoMiddleware is exported as a named function', () => {
    expect(typeof honoMiddleware).toBe('function')
  })

  it('returns an async function compatible with Hono', () => {
    const mw = honoMiddleware(client)
    expect(typeof mw).toBe('function')
  })

  it('calls next() and awaits downstream handlers', async () => {
    const mw = honoMiddleware(client)
    const next = vi.fn().mockResolvedValue(undefined)
    const c = {
      req: {
        method: 'GET',
        path: '/api/contacts',
        url: 'https://db.headless.ly/api/contacts',
        header: vi.fn().mockReturnValue(undefined),
      },
      res: { status: 200 },
    }

    await mw(c as any, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('tracks http_request after response', async () => {
    const mw = honoMiddleware(client)
    const next = vi.fn().mockResolvedValue(undefined)
    const c = {
      req: {
        method: 'PUT',
        path: '/api/deals/deal_k7TmPvQx',
        url: 'https://db.headless.ly/api/deals/deal_k7TmPvQx',
        header: vi.fn().mockReturnValue(undefined),
      },
      res: { status: 200 },
    }

    await mw(c as any, next)
    await client.flush()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    const trackEvent = body.events.find((e: any) => e.event === 'http_request')
    expect(trackEvent).toBeDefined()
    expect(trackEvent.properties.method).toBe('PUT')
    expect(trackEvent.properties.path).toBe('/api/deals/deal_k7TmPvQx')
    expect(trackEvent.properties.status).toBe(200)
    expect(typeof trackEvent.properties.duration).toBe('number')
  })

  it('captures errors thrown in downstream handlers', async () => {
    const mw = honoMiddleware(client)
    const next = vi.fn().mockRejectedValue(new Error('hono crash'))
    const c = {
      req: {
        method: 'DELETE',
        path: '/api/contacts/contact_fX9bL5nRd',
        url: 'https://db.headless.ly/api/contacts/contact_fX9bL5nRd',
        header: vi.fn().mockReturnValue(undefined),
      },
      res: { status: 500 },
    }

    await expect(mw(c as any, next)).rejects.toThrow('hono crash')
    await client.flush()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    const exceptionEvent = body.events.find((e: any) => e.type === 'exception')
    expect(exceptionEvent).toBeDefined()
    expect(exceptionEvent.exception.value).toBe('hono crash')
  })

  it('reads user-agent from Hono context header', async () => {
    const mw = honoMiddleware(client)
    const next = vi.fn().mockResolvedValue(undefined)
    const c = {
      req: {
        method: 'GET',
        path: '/',
        url: 'https://db.headless.ly/',
        header: vi.fn((name: string) => name === 'user-agent' ? 'HonoBot/2.0' : undefined),
      },
      res: { status: 200 },
    }

    await mw(c as any, next)
    await client.flush()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    const trackEvent = body.events.find((e: any) => e.event === 'http_request')
    expect(trackEvent.properties.userAgent).toBe('HonoBot/2.0')
  })
})

// ---------------------------------------------------------------------------
// 6. Batch queue
// ---------------------------------------------------------------------------

describe('Batch queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockFetch.mockResolvedValue(okResponse())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not send events immediately when below batch size', () => {
    const client = createClient({ apiKey: 'hly_sk_test123', batchSize: 10, flushInterval: 60000 })
    client.track('event_1')
    client.track('event_2')

    expect(mockFetch).not.toHaveBeenCalled()
    client.shutdown()
  })

  it('auto-flushes when batch size is reached', () => {
    const client = createClient({ apiKey: 'hly_sk_test123', batchSize: 3, flushInterval: 60000 })
    client.track('event_1')
    client.track('event_2')
    expect(mockFetch).not.toHaveBeenCalled()

    client.track('event_3') // reaches batchSize=3
    expect(mockFetch).toHaveBeenCalledOnce()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events).toHaveLength(3)
    client.shutdown()
  })

  it('auto-flushes at the configured flushInterval', async () => {
    const client = createClient({ apiKey: 'hly_sk_test123', batchSize: 100, flushInterval: 5000 })
    client.track('event_1')
    client.track('event_2')

    expect(mockFetch).not.toHaveBeenCalled()

    // Advance timer past flushInterval
    await vi.advanceTimersByTimeAsync(5001)

    expect(mockFetch).toHaveBeenCalledOnce()
    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events).toHaveLength(2)
    await client.shutdown()
  })

  it('sends events in FIFO order', async () => {
    const client = createClient({ apiKey: 'hly_sk_test123', batchSize: 100, flushInterval: 60000 })
    client.track('first')
    client.track('second')
    client.track('third')
    await client.flush()

    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events[0].event).toBe('first')
    expect(body.events[1].event).toBe('second')
    expect(body.events[2].event).toBe('third')
    await client.shutdown()
  })

  it('clears the queue after a successful flush', async () => {
    const client = createClient({ apiKey: 'hly_sk_test123', batchSize: 100, flushInterval: 60000 })
    client.track('event_1')
    await client.flush()

    mockFetch.mockClear()

    // Second flush should not send anything
    await client.flush()
    expect(mockFetch).not.toHaveBeenCalled()
    await client.shutdown()
  })

  it('queue size is exposed via a queueSize getter', () => {
    const client = createClient({ apiKey: 'hly_sk_test123', batchSize: 100, flushInterval: 60000 })
    expect(client.queueSize).toBe(0)
    client.track('event_1')
    expect(client.queueSize).toBe(1)
    client.track('event_2')
    expect(client.queueSize).toBe(2)
    client.shutdown()
  })
})

// ---------------------------------------------------------------------------
// 7. flush()
// ---------------------------------------------------------------------------

describe('flush()', () => {
  let client: HeadlessNodeClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue(okResponse())
    client = createClient({ apiKey: 'hly_sk_test123', endpoint: 'https://db.headless.ly', flushInterval: 60000, batchSize: 100 })
  })

  afterEach(async () => {
    await client.shutdown()
  })

  it('sends all queued events in a single POST request', async () => {
    client.track('event_a')
    client.identify('user_fX9bL5nRd', { email: 'test@acme.co' })
    client.track('event_b')

    await client.flush()

    expect(mockFetch).toHaveBeenCalledOnce()
    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events).toHaveLength(3)
  })

  it('POSTs to the configured endpoint', async () => {
    client.track('test_event')
    await client.flush()

    expect(mockFetch.mock.calls[0][0]).toBe('https://db.headless.ly')
  })

  it('resolves without error when queue is empty', async () => {
    await expect(client.flush()).resolves.toBeUndefined()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns a promise that resolves after the network call', async () => {
    let resolved = false
    mockFetch.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => {
        resolved = true
        resolve(okResponse())
      }, 10)
    }))

    client.track('test_event')
    await client.flush()
    expect(resolved).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 8. Feature flag evaluation
// ---------------------------------------------------------------------------

describe('Feature flag evaluation', () => {
  let client: HeadlessNodeClient

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue(okResponse())
    client = createClient({ apiKey: 'hly_sk_test123', endpoint: 'https://db.headless.ly', flushInterval: 60000, batchSize: 100 })
  })

  afterEach(async () => {
    await client.shutdown()
  })

  it('fetches flag value from /flags endpoint', async () => {
    mockFetch.mockResolvedValueOnce(flagsResponse({ 'dark-mode': true }))
    const value = await client.getFeatureFlag('dark-mode', 'user_fX9bL5nRd')

    expect(value).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://db.headless.ly/flags',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"dark-mode"'),
      }),
    )
  })

  it('caches flag values for subsequent calls', async () => {
    mockFetch.mockResolvedValueOnce(flagsResponse({ 'new-pricing': 'variant-a' }))
    await client.getFeatureFlag('new-pricing', 'user_fX9bL5nRd')
    mockFetch.mockClear()

    const cached = await client.getFeatureFlag('new-pricing', 'user_fX9bL5nRd')
    expect(cached).toBe('variant-a')
    // Should not have made another fetch because it was cached
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('respects cache TTL — re-fetches after expiry', async () => {
    vi.useFakeTimers()
    const flagCacheTTL = 60000 // 1 minute
    const ttlClient = createClient({
      apiKey: 'hly_sk_test123',
      endpoint: 'https://db.headless.ly',
      flushInterval: 120000,
      batchSize: 100,
      flagCacheTTL,
    })

    mockFetch.mockResolvedValueOnce(flagsResponse({ 'ab-test': 'control' }))
    await ttlClient.getFeatureFlag('ab-test', 'user_fX9bL5nRd')

    mockFetch.mockClear()

    // Advance past TTL
    vi.advanceTimersByTime(flagCacheTTL + 1)

    mockFetch.mockResolvedValueOnce(flagsResponse({ 'ab-test': 'variant' }))
    const refreshed = await ttlClient.getFeatureFlag('ab-test', 'user_fX9bL5nRd')

    expect(refreshed).toBe('variant')
    expect(mockFetch).toHaveBeenCalledOnce()

    vi.useRealTimers()
    await ttlClient.shutdown()
  })

  it('isFeatureEnabled returns true for truthy flag', async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(flagsResponse({ 'beta-access': true }))
    const enabled = await client.isFeatureEnabled('beta-access', 'user_fX9bL5nRd')
    expect(enabled).toBe(true)
  })

  it('isFeatureEnabled returns false for falsy flag', async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(flagsResponse({ 'beta-access': false }))
    const enabled = await client.isFeatureEnabled('beta-access', 'user_fX9bL5nRd')
    expect(enabled).toBe(false)
  })

  it('getAllFlags returns all flags for a user in a single request', async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(flagsResponse({ 'flag-a': true, 'flag-b': 'variant', 'flag-c': 42 }))
    const flags = await client.getAllFlags('user_fX9bL5nRd')

    expect(flags).toEqual({ 'flag-a': true, 'flag-b': 'variant', 'flag-c': 42 })
  })

  it('supports default values when flag is not found', async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(flagsResponse({}))
    const value = await client.getFeatureFlag('missing-flag', 'user_fX9bL5nRd', { defaultValue: 'fallback' })

    expect(value).toBe('fallback')
  })

  it('isFeatureEnabled returns false for "control" variant', async () => {
    mockFetch.mockResolvedValueOnce(flagsResponse({ 'ab-test': 'control' }))
    const enabled = await client.isFeatureEnabled('ab-test', 'user_fX9bL5nRd')
    expect(enabled).toBe(false)
  })

  it('tracks $feature_flag_called event when a flag is evaluated', async () => {
    mockFetch.mockResolvedValueOnce(flagsResponse({ 'new-onboarding': true }))
    await client.getFeatureFlag('new-onboarding', 'user_fX9bL5nRd')

    await client.flush()

    // Find the fetch call that sent events (not the /flags call)
    const eventCall = mockFetch.mock.calls.find(
      ([url]) => !(url as string).includes('/flags'),
    )
    expect(eventCall).toBeDefined()
    const body = JSON.parse(eventCall![1]?.body as string)
    const flagEvent = body.events.find((e: any) => e.event === '$feature_flag_called')
    expect(flagEvent).toBeDefined()
    expect(flagEvent.properties.$feature_flag).toBe('new-onboarding')
    expect(flagEvent.properties.$feature_flag_response).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 9. Graceful shutdown
// ---------------------------------------------------------------------------

describe('Graceful shutdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue(okResponse())
  })

  it('shutdown() flushes remaining events', async () => {
    const client = createClient({ apiKey: 'hly_sk_test123', flushInterval: 60000, batchSize: 100 })
    client.track('pre_shutdown_1')
    client.track('pre_shutdown_2')

    await client.shutdown()

    expect(mockFetch).toHaveBeenCalledOnce()
    const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
    expect(body.events).toHaveLength(2)
  })

  it('shutdown() clears the flush interval timer', async () => {
    vi.useFakeTimers()
    const client = createClient({ apiKey: 'hly_sk_test123', flushInterval: 1000, batchSize: 100 })
    client.track('event')
    await client.shutdown()

    mockFetch.mockClear()

    // Advance well past flushInterval — no more flushes should fire
    await vi.advanceTimersByTimeAsync(5000)
    expect(mockFetch).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('shutdown() can be called multiple times safely', async () => {
    const client = createClient({ apiKey: 'hly_sk_test123', flushInterval: 60000, batchSize: 100 })
    client.track('event')

    await client.shutdown()
    await client.shutdown()
    await client.shutdown()

    // Only one flush should have occurred (first call)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('Headlessly.init registers process shutdown hooks that call flush', async () => {
    Headlessly.reset()
    Headlessly.init({ apiKey: 'hly_sk_test123' })

    // Verify that process.once was called with SIGTERM and SIGINT
    const sigtermCall = processOnceSpy.mock.calls.find(([event]) => event === 'SIGTERM')
    const sigintCall = processOnceSpy.mock.calls.find(([event]) => event === 'SIGINT')

    expect(sigtermCall).toBeDefined()
    expect(sigintCall).toBeDefined()

    Headlessly.reset()
  })

  it('no events are lost when shutdown is triggered with pending events', async () => {
    const client = createClient({ apiKey: 'hly_sk_test123', flushInterval: 60000, batchSize: 100 })

    for (let i = 0; i < 50; i++) {
      client.track(`event_${i}`)
    }

    await client.shutdown()

    expect(mockFetch).toHaveBeenCalled()
    const allEvents = mockFetch.mock.calls
      .map(([, init]) => JSON.parse(init?.body as string).events)
      .flat()

    expect(allEvents).toHaveLength(50)
  })
})

// ---------------------------------------------------------------------------
// 10. Error handling
// ---------------------------------------------------------------------------

describe('Error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not throw when fetch fails with a network error', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'))
    const client = createClient({ apiKey: 'hly_sk_test123', maxRetries: 0, flushInterval: 60000, batchSize: 100 })
    client.track('event')

    await expect(client.flush()).resolves.not.toThrow()
    await client.shutdown()
  })

  it('calls onError callback when retries are exhausted', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'))
    const onError = vi.fn()
    const client = createClient({
      apiKey: 'hly_sk_test123',
      maxRetries: 0,
      onError,
      flushInterval: 60000,
      batchSize: 100,
    })

    client.track('event')
    await client.flush()

    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe('timeout')
    await client.shutdown()
  })

  it('retries failed requests up to maxRetries with exponential backoff', async () => {
    vi.useFakeTimers()
    mockFetch
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce(okResponse())

    const client = createClient({ apiKey: 'hly_sk_test123', maxRetries: 3, flushInterval: 60000, batchSize: 100 })
    client.track('event')
    const flushPromise = client.flush()

    // Advance past backoff timers (1s + 2s)
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromise

    // 1 initial + 2 retries = 3 total calls, third succeeds
    expect(mockFetch).toHaveBeenCalledTimes(3)
    await client.shutdown()
    vi.useRealTimers()
  })

  it('does not retry on 4xx client errors', async () => {
    vi.useFakeTimers()
    mockFetch.mockResolvedValue(errorResponse(400))
    const onError = vi.fn()
    const client = createClient({ apiKey: 'hly_sk_test123', maxRetries: 3, onError, flushInterval: 60000, batchSize: 100 })
    client.track('event')
    const flushPromise = client.flush()

    // Advance timers in case retries are attempted (they shouldn't be for 4xx)
    await vi.advanceTimersByTimeAsync(10000)
    await flushPromise

    // Should NOT retry 4xx — only one attempt
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledOnce()
    await client.shutdown()
    vi.useRealTimers()
  })

  it('drops events gracefully when queue overflows', async () => {
    const client = createClient({
      apiKey: 'hly_sk_test123',
      maxQueueSize: 5,
      flushInterval: 60000,
      batchSize: 100,
    })

    // Enqueue more than maxQueueSize
    for (let i = 0; i < 10; i++) {
      client.track(`event_${i}`)
    }

    expect(client.queueSize).toBeLessThanOrEqual(5)
    await client.shutdown()
  })

  it('network errors in feature flag evaluation return undefined, not throw', async () => {
    mockFetch.mockRejectedValue(new Error('DNS failure'))
    const client = createClient({ apiKey: 'hly_sk_test123', flushInterval: 60000, batchSize: 100 })

    const value = await client.getFeatureFlag('some-flag', 'user_fX9bL5nRd')
    expect(value).toBeUndefined()
    await client.shutdown()
  })

  it('5xx responses in feature flag evaluation return undefined', async () => {
    mockFetch.mockResolvedValue(errorResponse(503))
    const client = createClient({ apiKey: 'hly_sk_test123', flushInterval: 60000, batchSize: 100 })

    const value = await client.getFeatureFlag('some-flag', 'user_fX9bL5nRd')
    expect(value).toBeUndefined()
    await client.shutdown()
  })
})
