import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventLog, matchesPattern } from '../src/event-log'
import { TimeTraveler } from '../src/time-travel'
import { SubscriptionManager } from '../src/subscriptions'
import { CDCStream } from '../src/cdc'
import type { NounEvent, NounEventInput } from '../src/types'

// =============================================================================
// Helpers
// =============================================================================

function eventInput(
  entityType: string,
  entityId: string,
  verb: string,
  after?: Record<string, unknown>,
  before?: Record<string, unknown>,
): NounEventInput {
  const eventForm = verb.endsWith('e') ? `${verb}d` : `${verb}ed`
  return {
    $type: `${entityType}.${eventForm}`,
    entityType,
    entityId,
    verb,
    conjugation: { action: verb, activity: `${verb}ing`, event: eventForm },
    after,
    before,
  }
}

function makeNounEvent(overrides: Partial<NounEvent> = {}): NounEvent {
  return {
    $id: 'evt_test123abc',
    $type: 'Contact.created',
    entityType: 'Contact',
    entityId: 'contact_abc12345',
    verb: 'create',
    conjugation: { action: 'create', activity: 'creating', event: 'created' },
    sequence: 1,
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// =============================================================================
// Tests — v2 deep coverage (50+ new tests, no overlap with existing)
// =============================================================================

describe('@headlessly/events — deep coverage v2', () => {
  // ===========================================================================
  // 1. Event Emission and Subscription Patterns (10 tests)
  // ===========================================================================

  describe('Event emission and subscription patterns', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('multiple subscribers on the same pattern each receive the event', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()
      log.subscribe('Contact.*', handler1)
      log.subscribe('Contact.*', handler2)
      log.subscribe('Contact.*', handler3)

      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      expect(handler1).toHaveBeenCalledOnce()
      expect(handler2).toHaveBeenCalledOnce()
      expect(handler3).toHaveBeenCalledOnce()
    })

    it('subscriber receives event with all expected fields populated', async () => {
      let received: NounEvent | undefined
      log.subscribe('*', (event) => {
        received = event
      })

      await log.append({
        ...eventInput('Contact', 'c1', 'create', { name: 'Alice' }),
        actor: 'user_test123',
        context: 'https://headless.ly/~acme',
      })

      expect(received).toBeDefined()
      expect(received!.$id).toMatch(/^evt_/)
      expect(received!.$type).toBe('Contact.created')
      expect(received!.entityType).toBe('Contact')
      expect(received!.entityId).toBe('c1')
      expect(received!.verb).toBe('create')
      expect(received!.sequence).toBe(1)
      expect(received!.timestamp).toBeDefined()
      expect(received!.actor).toBe('user_test123')
      expect(received!.context).toBe('https://headless.ly/~acme')
      expect(received!.conjugation.action).toBe('create')
      expect(received!.conjugation.activity).toBe('createing')
      expect(received!.conjugation.event).toBe('created')
    })

    it('subscribers on different patterns only receive matching events', async () => {
      const contactHandler = vi.fn()
      const dealHandler = vi.fn()
      const allCreated = vi.fn()
      log.subscribe('Contact.*', contactHandler)
      log.subscribe('Deal.*', dealHandler)
      log.subscribe('*.created', allCreated)

      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'close'))

      expect(contactHandler).toHaveBeenCalledTimes(1)
      expect(dealHandler).toHaveBeenCalledTimes(1)
      expect(allCreated).toHaveBeenCalledTimes(1) // only Contact.created
    })

    it('unsubscribing one handler does not affect other handlers on same pattern', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const unsub1 = log.subscribe('Contact.*', handler1)
      log.subscribe('Contact.*', handler2)

      unsub1()
      await log.append(eventInput('Contact', 'c1', 'create'))

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledOnce()
    })

    it('unsubscribing the same handler twice is safe (no-op)', async () => {
      const handler = vi.fn()
      const unsub = log.subscribe('Contact.*', handler)
      unsub()
      unsub() // second call should be no-op
      await log.append(eventInput('Contact', 'c1', 'create'))
      expect(handler).not.toHaveBeenCalled()
    })

    it('subscribe returns unique unsubscribe function per call', async () => {
      const handler = vi.fn()
      const unsub1 = log.subscribe('Contact.*', handler)
      const unsub2 = log.subscribe('Deal.*', handler)

      unsub1()
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))

      // handler should only fire for Deal (Contact was unsubscribed)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].entityType).toBe('Deal')

      unsub2()
    })

    it('subscriber is called synchronously during append (before promise resolves)', async () => {
      const order: string[] = []
      log.subscribe('*', () => {
        order.push('subscriber')
      })

      const promise = log.append(eventInput('Contact', 'c1', 'create'))
      order.push('after-append-call')
      await promise

      // subscriber fires during append before returning
      expect(order[0]).toBe('subscriber')
      expect(order[1]).toBe('after-append-call')
    })

    it('no subscribers means append still works without errors', async () => {
      const event = await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      expect(event).toBeDefined()
      expect(event.entityType).toBe('Contact')
    })

    it('subscriber added after event is appended does not receive past events', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))

      const handler = vi.fn()
      log.subscribe('*', handler)

      // handler should not be called for past events
      expect(handler).not.toHaveBeenCalled()

      // but should work for future events
      await log.append(eventInput('Contact', 'c2', 'create'))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('async subscriber errors are swallowed and do not break append', async () => {
      log.subscribe('*', () => {
        throw new Error('sync error in handler')
      })

      const event = await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      expect(event).toBeDefined()
      expect(log.size).toBe(1)
    })
  })

  // ===========================================================================
  // 2. Event Ordering and Sequencing (8 tests)
  // ===========================================================================

  describe('Event ordering and sequencing', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('sequences are isolated per entity — different entities get independent counters', async () => {
      const e1 = await log.append(eventInput('Contact', 'c1', 'create'))
      const e2 = await log.append(eventInput('Deal', 'd1', 'create'))
      const e3 = await log.append(eventInput('Contact', 'c1', 'update'))
      const e4 = await log.append(eventInput('Deal', 'd1', 'update'))

      expect(e1.sequence).toBe(1)
      expect(e2.sequence).toBe(1) // Deal starts at 1 independently
      expect(e3.sequence).toBe(2)
      expect(e4.sequence).toBe(2)
    })

    it('sequences are monotonically increasing within an entity', async () => {
      const events: NounEvent[] = []
      for (let i = 0; i < 10; i++) {
        events.push(await log.append(eventInput('Contact', 'c1', i === 0 ? 'create' : 'update', { counter: i })))
      }

      for (let i = 1; i < events.length; i++) {
        expect(events[i].sequence).toBe(events[i - 1].sequence + 1)
      }
    })

    it('event IDs are globally unique across multiple appends', async () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const event = await log.append(eventInput('Contact', `c${i}`, 'create'))
        ids.add(event.$id)
      }
      expect(ids.size).toBe(100)
    })

    it('event timestamps are non-decreasing (monotonic)', async () => {
      const events: NounEvent[] = []
      for (let i = 0; i < 20; i++) {
        events.push(await log.append(eventInput('Contact', `c${i}`, 'create')))
      }

      for (let i = 1; i < events.length; i++) {
        expect(events[i].timestamp >= events[i - 1].timestamp).toBe(true)
      }
    })

    it('getEntityHistory returns events in sequence order', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))
      await log.append(eventInput('Contact', 'c1', 'update', { score: 95 }))

      const history = await log.getEntityHistory('Contact', 'c1')
      expect(history.length).toBe(4)
      for (let i = 1; i < history.length; i++) {
        expect(history[i].sequence).toBeGreaterThan(history[i - 1].sequence)
      }
    })

    it('events for different entities within the same entityType are separate histories', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))

      const h1 = await log.getEntityHistory('Contact', 'c1')
      const h2 = await log.getEntityHistory('Contact', 'c2')

      expect(h1.length).toBe(2)
      expect(h2.length).toBe(1)
    })

    it('query with entityType+verb returns cross-entity results in append order', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Contact', 'c3', 'create'))

      const results = await log.query({ entityType: 'Contact', verb: 'create' })
      expect(results.length).toBe(3)
      expect(results[0].entityId).toBe('c1')
      expect(results[1].entityId).toBe('c2')
      expect(results[2].entityId).toBe('c3')
    })

    it('sequences reset after clear()', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      const e = await log.append(eventInput('Contact', 'c1', 'update'))
      expect(e.sequence).toBe(3)

      await log.clear()
      const fresh = await log.append(eventInput('Contact', 'c1', 'create'))
      expect(fresh.sequence).toBe(1)
    })
  })

  // ===========================================================================
  // 3. Wildcard and Pattern Matching (8 tests)
  // ===========================================================================

  describe('matchesPattern — advanced edge cases', () => {
    it('empty pattern does not match anything', () => {
      expect(matchesPattern('', 'Contact.created')).toBe(false)
    })

    it('exact match requires both parts to match', () => {
      expect(matchesPattern('Contact.updated', 'Contact.updated')).toBe(true)
      expect(matchesPattern('Contact.updated', 'Contact.created')).toBe(false)
      expect(matchesPattern('Contact.updated', 'Deal.updated')).toBe(false)
    })

    it('comma pattern with spaces trims properly', () => {
      expect(matchesPattern('Contact.* , Deal.*', 'Contact.created')).toBe(true)
      expect(matchesPattern('Contact.* , Deal.*', 'Deal.closed')).toBe(true)
      expect(matchesPattern('Contact.* , Deal.*', 'Invoice.created')).toBe(false)
    })

    it('negation combined with exact match', () => {
      expect(matchesPattern('!Contact.created', 'Contact.created')).toBe(false)
      expect(matchesPattern('!Contact.created', 'Contact.updated')).toBe(true)
      expect(matchesPattern('!Contact.created', 'Deal.created')).toBe(true)
    })

    it('double wildcard matches deeply nested types', () => {
      expect(matchesPattern('CRM.**', 'CRM.Contact')).toBe(true)
      expect(matchesPattern('CRM.**', 'CRM.Contact.created')).toBe(true)
      expect(matchesPattern('CRM.**', 'Billing.Invoice')).toBe(false)
    })

    it('single wildcard on left matches any entity type with specific verb', () => {
      expect(matchesPattern('*.qualified', 'Contact.qualified')).toBe(true)
      expect(matchesPattern('*.qualified', 'Lead.qualified')).toBe(true)
      expect(matchesPattern('*.qualified', 'Contact.created')).toBe(false)
    })

    it('single wildcard on right matches all verbs for an entity', () => {
      expect(matchesPattern('Invoice.*', 'Invoice.created')).toBe(true)
      expect(matchesPattern('Invoice.*', 'Invoice.paid')).toBe(true)
      expect(matchesPattern('Invoice.*', 'Payment.created')).toBe(false)
    })

    it('comma-separated with negation patterns', () => {
      // "Contact.* OR !Deal.created" - Contact match wins via OR
      expect(matchesPattern('Contact.*,!Deal.created', 'Contact.updated')).toBe(true)
      // Deal.created matches negation pattern (!Deal.created => false), but Contact.* doesn't match, so OR = false
      expect(matchesPattern('Contact.*,!Deal.created', 'Deal.created')).toBe(false)
      // Invoice.created doesn't match Contact.*, but !Deal.created matches Invoice.created => true
      expect(matchesPattern('Contact.*,!Deal.created', 'Invoice.created')).toBe(true)
    })
  })

  // ===========================================================================
  // 4. Event Filtering and Querying (8 tests)
  // ===========================================================================

  describe('Event filtering and querying', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('query with Date objects for since/until', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await sleep(15)
      const start = new Date()
      await sleep(15)
      await log.append(eventInput('Contact', 'c2', 'create'))
      await sleep(15)
      const end = new Date()
      await sleep(15)
      await log.append(eventInput('Contact', 'c3', 'create'))

      const results = await log.query({ since: start, until: end })
      expect(results.length).toBe(1)
      expect(results[0].entityId).toBe('c2')
    })

    it('query with limit=0 returns empty', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))

      const results = await log.query({ limit: 0 })
      expect(results.length).toBe(0)
    })

    it('query with offset beyond available returns empty', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))

      const results = await log.query({ offset: 100 })
      expect(results.length).toBe(0)
    })

    it('query combines entityType + entityId + verb filters', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Deal', 'c1', 'create'))

      const results = await log.query({ entityType: 'Contact', entityId: 'c1', verb: 'create' })
      expect(results.length).toBe(1)
      expect(results[0].entityType).toBe('Contact')
      expect(results[0].entityId).toBe('c1')
      expect(results[0].verb).toBe('create')
    })

    it('get() returns null for non-existent event ID', async () => {
      const result = await log.get('evt_nonexistent1')
      expect(result).toBeNull()
    })

    it('get() retrieves a specific event by its ID', async () => {
      const appended = await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      const retrieved = await log.get(appended.$id)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.$id).toBe(appended.$id)
      expect(retrieved!.entityType).toBe('Contact')
      expect(retrieved!.after).toEqual({ name: 'Alice' })
    })

    it('count() with no filter returns total size', async () => {
      for (let i = 0; i < 7; i++) await log.append(eventInput('Contact', `c${i}`, 'create'))
      for (let i = 0; i < 3; i++) await log.append(eventInput('Deal', `d${i}`, 'create'))

      const total = await log.count()
      expect(total).toBe(10)
    })

    it('count() with verb filter', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Deal', 'd1', 'create'))

      const updateCount = await log.count({ verb: 'update' })
      expect(updateCount).toBe(2)
    })
  })

  // ===========================================================================
  // 5. Concurrent Event Handling (4 tests)
  // ===========================================================================

  describe('Concurrent event handling', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('parallel appends for different entities all succeed', async () => {
      const promises = Array.from({ length: 20 }, (_, i) => log.append(eventInput('Contact', `c${i}`, 'create', { idx: i })))

      const results = await Promise.all(promises)
      expect(results.length).toBe(20)
      expect(log.size).toBe(20)

      // All IDs should be unique
      const ids = new Set(results.map((e) => e.$id))
      expect(ids.size).toBe(20)
    })

    it('parallel appends for the same entity produce sequential sequences', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => log.append(eventInput('Contact', 'c1', i === 0 ? 'create' : 'update', { step: i })))

      const results = await Promise.all(promises)
      const sequences = results.map((e) => e.sequence).sort((a, b) => a - b)

      // Should have sequences 1 through 10
      expect(sequences).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    })

    it('subscribers are notified for all parallel appends', async () => {
      const handler = vi.fn()
      log.subscribe('*', handler)

      const promises = Array.from({ length: 15 }, (_, i) => log.append(eventInput('Contact', `c${i}`, 'create')))

      await Promise.all(promises)
      expect(handler).toHaveBeenCalledTimes(15)
    })

    it('rapid sequential appends maintain correct ordering', async () => {
      for (let i = 0; i < 50; i++) {
        await log.append(eventInput('Contact', 'c1', i === 0 ? 'create' : 'update', { step: i }))
      }

      const history = await log.getEntityHistory('Contact', 'c1')
      expect(history.length).toBe(50)

      // Verify strict sequential ordering
      for (let i = 0; i < history.length; i++) {
        expect(history[i].sequence).toBe(i + 1)
      }
    })
  })

  // ===========================================================================
  // 6. Memory Management and Unsubscribe Cleanup (5 tests)
  // ===========================================================================

  describe('Memory management — unsubscribe cleanup', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('unsubscribing all handlers from a pattern removes the pattern entry', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const unsub1 = log.subscribe('Contact.*', handler1)
      const unsub2 = log.subscribe('Contact.*', handler2)

      unsub1()
      unsub2()

      // After all handlers removed, appending should not error
      await log.append(eventInput('Contact', 'c1', 'create'))
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('clear() removes all subscribers as well as events', async () => {
      const handler = vi.fn()
      log.subscribe('*', handler)

      await log.append(eventInput('Contact', 'c1', 'create'))
      expect(handler).toHaveBeenCalledOnce()

      await log.clear()

      await log.append(eventInput('Contact', 'c2', 'create'))
      // After clear, subscriber is gone
      expect(handler).toHaveBeenCalledTimes(1) // not called again
    })

    it('many subscribers can be registered and individually removed', async () => {
      const handlers: ReturnType<typeof vi.fn>[] = []
      const unsubs: (() => void)[] = []

      for (let i = 0; i < 20; i++) {
        const h = vi.fn()
        handlers.push(h)
        unsubs.push(log.subscribe('*', h))
      }

      await log.append(eventInput('Contact', 'c1', 'create'))
      for (const h of handlers) {
        expect(h).toHaveBeenCalledOnce()
      }

      // Remove every other handler
      for (let i = 0; i < 20; i += 2) {
        unsubs[i]()
      }

      await log.append(eventInput('Contact', 'c2', 'create'))
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          expect(handlers[i]).toHaveBeenCalledTimes(1) // not called for c2
        } else {
          expect(handlers[i]).toHaveBeenCalledTimes(2) // called for both
        }
      }
    })

    it('getEntityHistory returns empty for non-existent entity', async () => {
      const history = await log.getEntityHistory('Contact', 'nonexistent')
      expect(history).toEqual([])
    })

    it('uniqueEntities on empty log returns empty array', async () => {
      const entities = await log.uniqueEntities()
      expect(entities).toEqual([])
    })
  })

  // ===========================================================================
  // 7. Edge Cases: Rapid Fire, Duplicate Data, Complex Payloads (6 tests)
  // ===========================================================================

  describe('Edge cases — rapid fire, duplicate data, complex payloads', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('events with identical data still produce unique IDs and incrementing sequences', async () => {
      const input = eventInput('Contact', 'c1', 'update', { stage: 'Qualified' })
      const e1 = await log.append(input)
      const e2 = await log.append(input)
      const e3 = await log.append(input)

      expect(e1.$id).not.toBe(e2.$id)
      expect(e2.$id).not.toBe(e3.$id)
      expect(e1.sequence).toBe(1)
      expect(e2.sequence).toBe(2)
      expect(e3.sequence).toBe(3)
    })

    it('event with nested object payload survives round-trip', async () => {
      const payload = {
        name: 'Alice',
        address: { street: '123 Main St', city: 'Portland', state: 'OR' },
        tags: ['lead', 'enterprise'],
        metadata: { source: 'import', nested: { deep: true } },
      }

      const event = await log.append(eventInput('Contact', 'c1', 'create', payload))
      const retrieved = await log.get(event.$id)

      expect(retrieved!.after).toEqual(payload)
    })

    it('event with empty after payload is valid', async () => {
      const event = await log.append(eventInput('Contact', 'c1', 'create', {}))
      expect(event.after).toEqual({})
    })

    it('event with undefined after payload is valid', async () => {
      const event = await log.append(eventInput('Contact', 'c1', 'create'))
      expect(event.after).toBeUndefined()
    })

    it('snapshot merges multiple updates correctly (last write wins per field)', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead', score: 10 }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified', score: 50 }))
      await log.append(eventInput('Contact', 'c1', 'update', { score: 95 }))

      const snapshot = await log.snapshot()
      expect(snapshot['Contact:c1']).toEqual({
        name: 'Alice',
        stage: 'Qualified',
        score: 95,
      })
    })

    it('compact produces a snapshot event with merged state', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c1', 'update', { email: 'alice@co.com' }))

      const { originalCount, snapshotEvent } = await log.compact('Contact', 'c1')
      expect(originalCount).toBe(3)
      expect(snapshotEvent.verb).toBe('snapshot')
      expect(snapshotEvent.$type).toBe('Contact.snapshot')
      expect(snapshotEvent.after).toEqual({
        name: 'Alice',
        stage: 'Qualified',
        email: 'alice@co.com',
      })
    })
  })

  // ===========================================================================
  // 8. Stream and Serialization (5 tests)
  // ===========================================================================

  describe('Stream and serialization', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('stream() with entityType filter yields only matching events', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))

      const events: NounEvent[] = []
      for await (const event of log.stream({ entityType: 'Contact' })) {
        events.push(event)
      }
      expect(events.length).toBe(2)
      expect(events.every((e) => e.entityType === 'Contact')).toBe(true)
    })

    it('stream() with verb filter yields only matching events', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Contact', 'c2', 'create'))

      const events: NounEvent[] = []
      for await (const event of log.stream({ verb: 'create' })) {
        events.push(event)
      }
      expect(events.length).toBe(2)
    })

    it('stream() with no filter yields all events', async () => {
      for (let i = 0; i < 5; i++) await log.append(eventInput('Contact', `c${i}`, 'create'))

      const events: NounEvent[] = []
      for await (const event of log.stream()) {
        events.push(event)
      }
      expect(events.length).toBe(5)
    })

    it('toJSON/fromJSON round-trip preserves all event data', async () => {
      await log.append({
        ...eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }),
        actor: 'user_xyz',
        context: 'https://headless.ly/~test',
      })
      await log.append(eventInput('Deal', 'd1', 'create', { title: 'Big Deal', value: 100000 }))

      const json = log.toJSON()
      const newLog = new EventLog()
      newLog.fromJSON(json)

      expect(newLog.size).toBe(2)
      const history1 = await newLog.getEntityHistory('Contact', 'c1')
      expect(history1[0].actor).toBe('user_xyz')
      expect(history1[0].context).toBe('https://headless.ly/~test')
      expect(history1[0].after).toEqual({ name: 'Alice', stage: 'Lead' })

      const history2 = await newLog.getEntityHistory('Deal', 'd1')
      expect(history2[0].after).toEqual({ title: 'Big Deal', value: 100000 })
    })

    it('fromJSON restores sequence counters — next append continues from max', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Contact', 'c1', 'update'))

      const json = log.toJSON()
      const newLog = new EventLog()
      newLog.fromJSON(json)

      const nextEvent = await newLog.append(eventInput('Contact', 'c1', 'update', { step: 4 }))
      expect(nextEvent.sequence).toBe(4)
    })
  })

  // ===========================================================================
  // 9. CDC (Change Data Capture) — advanced (6 tests)
  // ===========================================================================

  describe('CDCStream — advanced', () => {
    let log: EventLog
    let cdc: CDCStream

    beforeEach(() => {
      log = new EventLog()
      cdc = new CDCStream(log)
    })

    it('poll with verb filter', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Deal', 'd1', 'create'))

      const result = await cdc.poll({ verbs: ['create'] })
      expect(result.events.length).toBe(2)
      expect(result.events.every((e) => e.verb === 'create')).toBe(true)
    })

    it('poll with since timestamp', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await sleep(15)
      const since = new Date()
      await sleep(15)
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))

      const result = await cdc.poll({ since })
      expect(result.events.length).toBe(2)
    })

    it('multi-consumer isolation — each consumer tracks its own cursor', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Contact', 'c3', 'create'))

      const consumer1 = cdc.createConsumer('worker-1')
      const consumer2 = cdc.createConsumer('worker-2')

      // consumer1 reads 2, consumer2 reads 1
      const batch1 = await consumer1.poll({ batchSize: 2 })
      const batch2 = await consumer2.poll({ batchSize: 1 })

      expect(batch1.events.length).toBe(2)
      expect(batch2.events.length).toBe(1)

      await consumer1.checkpoint()
      await consumer2.checkpoint()

      // Each consumer resumes from their own cursor
      const next1 = await consumer1.poll({ batchSize: 10 })
      const next2 = await consumer2.poll({ batchSize: 10 })

      expect(next1.events.length).toBe(1) // 1 remaining
      expect(next2.events.length).toBe(2) // 2 remaining
    })

    it('acknowledge and pending work together', async () => {
      const e1 = await log.append(eventInput('Contact', 'c1', 'create'))
      const e2 = await log.append(eventInput('Contact', 'c2', 'create'))
      const e3 = await log.append(eventInput('Contact', 'c3', 'create'))

      await cdc.acknowledge('consumer-a', [e1.$id, e2.$id])
      const pending = await cdc.pending('consumer-a')

      expect(pending.events.length).toBe(1)
      expect(pending.events[0].$id).toBe(e3.$id)
    })

    it('lag returns zero when consumer is fully caught up', async () => {
      const e1 = await log.append(eventInput('Contact', 'c1', 'create'))
      const e2 = await log.append(eventInput('Contact', 'c2', 'create'))

      await cdc.checkpoint('consumer-x', e2.$id)
      const lag = await cdc.lag('consumer-x')
      expect(lag).toBe(0)
    })

    it('pending returns all events for a consumer with no acknowledgements', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Contact', 'c3', 'create'))

      const pending = await cdc.pending('brand-new-consumer')
      expect(pending.events.length).toBe(3)
    })
  })

  // ===========================================================================
  // 10. TimeTraveler — advanced v2 (10 tests)
  // ===========================================================================

  describe('TimeTraveler — advanced v2', () => {
    let log: EventLog
    let traveler: TimeTraveler

    beforeEach(() => {
      log = new EventLog()
      traveler = new TimeTraveler(log)
    })

    it('asOf returns null for non-existent entity', async () => {
      const state = await traveler.asOf('Contact', 'nonexistent', {})
      expect(state).toBeNull()
    })

    it('delete event marks state as deleted', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await log.append(eventInput('Contact', 'c1', 'delete'))

      const state = await traveler.asOf('Contact', 'c1', {})
      expect(state).toBeDefined()
      expect(state!.$deleted).toBe(true)
    })

    it('timeline tracks delete events', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c1', 'delete'))

      const tl = await traveler.timeline('Contact', 'c1')
      expect(tl.length).toBe(3)
      expect(tl[2].state.$deleted).toBe(true)
    })

    it('diff shows field-level changes across multiple fields', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead', score: 10 }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified', score: 85, email: 'alice@test.com' }))

      const result = await traveler.diff('Contact', 'c1', { atVersion: 1 }, { atVersion: 2 })

      expect(result.changes.length).toBeGreaterThanOrEqual(2)
      const stageChange = result.changes.find((c) => c.field === 'stage')
      expect(stageChange).toBeDefined()
      expect(stageChange!.from).toBe('Lead')
      expect(stageChange!.to).toBe('Qualified')

      const scoreChange = result.changes.find((c) => c.field === 'score')
      expect(scoreChange).toBeDefined()
      expect(scoreChange!.from).toBe(10)
      expect(scoreChange!.to).toBe(85)
    })

    it('diff between v0 (before entity exists) and v1 shows all fields as new', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))

      // atVersion: 0 means no events → null state
      const result = await traveler.diff('Contact', 'c1', { atVersion: 0 }, { atVersion: 1 })

      expect(result.before).toBeNull()
      expect(result.after).toBeDefined()
      expect(result.changes.length).toBe(2) // name, stage
      const nameChange = result.changes.find((c) => c.field === 'name')
      expect(nameChange!.from).toBeUndefined()
      expect(nameChange!.to).toBe('Alice')
    })

    it('rollback then reconstruct shows new rollback event in history', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))

      const { rollbackEvent } = await traveler.rollback('Contact', 'c1', { atVersion: 1 })

      // The latest state should reflect the rollback
      const currentState = await traveler.asOf('Contact', 'c1', {})
      expect(currentState).toBeDefined()
      expect(currentState!.stage).toBe('Lead')
      expect(currentState!.name).toBe('Alice')

      // Verify the rollback event itself
      expect(rollbackEvent.verb).toBe('rollback')
      expect(rollbackEvent.$type).toBe('Contact.rolledBack')
    })

    it('projection returns empty object for non-existent entity', async () => {
      const proj = await traveler.projection('Contact', 'nonexistent', ['name', 'stage'])
      expect(proj).toEqual({})
    })

    it('projection only includes requested fields', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead', email: 'a@b.com', score: 42 }))

      const proj = await traveler.projection('Contact', 'c1', ['name', 'score'])
      expect(proj).toEqual({ name: 'Alice', score: 42 })
      expect(proj.stage).toBeUndefined()
      expect(proj.email).toBeUndefined()
    })

    it('snapshotAll returns latest state after multiple updates per entity', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))
      await log.append(eventInput('Deal', 'd1', 'create', { title: 'Deal A', value: 1000 }))
      await log.append(eventInput('Deal', 'd1', 'update', { value: 5000 }))

      const all = await traveler.snapshotAll()
      expect(all.length).toBe(2)

      const contact = all.find((s) => s.$type === 'Contact')
      expect(contact!.stage).toBe('Customer')
      expect(contact!.name).toBe('Alice')

      const deal = all.find((s) => s.$type === 'Deal')
      expect(deal!.value).toBe(5000)
      expect(deal!.title).toBe('Deal A')
    })

    it('causedBy returns undefined when no event matches', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))

      const cause = await traveler.causedBy('Contact', 'c1', 'stage', 'Churned')
      expect(cause).toBeUndefined()
    })
  })

  // ===========================================================================
  // 11. SubscriptionManager — advanced v2 (6 tests)
  // ===========================================================================

  describe('SubscriptionManager — advanced v2', () => {
    let manager: SubscriptionManager

    beforeEach(() => {
      manager = new SubscriptionManager()
    })

    it('dispatch skips deactivated subscriptions', async () => {
      const handler = vi.fn()
      const id = manager.registerCode('Contact.*', handler)
      manager.deactivate(id)

      await manager.dispatch(makeNounEvent())
      expect(handler).not.toHaveBeenCalled()
    })

    it('reactivated subscription resumes receiving events', async () => {
      const handler = vi.fn()
      const id = manager.registerCode('Contact.*', handler)
      manager.deactivate(id)
      manager.activate(id)

      await manager.dispatch(makeNounEvent())
      expect(handler).toHaveBeenCalledOnce()
    })

    it('list() filters by mode', () => {
      manager.registerCode('Contact.*', vi.fn())
      manager.registerWebSocket('Deal.*', 'wss://example.com')
      manager.registerWebhook('*.created', 'https://hook.example.com')

      const codeSubs = manager.list({ mode: 'code' })
      expect(codeSubs.length).toBe(1)
      expect(codeSubs[0].mode).toBe('code')

      const webhookSubs = manager.list({ mode: 'webhook' })
      expect(webhookSubs.length).toBe(1)
    })

    it('list() filters by active status', () => {
      const id1 = manager.registerCode('Contact.*', vi.fn())
      manager.registerCode('Deal.*', vi.fn())
      manager.deactivate(id1)

      const activeSubs = manager.list({ active: true })
      expect(activeSubs.length).toBe(1)

      const inactiveSubs = manager.list({ active: false })
      expect(inactiveSubs.length).toBe(1)
    })

    it('dispatch with failing code handler counts as failed', async () => {
      manager.registerCode('Contact.*', () => {
        throw new Error('handler exploded')
      })
      manager.registerCode('Contact.*', vi.fn()) // this one should still succeed

      const result = await manager.dispatch(makeNounEvent())
      expect(result.failed).toBe(1)
      expect(result.delivered).toBe(1)
    })

    it('deactivate/activate returns false for non-existent ID', () => {
      expect(manager.deactivate('sub_doesnotexist')).toBe(false)
      expect(manager.activate('sub_doesnotexist')).toBe(false)
    })
  })

  // ===========================================================================
  // 12. EventLog.cdc (direct, not via CDCStream) (4 tests)
  // ===========================================================================

  describe('EventLog.cdc — direct method', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('cdc with no options returns all events', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))

      const result = await log.cdc({})
      expect(result.events.length).toBe(2)
      expect(result.hasMore).toBe(false)
    })

    it('cdc with after cursor skips past events', async () => {
      const e1 = await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Contact', 'c3', 'create'))

      const result = await log.cdc({ after: e1.$id })
      expect(result.events.length).toBe(2)
      expect(result.events[0].entityId).toBe('c2')
    })

    it('cdc with types filter returns only matching entity types', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))
      await log.append(eventInput('Invoice', 'i1', 'create'))

      const result = await log.cdc({ types: ['Contact', 'Invoice'] })
      expect(result.events.length).toBe(2)
      expect(result.events[0].entityType).toBe('Contact')
      expect(result.events[1].entityType).toBe('Invoice')
    })

    it('cdc with verbs filter returns only matching verbs', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Deal', 'd1', 'create'))

      const result = await log.cdc({ verbs: ['update'] })
      expect(result.events.length).toBe(2)
      expect(result.events.every((e) => e.verb === 'update')).toBe(true)
    })
  })

  // ===========================================================================
  // 13. getBatch edge cases (3 tests)
  // ===========================================================================

  describe('EventLog.getBatch — edge cases', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('getBatch with empty array returns empty array', async () => {
      const result = await log.getBatch([])
      expect(result).toEqual([])
    })

    it('getBatch with non-existent IDs returns empty array', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      const result = await log.getBatch(['evt_doesnotexist'])
      expect(result).toEqual([])
    })

    it('getBatch preserves the order of requested IDs', async () => {
      const e1 = await log.append(eventInput('Contact', 'c1', 'create'))
      const e2 = await log.append(eventInput('Deal', 'd1', 'create'))
      const e3 = await log.append(eventInput('Invoice', 'i1', 'create'))

      // Request in reverse order
      const result = await log.getBatch([e3.$id, e1.$id, e2.$id])
      expect(result.length).toBe(3)
      expect(result[0].$id).toBe(e3.$id)
      expect(result[1].$id).toBe(e1.$id)
      expect(result[2].$id).toBe(e2.$id)
    })
  })

  // ===========================================================================
  // 14. SubscriptionManager + EventLog integration (3 tests)
  // ===========================================================================

  describe('SubscriptionManager + EventLog integration v2', () => {
    it('attach auto-dispatches to code handler for matching events', async () => {
      const log = new EventLog()
      const manager = new SubscriptionManager()
      const handler = vi.fn()

      manager.registerCode('Deal.*', handler)
      manager.attach(log)

      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))

      // handler should only fire for Deal
      expect(handler).toHaveBeenCalledOnce()
      expect(handler.mock.calls[0][0].entityType).toBe('Deal')
    })

    it('detach then re-attach works correctly', async () => {
      const log = new EventLog()
      const manager = new SubscriptionManager()
      const handler = vi.fn()

      manager.registerCode('*', handler)
      manager.attach(log)

      await log.append(eventInput('Contact', 'c1', 'create'))
      expect(handler).toHaveBeenCalledOnce()

      manager.detach()
      await log.append(eventInput('Contact', 'c2', 'create'))
      expect(handler).toHaveBeenCalledTimes(1)

      manager.attach(log)
      await log.append(eventInput('Contact', 'c3', 'create'))
      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('multiple managers can attach to the same log independently', async () => {
      const log = new EventLog()
      const manager1 = new SubscriptionManager()
      const manager2 = new SubscriptionManager()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      manager1.registerCode('Contact.*', handler1)
      manager2.registerCode('Deal.*', handler2)

      manager1.attach(log)
      manager2.attach(log)

      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))

      expect(handler1).toHaveBeenCalledOnce()
      expect(handler2).toHaveBeenCalledOnce()
    })
  })

  // ===========================================================================
  // 15. Compact edge cases (2 tests)
  // ===========================================================================

  describe('EventLog.compact — edge cases', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('compact on entity with no events returns originalCount 0', async () => {
      const result = await log.compact('Contact', 'nonexistent')
      expect(result.originalCount).toBe(0)
      expect(result.snapshotEvent).toBeDefined()
      expect(result.snapshotEvent.sequence).toBe(0)
    })

    it('compact on entity with single event preserves that state', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))

      const result = await log.compact('Contact', 'c1')
      expect(result.originalCount).toBe(1)
      expect(result.snapshotEvent.after).toEqual({ name: 'Alice', stage: 'Lead' })
    })
  })
})
