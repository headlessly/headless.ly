import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearRegistry, Noun, getNounSchema, getAllNouns } from 'digital-objects'
import type { NounProvider, NounInstance } from 'digital-objects'
import { LocalNounProvider } from '../src/local-provider'
import { DONounProvider, DOProviderError } from '../src/do-provider'
import { createEventBridge } from '../src/event-bridge'
import { executeVerb } from '../src/verb-executor'
import { generateSqid, generateEntityId, generateEventId } from '../src/id'
import type { EventEmitter, NounEvent } from '../src/event-bridge'
import { EventLog, TimeTraveler } from '@headlessly/events'

// =============================================================================
// Helper: mock doFetch that returns well-formed responses
// =============================================================================
function mockJsonResponse(data: unknown, status = 200, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ data }),
  })
}

function createMockDoFetch(responses: Array<{ ok: boolean; status: number; data: unknown }>) {
  let callIndex = 0
  return vi.fn().mockImplementation(async () => {
    const resp = responses[callIndex] ?? responses[responses.length - 1]
    callIndex++
    return {
      ok: resp.ok,
      status: resp.status,
      json: async () => ({ data: resp.data }),
    }
  })
}

describe('@headlessly/objects -- deep-v3 provider tests', () => {
  // ===========================================================================
  // 1. Provider Switching and Fallback Chains (5 tests)
  // ===========================================================================
  describe('Provider switching and fallback chains', () => {
    beforeEach(() => {
      clearRegistry()
    })

    it('entities created in one provider are invisible to a second provider', async () => {
      const providerA = new LocalNounProvider({ context: 'https://headless.ly/~shared' })
      const providerB = new LocalNounProvider({ context: 'https://headless.ly/~shared' })

      const entityA = await providerA.create('Contact', { name: 'Alice' })

      // providerB has its own in-process store, so entity from A is invisible
      const result = await providerB.get('Contact', entityA.$id)
      expect(result).toBeNull()
    })

    it('switching providers mid-workflow allows fallback to a secondary provider', async () => {
      const primary = new LocalNounProvider({ context: 'https://headless.ly/~fallback' })
      const secondary = new LocalNounProvider({ context: 'https://headless.ly/~fallback' })

      // Create in secondary as a fallback store
      const backup = await secondary.create('Contact', { name: 'Backup Alice' })

      // Primary has no data -- simulate fallback
      const fromPrimary = await primary.get('Contact', backup.$id)
      if (!fromPrimary) {
        const fromSecondary = await secondary.get('Contact', backup.$id)
        expect(fromSecondary).not.toBeNull()
        expect(fromSecondary!.name).toBe('Backup Alice')
      }
    })

    it('migrating entities between providers preserves all meta-fields', async () => {
      const source = new LocalNounProvider({ context: 'https://headless.ly/~source' })
      const target = new LocalNounProvider({ context: 'https://headless.ly/~source' })

      const original = await source.create('Contact', { name: 'Alice', stage: 'Lead' })
      await source.update('Contact', original.$id, { stage: 'Qualified' })
      const migrated = await source.get('Contact', original.$id)

      // Recreate in target provider
      const copy = await target.create('Contact', {
        name: migrated!.name,
        stage: migrated!.stage,
      })

      expect(copy.name).toBe('Alice')
      expect(copy.stage).toBe('Qualified')
      expect(copy.$version).toBe(1) // new provider resets version
      expect(copy.$type).toBe('Contact')
    })

    it('DONounProvider and LocalNounProvider can be used interchangeably through NounProvider interface', async () => {
      const local: NounProvider = new LocalNounProvider({ context: 'https://headless.ly/~interop' })
      const remote: NounProvider = new DONounProvider({ endpoint: 'https://db.headless.ly/~interop' })

      // Both satisfy the same interface
      expect(typeof local.create).toBe('function')
      expect(typeof local.get).toBe('function')
      expect(typeof local.find).toBe('function')
      expect(typeof local.update).toBe('function')
      expect(typeof local.delete).toBe('function')
      expect(typeof local.perform).toBe('function')

      expect(typeof remote.create).toBe('function')
      expect(typeof remote.get).toBe('function')
      expect(typeof remote.find).toBe('function')
      expect(typeof remote.update).toBe('function')
      expect(typeof remote.delete).toBe('function')
      expect(typeof remote.perform).toBe('function')
    })

    it('provider chain: try primary then fallback to secondary on not-found', async () => {
      const primary = new LocalNounProvider({ context: 'https://headless.ly/~chain' })
      const fallback = new LocalNounProvider({ context: 'https://headless.ly/~chain' })

      // Seed fallback with data
      await fallback.create('Deal', { title: 'Legacy Deal', value: 5000 })
      await primary.create('Deal', { title: 'New Deal', value: 10000 })

      // Compose a fallback lookup function
      async function findWithFallback(type: string, where?: Record<string, unknown>) {
        const results = await primary.find(type, where)
        if (results.length > 0) return results
        return fallback.find(type, where)
      }

      const newDeals = await findWithFallback('Deal', { title: 'New Deal' })
      expect(newDeals).toHaveLength(1)
      expect(newDeals[0].value).toBe(10000)

      const legacyDeals = await findWithFallback('Deal', { title: 'Legacy Deal' })
      expect(legacyDeals).toHaveLength(1)
      expect(legacyDeals[0].value).toBe(5000)
    })
  })

  // ===========================================================================
  // 2. Event Replay and Time Travel through Providers (8 tests)
  // ===========================================================================
  describe('Event replay and time travel through providers', () => {
    let provider: LocalNounProvider
    let eventLog: EventLog
    let timeTraveler: TimeTraveler

    beforeEach(() => {
      clearRegistry()
      eventLog = new EventLog()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~timetravel',
        eventLog,
      })
      timeTraveler = new TimeTraveler(eventLog)
    })

    it('TimeTraveler reconstructs state at version 1 from event log', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })
      await provider.update('Contact', contact.$id, { stage: 'Customer' })

      // Reconstruct at version 1 (the create event)
      const stateV1 = await timeTraveler.asOf('Contact', contact.$id, { atVersion: 1 })
      expect(stateV1).not.toBeNull()
      expect(stateV1!.$version).toBe(1)
      expect(stateV1!.stage).toBe('Lead')
    })

    it('TimeTraveler reconstructs state at version 2 after update', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })
      await provider.update('Contact', contact.$id, { stage: 'Customer' })

      const stateV2 = await timeTraveler.asOf('Contact', contact.$id, { atVersion: 2 })
      expect(stateV2).not.toBeNull()
      expect(stateV2!.stage).toBe('Qualified')
    })

    it('TimeTraveler diff shows field-level changes between versions', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified', score: 85 })

      const diff = await timeTraveler.diff(
        'Contact',
        contact.$id,
        { atVersion: 1 },
        { atVersion: 2 },
      )

      expect(diff.before).not.toBeNull()
      expect(diff.after).not.toBeNull()
      expect(diff.events.length).toBeGreaterThan(0)
      expect(diff.changes.some((c) => c.field === 'stage')).toBe(true)
    })

    it('TimeTraveler rollback creates a new event without deleting history', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })
      await provider.update('Contact', contact.$id, { stage: 'Customer' })

      const eventCountBefore = eventLog.size

      // Rollback to version 1
      const result = await timeTraveler.rollback('Contact', contact.$id, { atVersion: 1 })
      expect(result.restoredState.stage).toBe('Lead')
      expect(result.rollbackEvent.$type).toBe('Contact.rolledBack')

      // Event log grew (immutability preserved)
      expect(eventLog.size).toBe(eventCountBefore + 1)
    })

    it('TimeTraveler timeline returns all intermediate states', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })
      await provider.update('Contact', contact.$id, { stage: 'Customer' })

      const timeline = await timeTraveler.timeline('Contact', contact.$id)
      expect(timeline).toHaveLength(3) // create + 2 updates
      expect(timeline[0].state.stage).toBe('Lead')
      expect(timeline[1].state.stage).toBe('Qualified')
      expect(timeline[2].state.stage).toBe('Customer')
    })

    it('event log getEntityHistory returns all events for a specific entity', async () => {
      const alice = await provider.create('Contact', { name: 'Alice' })
      const bob = await provider.create('Contact', { name: 'Bob' })
      await provider.update('Contact', alice.$id, { name: 'Alice Smith' })

      const aliceHistory = await eventLog.getEntityHistory('Contact', alice.$id)
      const bobHistory = await eventLog.getEntityHistory('Contact', bob.$id)

      expect(aliceHistory).toHaveLength(2) // create + update
      expect(bobHistory).toHaveLength(1) // create only
    })

    it('TimeTraveler causedBy finds the event that set a field to a specific value', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })
      await provider.update('Contact', contact.$id, { stage: 'Customer' })

      const causingEvent = await timeTraveler.causedBy('Contact', contact.$id, 'stage', 'Qualified')
      expect(causingEvent).toBeDefined()
      expect(causingEvent!.verb).toBe('update')
    })

    it('TimeTraveler projection returns only requested fields', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead', email: 'alice@test.com' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })

      const projected = await timeTraveler.projection('Contact', contact.$id, ['name', 'stage'])
      expect(projected.name).toBe('Alice')
      expect(projected.stage).toBe('Qualified')
      expect(projected.email).toBeUndefined()
    })
  })

  // ===========================================================================
  // 3. Schema Registry Advanced Operations (5 tests)
  // ===========================================================================
  describe('Schema registry advanced operations', () => {
    beforeEach(() => {
      clearRegistry()
    })

    it('getAllNouns returns all registered nouns', () => {
      Noun('Contact', { name: 'string!', stage: 'Lead | Qualified' })
      Noun('Deal', { title: 'string!', value: 'number' })

      const allNouns = getAllNouns()
      expect(allNouns.size).toBe(2)
      expect(allNouns.has('Contact')).toBe(true)
      expect(allNouns.has('Deal')).toBe(true)
    })

    it('getNounSchema returns undefined for unregistered nouns', () => {
      const schema = getNounSchema('NonExistent')
      expect(schema).toBeUndefined()
    })

    it('clearRegistry removes all registered nouns', () => {
      Noun('Contact', { name: 'string!' })
      Noun('Deal', { title: 'string!' })
      expect(getAllNouns().size).toBe(2)

      clearRegistry()
      expect(getAllNouns().size).toBe(0)
    })

    it('schema includes fields, verbs, and disabled verbs', () => {
      Noun('Ledger', {
        amount: 'string!',
        description: 'string?',
        update: null,
        approve: 'Approved',
      })

      const schema = getNounSchema('Ledger')
      expect(schema).toBeDefined()
      expect(schema!.name).toBe('Ledger')
      expect(schema!.disabledVerbs.has('update')).toBe(true)
      expect(schema!.verbs.has('approve')).toBe(true)
    })

    it('re-registering a noun with the same name overwrites the previous schema', () => {
      Noun('Contact', { name: 'string!' })
      const firstSchema = getNounSchema('Contact')
      expect(firstSchema!.fields.has('name')).toBe(true)

      Noun('Contact', { name: 'string!', email: 'string?' })
      const secondSchema = getNounSchema('Contact')
      expect(secondSchema!.fields.has('email')).toBe(true)
    })
  })

  // ===========================================================================
  // 4. Concurrent Provider Access (5 tests)
  // ===========================================================================
  describe('Concurrent provider access', () => {
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({ context: 'https://headless.ly/~concurrent' })
    })

    it('concurrent creates produce unique IDs for all entities', async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        provider.create('Contact', { name: `Contact ${i}` }),
      )

      const results = await Promise.all(promises)
      const ids = results.map((r) => r.$id)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(50)
    })

    it('concurrent reads after a write all return the correct entity', async () => {
      const entity = await provider.create('Contact', { name: 'Shared Alice' })

      const promises = Array.from({ length: 20 }, () =>
        provider.get('Contact', entity.$id),
      )

      const results = await Promise.all(promises)
      for (const result of results) {
        expect(result).not.toBeNull()
        expect(result!.name).toBe('Shared Alice')
      }
    })

    it('concurrent finds across different types do not interfere', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Contact', { name: 'Bob' })
      await provider.create('Deal', { title: 'Deal 1', value: 100 })
      await provider.create('Deal', { title: 'Deal 2', value: 200 })
      await provider.create('Deal', { title: 'Deal 3', value: 300 })

      const [contacts, deals] = await Promise.all([
        provider.find('Contact'),
        provider.find('Deal'),
      ])

      expect(contacts).toHaveLength(2)
      expect(deals).toHaveLength(3)
    })

    it('concurrent creates and reads do not cause data corruption', async () => {
      // Mix creates and reads
      const createPromises = Array.from({ length: 10 }, (_, i) =>
        provider.create('Contact', { name: `Contact ${i}`, index: i }),
      )

      const created = await Promise.all(createPromises)

      // Now read all of them concurrently
      const readPromises = created.map((c) => provider.get('Contact', c.$id))
      const fetched = await Promise.all(readPromises)

      for (let i = 0; i < created.length; i++) {
        expect(fetched[i]).not.toBeNull()
        expect(fetched[i]!.$id).toBe(created[i].$id)
        expect(fetched[i]!.name).toBe(`Contact ${i}`)
      }
    })

    it('concurrent event emissions do not lose events', async () => {
      const bridge = createEventBridge()
      const received: NounEvent[] = []
      bridge.subscribe('*', (e) => { received.push(e) })

      const events: NounEvent[] = Array.from({ length: 30 }, (_, i) => ({
        $id: `evt_conc_${i}`,
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: `contact_c${i}`,
        verb: 'created',
        timestamp: new Date().toISOString(),
      }))

      await Promise.all(events.map((e) => bridge.emit(e)))

      expect(received).toHaveLength(30)
    })
  })

  // ===========================================================================
  // 5. Provider Error Recovery (5 tests)
  // ===========================================================================
  describe('Provider error recovery', () => {
    beforeEach(() => {
      clearRegistry()
    })

    it('update failure does not corrupt existing entity state', async () => {
      const provider = new LocalNounProvider({ context: 'https://headless.ly/~errrecovery' })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      // Attempt update on wrong type -- should fail
      try {
        await provider.update('Deal', contact.$id, { stage: 'Won' })
      } catch {
        // Expected error
      }

      // Original entity still intact
      const intact = await provider.get('Contact', contact.$id)
      expect(intact).not.toBeNull()
      expect(intact!.name).toBe('Alice')
      expect(intact!.stage).toBe('Lead')
      expect(intact!.$version).toBe(1)
    })

    it('DONounProvider create error does not leave partial state', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal Server Error' }),
      })

      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~err',
        doFetch: mockFetch,
      })

      await expect(provider.create('Contact', { name: 'Alice' })).rejects.toThrow(DOProviderError)

      // Subsequent operations should still work (no corrupted state)
      const mockFetch2 = mockJsonResponse([])
      const provider2 = new DONounProvider({
        endpoint: 'https://db.headless.ly/~err',
        doFetch: mockFetch2,
      })
      const results = await provider2.find('Contact')
      expect(Array.isArray(results)).toBe(true)
    })

    it('DONounProvider update error throws DOProviderError with correct status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Conflict' }),
      })

      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~err',
        doFetch: mockFetch,
      })

      await expect(
        provider.update('Contact', 'contact_abc', { name: 'Updated' }),
      ).rejects.toThrow(DOProviderError)

      try {
        await provider.update('Contact', 'contact_abc', { name: 'Updated' })
      } catch (err) {
        expect((err as DOProviderError).status).toBe(409)
      }
    })

    it('sequential error and success calls work independently', async () => {
      let callCount = 0
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return { ok: false, status: 503, json: async () => ({ error: 'unavailable' }) }
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [{ $id: 'contact_abc', $type: 'Contact', name: 'Alice' }],
          }),
        }
      })

      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~retry',
        doFetch: mockFetch,
      })

      // First call fails
      await expect(provider.find('Contact')).rejects.toThrow(DOProviderError)

      // Second call succeeds
      const results = await provider.find('Contact')
      expect(results).toHaveLength(1)
    })

    it('perform on non-existent entity throws and provider remains usable', async () => {
      const provider = new LocalNounProvider({ context: 'https://headless.ly/~errperf' })

      await expect(
        provider.perform('Contact', 'qualify', 'contact_ghost'),
      ).rejects.toThrow('Contact not found: contact_ghost')

      // Provider still works after the error
      const contact = await provider.create('Contact', { name: 'Recovery' })
      expect(contact.name).toBe('Recovery')
    })
  })

  // ===========================================================================
  // 6. Bulk Entity Operations through Providers (5 tests)
  // ===========================================================================
  describe('Bulk entity operations through providers', () => {
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({ context: 'https://headless.ly/~bulk' })
    })

    it('bulk create 100 entities and verify count', async () => {
      for (let i = 0; i < 100; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, index: i })
      }

      const count = await provider.count('Contact')
      expect(count).toBe(100)
    })

    it('bulk create and find with filter returns correct subset', async () => {
      for (let i = 0; i < 50; i++) {
        await provider.create('Contact', {
          name: `Contact ${i}`,
          stage: i % 2 === 0 ? 'Lead' : 'Qualified',
        })
      }

      const leads = await provider.find('Contact', { stage: 'Lead' })
      const qualified = await provider.find('Contact', { stage: 'Qualified' })

      expect(leads).toHaveLength(25)
      expect(qualified).toHaveLength(25)
    })

    it('bulk delete removes all targeted entities', async () => {
      const entities: NounInstance[] = []
      for (let i = 0; i < 20; i++) {
        entities.push(await provider.create('Contact', { name: `Contact ${i}` }))
      }

      // Delete the first 10
      for (let i = 0; i < 10; i++) {
        await provider.delete('Contact', entities[i].$id)
      }

      const remaining = await provider.find('Contact')
      expect(remaining).toHaveLength(10)
    })

    it('bulk update increments versions correctly for all entities', async () => {
      const entities: NounInstance[] = []
      for (let i = 0; i < 10; i++) {
        entities.push(await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' }))
      }

      // Update all to Qualified
      for (const entity of entities) {
        await provider.update('Contact', entity.$id, { stage: 'Qualified' })
      }

      // All should be at version 2
      for (const entity of entities) {
        const updated = await provider.get('Contact', entity.$id)
        expect(updated!.$version).toBe(2)
        expect(updated!.stage).toBe('Qualified')
      }
    })

    it('mixed type bulk operations maintain correct separation', async () => {
      for (let i = 0; i < 15; i++) {
        await provider.create('Contact', { name: `Contact ${i}` })
      }
      for (let i = 0; i < 10; i++) {
        await provider.create('Deal', { title: `Deal ${i}`, value: i * 1000 })
      }
      for (let i = 0; i < 5; i++) {
        await provider.create('Project', { name: `Project ${i}` })
      }

      expect(await provider.count('Contact')).toBe(15)
      expect(await provider.count('Deal')).toBe(10)
      expect(await provider.count('Project')).toBe(5)
      expect(provider.size).toBe(30)
    })
  })

  // ===========================================================================
  // 7. Custom Verb Execution through Provider Layer (5 tests)
  // ===========================================================================
  describe('Custom verb execution through provider layer', () => {
    let provider: LocalNounProvider
    let bridge: EventEmitter

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~verbs',
        events: createEventBridge(),
      })
      bridge = createEventBridge()
    })

    it('chained custom verbs produce correct event sequence', async () => {
      Noun('Deal', {
        title: 'string!',
        stage: 'Prospect | Qualified | Negotiation | Won | Lost',
        qualify: 'Qualified',
        negotiate: 'Negotiation',
        close: 'Won',
      })

      const deal = await provider.create('Deal', { title: 'Big Deal', stage: 'Prospect' })
      const allEvents: NounEvent[] = []
      bridge.subscribe('*', (e) => allEvents.push(e))

      await executeVerb(
        { type: 'Deal', verb: 'qualify', entityId: deal.$id, data: { stage: 'Qualified' } },
        { provider, events: bridge },
      )
      await executeVerb(
        { type: 'Deal', verb: 'negotiate', entityId: deal.$id, data: { stage: 'Negotiation' } },
        { provider, events: bridge },
      )
      await executeVerb(
        { type: 'Deal', verb: 'close', entityId: deal.$id, data: { stage: 'Won' } },
        { provider, events: bridge },
      )

      // Each verb produces 3 events: activity, verb, event (9 total)
      expect(allEvents).toHaveLength(9)

      // Verify final state in provider
      const final = await provider.get('Deal', deal.$id)
      expect(final!.stage).toBe('Won')
      expect(final!.$version).toBe(4) // 1 create + 3 performs
    })

    it('verb execution with EventLog records full conjugation chain', async () => {
      const eventLog = new EventLog()
      const providerWithLog = new LocalNounProvider({
        context: 'https://headless.ly/~verblog',
        eventLog,
      })

      Noun('Contact', {
        name: 'string!',
        stage: 'Lead | Qualified | Customer',
        qualify: 'Qualified',
      })

      const contact = await providerWithLog.create('Contact', { name: 'Alice', stage: 'Lead' })
      await providerWithLog.perform('Contact', 'qualify', contact.$id, { stage: 'Qualified' })

      const events = await eventLog.query({ entityId: contact.$id })
      expect(events).toHaveLength(2) // create + qualify

      const qualifyEvent = events.find((e) => e.verb === 'qualify')
      expect(qualifyEvent).toBeDefined()
      expect(qualifyEvent!.conjugation.action).toBe('qualify')
      expect(qualifyEvent!.conjugation.activity).toBe('qualifying')
      expect(qualifyEvent!.conjugation.event).toBe('qualified')
    })

    it('verb ending in consonant gets correct doubling (ship -> shipping -> shipped)', async () => {
      Noun('Order', {
        status: 'string!',
        ship: 'Shipped',
      })

      const order = await provider.create('Order', { status: 'Pending' })
      const events: NounEvent[] = []
      bridge.subscribe('*', (e) => events.push(e))

      await executeVerb(
        { type: 'Order', verb: 'ship', entityId: order.$id, data: { status: 'Shipped' } },
        { provider, events: bridge },
      )

      const types = events.map((e) => e.$type)
      // Canonical conjugation doubles the final consonant: ship -> shipping / shipped
      expect(types).toContain('Order.shipping')
      expect(types).toContain('Order.ship')
      expect(types).toContain('Order.shipped')
    })

    it('CRUD verb "create" has known conjugation: creating -> create -> created', async () => {
      Noun('Contact', { name: 'string!' })

      const contact = await provider.create('Contact', { name: 'Alice' })
      const events: NounEvent[] = []
      bridge.subscribe('*', (e) => events.push(e))

      await executeVerb(
        { type: 'Contact', verb: 'create', entityId: contact.$id, data: { name: 'Bob' } },
        { provider, events: bridge },
      )

      const types = events.map((e) => e.$type)
      expect(types).toContain('Contact.creating')
      expect(types).toContain('Contact.create')
      expect(types).toContain('Contact.created')
    })

    it('CRUD verb "delete" has known conjugation: deleting -> delete -> deleted', async () => {
      Noun('Contact', { name: 'string!' })

      const contact = await provider.create('Contact', { name: 'Alice' })
      const events: NounEvent[] = []
      bridge.subscribe('*', (e) => events.push(e))

      await executeVerb(
        { type: 'Contact', verb: 'delete', entityId: contact.$id },
        { provider, events: bridge },
      )

      const types = events.map((e) => e.$type)
      expect(types).toContain('Contact.deleting')
      expect(types).toContain('Contact.delete')
      expect(types).toContain('Contact.deleted')
    })
  })

  // ===========================================================================
  // 8. Provider Lifecycle (connect, disconnect, reconnect) (4 tests)
  // ===========================================================================
  describe('Provider lifecycle (connect, disconnect, reconnect)', () => {
    beforeEach(() => {
      clearRegistry()
    })

    it('clear resets the provider but allows immediate reuse', async () => {
      const provider = new LocalNounProvider({ context: 'https://headless.ly/~lifecycle' })

      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Contact', { name: 'Bob' })
      expect(provider.size).toBe(2)

      provider.clear()
      expect(provider.size).toBe(0)

      // Provider is immediately reusable
      const charlie = await provider.create('Contact', { name: 'Charlie' })
      expect(charlie.name).toBe('Charlie')
      expect(provider.size).toBe(1)
    })

    it('DONounProvider stores endpoint as a public readonly property', () => {
      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~lifecycle' })
      expect(provider.endpoint).toBe('https://db.headless.ly/~lifecycle')
    })

    it('creating a new DONounProvider with different endpoints gives independent connections', () => {
      const p1 = new DONounProvider({ endpoint: 'https://db.headless.ly/~tenant1' })
      const p2 = new DONounProvider({ endpoint: 'https://db.headless.ly/~tenant2' })

      expect(p1.endpoint).toBe('https://db.headless.ly/~tenant1')
      expect(p2.endpoint).toBe('https://db.headless.ly/~tenant2')
      expect(p1).not.toBe(p2)
    })

    it('provider clear followed by event bridge clear gives a clean slate', async () => {
      const bridge = createEventBridge()
      const provider = new LocalNounProvider({
        context: 'https://headless.ly/~cleanslate',
        events: bridge,
      })

      await provider.create('Contact', { name: 'Alice' })
      const eventsBefore = await bridge.query({})
      expect(eventsBefore.length).toBeGreaterThan(0)

      provider.clear()
      bridge.clear()

      expect(provider.size).toBe(0)
      const eventsAfter = await bridge.query({})
      expect(eventsAfter).toHaveLength(0)
    })
  })

  // ===========================================================================
  // 9. EventLog CDC Stream Integration (4 tests)
  // ===========================================================================
  describe('EventLog CDC stream integration', () => {
    let provider: LocalNounProvider
    let eventLog: EventLog

    beforeEach(() => {
      clearRegistry()
      eventLog = new EventLog()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~cdc',
        eventLog,
      })
    })

    it('CDC stream returns events after a cursor', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Contact', { name: 'Bob' })

      const allEvents = await eventLog.query({})
      const cursor = allEvents[0].$id

      const cdc = await eventLog.cdc({ after: cursor })
      expect(cdc.events).toHaveLength(1) // only the second event
      expect(cdc.events[0].entityType).toBe('Contact')
    })

    it('CDC stream with type filter returns only matching events', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Deal', { title: 'Big Deal', value: 1000 })
      await provider.create('Contact', { name: 'Bob' })

      const cdc = await eventLog.cdc({ types: ['Deal'] })
      expect(cdc.events).toHaveLength(1)
      expect(cdc.events[0].entityType).toBe('Deal')
    })

    it('CDC stream with verb filter returns only matching events', async () => {
      const contact = await provider.create('Contact', { name: 'Alice' })
      await provider.update('Contact', contact.$id, { name: 'Alice Smith' })

      const cdc = await eventLog.cdc({ verbs: ['update'] })
      expect(cdc.events).toHaveLength(1)
      expect(cdc.events[0].verb).toBe('update')
    })

    it('CDC stream with batchSize limits the result', async () => {
      for (let i = 0; i < 10; i++) {
        await provider.create('Contact', { name: `Contact ${i}` })
      }

      const cdc = await eventLog.cdc({ batchSize: 3 })
      expect(cdc.events).toHaveLength(3)
      expect(cdc.hasMore).toBe(true)
    })
  })

  // ===========================================================================
  // 10. EventLog Serialization and Compaction (4 tests)
  // ===========================================================================
  describe('EventLog serialization and compaction', () => {
    let eventLog: EventLog
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      eventLog = new EventLog()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~serial',
        eventLog,
      })
    })

    it('toJSON and fromJSON round-trip preserves all events', async () => {
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Deal', { title: 'Big Deal', value: 5000 })

      const json = eventLog.toJSON()
      const restored = new EventLog()
      restored.fromJSON(json)

      const originalEvents = await eventLog.query({})
      const restoredEvents = await restored.query({})

      expect(restoredEvents).toHaveLength(originalEvents.length)
      expect(restoredEvents[0].$id).toBe(originalEvents[0].$id)
      expect(restoredEvents[0].$type).toBe(originalEvents[0].$type)
    })

    it('compact merges events for an entity into a snapshot', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })
      await provider.update('Contact', contact.$id, { stage: 'Customer' })

      const { originalCount, snapshotEvent } = await eventLog.compact('Contact', contact.$id)
      expect(originalCount).toBe(3) // create + 2 updates
      expect(snapshotEvent.$type).toBe('Contact.snapshot')
      expect(snapshotEvent.after).toBeDefined()
      expect((snapshotEvent.after as Record<string, unknown>).stage).toBe('Customer')
    })

    it('EventLog uniqueEntities returns distinct entity pairs', async () => {
      const alice = await provider.create('Contact', { name: 'Alice' })
      await provider.update('Contact', alice.$id, { name: 'Alice Smith' })
      await provider.create('Contact', { name: 'Bob' })
      await provider.create('Deal', { title: 'Deal 1' })

      const entities = await eventLog.uniqueEntities()
      expect(entities).toHaveLength(3) // alice, bob, deal
    })

    it('EventLog count filters correctly', async () => {
      const alice = await provider.create('Contact', { name: 'Alice' })
      await provider.update('Contact', alice.$id, { name: 'Alice Smith' })
      await provider.create('Deal', { title: 'Deal 1' })

      const totalCount = await eventLog.count()
      expect(totalCount).toBe(3)

      const contactCount = await eventLog.count({ entityType: 'Contact' })
      expect(contactCount).toBe(2)

      const updateCount = await eventLog.count({ verb: 'update' })
      expect(updateCount).toBe(1)
    })
  })

  // ===========================================================================
  // 11. DONounProvider Advanced doFetch Scenarios (5 tests)
  // ===========================================================================
  describe('DONounProvider -- advanced doFetch scenarios', () => {
    it('find returns empty array when response data is not an array', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { notAnArray: true } }),
      })

      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~adv',
        doFetch: mockFetch,
      })

      const results = await provider.find('Contact')
      expect(results).toEqual([])
    })

    it('find handles response with items key instead of data', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { $id: 'contact_1', $type: 'Contact', name: 'Alice' },
          ],
        }),
      })

      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~adv',
        doFetch: mockFetch,
      })

      const results = await provider.find('Contact')
      expect(results).toHaveLength(1)
    })

    it('get with encoded special characters in id works correctly', async () => {
      const mockFetch = mockJsonResponse({
        $id: 'contact_abc+def',
        $type: 'Contact',
        name: 'Special',
      })

      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~adv',
        doFetch: mockFetch,
      })

      await provider.get('Contact', 'contact_abc+def')

      const [path] = mockFetch.mock.calls[0]
      expect(path).toContain(encodeURIComponent('contact_abc+def'))
    })

    it('create with complex nested data serializes correctly', async () => {
      const mockFetch = mockJsonResponse({
        $id: 'contact_new',
        $type: 'Contact',
        name: 'Alice',
        metadata: { tags: ['vip', 'enterprise'], score: 95 },
      })

      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~adv',
        doFetch: mockFetch,
      })

      const data = {
        name: 'Alice',
        metadata: { tags: ['vip', 'enterprise'], score: 95 },
      }
      const result = await provider.create('Contact', data)

      const [, init] = mockFetch.mock.calls[0]
      const body = JSON.parse(init.body)
      expect(body.metadata.tags).toEqual(['vip', 'enterprise'])
      expect(result.metadata).toEqual({ tags: ['vip', 'enterprise'], score: 95 })
    })

    it('find with $in operator serializes array values correctly', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~adv',
        doFetch: mockFetch,
      })

      await provider.find('Contact', { stage: { $in: ['Lead', 'Qualified'] } })

      const [path] = mockFetch.mock.calls[0]
      expect(path).toContain('stage%5B%24in%5D=Lead%2CQualified')
    })
  })
})
