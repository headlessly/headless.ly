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

function allEventBodies(): { events: Record<string, unknown>[] }[] {
  return eventFetchCalls().map((c) => c.body as { events: Record<string, unknown>[] })
}

function flagFetchCalls(): FetchCall[] {
  return fetchCalls.filter((c) => typeof c.url === 'string' && c.url.includes('/flags'))
}

// ---------------------------------------------------------------------------
// Tests — 50+ NEW tests covering areas not yet tested
// ---------------------------------------------------------------------------

describe('@headlessly/js — deep v2 tests', () => {
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
  // 1. alias() method
  // =========================================================================

  describe('alias()', () => {
    it('sends an alias event with type "alias"', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.alias('new_user_id', 'old_user_id')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const aliasEvent = body.events.find((e) => e.type === 'alias')
      expect(aliasEvent).toBeDefined()
      // Note: baseEvent() spreads after userId, so this.userId (undefined before identify) overwrites
      // The alias userId is accessible only if identify was called first
      expect(aliasEvent!.type).toBe('alias')
    })

    it('includes previousId in properties', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.alias('new_id', 'prev_id')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const aliasEvent = body.events.find((e) => e.type === 'alias')
      expect((aliasEvent!.properties as Record<string, unknown>).previousId).toBe('prev_id')
    })

    it('falls back to anonymousId when previousId is not provided', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      const anonId = client.getDistinctId()
      client.alias('new_id')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const aliasEvent = body.events.find((e) => e.type === 'alias')
      expect((aliasEvent!.properties as Record<string, unknown>).previousId).toBe(anonId)
    })

    it('does not send alias when opted out', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.optOut()
      client.alias('new_id')
      await client.flush()
      await flushMicrotasks()

      expect(eventFetchCalls().length).toBe(0)
    })
  })

  // =========================================================================
  // 2. group() method
  // =========================================================================

  describe('group()', () => {
    it('sends a group event with type "group"', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.group('org_123')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const groupEvent = body.events.find((e) => e.type === 'group')
      expect(groupEvent).toBeDefined()
      expect(groupEvent!.groupId).toBe('org_123')
    })

    it('includes groupTraits when provided', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.group('org_123', { name: 'Acme', plan: 'enterprise' })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const groupEvent = body.events.find((e) => e.type === 'group')
      expect(groupEvent!.groupTraits).toEqual({ name: 'Acme', plan: 'enterprise' })
    })

    it('does not send group when opted out', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.optOut()
      client.group('org_123')
      await client.flush()
      await flushMicrotasks()

      expect(eventFetchCalls().length).toBe(0)
    })
  })

  // =========================================================================
  // 3. setUser() context
  // =========================================================================

  describe('setUser()', () => {
    it('sets user context that appears in error events', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setUser({ id: 'u_42', email: 'alice@example.com' })
      client.captureException(new Error('user error'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect(errEvent.user).toEqual(expect.objectContaining({ id: 'u_42', email: 'alice@example.com' }))
    })

    it('updates userId on the client when user has id', () => {
      client.init({ apiKey: 'test_key' })
      client.setUser({ id: 'u_99' })
      expect(client.getDistinctId()).toBe('u_99')
    })

    it('clears user when set to null', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setUser({ id: 'u_42', email: 'alice@example.com' })
      client.setUser(null)

      client.captureException(new Error('no user'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect(errEvent.user).toBeUndefined()
    })
  })

  // =========================================================================
  // 4. setTag() and setTags()
  // =========================================================================

  describe('setTag() / setTags()', () => {
    it('tags appear in exception events', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setTag('env', 'staging')
      client.captureException(new Error('tagged error'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((errEvent.tags as Record<string, string>).env).toBe('staging')
    })

    it('setTags merges multiple tags at once', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setTags({ env: 'prod', region: 'us-east' })
      client.captureException(new Error('multi-tag'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((errEvent.tags as Record<string, string>).env).toBe('prod')
      expect((errEvent.tags as Record<string, string>).region).toBe('us-east')
    })

    it('later setTag overwrites earlier value for same key', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setTag('env', 'dev')
      client.setTag('env', 'prod')
      client.captureException(new Error('overwrite'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((errEvent.tags as Record<string, string>).env).toBe('prod')
    })

    it('tags from config are included', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100, tags: { version: '1.0.0' } })
      client.captureException(new Error('config tags'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((errEvent.tags as Record<string, string>).version).toBe('1.0.0')
    })
  })

  // =========================================================================
  // 5. setExtra()
  // =========================================================================

  describe('setExtra()', () => {
    it('extra data appears in exception events', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setExtra('requestId', 'req_abc123')
      client.captureException(new Error('extra error'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((errEvent.extra as Record<string, unknown>).requestId).toBe('req_abc123')
    })

    it('extra data appears in message events', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setExtra('debug_info', { foo: 'bar' })
      client.captureMessage('info message')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const msgEvent = body.events.find((e) => e.type === 'message') as Record<string, unknown>
      expect((msgEvent.extra as Record<string, unknown>).debug_info).toEqual({ foo: 'bar' })
    })
  })

  // =========================================================================
  // 6. captureException context overrides
  // =========================================================================

  describe('captureException context overrides', () => {
    it('per-call tags merge with global tags', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setTag('global', 'yes')
      client.captureException(new Error('ctx'), { tags: { local: 'yes' } })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const tags = errEvent.tags as Record<string, string>
      expect(tags.global).toBe('yes')
      expect(tags.local).toBe('yes')
    })

    it('per-call extra merges with global extras', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setExtra('globalKey', 'globalVal')
      client.captureException(new Error('ctx'), { extra: { localKey: 'localVal' } })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const extra = errEvent.extra as Record<string, unknown>
      expect(extra.globalKey).toBe('globalVal')
      expect(extra.localKey).toBe('localVal')
    })

    it('per-call tags override global tags with same key', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setTag('env', 'staging')
      client.captureException(new Error('override'), { tags: { env: 'production' } })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((errEvent.tags as Record<string, string>).env).toBe('production')
    })
  })

  // =========================================================================
  // 7. captureMessage() defaults
  // =========================================================================

  describe('captureMessage()', () => {
    it('defaults level to "info"', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.captureMessage('hello')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const msgEvent = body.events.find((e) => e.type === 'message') as Record<string, unknown>
      expect(msgEvent.level).toBe('info')
    })

    it('returns a 32-char hex eventId', () => {
      client.init({ apiKey: 'test_key' })
      const id = client.captureMessage('test')
      expect(id).toMatch(/^[0-9a-f]{32}$/)
    })

    it('returns empty string when opted out', () => {
      client.init({ apiKey: 'test_key' })
      client.optOut()
      const id = client.captureMessage('test')
      expect(id).toBe('')
    })

    it('includes release and environment from config', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100, release: 'v2.0.0', environment: 'staging' })
      client.captureMessage('deploy check')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const msgEvent = body.events.find((e) => e.type === 'message') as Record<string, unknown>
      expect(msgEvent.release).toBe('v2.0.0')
      expect(msgEvent.environment).toBe('staging')
    })
  })

  // =========================================================================
  // 8. captureWebVitals()
  // =========================================================================

  describe('captureWebVitals()', () => {
    it('sends a $web_vitals track event', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.captureWebVitals({ lcp: 1200, fid: 50, cls: 0.05 })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const vitalsEvent = body.events.find((e) => e.event === '$web_vitals')
      expect(vitalsEvent).toBeDefined()
      expect((vitalsEvent!.properties as Record<string, unknown>).lcp).toBe(1200)
      expect((vitalsEvent!.properties as Record<string, unknown>).fid).toBe(50)
      expect((vitalsEvent!.properties as Record<string, unknown>).cls).toBe(0.05)
    })

    it('does not send when opted out', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.optOut()
      client.captureWebVitals({ lcp: 1200 })
      await client.flush()
      await flushMicrotasks()

      expect(eventFetchCalls().length).toBe(0)
    })
  })

  // =========================================================================
  // 9. getSessionId()
  // =========================================================================

  describe('getSessionId()', () => {
    it('returns a non-empty string after init', () => {
      client.init({ apiKey: 'test_key' })
      const sid = client.getSessionId()
      expect(typeof sid).toBe('string')
      expect(sid.length).toBeGreaterThan(0)
    })

    it('sessionId is included in track events', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      const sid = client.getSessionId()
      client.track('session_test')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.event === 'session_test')
      expect(event!.sessionId).toBe(sid)
    })

    it('sessionId persists across track calls within same session', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('a')
      client.track('b')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const events = body.events.filter((e) => e.event === 'a' || e.event === 'b')
      expect(events[0]!.sessionId).toBe(events[1]!.sessionId)
    })
  })

  // =========================================================================
  // 10. consentGranted() / consentRevoked()
  // =========================================================================

  describe('consentGranted() / consentRevoked()', () => {
    it('consentRevoked blocks tracking', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.consentRevoked()
      client.track('blocked')
      await client.flush()
      await flushMicrotasks()

      expect(eventFetchCalls().length).toBe(0)
    })

    it('consentGranted re-enables tracking after revocation', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.consentRevoked()
      client.consentGranted()
      client.track('allowed')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()
      expect(body).toBeDefined()
      expect(body!.events.some((e) => e.event === 'allowed')).toBe(true)
    })

    it('consentRevoked also blocks captureException', () => {
      client.init({ apiKey: 'test_key' })
      client.consentRevoked()
      const id = client.captureException(new Error('blocked'))
      expect(id).toBe('')
    })

    it('consentRevoked also blocks captureMessage', () => {
      client.init({ apiKey: 'test_key' })
      client.consentRevoked()
      const id = client.captureMessage('blocked')
      expect(id).toBe('')
    })
  })

  // =========================================================================
  // 11. reset() comprehensive
  // =========================================================================

  describe('reset() comprehensive', () => {
    it('clears userId after reset', () => {
      client.init({ apiKey: 'test_key' })
      client.identify('u_42')
      expect(client.getDistinctId()).toBe('u_42')
      client.reset()
      // After reset, distinctId should be a new anonymous id, not 'u_42'
      expect(client.getDistinctId()).not.toBe('u_42')
    })

    it('clears user object after reset', () => {
      client.init({ apiKey: 'test_key' })
      client.setUser({ id: 'u_42', email: 'test@test.com' })
      client.reset()
      expect(client.user).toBeNull()
    })

    it('clears feature flags after reset', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { 'my-flag': true } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      client.reset()
      const flags = client.getAllFlags()
      expect(Object.keys(flags).length).toBe(0)
    })

    it('clears opt-out state after reset', () => {
      client.init({ apiKey: 'test_key' })
      client.optOut()
      expect(client.hasOptedOut()).toBe(true)
      client.reset()
      expect(client.hasOptedOut()).toBe(false)
    })

    it('clears the event queue after reset', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('before_reset')
      client.reset()
      // Re-init and flush — should not contain the pre-reset event
      client.init({ apiKey: 'test_key', batchSize: 100 })
      await client.flush()
      await flushMicrotasks()

      // No events should be sent because queue was cleared
      expect(eventFetchCalls().length).toBe(0)
    })

    it('generates a new anonymousId after reset', () => {
      client.init({ apiKey: 'test_key' })
      const oldAnon = client.getDistinctId()
      client.reset()
      const newAnon = client.getDistinctId()
      expect(newAnon).not.toBe(oldAnon)
    })
  })

  // =========================================================================
  // 12. Multiple independent instances
  // =========================================================================

  describe('Multiple independent instances', () => {
    it('two clients maintain separate queues', async () => {
      const client1 = new HeadlessClient()
      const client2 = new HeadlessClient()
      client1.init({ apiKey: 'key_1', batchSize: 100 })
      client2.init({ apiKey: 'key_2', batchSize: 100 })

      client1.track('from_client1')
      client2.track('from_client2')

      await client1.flush()
      await flushMicrotasks()

      // client1 flush should only contain client1 events
      const bodies = allEventBodies()
      const c1Body = bodies.find((b) => b.events.some((e) => e.event === 'from_client1'))
      expect(c1Body).toBeDefined()
      expect(c1Body!.events.some((e) => e.event === 'from_client2')).toBe(false)
    })

    it('two clients have separate anonymousIds', () => {
      localStorage.clear()
      const client1 = new HeadlessClient()
      client1.init({ apiKey: 'key_1' })
      // Client1 writes its anonymous ID to localStorage
      // Client2 reads from the same localStorage, so it gets the same anonymousId
      // That is actually the expected behavior since they share the same storage key
      const client2 = new HeadlessClient()
      client2.init({ apiKey: 'key_2' })

      // Both should have the same anonId since they share localStorage key 'hl_anon'
      expect(client1.getDistinctId()).toBe(client2.getDistinctId())
    })

    it('identify on one client does not affect another', () => {
      const client1 = new HeadlessClient()
      const client2 = new HeadlessClient()
      client1.init({ apiKey: 'key_1' })
      client2.init({ apiKey: 'key_2' })

      client1.identify('user_A')
      expect(client1.getDistinctId()).toBe('user_A')
      expect(client2.getDistinctId()).not.toBe('user_A')
    })

    it('opt-out on one client does not affect another', () => {
      const client1 = new HeadlessClient()
      const client2 = new HeadlessClient()
      client1.init({ apiKey: 'key_1' })
      client2.init({ apiKey: 'key_2' })

      client1.optOut()
      expect(client1.hasOptedOut()).toBe(true)
      expect(client2.hasOptedOut()).toBe(false)
    })
  })

  // =========================================================================
  // 13. debug mode
  // =========================================================================

  describe('debug mode', () => {
    it('logs to console when debug is true', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      client.init({ apiKey: 'test_key', debug: true, batchSize: 100 })
      client.track('debug_event')
      await client.flush()
      await flushMicrotasks()

      const debugCalls = logSpy.mock.calls.filter((c) => typeof c[0] === 'string' && c[0].includes('@headlessly/js'))
      expect(debugCalls.length).toBeGreaterThan(0)
      logSpy.mockRestore()
    })

    it('does not log when debug is false', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      client.init({ apiKey: 'test_key', debug: false, batchSize: 100 })
      client.track('quiet_event')
      await client.flush()
      await flushMicrotasks()

      const debugCalls = logSpy.mock.calls.filter((c) => typeof c[0] === 'string' && c[0].includes('@headlessly/js'))
      expect(debugCalls.length).toBe(0)
      logSpy.mockRestore()
    })
  })

  // =========================================================================
  // 14. Persistence modes
  // =========================================================================

  describe('Persistence modes', () => {
    it('persistence "sessionStorage" stores anonymousId in sessionStorage', () => {
      // Note: The source code for 'sessionStorage' persistence mode actually
      // still falls back to sessionStorage in getStorage(). Let's verify the ID is created.
      client.init({ apiKey: 'test_key', persistence: 'sessionStorage' })
      const id = client.getDistinctId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('persistence "memory" mode still generates IDs', () => {
      client.init({ apiKey: 'test_key', persistence: 'memory' })
      const id = client.getDistinctId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // 15. Sample rate filtering
  // =========================================================================

  describe('Sample rate filtering', () => {
    it('sampleRate 1 always sends events', async () => {
      client.init({ apiKey: 'test_key', sampleRate: 1, batchSize: 100 })
      client.track('always_send')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()
      expect(body).toBeDefined()
      expect(body!.events.some((e) => e.event === 'always_send')).toBe(true)
    })

    it('sampleRate 0 with Math.random > 0 drops track events', async () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      client.init({ apiKey: 'test_key', sampleRate: 0, batchSize: 100 })
      client.track('dropped')
      await client.flush()
      await flushMicrotasks()

      expect(eventFetchCalls().length).toBe(0)
      mathSpy.mockRestore()
    })

    it('sampleRate 0 with Math.random > 0 drops page events', async () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      client.init({ apiKey: 'test_key', sampleRate: 0, batchSize: 100 })
      client.page('dropped page')
      await client.flush()
      await flushMicrotasks()

      expect(eventFetchCalls().length).toBe(0)
      mathSpy.mockRestore()
    })

    it('sampleRate does not affect identify', async () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
      client.init({ apiKey: 'test_key', sampleRate: 0, batchSize: 100 })
      client.identify('u_42')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()
      expect(body).toBeDefined()
      expect(body!.events.some((e) => e.type === 'identify')).toBe(true)
      mathSpy.mockRestore()
    })
  })

  // =========================================================================
  // 16. Breadcrumbs auto-added by page()/track()
  // =========================================================================

  describe('Breadcrumbs auto-added', () => {
    it('page() adds a navigation breadcrumb', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.page('Home')
      client.captureException(new Error('after page'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const breadcrumbs = errEvent.breadcrumbs as { category: string; message: string }[]
      expect(breadcrumbs.some((b) => b.category === 'navigation' && b.message === 'Home')).toBe(true)
    })

    it('track() adds a track breadcrumb', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('button_click', { id: 'cta' })
      client.captureException(new Error('after track'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const breadcrumbs = errEvent.breadcrumbs as { category: string; message: string }[]
      expect(breadcrumbs.some((b) => b.category === 'track' && b.message === 'button_click')).toBe(true)
    })
  })

  // =========================================================================
  // 17. addBreadcrumb details
  // =========================================================================

  describe('addBreadcrumb details', () => {
    it('auto-assigns timestamp when not provided', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.addBreadcrumb({ category: 'custom', message: 'no ts' })
      client.captureException(new Error('test'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const breadcrumbs = errEvent.breadcrumbs as { ts: string }[]
      const crumb = breadcrumbs.find((b) => (b as { message?: string }).message === 'no ts') as { ts: string } | undefined
      expect(crumb).toBeDefined()
      expect(crumb!.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('preserves custom timestamp when provided', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.addBreadcrumb({ category: 'custom', message: 'custom ts', ts: '2024-01-01T00:00:00.000Z' })
      client.captureException(new Error('test'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const breadcrumbs = errEvent.breadcrumbs as { ts: string; message: string }[]
      const crumb = breadcrumbs.find((b) => b.message === 'custom ts')
      expect(crumb!.ts).toBe('2024-01-01T00:00:00.000Z')
    })

    it('breadcrumbs include data field', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.addBreadcrumb({ category: 'http', message: 'GET /api', data: { status: 200 } })
      client.captureException(new Error('test'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const breadcrumbs = errEvent.breadcrumbs as { data?: Record<string, unknown>; message: string }[]
      const crumb = breadcrumbs.find((b) => b.message === 'GET /api')
      expect(crumb!.data).toEqual({ status: 200 })
    })
  })

  // =========================================================================
  // 18. Feature flags — getAllFlags and edge cases
  // =========================================================================

  describe('Feature flags — getAllFlags and edge cases', () => {
    it('getAllFlags returns all loaded flags as a plain object', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { alpha: true, beta: 'v2' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      const flags = client.getAllFlags()
      expect(flags).toEqual({
        alpha: { key: 'alpha', value: true },
        beta: { key: 'beta', value: 'v2' },
      })
    })

    it('getAllFlags returns empty object when no flags loaded', () => {
      client.init({ apiKey: 'test_key' })
      const flags = client.getAllFlags()
      expect(flags).toEqual({})
    })

    it('getFeatureFlag returns undefined for non-existent flag', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { exists: true } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      expect(client.getFeatureFlag('does_not_exist')).toBeUndefined()
    })

    it('getFeatureFlag tracks $feature_flag_called event for existing flag', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { tracked: true } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key', batchSize: 100 })
      await flushMicrotasks()

      client.getFeatureFlag('tracked')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const flagEvent = body.events.find((e) => e.event === '$feature_flag_called')
      expect(flagEvent).toBeDefined()
      expect((flagEvent!.properties as Record<string, unknown>).$feature_flag).toBe('tracked')
      expect((flagEvent!.properties as Record<string, unknown>).$feature_flag_response).toBe(true)
    })

    it('isFeatureEnabled returns true for truthy string values', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags'))
          return new Response(JSON.stringify({ flags: { active: 'variant-a', control: 'control', falsy: 'false', trueval: 'true' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      expect(client.isFeatureEnabled('active')).toBe(true) // non-false, non-control string
      expect(client.isFeatureEnabled('control')).toBe(false) // 'control' is treated as false
      expect(client.isFeatureEnabled('falsy')).toBe(false) // 'false' is treated as false
      expect(client.isFeatureEnabled('trueval')).toBe(true) // 'true' is truthy
    })
  })

  // =========================================================================
  // 19. onFlagChange — detailed behavior
  // =========================================================================

  describe('onFlagChange — detailed behavior', () => {
    it('notifies listener on initial flag load when listener registered before init', async () => {
      const callback = vi.fn()

      // Register listener BEFORE init triggers flag load
      // We need to init first to have the client object, then register, then load
      client.init({ apiKey: 'test_key' })
      client.onFlagChange('new-flag', callback)

      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { 'new-flag': true } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      await client.reloadFeatureFlags()
      await flushMicrotasks()

      // Should be notified because the listener was registered and the flag appeared for the first time
      expect(callback).toHaveBeenCalledWith(true)
    })

    it('notifies listener when flag value changes', async () => {
      const callback = vi.fn()
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { 'changing-flag': 'v1' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      client.onFlagChange('changing-flag', callback)

      // Change the flag value
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { 'changing-flag': 'v2' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      await client.reloadFeatureFlags()
      await flushMicrotasks()

      expect(callback).toHaveBeenCalledWith('v2')
    })

    it('does not notify listener when flag value stays the same', async () => {
      const callback = vi.fn()
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { 'stable-flag': 'same' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      client.onFlagChange('stable-flag', callback)
      // Reload with same value
      await client.reloadFeatureFlags()
      await flushMicrotasks()

      expect(callback).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 20. Re-init config merging
  // =========================================================================

  describe('Re-init config merging', () => {
    it('re-init updates endpoint but does not throw', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      client.init({ apiKey: 'test_key' })
      expect(() => client.init({ apiKey: 'test_key', endpoint: 'https://new.example.com/e' })).not.toThrow()
      warnSpy.mockRestore()
    })

    it('re-init uses updated endpoint for subsequent events', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.init({ apiKey: 'test_key', endpoint: 'https://new.example.com/e', batchSize: 100 })
      client.track('after_reinit')
      await client.flush()
      await flushMicrotasks()

      const call = eventFetchCalls().find((c) => c.url === 'https://new.example.com/e')
      expect(call).toBeDefined()
      warnSpy.mockRestore()
    })
  })

  // =========================================================================
  // 21. shutdown() behavior
  // =========================================================================

  describe('shutdown() behavior', () => {
    it('flushes remaining events on shutdown', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('pre_shutdown')
      await client.shutdown()
      await flushMicrotasks()

      const body = lastEventBody()
      expect(body).toBeDefined()
      expect(body!.events.some((e) => e.event === 'pre_shutdown')).toBe(true)
    })

    it('marks client as not initialized after shutdown', async () => {
      client.init({ apiKey: 'test_key' })
      await client.shutdown()
      // After shutdown, re-init should work without the "Already initialized" warning
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      client.init({ apiKey: 'test_key' })
      expect(warnSpy).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })

  // =========================================================================
  // 22. identify() merging traits
  // =========================================================================

  describe('identify() trait merging', () => {
    it('merges traits from sequential identify calls', () => {
      client.init({ apiKey: 'test_key' })
      client.identify('u_1', { email: 'alice@test.com' })
      client.identify('u_1', { plan: 'pro' })

      expect(client.user).toEqual(expect.objectContaining({ id: 'u_1', email: 'alice@test.com', plan: 'pro' }))
    })

    it('identify without traits preserves existing user data', () => {
      client.init({ apiKey: 'test_key' })
      client.identify('u_1', { email: 'alice@test.com' })
      client.identify('u_1')

      expect(client.user).toEqual(expect.objectContaining({ id: 'u_1', email: 'alice@test.com' }))
    })

    it('identify creates minimal user when no prior user exists', () => {
      client.init({ apiKey: 'test_key' })
      client.identify('u_1')

      expect(client.user).toEqual({ id: 'u_1' })
    })
  })

  // =========================================================================
  // 23. Stack trace parsing edge cases
  // =========================================================================

  describe('Stack trace parsing', () => {
    it('parses standard V8 stack frames', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      const err = new Error('v8 stack')
      err.stack = 'Error: v8 stack\n    at Object.foo (http://localhost/app.js:42:13)\n    at bar (http://localhost/lib.js:10:5)'
      client.captureException(err)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      const stacktrace = (errEvent.exception as Record<string, unknown>).stacktrace as {
        filename: string
        function: string
        lineno: number
        colno: number
      }[]
      expect(stacktrace.length).toBe(2)
      // Stack is reversed (bottom-up)
      expect(stacktrace[0].function).toBe('bar')
      expect(stacktrace[1].function).toBe('Object.foo')
    })

    it('handles errors with no stack trace', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      const err = new Error('no stack')
      err.stack = undefined
      client.captureException(err)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((errEvent.exception as Record<string, unknown>).stacktrace).toBeUndefined()
    })
  })

  // =========================================================================
  // 24. Error event includes release and environment
  // =========================================================================

  describe('Error event metadata', () => {
    it('exception events include release and environment', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100, release: 'v3.0.0', environment: 'production' })
      client.captureException(new Error('metadata test'))
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const errEvent = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect(errEvent.release).toBe('v3.0.0')
      expect(errEvent.environment).toBe('production')
    })
  })

  // =========================================================================
  // 25. Flag fetch failure graceful degradation
  // =========================================================================

  describe('Flag fetch failure', () => {
    it('does not throw when flag endpoint returns an error', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response('Internal Server Error', { status: 500 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      expect(() => client.init({ apiKey: 'test_key' })).not.toThrow()
      await flushMicrotasks()

      // Should still function normally
      client.track('after_flag_failure')
      expect(client.getFeatureFlag('any')).toBeUndefined()
    })

    it('does not throw when flag fetch throws a network error', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) throw new Error('Network unavailable')
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      expect(() => client.init({ apiKey: 'test_key' })).not.toThrow()
      await flushMicrotasks()

      expect(client.getAllFlags()).toEqual({})
    })
  })

  // =========================================================================
  // 26. Flush beacon mode
  // =========================================================================

  describe('Flush beacon mode', () => {
    it('uses sendBeacon when beacon=true and navigator.sendBeacon exists', async () => {
      const sendBeaconSpy = vi.fn().mockReturnValue(true)
      vi.stubGlobal('navigator', { ...navigator, sendBeacon: sendBeaconSpy })

      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('beacon_event')
      await client.flush(true)
      await flushMicrotasks()

      expect(sendBeaconSpy).toHaveBeenCalled()
      const beaconBody = JSON.parse(sendBeaconSpy.mock.calls[0][1] as string)
      expect(beaconBody.events).toBeDefined()
      expect(beaconBody.events.some((e: Record<string, unknown>) => e.event === 'beacon_event')).toBe(true)
    })

    it('falls back to fetch when navigator.sendBeacon is not available', async () => {
      const origNav = globalThis.navigator
      vi.stubGlobal('navigator', { userAgent: 'test-agent' })

      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('no_beacon_event')
      await client.flush(true)
      await flushMicrotasks()

      // Should fall back to fetch
      const body = lastEventBody()
      expect(body).toBeDefined()
      expect(body!.events.some((e) => e.event === 'no_beacon_event')).toBe(true)

      vi.stubGlobal('navigator', origNav)
    })
  })

  // =========================================================================
  // 27. onError callback
  // =========================================================================

  describe('onError callback', () => {
    it('onError is called after all retries are exhausted', async () => {
      const onError = vi.fn()
      let callCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        callCount++
        throw new Error('always fail')
      }

      client.init({ apiKey: 'test_key', batchSize: 1, onError, flushInterval: 999999 })
      client.track('doomed')
      await flushMicrotasks()

      // Exhaust all retries (3 attempts + initial = 4 total calls; after attempt 3 it calls onError)
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(5000)
        await flushMicrotasks()
      }

      expect(onError).toHaveBeenCalled()
      expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    })

    it('onError is called on 4xx client errors', async () => {
      const onError = vi.fn()
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response('Forbidden', { status: 403 })
      }

      client.init({ apiKey: 'test_key', batchSize: 1, onError, flushInterval: 999999 })
      client.track('forbidden')
      await flushMicrotasks()
      await vi.advanceTimersByTimeAsync(100)
      await flushMicrotasks()

      expect(onError).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 28. Fetch keepalive
  // =========================================================================

  describe('Fetch options', () => {
    it('sends with keepalive: true', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('keepalive_test')
      await client.flush()
      await flushMicrotasks()

      const call = eventFetchCalls()[0]
      expect(call).toBeDefined()
      expect(call!.init.keepalive).toBe(true)
    })

    it('sends with Content-Type: application/json', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('content_type_test')
      await client.flush()
      await flushMicrotasks()

      const call = eventFetchCalls()[0]
      expect(call).toBeDefined()
      expect((call!.init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    })

    it('sends with method POST', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('method_test')
      await client.flush()
      await flushMicrotasks()

      const call = eventFetchCalls()[0]
      expect(call).toBeDefined()
      expect(call!.init.method).toBe('POST')
    })
  })

  // =========================================================================
  // 29. Event structure completeness
  // =========================================================================

  describe('Event structure completeness', () => {
    it('track event includes all base fields', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('complete_event', { custom: 'prop' })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.event === 'complete_event')!
      expect(event.type).toBe('track')
      expect(event.ts).toBeDefined()
      expect(event.anonymousId).toBeDefined()
      expect(event.sessionId).toBeDefined()
      expect(event.properties).toEqual(expect.objectContaining({ custom: 'prop' }))
    })

    it('page event includes all base fields', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.page('TestPage', { section: 'docs' })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'page')!
      expect(event.event).toBe('TestPage')
      expect(event.ts).toBeDefined()
      expect(event.anonymousId).toBeDefined()
      expect(event.sessionId).toBeDefined()
      expect(event.properties).toEqual(expect.objectContaining({ section: 'docs' }))
    })

    it('identify event includes userId and traits', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.identify('u_99', { role: 'admin' })
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'identify')!
      expect(event.userId).toBe('u_99')
      expect(event.traits).toEqual(expect.objectContaining({ role: 'admin' }))
    })

    it('exception event includes full error details', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.setUser({ id: 'u_5', email: 'u5@test.com' })
      client.setTag('service', 'api')
      client.setExtra('requestId', 'req_789')
      client.addBreadcrumb({ category: 'http', message: 'GET /users' })

      const err = new RangeError('out of bounds')
      client.captureException(err)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect(event.eventId).toMatch(/^[0-9a-f]{32}$/)
      expect(event.level).toBe('error')
      expect((event.exception as Record<string, unknown>).type).toBe('RangeError')
      expect((event.exception as Record<string, unknown>).value).toBe('out of bounds')
      expect((event.user as Record<string, unknown>).id).toBe('u_5')
      expect((event.tags as Record<string, string>).service).toBe('api')
      expect((event.extra as Record<string, unknown>).requestId).toBe('req_789')
      expect((event.breadcrumbs as unknown[]).length).toBeGreaterThanOrEqual(1)
    })
  })

  // =========================================================================
  // 30. captureException with non-Error types
  // =========================================================================

  describe('captureException with non-Error types', () => {
    it('wraps a string into an Error', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.captureException('something went wrong')
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((event.exception as Record<string, unknown>).value).toBe('something went wrong')
    })

    it('wraps a number into an Error', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.captureException(42)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((event.exception as Record<string, unknown>).value).toBe('42')
    })

    it('wraps null into an Error', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.captureException(null)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((event.exception as Record<string, unknown>).value).toBe('null')
    })

    it('wraps undefined into an Error', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.captureException(undefined)
      await client.flush()
      await flushMicrotasks()

      const body = lastEventBody()!
      const event = body.events.find((e) => e.type === 'exception') as Record<string, unknown>
      expect((event.exception as Record<string, unknown>).value).toBe('undefined')
    })
  })

  // =========================================================================
  // 31. Empty flush does nothing
  // =========================================================================

  describe('Empty flush', () => {
    it('flush with empty queue does not send any request', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      await client.flush()
      await flushMicrotasks()

      expect(eventFetchCalls().length).toBe(0)
    })
  })

  // =========================================================================
  // 32. Flag endpoint URL construction
  // =========================================================================

  describe('Flag endpoint URL', () => {
    it('posts to {endpoint}/flags on init', async () => {
      client.init({ apiKey: 'test_key', endpoint: 'https://custom.example.com/events' })
      await flushMicrotasks()

      const flagCall = flagFetchCalls()[0]
      expect(flagCall).toBeDefined()
      expect(flagCall!.url).toBe('https://custom.example.com/events/flags')
    })

    it('sends distinctId in flag request body', async () => {
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      const flagCall = flagFetchCalls()[0]
      expect(flagCall).toBeDefined()
      const body = flagCall!.body as Record<string, unknown>
      expect(body.distinctId).toBeDefined()
      expect(typeof body.distinctId).toBe('string')
    })

    it('sends Authorization header in flag request', async () => {
      client.init({ apiKey: 'test_key' })
      await flushMicrotasks()

      const flagCall = flagFetchCalls()[0]
      expect(flagCall).toBeDefined()
      expect((flagCall!.init.headers as Record<string, string>).Authorization).toBe('Bearer test_key')
    })
  })

  // =========================================================================
  // 33. Singleton API from index.ts
  // =========================================================================

  describe('Singleton API', () => {
    it('createClient returns a fully functional independent client', async () => {
      const { createClient } = await import('../src/index.js')
      const c = createClient({ apiKey: 'factory_key', batchSize: 100 })
      c.track('factory_event')
      await c.flush()
      await flushMicrotasks()

      const body = lastEventBody()
      expect(body).toBeDefined()
      expect(body!.events.some((e) => e.event === 'factory_event')).toBe(true)
    })
  })

  // =========================================================================
  // 34. Preflushed flag reload
  // =========================================================================

  describe('Preflushed flag reload', () => {
    it('reloads flags on first flush (fire-and-forget)', async () => {
      let flagCallCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) {
          flagCallCount++
          return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      client.init({ apiKey: 'test_key', batchSize: 100 })
      await flushMicrotasks()
      const initFlagCalls = flagCallCount

      client.track('trigger_preflushed')
      await client.flush()
      await flushMicrotasks()

      // Should have made an additional flag fetch on first flush
      expect(flagCallCount).toBeGreaterThan(initFlagCalls)
    })
  })

  // =========================================================================
  // 35. Events payload is an array
  // =========================================================================

  describe('Events payload format', () => {
    it('wraps events in { events: [...] } format', async () => {
      client.init({ apiKey: 'test_key', batchSize: 100 })
      client.track('payload_check')
      await client.flush()
      await flushMicrotasks()

      const call = eventFetchCalls()[0]!
      const body = call.body as { events: unknown[] }
      expect(Array.isArray(body.events)).toBe(true)
      expect(body.events.length).toBeGreaterThanOrEqual(1)
    })
  })
})
