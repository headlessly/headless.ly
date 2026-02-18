import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventLog, matchesPattern } from '../src/event-log'
import { TimeTraveler } from '../src/time-travel'
import { SubscriptionManager } from '../src/subscriptions'
import { CDCStream } from '../src/cdc'
import type { NounEvent, NounEventInput } from '../src/types'

// =============================================================================
// Helpers
// =============================================================================

function eventInput(entityType: string, entityId: string, verb: string, after?: Record<string, unknown>, before?: Record<string, unknown>): NounEventInput {
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
// Tests — v3 deep coverage (55+ new tests, no overlap with v1/v2)
// =============================================================================

describe('@headlessly/events — deep coverage v3', () => {
  // ===========================================================================
  // 1. EventLog compaction with complex multi-entity histories (7 tests)
  // ===========================================================================

  describe('EventLog compaction — complex multi-entity histories', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('compact merges interleaved events from multiple entities correctly', async () => {
      // Interleave events between two contacts
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c2', 'create', { name: 'Bob', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c2', 'update', { stage: 'Customer' }))
      await log.append(eventInput('Contact', 'c1', 'update', { email: 'alice@co.com' }))

      const c1Result = await log.compact('Contact', 'c1')
      const c2Result = await log.compact('Contact', 'c2')

      expect(c1Result.originalCount).toBe(3)
      expect(c1Result.snapshotEvent.after).toEqual({ name: 'Alice', stage: 'Qualified', email: 'alice@co.com' })

      expect(c2Result.originalCount).toBe(2)
      expect(c2Result.snapshotEvent.after).toEqual({ name: 'Bob', stage: 'Customer' })
    })

    it('compact handles events where some have no after data', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await log.append(eventInput('Contact', 'c1', 'touch')) // no after data
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))

      const result = await log.compact('Contact', 'c1')
      expect(result.originalCount).toBe(3)
      // Only events with after data contribute to state
      expect(result.snapshotEvent.after).toEqual({ name: 'Alice', stage: 'Qualified' })
    })

    it('compact uses the sequence number from the last event in history', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'A' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'B' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'C' }))

      const result = await log.compact('Contact', 'c1')
      expect(result.snapshotEvent.sequence).toBe(4)
    })

    it('compact snapshot event has correct $type and verb fields', async () => {
      await log.append(eventInput('Deal', 'd1', 'create', { title: 'Big Deal' }))
      await log.append(eventInput('Deal', 'd1', 'update', { value: 100000 }))

      const result = await log.compact('Deal', 'd1')
      expect(result.snapshotEvent.$type).toBe('Deal.snapshot')
      expect(result.snapshotEvent.verb).toBe('snapshot')
      expect(result.snapshotEvent.entityType).toBe('Deal')
      expect(result.snapshotEvent.entityId).toBe('d1')
      expect(result.snapshotEvent.conjugation.action).toBe('snapshot')
      expect(result.snapshotEvent.conjugation.activity).toBe('snapshotting')
      expect(result.snapshotEvent.conjugation.event).toBe('snapshot')
    })

    it('compact with many updates accumulates all fields correctly', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await log.append(eventInput('Contact', 'c1', 'update', { email: 'alice@co.com' }))
      await log.append(eventInput('Contact', 'c1', 'update', { phone: '555-0100' }))
      await log.append(eventInput('Contact', 'c1', 'update', { address: '123 Main St' }))
      await log.append(eventInput('Contact', 'c1', 'update', { company: 'Acme Inc' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))
      await log.append(eventInput('Contact', 'c1', 'update', { score: 95 }))

      const result = await log.compact('Contact', 'c1')
      expect(result.originalCount).toBe(7)
      expect(result.snapshotEvent.after).toEqual({
        name: 'Alice',
        email: 'alice@co.com',
        phone: '555-0100',
        address: '123 Main St',
        company: 'Acme Inc',
        stage: 'Customer',
        score: 95,
      })
    })

    it('compact does not mutate the original log', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))

      const sizeBefore = log.size
      await log.compact('Contact', 'c1')
      // compact returns a snapshot event but does not alter the log
      expect(log.size).toBe(sizeBefore)
    })

    it('snapshot correctly handles multiple entity types', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await log.append(eventInput('Deal', 'd1', 'create', { title: 'Enterprise', value: 50000 }))
      await log.append(eventInput('Invoice', 'i1', 'create', { amount: 1000, currency: 'USD' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))
      await log.append(eventInput('Deal', 'd1', 'update', { value: 75000 }))

      const snap = await log.snapshot()
      expect(Object.keys(snap).length).toBe(3)
      expect(snap['Contact:c1'].stage).toBe('Customer')
      expect(snap['Contact:c1'].name).toBe('Alice')
      expect(snap['Deal:d1'].value).toBe(75000)
      expect(snap['Invoice:i1'].amount).toBe(1000)
    })
  })

  // ===========================================================================
  // 2. CDC stream consumer groups and acknowledgment (8 tests)
  // ===========================================================================

  describe('CDC stream — consumer groups and acknowledgment', () => {
    let log: EventLog
    let cdc: CDCStream

    beforeEach(() => {
      log = new EventLog()
      cdc = new CDCStream(log)
    })

    it('consumer poll with types filter only returns matching entity types', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Invoice', 'i1', 'create'))

      const consumer = cdc.createConsumer('typed-consumer')
      const batch = await consumer.poll({ types: ['Contact'] })
      expect(batch.events.length).toBe(2)
      expect(batch.events.every((e) => e.entityType === 'Contact')).toBe(true)
    })

    it('consumer poll with verbs filter only returns matching verbs', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Contact', 'c1', 'update'))

      const consumer = cdc.createConsumer('verb-consumer')
      const batch = await consumer.poll({ verbs: ['update'] })
      expect(batch.events.length).toBe(2)
      expect(batch.events.every((e) => e.verb === 'update')).toBe(true)
    })

    it('acknowledge events for one consumer does not affect another consumer', async () => {
      const e1 = await log.append(eventInput('Contact', 'c1', 'create'))
      const e2 = await log.append(eventInput('Contact', 'c2', 'create'))
      const e3 = await log.append(eventInput('Contact', 'c3', 'create'))

      await cdc.acknowledge('consumer-a', [e1.$id, e2.$id])
      await cdc.acknowledge('consumer-b', [e1.$id])

      const pendingA = await cdc.pending('consumer-a')
      const pendingB = await cdc.pending('consumer-b')

      expect(pendingA.events.length).toBe(1) // only e3
      expect(pendingB.events.length).toBe(2) // e2 and e3
    })

    it('acknowledging the same event twice is idempotent', async () => {
      const e1 = await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))

      await cdc.acknowledge('consumer-x', [e1.$id])
      await cdc.acknowledge('consumer-x', [e1.$id]) // duplicate ack

      const pending = await cdc.pending('consumer-x')
      expect(pending.events.length).toBe(1) // still just one pending
    })

    it('checkpoint stores and retrieves cursor correctly', async () => {
      await cdc.checkpoint('consumer-1', 'evt_cursor123')
      const cursor = await cdc.getCursor('consumer-1')
      expect(cursor).toBe('evt_cursor123')
    })

    it('getCursor returns undefined for unknown consumer', async () => {
      const cursor = await cdc.getCursor('unknown-consumer')
      expect(cursor).toBeUndefined()
    })

    it('lag for consumer with no checkpoint equals total event count', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Contact', 'c3', 'create'))

      const lag = await cdc.lag('brand-new-consumer')
      expect(lag).toBe(3)
    })

    it('consumer sequential poll-checkpoint cycles exhaust the log', async () => {
      for (let i = 0; i < 6; i++) {
        await log.append(eventInput('Contact', `c${i}`, 'create'))
      }

      const consumer = cdc.createConsumer('exhausting-consumer')
      const allEvents: NounEvent[] = []

      // Poll in batches of 2
      let batch = await consumer.poll({ batchSize: 2 })
      while (batch.events.length > 0) {
        allEvents.push(...batch.events)
        await consumer.checkpoint()
        batch = await consumer.poll({ batchSize: 2 })
      }

      expect(allEvents.length).toBe(6)
      // Verify all distinct entities were received
      const entityIds = allEvents.map((e) => e.entityId)
      expect(new Set(entityIds).size).toBe(6)
    })
  })

  // ===========================================================================
  // 3. TimeTraveler projection and causedBy edge cases (8 tests)
  // ===========================================================================

  describe('TimeTraveler — projection and causedBy edge cases', () => {
    let log: EventLog
    let traveler: TimeTraveler

    beforeEach(() => {
      log = new EventLog()
      traveler = new TimeTraveler(log)
    })

    it('projection includes $-prefixed meta fields when explicitly requested', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))

      const proj = await traveler.projection('Contact', 'c1', ['$id', '$type', '$version', 'name'])
      expect(proj.$id).toBe('c1')
      expect(proj.$type).toBe('Contact')
      expect(proj.$version).toBe(1)
      expect(proj.name).toBe('Alice')
    })

    it('projection for non-existent field returns object without that field', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))

      const proj = await traveler.projection('Contact', 'c1', ['name', 'nonexistent_field'])
      expect(proj.name).toBe('Alice')
      expect('nonexistent_field' in proj).toBe(false)
    })

    it('projection with empty fields array returns empty object', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))

      const proj = await traveler.projection('Contact', 'c1', [])
      expect(proj).toEqual({})
    })

    it('causedBy finds the first event that set a field value', async () => {
      const createEvent = await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))

      // Find what caused name = 'Alice' — should be the create event
      const cause = await traveler.causedBy('Contact', 'c1', 'name', 'Alice')
      expect(cause).toBeDefined()
      expect(cause!.$id).toBe(createEvent.$id)
    })

    it('causedBy returns the correct event when field is overwritten multiple times', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      const customerEvent = await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))

      // causedBy finds the FIRST event that set stage to Customer
      const cause = await traveler.causedBy('Contact', 'c1', 'stage', 'Customer')
      expect(cause).toBeDefined()
      expect(cause!.$id).toBe(customerEvent.$id)
    })

    it('causedBy works with numeric field values', async () => {
      await log.append(eventInput('Deal', 'd1', 'create', { value: 1000 }))
      const updateEvent = await log.append(eventInput('Deal', 'd1', 'update', { value: 50000 }))

      const cause = await traveler.causedBy('Deal', 'd1', 'value', 50000)
      expect(cause).toBeDefined()
      expect(cause!.$id).toBe(updateEvent.$id)
    })

    it('causedBy works with boolean field values', async () => {
      await log.append(eventInput('FeatureFlag', 'ff1', 'create', { enabled: false }))
      const enableEvent = await log.append(eventInput('FeatureFlag', 'ff1', 'update', { enabled: true }))

      const cause = await traveler.causedBy('FeatureFlag', 'ff1', 'enabled', true)
      expect(cause).toBeDefined()
      expect(cause!.$id).toBe(enableEvent.$id)
    })

    it('causedBy returns undefined for non-existent entity', async () => {
      const cause = await traveler.causedBy('Contact', 'nonexistent', 'stage', 'Lead')
      expect(cause).toBeUndefined()
    })
  })

  // ===========================================================================
  // 4. SubscriptionManager retry and failure modes (7 tests)
  // ===========================================================================

  describe('SubscriptionManager — retry and failure modes', () => {
    let manager: SubscriptionManager

    beforeEach(() => {
      manager = new SubscriptionManager()
    })

    it('async handler that rejects is counted as failed', async () => {
      manager.registerCode('Contact.*', async () => {
        throw new Error('async handler failure')
      })

      const result = await manager.dispatch(makeNounEvent())
      expect(result.failed).toBe(1)
      expect(result.delivered).toBe(0)
    })

    it('mix of passing and failing handlers reports correct counts', async () => {
      manager.registerCode('Contact.*', vi.fn()) // success
      manager.registerCode('Contact.*', async () => {
        throw new Error('fail 1')
      })
      manager.registerCode('Contact.*', vi.fn()) // success
      manager.registerCode('Contact.*', () => {
        throw new Error('fail 2')
      })
      manager.registerCode('*', vi.fn()) // success (also matches)

      const result = await manager.dispatch(makeNounEvent())
      expect(result.delivered).toBe(3)
      expect(result.failed).toBe(2)
    })

    it('dispatch to websocket subscription does not count as failed (no-op transport)', async () => {
      manager.registerWebSocket('Contact.*', 'wss://example.com/events')

      const result = await manager.dispatch(makeNounEvent())
      // WebSocket dispatch is a no-op placeholder that resolves successfully
      expect(result.delivered).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('dispatch with no matching subscriptions returns zero counts', async () => {
      manager.registerCode('Deal.*', vi.fn())
      manager.registerWebhook('Invoice.*', 'https://hook.example.com')

      const result = await manager.dispatch(makeNounEvent({ $type: 'Contact.created', entityType: 'Contact' }))
      expect(result.delivered).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('deactivated subscription is not counted in dispatch results', async () => {
      const id = manager.registerCode('Contact.*', vi.fn())
      manager.deactivate(id)

      const result = await manager.dispatch(makeNounEvent())
      expect(result.delivered).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('handler that returns a resolved promise is counted as delivered', async () => {
      manager.registerCode('Contact.*', async () => {
        await sleep(1) // tiny async work
      })

      const result = await manager.dispatch(makeNounEvent())
      expect(result.delivered).toBe(1)
      expect(result.failed).toBe(0)
    })

    it('attach replaces previous EventLog attachment', async () => {
      const log1 = new EventLog()
      const log2 = new EventLog()
      const handler = vi.fn()

      manager.registerCode('Contact.*', handler)
      manager.attach(log1)
      manager.attach(log2) // should detach from log1

      await log1.append(eventInput('Contact', 'c1', 'create'))
      expect(handler).not.toHaveBeenCalled() // detached from log1

      await log2.append(eventInput('Contact', 'c2', 'create'))
      expect(handler).toHaveBeenCalledOnce() // attached to log2
    })
  })

  // ===========================================================================
  // 5. Event serialization round-trips (toJSON/fromJSON) (6 tests)
  // ===========================================================================

  describe('Event serialization round-trips', () => {
    it('toJSON on empty log returns empty JSON array', () => {
      const log = new EventLog()
      const json = log.toJSON()
      expect(json).toBe('[]')
    })

    it('fromJSON with empty array produces empty log', () => {
      const log = new EventLog()
      log.fromJSON('[]')
      expect(log.size).toBe(0)
    })

    it('fromJSON then toJSON produces identical JSON', async () => {
      const log = new EventLog()
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Deal', 'd1', 'create', { title: 'Big Deal' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))

      const json1 = log.toJSON()

      const log2 = new EventLog()
      log2.fromJSON(json1)
      const json2 = log2.toJSON()

      expect(JSON.parse(json2)).toEqual(JSON.parse(json1))
    })

    it('fromJSON correctly restores sequences for multiple entities', async () => {
      const log = new EventLog()
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Deal', 'd1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'update'))
      await log.append(eventInput('Deal', 'd1', 'update'))

      const json = log.toJSON()
      const restored = new EventLog()
      restored.fromJSON(json)

      // Contact:c1 was at seq 2, next should be 3
      const contactNext = await restored.append(eventInput('Contact', 'c1', 'update'))
      expect(contactNext.sequence).toBe(3)

      // Deal:d1 was at seq 3, next should be 4
      const dealNext = await restored.append(eventInput('Deal', 'd1', 'update'))
      expect(dealNext.sequence).toBe(4)
    })

    it('fromJSON preserves complex nested data payloads', async () => {
      const log = new EventLog()
      const complexData = {
        name: 'Alice',
        nested: { deep: { value: [1, 2, 3] } },
        tags: ['a', 'b'],
        metadata: { score: 42, flag: true, nothing: null },
      }
      await log.append(eventInput('Contact', 'c1', 'create', complexData))

      const json = log.toJSON()
      const restored = new EventLog()
      restored.fromJSON(json)

      const history = await restored.getEntityHistory('Contact', 'c1')
      expect(history[0].after).toEqual(complexData)
    })

    it('fromJSON clears existing events before loading', async () => {
      const log = new EventLog()
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      expect(log.size).toBe(2)

      // Load different data
      const otherLog = new EventLog()
      await otherLog.append(eventInput('Deal', 'd1', 'create'))
      const json = otherLog.toJSON()

      log.fromJSON(json)
      expect(log.size).toBe(1)
      const history = await log.getEntityHistory('Contact', 'c1')
      expect(history.length).toBe(0) // old data gone
    })
  })

  // ===========================================================================
  // 6. Concurrent subscription management (6 tests)
  // ===========================================================================

  describe('Concurrent subscription management', () => {
    it('registering multiple code handlers concurrently all get unique IDs', () => {
      const manager = new SubscriptionManager()
      const ids = new Set<string>()

      for (let i = 0; i < 50; i++) {
        ids.add(manager.registerCode(`Pattern${i}.*`, vi.fn()))
      }

      expect(ids.size).toBe(50)
      expect(manager.count).toBe(50)
    })

    it('clear then re-register works correctly', () => {
      const manager = new SubscriptionManager()
      manager.registerCode('Contact.*', vi.fn())
      manager.registerWebSocket('Deal.*', 'wss://example.com')
      expect(manager.count).toBe(2)

      manager.clear()
      expect(manager.count).toBe(0)
      expect(manager.list().length).toBe(0)

      const newId = manager.registerCode('Invoice.*', vi.fn())
      expect(manager.count).toBe(1)
      expect(manager.get(newId)).toBeDefined()
    })

    it('subscription createdAt is a valid ISO timestamp', () => {
      const manager = new SubscriptionManager()
      const id = manager.registerCode('Contact.*', vi.fn())
      const sub = manager.get(id)
      expect(sub).toBeDefined()
      // Verify it parses as a valid date
      const date = new Date(sub!.createdAt)
      expect(date.getTime()).not.toBeNaN()
    })

    it('list filters by pattern', () => {
      const manager = new SubscriptionManager()
      manager.registerCode('Contact.*', vi.fn())
      manager.registerCode('Contact.*', vi.fn())
      manager.registerCode('Deal.*', vi.fn())
      manager.registerWebhook('Contact.*', 'https://hook.example.com')

      const contactSubs = manager.list({ pattern: 'Contact.*' })
      expect(contactSubs.length).toBe(3) // 2 code + 1 webhook

      const dealSubs = manager.list({ pattern: 'Deal.*' })
      expect(dealSubs.length).toBe(1)
    })

    it('unsubscribe after clear returns false (already removed)', () => {
      const manager = new SubscriptionManager()
      const id = manager.registerCode('Contact.*', vi.fn())
      manager.clear()
      expect(manager.unsubscribe(id)).toBe(false)
    })

    it('get returns undefined after unsubscribe', () => {
      const manager = new SubscriptionManager()
      const id = manager.registerCode('Contact.*', vi.fn())
      manager.unsubscribe(id)
      expect(manager.get(id)).toBeUndefined()
    })
  })

  // ===========================================================================
  // 7. Memory pressure — large event volumes (5 tests)
  // ===========================================================================

  describe('Memory pressure — large event volumes', () => {
    it('EventLog handles 1000 events without error', async () => {
      const log = new EventLog()
      for (let i = 0; i < 1000; i++) {
        await log.append(eventInput('Contact', `c${i}`, 'create', { idx: i }))
      }
      expect(log.size).toBe(1000)
    })

    it('query on large log with limit returns correct subset', async () => {
      const log = new EventLog()
      for (let i = 0; i < 200; i++) {
        await log.append(eventInput('Contact', `c${i}`, 'create', { idx: i }))
      }

      const results = await log.query({ limit: 10, offset: 50 })
      expect(results.length).toBe(10)
      expect(results[0].after!.idx).toBe(50)
      expect(results[9].after!.idx).toBe(59)
    })

    it('uniqueEntities on large log with many entity types returns correct count', async () => {
      const log = new EventLog()
      const types = ['Contact', 'Deal', 'Invoice', 'Payment', 'Subscription']
      for (let i = 0; i < 100; i++) {
        const type = types[i % types.length]
        await log.append(eventInput(type, `${type.toLowerCase()}_${i}`, 'create', { idx: i }))
      }

      const entities = await log.uniqueEntities()
      expect(entities.length).toBe(100) // 100 unique entity type+id pairs
    })

    it('getBatch on large log retrieves correct events efficiently', async () => {
      const log = new EventLog()
      const targetEvents: NounEvent[] = []

      for (let i = 0; i < 500; i++) {
        const event = await log.append(eventInput('Contact', `c${i}`, 'create'))
        if (i % 100 === 0) targetEvents.push(event)
      }

      const ids = targetEvents.map((e) => e.$id)
      const batch = await log.getBatch(ids)
      expect(batch.length).toBe(5) // 0, 100, 200, 300, 400
      for (let i = 0; i < batch.length; i++) {
        expect(batch[i].$id).toBe(targetEvents[i].$id)
      }
    })

    it('snapshot on large log with many entities produces correct merged state', async () => {
      const log = new EventLog()
      // Create 50 contacts then update each one
      for (let i = 0; i < 50; i++) {
        await log.append(eventInput('Contact', `c${i}`, 'create', { name: `User${i}`, stage: 'Lead' }))
      }
      for (let i = 0; i < 50; i++) {
        await log.append(eventInput('Contact', `c${i}`, 'update', { stage: 'Customer' }))
      }

      const snap = await log.snapshot()
      expect(Object.keys(snap).length).toBe(50)
      // Each should have merged state
      for (let i = 0; i < 50; i++) {
        expect(snap[`Contact:c${i}`].name).toBe(`User${i}`)
        expect(snap[`Contact:c${i}`].stage).toBe('Customer')
      }
    })
  })

  // ===========================================================================
  // 8. Stream filtering combinations (5 tests)
  // ===========================================================================

  describe('Stream filtering combinations', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('stream with entityType + verb combined filter', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Deal', 'd1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))

      const events: NounEvent[] = []
      for await (const event of log.stream({ entityType: 'Contact', verb: 'create' })) {
        events.push(event)
      }
      expect(events.length).toBe(2) // c1 create and c2 create
      expect(events.every((e) => e.entityType === 'Contact' && e.verb === 'create')).toBe(true)
    })

    it('stream with entityId filter yields events only for that entity', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Contact', 'c3', 'create'))

      const events: NounEvent[] = []
      for await (const event of log.stream({ entityId: 'c1' })) {
        events.push(event)
      }
      expect(events.length).toBe(2)
      expect(events.every((e) => e.entityId === 'c1')).toBe(true)
    })

    it('stream on empty log yields nothing', async () => {
      const events: NounEvent[] = []
      for await (const event of log.stream()) {
        events.push(event)
      }
      expect(events.length).toBe(0)
    })

    it('stream with entityType + entityId + verb filter (triple filter)', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Contact', 'c2', 'update'))
      await log.append(eventInput('Deal', 'c1', 'update'))

      const events: NounEvent[] = []
      for await (const event of log.stream({ entityType: 'Contact', entityId: 'c1', verb: 'update' })) {
        events.push(event)
      }
      expect(events.length).toBe(1)
      expect(events[0].entityType).toBe('Contact')
      expect(events[0].entityId).toBe('c1')
      expect(events[0].verb).toBe('update')
    })

    it('stream with filter that matches nothing yields empty', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))

      const events: NounEvent[] = []
      for await (const event of log.stream({ entityType: 'Invoice' })) {
        events.push(event)
      }
      expect(events.length).toBe(0)
    })
  })

  // ===========================================================================
  // 9. Event metadata fields (8 tests)
  // ===========================================================================

  describe('Event metadata fields', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('before state is preserved in appended events', async () => {
      const event = await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }, { stage: 'Lead' }))
      expect(event.before).toEqual({ stage: 'Lead' })
      expect(event.after).toEqual({ stage: 'Qualified' })
    })

    it('before state is retrievable via get()', async () => {
      const event = await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }, { stage: 'Qualified' }))
      const retrieved = await log.get(event.$id)
      expect(retrieved!.before).toEqual({ stage: 'Qualified' })
    })

    it('data payload is preserved alongside before/after', async () => {
      const input: NounEventInput = {
        $type: 'Contact.qualified',
        entityType: 'Contact',
        entityId: 'c1',
        verb: 'qualify',
        conjugation: { action: 'qualify', activity: 'qualifying', event: 'qualified' },
        data: { reason: 'High score', triggeredBy: 'automation' },
        after: { stage: 'Qualified' },
        before: { stage: 'Lead' },
      }

      const event = await log.append(input)
      expect(event.data).toEqual({ reason: 'High score', triggeredBy: 'automation' })
      expect(event.before).toEqual({ stage: 'Lead' })
      expect(event.after).toEqual({ stage: 'Qualified' })
    })

    it('conjugation fields are preserved correctly', async () => {
      const input: NounEventInput = {
        $type: 'Deal.closed',
        entityType: 'Deal',
        entityId: 'd1',
        verb: 'close',
        conjugation: { action: 'close', activity: 'closing', event: 'closed' },
        after: { status: 'won' },
      }

      const event = await log.append(input)
      expect(event.conjugation.action).toBe('close')
      expect(event.conjugation.activity).toBe('closing')
      expect(event.conjugation.event).toBe('closed')
    })

    it('context and actor can be queried via getEntityHistory', async () => {
      await log.append({
        ...eventInput('Contact', 'c1', 'create', { name: 'Alice' }),
        actor: 'user_agent123',
        context: 'https://headless.ly/~startup',
      })
      await log.append({
        ...eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }),
        actor: 'user_human456',
        context: 'https://headless.ly/~startup',
      })

      const history = await log.getEntityHistory('Contact', 'c1')
      expect(history[0].actor).toBe('user_agent123')
      expect(history[1].actor).toBe('user_human456')
      expect(history[0].context).toBe('https://headless.ly/~startup')
    })

    it('events without optional fields have them as undefined', async () => {
      const event = await log.append(eventInput('Contact', 'c1', 'create'))
      expect(event.actor).toBeUndefined()
      expect(event.context).toBeUndefined()
      expect(event.data).toBeUndefined()
      expect(event.before).toBeUndefined()
    })

    it('$type field follows EntityType.verbEvent format', async () => {
      const event = await log.append({
        $type: 'Contact.qualified',
        entityType: 'Contact',
        entityId: 'c1',
        verb: 'qualify',
        conjugation: { action: 'qualify', activity: 'qualifying', event: 'qualified' },
      })
      expect(event.$type).toBe('Contact.qualified')
    })

    it('$id format starts with evt_ prefix', async () => {
      const events: NounEvent[] = []
      for (let i = 0; i < 10; i++) {
        events.push(await log.append(eventInput('Contact', `c${i}`, 'create')))
      }
      for (const event of events) {
        expect(event.$id).toMatch(/^evt_[a-zA-Z0-9]+$/)
      }
    })
  })

  // ===========================================================================
  // 10. TimeTraveler — advanced state reconstruction (5 tests)
  // ===========================================================================

  describe('TimeTraveler — advanced state reconstruction', () => {
    let log: EventLog
    let traveler: TimeTraveler

    beforeEach(() => {
      log = new EventLog()
      traveler = new TimeTraveler(log)
    })

    it('timeline for entity with only one event returns single entry', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))

      const tl = await traveler.timeline('Contact', 'c1')
      expect(tl.length).toBe(1)
      expect(tl[0].version).toBe(1)
      expect(tl[0].state.name).toBe('Alice')
      expect(tl[0].timestamp).toBeDefined()
    })

    it('timeline for non-existent entity returns empty array', async () => {
      const tl = await traveler.timeline('Contact', 'nonexistent')
      expect(tl).toEqual([])
    })

    it('diff events between two versions contains only the intermediate events', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c1', 'update', { score: 80 }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))

      const result = await traveler.diff('Contact', 'c1', { atVersion: 1 }, { atVersion: 4 })
      // Events between version 1 and 4: sequences 2, 3, 4
      expect(result.events.length).toBe(3)
      expect(result.events[0].sequence).toBe(2)
      expect(result.events[2].sequence).toBe(4)
    })

    it('snapshotAll on empty log returns empty array', async () => {
      const all = await traveler.snapshotAll()
      expect(all).toEqual([])
    })

    it('rollback preserves event immutability — total event count only grows', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))
      expect(log.size).toBe(2)

      await traveler.rollback('Contact', 'c1', { atVersion: 1 })
      // Rollback adds a new event; it never removes
      expect(log.size).toBe(3)

      const history = await log.getEntityHistory('Contact', 'c1')
      expect(history.length).toBe(3)
      expect(history[2].verb).toBe('rollback')
    })
  })

  // ===========================================================================
  // 11. CDC + SSE stream creation (3 tests)
  // ===========================================================================

  describe('CDC — SSE stream', () => {
    it('createSSEStream returns a ReadableStream', async () => {
      const log = new EventLog()
      const cdc = new CDCStream(log)

      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))

      const stream = cdc.createSSEStream({})
      expect(stream).toBeInstanceOf(ReadableStream)

      // Cancel the stream to clean up (prevent heartbeat timer leak)
      await stream.cancel()
    })

    it('SSE stream emits buffered events in correct format', async () => {
      const log = new EventLog()
      const cdc = new CDCStream(log)

      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))

      const stream = cdc.createSSEStream({})
      const reader = stream.getReader()

      const { value, done } = await reader.read()
      expect(done).toBe(false)
      const text = new TextDecoder().decode(value)

      // SSE format: id: ..., event: ..., data: ...
      expect(text).toContain('id: evt_')
      expect(text).toContain('event: Contact.created')
      expect(text).toContain('data: {')

      reader.releaseLock()
      await stream.cancel()
    })

    it('SSE stream can be cancelled without error', async () => {
      const log = new EventLog()
      const cdc = new CDCStream(log)

      const stream = cdc.createSSEStream({})
      // Immediately cancel — should not throw
      await stream.cancel()
    })
  })

  // ===========================================================================
  // 12. CDC poll combined filters (2 tests)
  // ===========================================================================

  describe('CDC poll — combined filters', () => {
    it('poll with both types and verbs filters', async () => {
      const log = new EventLog()
      const cdc = new CDCStream(log)

      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Deal', 'd1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'update'))
      await log.append(eventInput('Invoice', 'i1', 'create'))

      const result = await cdc.poll({ types: ['Contact', 'Deal'], verbs: ['update'] })
      expect(result.events.length).toBe(2)
      expect(result.events[0].entityType).toBe('Contact')
      expect(result.events[0].verb).toBe('update')
      expect(result.events[1].entityType).toBe('Deal')
      expect(result.events[1].verb).toBe('update')
    })

    it('poll with cursor + type filter skips past events and filters', async () => {
      const log = new EventLog()
      const cdc = new CDCStream(log)

      const e1 = await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Invoice', 'i1', 'create'))

      const result = await cdc.poll({ after: e1.$id, types: ['Contact'] })
      expect(result.events.length).toBe(1) // only c2, since c1 is before cursor
      expect(result.events[0].entityId).toBe('c2')
    })
  })
})
