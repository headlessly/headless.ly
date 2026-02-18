import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearRegistry, Noun, getNounSchema } from 'digital-objects'
import type { NounProvider, NounInstance } from 'digital-objects'
import { LocalNounProvider } from '../src/local-provider'
import { DONounProvider, DOProviderError } from '../src/do-provider'
import { createEventBridge } from '../src/event-bridge'
import { executeVerb } from '../src/verb-executor'
import { generateSqid, generateEntityId, generateEventId } from '../src/id'
import type { EventEmitter, NounEvent, EventHandler } from '../src/event-bridge'
import { EventLog } from '@headlessly/events'

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

describe('@headlessly/objects -- deep-v2 provider tests', () => {
  // ===========================================================================
  // 1. LocalNounProvider -- context isolation (4 tests)
  // ===========================================================================
  describe('LocalNounProvider -- context isolation', () => {
    it('two providers with different contexts are fully isolated', async () => {
      const providerA = new LocalNounProvider({ context: 'https://headless.ly/~tenantA' })
      const providerB = new LocalNounProvider({ context: 'https://headless.ly/~tenantB' })

      await providerA.create('Contact', { name: 'Alice' })
      await providerB.create('Contact', { name: 'Bob' })

      const resultsA = await providerA.find('Contact')
      const resultsB = await providerB.find('Contact')

      expect(resultsA).toHaveLength(1)
      expect(resultsA[0].name).toBe('Alice')
      expect(resultsB).toHaveLength(1)
      expect(resultsB[0].name).toBe('Bob')
    })

    it('find filters by context so cross-tenant entities are invisible', async () => {
      const providerA = new LocalNounProvider({ context: 'https://headless.ly/~alpha' })
      const providerB = new LocalNounProvider({ context: 'https://headless.ly/~beta' })

      await providerA.create('Deal', { title: 'Alpha Deal', value: 100 })
      await providerA.create('Deal', { title: 'Alpha Deal 2', value: 200 })
      await providerB.create('Deal', { title: 'Beta Deal', value: 300 })

      const alphaDeals = await providerA.find('Deal')
      expect(alphaDeals).toHaveLength(2)

      const betaDeals = await providerB.find('Deal')
      expect(betaDeals).toHaveLength(1)
    })

    it('default context is https://headless.ly when not specified', async () => {
      const provider = new LocalNounProvider()
      const entity = await provider.create('Contact', { name: 'Default' })
      expect(entity.$context).toBe('https://headless.ly')
    })

    it('count only counts entities matching the provider context', async () => {
      const providerX = new LocalNounProvider({ context: 'https://headless.ly/~x' })

      await providerX.create('Contact', { name: 'A' })
      await providerX.create('Contact', { name: 'B' })
      await providerX.create('Deal', { title: 'D1', value: 1 })

      expect(await providerX.count('Contact')).toBe(2)
      expect(await providerX.count('Deal')).toBe(1)
      expect(await providerX.count('Project')).toBe(0)
    })
  })

  // ===========================================================================
  // 2. LocalNounProvider -- update edge cases (4 tests)
  // ===========================================================================
  describe('LocalNounProvider -- update edge cases', () => {
    let provider: LocalNounProvider

    beforeEach(() => {
      provider = new LocalNounProvider({ context: 'https://headless.ly/~edge' })
    })

    it('update preserves $id, $type, $context even if data tries to override them', async () => {
      const created = await provider.create('Contact', { name: 'Alice' })
      const updated = await provider.update('Contact', created.$id, {
        name: 'Alice Updated',
        $id: 'contact_EVIL',
        $type: 'EvilType',
        $context: 'https://evil.ly',
      })
      expect(updated.$id).toBe(created.$id)
      expect(updated.$type).toBe('Contact')
      expect(updated.$context).toBe('https://headless.ly/~edge')
    })

    it('update on non-existent entity throws descriptive error', async () => {
      await expect(provider.update('Contact', 'contact_ghost', { name: 'Ghost' })).rejects.toThrow('Contact not found: contact_ghost')
    })

    it('update with wrong type throws even if id exists', async () => {
      const created = await provider.create('Contact', { name: 'Alice' })
      await expect(provider.update('Deal', created.$id, { title: 'Fake' })).rejects.toThrow('Deal not found')
    })

    it('multiple sequential updates increment version correctly', async () => {
      const created = await provider.create('Contact', { name: 'V1', stage: 'Lead' })
      expect(created.$version).toBe(1)

      const v2 = await provider.update('Contact', created.$id, { stage: 'Qualified' })
      expect(v2.$version).toBe(2)

      const v3 = await provider.update('Contact', created.$id, { stage: 'Customer' })
      expect(v3.$version).toBe(3)

      const v4 = await provider.update('Contact', created.$id, { stage: 'Partner' })
      expect(v4.$version).toBe(4)

      const final = await provider.get('Contact', created.$id)
      expect(final!.$version).toBe(4)
      expect(final!.stage).toBe('Partner')
    })
  })

  // ===========================================================================
  // 3. LocalNounProvider -- delete edge cases (3 tests)
  // ===========================================================================
  describe('LocalNounProvider -- delete edge cases', () => {
    let provider: LocalNounProvider

    beforeEach(() => {
      provider = new LocalNounProvider({ context: 'https://headless.ly/~del' })
    })

    it('delete returns false for wrong type even if id exists', async () => {
      const created = await provider.create('Contact', { name: 'Alice' })
      const result = await provider.delete('Deal', created.$id)
      expect(result).toBe(false)
      // Entity still exists
      const stillThere = await provider.get('Contact', created.$id)
      expect(stillThere).not.toBeNull()
    })

    it('double delete returns false on the second call', async () => {
      const created = await provider.create('Contact', { name: 'Alice' })
      const first = await provider.delete('Contact', created.$id)
      expect(first).toBe(true)
      const second = await provider.delete('Contact', created.$id)
      expect(second).toBe(false)
    })

    it('clear resets size to zero and find returns empty', async () => {
      await provider.create('Contact', { name: 'A' })
      await provider.create('Contact', { name: 'B' })
      await provider.create('Deal', { title: 'D' })
      expect(provider.size).toBe(3)

      provider.clear()
      expect(provider.size).toBe(0)
      expect(await provider.find('Contact')).toEqual([])
      expect(await provider.find('Deal')).toEqual([])
    })
  })

  // ===========================================================================
  // 4. LocalNounProvider -- findOne (3 tests)
  // ===========================================================================
  describe('LocalNounProvider -- findOne', () => {
    let provider: LocalNounProvider

    beforeEach(() => {
      provider = new LocalNounProvider({ context: 'https://headless.ly/~findone' })
    })

    it('findOne returns the first matching entity', async () => {
      await provider.create('Contact', { name: 'Alpha', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bravo', stage: 'Qualified' })
      await provider.create('Contact', { name: 'Charlie', stage: 'Lead' })

      const result = await provider.findOne('Contact', { stage: 'Lead' })
      expect(result).not.toBeNull()
      expect(result!.name).toBe('Alpha')
    })

    it('findOne returns null when nothing matches', async () => {
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const result = await provider.findOne('Contact', { stage: 'Churned' })
      expect(result).toBeNull()
    })

    it('findOne without filter returns the first entity of that type', async () => {
      await provider.create('Deal', { title: 'First', value: 1 })
      await provider.create('Deal', { title: 'Second', value: 2 })

      const result = await provider.findOne('Deal')
      expect(result).not.toBeNull()
      expect(result!.title).toBe('First')
    })
  })

  // ===========================================================================
  // 5. LocalNounProvider -- perform without data (2 tests)
  // ===========================================================================
  describe('LocalNounProvider -- perform without data', () => {
    let provider: LocalNounProvider

    beforeEach(() => {
      provider = new LocalNounProvider({ context: 'https://headless.ly/~perf' })
    })

    it('perform without data does not increment version', async () => {
      const created = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const result = await provider.perform('Contact', 'touch', created.$id)
      // No data supplied -- version stays unchanged
      expect(result.$version).toBe(1)
      expect(result.name).toBe('Alice')
    })

    it('perform with data merges fields and increments version', async () => {
      const created = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const result = await provider.perform('Contact', 'qualify', created.$id, { stage: 'Qualified', score: 85 })
      expect(result.$version).toBe(2)
      expect(result.stage).toBe('Qualified')
      expect(result.score).toBe(85)
      expect(result.name).toBe('Alice')
    })
  })

  // ===========================================================================
  // 6. Event Bridge -- advanced patterns (5 tests)
  // ===========================================================================
  describe('Event Bridge -- advanced pattern matching', () => {
    let bridge: EventEmitter

    beforeEach(() => {
      bridge = createEventBridge()
    })

    it('exact pattern does not match partially', async () => {
      const handler = vi.fn()
      bridge.subscribe('Contact.created', handler)

      await bridge.emit({
        $id: 'evt_1',
        $type: 'Contact.updated',
        entityType: 'Contact',
        entityId: 'contact_1',
        verb: 'updated',
        timestamp: new Date().toISOString(),
      })

      expect(handler).not.toHaveBeenCalled()
    })

    it('entity wildcard "Contact.*" does not match other entity types', async () => {
      const handler = vi.fn()
      bridge.subscribe('Contact.*', handler)

      await bridge.emit({
        $id: 'evt_1',
        $type: 'Deal.created',
        entityType: 'Deal',
        entityId: 'deal_1',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })

      expect(handler).not.toHaveBeenCalled()
    })

    it('verb wildcard "*.updated" matches across all entity types', async () => {
      const handler = vi.fn()
      bridge.subscribe('*.updated', handler)

      await bridge.emit({
        $id: 'evt_1',
        $type: 'Contact.updated',
        entityType: 'Contact',
        entityId: 'contact_1',
        verb: 'updated',
        timestamp: new Date().toISOString(),
      })
      await bridge.emit({
        $id: 'evt_2',
        $type: 'Deal.updated',
        entityType: 'Deal',
        entityId: 'deal_1',
        verb: 'updated',
        timestamp: new Date().toISOString(),
      })
      await bridge.emit({
        $id: 'evt_3',
        $type: 'Contact.deleted',
        entityType: 'Contact',
        entityId: 'contact_2',
        verb: 'deleted',
        timestamp: new Date().toISOString(),
      })

      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('multiple subscriptions on different patterns both fire', async () => {
      const contactHandler = vi.fn()
      const allHandler = vi.fn()
      bridge.subscribe('Contact.created', contactHandler)
      bridge.subscribe('*', allHandler)

      await bridge.emit({
        $id: 'evt_1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_1',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })

      expect(contactHandler).toHaveBeenCalledTimes(1)
      expect(allHandler).toHaveBeenCalledTimes(1)
    })

    it('unsubscribing one handler does not affect other handlers on the same pattern', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const unsub1 = bridge.subscribe('Contact.*', handler1)
      bridge.subscribe('Contact.*', handler2)

      unsub1()

      await bridge.emit({
        $id: 'evt_1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_1',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // 7. Event Bridge -- query combinations (3 tests)
  // ===========================================================================
  describe('Event Bridge -- query combinations', () => {
    let bridge: EventEmitter

    beforeEach(async () => {
      bridge = createEventBridge()
      await bridge.emit({
        $id: 'evt_a',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_1',
        verb: 'created',
        timestamp: '2025-01-01T00:00:00Z',
      })
      await bridge.emit({
        $id: 'evt_b',
        $type: 'Contact.updated',
        entityType: 'Contact',
        entityId: 'contact_1',
        verb: 'updated',
        timestamp: '2025-01-02T00:00:00Z',
      })
      await bridge.emit({
        $id: 'evt_c',
        $type: 'Deal.created',
        entityType: 'Deal',
        entityId: 'deal_1',
        verb: 'created',
        timestamp: '2025-01-03T00:00:00Z',
      })
    })

    it('query with multiple filters narrows results correctly', async () => {
      const results = await bridge.query({ entityType: 'Contact', verb: 'created' })
      expect(results).toHaveLength(1)
      expect(results[0].$id).toBe('evt_a')
    })

    it('query with since filter excludes older events', async () => {
      const results = await bridge.query({ since: '2025-01-02T00:00:00Z' })
      expect(results).toHaveLength(2) // evt_b and evt_c
    })

    it('query with empty options returns all events', async () => {
      const results = await bridge.query({})
      expect(results).toHaveLength(3)
    })
  })

  // ===========================================================================
  // 8. Event Bridge -- clear (2 tests)
  // ===========================================================================
  describe('Event Bridge -- clear preserves subscribers', () => {
    it('clear removes events but subscribers still fire on new events', async () => {
      const bridge = createEventBridge()
      const handler = vi.fn()
      bridge.subscribe('*', handler)

      await bridge.emit({
        $id: 'evt_old',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_old',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })
      expect(handler).toHaveBeenCalledTimes(1)

      bridge.clear()
      const afterClear = await bridge.query({})
      expect(afterClear).toHaveLength(0)

      await bridge.emit({
        $id: 'evt_new',
        $type: 'Deal.created',
        entityType: 'Deal',
        entityId: 'deal_new',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })
      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('clear followed by query returns empty', async () => {
      const bridge = createEventBridge()
      await bridge.emit({
        $id: 'evt_1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_1',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })
      bridge.clear()
      expect(await bridge.query({})).toEqual([])
    })
  })

  // ===========================================================================
  // 9. LocalNounProvider + EventLog integration (4 tests)
  // ===========================================================================
  describe('LocalNounProvider -- EventLog integration', () => {
    let provider: LocalNounProvider
    let eventLog: EventLog

    beforeEach(() => {
      eventLog = new EventLog()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~elog',
        eventLog,
      })
    })

    it('create appends a NounEvent with conjugation to EventLog', async () => {
      await provider.create('Contact', { name: 'Alice' })
      expect(eventLog.size).toBe(1)

      const events = await eventLog.query({ entityType: 'Contact' })
      expect(events).toHaveLength(1)
      expect(events[0].$type).toBe('Contact.create')
      expect(events[0].conjugation.action).toBe('create')
      expect(events[0].conjugation.activity).toBe('creating')
      expect(events[0].conjugation.event).toBe('created')
    })

    it('update appends an event with before and after state', async () => {
      const created = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', created.$id, { stage: 'Qualified' })

      const events = await eventLog.query({ verb: 'update' })
      expect(events).toHaveLength(1)
      expect(events[0].before).toBeDefined()
      expect(events[0].after).toBeDefined()
      expect((events[0].before as Record<string, unknown>).stage).toBe('Lead')
      expect((events[0].after as Record<string, unknown>).stage).toBe('Qualified')
    })

    it('delete appends an event with before state and null after', async () => {
      const created = await provider.create('Contact', { name: 'Alice' })
      await provider.delete('Contact', created.$id)

      const events = await eventLog.query({ verb: 'delete' })
      expect(events).toHaveLength(1)
      expect(events[0].before).toBeDefined()
      expect(events[0].after).toBeUndefined()
    })

    it('perform custom verb appends event with correct conjugation', async () => {
      const created = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.perform('Contact', 'qualify', created.$id, { stage: 'Qualified' })

      const events = await eventLog.query({ verb: 'qualify' })
      expect(events).toHaveLength(1)
      expect(events[0].conjugation.action).toBe('qualify')
      expect(events[0].conjugation.activity).toBe('qualifying')
      expect(events[0].conjugation.event).toBe('qualified')
    })
  })

  // ===========================================================================
  // 10. LocalNounProvider -- dual event emission (2 tests)
  // ===========================================================================
  describe('LocalNounProvider -- dual event emission (bridge + eventLog)', () => {
    it('emits to both EventLog and event bridge simultaneously', async () => {
      const eventLog = new EventLog()
      const bridge = createEventBridge()
      const handler = vi.fn()
      bridge.subscribe('Contact.create', handler)

      const provider = new LocalNounProvider({
        context: 'https://headless.ly/~dual',
        events: bridge,
        eventLog,
      })

      await provider.create('Contact', { name: 'Alice' })

      // EventLog got an event
      expect(eventLog.size).toBe(1)
      // Bridge handler also fired
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('bridge receives lightweight event while eventLog receives full event with conjugation', async () => {
      const eventLog = new EventLog()
      const bridge = createEventBridge()
      const bridgeEvents: NounEvent[] = []
      bridge.subscribe('*', (e) => bridgeEvents.push(e))

      const provider = new LocalNounProvider({
        context: 'https://headless.ly/~dual2',
        events: bridge,
        eventLog,
      })

      await provider.create('Contact', { name: 'Bob' })

      // Bridge event is lightweight (no conjugation field)
      expect(bridgeEvents).toHaveLength(1)
      expect(bridgeEvents[0].$type).toBe('Contact.create')
      expect((bridgeEvents[0] as any).conjugation).toBeUndefined()

      // EventLog event has conjugation
      const logEvents = await eventLog.query({})
      expect(logEvents).toHaveLength(1)
      expect(logEvents[0].conjugation).toBeDefined()
      expect(logEvents[0].conjugation.action).toBe('create')
    })
  })

  // ===========================================================================
  // 11. Verb Executor -- lifecycle event ordering (3 tests)
  // ===========================================================================
  describe('Verb Executor -- lifecycle event ordering', () => {
    let provider: LocalNounProvider
    let bridge: EventEmitter

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({ context: 'https://headless.ly/~lifecycle' })
      bridge = createEventBridge()
    })

    it('emits three events in order: {activity}, {verb}, {event}', async () => {
      Noun('Contact', {
        name: 'string!',
        stage: 'Lead | Qualified | Customer',
        qualify: 'Qualified',
      })

      const created = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const callOrder: string[] = []

      bridge.subscribe('Contact.qualifying', () => callOrder.push('qualifying'))
      bridge.subscribe('Contact.qualify', () => callOrder.push('qualify'))
      bridge.subscribe('Contact.qualified', () => callOrder.push('qualified'))

      await executeVerb({ type: 'Contact', verb: 'qualify', entityId: created.$id, data: { stage: 'Qualified' } }, { provider, events: bridge })

      expect(callOrder).toEqual(['qualifying', 'qualify', 'qualified'])
    })

    it('BEFORE event (activity) fires before provider.perform', async () => {
      Noun('Deal', {
        title: 'string!',
        stage: 'Open | Won | Lost',
        close: 'Won',
      })

      const deal = await provider.create('Deal', { title: 'Big Deal', stage: 'Open' })
      let stateAtBefore: string | undefined

      bridge.subscribe('Deal.closing', async () => {
        const current = await provider.get('Deal', deal.$id)
        stateAtBefore = current?.stage as string
      })

      await executeVerb({ type: 'Deal', verb: 'close', entityId: deal.$id, data: { stage: 'Won' } }, { provider, events: bridge })

      expect(stateAtBefore).toBe('Open')
    })

    it('BEFORE event throwing aborts the verb and prevents AFTER event', async () => {
      Noun('Contact', {
        name: 'string!',
        stage: 'Lead | Qualified | Customer',
        qualify: 'Qualified',
      })

      const created = await provider.create('Contact', { name: 'Eve', stage: 'Lead' })
      const afterHandler = vi.fn()

      bridge.subscribe('Contact.qualifying', () => {
        throw new Error('Blocked by policy')
      })
      bridge.subscribe('Contact.qualified', afterHandler)

      await expect(
        executeVerb({ type: 'Contact', verb: 'qualify', entityId: created.$id, data: { stage: 'Qualified' } }, { provider, events: bridge }),
      ).rejects.toThrow('Blocked by policy')

      // AFTER event should not have fired
      expect(afterHandler).not.toHaveBeenCalled()
      // Entity should still be in Lead state
      const still = await provider.get('Contact', created.$id)
      expect(still!.stage).toBe('Lead')
    })
  })

  // ===========================================================================
  // 12. Verb Executor -- disabled/unknown verbs (2 tests)
  // ===========================================================================
  describe('Verb Executor -- verb validation', () => {
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({ context: 'https://headless.ly/~verbval' })
    })

    it('throws when verb is explicitly disabled via null', async () => {
      Noun('Ledger', {
        amount: 'string!',
        update: null,
      })

      const entry = await provider.create('Ledger', { amount: '100.00' })

      await expect(executeVerb({ type: 'Ledger', verb: 'update', entityId: entry.$id, data: { amount: '200.00' } }, { provider })).rejects.toThrow(/disabled/)
    })

    it('throws for unknown verb when schema is registered', async () => {
      Noun('Contact', {
        name: 'string!',
      })

      const contact = await provider.create('Contact', { name: 'Test' })

      await expect(executeVerb({ type: 'Contact', verb: 'nonexistentverb', entityId: contact.$id }, { provider })).rejects.toThrow(/[Uu]nknown verb/)
    })
  })

  // ===========================================================================
  // 13. Verb Executor -- no schema registered (1 test)
  // ===========================================================================
  describe('Verb Executor -- without schema', () => {
    it('executes successfully when no schema is registered (schema is optional)', async () => {
      clearRegistry()
      const provider = new LocalNounProvider({ context: 'https://headless.ly/~noschema' })
      const created = await provider.create('Unregistered', { field: 'value' })

      // No Noun() call -- schema is undefined, should skip validation
      const result = await executeVerb({ type: 'Unregistered', verb: 'touch', entityId: created.$id }, { provider })

      expect(result.$id).toBe(created.$id)
    })
  })

  // ===========================================================================
  // 14. DONounProvider -- doFetch CRUD operations (6 tests)
  // ===========================================================================
  describe('DONounProvider -- doFetch legacy CRUD', () => {
    it('find sends GET to collection endpoint with query params for filters', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })

      await provider.find('Contact', { stage: 'Lead' })

      const [path, init] = mockFetch.mock.calls[0]
      expect(path).toContain('/contacts')
      expect(path).toContain('stage=Lead')
      expect(init.method).toBe('GET')
    })

    it('find with no filters sends GET to collection endpoint with no query string', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })

      await provider.find('Contact')

      const [path] = mockFetch.mock.calls[0]
      expect(path).toBe('/contacts')
    })

    it('update sends PUT to collection/:id endpoint', async () => {
      const mockFetch = mockJsonResponse({
        $id: 'contact_abc',
        $type: 'Contact',
        $context: 'https://headless.ly',
        $version: 2,
        $createdAt: '2025-01-01T00:00:00Z',
        $updatedAt: '2025-01-02T00:00:00Z',
        name: 'Updated',
      })

      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })
      const result = await provider.update('Contact', 'contact_abc', { name: 'Updated' })

      const [path, init] = mockFetch.mock.calls[0]
      expect(path).toBe('/contacts/contact_abc')
      expect(init.method).toBe('PUT')
      expect(JSON.parse(init.body)).toEqual({ name: 'Updated' })
      expect(result.name).toBe('Updated')
    })

    it('delete sends DELETE to collection/:id endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      })

      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })
      const result = await provider.delete('Contact', 'contact_abc')

      const [path, init] = mockFetch.mock.calls[0]
      expect(path).toBe('/contacts/contact_abc')
      expect(init.method).toBe('DELETE')
      expect(result).toBe(true)
    })

    it('delete returns false for 404 response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'not found' }),
      })

      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })
      const result = await provider.delete('Contact', 'contact_missing')
      expect(result).toBe(false)
    })

    it('get returns null for 404 response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'not found' }),
      })

      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })
      const result = await provider.get('Contact', 'contact_missing')
      expect(result).toBeNull()
    })
  })

  // ===========================================================================
  // 15. DONounProvider -- perform (custom verb via doFetch) (1 test)
  // ===========================================================================
  describe('DONounProvider -- perform via doFetch', () => {
    it('perform in legacy doFetch mode throws because arbitrary verb methods are not in the proxy', async () => {
      const mockFetch = mockJsonResponse({
        $id: 'contact_abc',
        $type: 'Contact',
        $context: 'https://headless.ly/~acme',
        $version: 2,
        $createdAt: '2025-01-01T00:00:00Z',
        $updatedAt: '2025-01-01T01:00:00Z',
        name: 'Alice',
        stage: 'Qualified',
      })

      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })

      // In legacy doFetch mode, the proxy only defines find/get/put/create/delete.
      // Calling perform() with a custom verb hits ns[verb]() which is undefined,
      // so it throws a TypeError.
      await expect(provider.perform('Contact', 'qualify', 'contact_abc', { stage: 'Qualified' })).rejects.toThrow()
    })
  })

  // ===========================================================================
  // 16. DONounProvider -- auth headers (2 tests)
  // ===========================================================================
  describe('DONounProvider -- authentication', () => {
    it('includes Authorization header when apiKey is provided', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~acme',
        doFetch: mockFetch,
        apiKey: 'sk_test_myapikey',
      })

      await provider.find('Contact')

      const [, init] = mockFetch.mock.calls[0]
      expect(init.headers['Authorization']).toBe('Bearer sk_test_myapikey')
    })

    it('includes X-Context header in every request', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~acme',
        doFetch: mockFetch,
        context: 'https://headless.ly/~custom',
      })

      await provider.find('Contact')

      const [, init] = mockFetch.mock.calls[0]
      expect(init.headers['X-Context']).toBe('https://headless.ly/~custom')
    })
  })

  // ===========================================================================
  // 17. DONounProvider -- collection name derivation (3 tests)
  // ===========================================================================
  describe('DONounProvider -- collection name pluralization', () => {
    it('Contact maps to /contacts', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })
      await provider.find('Contact')
      expect(mockFetch.mock.calls[0][0]).toBe('/contacts')
    })

    it('FeatureFlag maps to /featureFlags', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })
      await provider.find('FeatureFlag')
      expect(mockFetch.mock.calls[0][0]).toBe('/featureFlags')
    })

    it('Activity maps to /activities (y -> ies pluralization)', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })
      await provider.find('Activity')
      expect(mockFetch.mock.calls[0][0]).toBe('/activities')
    })
  })

  // ===========================================================================
  // 18. DONounProvider -- error handling (2 tests)
  // ===========================================================================
  describe('DONounProvider -- error handling', () => {
    it('DOProviderError is an instance of Error with correct name', () => {
      const err = new DOProviderError('test', 500, 'details')
      expect(err instanceof Error).toBe(true)
      expect(err.name).toBe('DOProviderError')
      expect(err.message).toBe('test')
      expect(err.status).toBe(500)
      expect(err.detail).toBe('details')
    })

    it('find throws DOProviderError on non-ok response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: 'service unavailable' }),
      })

      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })

      await expect(provider.find('Contact')).rejects.toThrow(DOProviderError)
    })
  })

  // ===========================================================================
  // 19. DONounProvider -- basePath support (1 test)
  // ===========================================================================
  describe('DONounProvider -- basePath', () => {
    it('prefixes all paths with basePath', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~acme',
        doFetch: mockFetch,
        basePath: '/api/v1',
      })

      await provider.find('Contact')

      const [path] = mockFetch.mock.calls[0]
      expect(path).toBe('/api/v1/contacts')
    })
  })

  // ===========================================================================
  // 20. DONounProvider -- filter with operators (1 test)
  // ===========================================================================
  describe('DONounProvider -- filter serialization', () => {
    it('serializes nested operator filters into query params', async () => {
      const mockFetch = mockJsonResponse([])
      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })

      await provider.find('Deal', { value: { $gte: 1000 }, stage: 'Open' })

      const [path] = mockFetch.mock.calls[0]
      // URLSearchParams encodes brackets, so check for the encoded form
      expect(path).toContain('value%5B%24gte%5D=1000')
      expect(path).toContain('stage=Open')
    })
  })

  // ===========================================================================
  // 21. ID generation edge cases (3 tests)
  // ===========================================================================
  describe('ID Generation -- edge cases', () => {
    it('generateSqid with custom length produces correct length', () => {
      expect(generateSqid(4)).toHaveLength(4)
      expect(generateSqid(16)).toHaveLength(16)
      expect(generateSqid(1)).toHaveLength(1)
    })

    it('generateEntityId lowercases multi-word type names', () => {
      const id = generateEntityId('FeatureFlag')
      expect(id).toMatch(/^featureflag_[a-zA-Z0-9]{8}$/)
    })

    it('all generated IDs use only alphanumeric chars in the suffix', () => {
      for (let i = 0; i < 100; i++) {
        const sqid = generateSqid()
        expect(sqid).toMatch(/^[a-zA-Z0-9]+$/)
      }
    })
  })

  // ===========================================================================
  // 22. Provider as NounProvider interface conformance (2 tests)
  // ===========================================================================
  describe('NounProvider interface conformance', () => {
    it('LocalNounProvider satisfies all NounProvider methods', () => {
      const provider: NounProvider = new LocalNounProvider()
      expect(typeof provider.create).toBe('function')
      expect(typeof provider.get).toBe('function')
      expect(typeof provider.find).toBe('function')
      expect(typeof provider.update).toBe('function')
      expect(typeof provider.delete).toBe('function')
      expect(typeof provider.perform).toBe('function')
    })

    it('DONounProvider satisfies all NounProvider methods', () => {
      const provider: NounProvider = new DONounProvider({ endpoint: 'https://db.headless.ly/~test' })
      expect(typeof provider.create).toBe('function')
      expect(typeof provider.get).toBe('function')
      expect(typeof provider.find).toBe('function')
      expect(typeof provider.update).toBe('function')
      expect(typeof provider.delete).toBe('function')
      expect(typeof provider.perform).toBe('function')
    })
  })

  // ===========================================================================
  // 23. DONounProvider -- toNounInstance normalization (1 test)
  // ===========================================================================
  describe('DONounProvider -- response normalization', () => {
    it('normalizes raw response into NounInstance with default meta-fields', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: { name: 'Alice' }, // missing all meta-fields
        }),
      })

      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme', doFetch: mockFetch })
      const result = await provider.get('Contact', 'contact_abc')

      expect(result).not.toBeNull()
      // toNounInstance should provide defaults for missing fields
      expect(result!.$id).toBe('')
      expect(result!.$type).toBe('')
      expect(result!.$context).toBe('')
      expect(result!.$version).toBe(1)
    })
  })

  // ===========================================================================
  // 24. Verb conjugation in verb-executor (2 tests)
  // ===========================================================================
  describe('Verb Executor -- conjugation derivation', () => {
    let provider: LocalNounProvider
    let bridge: EventEmitter

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({ context: 'https://headless.ly/~conj' })
      bridge = createEventBridge()
    })

    it('verb ending in "e" (close -> closing -> closed)', async () => {
      Noun('Deal', {
        title: 'string!',
        stage: 'Open | Won | Lost',
        close: 'Won',
      })

      const deal = await provider.create('Deal', { title: 'Test', stage: 'Open' })
      const events: NounEvent[] = []
      bridge.subscribe('*', (e) => events.push(e))

      await executeVerb({ type: 'Deal', verb: 'close', entityId: deal.$id, data: { stage: 'Won' } }, { provider, events: bridge })

      const types = events.map((e) => e.$type)
      expect(types).toContain('Deal.closing')
      expect(types).toContain('Deal.close')
      expect(types).toContain('Deal.closed')
    })

    it('verb ending in "y" (qualify -> qualifying -> qualified)', async () => {
      Noun('Contact', {
        name: 'string!',
        stage: 'Lead | Qualified',
        qualify: 'Qualified',
      })

      const contact = await provider.create('Contact', { name: 'Test', stage: 'Lead' })
      const events: NounEvent[] = []
      bridge.subscribe('*', (e) => events.push(e))

      await executeVerb({ type: 'Contact', verb: 'qualify', entityId: contact.$id, data: { stage: 'Qualified' } }, { provider, events: bridge })

      const types = events.map((e) => e.$type)
      expect(types).toContain('Contact.qualifying')
      expect(types).toContain('Contact.qualify')
      expect(types).toContain('Contact.qualified')
    })
  })
})
