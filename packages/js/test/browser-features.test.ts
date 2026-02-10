import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HeadlessClient } from '../src/client.js'
import {
  ForwardingManager,
  GoogleAnalyticsForwarder,
  SegmentForwarder,
  PostHogForwarder,
} from '../src/forwarding.js'
import type { EventForwarder } from '../src/forwarding.js'
import { RealtimeManager } from '../src/realtime.js'
import type { SubscriptionMessage, RealtimeState } from '../src/realtime.js'
import { AutoCaptureManager } from '../src/autocapture.js'

// ---------------------------------------------------------------------------
// Recording fetch
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string
  init: RequestInit
  body?: unknown
}

const fetchCalls: FetchCall[] = []
let fetchResponder: (url: string, init?: RequestInit) => Response | Promise<Response> = () =>
  new Response(JSON.stringify({ ok: true }), { status: 200 })

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

describe('@headlessly/js — browser features', () => {
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
  // 1. headlessly() initialization function
  // =========================================================================

  describe('headlessly() initialization', () => {
    it('headlessly function is exported and callable', async () => {
      const { headlessly } = await import('../src/index.js')
      expect(typeof headlessly).toBe('function')
    })

    it('headlessly returns a HeadlessClient instance', async () => {
      const { headlessly, reset } = await import('../src/index.js')
      reset()
      const result = headlessly({ apiKey: 'hl_test' })
      expect(result).toBeDefined()
      expect(typeof result.track).toBe('function')
      expect(typeof result.page).toBe('function')
      expect(typeof result.identify).toBe('function')
      reset()
    })

    it('headlessly auto-detects endpoint on *.headless.ly', async () => {
      const savedLocation = window.location
      // Simulate running on crm.headless.ly
      Object.defineProperty(window, 'location', {
        value: { hostname: 'crm.headless.ly', protocol: 'https:', href: 'https://crm.headless.ly', pathname: '/' },
        writable: true,
        configurable: true,
      })

      const { headlessly, reset, flush } = await import('../src/index.js')
      reset()
      headlessly({ apiKey: 'hl_test' })
      const { track } = await import('../src/index.js')
      track('auto_detect_test')
      await flush()
      await flushMicrotasks()

      // Should have auto-detected endpoint as https://headless.ly/e
      const eventCall = fetchCalls.find((c) => c.body?.events)
      expect(eventCall).toBeDefined()
      expect(eventCall!.url).toBe('https://headless.ly/e')

      // Restore
      Object.defineProperty(window, 'location', { value: savedLocation, writable: true, configurable: true })
      reset()
    })

    it('headlessly uses default endpoint when not on *.headless.ly', async () => {
      const { headlessly, reset, flush, track: trackFn } = await import('../src/index.js')
      reset()
      headlessly({ apiKey: 'hl_test' })
      trackFn('not_headlessly_domain')
      await flush()
      await flushMicrotasks()

      const eventCall = fetchCalls.find((c) => c.body?.events)
      expect(eventCall).toBeDefined()
      // Default endpoint: https://headless.ly/e
      expect(eventCall!.url).toBe('https://headless.ly/e')
      reset()
    })

    it('headlessly respects explicit endpoint over auto-detection', async () => {
      const { headlessly, reset, flush, track: trackFn } = await import('../src/index.js')
      reset()
      headlessly({ apiKey: 'hl_test', endpoint: 'https://custom.example.com/events' })
      trackFn('custom_endpoint')
      await flush()
      await flushMicrotasks()

      const eventCall = fetchCalls.find((c) => c.body?.events)
      expect(eventCall).toBeDefined()
      expect(eventCall!.url).toBe('https://custom.example.com/events')
      reset()
    })
  })

  // =========================================================================
  // 2. Event Forwarding
  // =========================================================================

  describe('Event Forwarding', () => {
    describe('ForwardingManager', () => {
      it('can add and remove forwarders', () => {
        const manager = new ForwardingManager()
        const forwarder: EventForwarder = { name: 'test', forward: vi.fn() }

        manager.add(forwarder)
        expect(manager.getForwarders()).toHaveLength(1)
        expect(manager.getForwarders()[0].name).toBe('test')

        manager.remove('test')
        expect(manager.getForwarders()).toHaveLength(0)
      })

      it('forwards events to all registered forwarders', () => {
        const manager = new ForwardingManager()
        const fn1 = vi.fn()
        const fn2 = vi.fn()
        manager.add({ name: 'a', forward: fn1 })
        manager.add({ name: 'b', forward: fn2 })

        const event = { type: 'track' as const, event: 'test', anonymousId: 'anon', sessionId: 'ses', ts: 'now' }
        manager.forward(event)

        expect(fn1).toHaveBeenCalledWith(event)
        expect(fn2).toHaveBeenCalledWith(event)
      })

      it('silently handles forwarder errors', () => {
        const manager = new ForwardingManager()
        manager.add({
          name: 'broken',
          forward: () => {
            throw new Error('forwarder error')
          },
        })
        const fn2 = vi.fn()
        manager.add({ name: 'healthy', forward: fn2 })

        const event = { type: 'track' as const, event: 'test', anonymousId: 'anon', sessionId: 'ses', ts: 'now' }
        expect(() => manager.forward(event)).not.toThrow()
        expect(fn2).toHaveBeenCalled()
      })

      it('clear removes all forwarders', () => {
        const manager = new ForwardingManager()
        manager.add({ name: 'a', forward: vi.fn() })
        manager.add({ name: 'b', forward: vi.fn() })
        manager.clear()
        expect(manager.getForwarders()).toHaveLength(0)
      })

      it('flush calls flush on all forwarders that have it', () => {
        const manager = new ForwardingManager()
        const flushFn = vi.fn()
        manager.add({ name: 'flushable', forward: vi.fn(), flush: flushFn })
        manager.add({ name: 'noflush', forward: vi.fn() })

        manager.flush()
        expect(flushFn).toHaveBeenCalled()
      })

      it('shutdown calls shutdown on all forwarders that have it', () => {
        const manager = new ForwardingManager()
        const shutdownFn = vi.fn()
        manager.add({ name: 'closable', forward: vi.fn(), shutdown: shutdownFn })

        manager.shutdown()
        expect(shutdownFn).toHaveBeenCalled()
      })
    })

    describe('GoogleAnalyticsForwarder', () => {
      it('forwards page events to gtag', () => {
        const gtagSpy = vi.fn()
        ;(window as unknown as Record<string, unknown>).gtag = gtagSpy

        const forwarder = new GoogleAnalyticsForwarder({ measurementId: 'G-XXXXX' })
        forwarder.forward({
          type: 'page',
          url: 'https://example.com/about',
          path: '/about',
          title: 'About',
          anonymousId: 'anon',
          sessionId: 'ses',
          ts: 'now',
        })

        expect(gtagSpy).toHaveBeenCalledWith('event', 'page_view', expect.objectContaining({
          page_title: 'About',
          page_location: 'https://example.com/about',
          page_path: '/about',
          send_to: 'G-XXXXX',
        }))

        delete (window as unknown as Record<string, unknown>).gtag
      })

      it('forwards track events to gtag', () => {
        const gtagSpy = vi.fn()
        ;(window as unknown as Record<string, unknown>).gtag = gtagSpy

        const forwarder = new GoogleAnalyticsForwarder({ measurementId: 'G-XXXXX' })
        forwarder.forward({
          type: 'track',
          event: 'purchase',
          properties: { value: 99 },
          anonymousId: 'anon',
          sessionId: 'ses',
          ts: 'now',
        })

        expect(gtagSpy).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({
          value: 99,
          send_to: 'G-XXXXX',
        }))

        delete (window as unknown as Record<string, unknown>).gtag
      })

      it('forwards exception events to gtag', () => {
        const gtagSpy = vi.fn()
        ;(window as unknown as Record<string, unknown>).gtag = gtagSpy

        const forwarder = new GoogleAnalyticsForwarder({ measurementId: 'G-XXXXX' })
        forwarder.forward({
          type: 'exception',
          eventId: 'abc',
          ts: 'now',
          level: 'error',
          exception: { type: 'Error', value: 'boom' },
        })

        expect(gtagSpy).toHaveBeenCalledWith('event', 'exception', expect.objectContaining({
          description: 'boom',
          fatal: false,
        }))

        delete (window as unknown as Record<string, unknown>).gtag
      })

      it('does nothing when gtag is not present', () => {
        delete (window as unknown as Record<string, unknown>).gtag
        const forwarder = new GoogleAnalyticsForwarder({ measurementId: 'G-XXXXX' })
        expect(() =>
          forwarder.forward({
            type: 'track',
            event: 'test',
            anonymousId: 'anon',
            sessionId: 'ses',
            ts: 'now',
          }),
        ).not.toThrow()
      })
    })

    describe('SegmentForwarder', () => {
      it('forwards track events to Segment', () => {
        const trackSpy = vi.fn()
        ;(window as unknown as Record<string, unknown>).analytics = {
          track: trackSpy,
          page: vi.fn(),
          identify: vi.fn(),
          alias: vi.fn(),
          group: vi.fn(),
        }

        const forwarder = new SegmentForwarder({ writeKey: 'test_key' })
        forwarder.forward({
          type: 'track',
          event: 'signup',
          properties: { plan: 'pro' },
          anonymousId: 'anon',
          sessionId: 'ses',
          ts: 'now',
        })

        expect(trackSpy).toHaveBeenCalledWith('signup', { plan: 'pro' })
        delete (window as unknown as Record<string, unknown>).analytics
      })

      it('forwards page events to Segment', () => {
        const pageSpy = vi.fn()
        ;(window as unknown as Record<string, unknown>).analytics = {
          track: vi.fn(),
          page: pageSpy,
          identify: vi.fn(),
          alias: vi.fn(),
          group: vi.fn(),
        }

        const forwarder = new SegmentForwarder({ writeKey: 'test_key' })
        forwarder.forward({
          type: 'page',
          event: 'Home',
          properties: { section: 'main' },
          anonymousId: 'anon',
          sessionId: 'ses',
          ts: 'now',
        })

        expect(pageSpy).toHaveBeenCalledWith('Home', { section: 'main' })
        delete (window as unknown as Record<string, unknown>).analytics
      })

      it('forwards identify events to Segment', () => {
        const identifySpy = vi.fn()
        ;(window as unknown as Record<string, unknown>).analytics = {
          track: vi.fn(),
          page: vi.fn(),
          identify: identifySpy,
          alias: vi.fn(),
          group: vi.fn(),
        }

        const forwarder = new SegmentForwarder({ writeKey: 'test_key' })
        forwarder.forward({
          type: 'identify',
          userId: 'u_42',
          traits: { email: 'alice@test.com' },
          anonymousId: 'anon',
          sessionId: 'ses',
          ts: 'now',
        })

        expect(identifySpy).toHaveBeenCalledWith('u_42', { email: 'alice@test.com' })
        delete (window as unknown as Record<string, unknown>).analytics
      })

      it('forwards group events to Segment', () => {
        const groupSpy = vi.fn()
        ;(window as unknown as Record<string, unknown>).analytics = {
          track: vi.fn(),
          page: vi.fn(),
          identify: vi.fn(),
          alias: vi.fn(),
          group: groupSpy,
        }

        const forwarder = new SegmentForwarder({ writeKey: 'test_key' })
        forwarder.forward({
          type: 'group',
          groupId: 'org_1',
          groupTraits: { name: 'Acme' },
          anonymousId: 'anon',
          sessionId: 'ses',
          ts: 'now',
        })

        expect(groupSpy).toHaveBeenCalledWith('org_1', { name: 'Acme' })
        delete (window as unknown as Record<string, unknown>).analytics
      })

      it('does nothing when window.analytics is not present', () => {
        delete (window as unknown as Record<string, unknown>).analytics
        const forwarder = new SegmentForwarder({ writeKey: 'test_key' })
        expect(() =>
          forwarder.forward({
            type: 'track',
            event: 'test',
            anonymousId: 'anon',
            sessionId: 'ses',
            ts: 'now',
          }),
        ).not.toThrow()
      })
    })

    describe('PostHogForwarder', () => {
      it('forwards track events to PostHog', () => {
        const captureSpy = vi.fn()
        ;(window as unknown as Record<string, unknown>).posthog = {
          capture: captureSpy,
          identify: vi.fn(),
          alias: vi.fn(),
          group: vi.fn(),
        }

        const forwarder = new PostHogForwarder({ apiKey: 'phc_test' })
        forwarder.forward({
          type: 'track',
          event: 'button_click',
          properties: { id: 'cta' },
          anonymousId: 'anon',
          sessionId: 'ses',
          ts: 'now',
        })

        expect(captureSpy).toHaveBeenCalledWith('button_click', { id: 'cta' })
        delete (window as unknown as Record<string, unknown>).posthog
      })

      it('forwards page events as $pageview to PostHog', () => {
        const captureSpy = vi.fn()
        ;(window as unknown as Record<string, unknown>).posthog = {
          capture: captureSpy,
          identify: vi.fn(),
          alias: vi.fn(),
          group: vi.fn(),
        }

        const forwarder = new PostHogForwarder({ apiKey: 'phc_test' })
        forwarder.forward({
          type: 'page',
          url: 'https://example.com/home',
          path: '/home',
          title: 'Home',
          referrer: 'https://google.com',
          anonymousId: 'anon',
          sessionId: 'ses',
          ts: 'now',
        })

        expect(captureSpy).toHaveBeenCalledWith('$pageview', expect.objectContaining({
          $current_url: 'https://example.com/home',
          $pathname: '/home',
          $title: 'Home',
          $referrer: 'https://google.com',
        }))
        delete (window as unknown as Record<string, unknown>).posthog
      })

      it('forwards exception events as $exception to PostHog', () => {
        const captureSpy = vi.fn()
        ;(window as unknown as Record<string, unknown>).posthog = {
          capture: captureSpy,
          identify: vi.fn(),
          alias: vi.fn(),
          group: vi.fn(),
        }

        const forwarder = new PostHogForwarder({ apiKey: 'phc_test' })
        forwarder.forward({
          type: 'exception',
          eventId: 'abc',
          ts: 'now',
          level: 'error',
          exception: { type: 'TypeError', value: 'bad input' },
        })

        expect(captureSpy).toHaveBeenCalledWith('$exception', expect.objectContaining({
          $exception_type: 'TypeError',
          $exception_message: 'bad input',
          $exception_level: 'error',
        }))
        delete (window as unknown as Record<string, unknown>).posthog
      })

      it('does nothing when window.posthog is not present', () => {
        delete (window as unknown as Record<string, unknown>).posthog
        const forwarder = new PostHogForwarder({ apiKey: 'phc_test' })
        expect(() =>
          forwarder.forward({
            type: 'track',
            event: 'test',
            anonymousId: 'anon',
            sessionId: 'ses',
            ts: 'now',
          }),
        ).not.toThrow()
      })
    })

    describe('Client integration', () => {
      it('events are forwarded when forwarders are configured', async () => {
        const forwardSpy = vi.fn()
        client.init({ apiKey: 'test_key', batchSize: 100 })
        client.addForwarder({ name: 'spy', forward: forwardSpy })

        client.track('forwarded_event', { foo: 'bar' })
        await client.flush()
        await flushMicrotasks()

        expect(forwardSpy).toHaveBeenCalled()
        const forwardedEvent = forwardSpy.mock.calls[0][0]
        expect(forwardedEvent.event).toBe('forwarded_event')
        expect(forwardedEvent.properties).toEqual(expect.objectContaining({ foo: 'bar' }))
      })

      it('page events are forwarded', async () => {
        const forwardSpy = vi.fn()
        client.init({ apiKey: 'test_key', batchSize: 100 })
        client.addForwarder({ name: 'spy', forward: forwardSpy })

        client.page('Dashboard')
        await client.flush()
        await flushMicrotasks()

        expect(forwardSpy).toHaveBeenCalled()
        const forwardedEvent = forwardSpy.mock.calls[0][0]
        expect(forwardedEvent.type).toBe('page')
      })

      it('error events are forwarded', async () => {
        const forwardSpy = vi.fn()
        client.init({ apiKey: 'test_key', batchSize: 100 })
        client.addForwarder({ name: 'spy', forward: forwardSpy })

        client.captureException(new Error('forwarded error'))
        await client.flush()
        await flushMicrotasks()

        expect(forwardSpy).toHaveBeenCalled()
        const forwardedEvent = forwardSpy.mock.calls[0][0]
        expect(forwardedEvent.type).toBe('exception')
      })

      it('removeForwarder stops forwarding to that service', async () => {
        const forwardSpy = vi.fn()
        client.init({ apiKey: 'test_key', batchSize: 100 })
        client.addForwarder({ name: 'removable', forward: forwardSpy })

        client.track('before_remove')
        expect(forwardSpy).toHaveBeenCalledTimes(1)

        client.removeForwarder('removable')
        client.track('after_remove')
        expect(forwardSpy).toHaveBeenCalledTimes(1) // still just 1
      })

      it('getForwarders returns current forwarder list', () => {
        client.init({ apiKey: 'test_key' })
        expect(client.getForwarders()).toHaveLength(0)

        client.addForwarder({ name: 'test', forward: vi.fn() })
        expect(client.getForwarders()).toHaveLength(1)
        expect(client.getForwarders()[0].name).toBe('test')
      })

      it('forwarders configured via init config option', async () => {
        const gtagSpy = vi.fn()
        ;(window as unknown as Record<string, unknown>).gtag = gtagSpy

        client.init({
          apiKey: 'test_key',
          batchSize: 100,
          forwarders: [{ type: 'google-analytics', measurementId: 'G-TEST' }],
        })

        client.track('via_config', { item: 'test' })
        await client.flush()
        await flushMicrotasks()

        expect(gtagSpy).toHaveBeenCalledWith('event', 'via_config', expect.objectContaining({
          item: 'test',
          send_to: 'G-TEST',
        }))

        delete (window as unknown as Record<string, unknown>).gtag
      })

      it('reset clears all forwarders', () => {
        client.init({ apiKey: 'test_key' })
        client.addForwarder({ name: 'test', forward: vi.fn() })
        expect(client.getForwarders()).toHaveLength(1)

        client.reset()
        expect(client.getForwarders()).toHaveLength(0)
      })

      it('forwarding errors do not affect primary event flow', async () => {
        client.init({ apiKey: 'test_key', batchSize: 100 })
        client.addForwarder({
          name: 'broken',
          forward: () => {
            throw new Error('forwarder crash')
          },
        })

        // Track should still work
        client.track('survives_forwarder_crash')
        await client.flush()
        await flushMicrotasks()

        const body = lastEventBody()
        expect(body).toBeDefined()
        expect(body!.events.some((e) => e.event === 'survives_forwarder_crash')).toBe(true)
      })
    })
  })

  // =========================================================================
  // 3. Real-time Subscriptions
  // =========================================================================

  describe('Real-time Subscriptions', () => {
    describe('RealtimeManager', () => {
      it('starts in disconnected state', () => {
        const rt = new RealtimeManager()
        expect(rt.state).toBe('disconnected')
        expect(rt.isConnected).toBe(false)
      })

      it('tracks subscribed entity types', () => {
        const rt = new RealtimeManager()
        // Mock WebSocket to prevent actual connection
        vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => ({
          readyState: 0,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        })))

        const unsub1 = rt.subscribe('Contact', vi.fn())
        const unsub2 = rt.subscribe('Deal', vi.fn())
        expect(rt.subscribedEntities).toContain('Contact')
        expect(rt.subscribedEntities).toContain('Deal')

        unsub1()
        expect(rt.subscribedEntities).not.toContain('Contact')
        expect(rt.subscribedEntities).toContain('Deal')

        unsub2()
        expect(rt.subscribedEntities).toHaveLength(0)
      })

      it('onStateChange notifies listeners of state changes', () => {
        const rt = new RealtimeManager()
        const states: RealtimeState[] = []
        rt.onStateChange((s) => states.push(s))

        // Mock WebSocket
        let wsInstance: Record<string, unknown> = {}
        vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => {
          wsInstance = {
            readyState: 0,
            onopen: null,
            onmessage: null,
            onclose: null,
            onerror: null,
            close: vi.fn(),
            send: vi.fn(),
          }
          return wsInstance
        }))

        rt.connect()
        expect(states).toContain('connecting')

        // Simulate connection success
        if (wsInstance.onopen) (wsInstance.onopen as () => void)()
        expect(states).toContain('connected')
        expect(rt.isConnected).toBe(true)

        rt.disconnect()
        expect(states).toContain('disconnected')
      })

      it('shutdown clears all subscriptions and state', () => {
        const rt = new RealtimeManager()
        vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => ({
          readyState: 0,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        })))

        rt.subscribe('Contact', vi.fn())
        rt.subscribe('Deal', vi.fn())
        expect(rt.subscribedEntities).toHaveLength(2)

        rt.shutdown()
        expect(rt.subscribedEntities).toHaveLength(0)
        expect(rt.state).toBe('disconnected')
      })

      it('handles WebSocket messages and dispatches to handlers', () => {
        const rt = new RealtimeManager()
        const handler = vi.fn()

        let wsInstance: Record<string, unknown> = {}
        vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => {
          wsInstance = {
            readyState: 1,
            onopen: null,
            onmessage: null,
            onclose: null,
            onerror: null,
            close: vi.fn(),
            send: vi.fn(),
            OPEN: 1,
            CONNECTING: 0,
          }
          // Fake WebSocket constants
          Object.defineProperty(wsInstance, 'readyState', { value: 1, writable: true })
          return wsInstance
        }))

        rt.subscribe('Contact', handler)

        // Simulate connection
        if (wsInstance.onopen) (wsInstance.onopen as () => void)()

        // Simulate incoming message
        const msg: SubscriptionMessage = {
          type: 'update',
          entity: 'Contact',
          id: 'contact_abc',
          data: { name: 'Alice' },
          ts: new Date().toISOString(),
        }
        if (wsInstance.onmessage) {
          (wsInstance.onmessage as (event: { data: string }) => void)({
            data: JSON.stringify(msg),
          })
        }

        expect(handler).toHaveBeenCalledWith(msg)
      })

      it('wildcard subscription receives all messages', () => {
        const rt = new RealtimeManager()
        const wildcardHandler = vi.fn()

        let wsInstance: Record<string, unknown> = {}
        vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => {
          wsInstance = {
            readyState: 1,
            onopen: null,
            onmessage: null,
            onclose: null,
            onerror: null,
            close: vi.fn(),
            send: vi.fn(),
          }
          Object.defineProperty(wsInstance, 'readyState', { value: 1, writable: true })
          return wsInstance
        }))

        rt.subscribe('*', wildcardHandler)
        // Need a typed subscription for the entity to trigger handlers
        rt.subscribe('Deal', vi.fn())

        if (wsInstance.onopen) (wsInstance.onopen as () => void)()

        const msg: SubscriptionMessage = {
          type: 'create',
          entity: 'Deal',
          id: 'deal_xyz',
          data: { title: 'Big Deal' },
          ts: new Date().toISOString(),
        }
        if (wsInstance.onmessage) {
          (wsInstance.onmessage as (event: { data: string }) => void)({
            data: JSON.stringify(msg),
          })
        }

        expect(wildcardHandler).toHaveBeenCalledWith(msg)
      })

      it('unsubscribe function removes the handler', () => {
        const rt = new RealtimeManager()
        const handler = vi.fn()

        vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => ({
          readyState: 1,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        })))

        const unsub = rt.subscribe('Contact', handler)
        unsub()
        expect(rt.subscribedEntities).not.toContain('Contact')
      })
    })

    describe('Client integration', () => {
      it('subscribe method is available on HeadlessClient', () => {
        expect(typeof client.subscribe).toBe('function')
      })

      it('subscribe creates a realtime manager lazily', () => {
        vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => ({
          readyState: 0,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        })))

        client.init({ apiKey: 'test_key' })
        const handler = vi.fn()
        const unsub = client.subscribe('Contact', handler)
        expect(typeof unsub).toBe('function')
        unsub()
      })

      it('realtimeState returns disconnected by default', () => {
        client.init({ apiKey: 'test_key' })
        expect(client.realtimeState).toBe('disconnected')
      })

      it('connectRealtime and disconnectRealtime are callable', () => {
        vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => ({
          readyState: 0,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        })))

        client.init({ apiKey: 'test_key' })
        expect(() => client.connectRealtime()).not.toThrow()
        expect(() => client.disconnectRealtime()).not.toThrow()
      })

      it('shutdown cleans up realtime connection', async () => {
        vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => ({
          readyState: 0,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        })))

        client.init({ apiKey: 'test_key', batchSize: 100 })
        client.subscribe('Contact', vi.fn())
        await client.shutdown()

        expect(client.realtimeState).toBe('disconnected')
      })
    })
  })

  // =========================================================================
  // 4. Auto-capture
  // =========================================================================

  describe('Auto-capture', () => {
    describe('AutoCaptureManager', () => {
      it('can be started and stopped', () => {
        const tracker = { track: vi.fn(), page: vi.fn() }
        const ac = new AutoCaptureManager({}, tracker)
        expect(() => ac.start()).not.toThrow()
        expect(() => ac.stop()).not.toThrow()
      })

      it('does not throw when window is undefined', () => {
        const savedWindow = globalThis.window
        vi.stubGlobal('window', undefined)

        const tracker = { track: vi.fn(), page: vi.fn() }
        const ac = new AutoCaptureManager({ pageViews: true, clicks: true }, tracker)
        expect(() => ac.start()).not.toThrow()

        vi.stubGlobal('window', savedWindow)
      })

      it('captures clicks when configured', () => {
        const tracker = { track: vi.fn(), page: vi.fn() }
        const ac = new AutoCaptureManager({ clicks: true }, tracker)
        ac.start()

        // Simulate a click event on a button
        const button = document.createElement('button')
        button.textContent = 'Click me'
        button.id = 'test-btn'
        document.body.appendChild(button)

        const event = new MouseEvent('click', { bubbles: true })
        button.dispatchEvent(event)

        expect(tracker.track).toHaveBeenCalledWith('$click', expect.objectContaining({
          $tag_name: 'button',
          $text: 'Click me',
          $attr_id: 'test-btn',
        }))

        document.body.removeChild(button)
        ac.stop()
      })

      it('captures form submissions when configured', () => {
        const tracker = { track: vi.fn(), page: vi.fn() }
        const ac = new AutoCaptureManager({ formSubmissions: true }, tracker)
        ac.start()

        const form = document.createElement('form')
        form.id = 'test-form'
        form.method = 'POST'
        document.body.appendChild(form)

        const event = new Event('submit', { bubbles: true })
        form.dispatchEvent(event)

        expect(tracker.track).toHaveBeenCalledWith('$form_submit', expect.objectContaining({
          $tag_name: 'form',
          $attr_id: 'test-form',
        }))

        document.body.removeChild(form)
        ac.stop()
      })

      it('stop removes event listeners', () => {
        const tracker = { track: vi.fn(), page: vi.fn() }
        const ac = new AutoCaptureManager({ clicks: true }, tracker)
        ac.start()
        ac.stop()

        // Click after stop should not be captured
        const button = document.createElement('button')
        button.textContent = 'After stop'
        document.body.appendChild(button)

        const event = new MouseEvent('click', { bubbles: true })
        button.dispatchEvent(event)

        // Should not have been called (only the initial page capture, if any)
        expect(tracker.track).not.toHaveBeenCalled()

        document.body.removeChild(button)
      })
    })

    describe('Client integration', () => {
      it('autoCapture config enables auto-capture on init', () => {
        // Ensure window.addEventListener is available (jsdom provides it)
        if (typeof window.addEventListener !== 'function') {
          // Skip in environments without real window
          return
        }
        const pageSpy = vi.spyOn(client, 'page')
        client.init({
          apiKey: 'test_key',
          autoCapture: { pageViews: true },
        })

        // Auto-capture should have fired an initial page view
        expect(pageSpy).toHaveBeenCalled()
        pageSpy.mockRestore()
      })

      it('autoCapture is cleaned up on reset', () => {
        client.init({
          apiKey: 'test_key',
          autoCapture: { clicks: true },
        })
        // Reset should not throw
        expect(() => client.reset()).not.toThrow()
      })

      it('autoCapture is cleaned up on shutdown', async () => {
        client.init({
          apiKey: 'test_key',
          batchSize: 100,
          autoCapture: { clicks: true },
        })
        await client.shutdown()
        // Should not throw
      })
    })
  })

  // =========================================================================
  // 5. Exports
  // =========================================================================

  describe('Module exports', () => {
    it('exports headlessly function', async () => {
      const mod = await import('../src/index.js')
      expect(typeof mod.headlessly).toBe('function')
    })

    it('exports subscribe function', async () => {
      const mod = await import('../src/index.js')
      expect(typeof mod.subscribe).toBe('function')
    })

    it('exports connectRealtime function', async () => {
      const mod = await import('../src/index.js')
      expect(typeof mod.connectRealtime).toBe('function')
    })

    it('exports disconnectRealtime function', async () => {
      const mod = await import('../src/index.js')
      expect(typeof mod.disconnectRealtime).toBe('function')
    })

    it('exports addForwarder function', async () => {
      const mod = await import('../src/index.js')
      expect(typeof mod.addForwarder).toBe('function')
    })

    it('exports removeForwarder function', async () => {
      const mod = await import('../src/index.js')
      expect(typeof mod.removeForwarder).toBe('function')
    })

    it('exports getForwarders function', async () => {
      const mod = await import('../src/index.js')
      expect(typeof mod.getForwarders).toBe('function')
    })

    it('exports ForwardingManager class', async () => {
      const mod = await import('../src/index.js')
      expect(mod.ForwardingManager).toBeDefined()
    })

    it('exports GoogleAnalyticsForwarder class', async () => {
      const mod = await import('../src/index.js')
      expect(mod.GoogleAnalyticsForwarder).toBeDefined()
    })

    it('exports SegmentForwarder class', async () => {
      const mod = await import('../src/index.js')
      expect(mod.SegmentForwarder).toBeDefined()
    })

    it('exports PostHogForwarder class', async () => {
      const mod = await import('../src/index.js')
      expect(mod.PostHogForwarder).toBeDefined()
    })

    it('exports RealtimeManager class', async () => {
      const mod = await import('../src/index.js')
      expect(mod.RealtimeManager).toBeDefined()
    })

    it('exports AutoCaptureManager class', async () => {
      const mod = await import('../src/index.js')
      expect(mod.AutoCaptureManager).toBeDefined()
    })

    it('exports createClient factory', async () => {
      const mod = await import('../src/index.js')
      expect(typeof mod.createClient).toBe('function')
    })

    it('default export includes headlessly', async () => {
      const mod = await import('../src/index.js')
      expect(typeof mod.default.headlessly).toBe('function')
    })

    it('default export includes subscribe', async () => {
      const mod = await import('../src/index.js')
      expect(typeof mod.default.subscribe).toBe('function')
    })

    it('default export includes addForwarder', async () => {
      const mod = await import('../src/index.js')
      expect(typeof mod.default.addForwarder).toBe('function')
    })

    it('default export includes all original methods', async () => {
      const mod = await import('../src/index.js')
      const d = mod.default

      // Original methods
      expect(typeof d.init).toBe('function')
      expect(typeof d.page).toBe('function')
      expect(typeof d.track).toBe('function')
      expect(typeof d.identify).toBe('function')
      expect(typeof d.alias).toBe('function')
      expect(typeof d.group).toBe('function')
      expect(typeof d.captureException).toBe('function')
      expect(typeof d.captureMessage).toBe('function')
      expect(typeof d.setUser).toBe('function')
      expect(typeof d.setTag).toBe('function')
      expect(typeof d.setTags).toBe('function')
      expect(typeof d.setExtra).toBe('function')
      expect(typeof d.addBreadcrumb).toBe('function')
      expect(typeof d.getFeatureFlag).toBe('function')
      expect(typeof d.isFeatureEnabled).toBe('function')
      expect(typeof d.getAllFlags).toBe('function')
      expect(typeof d.reloadFeatureFlags).toBe('function')
      expect(typeof d.onFlagChange).toBe('function')
      expect(typeof d.captureWebVitals).toBe('function')
      expect(typeof d.optOut).toBe('function')
      expect(typeof d.optIn).toBe('function')
      expect(typeof d.hasOptedOut).toBe('function')
      expect(typeof d.reset).toBe('function')
      expect(typeof d.getDistinctId).toBe('function')
      expect(typeof d.getSessionId).toBe('function')
      expect(typeof d.flush).toBe('function')
      expect(typeof d.shutdown).toBe('function')
      expect(typeof d.getInstance).toBe('function')
      expect(typeof d.createClient).toBe('function')
    })
  })

  // =========================================================================
  // 6. RealtimeManager reconnection
  // =========================================================================

  describe('RealtimeManager reconnection', () => {
    it('schedules reconnect with exponential backoff on close', () => {
      const rt = new RealtimeManager({ reconnectDelay: 100, maxReconnectAttempts: 3 })

      let wsInstance: Record<string, unknown> = {}
      let wsCreateCount = 0
      vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => {
        wsCreateCount++
        wsInstance = {
          readyState: 0,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        }
        return wsInstance
      }))

      rt.connect()
      expect(wsCreateCount).toBe(1)

      // Simulate connection close
      if (wsInstance.onclose) (wsInstance.onclose as () => void)()
      expect(rt.state).toBe('reconnecting')

      // Advance past first reconnect delay (100ms * 2^0 = 100ms + jitter)
      vi.advanceTimersByTime(200)
      expect(wsCreateCount).toBe(2)

      rt.shutdown()
    })

    it('stops reconnecting after maxReconnectAttempts', () => {
      const rt = new RealtimeManager({ reconnectDelay: 50, maxReconnectAttempts: 2 })

      let wsCreateCount = 0
      vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => {
        wsCreateCount++
        const ws: Record<string, unknown> = {
          readyState: 0,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        }
        // Simulate immediate close
        setTimeout(() => {
          if (ws.onclose) (ws.onclose as () => void)()
        }, 1)
        return ws
      }))

      rt.connect()
      // Run through all reconnect attempts
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(5000)
      }

      // Should not exceed maxReconnectAttempts + 1 (initial + retries)
      expect(wsCreateCount).toBeLessThanOrEqual(4) // initial + 2 retries (generous)

      rt.shutdown()
    })

    it('resets reconnect counter on successful connection', () => {
      const rt = new RealtimeManager({ reconnectDelay: 50, maxReconnectAttempts: 5 })

      let wsInstance: Record<string, unknown> = {}
      vi.stubGlobal('WebSocket', vi.fn().mockImplementation(() => {
        wsInstance = {
          readyState: 0,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        }
        return wsInstance
      }))

      rt.connect()
      // Simulate successful connection
      if (wsInstance.onopen) (wsInstance.onopen as () => void)()
      expect(rt.state).toBe('connected')

      // Close and reconnect
      if (wsInstance.onclose) (wsInstance.onclose as () => void)()
      expect(rt.state).toBe('reconnecting')

      vi.advanceTimersByTime(200)
      // New WS created, simulate success again
      if (wsInstance.onopen) (wsInstance.onopen as () => void)()
      expect(rt.state).toBe('connected')

      rt.shutdown()
    })
  })

  // =========================================================================
  // 7. WebSocket endpoint configuration
  // =========================================================================

  describe('WebSocket endpoint', () => {
    it('uses default wss://db.headless.ly/ws endpoint', () => {
      let capturedUrl = ''
      vi.stubGlobal('WebSocket', vi.fn().mockImplementation((url: string) => {
        capturedUrl = url
        return {
          readyState: 0,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        }
      }))

      const rt = new RealtimeManager()
      rt.connect()
      expect(capturedUrl).toBe('wss://db.headless.ly/ws')
      rt.shutdown()
    })

    it('uses custom endpoint when configured', () => {
      let capturedUrl = ''
      vi.stubGlobal('WebSocket', vi.fn().mockImplementation((url: string) => {
        capturedUrl = url
        return {
          readyState: 0,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        }
      }))

      const rt = new RealtimeManager({ endpoint: 'wss://custom.example.com/ws' })
      rt.connect()
      expect(capturedUrl).toBe('wss://custom.example.com/ws')
      rt.shutdown()
    })

    it('includes API key as query parameter when provided', () => {
      let capturedUrl = ''
      vi.stubGlobal('WebSocket', vi.fn().mockImplementation((url: string) => {
        capturedUrl = url
        return {
          readyState: 0,
          onopen: null,
          onmessage: null,
          onclose: null,
          onerror: null,
          close: vi.fn(),
          send: vi.fn(),
        }
      }))

      const rt = new RealtimeManager({ apiKey: 'hl_test_123' })
      rt.connect()
      expect(capturedUrl).toContain('token=hl_test_123')
      rt.shutdown()
    })
  })

  // =========================================================================
  // 8. Forwarding with config init
  // =========================================================================

  describe('Forwarder config initialization', () => {
    it('sets up PostHog forwarder via config', () => {
      const captureSpy = vi.fn()
      ;(window as unknown as Record<string, unknown>).posthog = {
        capture: captureSpy,
        identify: vi.fn(),
        alias: vi.fn(),
        group: vi.fn(),
      }

      client.init({
        apiKey: 'test_key',
        batchSize: 100,
        forwarders: [{ type: 'posthog', apiKey: 'phc_test' }],
      })

      client.track('posthog_test')

      expect(captureSpy).toHaveBeenCalledWith('posthog_test', undefined)
      delete (window as unknown as Record<string, unknown>).posthog
    })

    it('sets up Segment forwarder via config', () => {
      const trackSpy = vi.fn()
      ;(window as unknown as Record<string, unknown>).analytics = {
        track: trackSpy,
        page: vi.fn(),
        identify: vi.fn(),
        alias: vi.fn(),
        group: vi.fn(),
      }

      client.init({
        apiKey: 'test_key',
        batchSize: 100,
        forwarders: [{ type: 'segment', writeKey: 'seg_test' }],
      })

      client.track('segment_test', { item: 'widget' })

      expect(trackSpy).toHaveBeenCalledWith('segment_test', { item: 'widget' })
      delete (window as unknown as Record<string, unknown>).analytics
    })

    it('sets up multiple forwarders via config', () => {
      const gtagSpy = vi.fn()
      const captureSpy = vi.fn()
      ;(window as unknown as Record<string, unknown>).gtag = gtagSpy
      ;(window as unknown as Record<string, unknown>).posthog = {
        capture: captureSpy,
        identify: vi.fn(),
        alias: vi.fn(),
        group: vi.fn(),
      }

      client.init({
        apiKey: 'test_key',
        batchSize: 100,
        forwarders: [
          { type: 'google-analytics', measurementId: 'G-TEST' },
          { type: 'posthog', apiKey: 'phc_test' },
        ],
      })

      client.track('multi_forward')

      expect(gtagSpy).toHaveBeenCalled()
      expect(captureSpy).toHaveBeenCalled()

      delete (window as unknown as Record<string, unknown>).gtag
      delete (window as unknown as Record<string, unknown>).posthog
    })
  })

  // =========================================================================
  // 9. HeadlesslyBrowserOptions
  // =========================================================================

  describe('HeadlesslyBrowserOptions', () => {
    it('headlessly function accepts tenant option', async () => {
      const { headlessly: headlesslyFn, reset: resetFn } = await import('../src/index.js')
      resetFn()
      expect(() => headlesslyFn({ apiKey: 'hl_test', tenant: 'acme' })).not.toThrow()
      resetFn()
    })
  })
})
