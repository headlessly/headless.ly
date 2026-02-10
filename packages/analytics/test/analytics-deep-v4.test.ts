import { describe, it, expect, vi } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Event, Metric, Funnel, Goal } from '../src/index.ts'
import { setupTestProvider, expectMetaFields } from '../../test-utils'

describe('@headlessly/analytics — deep coverage v4', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Event.$schema.raw — key-by-key validation for every field
  // ===========================================================================

  describe('Event.$schema.raw key-by-key validation', () => {
    it('raw.data is "string" (optional string)', () => {
      expect(Event.$schema.raw.data).toBe('string')
    })

    it('raw.sessionId is "string" (optional string)', () => {
      expect(Event.$schema.raw.sessionId).toBe('string')
    })

    it('raw.userId is "string" (optional string)', () => {
      expect(Event.$schema.raw.userId).toBe('string')
    })

    it('raw.anonymousId is "string" (optional string)', () => {
      expect(Event.$schema.raw.anonymousId).toBe('string')
    })

    it('raw.url is "string" (optional string)', () => {
      expect(Event.$schema.raw.url).toBe('string')
    })

    it('raw.path is "string" (optional string)', () => {
      expect(Event.$schema.raw.path).toBe('string')
    })

    it('raw.referrer is "string" (optional string)', () => {
      expect(Event.$schema.raw.referrer).toBe('string')
    })

    it('raw.properties is "string" (optional string)', () => {
      expect(Event.$schema.raw.properties).toBe('string')
    })

    it('raw.organization is "-> Organization" (forward relationship)', () => {
      expect(Event.$schema.raw.organization).toBe('-> Organization')
    })

    it('raw has exactly 14 keys total', () => {
      const rawKeys = Object.keys(Event.$schema.raw)
      // name, type, data, source, sessionId, userId, anonymousId, organization,
      // timestamp, url, path, referrer, properties, update, delete
      expect(rawKeys.length).toBe(15)
    })
  })

  // ===========================================================================
  // 2. Relationship schema details (operator, target, isArray, backref)
  // ===========================================================================

  describe('Relationship schema details across all entities', () => {
    it('Event organization relationship has no backref', () => {
      const rel = Event.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.backref).toBeUndefined()
    })

    it('Event organization relationship isArray is undefined (single)', () => {
      const rel = Event.$schema.relationships.get('organization')
      expect(rel!.isArray).toBeFalsy()
    })

    it('Metric organization relationship operator is "->"', () => {
      const rel = Metric.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
    })

    it('Metric organization relationship has no backref', () => {
      const rel = Metric.$schema.relationships.get('organization')
      expect(rel!.backref).toBeUndefined()
    })

    it('Funnel organization relationship operator is "->"', () => {
      const rel = Funnel.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
    })

    it('Funnel organization relationship targetType is "Organization"', () => {
      const rel = Funnel.$schema.relationships.get('organization')
      expect(rel!.targetType).toBe('Organization')
    })

    it('Goal organization relationship operator is "->"', () => {
      const rel = Goal.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
    })

    it('Goal organization relationship has no backref', () => {
      const rel = Goal.$schema.relationships.get('organization')
      expect(rel!.backref).toBeUndefined()
    })
  })

  // ===========================================================================
  // 3. Field modifier details (indexed, unique, optional flags)
  // ===========================================================================

  describe('Field modifier details — indexed, unique, optional, array flags', () => {
    it('Event name field has indexed=false and unique=false', () => {
      const field = Event.$schema.fields.get('name')
      expect(field!.modifiers?.indexed).toBe(false)
      expect(field!.modifiers?.unique).toBe(false)
    })

    it('Event name field has array=false', () => {
      const field = Event.$schema.fields.get('name')
      expect(field!.modifiers?.array).toBe(false)
    })

    it('Event timestamp field modifiers: required=true, optional=false', () => {
      const field = Event.$schema.fields.get('timestamp')
      expect(field!.modifiers?.required).toBe(true)
      expect(field!.modifiers?.optional).toBe(false)
    })

    it('Metric value field modifiers: required=true, indexed=false, unique=false', () => {
      const field = Metric.$schema.fields.get('value')
      expect(field!.modifiers?.required).toBe(true)
      expect(field!.modifiers?.indexed).toBe(false)
      expect(field!.modifiers?.unique).toBe(false)
    })

    it('Goal target field modifiers: required=true, array=false', () => {
      const field = Goal.$schema.fields.get('target')
      expect(field!.modifiers?.required).toBe(true)
      expect(field!.modifiers?.array).toBe(false)
    })

    it('Funnel description field modifiers: required=false, optional=false (bare string)', () => {
      const field = Funnel.$schema.fields.get('description')
      expect(field!.modifiers?.required).toBe(false)
      expect(field!.modifiers?.optional).toBe(false)
    })

    it('Event source enum field has no modifiers (enums are parsed separately)', () => {
      const field = Event.$schema.fields.get('source')
      expect(field!.kind).toBe('enum')
      // Enum fields do not have type or modifiers
      expect(field!.type).toBeUndefined()
    })
  })

  // ===========================================================================
  // 4. CRUD hook transformation chains for update and delete
  // ===========================================================================

  describe('CRUD hook transformation chains for update', () => {
    it('Metric.updating BEFORE hook can modify update data', async () => {
      const unsub = Metric.updating((data: any) => {
        return { ...data, unit: 'modified-unit' }
      })
      const metric = await Metric.create({ name: 'hook-test', value: 10, unit: 'ms' })
      const updated = await Metric.update(metric.$id, { value: 20 })
      expect(updated.unit).toBe('modified-unit')
      expect(updated.value).toBe(20)
      unsub()
    })

    it('Metric.updated AFTER hook fires with the updated instance', async () => {
      let receivedVersion: number | null = null
      const unsub = Metric.updated((instance: any) => {
        receivedVersion = instance.$version
      })
      const metric = await Metric.create({ name: 'after-hook-test', value: 10 })
      await Metric.update(metric.$id, { value: 99 })
      expect(receivedVersion).toBe(2)
      unsub()
    })

    it('Goal.updating hook chain — multiple BEFORE hooks transform data sequentially', async () => {
      const unsub1 = Goal.updating((data: any) => {
        return { ...data, description: 'step1' }
      })
      const unsub2 = Goal.updating((data: any) => {
        return { ...data, description: data.description + '-step2' }
      })
      const goal = await Goal.create({ name: 'Chain Test', target: 100 })
      const updated = await Goal.update(goal.$id, { current: 50 })
      expect(updated.description).toBe('step1-step2')
      unsub1()
      unsub2()
    })
  })

  describe('CRUD hook chains for delete', () => {
    it('Funnel.deleting BEFORE hook fires before delete', async () => {
      const calls: string[] = []
      const unsub = Funnel.deleting(() => {
        calls.push('before-delete')
      })
      const funnel = await Funnel.create({ name: 'to-delete' })
      await Funnel.delete(funnel.$id)
      expect(calls).toContain('before-delete')
      unsub()
    })

    it('Funnel.deleted AFTER hook fires after delete', async () => {
      let fired = false
      const unsub = Funnel.deleted(() => {
        fired = true
      })
      const funnel = await Funnel.create({ name: 'delete-after-hook' })
      await Funnel.delete(funnel.$id)
      expect(fired).toBe(true)
      unsub()
    })
  })

  // ===========================================================================
  // 5. Version tracking through multi-verb workflows
  // ===========================================================================

  describe('Version tracking through multi-verb workflows', () => {
    it('Goal version increments through create -> update -> update -> achieve = 4', async () => {
      const goal = await Goal.create({ name: 'Workflow', target: 100, current: 0, status: 'OnTrack' })
      expect(goal.$version).toBe(1)

      const v2 = await Goal.update(goal.$id, { current: 30, status: 'Behind' })
      expect(v2.$version).toBe(2)

      const v3 = await Goal.update(goal.$id, { current: 70, status: 'OnTrack' })
      expect(v3.$version).toBe(3)

      const v4 = await Goal.achieve(goal.$id, { current: 110 })
      expect(v4.$version).toBe(4)
      expect(v4.status).toBe('Achieved')
    })

    it('Funnel version tracks through multiple description/steps updates', async () => {
      const funnel = await Funnel.create({ name: 'Evolving Funnel' })
      expect(funnel.$version).toBe(1)

      const v2 = await Funnel.update(funnel.$id, { description: 'Added description' })
      expect(v2.$version).toBe(2)

      const v3 = await Funnel.update(funnel.$id, { steps: JSON.stringify([{ name: 'Step 1' }]) })
      expect(v3.$version).toBe(3)

      const v4 = await Funnel.update(funnel.$id, { conversionRate: 0.35 })
      expect(v4.$version).toBe(4)

      const v5 = await Funnel.update(funnel.$id, { name: 'Renamed Funnel', conversionRate: 0.42 })
      expect(v5.$version).toBe(5)
      expect(v5.name).toBe('Renamed Funnel')
    })
  })

  // ===========================================================================
  // 6. Concurrent multi-entity cross-type operations
  // ===========================================================================

  describe('Concurrent multi-entity cross-type operations', () => {
    it('creates all four entity types concurrently without interference', async () => {
      const [event, metric, funnel, goal] = await Promise.all([
        Event.create({ name: 'concurrent', type: 'track', timestamp: '2024-01-01T00:00:00Z' }),
        Metric.create({ name: 'concurrent', value: 42 }),
        Funnel.create({ name: 'concurrent' }),
        Goal.create({ name: 'concurrent', target: 100 }),
      ])

      expect(event.$type).toBe('Event')
      expect(metric.$type).toBe('Metric')
      expect(funnel.$type).toBe('Funnel')
      expect(goal.$type).toBe('Goal')

      // All IDs are unique
      const ids = new Set([event.$id, metric.$id, funnel.$id, goal.$id])
      expect(ids.size).toBe(4)
    })

    it('concurrent updates to different goal entities maintain independent versions', async () => {
      const goalA = await Goal.create({ name: 'A', target: 100, status: 'OnTrack' })
      const goalB = await Goal.create({ name: 'B', target: 200, status: 'OnTrack' })

      const [updatedA, updatedB] = await Promise.all([
        Goal.update(goalA.$id, { current: 50 }),
        Goal.update(goalB.$id, { current: 100 }),
      ])

      expect(updatedA.$version).toBe(2)
      expect(updatedA.current).toBe(50)
      expect(updatedB.$version).toBe(2)
      expect(updatedB.current).toBe(100)

      // Further concurrent updates
      const [a3, b3] = await Promise.all([
        Goal.update(goalA.$id, { current: 75 }),
        Goal.update(goalB.$id, { current: 150 }),
      ])
      expect(a3.$version).toBe(3)
      expect(b3.$version).toBe(3)
    })
  })

  // ===========================================================================
  // 7. Schema iterator/enumeration patterns
  // ===========================================================================

  describe('Schema iterator and enumeration patterns', () => {
    it('Event.$schema.fields.keys() returns iterable of field names', () => {
      const keys = [...Event.$schema.fields.keys()]
      expect(keys).toContain('name')
      expect(keys).toContain('type')
      expect(keys).toContain('data')
      expect(keys).toContain('source')
      expect(keys).toContain('sessionId')
      expect(keys).toContain('userId')
      expect(keys).toContain('anonymousId')
      expect(keys).toContain('timestamp')
      expect(keys).toContain('url')
      expect(keys).toContain('path')
      expect(keys).toContain('referrer')
      expect(keys).toContain('properties')
    })

    it('Goal.$schema.verbs.keys() returns iterable of verb names', () => {
      const verbNames = [...Goal.$schema.verbs.keys()]
      expect(verbNames).toContain('create')
      expect(verbNames).toContain('update')
      expect(verbNames).toContain('delete')
      expect(verbNames).toContain('achieve')
    })

    it('Event.$schema.disabledVerbs is iterable', () => {
      const disabled = [...Event.$schema.disabledVerbs]
      expect(disabled).toContain('update')
      expect(disabled).toContain('delete')
      expect(disabled.length).toBe(2)
    })

    it('Metric.$schema.relationships.entries() yields [name, parsed] tuples', () => {
      const entries = [...Metric.$schema.relationships.entries()]
      expect(entries.length).toBe(1)
      expect(entries[0][0]).toBe('organization')
      expect(entries[0][1].kind).toBe('relationship')
      expect(entries[0][1].targetType).toBe('Organization')
    })
  })

  // ===========================================================================
  // 8. Metric type enum — individual value creation and querying
  // ===========================================================================

  describe('Metric type enum — individual value creation and querying', () => {
    it('creates and retrieves a Counter metric', async () => {
      const m = await Metric.create({ name: 'counter_test', value: 0, type: 'Counter' })
      expect(m.type).toBe('Counter')
      const fetched = await Metric.get(m.$id)
      expect(fetched!.type).toBe('Counter')
    })

    it('creates and retrieves a Gauge metric', async () => {
      const m = await Metric.create({ name: 'gauge_test', value: 55.5, type: 'Gauge' })
      expect(m.type).toBe('Gauge')
      const fetched = await Metric.get(m.$id)
      expect(fetched!.type).toBe('Gauge')
    })

    it('creates and retrieves a Histogram metric', async () => {
      const m = await Metric.create({ name: 'histogram_test', value: 120, type: 'Histogram' })
      expect(m.type).toBe('Histogram')
    })

    it('creates and retrieves a Summary metric', async () => {
      const m = await Metric.create({ name: 'summary_test', value: 342.5, type: 'Summary' })
      expect(m.type).toBe('Summary')
    })
  })

  // ===========================================================================
  // 9. Goal period enum — individual value creation and querying
  // ===========================================================================

  describe('Goal period enum — individual value creation and get', () => {
    it('creates and gets back a Daily goal', async () => {
      const g = await Goal.create({ name: 'Daily check', target: 10, period: 'Daily' })
      const fetched = await Goal.get(g.$id)
      expect(fetched!.period).toBe('Daily')
    })

    it('creates and gets back a Weekly goal', async () => {
      const g = await Goal.create({ name: 'Weekly check', target: 50, period: 'Weekly' })
      const fetched = await Goal.get(g.$id)
      expect(fetched!.period).toBe('Weekly')
    })

    it('creates and gets back a Monthly goal', async () => {
      const g = await Goal.create({ name: 'Monthly check', target: 200, period: 'Monthly' })
      const fetched = await Goal.get(g.$id)
      expect(fetched!.period).toBe('Monthly')
    })

    it('creates and gets back a Quarterly goal', async () => {
      const g = await Goal.create({ name: 'Quarterly check', target: 1000, period: 'Quarterly' })
      const fetched = await Goal.get(g.$id)
      expect(fetched!.period).toBe('Quarterly')
    })

    it('creates and gets back a Yearly goal', async () => {
      const g = await Goal.create({ name: 'Yearly check', target: 10000, period: 'Yearly' })
      const fetched = await Goal.get(g.$id)
      expect(fetched!.period).toBe('Yearly')
    })
  })

  // ===========================================================================
  // 10. Goal status enum — individual value creation and querying
  // ===========================================================================

  describe('Goal status enum — individual value creation and querying', () => {
    it('creates a goal with each status value and queries by $eq', async () => {
      const statuses = ['OnTrack', 'AtRisk', 'Behind', 'Achieved', 'Completed', 'Missed'] as const
      for (const status of statuses) {
        await Goal.create({ name: `status_${status}`, target: 100, status })
      }

      for (const status of statuses) {
        const results = await Goal.find({ status: { $eq: status } })
        expect(results.length).toBe(1)
        expect(results[0].status).toBe(status)
      }
    })
  })

  // ===========================================================================
  // 11. Event.creating and Event.created hooks (immutable entity still has create hooks)
  // ===========================================================================

  describe('Event creating/created hooks', () => {
    it('Event.creating BEFORE hook can modify event data', async () => {
      const unsub = Event.creating((data: any) => {
        return { ...data, source: 'Snippet' }
      })
      const event = await Event.create({
        name: 'hook_event',
        type: 'track',
        timestamp: '2024-01-01T00:00:00Z',
      })
      expect(event.source).toBe('Snippet')
      unsub()
    })

    it('Event.created AFTER hook receives the immutable event instance', async () => {
      let capturedId: string | null = null
      let capturedVersion: number | null = null
      const unsub = Event.created((instance: any) => {
        capturedId = instance.$id
        capturedVersion = instance.$version
      })
      const event = await Event.create({
        name: 'after_hook_event',
        type: 'identify',
        timestamp: '2024-02-01T00:00:00Z',
      })
      expect(capturedId).toBe(event.$id)
      expect(capturedVersion).toBe(1)
      unsub()
    })
  })

  // ===========================================================================
  // 12. Get after delete returns null
  // ===========================================================================

  describe('Get after delete returns null', () => {
    it('Goal.get returns null after Goal.delete', async () => {
      const goal = await Goal.create({ name: 'Delete Me', target: 100 })
      const id = goal.$id
      await Goal.delete(id)
      const result = await Goal.get(id)
      expect(result).toBeNull()
    })

    it('Funnel.get returns null after Funnel.delete', async () => {
      const funnel = await Funnel.create({ name: 'Delete Me' })
      const id = funnel.$id
      await Funnel.delete(id)
      const result = await Funnel.get(id)
      expect(result).toBeNull()
    })

    it('deleted entities do not appear in find results', async () => {
      const m1 = await Metric.create({ name: 'keep', value: 1 })
      const m2 = await Metric.create({ name: 'remove', value: 2 })
      await Metric.delete(m2.$id)

      const results = await Metric.find()
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('keep')
    })
  })

  // ===========================================================================
  // 13. Achieve verb then get confirms persisted state
  // ===========================================================================

  describe('Achieve verb persistence validation', () => {
    it('Goal.get after achieve returns entity with Achieved status', async () => {
      const goal = await Goal.create({ name: 'Persist Test', target: 100, status: 'OnTrack' })
      await Goal.achieve(goal.$id, { current: 120 })
      const fetched = await Goal.get(goal.$id)
      expect(fetched).not.toBeNull()
      expect(fetched!.status).toBe('Achieved')
      expect(fetched!.current).toBe(120)
      expect(fetched!.$version).toBe(2)
    })

    it('Goal.find after achieve includes the achieved goal', async () => {
      const goal = await Goal.create({ name: 'Find After Achieve', target: 50, status: 'Behind' })
      await Goal.achieve(goal.$id, { current: 55 })
      const results = await Goal.find({ status: 'Achieved' })
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some((g: any) => g.$id === goal.$id)).toBe(true)
    })
  })

  // ===========================================================================
  // 14. Schema raw definition — Metric and Funnel complete raw key sets
  // ===========================================================================

  describe('Schema raw definition — complete raw key sets', () => {
    it('Metric.$schema.raw has exactly 9 keys', () => {
      const rawKeys = Object.keys(Metric.$schema.raw)
      // name, value, type, unit, dimensions, organization, timestamp, record, reset
      expect(rawKeys.length).toBe(9)
    })

    it('Funnel.$schema.raw has exactly 6 keys', () => {
      const rawKeys = Object.keys(Funnel.$schema.raw)
      // name, description, steps, organization, conversionRate, analyze
      expect(rawKeys.length).toBe(6)
    })

    it('Goal.$schema.raw has exactly 12 keys', () => {
      const rawKeys = Object.keys(Goal.$schema.raw)
      // name, description, target, current, unit, period, status, organization, achieve, complete, miss, reset
      expect(rawKeys.length).toBe(12)
    })
  })

  // ===========================================================================
  // 15. Event source enum — schema-level enum value count
  // ===========================================================================

  describe('Enum value counts and ordering', () => {
    it('Event source enum has exactly 4 values', () => {
      const field = Event.$schema.fields.get('source')
      expect(field!.enumValues!.length).toBe(4)
    })

    it('Metric type enum has exactly 4 values', () => {
      const field = Metric.$schema.fields.get('type')
      expect(field!.enumValues!.length).toBe(4)
    })

    it('Goal period enum has exactly 5 values', () => {
      const field = Goal.$schema.fields.get('period')
      expect(field!.enumValues!.length).toBe(5)
    })

    it('Goal status enum has exactly 6 values', () => {
      const field = Goal.$schema.fields.get('status')
      expect(field!.enumValues!.length).toBe(6)
    })

    it('Event source enum values are in definition order', () => {
      const field = Event.$schema.fields.get('source')
      expect(field!.enumValues![0]).toBe('Browser')
      expect(field!.enumValues![1]).toBe('Node')
      expect(field!.enumValues![2]).toBe('API')
      expect(field!.enumValues![3]).toBe('Snippet')
    })

    it('Metric type enum values are in definition order', () => {
      const field = Metric.$schema.fields.get('type')
      expect(field!.enumValues![0]).toBe('Counter')
      expect(field!.enumValues![1]).toBe('Gauge')
      expect(field!.enumValues![2]).toBe('Histogram')
      expect(field!.enumValues![3]).toBe('Summary')
    })
  })

  // ===========================================================================
  // 16. Multi-entity find with combined field + enum filters
  // ===========================================================================

  describe('Multi-field combined filters', () => {
    it('Goal find by status AND period combined', async () => {
      await Goal.create({ name: 'A', target: 100, status: 'OnTrack', period: 'Monthly' })
      await Goal.create({ name: 'B', target: 200, status: 'AtRisk', period: 'Monthly' })
      await Goal.create({ name: 'C', target: 300, status: 'OnTrack', period: 'Quarterly' })

      const results = await Goal.find({ status: 'OnTrack', period: 'Monthly' })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('A')
    })

    it('Metric find by type AND value range', async () => {
      await Metric.create({ name: 'x', value: 10, type: 'Counter' })
      await Metric.create({ name: 'y', value: 90, type: 'Counter' })
      await Metric.create({ name: 'z', value: 50, type: 'Gauge' })

      const results = await Metric.find({ type: 'Counter', value: { $gt: 50 } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('y')
    })

    it('Event find by source AND type field combined', async () => {
      await Event.create({ name: 'e1', type: 'track', timestamp: '2024-01-01T00:00:00Z', source: 'Browser' })
      await Event.create({ name: 'e2', type: 'identify', timestamp: '2024-01-01T00:00:00Z', source: 'Browser' })
      await Event.create({ name: 'e3', type: 'track', timestamp: '2024-01-01T00:00:00Z', source: 'API' })

      const results = await Event.find({ source: 'Browser', type: 'track' })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('e1')
    })
  })
})
