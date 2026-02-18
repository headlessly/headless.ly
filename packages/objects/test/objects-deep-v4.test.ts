import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearRegistry, Noun, getNounSchema, getAllNouns } from 'digital-objects'
import type { NounProvider, NounInstance } from 'digital-objects'
import { LocalNounProvider } from '../src/local-provider'
import { DONounProvider, DOProviderError } from '../src/do-provider'
import { createEventBridge } from '../src/event-bridge'
import { executeVerb } from '../src/verb-executor'
import { generateSqid, generateEntityId, generateEventId } from '../src/id'
import type { EventEmitter, NounEvent } from '../src/event-bridge'
import { EventLog, TimeTraveler, CDCStream, SubscriptionManager } from '@headlessly/events'

// =============================================================================
// Helper
// =============================================================================
function mockJsonResponse(data: unknown, status = 200, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ data }),
  })
}

describe('@headlessly/objects -- deep-v4 tests', () => {
  // ===========================================================================
  // 1. EventLog.getBatch — edge cases (5 tests)
  // ===========================================================================
  describe('EventLog.getBatch edge cases', () => {
    let eventLog: EventLog
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      eventLog = new EventLog()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~batch',
        eventLog,
      })
    })

    it('getBatch returns events in the order of requested IDs', async () => {
      const a = await provider.create('Contact', { name: 'Alice' })
      const b = await provider.create('Contact', { name: 'Bob' })
      const c = await provider.create('Contact', { name: 'Charlie' })

      const allEvents = await eventLog.query({})
      expect(allEvents).toHaveLength(3)

      // Request in reverse order
      const ids = [allEvents[2].$id, allEvents[0].$id, allEvents[1].$id]
      const batch = await eventLog.getBatch(ids)

      expect(batch).toHaveLength(3)
      expect(batch[0].$id).toBe(allEvents[2].$id)
      expect(batch[1].$id).toBe(allEvents[0].$id)
      expect(batch[2].$id).toBe(allEvents[1].$id)
    })

    it('getBatch with empty array returns empty array', async () => {
      await provider.create('Contact', { name: 'Alice' })
      const batch = await eventLog.getBatch([])
      expect(batch).toEqual([])
    })

    it('getBatch with non-existent IDs returns only found events', async () => {
      await provider.create('Contact', { name: 'Alice' })
      const allEvents = await eventLog.query({})

      const batch = await eventLog.getBatch([allEvents[0].$id, 'evt_nonexistent', 'evt_alsoMissing'])
      expect(batch).toHaveLength(1)
      expect(batch[0].$id).toBe(allEvents[0].$id)
    })

    it('getBatch with duplicate IDs returns each occurrence', async () => {
      await provider.create('Contact', { name: 'Alice' })
      const allEvents = await eventLog.query({})
      const id = allEvents[0].$id

      const batch = await eventLog.getBatch([id, id, id])
      expect(batch).toHaveLength(3)
      expect(batch[0].$id).toBe(id)
      expect(batch[1].$id).toBe(id)
      expect(batch[2].$id).toBe(id)
    })

    it('getBatch with all non-existent IDs returns empty array', async () => {
      const batch = await eventLog.getBatch(['evt_ghost1', 'evt_ghost2'])
      expect(batch).toEqual([])
    })
  })

  // ===========================================================================
  // 2. EventLog.stream — async iterable (4 tests)
  // ===========================================================================
  describe('EventLog.stream async iterable', () => {
    let eventLog: EventLog
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      eventLog = new EventLog()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~stream',
        eventLog,
      })
    })

    it('stream yields all events when no filter is provided', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Deal', { title: 'Big Deal' })

      const events: NounEvent[] = []
      for await (const e of eventLog.stream()) {
        events.push(e as unknown as NounEvent)
      }
      expect(events).toHaveLength(2)
    })

    it('stream with entityType filter yields only matching events', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Deal', { title: 'Big Deal' })
      await provider.create('Contact', { name: 'Bob' })

      const events: NounEvent[] = []
      for await (const e of eventLog.stream({ entityType: 'Deal' })) {
        events.push(e as unknown as NounEvent)
      }
      expect(events).toHaveLength(1)
      expect(events[0].entityType).toBe('Deal')
    })

    it('stream with verb filter yields only matching events', async () => {
      const contact = await provider.create('Contact', { name: 'Alice' })
      await provider.update('Contact', contact.$id, { name: 'Alice Smith' })

      const events: NounEvent[] = []
      for await (const e of eventLog.stream({ verb: 'update' })) {
        events.push(e as unknown as NounEvent)
      }
      expect(events).toHaveLength(1)
      expect(events[0].verb).toBe('update')
    })

    it('stream with entityId filter yields only events for that entity', async () => {
      const alice = await provider.create('Contact', { name: 'Alice' })
      await provider.create('Contact', { name: 'Bob' })
      await provider.update('Contact', alice.$id, { name: 'Alice Updated' })

      const events: NounEvent[] = []
      for await (const e of eventLog.stream({ entityId: alice.$id })) {
        events.push(e as unknown as NounEvent)
      }
      expect(events).toHaveLength(2)
    })
  })

  // ===========================================================================
  // 3. EventLog.snapshot — materialized view (3 tests)
  // ===========================================================================
  describe('EventLog.snapshot materialized view', () => {
    let eventLog: EventLog
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      eventLog = new EventLog()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~snapshot',
        eventLog,
      })
    })

    it('snapshot reflects final state of all entities', async () => {
      const alice = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', alice.$id, { stage: 'Qualified' })
      await provider.create('Deal', { title: 'Deal One', value: 1000 })

      const snap = await eventLog.snapshot()
      const aliceKey = `Contact:${alice.$id}`
      expect(snap[aliceKey]).toBeDefined()
      expect(snap[aliceKey].stage).toBe('Qualified')
    })

    it('snapshot returns empty object when no events exist', async () => {
      const snap = await eventLog.snapshot()
      expect(Object.keys(snap)).toHaveLength(0)
    })

    it('snapshot merges all after states for the same entity', async () => {
      const c = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', c.$id, { stage: 'Qualified' })
      await provider.update('Contact', c.$id, { email: 'alice@test.com' })

      const snap = await eventLog.snapshot()
      const key = `Contact:${c.$id}`
      expect(snap[key].stage).toBe('Qualified')
      expect(snap[key].email).toBe('alice@test.com')
    })
  })

  // ===========================================================================
  // 4. EventLog.get — single event by ID (2 tests)
  // ===========================================================================
  describe('EventLog.get single event by ID', () => {
    let eventLog: EventLog

    beforeEach(() => {
      clearRegistry()
      eventLog = new EventLog()
    })

    it('get returns the event for an existing ID', async () => {
      const provider = new LocalNounProvider({
        context: 'https://headless.ly/~getevt',
        eventLog,
      })
      await provider.create('Contact', { name: 'Alice' })
      const allEvents = await eventLog.query({})
      const id = allEvents[0].$id

      const event = await eventLog.get(id)
      expect(event).not.toBeNull()
      expect(event!.$id).toBe(id)
      expect(event!.entityType).toBe('Contact')
    })

    it('get returns null for a non-existent ID', async () => {
      const event = await eventLog.get('evt_nonexistent')
      expect(event).toBeNull()
    })
  })

  // ===========================================================================
  // 5. EventLog.subscribe — direct subscription on the log (3 tests)
  // ===========================================================================
  describe('EventLog.subscribe direct subscription', () => {
    let eventLog: EventLog

    beforeEach(() => {
      clearRegistry()
      eventLog = new EventLog()
    })

    it('subscriber is notified when events are appended', async () => {
      const received: unknown[] = []
      eventLog.subscribe('*', (e) => received.push(e))

      const provider = new LocalNounProvider({
        context: 'https://headless.ly/~sub',
        eventLog,
      })
      await provider.create('Contact', { name: 'Alice' })

      expect(received).toHaveLength(1)
    })

    it('subscriber with pattern filter only receives matching events', async () => {
      const received: unknown[] = []
      eventLog.subscribe('Contact.*', (e) => received.push(e))

      const provider = new LocalNounProvider({
        context: 'https://headless.ly/~subfilt',
        eventLog,
      })
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Deal', { title: 'Big Deal' })

      expect(received).toHaveLength(1)
    })

    it('unsubscribe prevents further notifications', async () => {
      const received: unknown[] = []
      const unsub = eventLog.subscribe('*', (e) => received.push(e))

      const provider = new LocalNounProvider({
        context: 'https://headless.ly/~unsub',
        eventLog,
      })
      await provider.create('Contact', { name: 'Alice' })
      expect(received).toHaveLength(1)

      unsub()
      await provider.create('Contact', { name: 'Bob' })
      expect(received).toHaveLength(1)
    })
  })

  // ===========================================================================
  // 6. EventLog.query with limit, offset, until (3 tests)
  // ===========================================================================
  describe('EventLog.query with limit, offset, until', () => {
    let eventLog: EventLog
    let provider: LocalNounProvider

    beforeEach(async () => {
      clearRegistry()
      eventLog = new EventLog()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~qpaging',
        eventLog,
      })
      for (let i = 0; i < 10; i++) {
        await provider.create('Contact', { name: `Contact ${i}` })
      }
    })

    it('query with limit returns at most N events', async () => {
      const results = await eventLog.query({ limit: 3 })
      expect(results).toHaveLength(3)
    })

    it('query with offset skips first N events', async () => {
      const all = await eventLog.query({})
      const offset = await eventLog.query({ offset: 7 })
      expect(offset).toHaveLength(3)
      expect(offset[0].$id).toBe(all[7].$id)
    })

    it('query with limit and offset together produces paginated results', async () => {
      const page1 = await eventLog.query({ offset: 0, limit: 3 })
      const page2 = await eventLog.query({ offset: 3, limit: 3 })
      const page3 = await eventLog.query({ offset: 6, limit: 3 })
      const page4 = await eventLog.query({ offset: 9, limit: 3 })

      expect(page1).toHaveLength(3)
      expect(page2).toHaveLength(3)
      expect(page3).toHaveLength(3)
      expect(page4).toHaveLength(1)

      // All IDs should be distinct across pages
      const allIds = [...page1, ...page2, ...page3, ...page4].map((e) => e.$id)
      expect(new Set(allIds).size).toBe(10)
    })
  })

  // ===========================================================================
  // 7. EventLog.clear resets everything (2 tests)
  // ===========================================================================
  describe('EventLog.clear resets everything', () => {
    it('clear removes all events and resets sequences', async () => {
      const eventLog = new EventLog()
      const provider = new LocalNounProvider({
        context: 'https://headless.ly/~clr',
        eventLog,
      })
      await provider.create('Contact', { name: 'Alice' })
      expect(eventLog.size).toBe(1)

      await eventLog.clear()
      expect(eventLog.size).toBe(0)

      const results = await eventLog.query({})
      expect(results).toHaveLength(0)
    })

    it('clear resets sequence numbers so new events start at sequence 1', async () => {
      const eventLog = new EventLog()
      const provider = new LocalNounProvider({
        context: 'https://headless.ly/~clrseq',
        eventLog,
      })
      const alice = await provider.create('Contact', { name: 'Alice' })
      await provider.update('Contact', alice.$id, { name: 'Alice Smith' })

      // Before clear: last event has sequence=2
      const before = await eventLog.query({})
      expect(before[before.length - 1].sequence).toBe(2)

      await eventLog.clear()

      // Create a new provider because old provider's store still has data
      const provider2 = new LocalNounProvider({
        context: 'https://headless.ly/~clrseq',
        eventLog,
      })
      await provider2.create('Contact', { name: 'Bob' })

      const after = await eventLog.query({})
      expect(after).toHaveLength(1)
      expect(after[0].sequence).toBe(1)
    })
  })

  // ===========================================================================
  // 8. CDCStream — consumer, checkpoint, acknowledge, pending, lag (5 tests)
  // ===========================================================================
  describe('CDCStream consumer operations', () => {
    let eventLog: EventLog
    let cdcStream: CDCStream
    let provider: LocalNounProvider

    beforeEach(async () => {
      clearRegistry()
      eventLog = new EventLog()
      cdcStream = new CDCStream(eventLog)
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~cdc2',
        eventLog,
      })
    })

    it('createConsumer tracks cursor across multiple polls', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Contact', { name: 'Bob' })
      await provider.create('Contact', { name: 'Charlie' })

      const consumer = cdcStream.createConsumer('test-consumer')

      const first = await consumer.poll({ batchSize: 2 })
      expect(first.events).toHaveLength(2)
      expect(first.hasMore).toBe(true)

      const second = await consumer.poll({ batchSize: 2 })
      expect(second.events).toHaveLength(1)
      expect(second.hasMore).toBe(false)
    })

    it('checkpoint persists cursor for later retrieval', async () => {
      await provider.create('Contact', { name: 'Alice' })
      const consumer = cdcStream.createConsumer('persist-consumer')
      await consumer.poll()
      await consumer.checkpoint()

      const savedCursor = await cdcStream.getCursor('persist-consumer')
      expect(savedCursor).toBeDefined()
      expect(savedCursor!.startsWith('evt_')).toBe(true)
    })

    it('acknowledge marks events as processed', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Contact', { name: 'Bob' })

      const all = await eventLog.query({})
      const ids = all.map((e) => e.$id)

      await cdcStream.acknowledge('ack-consumer', [ids[0]])
      const { events: pending } = await cdcStream.pending('ack-consumer')
      expect(pending).toHaveLength(1)
      expect(pending[0].$id).toBe(ids[1])
    })

    it('pending returns all events for consumer with no acknowledgements', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Contact', { name: 'Bob' })

      const { events: pending } = await cdcStream.pending('new-consumer')
      expect(pending).toHaveLength(2)
    })

    it('lag returns count of unconsumed events', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Contact', { name: 'Bob' })
      await provider.create('Contact', { name: 'Charlie' })

      // No cursor stored yet -- lag is all events
      const initialLag = await cdcStream.lag('lag-consumer')
      expect(initialLag).toBe(3)

      // Set cursor to first event
      const allEvents = await eventLog.query({})
      await cdcStream.checkpoint('lag-consumer', allEvents[0].$id)
      const lagAfter = await cdcStream.lag('lag-consumer')
      expect(lagAfter).toBe(2)
    })
  })

  // ===========================================================================
  // 9. TimeTraveler.snapshotAll (2 tests)
  // ===========================================================================
  describe('TimeTraveler.snapshotAll', () => {
    let eventLog: EventLog
    let provider: LocalNounProvider
    let tt: TimeTraveler

    beforeEach(() => {
      clearRegistry()
      eventLog = new EventLog()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~snapall',
        eventLog,
      })
      tt = new TimeTraveler(eventLog)
    })

    it('snapshotAll returns reconstructed state for every unique entity', async () => {
      const alice = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', alice.$id, { stage: 'Qualified' })
      await provider.create('Deal', { title: 'Big Deal', value: 5000 })

      const snapshot = await tt.snapshotAll()
      expect(snapshot).toHaveLength(2)

      const contact = snapshot.find((s) => s.$type === 'Contact')
      expect(contact).toBeDefined()
      expect(contact!.stage).toBe('Qualified')

      const deal = snapshot.find((s) => s.$type === 'Deal')
      expect(deal).toBeDefined()
      expect(deal!.title).toBe('Big Deal')
    })

    it('snapshotAll returns empty array for empty event log', async () => {
      const snapshot = await tt.snapshotAll()
      expect(snapshot).toEqual([])
    })
  })

  // ===========================================================================
  // 10. TimeTraveler with timestamp-based asOf queries (2 tests)
  // ===========================================================================
  describe('TimeTraveler timestamp-based asOf queries', () => {
    let eventLog: EventLog
    let provider: LocalNounProvider
    let tt: TimeTraveler

    beforeEach(() => {
      clearRegistry()
      eventLog = new EventLog()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~asof',
        eventLog,
      })
      tt = new TimeTraveler(eventLog)
    })

    it('asOf with far-future timestamp returns latest state', async () => {
      const c = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', c.$id, { stage: 'Qualified' })

      const state = await tt.asOf('Contact', c.$id, { asOf: '2099-12-31T23:59:59Z' })
      expect(state).not.toBeNull()
      expect(state!.stage).toBe('Qualified')
    })

    it('asOf with very early timestamp returns null (no events existed yet)', async () => {
      const c = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const state = await tt.asOf('Contact', c.$id, { asOf: '1970-01-01T00:00:00Z' })
      expect(state).toBeNull()
    })
  })

  // ===========================================================================
  // 11. DONounProvider transport and context defaults (3 tests)
  // ===========================================================================
  describe('DONounProvider transport and context defaults', () => {
    it('default context is https://headless.ly when not specified with doFetch', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~acme',
        doFetch: mockFetch,
      })

      await provider.find('Contact')

      const [, init] = mockFetch.mock.calls[0]
      expect(init.headers['X-Context']).toBe('https://headless.ly')
    })

    it('find with empty where object does not add query string', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~acme',
        doFetch: mockFetch,
      })

      await provider.find('Contact', {})

      const [path] = mockFetch.mock.calls[0]
      expect(path).toBe('/contacts')
    })

    it('endpoint property is accessible for all DONounProvider instances', () => {
      const p1 = new DONounProvider({ endpoint: 'https://db.headless.ly/~one' })
      const p2 = new DONounProvider({ endpoint: 'https://db.headless.ly/~two', transport: 'ws' })
      expect(p1.endpoint).toBe('https://db.headless.ly/~one')
      expect(p2.endpoint).toBe('https://db.headless.ly/~two')
    })
  })

  // ===========================================================================
  // 12. DONounProvider complex multi-operator filters (2 tests)
  // ===========================================================================
  describe('DONounProvider complex multi-operator filters', () => {
    it('multiple operators on different fields are all serialized', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~acme',
        doFetch: mockFetch,
      })

      await provider.find('Deal', {
        value: { $gte: 1000, $lte: 50000 },
        stage: 'Open',
      })

      const [path] = mockFetch.mock.calls[0]
      expect(path).toContain('value%5B%24gte%5D=1000')
      expect(path).toContain('value%5B%24lte%5D=50000')
      expect(path).toContain('stage=Open')
    })

    it('multiple filter fields with mixed operator/direct values serialize correctly', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~acme',
        doFetch: mockFetch,
      })

      await provider.find('Contact', {
        stage: { $in: ['Lead', 'Qualified'] },
        name: 'Alice',
        score: { $gt: 50 },
      })

      const [path] = mockFetch.mock.calls[0]
      expect(path).toContain('stage%5B%24in%5D=Lead%2CQualified')
      expect(path).toContain('name=Alice')
      expect(path).toContain('score%5B%24gt%5D=50')
    })
  })

  // ===========================================================================
  // 13. Schema registry with many nouns (3 tests)
  // ===========================================================================
  describe('Schema registry with many nouns', () => {
    beforeEach(() => {
      clearRegistry()
    })

    it('registering all 35 core entities populates getAllNouns correctly', () => {
      const entityNames = [
        'User',
        'ApiKey',
        'Organization',
        'Contact',
        'Lead',
        'Deal',
        'Activity',
        'Pipeline',
        'Customer',
        'Product',
        'Plan',
        'Price',
        'Subscription',
        'Invoice',
        'Payment',
        'Project',
        'Issue',
        'Comment',
        'Content',
        'Asset',
        'Site',
        'Ticket',
        'Event',
        'Metric',
        'Funnel',
        'Goal',
        'Campaign',
        'Segment',
        'Form',
        'Experiment',
        'FeatureFlag',
        'Workflow',
        'Integration',
        'Agent',
        'Message',
      ]

      for (const name of entityNames) {
        Noun(name, { name: 'string!' })
      }

      const allNouns = getAllNouns()
      expect(allNouns.size).toBe(35)

      for (const name of entityNames) {
        expect(allNouns.has(name)).toBe(true)
      }
    })

    it('getNounSchema retrieves correct schema for each registered noun', () => {
      Noun('Contact', { name: 'string!', email: 'string?#', stage: 'Lead | Qualified | Customer' })
      Noun('Deal', { title: 'string!', value: 'number', close: 'Won' })

      const contactSchema = getNounSchema('Contact')
      expect(contactSchema).toBeDefined()
      expect(contactSchema!.name).toBe('Contact')
      expect(contactSchema!.fields.has('name')).toBe(true)
      expect(contactSchema!.fields.has('email')).toBe(true)

      const dealSchema = getNounSchema('Deal')
      expect(dealSchema).toBeDefined()
      expect(dealSchema!.verbs.has('close')).toBe(true)
    })

    it('schema correctly tracks multiple custom verbs and disabled verbs on same noun', () => {
      Noun('Order', {
        status: 'string!',
        ship: 'Shipped',
        cancel: 'Cancelled',
        refund: 'Refunded',
        delete: null,
        update: null,
      })

      const schema = getNounSchema('Order')
      expect(schema).toBeDefined()
      expect(schema!.verbs.has('ship')).toBe(true)
      expect(schema!.verbs.has('cancel')).toBe(true)
      expect(schema!.verbs.has('refund')).toBe(true)
      expect(schema!.disabledVerbs.has('delete')).toBe(true)
      expect(schema!.disabledVerbs.has('update')).toBe(true)
    })
  })

  // ===========================================================================
  // 14. LocalNounProvider perform meta-field protection (2 tests)
  // ===========================================================================
  describe('LocalNounProvider perform protects meta-fields', () => {
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({ context: 'https://headless.ly/~protperf' })
    })

    it('perform preserves $id, $type, $context even if data tries to override them', async () => {
      const created = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const result = await provider.perform('Contact', 'qualify', created.$id, {
        stage: 'Qualified',
        $id: 'contact_EVIL',
        $type: 'EvilType',
        $context: 'https://evil.ly',
      })
      expect(result.$id).toBe(created.$id)
      expect(result.$type).toBe('Contact')
      expect(result.$context).toBe('https://headless.ly/~protperf')
    })

    it('perform preserves $createdAt and correctly updates $updatedAt', async () => {
      const created = await provider.create('Contact', { name: 'Alice' })
      const originalCreatedAt = created.$createdAt

      await new Promise((r) => setTimeout(r, 5))

      const result = await provider.perform('Contact', 'touch', created.$id, { touched: true })
      expect(result.$createdAt).toBe(originalCreatedAt)
      expect(result.$updatedAt >= created.$updatedAt).toBe(true)
    })
  })

  // ===========================================================================
  // 15. SubscriptionManager attached to EventLog (3 tests)
  // ===========================================================================
  describe('SubscriptionManager attached to EventLog via provider', () => {
    let eventLog: EventLog
    let subMgr: SubscriptionManager
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      eventLog = new EventLog()
      subMgr = new SubscriptionManager()
      subMgr.attach(eventLog)
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~submgr',
        eventLog,
      })
    })

    it('code subscription fires when provider creates an entity', async () => {
      const received: unknown[] = []
      subMgr.registerCode('Contact.*', (e) => {
        received.push(e)
      })

      await provider.create('Contact', { name: 'Alice' })
      // Give async dispatch a tick
      await new Promise((r) => setTimeout(r, 10))

      expect(received).toHaveLength(1)
    })

    it('deactivated subscription does not fire', async () => {
      const received: unknown[] = []
      const subId = subMgr.registerCode('*', (e) => {
        received.push(e)
      })
      subMgr.deactivate(subId)

      await provider.create('Contact', { name: 'Alice' })
      await new Promise((r) => setTimeout(r, 10))

      expect(received).toHaveLength(0)
    })

    it('reactivated subscription fires again', async () => {
      const received: unknown[] = []
      const subId = subMgr.registerCode('*', (e) => {
        received.push(e)
      })
      subMgr.deactivate(subId)

      await provider.create('Contact', { name: 'Alice' })
      await new Promise((r) => setTimeout(r, 10))
      expect(received).toHaveLength(0)

      subMgr.activate(subId)
      await provider.create('Contact', { name: 'Bob' })
      await new Promise((r) => setTimeout(r, 10))

      expect(received).toHaveLength(1)
    })
  })

  // ===========================================================================
  // 16. Concurrent executeVerb calls at scale (2 tests)
  // ===========================================================================
  describe('Concurrent executeVerb calls at scale', () => {
    let provider: LocalNounProvider
    let bridge: EventEmitter

    beforeEach(() => {
      clearRegistry()
      bridge = createEventBridge()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~concverb',
      })
    })

    it('concurrent verb executions on different entities all succeed', async () => {
      Noun('Contact', {
        name: 'string!',
        stage: 'Lead | Qualified',
        qualify: 'Qualified',
      })

      const entities = await Promise.all(Array.from({ length: 20 }, (_, i) => provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })))

      const results = await Promise.all(
        entities.map((e) => executeVerb({ type: 'Contact', verb: 'qualify', entityId: e.$id, data: { stage: 'Qualified' } }, { provider, events: bridge })),
      )

      expect(results).toHaveLength(20)
      for (const r of results) {
        expect(r.stage).toBe('Qualified')
      }
    })

    it('all events from concurrent verb executions are captured by the bridge', async () => {
      Noun('Deal', {
        title: 'string!',
        stage: 'Open | Won',
        close: 'Won',
      })

      const deals = await Promise.all(Array.from({ length: 10 }, (_, i) => provider.create('Deal', { title: `Deal ${i}`, stage: 'Open' })))

      const allEvents: NounEvent[] = []
      bridge.subscribe('*', (e) => allEvents.push(e))

      await Promise.all(deals.map((d) => executeVerb({ type: 'Deal', verb: 'close', entityId: d.$id, data: { stage: 'Won' } }, { provider, events: bridge })))

      // Each verb execution emits 3 events (activity, verb, event)
      expect(allEvents).toHaveLength(30)
    })
  })

  // ===========================================================================
  // 17. Event bridge query with combined since + entityType + verb (2 tests)
  // ===========================================================================
  describe('Event bridge query with combined filters', () => {
    let bridge: EventEmitter

    beforeEach(async () => {
      bridge = createEventBridge()
      await bridge.emit({
        $id: 'evt_1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_1',
        verb: 'created',
        timestamp: '2025-01-01T00:00:00Z',
      })
      await bridge.emit({
        $id: 'evt_2',
        $type: 'Deal.created',
        entityType: 'Deal',
        entityId: 'deal_1',
        verb: 'created',
        timestamp: '2025-01-15T00:00:00Z',
      })
      await bridge.emit({
        $id: 'evt_3',
        $type: 'Contact.updated',
        entityType: 'Contact',
        entityId: 'contact_1',
        verb: 'updated',
        timestamp: '2025-02-01T00:00:00Z',
      })
      await bridge.emit({
        $id: 'evt_4',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_2',
        verb: 'created',
        timestamp: '2025-03-01T00:00:00Z',
      })
    })

    it('query with since + entityType + verb returns only matching events', async () => {
      const results = await bridge.query({
        entityType: 'Contact',
        verb: 'created',
        since: '2025-02-01T00:00:00Z',
      })
      expect(results).toHaveLength(1)
      expect(results[0].$id).toBe('evt_4')
    })

    it('query with since + entityId returns events for that entity since timestamp', async () => {
      const results = await bridge.query({
        entityId: 'contact_1',
        since: '2025-01-15T00:00:00Z',
      })
      expect(results).toHaveLength(1)
      expect(results[0].$id).toBe('evt_3')
    })
  })

  // ===========================================================================
  // 18. DONounProvider pluralization edge cases (3 tests)
  // ===========================================================================
  describe('DONounProvider pluralization edge cases', () => {
    it('Pipeline maps to /pipelines (simple s)', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })
      await provider.find('Pipeline')
      expect(mockFetch.mock.calls[0][0]).toBe('/pipelines')
    })

    it('Process maps to /processes (s ending -> ses)', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })
      await provider.find('Process')
      expect(mockFetch.mock.calls[0][0]).toBe('/processes')
    })

    it('Survey maps to /surveys (vowel+y -> just s)', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })
      await provider.find('Survey')
      expect(mockFetch.mock.calls[0][0]).toBe('/surveys')
    })
  })
})
