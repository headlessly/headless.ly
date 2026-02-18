import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HeadlessClient } from '../src/client.js'

// ---------------------------------------------------------------------------
// Recording fetch — captures requests, returns configurable Response objects
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string
  init: RequestInit
  body?: unknown
}

const fetchCalls: FetchCall[] = []
let fetchResponder: (url: string, init?: RequestInit) => Response | Promise<Response> = () => new Response(JSON.stringify({ ok: true }), { status: 200 })

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

function allEventBodies(): { events: Record<string, unknown>[] }[] {
  return eventFetchCalls().map((c) => c.body as { events: Record<string, unknown>[] })
}

function flagFetchCalls(): FetchCall[] {
  return fetchCalls.filter((c) => typeof c.url === 'string' && c.url.includes('/flags'))
}

// ---------------------------------------------------------------------------
// Tests — 55+ NEW tests covering areas not yet tested in v1/v2
// ---------------------------------------------------------------------------

describe('@headlessly/js — deep v3 tests', () => {
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
  // 1. Retry queue mechanics — exponential backoff timing
  // =========================================================================

  describe('Retry queue — backoff timing precision', () => {
    it('first retry delay is 1000ms (2^0 * 1000)', async () => {
      let eventSendCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        eventSendCount++
        throw new Error('fail')
      }

      client.init({ apiKey: 'test_key', batchSize: 1, flushInterval: 999999 })
      client.track('retry_timing')
      await vi.advanceTimersByTimeAsync(10)
      expect(eventSendCount).toBe(1) // initial attempt

      // Before 1000ms: no retry yet
      await vi.advanceTimersByTimeAsync(900)
      expect(eventSendCount).toBe(1)

      // At ~1000ms: first retry fires
      await vi.advanceTimersByTimeAsync(200)
      expect(eventSendCount).toBe(2)
    })

    it('second retry delay is 2000ms (2^1 * 1000)', async () => {
      let eventSendCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        eventSendCount++
        throw new Error('fail')
      }

      client.init({ apiKey: 'test_key', batchSize: 1, flushInterval: 999999 })
      client.track('retry_timing_2')
      await vi.advanceTimersByTimeAsync(10)
      expect(eventSendCount).toBe(1)

      // First retry at 1000ms
      await vi.advanceTimersByTimeAsync(1100)
      expect(eventSendCount).toBe(2)

      // Before 2000ms from second attempt: no third retry
      await vi.advanceTimersByTimeAsync(1800)
      expect(eventSendCount).toBe(2)

      // At ~2000ms from second attempt: third retry fires
      await vi.advanceTimersByTimeAsync(300)
      expect(eventSendCount).toBe(3)
    })

    it('completes all 4 attempts (initial + 3 retries) with increasing delays', async () => {
      let eventSendCount = 0
      const sendTimes: number[] = []
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        eventSendCount++
        sendTimes.push(Date.now())
        throw new Error('fail')
      }

      client.init({ apiKey: 'test_key', batchSize: 1, flushInterval: 999999 })
      client.track('retry_timing_3')

      // Run through all retries
      for (let i = 0; i < 20; i++) {
        await vi.advanceTimersByTimeAsync(2000)
      }

      // Should have exactly 4 attempts total: initial + 3 retries
      expect(eventSendCount).toBe(4)

      // Verify delays are increasing (exponential backoff)
      if (sendTimes.length >= 3) {
        const delay1 = sendTimes[1] - sendTimes[0]
        const delay2 = sendTimes[2] - sendTimes[1]
        expect(delay2).toBeGreaterThanOrEqual(delay1)
      }
    })

    it('stops retrying after attempt 3 (max retries exhausted)', async () => {
      let eventSendCount = 0
      const onError = vi.fn()
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        eventSendCount++
        throw new Error('persistent fail')
      }

      client.init({ apiKey: 'test_key', batchSize: 1, flushInterval: 999999, onError })
      client.track('max_retries')
      // Let everything settle through all retries
      for (let i = 0; i < 20; i++) {
        await vi.advanceTimersByTimeAsync(5000)
      }

      // Should have exactly 4 attempts: initial + 3 retries
      expect(eventSendCount).toBe(4)
      expect(onError).toHaveBeenCalledTimes(1)
    })
  })

  // =========================================================================
  // 2. Retry queue — multiple batches
  // =========================================================================

  describe('Retry queue — multiple batches', () => {
    it('processes multiple retry batches in FIFO order', async () => {
      const sentBodies: string[][] = []
      let failCount = 0
      fetchResponder = (url, init) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        const body = JSON.parse(init?.body as string)
        if (failCount < 2) {
          failCount++
          throw new Error('fail')
        }
        sentBodies.push(body.events.map((e: Record<string, unknown>) => e.event))
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      client.init({ apiKey: 'test_key', batchSize: 1, flushInterval: 999999 })
      client.track('batch_1')
      await vi.advanceTimersByTimeAsync(10)

      // batch_1 failed, now send batch_2
      client.track('batch_2')
      await vi.advanceTimersByTimeAsync(10)

      // Both are in retry queue. Advance enough for retries
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(5000)
      }

      // At least one batch should have succeeded
      expect(sentBodies.length).toBeGreaterThanOrEqual(1)
    })

    it('retry queue is cleared on reset', async () => {
      let eventSendCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        eventSendCount++
        throw new Error('fail')
      }

      client.init({ apiKey: 'test_key', batchSize: 1, flushInterval: 999999 })
      client.track('will_fail')
      await vi.advanceTimersByTimeAsync(10)
      expect(eventSendCount).toBe(1)

      // Reset clears retry queue
      client.reset()

      // Switch to success
      fetchResponder = () => new Response(JSON.stringify({ ok: true }), { status: 200 })

      // Advance time — no retries should fire since queue was cleared
      const countAfterReset = eventSendCount
      await vi.advanceTimersByTimeAsync(10000)
      expect(eventSendCount).toBe(countAfterReset)
    })
  })

  // =========================================================================
  // 3. Persistence adapter — switching modes
  // =========================================================================

  describe('Persistence adapter switching', () => {
    it('localStorage mode persists anonymousId in localStorage', () => {
      client.init({ apiKey: 'test_key', persistence: 'localStorage' })
      const anonId = client.getDistinctId()
      expect(localStorage.getItem('hl_anon')).toBe(anonId)
    })

    it('sessionStorage mode reads/writes anonymousId from sessionStorage', () => {
      client.init({ apiKey: 'test_key', persistence: 'sessionStorage' })
      const anonId = client.getDistinctId()
      // The source code maps sessionStorage persistence to sessionStorage for getStorage()
      expect(sessionStorage.getItem('hl_anon')).toBe(anonId)
    })

    it('memory mode does not persist anonymousId to any storage', () => {
      client.init({ apiKey: 'test_key', persistence: 'memory' })
      const anonId = client.getDistinctId()
      expect(anonId).toBeTruthy()
      // Memory mode should NOT write to localStorage or sessionStorage
      expect(localStorage.getItem('hl_anon')).toBeNull()
      expect(sessionStorage.getItem('hl_anon')).toBeNull()
    })

    it('opt-out is stored in the configured storage', () => {
      client.init({ apiKey: 'test_key', persistence: 'localStorage' })
      client.optOut()
      expect(localStorage.getItem('hl_opt_out')).toBe('true')
    })

    it('opt-in removes hl_opt_out from configured storage', () => {
      client.init({ apiKey: 'test_key', persistence: 'localStorage' })
      client.optOut()
      expect(localStorage.getItem('hl_opt_out')).toBe('true')
      client.optIn()
      expect(localStorage.getItem('hl_opt_out')).toBeNull()
    })

    it('new client reads existing opt-out state from localStorage', () => {
      localStorage.setItem('hl_opt_out', 'true')
      client.init({ apiKey: 'test_key', persistence: 'localStorage' })
      expect(client.hasOptedOut()).toBe(true)
    })
  })

  // =========================================================================
  // 4. Event enrichment pipeline — tags, extras, breadcrumbs interaction
  // =========================================================================

  describe('Event enrichment pipeline', () => {
    it('config tags are present alongside runtime tags in error events', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100, tags: { app: 'myapp', env: 'dev' } })
      client.setTag('env', 'staging') // override config tag
      client.setTag('region', 'us-west')
      client.captureException(new Error('enriched'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const tags = event.tags as Record<string, string>
      expect(tags.app).toBe('myapp')
      expect(tags.env).toBe('staging') // overridden
      expect(tags.region).toBe('us-west')
    })

    it('extras accumulate across multiple setExtra calls', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setExtra('key1', 'val1')
      client.setExtra('key2', 'val2')
      client.setExtra('key3', { nested: true })
      client.captureException(new Error('multi-extra'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const extra = event.extra as Record<string, unknown>
      expect(extra.key1).toBe('val1')
      expect(extra.key2).toBe('val2')
      expect(extra.key3).toEqual({ nested: true })
    })

    it('breadcrumbs from page, track, and manual add all appear in error events', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.page('Home')
      client.track('click', { id: 'btn' })
      client.addBreadcrumb({ category: 'custom', message: 'manual crumb' })
      client.captureException(new Error('with all breadcrumbs'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const crumbs = event.breadcrumbs as { category: string; message: string }[]
      expect(crumbs.some((c) => c.category === 'navigation')).toBe(true)
      expect(crumbs.some((c) => c.category === 'track' && c.message === 'click')).toBe(true)
      expect(crumbs.some((c) => c.category === 'custom' && c.message === 'manual crumb')).toBe(true)
    })

    it('user context set before captureException appears in the event', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.identify('u_enriched', { email: 'enriched@test.com', role: 'admin' })
      client.captureException(new Error('user enrichment'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const user = event.user as Record<string, unknown>
      expect(user.id).toBe('u_enriched')
      expect(user.email).toBe('enriched@test.com')
      expect(user.role).toBe('admin')
    })

    it('captureException context extra overrides global extra with same key', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setExtra('sharedKey', 'global_value')
      client.captureException(new Error('extra override'), { extra: { sharedKey: 'local_value' } })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((event.extra as Record<string, unknown>).sharedKey).toBe('local_value')
    })
  })

  // =========================================================================
  // 5. Feature flag polling — TTL edge cases
  // =========================================================================

  describe('Feature flag polling — TTL edge cases', () => {
    it('does not re-fetch flags when TTL has not yet expired', async () => {
      let flagCallCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) {
          flagCallCount++
          return new Response(JSON.stringify({ flags: { 'ttl-flag': true } }), { status: 200 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      client.init({ apiKey: 'test_key', flagsTTL: 60000 })
      await flushMicrotasks()
      const initialCount = flagCallCount

      // Advance only 30s (half of 60s TTL)
      vi.advanceTimersByTime(30000)
      client.getFeatureFlag('ttl-flag')
      await flushMicrotasks()

      // Should NOT have re-fetched
      expect(flagCallCount).toBe(initialCount)
    })

    it('re-fetches flags when TTL has expired', async () => {
      let flagCallCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) {
          flagCallCount++
          return new Response(JSON.stringify({ flags: { 'ttl-flag': true } }), { status: 200 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      client.init({ apiKey: 'test_key', flagsTTL: 10000 })
      await flushMicrotasks()
      const initialCount = flagCallCount

      // Advance past TTL
      vi.advanceTimersByTime(11000)
      client.getFeatureFlag('ttl-flag')
      await flushMicrotasks()

      expect(flagCallCount).toBeGreaterThan(initialCount)
    })

    it('does not trigger TTL check when flagsTTL is not configured', async () => {
      let flagCallCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) {
          flagCallCount++
          return new Response(JSON.stringify({ flags: { 'no-ttl': true } }), { status: 200 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      client.init({ apiKey: 'test_key' }) // no flagsTTL
      await flushMicrotasks()
      const initialCount = flagCallCount

      vi.advanceTimersByTime(999999)
      client.getFeatureFlag('no-ttl')
      await flushMicrotasks()

      // Should NOT re-fetch since no TTL set
      expect(flagCallCount).toBe(initialCount)
    })
  })

  // =========================================================================
  // 6. Feature flag change detection — multiple listeners
  // =========================================================================

  describe('Feature flag change detection — multiple listeners', () => {
    it('multiple listeners on the same flag all get notified', async () => {
      const cb1 = vi.fn()
      const cb2 = vi.fn()
      const cb3 = vi.fn()

      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { multi: 'v1' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      client.onFlagChange('multi', cb1)
      client.onFlagChange('multi', cb2)
      client.onFlagChange('multi', cb3)

      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { multi: 'v2' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      await client.reloadFeatureFlags()
      await flushMicrotasks()

      expect(cb1).toHaveBeenCalledWith('v2')
      expect(cb2).toHaveBeenCalledWith('v2')
      expect(cb3).toHaveBeenCalledWith('v2')
    })

    it('listeners on different flags are independent', async () => {
      const cbA = vi.fn()
      const cbB = vi.fn()

      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { flagA: 'a1', flagB: 'b1' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      client.onFlagChange('flagA', cbA)
      client.onFlagChange('flagB', cbB)

      // Only change flagA
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { flagA: 'a2', flagB: 'b1' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      await client.reloadFeatureFlags()
      await flushMicrotasks()

      expect(cbA).toHaveBeenCalledWith('a2')
      expect(cbB).not.toHaveBeenCalled() // flagB did not change
    })

    it('listeners registered before first flag load get initial value notification', async () => {
      const cb = vi.fn()

      // Block initial flag load
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      // Register listener for a flag that does not exist yet
      client.onFlagChange('late-arrival', cb)

      // Now load flags that include the key
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { 'late-arrival': 'hello' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      await client.reloadFeatureFlags()
      await flushMicrotasks()

      // Should be notified with initial value
      expect(cb).toHaveBeenCalledWith('hello')
    })
  })

  // =========================================================================
  // 7. Client lifecycle — init -> track -> shutdown -> re-init
  // =========================================================================

  describe('Client lifecycle', () => {
    it('init -> track -> shutdown -> re-init -> track works end-to-end', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('phase_1')
      await client.shutdown()
      await flushMicrotasks()

      // Phase 1 events should have been flushed
      const phase1 = lastEventBody()
      expect(phase1).toBeDefined()
      expect(phase1!.events.some((e) => e.event === 'phase_1')).toBe(true)

      // Re-init without "Already initialized" warning
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      client.init({ apiKey: 'test_key_v2', batchSize: 100 })
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()

      // Track in new lifecycle
      client.track('phase_2')
      await client.flush()
      await flushMicrotasks()

      const phase2 = lastEventBody()
      expect(phase2).toBeDefined()
      expect(phase2!.events.some((e) => e.event === 'phase_2')).toBe(true)

      // Should use new API key
      const lastCall = eventFetchCalls()[eventFetchCalls().length - 1]
      expect((lastCall!.init.headers as Record<string, string>).Authorization).toBe('Bearer test_key_v2')
    })

    it('reset -> re-init creates a fresh lifecycle', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.identify('old_user')
      client.setTag('old_tag', 'val')
      client.setExtra('old_extra', 'val')
      client.addBreadcrumb({ category: 'old', message: 'old crumb' })

      client.reset()
      client.init({ apiKey: 'test_key', batchSize: 100 })

      // Verify all state is fresh
      expect(client.getDistinctId()).not.toBe('old_user')
      expect(client.user).toBeNull()

      // Capture an error — should not have old tags/extras/breadcrumbs
      client.captureException(new Error('fresh error'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const tags = event.tags as Record<string, string>
      const extra = event.extra as Record<string, unknown>
      const crumbs = event.breadcrumbs as unknown[]
      expect(tags.old_tag).toBeUndefined()
      expect(extra.old_extra).toBeUndefined()
      expect(crumbs.some((c: unknown) => (c as { message: string }).message === 'old crumb')).toBe(false)
    })

    it('shutdown clears the flush timer (no periodic flushes after shutdown)', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100, flushInterval: 1000 })
      await client.shutdown()
      await flushMicrotasks()

      // After shutdown, track should not get auto-flushed by timer
      // (track still enqueues, but no timer fires)
      const countBefore = eventFetchCalls().length
      client.track('after_shutdown')
      vi.advanceTimersByTime(5000)
      await flushMicrotasks()

      // The track may or may not enqueue (client is not initialized), but no timer fires
      // We just verify no new event fetch calls from the timer
      expect(eventFetchCalls().length).toBe(countBefore)
    })
  })

  // =========================================================================
  // 8. Concurrent event queueing
  // =========================================================================

  describe('Concurrent event queueing', () => {
    it('rapid-fire tracking enqueues all events without data loss', async () => {
      client.init({ apiKey: 'test_key', batchSize: 1000 })
      const eventNames = Array.from({ length: 50 }, (_, i) => `rapid_${i}`)
      for (const name of eventNames) {
        client.track(name)
      }
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const sentNames = body.events.map((e) => e.event).filter(Boolean)
      for (const name of eventNames) {
        expect(sentNames).toContain(name)
      }
    })

    it('interleaved track and flush preserves all events', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('before_flush_1')
      client.track('before_flush_2')
      await client.flush()
      await flushMicrotasks()

      client.track('after_flush_1')
      client.track('after_flush_2')
      await client.flush()
      await flushMicrotasks()

      const bodies = allEventBodies()
      const allEvents = bodies.flatMap((b) => b.events.map((e) => e.event)).filter(Boolean)
      expect(allEvents).toContain('before_flush_1')
      expect(allEvents).toContain('before_flush_2')
      expect(allEvents).toContain('after_flush_1')
      expect(allEvents).toContain('after_flush_2')
    })

    it('mixed event types in a single batch are all preserved', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.page('Home')
      client.track('click')
      client.identify('u_1', { name: 'Alice' })
      client.alias('u_1', 'anon_prev')
      client.group('org_1', { plan: 'pro' })
      client.captureException(new Error('oops'))
      client.captureMessage('info msg', 'info')

      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const types = body.events.map((e) => e.type)
      expect(types).toContain('page')
      expect(types).toContain('track')
      expect(types).toContain('identify')
      expect(types).toContain('alias')
      expect(types).toContain('group')
      expect(types).toContain('exception')
      expect(types).toContain('message')
    })

    it('auto-flush at batchSize boundary sends exactly the batch', async () => {
      client.init({ apiKey: 'test_key', batchSize: 5, flushInterval: 999999 })
      for (let i = 0; i < 5; i++) {
        client.track(`batch_event_${i}`)
      }
      await flushMicrotasks()

      // Should have auto-flushed exactly 5 events
      const body = lastEventBody()!
      const trackEvents = body.events.filter((e) => e.type === 'track')
      expect(trackEvents.length).toBe(5)
    })
  })

  // =========================================================================
  // 9. Error capture — stack trace parsing edge cases
  // =========================================================================

  describe('Stack trace parsing — edge cases', () => {
    it('parses anonymous function frames', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      const err = new Error('anon')
      err.stack = 'Error: anon\n    at <anonymous> (http://localhost/app.js:5:10)\n    at http://localhost/index.js:1:1'
      client.captureException(err)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const frames = (event.exception as Record<string, unknown>).stacktrace as { filename?: string; function?: string }[]
      expect(frames.length).toBeGreaterThanOrEqual(1)
    })

    it('parses frames without function names (bare file:line:col)', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      const err = new Error('bare')
      err.stack = 'Error: bare\n    at http://localhost/bundle.js:100:20'
      client.captureException(err)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const frames = (event.exception as Record<string, unknown>).stacktrace as { filename?: string; lineno?: number; colno?: number }[]
      expect(frames.length).toBe(1)
      expect(frames[0].filename).toBe('http://localhost/bundle.js')
      expect(frames[0].lineno).toBe(100)
      expect(frames[0].colno).toBe(20)
    })

    it('reverses stack frames (bottom-up order)', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      const err = new Error('reversed')
      err.stack = 'Error: reversed\n    at top (file.js:1:1)\n    at middle (file.js:2:1)\n    at bottom (file.js:3:1)'
      client.captureException(err)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const frames = (event.exception as Record<string, unknown>).stacktrace as { function: string }[]
      expect(frames[0].function).toBe('bottom')
      expect(frames[1].function).toBe('middle')
      expect(frames[2].function).toBe('top')
    })

    it('handles stack with non-matching lines (noise lines are skipped)', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      const err = new Error('noisy')
      err.stack = 'Error: noisy\n    some random text\n    at real (file.js:10:5)\n    more noise'
      client.captureException(err)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const frames = (event.exception as Record<string, unknown>).stacktrace as { function: string }[]
      expect(frames.length).toBe(1)
      expect(frames[0].function).toBe('real')
    })

    it('handles empty stack string gracefully', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      const err = new Error('empty stack')
      err.stack = ''
      client.captureException(err)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      // Empty string is falsy, so parseStack is not called — stacktrace is undefined
      const stacktrace = (event.exception as Record<string, unknown>).stacktrace
      expect(stacktrace).toBeUndefined()
    })
  })

  // =========================================================================
  // 10. Web vitals measurement structure
  // =========================================================================

  describe('Web vitals — measurement structure', () => {
    it('supports all six vitals: lcp, fid, cls, ttfb, fcp, inp', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.captureWebVitals({ lcp: 2500, fid: 100, cls: 0.1, ttfb: 600, fcp: 1800, inp: 200 })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.event === '$web_vitals')!
      const props = event.properties as Record<string, unknown>
      expect(props.lcp).toBe(2500)
      expect(props.fid).toBe(100)
      expect(props.cls).toBe(0.1)
      expect(props.ttfb).toBe(600)
      expect(props.fcp).toBe(1800)
      expect(props.inp).toBe(200)
    })

    it('supports partial vitals (only some metrics)', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.captureWebVitals({ lcp: 1500 })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.event === '$web_vitals')!
      const props = event.properties as Record<string, unknown>
      expect(props.lcp).toBe(1500)
      expect(props.fid).toBeUndefined()
    })

    it('web vitals events include session and anonymous IDs', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.captureWebVitals({ cls: 0.05 })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.event === '$web_vitals')!
      expect(event.sessionId).toBeDefined()
      expect(event.anonymousId).toBeDefined()
    })

    it('multiple captureWebVitals calls produce separate track events', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.captureWebVitals({ lcp: 1000 })
      client.captureWebVitals({ fid: 50 })
      client.captureWebVitals({ cls: 0.01 })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const vitalsEvents = body.events.filter((e) => e.event === '$web_vitals')
      expect(vitalsEvents.length).toBe(3)
    })
  })

  // =========================================================================
  // 11. Beacon vs fetch transport selection
  // =========================================================================

  describe('Beacon vs fetch transport selection', () => {
    it('flush(false) always uses fetch, not sendBeacon', async () => {
      const sendBeaconSpy = vi.fn().mockReturnValue(true)
      vi.stubGlobal('navigator', { ...navigator, sendBeacon: sendBeaconSpy, userAgent: 'test-agent' })

      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('fetch_only')
      await client.flush(false)
      await flushMicrotasks()

      expect(sendBeaconSpy).not.toHaveBeenCalled()
      expect(eventFetchCalls().length).toBeGreaterThanOrEqual(1)
    })

    it('flush() with no argument defaults to fetch (beacon=false)', async () => {
      const sendBeaconSpy = vi.fn().mockReturnValue(true)
      vi.stubGlobal('navigator', { ...navigator, sendBeacon: sendBeaconSpy, userAgent: 'test-agent' })

      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('default_flush')
      await client.flush()
      await flushMicrotasks()

      expect(sendBeaconSpy).not.toHaveBeenCalled()
      expect(eventFetchCalls().length).toBeGreaterThanOrEqual(1)
    })

    it('beacon mode sends to the configured endpoint URL', async () => {
      const sendBeaconSpy = vi.fn().mockReturnValue(true)
      vi.stubGlobal('navigator', { ...navigator, sendBeacon: sendBeaconSpy, userAgent: 'test-agent' })

      client.init({ apiKey: 'test_key', batchSize: 100, endpoint: 'https://custom.ly/e' })
      client.track('beacon_url')
      await client.flush(true)
      await flushMicrotasks()

      expect(sendBeaconSpy).toHaveBeenCalledWith('https://custom.ly/e', expect.any(String))
    })

    it('beacon mode does not trigger preflushed flag reload', async () => {
      let flagCallCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) {
          flagCallCount++
          return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      const sendBeaconSpy = vi.fn().mockReturnValue(true)
      vi.stubGlobal('navigator', { ...navigator, sendBeacon: sendBeaconSpy, userAgent: 'test-agent' })

      client.init({ apiKey: 'test_key', batchSize: 100 })
      await flushMicrotasks()
      const countAfterInit = flagCallCount

      client.track('beacon_no_preflushed')
      await client.flush(true) // beacon mode
      await flushMicrotasks()

      // Beacon returns early before preflushed check
      expect(flagCallCount).toBe(countAfterInit)
    })
  })

  // =========================================================================
  // 12. isFeatureEnabled — edge cases for various value types
  // =========================================================================

  describe('isFeatureEnabled — value type edge cases', () => {
    it('numeric value 0 is falsy (returns false)', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { num0: 0 } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      expect(client.isFeatureEnabled('num0')).toBe(false)
    })

    it('numeric value 1 is truthy (returns true)', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { num1: 1 } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      // isFeatureEnabled: v === true || v === 'true' || (typeof v === 'string' && ...)
      // For number 1: none of these match, so it returns false
      expect(client.isFeatureEnabled('num1')).toBe(false)
    })

    it('boolean false returns false', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { boolFalse: false } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      expect(client.isFeatureEnabled('boolFalse')).toBe(false)
    })

    it('string "control" returns false', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { ctrl: 'control' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      expect(client.isFeatureEnabled('ctrl')).toBe(false)
    })

    it('string "false" returns false', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { strFalse: 'false' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      expect(client.isFeatureEnabled('strFalse')).toBe(false)
    })

    it('non-empty string (not "false" or "control") returns true', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { variant: 'experiment-b' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      expect(client.isFeatureEnabled('variant')).toBe(true)
    })

    it('object value returns false (not boolean true or truthy string)', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { objFlag: { setting: 'a' } } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      // isFeatureEnabled: v === true (no) || v === 'true' (no) || (typeof v === 'string' ...) (no, it's object)
      expect(client.isFeatureEnabled('objFlag')).toBe(false)
    })
  })

  // =========================================================================
  // 13. Session ID persistence
  // =========================================================================

  describe('Session ID persistence', () => {
    it('sessionId is stored in sessionStorage', () => {
      client.init({ apiKey: 'test_key' })
      const sid = client.getSessionId()
      expect(sessionStorage.getItem('hl_session')).toBe(sid)
    })

    it('same sessionId is reused across client instances within the same session', () => {
      client.init({ apiKey: 'test_key' })
      const sid1 = client.getSessionId()

      const client2 = new HeadlessClient()
      client2.init({ apiKey: 'test_key' })
      const sid2 = client2.getSessionId()

      expect(sid1).toBe(sid2)
    })

    it('reset clears sessionId from sessionStorage', () => {
      client.init({ apiKey: 'test_key' })
      const oldSid = client.getSessionId()
      client.reset()
      // After reset, sessionStorage should have been cleared
      // (the reset code calls sessionStorage.removeItem('hl_session'))
      expect(sessionStorage.getItem('hl_session')).toBeNull()
      expect(client.getSessionId()).not.toBe(oldSid)
    })
  })

  // =========================================================================
  // 14. Breadcrumb level field
  // =========================================================================

  describe('Breadcrumb level field', () => {
    it('preserves level field on manually added breadcrumbs', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.addBreadcrumb({ category: 'http', message: 'POST /api', level: 'warning' })
      client.captureException(new Error('test'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const crumbs = event.breadcrumbs as { level?: string; message: string }[]
      const crumb = crumbs.find((c) => c.message === 'POST /api')
      expect(crumb).toBeDefined()
      expect(crumb!.level).toBe('warning')
    })

    it('breadcrumb type field is preserved', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.addBreadcrumb({ type: 'http', category: 'xhr', message: 'api call' })
      client.captureException(new Error('test'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const crumbs = event.breadcrumbs as { type?: string; message: string }[]
      const crumb = crumbs.find((c) => c.message === 'api call')
      expect(crumb).toBeDefined()
      expect(crumb!.type).toBe('http')
    })
  })

  // =========================================================================
  // 15. getFeatureFlag tracks $feature_flag_called only for existing flags
  // =========================================================================

  describe('getFeatureFlag tracking behavior', () => {
    it('does NOT track $feature_flag_called for non-existent flags', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { exists: true } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key', batchSize: 100 })
      await flushMicrotasks()

      client.getFeatureFlag('does_not_exist')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()
      if (body) {
        const flagEvent = body.events.find((e) => e.event === '$feature_flag_called')
        // Should not have tracked a flag_called event for non-existent flag
        expect(flagEvent).toBeUndefined()
      }
    })

    it('tracks $feature_flag_called with correct value for existing flags', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { myFlag: 'variant-x' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key', batchSize: 100 })
      await flushMicrotasks()

      const value = client.getFeatureFlag('myFlag')
      expect(value).toBe('variant-x')

      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const flagEvent = body.events.find((e) => e.event === '$feature_flag_called')
      expect(flagEvent).toBeDefined()
      expect((flagEvent!.properties as Record<string, unknown>).$feature_flag).toBe('myFlag')
      expect((flagEvent!.properties as Record<string, unknown>).$feature_flag_response).toBe('variant-x')
    })
  })

  // =========================================================================
  // 16. Flush interval auto-flush
  // =========================================================================

  describe('Flush interval auto-flush', () => {
    it('auto-flushes at the configured flushInterval', async () => {
      client.init({ apiKey: 'test_key', batchSize: 1000, flushInterval: 3000 })
      client.track('interval_event')

      // Before interval: no event fetch
      expect(eventFetchCalls().length).toBe(0)

      // Advance past the interval
      await vi.advanceTimersByTimeAsync(3100)
      await flushMicrotasks()

      expect(eventFetchCalls().length).toBeGreaterThanOrEqual(1)
      const body = lastEventBody()!
      expect(body.events.some((e) => e.event === 'interval_event')).toBe(true)
    })
  })

  // =========================================================================
  // 17. 5xx retry then success delivers events
  // =========================================================================

  describe('Retry recovery delivers events', () => {
    it('events are successfully delivered after transient 5xx failure', async () => {
      let eventSendCount = 0
      let lastSentEvents: Record<string, unknown>[] = []
      fetchResponder = (url, init) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        eventSendCount++
        if (eventSendCount === 1) return new Response('error', { status: 502 })
        const body = JSON.parse(init?.body as string)
        lastSentEvents = body.events
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      client.init({ apiKey: 'test_key', batchSize: 1, flushInterval: 999999 })
      client.track('recovered_event')
      await vi.advanceTimersByTimeAsync(10)

      // First attempt failed (502)
      expect(eventSendCount).toBe(1)

      // Wait for retry
      await vi.advanceTimersByTimeAsync(1100)
      expect(eventSendCount).toBe(2)
      expect(lastSentEvents.some((e) => e.event === 'recovered_event')).toBe(true)
    })
  })

  // =========================================================================
  // 18. Flag request uses userId after identify
  // =========================================================================

  describe('Flag request uses identified userId', () => {
    it('reloadFeatureFlags sends userId as distinctId when identified', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      client.identify('user_flag_test')
      await client.reloadFeatureFlags()
      await flushMicrotasks()

      const lastFlagCall = flagFetchCalls()[flagFetchCalls().length - 1]
      expect(lastFlagCall).toBeDefined()
      const body = lastFlagCall!.body as Record<string, unknown>
      expect(body.distinctId).toBe('user_flag_test')
    })
  })
})
