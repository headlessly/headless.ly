import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearRegistry, Noun } from 'digital-objects'
import { LocalNounProvider } from '../src/local-provider'
import { createEventBridge } from '../src/event-bridge'
import { executeVerb } from '../src/verb-executor'
import { DONounProvider, DOProviderError } from '../src/do-provider'
import { generateEntityId, generateEventId, generateSqid } from '../src/id'
import type { EventEmitter, NounEvent } from '../src/event-bridge'

describe('@headlessly/objects — deep provider tests (RED)', () => {
  // ===========================================================================
  // 1. LocalNounProvider CRUD — 8 tests
  // ===========================================================================
  describe('LocalNounProvider — extended CRUD', () => {
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({ context: 'https://headless.ly/~deep' })
    })

    it('create returns entity with $id, $type, $createdAt, $updatedAt', async () => {
      const entity = await provider.create('Contact', { name: 'Zara', email: 'zara@example.com' })
      expect(entity.$id).toMatch(/^contact_[a-zA-Z0-9]+$/)
      expect(entity.$type).toBe('Contact')
      expect(entity.$createdAt).toBeTruthy()
      expect(entity.$updatedAt).toBeTruthy()
      expect(entity.$context).toBe('https://headless.ly/~deep')
      expect(entity.$version).toBe(1)
      expect(entity.name).toBe('Zara')
      expect(entity.email).toBe('zara@example.com')
    })

    it('get entity by id returns correct entity', async () => {
      const created = await provider.create('Deal', { title: 'Enterprise', value: 75000 })
      const fetched = await provider.get('Deal', created.$id)
      expect(fetched).not.toBeNull()
      expect(fetched!.$id).toBe(created.$id)
      expect(fetched!.$type).toBe('Deal')
      expect(fetched!.title).toBe('Enterprise')
      expect(fetched!.value).toBe(75000)
    })

    it('get non-existent entity returns null', async () => {
      const result = await provider.get('Contact', 'contact_zzzNonExistent')
      expect(result).toBeNull()
    })

    it('get with wrong type returns null even if id exists', async () => {
      const created = await provider.create('Contact', { name: 'Alice' })
      const result = await provider.get('Deal', created.$id)
      expect(result).toBeNull()
    })

    it('find with filter returns only matching entities', async () => {
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Qualified' })
      await provider.create('Contact', { name: 'Charlie', stage: 'Lead' })

      const leads = await provider.find('Contact', { stage: 'Lead' })
      expect(leads).toHaveLength(2)
      expect(leads.map((c) => c.name).sort()).toEqual(['Alice', 'Charlie'])
    })

    it('update entity merges fields and updates $updatedAt', async () => {
      const created = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const beforeUpdate = created.$updatedAt

      // Small delay to ensure timestamp changes
      await new Promise((r) => setTimeout(r, 5))

      const updated = await provider.update('Contact', created.$id, { stage: 'Qualified' })
      expect(updated.$version).toBe(2)
      expect(updated.stage).toBe('Qualified')
      expect(updated.name).toBe('Alice') // original field preserved
      expect(updated.$updatedAt >= beforeUpdate).toBe(true)
      expect(updated.$createdAt).toBe(created.$createdAt) // createdAt unchanged
    })

    it('find returns empty array when no matches', async () => {
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const results = await provider.find('Contact', { stage: 'Churned' })
      expect(results).toEqual([])
    })

    it('create multiple entities and list all of that type', async () => {
      const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']
      for (const name of names) {
        await provider.create('Contact', { name })
      }
      await provider.create('Deal', { title: 'Side Deal', value: 100 })

      const contacts = await provider.find('Contact')
      expect(contacts).toHaveLength(5)
      expect(provider.size).toBe(6) // 5 contacts + 1 deal
    })
  })

  // ===========================================================================
  // 2. Event Bridge — 8 tests
  // ===========================================================================
  describe('Event Bridge', () => {
    let bridge: EventEmitter

    beforeEach(() => {
      bridge = createEventBridge()
    })

    it('createEventBridge returns an emitter with emit, subscribe, and query methods', () => {
      expect(typeof bridge.emit).toBe('function')
      expect(typeof bridge.subscribe).toBe('function')
      expect(typeof bridge.query).toBe('function')
    })

    it('emitting an event calls registered handler', async () => {
      const handler = vi.fn()
      bridge.subscribe('Contact.created', handler)

      const event: NounEvent = {
        $id: 'evt_test1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_abc',
        verb: 'created',
        timestamp: new Date().toISOString(),
      }
      await bridge.emit(event)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('handler receives event data with all fields', async () => {
      const handler = vi.fn()
      bridge.subscribe('Deal.closed', handler)

      const event: NounEvent = {
        $id: 'evt_test2',
        $type: 'Deal.closed',
        entityType: 'Deal',
        entityId: 'deal_xyz',
        verb: 'closed',
        data: { reason: 'won' },
        timestamp: '2025-01-01T00:00:00Z',
      }
      await bridge.emit(event)

      expect(handler).toHaveBeenCalledWith(event)
      const received = handler.mock.calls[0][0]
      expect(received.entityId).toBe('deal_xyz')
      expect(received.data).toEqual({ reason: 'won' })
    })

    it('multiple handlers for same event type all fire', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      bridge.subscribe('Contact.created', handler1)
      bridge.subscribe('Contact.created', handler2)
      bridge.subscribe('Contact.created', handler3)

      const event: NounEvent = {
        $id: 'evt_multi',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_m1',
        verb: 'created',
        timestamp: new Date().toISOString(),
      }
      await bridge.emit(event)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(handler3).toHaveBeenCalledTimes(1)
    })

    it('unsubscribe removes handler (no more calls)', async () => {
      const handler = vi.fn()
      const unsub = bridge.subscribe('Contact.created', handler)

      const event: NounEvent = {
        $id: 'evt_unsub1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_u1',
        verb: 'created',
        timestamp: new Date().toISOString(),
      }
      await bridge.emit(event)
      expect(handler).toHaveBeenCalledTimes(1)

      unsub()

      await bridge.emit({ ...event, $id: 'evt_unsub2', entityId: 'contact_u2' })
      expect(handler).toHaveBeenCalledTimes(1) // still 1, not 2
    })

    it('wildcard pattern "*" matches all events', async () => {
      const handler = vi.fn()
      bridge.subscribe('*', handler)

      await bridge.emit({
        $id: 'evt_w1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_w1',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })
      await bridge.emit({
        $id: 'evt_w2',
        $type: 'Deal.closed',
        entityType: 'Deal',
        entityId: 'deal_w2',
        verb: 'closed',
        timestamp: new Date().toISOString(),
      })

      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('pattern "Contact.*" matches all Contact events', async () => {
      const handler = vi.fn()
      bridge.subscribe('Contact.*', handler)

      await bridge.emit({
        $id: 'evt_p1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_p1',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })
      await bridge.emit({
        $id: 'evt_p2',
        $type: 'Contact.qualified',
        entityType: 'Contact',
        entityId: 'contact_p2',
        verb: 'qualified',
        timestamp: new Date().toISOString(),
      })
      await bridge.emit({
        $id: 'evt_p3',
        $type: 'Deal.created',
        entityType: 'Deal',
        entityId: 'deal_p3',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })

      expect(handler).toHaveBeenCalledTimes(2) // Contact.created + Contact.qualified
    })

    it('no handlers does not throw on emit', async () => {
      const event: NounEvent = {
        $id: 'evt_noop',
        $type: 'Unknown.action',
        entityType: 'Unknown',
        entityId: 'unknown_1',
        verb: 'action',
        timestamp: new Date().toISOString(),
      }
      await expect(bridge.emit(event)).resolves.toBeUndefined()
    })
  })

  // ===========================================================================
  // 2b. Event Bridge — query tests (3 tests)
  // ===========================================================================
  describe('Event Bridge — query', () => {
    let bridge: EventEmitter

    beforeEach(() => {
      bridge = createEventBridge()
    })

    it('query by entityType returns matching events', async () => {
      await bridge.emit({
        $id: 'evt_q1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_q1',
        verb: 'created',
        timestamp: '2025-01-01T00:00:00Z',
      })
      await bridge.emit({
        $id: 'evt_q2',
        $type: 'Deal.created',
        entityType: 'Deal',
        entityId: 'deal_q1',
        verb: 'created',
        timestamp: '2025-01-02T00:00:00Z',
      })
      await bridge.emit({
        $id: 'evt_q3',
        $type: 'Contact.qualified',
        entityType: 'Contact',
        entityId: 'contact_q1',
        verb: 'qualified',
        timestamp: '2025-01-03T00:00:00Z',
      })

      const contactEvents = await bridge.query({ entityType: 'Contact' })
      expect(contactEvents).toHaveLength(2)
    })

    it('query by verb returns matching events', async () => {
      await bridge.emit({
        $id: 'evt_v1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_v1',
        verb: 'created',
        timestamp: '2025-01-01T00:00:00Z',
      })
      await bridge.emit({
        $id: 'evt_v2',
        $type: 'Deal.created',
        entityType: 'Deal',
        entityId: 'deal_v1',
        verb: 'created',
        timestamp: '2025-01-02T00:00:00Z',
      })

      const createdEvents = await bridge.query({ verb: 'created' })
      expect(createdEvents).toHaveLength(2)
    })

    it('query by entityId returns events for that entity', async () => {
      await bridge.emit({
        $id: 'evt_ei1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_target',
        verb: 'created',
        timestamp: '2025-01-01T00:00:00Z',
      })
      await bridge.emit({
        $id: 'evt_ei2',
        $type: 'Contact.updated',
        entityType: 'Contact',
        entityId: 'contact_other',
        verb: 'updated',
        timestamp: '2025-01-02T00:00:00Z',
      })

      const targetEvents = await bridge.query({ entityId: 'contact_target' })
      expect(targetEvents).toHaveLength(1)
      expect(targetEvents[0].$id).toBe('evt_ei1')
    })
  })

  // ===========================================================================
  // 3. Verb Executor — 6 tests
  // ===========================================================================
  describe('Verb Executor', () => {
    let provider: LocalNounProvider
    let bridge: EventEmitter

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({ context: 'https://headless.ly/~verb-test' })
      bridge = createEventBridge()
    })

    it('executeVerb calls provider.perform and returns the entity', async () => {
      // Register the Contact noun so schema validation passes
      Noun('Contact', {
        name: 'string!',
        stage: 'Lead | Qualified | Customer',
        qualify: 'Qualified',
      })

      const created = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await executeVerb({ type: 'Contact', verb: 'qualify', entityId: created.$id, data: { stage: 'Qualified' } }, { provider, events: bridge })

      expect(result.$id).toBe(created.$id)
      expect(result.$type).toBe('Contact')
    })

    it('executeVerb emits lifecycle event to the event bridge', async () => {
      Noun('Contact', {
        name: 'string!',
        stage: 'Lead | Qualified | Customer',
        qualify: 'Qualified',
      })

      const created = await provider.create('Contact', { name: 'Bob', stage: 'Lead' })
      const handler = vi.fn()
      bridge.subscribe('Contact.qualify', handler)

      await executeVerb({ type: 'Contact', verb: 'qualify', entityId: created.$id, data: { stage: 'Qualified' } }, { provider, events: bridge })

      expect(handler).toHaveBeenCalledTimes(1)
      const event = handler.mock.calls[0][0]
      expect(event.$type).toBe('Contact.qualify')
      expect(event.entityId).toBe(created.$id)
      expect(event.verb).toBe('qualify')
    })

    it('custom verb changes entity state when data is provided', async () => {
      Noun('Deal', {
        title: 'string!',
        stage: 'Open | Won | Lost',
        close: 'Won',
      })

      const deal = await provider.create('Deal', { title: 'Big Deal', stage: 'Open' })

      const closed = await executeVerb({ type: 'Deal', verb: 'close', entityId: deal.$id, data: { stage: 'Won' } }, { provider, events: bridge })

      expect(closed.stage).toBe('Won')
    })

    it('CRUD update verb works through executeVerb', async () => {
      Noun('Contact', {
        name: 'string!',
        email: 'string?',
      })

      const created = await provider.create('Contact', { name: 'Carol' })

      const updated = await executeVerb(
        { type: 'Contact', verb: 'update', entityId: created.$id, data: { email: 'carol@example.com' } },
        { provider, events: bridge },
      )

      expect(updated.email).toBe('carol@example.com')
      expect(updated.name).toBe('Carol')
    })

    it('executeVerb returns the result from the provider', async () => {
      Noun('Contact', {
        name: 'string!',
        stage: 'Lead | Qualified',
        qualify: 'Qualified',
      })

      const created = await provider.create('Contact', { name: 'Dave', stage: 'Lead' })

      const result = await executeVerb({ type: 'Contact', verb: 'qualify', entityId: created.$id }, { provider })

      expect(result).toBeDefined()
      expect(result.$id).toBe(created.$id)
      expect(result.$type).toBe('Contact')
    })

    it('executeVerb on non-existent entity throws error', async () => {
      Noun('Contact', { name: 'string!' })

      await expect(executeVerb({ type: 'Contact', verb: 'update', entityId: 'contact_doesNotExist' }, { provider })).rejects.toThrow()
    })
  })

  // ===========================================================================
  // 4. DONounProvider — 5 tests
  // ===========================================================================
  describe('DONounProvider', () => {
    it('constructor accepts endpoint and creates instance', () => {
      const provider = new DONounProvider({ endpoint: 'https://db.headless.ly/~acme' })
      expect(provider).toBeInstanceOf(DONounProvider)
    })

    it('DOProviderError carries status and detail', () => {
      const err = new DOProviderError('create failed', 500, 'Internal Server Error')
      expect(err).toBeInstanceOf(Error)
      expect(err.name).toBe('DOProviderError')
      expect(err.message).toBe('create failed')
      expect(err.status).toBe(500)
      expect(err.detail).toBe('Internal Server Error')
    })

    it('DOProviderError works without detail', () => {
      const err = new DOProviderError('not found', 404)
      expect(err.status).toBe(404)
      expect(err.detail).toBeUndefined()
    })

    describe('with doFetch (legacy mode)', () => {
      it('create sends POST with entity data to collection endpoint', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 201,
          json: async () => ({
            data: {
              $id: 'contact_abc',
              $type: 'Contact',
              $context: 'https://headless.ly/~acme',
              $version: 1,
              $createdAt: '2025-01-01T00:00:00Z',
              $updatedAt: '2025-01-01T00:00:00Z',
              name: 'Alice',
            },
          }),
        })

        const provider = new DONounProvider({
          endpoint: 'https://db.headless.ly/~acme',
          doFetch: mockFetch,
        })

        const entity = await provider.create('Contact', { name: 'Alice' })

        expect(mockFetch).toHaveBeenCalledTimes(1)
        const [path, init] = mockFetch.mock.calls[0]
        expect(path).toBe('/contacts')
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body)).toEqual({ name: 'Alice' })
        expect(entity.$id).toBe('contact_abc')
        expect(entity.name).toBe('Alice')
      })

      it('fetch errors are wrapped in DOProviderError', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ error: 'server error' }),
        })

        const provider = new DONounProvider({
          endpoint: 'https://db.headless.ly/~acme',
          doFetch: mockFetch,
        })

        await expect(provider.create('Contact', { name: 'Fail' })).rejects.toThrow(DOProviderError)
      })
    })
  })

  // ===========================================================================
  // 5. ID Generation — extended tests (3 tests)
  // ===========================================================================
  describe('ID Generation — extended', () => {
    it('generateEntityId creates IDs matching {type}_{sqid} pattern', () => {
      const types = ['Contact', 'Deal', 'Subscription', 'FeatureFlag']
      for (const type of types) {
        const id = generateEntityId(type)
        const prefix = type.toLowerCase()
        expect(id).toMatch(new RegExp(`^${prefix}_[a-zA-Z0-9]{8}$`))
      }
    })

    it('generateEventId creates IDs matching evt_{sqid} pattern with 12-char suffix', () => {
      const id = generateEventId()
      expect(id).toMatch(/^evt_[a-zA-Z0-9]{12}$/)
    })

    it('generated IDs are unique across many calls', () => {
      const entityIds = new Set<string>()
      const eventIds = new Set<string>()
      for (let i = 0; i < 200; i++) {
        entityIds.add(generateEntityId('Contact'))
        eventIds.add(generateEventId())
      }
      expect(entityIds.size).toBe(200)
      expect(eventIds.size).toBe(200)
    })
  })

  // ===========================================================================
  // 6. LocalNounProvider with Event Bridge integration — 3 tests
  // ===========================================================================
  describe('LocalNounProvider — event integration', () => {
    let provider: LocalNounProvider
    let bridge: EventEmitter

    beforeEach(() => {
      clearRegistry()
      bridge = createEventBridge()
      provider = new LocalNounProvider({
        context: 'https://headless.ly/~events',
        events: bridge,
      })
    })

    it('create emits a Contact.create event to the bridge', async () => {
      const handler = vi.fn()
      bridge.subscribe('Contact.create', handler)

      await provider.create('Contact', { name: 'Alice' })

      expect(handler).toHaveBeenCalledTimes(1)
      const event = handler.mock.calls[0][0]
      expect(event.$type).toBe('Contact.create')
      expect(event.entityType).toBe('Contact')
      expect(event.verb).toBe('create')
    })

    it('update emits a Contact.update event to the bridge', async () => {
      const handler = vi.fn()
      bridge.subscribe('Contact.update', handler)

      const created = await provider.create('Contact', { name: 'Alice' })
      await provider.update('Contact', created.$id, { name: 'Alice Smith' })

      expect(handler).toHaveBeenCalledTimes(1)
      const event = handler.mock.calls[0][0]
      expect(event.$type).toBe('Contact.update')
      expect(event.entityId).toBe(created.$id)
    })

    it('delete emits a Contact.delete event to the bridge', async () => {
      const handler = vi.fn()
      bridge.subscribe('Contact.delete', handler)

      const created = await provider.create('Contact', { name: 'Alice' })
      await provider.delete('Contact', created.$id)

      expect(handler).toHaveBeenCalledTimes(1)
      const event = handler.mock.calls[0][0]
      expect(event.$type).toBe('Contact.delete')
      expect(event.entityId).toBe(created.$id)
    })
  })

  // ===========================================================================
  // 7. LocalNounProvider — perform (custom verbs) — 2 tests
  // ===========================================================================
  describe('LocalNounProvider — perform', () => {
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({ context: 'https://headless.ly/~perform' })
    })

    it('perform applies data and increments version', async () => {
      const created = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await provider.perform('Contact', 'qualify', created.$id, { stage: 'Qualified' })
      expect(result.stage).toBe('Qualified')
      expect(result.$version).toBe(2)
    })

    it('perform on non-existent entity throws', async () => {
      await expect(provider.perform('Contact', 'qualify', 'contact_ghost')).rejects.toThrow('Contact not found: contact_ghost')
    })
  })

  // ===========================================================================
  // 8. Event Bridge — pattern "*.verb" matching — 1 test
  // ===========================================================================
  describe('Event Bridge — verb wildcard pattern', () => {
    it('"*.created" matches all created events across entity types', async () => {
      const bridge = createEventBridge()
      const handler = vi.fn()
      bridge.subscribe('*.created', handler)

      await bridge.emit({
        $id: 'evt_vw1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_vw1',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })
      await bridge.emit({
        $id: 'evt_vw2',
        $type: 'Deal.created',
        entityType: 'Deal',
        entityId: 'deal_vw1',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })
      await bridge.emit({
        $id: 'evt_vw3',
        $type: 'Deal.closed',
        entityType: 'Deal',
        entityId: 'deal_vw2',
        verb: 'closed',
        timestamp: new Date().toISOString(),
      })

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  // ===========================================================================
  // RED ZONE — Tests that FAIL because implementation needs extending
  // ===========================================================================

  // ---------------------------------------------------------------------------
  // 9. LocalNounProvider — missing methods (RED) — 3 tests
  // ---------------------------------------------------------------------------
  describe('LocalNounProvider — count and findOne (RED)', () => {
    let provider: LocalNounProvider

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({ context: 'https://headless.ly/~red' })
    })

    it('count() returns the number of entities of a given type', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Contact', { name: 'Bob' })
      await provider.create('Deal', { title: 'Deal 1', value: 100 })

      // count() does not exist yet — needs implementation
      const count = await (provider as any).count('Contact')
      expect(count).toBe(2)
    })

    it('findOne() returns the first matching entity', async () => {
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Qualified' })

      // findOne() does not exist yet — needs implementation
      const lead = await (provider as any).findOne('Contact', { stage: 'Lead' })
      expect(lead).toBeDefined()
      expect(lead.name).toBe('Alice')
    })

    it('findOne() returns null when no entity matches', async () => {
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await (provider as any).findOne('Contact', { stage: 'Churned' })
      expect(result).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // 10. Event Bridge — clear/reset (RED) — 2 tests
  // ---------------------------------------------------------------------------
  describe('Event Bridge — clear (RED)', () => {
    it('clear() removes all stored events from query history', async () => {
      const bridge = createEventBridge()

      await bridge.emit({
        $id: 'evt_clr1',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_clr1',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })

      const before = await bridge.query({})
      expect(before).toHaveLength(1)

      // clear() does not exist yet — needs implementation
      ;(bridge as any).clear()

      const after = await bridge.query({})
      expect(after).toHaveLength(0)
    })

    it('clear() does not remove subscribers', async () => {
      const bridge = createEventBridge()
      const handler = vi.fn()
      bridge.subscribe('Contact.*', handler)
      ;(bridge as any).clear()

      await bridge.emit({
        $id: 'evt_clr2',
        $type: 'Contact.created',
        entityType: 'Contact',
        entityId: 'contact_clr2',
        verb: 'created',
        timestamp: new Date().toISOString(),
      })

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // 11. Verb Executor — BEFORE/AFTER hooks (RED) — 3 tests
  // ---------------------------------------------------------------------------
  describe('Verb Executor — hooks (RED)', () => {
    let provider: LocalNounProvider
    let bridge: EventEmitter

    beforeEach(() => {
      clearRegistry()
      provider = new LocalNounProvider({ context: 'https://headless.ly/~hooks' })
      bridge = createEventBridge()
    })

    it('executeVerb emits "qualifying" BEFORE event and "qualified" AFTER event', async () => {
      Noun('Contact', {
        name: 'string!',
        stage: 'Lead | Qualified | Customer',
        qualify: 'Qualified',
      })

      const created = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const beforeHandler = vi.fn()
      const afterHandler = vi.fn()
      bridge.subscribe('Contact.qualifying', beforeHandler)
      bridge.subscribe('Contact.qualified', afterHandler)

      await executeVerb({ type: 'Contact', verb: 'qualify', entityId: created.$id, data: { stage: 'Qualified' } }, { provider, events: bridge })

      // Currently executeVerb only emits Contact.qualify, not Contact.qualifying/qualified
      expect(beforeHandler).toHaveBeenCalledTimes(1)
      expect(afterHandler).toHaveBeenCalledTimes(1)
    })

    it('BEFORE hook can reject the verb by throwing', async () => {
      Noun('Deal', {
        title: 'string!',
        stage: 'Open | Won | Lost',
        close: 'Won',
      })

      const deal = await provider.create('Deal', { title: 'Risky Deal', stage: 'Open' })

      // Register a BEFORE hook that rejects
      bridge.subscribe('Deal.closing', () => {
        throw new Error('Deal cannot be closed without approval')
      })

      // executeVerb should propagate the BEFORE hook rejection
      await expect(executeVerb({ type: 'Deal', verb: 'close', entityId: deal.$id, data: { stage: 'Won' } }, { provider, events: bridge })).rejects.toThrow(
        'Deal cannot be closed without approval',
      )
    })

    it('executeVerb fires BEFORE event before provider.perform and AFTER event after', async () => {
      Noun('Contact', {
        name: 'string!',
        stage: 'Lead | Qualified',
        qualify: 'Qualified',
      })

      const created = await provider.create('Contact', { name: 'Eve', stage: 'Lead' })
      const callOrder: string[] = []

      bridge.subscribe('Contact.qualifying', () => {
        callOrder.push('before')
      })
      bridge.subscribe('Contact.qualified', () => {
        callOrder.push('after')
      })

      await executeVerb({ type: 'Contact', verb: 'qualify', entityId: created.$id, data: { stage: 'Qualified' } }, { provider, events: bridge })

      expect(callOrder).toEqual(['before', 'after'])
    })
  })

  // ---------------------------------------------------------------------------
  // 12. Verb Executor — disabled verb validation (RED) — 1 test
  // ---------------------------------------------------------------------------
  describe('Verb Executor — disabled verb (RED)', () => {
    it('executeVerb throws when verb is explicitly disabled on the noun', async () => {
      clearRegistry()
      const provider = new LocalNounProvider({ context: 'https://headless.ly/~disabled' })

      // Define an immutable entity — update is disabled
      Noun('Ledger', {
        amount: 'string!',
        update: null, // explicitly disabled
      })

      const entry = await provider.create('Ledger', { amount: '100.00' })

      await expect(executeVerb({ type: 'Ledger', verb: 'update', entityId: entry.$id, data: { amount: '200.00' } }, { provider })).rejects.toThrow(/disabled/)
    })
  })

  // ---------------------------------------------------------------------------
  // 13. DONounProvider — doFetch with auth headers (RED) — 2 tests
  // ---------------------------------------------------------------------------
  describe('DONounProvider — auth and advanced doFetch (RED)', () => {
    it('get sends GET to collection/:id endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            $id: 'contact_xyz',
            $type: 'Contact',
            $context: 'https://headless.ly/~acme',
            $version: 1,
            $createdAt: '2025-01-01T00:00:00Z',
            $updatedAt: '2025-01-01T00:00:00Z',
            name: 'Alice',
          },
        }),
      })

      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~acme',
        doFetch: mockFetch,
      })

      const entity = await provider.get('Contact', 'contact_xyz')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [path, init] = mockFetch.mock.calls[0]
      expect(path).toBe('/contacts/contact_xyz')
      expect(init.method).toBe('GET')
      expect(entity).not.toBeNull()
      expect(entity!.$id).toBe('contact_xyz')
    })

    it('doFetch includes Authorization header when apiKey is provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      })

      const provider = new DONounProvider({
        endpoint: 'https://db.headless.ly/~acme',
        doFetch: mockFetch,
        apiKey: 'sk_test_secret123',
      })

      await provider.find('Contact')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [, init] = mockFetch.mock.calls[0]
      // Currently doFetch legacy path uses X-Context but does NOT pass Authorization
      expect(init.headers['Authorization']).toBe('Bearer sk_test_secret123')
    })
  })
})
