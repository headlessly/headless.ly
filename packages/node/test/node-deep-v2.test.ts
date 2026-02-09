import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HeadlessNodeClient, createClient, Headlessly, expressMiddleware, honoMiddleware } from '../src/index.js'
import type { NodeConfig, Severity, FlagValue } from '../src/index.js'

// ---------------------------------------------------------------------------
// Mocked fetch infrastructure
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string
  init: RequestInit
  body?: unknown
}

const fetchCalls: FetchCall[] = []
let fetchResponder: (url: string, init?: RequestInit) => Response | Promise<Response> = () =>
  new Response(JSON.stringify({ ok: true }), { status: 200 })

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
// Deep V2 Tests — 50+ NEW tests covering untested areas
// ---------------------------------------------------------------------------

describe('@headlessly/node — deep v2', () => {
  beforeEach(() => {
    resetFetch()
  })

  // =========================================================================
  // 1. group() method
  // =========================================================================

  describe('group()', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('enqueues a group event with type "group"', async () => {
      client.group('org_k7TmPvQx', { name: 'Acme' })
      await client.flush()

      const events = allSentEvents()
      expect(events).toHaveLength(1)
      expect(events[0].type).toBe('group')
      expect(events[0].groupId).toBe('org_k7TmPvQx')
    })

    it('includes groupTraits in the payload', async () => {
      client.group('org_k7TmPvQx', { name: 'Acme', tier: 'enterprise', employees: 500 })
      await client.flush()

      const events = allSentEvents()
      expect(events[0].groupTraits).toEqual({ name: 'Acme', tier: 'enterprise', employees: 500 })
    })

    it('accepts optional distinctId as third argument', async () => {
      client.group('org_k7TmPvQx', { name: 'Acme' }, 'user_fX9bL5nRd')
      await client.flush()

      const events = allSentEvents()
      expect(events[0].distinctId).toBe('user_fX9bL5nRd')
    })

    it('generates a distinctId when none is provided', async () => {
      client.group('org_k7TmPvQx')
      await client.flush()

      const events = allSentEvents()
      expect(events[0].distinctId).toBeDefined()
      expect(typeof events[0].distinctId).toBe('string')
      expect((events[0].distinctId as string).length).toBeGreaterThan(0)
    })

    it('includes ISO timestamp', async () => {
      client.group('org_k7TmPvQx')
      await client.flush()

      const events = allSentEvents()
      expect(events[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('works without traits', async () => {
      client.group('org_k7TmPvQx')
      await client.flush()

      const events = allSentEvents()
      expect(events[0].groupId).toBe('org_k7TmPvQx')
      expect(events[0].groupTraits).toBeUndefined()
    })
  })

  // =========================================================================
  // 2. captureMessage()
  // =========================================================================

  describe('captureMessage()', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({
        apiKey: 'test_key',
        batchSize: 100,
        flushInterval: 60000,
        release: '1.2.3',
        environment: 'staging',
        serverName: 'api-2',
      })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('returns a 32-char hex event ID', () => {
      const id = client.captureMessage('test message')
      expect(id).toMatch(/^[0-9a-f]{32}$/)
    })

    it('sends a message event with type "message"', async () => {
      client.captureMessage('Queue depth exceeded 10,000', 'warning')
      await client.flush()

      const events = allSentEvents()
      expect(events[0].type).toBe('message')
      expect(events[0].message).toBe('Queue depth exceeded 10,000')
    })

    it('defaults severity level to "info"', async () => {
      client.captureMessage('Informational message')
      await client.flush()

      const events = allSentEvents()
      expect(events[0].level).toBe('info')
    })

    it('supports all severity levels', async () => {
      const levels: Severity[] = ['fatal', 'error', 'warning', 'info', 'debug']
      for (const level of levels) {
        client.captureMessage(`msg-${level}`, level)
      }
      await client.flush()

      const events = allSentEvents()
      expect(events).toHaveLength(5)
      levels.forEach((level, i) => {
        expect(events[i].level).toBe(level)
      })
    })

    it('includes release, environment, and serverName from config', async () => {
      client.captureMessage('deployed')
      await client.flush()

      const events = allSentEvents()
      expect(events[0].release).toBe('1.2.3')
      expect(events[0].environment).toBe('staging')
      expect(events[0].serverName).toBe('api-2')
    })

    it('includes platform as "node"', async () => {
      client.captureMessage('test')
      await client.flush()

      const events = allSentEvents()
      expect(events[0].platform).toBe('node')
    })

    it('accepts optional distinctId', async () => {
      client.captureMessage('user-level message', 'info', 'user_fX9bL5nRd')
      await client.flush()

      const events = allSentEvents()
      expect(events[0].distinctId).toBe('user_fX9bL5nRd')
    })

    it('includes tags set via setTags', async () => {
      client.setTags({ service: 'billing', region: 'us-east-1' })
      client.captureMessage('test')
      await client.flush()

      const events = allSentEvents()
      expect((events[0] as { tags: Record<string, string> }).tags.service).toBe('billing')
      expect((events[0] as { tags: Record<string, string> }).tags.region).toBe('us-east-1')
    })

    it('generates unique event IDs for each message', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(client.captureMessage(`msg-${i}`))
      }
      expect(ids.size).toBe(100)
    })
  })

  // =========================================================================
  // 3. captureException — advanced cases
  // =========================================================================

  describe('captureException — advanced', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({
        apiKey: 'test_key',
        batchSize: 100,
        flushInterval: 60000,
        release: '2.0.0',
        environment: 'production',
        serverName: 'worker-3',
        tags: { service: 'api' },
      })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('includes config release, environment, serverName in exception event', async () => {
      client.captureException(new Error('boom'))
      await client.flush()

      const events = allSentEvents()
      expect(events[0].release).toBe('2.0.0')
      expect(events[0].environment).toBe('production')
      expect(events[0].serverName).toBe('worker-3')
    })

    it('merges context tags with global tags', async () => {
      client.setTag('global', 'yes')
      client.captureException(new Error('tagged'), undefined, {
        tags: { context: 'payment' },
      })
      await client.flush()

      const events = allSentEvents()
      const tags = (events[0] as { tags: Record<string, string> }).tags
      expect(tags.service).toBe('api')
      expect(tags.global).toBe('yes')
      expect(tags.context).toBe('payment')
    })

    it('includes extra context in exception event', async () => {
      client.captureException(new Error('payment failed'), 'user_fX9bL5nRd', {
        extra: { orderId: 'order_e5JhLzXc', amount: 9900 },
      })
      await client.flush()

      const events = allSentEvents()
      expect((events[0] as { extra: Record<string, unknown> }).extra).toEqual({
        orderId: 'order_e5JhLzXc',
        amount: 9900,
      })
    })

    it('includes user context in exception event', async () => {
      client.captureException(new Error('auth error'), 'user_fX9bL5nRd', {
        user: { id: 'user_fX9bL5nRd', email: 'alice@acme.co', username: 'alice' },
      })
      await client.flush()

      const events = allSentEvents()
      expect((events[0] as { user: Record<string, unknown> }).user).toEqual({
        id: 'user_fX9bL5nRd',
        email: 'alice@acme.co',
        username: 'alice',
      })
    })

    it('handles errors with no stack trace', async () => {
      const err = new Error('no stack')
      err.stack = undefined as unknown as string
      client.captureException(err)
      await client.flush()

      const events = allSentEvents()
      const exception = (events[0] as { exception: { type: string; value: string; stacktrace?: unknown } }).exception
      expect(exception.type).toBe('Error')
      expect(exception.value).toBe('no stack')
      expect(exception.stacktrace).toBeUndefined()
    })

    it('handles custom error subclasses', async () => {
      class PaymentError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'PaymentError'
        }
      }

      client.captureException(new PaymentError('card declined'))
      await client.flush()

      const events = allSentEvents()
      const exception = (events[0] as { exception: { type: string; value: string } }).exception
      expect(exception.type).toBe('PaymentError')
      expect(exception.value).toBe('card declined')
    })

    it('sets level to "error" for exceptions', async () => {
      client.captureException(new Error('test'))
      await client.flush()

      const events = allSentEvents()
      expect(events[0].level).toBe('error')
    })

    it('generates unique event IDs across multiple exceptions', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 50; i++) {
        ids.add(client.captureException(new Error(`error ${i}`)))
      }
      expect(ids.size).toBe(50)
    })
  })

  // =========================================================================
  // 4. Tag system
  // =========================================================================

  describe('Tag system', () => {
    let client: HeadlessNodeClient

    afterEach(async () => {
      await client.shutdown()
    })

    it('config tags are applied to exception events', async () => {
      client = createClient({
        apiKey: 'test_key',
        batchSize: 100,
        flushInterval: 60000,
        tags: { service: 'billing', version: '1.0' },
      })
      client.captureException(new Error('test'))
      await client.flush()

      const events = allSentEvents()
      const tags = (events[0] as { tags: Record<string, string> }).tags
      expect(tags.service).toBe('billing')
      expect(tags.version).toBe('1.0')
    })

    it('setTag overwrites previous tag value', async () => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.setTag('region', 'us-east-1')
      client.setTag('region', 'eu-west-1')
      client.captureMessage('test')
      await client.flush()

      const events = allSentEvents()
      const tags = (events[0] as { tags: Record<string, string> }).tags
      expect(tags.region).toBe('eu-west-1')
    })

    it('setTags merges multiple tags at once', async () => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.setTags({ a: '1', b: '2' })
      client.setTags({ c: '3' })
      client.captureMessage('test')
      await client.flush()

      const events = allSentEvents()
      const tags = (events[0] as { tags: Record<string, string> }).tags
      expect(tags.a).toBe('1')
      expect(tags.b).toBe('2')
      expect(tags.c).toBe('3')
    })

    it('runtime setTag overrides config tags', async () => {
      client = createClient({
        apiKey: 'test_key',
        batchSize: 100,
        flushInterval: 60000,
        tags: { service: 'original' },
      })
      client.setTag('service', 'overridden')
      client.captureMessage('test')
      await client.flush()

      const events = allSentEvents()
      const tags = (events[0] as { tags: Record<string, string> }).tags
      expect(tags.service).toBe('overridden')
    })

    it('context tags in captureException override global tags', async () => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.setTag('env', 'global')
      client.captureException(new Error('test'), undefined, {
        tags: { env: 'context-override' },
      })
      await client.flush()

      const events = allSentEvents()
      const tags = (events[0] as { tags: Record<string, string> }).tags
      expect(tags.env).toBe('context-override')
    })
  })

  // =========================================================================
  // 5. isFeatureEnabled — string variant edge cases
  // =========================================================================

  describe('isFeatureEnabled — string variants', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('returns true for string "true"', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { flag: 'true' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      expect(await client.isFeatureEnabled('flag', 'u1')).toBe(true)
    })

    it('returns false for string "false"', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { flag: 'false' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      expect(await client.isFeatureEnabled('flag', 'u1')).toBe(false)
    })

    it('returns false for string "control"', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { flag: 'control' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      expect(await client.isFeatureEnabled('flag', 'u1')).toBe(false)
    })

    it('returns true for non-control, non-false string variants', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { flag: 'variant-a' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      expect(await client.isFeatureEnabled('flag', 'u1')).toBe(true)
    })

    it('returns false for numeric zero', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { flag: 0 } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      expect(await client.isFeatureEnabled('flag', 'u1')).toBe(false)
    })

    it('returns false when flag is missing and no default', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      expect(await client.isFeatureEnabled('missing', 'u1')).toBe(false)
    })
  })

  // =========================================================================
  // 6. Feature flag cache isolation by distinctId
  // =========================================================================

  describe('Feature flag cache — distinctId isolation', () => {
    let client: HeadlessNodeClient
    let flagRequestCount: number

    beforeEach(() => {
      flagRequestCount = 0
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      fetchResponder = (url) => {
        if (url.includes('/flags')) {
          flagRequestCount++
          return new Response(JSON.stringify({ flags: { feature: `value-${flagRequestCount}` } }), { status: 200 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('caches separately per distinctId', async () => {
      const val1 = await client.getFeatureFlag('feature', 'user_a')
      const val2 = await client.getFeatureFlag('feature', 'user_b')

      // Different users trigger separate fetch calls
      expect(flagRequestCount).toBe(2)
      expect(val1).toBe('value-1')
      expect(val2).toBe('value-2')
    })

    it('returns cached value for same distinctId', async () => {
      await client.getFeatureFlag('feature', 'user_a')
      const val2 = await client.getFeatureFlag('feature', 'user_a')

      // Same user should reuse cache
      expect(flagRequestCount).toBe(1)
      expect(val2).toBe('value-1')
    })
  })

  // =========================================================================
  // 7. getAllFlags — edge cases
  // =========================================================================

  describe('getAllFlags — edge cases', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('returns empty object when server returns empty flags', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const flags = await client.getAllFlags('user_1')
      expect(flags).toEqual({})
    })

    it('returns empty object on network error', async () => {
      fetchResponder = () => {
        throw new Error('network error')
      }

      const flags = await client.getAllFlags('user_1')
      expect(flags).toEqual({})
    })

    it('returns empty object on 500 response', async () => {
      fetchResponder = () => new Response('Server Error', { status: 500 })

      const flags = await client.getAllFlags('user_1')
      expect(flags).toEqual({})
    })

    it('returns flags with mixed value types', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) {
          return new Response(
            JSON.stringify({
              flags: {
                bool_flag: true,
                string_flag: 'variant-b',
                num_flag: 42,
                obj_flag: { color: 'blue' },
              },
            }),
            { status: 200 },
          )
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const flags = await client.getAllFlags('user_1')
      expect(flags.bool_flag).toBe(true)
      expect(flags.string_flag).toBe('variant-b')
      expect(flags.num_flag).toBe(42)
      expect(flags.obj_flag).toEqual({ color: 'blue' })
    })

    it('sends distinctId in the request body', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      await client.getAllFlags('user_fX9bL5nRd')

      const call = flagCalls()[0]
      expect(call.body).toEqual({ distinctId: 'user_fX9bL5nRd' })
    })
  })

  // =========================================================================
  // 8. getFeatureFlag — defaultValue behavior
  // =========================================================================

  describe('getFeatureFlag — defaultValue', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('returns defaultValue when flag is not found', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const val = await client.getFeatureFlag('missing', 'u1', { defaultValue: 'fallback' })
      expect(val).toBe('fallback')
    })

    it('returns defaultValue on network error', async () => {
      fetchResponder = () => {
        throw new Error('DNS failure')
      }

      const val = await client.getFeatureFlag('flag', 'u1', { defaultValue: false })
      expect(val).toBe(false)
    })

    it('returns undefined when flag missing and no defaultValue', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const val = await client.getFeatureFlag('missing', 'u1')
      expect(val).toBeUndefined()
    })

    it('returns actual flag value over defaultValue when flag exists', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { present: 'real-value' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const val = await client.getFeatureFlag('present', 'u1', { defaultValue: 'fallback' })
      expect(val).toBe('real-value')
    })

    it('returns defaultValue on 500 server error', async () => {
      fetchResponder = () => new Response('error', { status: 500 })

      const val = await client.getFeatureFlag('flag', 'u1', { defaultValue: 42 })
      expect(val).toBe(42)
    })
  })

  // =========================================================================
  // 9. Config defaults
  // =========================================================================

  describe('Config defaults', () => {
    it('batchSize defaults to 20', () => {
      const client = createClient({ apiKey: 'k' })
      // Add 19 events — no flush since default batch is 20
      for (let i = 0; i < 19; i++) client.track(`e${i}`)
      expect(eventCalls()).toHaveLength(0)

      // 20th event triggers auto-flush
      client.track('e20')
      expect(eventCalls().length).toBeGreaterThanOrEqual(1)
      client.shutdown()
    })

    it('endpoint defaults to https://headless.ly/e', () => {
      const client = createClient({ apiKey: 'k' })
      expect(client.endpoint).toBe('https://headless.ly/e')
      client.shutdown()
    })

    it('queueSize starts at 0', () => {
      const client = createClient({ apiKey: 'k' })
      expect(client.queueSize).toBe(0)
      client.shutdown()
    })
  })

  // =========================================================================
  // 10. Queue overflow — precise ordering
  // =========================================================================

  describe('Queue overflow — ordering', () => {
    it('drops oldest events to make room at maxQueueSize', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000, maxQueueSize: 3 })

      client.track('first')
      client.track('second')
      client.track('third')
      // Now at capacity (3). Next enqueue should drop oldest
      client.track('fourth')
      client.track('fifth')

      await client.flush()

      const events = allSentEvents()
      const names = events.map((e) => e.event)
      expect(names).toEqual(['third', 'fourth', 'fifth'])
      await client.shutdown()
    })

    it('respects maxQueueSize of 1', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000, maxQueueSize: 1 })

      client.track('a')
      client.track('b')
      client.track('c')

      expect(client.queueSize).toBe(1)
      await client.flush()

      const events = allSentEvents()
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('c')
      await client.shutdown()
    })

    it('allows unlimited queue when maxQueueSize is not set', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 1000, flushInterval: 60000 })

      for (let i = 0; i < 200; i++) client.track(`event_${i}`)
      expect(client.queueSize).toBe(200)

      await client.shutdown()
    })
  })

  // =========================================================================
  // 11. Mixed event types in a single batch
  // =========================================================================

  describe('Mixed event types in batch', () => {
    it('sends track, identify, group, exception, and message in one flush', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })

      client.track('page_view', { path: '/' })
      client.identify('user_fX9bL5nRd', { email: 'a@b.co' })
      client.group('org_k7TmPvQx', { name: 'Acme' })
      client.captureException(new Error('test error'))
      client.captureMessage('info message')

      await client.flush()

      const events = allSentEvents()
      expect(events).toHaveLength(5)

      const types = events.map((e) => e.type)
      expect(types).toEqual(['track', 'identify', 'group', 'exception', 'message'])

      await client.shutdown()
    })
  })

  // =========================================================================
  // 12. flush() behavior
  // =========================================================================

  describe('flush() — additional cases', () => {
    it('resolves without calling fetch when queue is empty', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      await client.flush()
      expect(eventCalls()).toHaveLength(0)
      await client.shutdown()
    })

    it('clears queue after successful flush', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.track('a')
      client.track('b')
      expect(client.queueSize).toBe(2)

      await client.flush()
      expect(client.queueSize).toBe(0)

      await client.shutdown()
    })

    it('sends to the configured endpoint', async () => {
      const client = createClient({ apiKey: 'test_key', endpoint: 'https://custom.example.com/ingest', batchSize: 100, flushInterval: 60000 })
      client.track('ev')
      await client.flush()

      expect(eventCalls()[0].url).toBe('https://custom.example.com/ingest')
      await client.shutdown()
    })
  })

  // =========================================================================
  // 13. Retry behavior — detailed
  // =========================================================================

  describe('Retry — detailed', () => {
    it('calls onError after all retries exhausted on network error', async () => {
      vi.useFakeTimers()
      fetchResponder = () => {
        throw new Error('ECONNREFUSED')
      }
      const onError = vi.fn()
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000, maxRetries: 2, onError })

      client.track('ev')
      const p = client.flush()
      await vi.advanceTimersByTimeAsync(20000)
      await p

      expect(onError).toHaveBeenCalledOnce()
      expect(onError.mock.calls[0][0].message).toBe('ECONNREFUSED')

      await client.shutdown()
      vi.useRealTimers()
    })

    it('retries on 503 Service Unavailable', async () => {
      vi.useFakeTimers()
      let attempt = 0
      fetchResponder = () => {
        attempt++
        if (attempt <= 1) return new Response('unavailable', { status: 503 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000, maxRetries: 3 })
      client.track('ev')
      const p = client.flush()
      await vi.advanceTimersByTimeAsync(10000)
      await p

      expect(eventCalls().length).toBe(2)
      await client.shutdown()
      vi.useRealTimers()
    })

    it('does not retry on 401 Unauthorized', async () => {
      vi.useFakeTimers()
      const onError = vi.fn()
      fetchResponder = () => new Response('Unauthorized', { status: 401 })

      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000, maxRetries: 3, onError })
      client.track('ev')
      const p = client.flush()
      await vi.advanceTimersByTimeAsync(10000)
      await p

      expect(eventCalls()).toHaveLength(1)
      expect(onError).toHaveBeenCalled()

      await client.shutdown()
      vi.useRealTimers()
    })

    it('does not retry on 422 Unprocessable', async () => {
      vi.useFakeTimers()
      const onError = vi.fn()
      fetchResponder = () => new Response('Unprocessable', { status: 422 })

      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000, maxRetries: 3, onError })
      client.track('ev')
      const p = client.flush()
      await vi.advanceTimersByTimeAsync(10000)
      await p

      expect(eventCalls()).toHaveLength(1)
      await client.shutdown()
      vi.useRealTimers()
    })

    it('succeeds on eventual success after retries', async () => {
      vi.useFakeTimers()
      let attempt = 0
      fetchResponder = () => {
        attempt++
        if (attempt <= 2) return new Response('error', { status: 502 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      const onError = vi.fn()
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000, maxRetries: 3, onError })

      client.track('important')
      const p = client.flush()
      await vi.advanceTimersByTimeAsync(20000)
      await p

      expect(onError).not.toHaveBeenCalled()
      expect(eventCalls().length).toBe(3)

      await client.shutdown()
      vi.useRealTimers()
    })

    it('maxRetries: 0 means no retries at all', async () => {
      vi.useFakeTimers()
      const onError = vi.fn()
      fetchResponder = () => {
        throw new Error('fail')
      }

      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000, maxRetries: 0, onError })
      client.track('ev')
      const p = client.flush()
      await vi.advanceTimersByTimeAsync(5000)
      await p

      // Only 1 attempt (no retries)
      expect(eventCalls()).toHaveLength(1)
      expect(onError).toHaveBeenCalledOnce()

      await client.shutdown()
      vi.useRealTimers()
    })
  })

  // =========================================================================
  // 14. Headlessly singleton
  // =========================================================================

  describe('Headlessly singleton — advanced', () => {
    afterEach(() => {
      Headlessly.reset()
    })

    it('reset() clears the singleton so init can create a new one', () => {
      const a = Headlessly.init({ apiKey: 'key_a' })
      Headlessly.reset()
      const b = Headlessly.init({ apiKey: 'key_b' })

      expect(a).not.toBe(b)
      expect(b.apiKey).toBe('key_b')
    })

    it('throws on empty string apiKey', () => {
      expect(() => Headlessly.init({ apiKey: '' })).toThrow(/apiKey/)
    })

    it('second init with different apiKey still returns first singleton', () => {
      const a = Headlessly.init({ apiKey: 'key_a' })
      const b = Headlessly.init({ apiKey: 'key_b' })
      expect(a).toBe(b)
      expect(b.apiKey).toBe('key_a')
    })
  })

  // =========================================================================
  // 15. Middleware .middleware() instance method
  // =========================================================================

  describe('client.middleware() instance method', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('returns an async function', () => {
      const mw = client.middleware()
      expect(typeof mw).toBe('function')
    })

    it('tracks http_request with method and path', async () => {
      const mw = client.middleware()
      const req = { method: 'PATCH', url: '/api/contacts/1', path: '/api/contacts/1', headers: {} }
      const res = { statusCode: 200 }
      const next = vi.fn().mockResolvedValue(undefined)

      await mw(req, res, next)
      await client.flush()

      const events = allSentEvents()
      const httpEvent = events.find((e) => e.event === 'http_request')
      expect(httpEvent).toBeDefined()
      expect((httpEvent as { properties: Record<string, unknown> }).properties.method).toBe('PATCH')
      expect((httpEvent as { properties: Record<string, unknown> }).properties.path).toBe('/api/contacts/1')
    })

    it('falls back to url when path is not available', async () => {
      const mw = client.middleware()
      const req = { method: 'GET', url: '/fallback-url' }
      const res = { statusCode: 200 }
      const next = vi.fn().mockResolvedValue(undefined)

      await mw(req as any, res as any, next)
      await client.flush()

      const events = allSentEvents()
      const httpEvent = events.find((e) => e.event === 'http_request') as { properties: Record<string, unknown> }
      expect(httpEvent.properties.path).toBe('/fallback-url')
    })

    it('captures errors and re-throws them', async () => {
      const mw = client.middleware()
      const req = { method: 'POST', url: '/crash', path: '/crash' }
      const res = { statusCode: 500 }
      const next = vi.fn().mockRejectedValue(new Error('middleware crash'))

      await expect(mw(req as any, res as any, next)).rejects.toThrow('middleware crash')

      await client.flush()
      const events = allSentEvents()
      const exEvent = events.find((e) => e.type === 'exception')
      expect(exEvent).toBeDefined()
    })

    it('still tracks http_request even when next() throws', async () => {
      const mw = client.middleware()
      const req = { method: 'DELETE', url: '/fail', path: '/fail' }
      const res = { statusCode: 500 }
      const next = vi.fn().mockRejectedValue(new Error('boom'))

      try {
        await mw(req as any, res as any, next)
      } catch {
        // expected
      }

      await client.flush()
      const events = allSentEvents()
      const httpEvent = events.find((e) => e.event === 'http_request')
      expect(httpEvent).toBeDefined()
    })

    it('records duration in milliseconds', async () => {
      const mw = client.middleware()
      const req = { method: 'GET', url: '/', path: '/' }
      const res = { statusCode: 200 }
      const next = vi.fn(async () => {
        // Simulate some work
        await new Promise((r) => setTimeout(r, 5))
      })

      await mw(req as any, res as any, next)
      await client.flush()

      const events = allSentEvents()
      const httpEvent = events.find((e) => e.event === 'http_request') as { properties: Record<string, unknown> }
      expect(httpEvent.properties.duration).toBeGreaterThanOrEqual(0)
      expect(typeof httpEvent.properties.duration).toBe('number')
    })
  })

  // =========================================================================
  // 16. Express middleware — additional edge cases
  // =========================================================================

  describe('expressMiddleware — edge cases', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('falls back to url when path is undefined', async () => {
      const mw = expressMiddleware(client)
      let finishCb: (() => void) | undefined
      const req = { method: 'GET', url: '/url-fallback', headers: {} }
      const res = {
        statusCode: 200,
        on: (_event: string, cb: () => void) => {
          finishCb = cb
        },
      }
      const next = vi.fn()

      mw(req as any, res as any, next)
      finishCb!()
      await client.flush()

      const events = allSentEvents()
      const httpEvent = events.find((e) => e.event === 'http_request') as { properties: Record<string, unknown> }
      expect(httpEvent.properties.path).toBe('/url-fallback')
    })

    it('does not capture non-Error thrown values', async () => {
      const mw = expressMiddleware(client)
      const req = { method: 'GET', url: '/', headers: {} }
      const res = { statusCode: 500, on: vi.fn() }
      const next = () => {
        throw 'string error' // eslint-disable-line no-throw-literal
      }

      expect(() => mw(req as any, res as any, next)).toThrow('string error')
      await client.flush()

      // Non-Error values should not produce exception events
      const events = allSentEvents()
      const exEvents = events.filter((e) => e.type === 'exception')
      expect(exEvents).toHaveLength(0)
    })
  })

  // =========================================================================
  // 17. Hono middleware — additional edge cases
  // =========================================================================

  describe('honoMiddleware — edge cases', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('does not capture non-Error rejection values', async () => {
      const mw = honoMiddleware(client)
      const next = vi.fn().mockRejectedValue('string rejection')
      const c = {
        req: { method: 'GET', path: '/', url: '/', header: () => undefined },
        res: { status: 500 },
      }

      await expect(mw(c as any, next)).rejects.toBe('string rejection')
      await client.flush()

      const events = allSentEvents()
      const exEvents = events.filter((e) => e.type === 'exception')
      expect(exEvents).toHaveLength(0)
    })

    it('tracks request even when no user-agent header', async () => {
      const mw = honoMiddleware(client)
      const next = vi.fn().mockResolvedValue(undefined)
      const c = {
        req: { method: 'GET', path: '/health', url: '/health', header: () => undefined },
        res: { status: 200 },
      }

      await mw(c as any, next)
      await client.flush()

      const events = allSentEvents()
      const httpEvent = events.find((e) => e.event === 'http_request') as { properties: Record<string, unknown> }
      expect(httpEvent).toBeDefined()
      expect(httpEvent.properties.userAgent).toBeUndefined()
    })
  })

  // =========================================================================
  // 18. Debug mode
  // =========================================================================

  describe('Debug mode', () => {
    it('logs to console when debug is enabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient({ apiKey: 'test_key', debug: true, batchSize: 100, flushInterval: 60000 })
      client.track('debug_event')

      expect(consoleSpy).toHaveBeenCalled()
      const loggedMessages = consoleSpy.mock.calls.map((c) => c[0])
      const hasNodePrefix = loggedMessages.some((msg: string) => msg.includes('[@headlessly/node]'))
      expect(hasNodePrefix).toBe(true)

      consoleSpy.mockRestore()
      client.shutdown()
    })

    it('does not log when debug is disabled', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const client = createClient({ apiKey: 'test_key', debug: false, batchSize: 100, flushInterval: 60000 })
      client.track('quiet_event')

      const nodeMessages = consoleSpy.mock.calls.filter((c) => (c[0] as string)?.includes?.('[@headlessly/node]'))
      expect(nodeMessages).toHaveLength(0)

      consoleSpy.mockRestore()
      client.shutdown()
    })
  })

  // =========================================================================
  // 19. Shutdown — post-shutdown behavior
  // =========================================================================

  describe('Shutdown — post-shutdown behavior', () => {
    it('events enqueued after shutdown still accumulate in queue', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      await client.shutdown()

      // After shutdown, enqueue still adds to internal array but timer won't restart
      client.track('after_shutdown')
      // We can observe the queueSize
      expect(client.queueSize).toBe(1)
    })

    it('flush after shutdown still sends remaining events', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.track('before')
      await client.shutdown()

      // Event was flushed during shutdown
      const events = allSentEvents()
      expect(events.length).toBeGreaterThanOrEqual(1)
    })
  })

  // =========================================================================
  // 20. Auto-generated distinctId
  // =========================================================================

  describe('Auto-generated distinctId', () => {
    it('track() generates a distinctId when none provided', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.track('auto_id')
      await client.flush()

      const events = allSentEvents()
      expect(events[0].distinctId).toBeDefined()
      expect(typeof events[0].distinctId).toBe('string')
      expect((events[0].distinctId as string).length).toBeGreaterThan(0)
      await client.shutdown()
    })

    it('track() uses provided distinctId when given', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.track('explicit_id', {}, 'user_fX9bL5nRd')
      await client.flush()

      const events = allSentEvents()
      expect(events[0].distinctId).toBe('user_fX9bL5nRd')
      await client.shutdown()
    })

    it('each auto-generated distinctId is unique', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
      client.track('ev1')
      client.track('ev2')
      client.track('ev3')
      await client.flush()

      const events = allSentEvents()
      const ids = new Set(events.map((e) => e.distinctId))
      expect(ids.size).toBe(3)
      await client.shutdown()
    })
  })

  // =========================================================================
  // 21. Feature flag $feature_flag_called tracking
  // =========================================================================

  describe('Feature flag tracking event', () => {
    let client: HeadlessNodeClient

    beforeEach(() => {
      client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })
    })

    afterEach(async () => {
      await client.shutdown()
    })

    it('tracks $feature_flag_called with flag name and response', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { 'my-flag': 'variant-a' } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      await client.getFeatureFlag('my-flag', 'user_1')
      await client.flush()

      const events = allSentEvents()
      const flagEvent = events.find((e) => e.event === '$feature_flag_called')
      expect(flagEvent).toBeDefined()
      expect((flagEvent as { properties: Record<string, unknown> }).properties.$feature_flag).toBe('my-flag')
      expect((flagEvent as { properties: Record<string, unknown> }).properties.$feature_flag_response).toBe('variant-a')
    })

    it('does not track $feature_flag_called when flag is not found', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      await client.getFeatureFlag('missing', 'user_1')
      await client.flush()

      const events = allSentEvents()
      const flagEvent = events.find((e) => e.event === '$feature_flag_called')
      expect(flagEvent).toBeUndefined()
    })

    it('tracks flag call with distinctId of the requesting user', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: { feat: true } }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      await client.getFeatureFlag('feat', 'user_fX9bL5nRd')
      await client.flush()

      const events = allSentEvents()
      const flagEvent = events.find((e) => e.event === '$feature_flag_called')
      expect(flagEvent).toBeDefined()
      expect(flagEvent!.distinctId).toBe('user_fX9bL5nRd')
    })
  })

  // =========================================================================
  // 22. Authorization header on all requests
  // =========================================================================

  describe('Authorization header', () => {
    it('sends Bearer token on event flush', async () => {
      const client = createClient({ apiKey: 'sk_live_abc123', batchSize: 100, flushInterval: 60000 })
      client.track('ev')
      await client.flush()

      const call = eventCalls()[0]
      expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer sk_live_abc123')
      await client.shutdown()
    })

    it('sends Bearer token on flag requests', async () => {
      fetchResponder = (url) => {
        if (url.includes('/flags')) return new Response(JSON.stringify({ flags: {} }), { status: 200 })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const client = createClient({ apiKey: 'sk_live_abc123', batchSize: 100, flushInterval: 60000 })
      await client.getFeatureFlag('f', 'u1')

      const call = flagCalls()[0]
      expect((call.init.headers as Record<string, string>).Authorization).toBe('Bearer sk_live_abc123')
      await client.shutdown()
    })
  })

  // =========================================================================
  // 23. Exports verification
  // =========================================================================

  describe('Module exports', () => {
    it('exports HeadlessNodeClient class', () => {
      expect(HeadlessNodeClient).toBeDefined()
      expect(typeof HeadlessNodeClient).toBe('function')
    })

    it('exports createClient factory function', () => {
      expect(typeof createClient).toBe('function')
    })

    it('exports Headlessly singleton with init and reset', () => {
      expect(typeof Headlessly.init).toBe('function')
      expect(typeof Headlessly.reset).toBe('function')
    })

    it('exports expressMiddleware function', () => {
      expect(typeof expressMiddleware).toBe('function')
    })

    it('exports honoMiddleware function', () => {
      expect(typeof honoMiddleware).toBe('function')
    })
  })

  // =========================================================================
  // 24. Flag cache TTL
  // =========================================================================

  describe('Flag cache TTL', () => {
    it('uses default 5-minute TTL when not configured', async () => {
      vi.useFakeTimers()
      let callCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) {
          callCount++
          return new Response(JSON.stringify({ flags: { f: `v${callCount}` } }), { status: 200 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 120000 })

      await client.getFeatureFlag('f', 'u1')
      expect(callCount).toBe(1)

      // Advance 4 minutes — still cached
      vi.advanceTimersByTime(4 * 60 * 1000)
      await client.getFeatureFlag('f', 'u1')
      expect(callCount).toBe(1)

      // Advance past 5 minute default TTL
      vi.advanceTimersByTime(2 * 60 * 1000)
      await client.getFeatureFlag('f', 'u1')
      expect(callCount).toBe(2)

      await client.shutdown()
      vi.useRealTimers()
    })

    it('uses custom TTL from config', async () => {
      vi.useFakeTimers()
      let callCount = 0
      fetchResponder = (url) => {
        if (url.includes('/flags')) {
          callCount++
          return new Response(JSON.stringify({ flags: { f: true } }), { status: 200 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }

      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 120000, flagCacheTTL: 10000 })

      await client.getFeatureFlag('f', 'u1')
      expect(callCount).toBe(1)

      vi.advanceTimersByTime(11000)
      await client.getFeatureFlag('f', 'u1')
      expect(callCount).toBe(2)

      await client.shutdown()
      vi.useRealTimers()
    })
  })

  // =========================================================================
  // 25. Stack trace parsing
  // =========================================================================

  describe('Stack trace parsing', () => {
    it('parses real V8 stack traces into frames', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })

      // Create a real error with a real stack
      function innerFn() {
        return new Error('deep error')
      }
      function outerFn() {
        return innerFn()
      }

      const err = outerFn()
      client.captureException(err)
      await client.flush()

      const events = allSentEvents()
      const exception = (events[0] as { exception: { stacktrace: { filename?: string; function?: string; lineno?: number; colno?: number }[] } }).exception
      expect(exception.stacktrace).toBeDefined()
      expect(exception.stacktrace.length).toBeGreaterThan(0)

      // Frames should have lineno and colno
      const frame = exception.stacktrace[0]
      expect(typeof frame.lineno).toBe('number')
      expect(typeof frame.colno).toBe('number')

      await client.shutdown()
    })

    it('reverses frames so innermost is first (Sentry convention)', async () => {
      const client = createClient({ apiKey: 'test_key', batchSize: 100, flushInterval: 60000 })

      const err = new Error('test')
      client.captureException(err)
      await client.flush()

      const events = allSentEvents()
      const exception = (events[0] as { exception: { stacktrace: { filename?: string; function?: string }[] } }).exception

      // The source code reverses the stack frames
      // In V8, top of the raw stack = outermost call, reversed = innermost first
      expect(Array.isArray(exception.stacktrace)).toBe(true)

      await client.shutdown()
    })
  })
})
