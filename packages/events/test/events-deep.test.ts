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
// Tests
// =============================================================================

describe('@headlessly/events — deep coverage (RED)', () => {
  // ===========================================================================
  // 1. SubscriptionManager — ~12 tests
  // ===========================================================================

  describe('SubscriptionManager', () => {
    let manager: SubscriptionManager

    beforeEach(() => {
      manager = new SubscriptionManager()
    })

    // --- These should PASS (basic coverage for the new file) ---

    it('registers a code subscription and returns a sub_ id', () => {
      const handler = vi.fn()
      const id = manager.registerCode('Contact.*', handler)
      expect(id).toMatch(/^sub_/)
    })

    it('registers a websocket subscription with endpoint', () => {
      const id = manager.registerWebSocket('Deal.*', 'wss://example.com/events')
      const sub = manager.get(id)
      expect(sub).toBeDefined()
      expect(sub!.mode).toBe('websocket')
      expect(sub!.endpoint).toBe('wss://example.com/events')
    })

    it('registers a webhook subscription with secret', () => {
      const id = manager.registerWebhook('*.created', 'https://hook.example.com', 'secret123')
      const sub = manager.get(id)
      expect(sub!.mode).toBe('webhook')
      expect(sub!.secret).toBe('secret123')
    })

    it('lists all active subscriptions', () => {
      manager.registerCode('Contact.*', vi.fn())
      manager.registerWebSocket('Deal.*', 'wss://example.com')
      manager.registerWebhook('*.created', 'https://hook.example.com')
      expect(manager.list().length).toBe(3)
    })

    it('unsubscribe removes and returns true, false for non-existent', () => {
      const id = manager.registerCode('Contact.*', vi.fn())
      expect(manager.unsubscribe(id)).toBe(true)
      expect(manager.get(id)).toBeUndefined()
      expect(manager.unsubscribe('sub_nonexistent9')).toBe(false)
    })

    it('dispatches to matching code handlers', async () => {
      const handler = vi.fn()
      manager.registerCode('Contact.*', handler)
      await manager.dispatch(makeNounEvent())
      expect(handler).toHaveBeenCalledOnce()
    })

    it('does not dispatch to non-matching subscriptions', async () => {
      const handler = vi.fn()
      manager.registerCode('Deal.*', handler)
      await manager.dispatch(makeNounEvent({ $type: 'Contact.created', entityType: 'Contact' }))
      expect(handler).not.toHaveBeenCalled()
    })

    // --- These should FAIL (RED) — features not yet implemented ---

    it('deactivate() pauses a subscription without removing it', () => {
      const id = manager.registerCode('Contact.*', vi.fn())
      // @ts-expect-error — method does not exist yet
      manager.deactivate(id)
      const sub = manager.get(id)
      expect(sub).toBeDefined()
      expect(sub!.active).toBe(false)
    })

    it('activate() resumes a deactivated subscription', () => {
      const handler = vi.fn()
      const id = manager.registerCode('Contact.*', handler)
      // @ts-expect-error — method does not exist yet
      manager.deactivate(id)
      // @ts-expect-error — method does not exist yet
      manager.activate(id)
      const sub = manager.get(id)
      expect(sub!.active).toBe(true)
    })

    it('dispatch returns a DispatchResult with delivery count', async () => {
      manager.registerCode('Contact.*', vi.fn())
      manager.registerCode('*', vi.fn())
      manager.registerCode('Deal.*', vi.fn())

      // @ts-expect-error — dispatch currently returns void, should return DispatchResult
      const result: { delivered: number; failed: number } = await manager.dispatch(makeNounEvent())
      expect(result).toBeDefined()
      expect(result.delivered).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('count property returns total number of subscriptions', () => {
      manager.registerCode('Contact.*', vi.fn())
      manager.registerWebhook('Deal.*', 'https://hook.example.com')
      // @ts-expect-error — property does not exist yet
      expect(manager.count).toBe(2)
    })

    it('clear() removes all subscriptions', () => {
      manager.registerCode('Contact.*', vi.fn())
      manager.registerWebhook('Deal.*', 'https://hook.example.com')
      manager.registerWebSocket('*', 'wss://example.com')
      // @ts-expect-error — method does not exist yet
      manager.clear()
      expect(manager.list().length).toBe(0)
    })
  })

  // ===========================================================================
  // 2. CDCStream — ~8 tests
  // ===========================================================================

  describe('CDCStream', () => {
    let log: EventLog
    let cdc: CDCStream

    beforeEach(() => {
      log = new EventLog()
      cdc = new CDCStream(log)
    })

    // --- These should PASS ---

    it('returns empty batch from empty log', async () => {
      const result = await cdc.poll({})
      expect(result.events).toEqual([])
      expect(result.hasMore).toBe(false)
    })

    it('resumes from cursor position', async () => {
      const e1 = await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))

      const result = await cdc.poll({ after: e1.$id })
      expect(result.events.length).toBe(2)
      expect(result.events[0].entityId).toBe('c2')
    })

    it('filters by entity type', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))

      const result = await cdc.poll({ types: ['Contact'] })
      expect(result.events.length).toBe(2)
    })

    it('respects batchSize and returns hasMore', async () => {
      for (let i = 0; i < 4; i++) await log.append(eventInput('Contact', `c${i}`, 'create'))

      const result = await cdc.poll({ batchSize: 2 })
      expect(result.events.length).toBe(2)
      expect(result.hasMore).toBe(true)
    })

    // --- These should FAIL (RED) — features not yet implemented ---

    it('checkpoint() persists the consumer cursor position', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))

      const batch = await cdc.poll({ batchSize: 1 })
      // @ts-expect-error — method does not exist yet
      await cdc.checkpoint('consumer-1', batch.cursor)

      // @ts-expect-error — method does not exist yet
      const savedCursor = await cdc.getCursor('consumer-1')
      expect(savedCursor).toBe(batch.cursor)
    })

    it('acknowledge() marks specific events as processed', async () => {
      const e1 = await log.append(eventInput('Contact', 'c1', 'create'))
      const e2 = await log.append(eventInput('Contact', 'c2', 'create'))

      // @ts-expect-error — method does not exist yet
      await cdc.acknowledge('consumer-1', [e1.$id])

      // @ts-expect-error — method does not exist yet
      const pending = await cdc.pending('consumer-1')
      expect(pending.events.length).toBe(1)
      expect(pending.events[0].$id).toBe(e2.$id)
    })

    it('createConsumer() returns a named consumer with auto-tracking cursor', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))

      // @ts-expect-error — method does not exist yet
      const consumer = cdc.createConsumer('worker-1')
      expect(consumer).toBeDefined()
      expect(typeof consumer.poll).toBe('function')
      expect(typeof consumer.checkpoint).toBe('function')

      const batch = await consumer.poll({ batchSize: 1 })
      expect(batch.events.length).toBe(1)
      await consumer.checkpoint()

      // Next poll should resume
      const batch2 = await consumer.poll({ batchSize: 10 })
      expect(batch2.events.length).toBe(1)
      expect(batch2.events[0].entityId).toBe('c2')
    })

    it('lag() returns the number of unconsumed events for a consumer', async () => {
      for (let i = 0; i < 5; i++) await log.append(eventInput('Contact', `c${i}`, 'create'))

      // @ts-expect-error — method does not exist yet
      const lag = await cdc.lag('consumer-1')
      expect(lag).toBe(5)
    })
  })

  // ===========================================================================
  // 3. EventLog Edge Cases — ~8 tests
  // ===========================================================================

  describe('EventLog — edge cases', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    // --- These should PASS ---

    it('queries with since and until (time window)', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await sleep(15)
      const start = new Date().toISOString()
      await sleep(15)
      await log.append(eventInput('Contact', 'c2', 'create'))
      await sleep(15)
      const end = new Date().toISOString()
      await sleep(15)
      await log.append(eventInput('Contact', 'c3', 'create'))

      const results = await log.query({ since: start, until: end })
      expect(results.length).toBe(1)
      expect(results[0].entityId).toBe('c2')
    })

    it('queries with limit and offset', async () => {
      for (let i = 0; i < 5; i++) await log.append(eventInput('Contact', `c${i}`, 'create'))

      const results = await log.query({ offset: 2, limit: 2 })
      expect(results.length).toBe(2)
      expect(results[0].entityId).toBe('c2')
    })

    it('getEntityHistory returns events in chronological order', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))

      const history = await log.getEntityHistory('Contact', 'c1')
      for (let i = 1; i < history.length; i++) {
        expect(history[i].sequence).toBeGreaterThan(history[i - 1].sequence)
      }
    })

    it('subscriber errors do not break the append chain', async () => {
      log.subscribe('*', () => {
        throw new Error('boom')
      })
      const event = await log.append(eventInput('Contact', 'c1', 'create'))
      expect(event).toBeDefined()
      expect(log.size).toBe(1)
    })

    // --- These should FAIL (RED) — features not yet implemented ---

    it('snapshot() returns a materialized view of all entities at current state', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Deal', 'd1', 'create', { title: 'Big Deal', value: 50000 }))

      // @ts-expect-error — method does not exist yet
      const snapshot = await log.snapshot()
      expect(snapshot).toBeDefined()
      expect(snapshot['Contact:c1']).toBeDefined()
      expect(snapshot['Contact:c1'].stage).toBe('Qualified')
      expect(snapshot['Deal:d1']).toBeDefined()
      expect(snapshot['Deal:d1'].title).toBe('Big Deal')
    })

    it('compact() merges events for the same entity into snapshots', async () => {
      for (let i = 0; i < 20; i++) {
        await log.append(eventInput('Contact', 'c1', i === 0 ? 'create' : 'update', { counter: i }))
      }
      expect(log.size).toBe(20)

      // @ts-expect-error — method does not exist yet
      const compacted = await log.compact('Contact', 'c1')
      expect(compacted.originalCount).toBe(20)
      expect(compacted.snapshotEvent).toBeDefined()
    })

    it('getBatch() retrieves multiple events by ID in one call', async () => {
      const e1 = await log.append(eventInput('Contact', 'c1', 'create'))
      const e2 = await log.append(eventInput('Deal', 'd1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))

      // @ts-expect-error — method does not exist yet
      const batch = await log.getBatch([e1.$id, e2.$id])
      expect(batch.length).toBe(2)
      expect(batch[0].$id).toBe(e1.$id)
      expect(batch[1].$id).toBe(e2.$id)
    })

    it('append validates required fields and rejects invalid input', async () => {
      // Missing entityType should throw
      await expect(
        log.append({
          $type: 'Contact.created',
          entityType: '',
          entityId: 'c1',
          verb: 'create',
          conjugation: { action: 'create', activity: 'creating', event: 'created' },
        }),
      ).rejects.toThrow()
    })

    it('clear() removes all events and resets sequences', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))
      expect(log.size).toBe(2)

      // @ts-expect-error — method does not exist yet
      await log.clear()
      expect(log.size).toBe(0)

      // Sequences should reset
      const e = await log.append(eventInput('Contact', 'c1', 'create'))
      expect(e.sequence).toBe(1)
    })

    it('stream() returns an async iterable of events', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c2', 'create'))

      // @ts-expect-error — method does not exist yet
      const iterable = log.stream({ entityType: 'Contact' })
      const events: NounEvent[] = []
      for await (const event of iterable) {
        events.push(event)
      }
      expect(events.length).toBe(2)
    })

    it('count() returns total without loading events', async () => {
      for (let i = 0; i < 10; i++) await log.append(eventInput('Contact', `c${i}`, 'create'))

      // @ts-expect-error — method does not exist yet
      const total = await log.count({ entityType: 'Contact' })
      expect(total).toBe(10)
    })

    it('uniqueEntities() returns distinct entity type+id pairs', async () => {
      await log.append(eventInput('Contact', 'c1', 'create'))
      await log.append(eventInput('Contact', 'c1', 'update'))
      await log.append(eventInput('Contact', 'c2', 'create'))
      await log.append(eventInput('Deal', 'd1', 'create'))

      // @ts-expect-error — method does not exist yet
      const entities = await log.uniqueEntities()
      expect(entities.length).toBe(3)
      expect(entities).toContainEqual({ entityType: 'Contact', entityId: 'c1' })
      expect(entities).toContainEqual({ entityType: 'Contact', entityId: 'c2' })
      expect(entities).toContainEqual({ entityType: 'Deal', entityId: 'd1' })
    })
  })

  // ===========================================================================
  // 4. TimeTraveler — advanced (~8 tests)
  // ===========================================================================

  describe('TimeTraveler — advanced', () => {
    let log: EventLog
    let traveler: TimeTraveler

    beforeEach(() => {
      log = new EventLog()
      traveler = new TimeTraveler(log)
    })

    // --- These should PASS ---

    it('asOf with timestamp returns state at that point in time', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await sleep(15)
      const midpoint = new Date().toISOString()
      await sleep(15)
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))

      const state = await traveler.asOf('Contact', 'c1', { asOf: midpoint })
      expect(state).toBeDefined()
      expect(state!.stage).toBe('Lead')
    })

    it('diff with no changes returns empty changes array', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))

      const result = await traveler.diff('Contact', 'c1', { atVersion: 1 }, { atVersion: 1 })
      expect(result.changes).toEqual([])
    })

    it('multiple rollbacks create multiple rollback events', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))

      await traveler.rollback('Contact', 'c1', { atVersion: 1 })
      await traveler.rollback('Contact', 'c1', { atVersion: 2 })

      const history = await log.getEntityHistory('Contact', 'c1')
      const rollbackEvents = history.filter((e) => e.verb === 'rollback')
      expect(rollbackEvents.length).toBe(2)
    })

    it('rollback throws for non-existent entity', async () => {
      await expect(traveler.rollback('Contact', 'nonexistent', { atVersion: 1 })).rejects.toThrow('Cannot rollback')
    })

    // --- These should FAIL (RED) — features not yet implemented ---

    it('timeline() returns a list of all intermediate states with metadata', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))

      // @ts-expect-error — method does not exist yet
      const timeline = await traveler.timeline('Contact', 'c1')
      expect(timeline).toBeDefined()
      expect(timeline.length).toBe(3)
      expect(timeline[0].state.stage).toBe('Lead')
      expect(timeline[0].version).toBe(1)
      expect(timeline[1].state.stage).toBe('Qualified')
      expect(timeline[1].version).toBe(2)
      expect(timeline[2].state.stage).toBe('Customer')
      expect(timeline[2].version).toBe(3)
    })

    it('projection() builds a custom view by selecting specific fields', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead', email: 'alice@example.com' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified', score: 85 }))

      // @ts-expect-error — method does not exist yet
      const projection = await traveler.projection('Contact', 'c1', ['name', 'stage'])
      expect(projection).toBeDefined()
      expect(projection.name).toBe('Alice')
      expect(projection.stage).toBe('Qualified')
      // Projected fields should NOT include non-selected fields
      expect(projection.email).toBeUndefined()
      expect(projection.score).toBeUndefined()
    })

    it('snapshotAll() returns current state of every unique entity', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await log.append(eventInput('Contact', 'c2', 'create', { name: 'Bob' }))
      await log.append(eventInput('Deal', 'd1', 'create', { title: 'Deal 1' }))
      await log.append(eventInput('Contact', 'c1', 'update', { name: 'Alice Smith' }))

      // @ts-expect-error — method does not exist yet
      const allStates = await traveler.snapshotAll()
      expect(allStates.length).toBe(3)
      const alice = allStates.find((s: any) => s.$id === 'c1')
      expect(alice.name).toBe('Alice Smith')
    })

    it('causedBy() returns the event that caused a specific state change', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      const qualifyEvent = await log.append(eventInput('Contact', 'c1', 'qualify', { stage: 'Qualified' }))

      // @ts-expect-error — method does not exist yet
      const cause = await traveler.causedBy('Contact', 'c1', 'stage', 'Qualified')
      expect(cause).toBeDefined()
      expect(cause.$id).toBe(qualifyEvent.$id)
    })

    it('between query with timestamps returns all events in range', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await sleep(15)
      const start = new Date()
      await sleep(15)
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))
      await sleep(15)
      const end = new Date()
      await sleep(15)
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Churned' }))

      // The between query should reconstruct state from only events in that window
      const state = await traveler.asOf('Contact', 'c1', { between: { start, end } })
      expect(state).toBeDefined()
      // between replays only those events, so state = last event in window
      expect(state!.stage).toBe('Customer')
    })
  })

  // ===========================================================================
  // 5. matchesPattern — extended (~5 tests)
  // ===========================================================================

  describe('matchesPattern — extended', () => {
    // --- These should PASS ---

    it('* matches everything', () => {
      expect(matchesPattern('*', 'Contact.created')).toBe(true)
      expect(matchesPattern('*', 'Deal.closed')).toBe(true)
    })

    it('Contact.* matches any Contact event', () => {
      expect(matchesPattern('Contact.*', 'Contact.created')).toBe(true)
      expect(matchesPattern('Contact.*', 'Contact.qualified')).toBe(true)
    })

    it('*.created matches any created event', () => {
      expect(matchesPattern('*.created', 'Contact.created')).toBe(true)
      expect(matchesPattern('*.created', 'Deal.created')).toBe(true)
    })

    it('exact match works', () => {
      expect(matchesPattern('Contact.created', 'Contact.created')).toBe(true)
      expect(matchesPattern('Contact.created', 'Contact.updated')).toBe(false)
      expect(matchesPattern('Contact.created', 'Deal.created')).toBe(false)
    })

    it('Deal.* does NOT match Contact.created', () => {
      expect(matchesPattern('Deal.*', 'Contact.created')).toBe(false)
    })

    // --- These should FAIL (RED) — extended pattern features ---

    it('supports comma-separated multi-pattern: Contact.*,Deal.*', () => {
      // @ts-expect-error — or just test the function, it exists
      expect(matchesPattern('Contact.*,Deal.*', 'Contact.created')).toBe(true)
      expect(matchesPattern('Contact.*,Deal.*', 'Deal.closed')).toBe(true)
      expect(matchesPattern('Contact.*,Deal.*', 'Subscription.created')).toBe(false)
    })

    it('supports negation pattern: !Deal.*', () => {
      expect(matchesPattern('!Deal.*', 'Contact.created')).toBe(true)
      expect(matchesPattern('!Deal.*', 'Deal.closed')).toBe(false)
    })

    it('supports double wildcard for nested types: CRM.**', () => {
      expect(matchesPattern('CRM.**', 'CRM.Contact.created')).toBe(true)
      expect(matchesPattern('CRM.**', 'CRM.Deal.closed')).toBe(true)
      expect(matchesPattern('CRM.**', 'Billing.Invoice.created')).toBe(false)
    })
  })

  // ===========================================================================
  // 6. Integration: EventLog + SubscriptionManager wiring
  // ===========================================================================

  describe('EventLog + SubscriptionManager integration', () => {
    it('SubscriptionManager auto-wires to EventLog via attach()', async () => {
      const log = new EventLog()
      const manager = new SubscriptionManager()

      // @ts-expect-error — method does not exist yet
      manager.attach(log)

      const handler = vi.fn()
      manager.registerCode('Contact.*', handler)

      // Appending to the log should auto-dispatch through manager
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('SubscriptionManager detach() stops auto-dispatching', async () => {
      const log = new EventLog()
      const manager = new SubscriptionManager()

      // @ts-expect-error — method does not exist yet
      manager.attach(log)

      const handler = vi.fn()
      manager.registerCode('Contact.*', handler)

      // @ts-expect-error — method does not exist yet
      manager.detach()

      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      expect(handler).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // 7. SQLiteEventLog parity (structural tests — no actual SQLite needed)
  // ===========================================================================

  describe('EventLog — SQLiteEventLog parity requirements', () => {
    let log: EventLog

    beforeEach(() => {
      log = new EventLog()
    })

    it('toJSON() serializes the entire log for transport', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await log.append(eventInput('Deal', 'd1', 'create', { title: 'Deal' }))

      // @ts-expect-error — method does not exist yet
      const json = log.toJSON()
      expect(typeof json).toBe('string')
      const parsed = JSON.parse(json)
      expect(parsed.length).toBe(2)
      expect(parsed[0].entityType).toBe('Contact')
    })

    it('fromJSON() reconstructs an EventLog from serialized data', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))

      // @ts-expect-error — method does not exist yet
      const json = log.toJSON()

      const newLog = new EventLog()
      // @ts-expect-error — method does not exist yet
      newLog.fromJSON(json)
      expect(newLog.size).toBe(1)
      const history = await newLog.getEntityHistory('Contact', 'c1')
      expect(history.length).toBe(1)
    })

    it('supports actor field for audit trail', async () => {
      const event = await log.append({
        ...eventInput('Contact', 'c1', 'create', { name: 'Alice' }),
        actor: 'user_abc123xyz',
      })
      expect(event.actor).toBe('user_abc123xyz')

      const found = await log.get(event.$id)
      expect(found!.actor).toBe('user_abc123xyz')
    })

    it('supports context field for multi-tenancy', async () => {
      const event = await log.append({
        ...eventInput('Contact', 'c1', 'create', { name: 'Alice' }),
        context: 'https://headless.ly/~acme',
      })
      expect(event.context).toBe('https://headless.ly/~acme')
    })
  })
})
