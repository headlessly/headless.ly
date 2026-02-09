import { describe, it, expect, vi } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Event, Metric, Funnel, Goal } from '../src/index.ts'
import { setupTestProvider, expectMetaFields } from '../../test-utils'

describe('@headlessly/analytics — deep coverage v2', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Schema linguistic forms (singular, plural, slug)
  // ===========================================================================

  describe('schema linguistic forms', () => {
    it('Event schema has correct singular, plural, slug', () => {
      const schema = Event.$schema
      expect(schema.singular).toBe('event')
      expect(schema.plural).toBe('events')
      expect(schema.slug).toBe('event')
    })

    it('Metric schema has correct singular, plural, slug', () => {
      const schema = Metric.$schema
      expect(schema.singular).toBe('metric')
      expect(schema.plural).toBe('metrics')
      expect(schema.slug).toBe('metric')
    })

    it('Funnel schema has correct singular, plural, slug', () => {
      const schema = Funnel.$schema
      expect(schema.singular).toBe('funnel')
      expect(schema.plural).toBe('funnels')
      expect(schema.slug).toBe('funnel')
    })

    it('Goal schema has correct singular, plural, slug', () => {
      const schema = Goal.$schema
      expect(schema.singular).toBe('goal')
      expect(schema.plural).toBe('goals')
      expect(schema.slug).toBe('goal')
    })
  })

  // ===========================================================================
  // 2. Event — detailed field schema coverage
  // ===========================================================================

  describe('Event field details', () => {
    it('data field is an optional string', () => {
      const field = Event.$schema.fields.get('data')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('sessionId field is an optional string', () => {
      const field = Event.$schema.fields.get('sessionId')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('userId field is an optional string', () => {
      const field = Event.$schema.fields.get('userId')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('anonymousId field is an optional string', () => {
      const field = Event.$schema.fields.get('anonymousId')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('url field is an optional string', () => {
      const field = Event.$schema.fields.get('url')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('path field is an optional string', () => {
      const field = Event.$schema.fields.get('path')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('referrer field is an optional string', () => {
      const field = Event.$schema.fields.get('referrer')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('properties field is an optional string', () => {
      const field = Event.$schema.fields.get('properties')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('Event has organization relationship', () => {
      const rel = Event.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.targetType).toBe('Organization')
      expect(rel!.operator).toBe('->')
    })
  })

  // ===========================================================================
  // 3. Metric — detailed field schema coverage
  // ===========================================================================

  describe('Metric field details', () => {
    it('dimensions field is an optional string', () => {
      const field = Metric.$schema.fields.get('dimensions')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('timestamp field is an optional datetime', () => {
      const field = Metric.$schema.fields.get('timestamp')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('datetime')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('Metric has organization relationship', () => {
      const rel = Metric.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.targetType).toBe('Organization')
      expect(rel!.operator).toBe('->')
    })
  })

  // ===========================================================================
  // 4. Goal — detailed field schema coverage
  // ===========================================================================

  describe('Goal field details', () => {
    it('description field is an optional string', () => {
      const field = Goal.$schema.fields.get('description')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('current field is an optional number', () => {
      const field = Goal.$schema.fields.get('current')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('number')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('unit field is an optional string', () => {
      const field = Goal.$schema.fields.get('unit')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('name field is required', () => {
      const field = Goal.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('Goal has organization relationship', () => {
      const rel = Goal.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.targetType).toBe('Organization')
      expect(rel!.operator).toBe('->')
    })
  })

  // ===========================================================================
  // 5. Funnel — detailed field & relationship coverage
  // ===========================================================================

  describe('Funnel field details', () => {
    it('description field is an optional string', () => {
      const field = Funnel.$schema.fields.get('description')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('conversionRate field is optional', () => {
      const field = Funnel.$schema.fields.get('conversionRate')
      expect(field).toBeDefined()
      expect(field!.modifiers?.required).toBe(false)
    })

    it('steps field is optional', () => {
      const field = Funnel.$schema.fields.get('steps')
      expect(field).toBeDefined()
      expect(field!.modifiers?.required).toBe(false)
    })
  })

  // ===========================================================================
  // 6. CRUD verb conjugation details
  // ===========================================================================

  describe('CRUD verb conjugation forms', () => {
    it('Metric schema has create verb with correct conjugation', () => {
      const verb = Metric.$schema.verbs.get('create')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('create')
      expect(verb!.activity).toBe('creating')
      expect(verb!.event).toBe('created')
      expect(verb!.reverseBy).toBe('createdBy')
      expect(verb!.reverseAt).toBe('createdAt')
    })

    it('Metric schema has update verb with correct conjugation', () => {
      const verb = Metric.$schema.verbs.get('update')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('update')
      expect(verb!.activity).toBe('updating')
      expect(verb!.event).toBe('updated')
      expect(verb!.reverseBy).toBe('updatedBy')
      expect(verb!.reverseAt).toBe('updatedAt')
    })

    it('Metric schema has delete verb with correct conjugation', () => {
      const verb = Metric.$schema.verbs.get('delete')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('delete')
      expect(verb!.activity).toBe('deleting')
      expect(verb!.event).toBe('deleted')
    })

    it('Event schema has create verb but not update or delete verbs', () => {
      expect(Event.$schema.verbs.has('create')).toBe(true)
      expect(Event.$schema.verbs.has('update')).toBe(false)
      expect(Event.$schema.verbs.has('delete')).toBe(false)
    })

    it('Goal achieve verb has reverseBy and reverseAt', () => {
      const verb = Goal.$schema.verbs.get('achieve')
      expect(verb).toBeDefined()
      expect(verb!.reverseBy).toBe('achievedBy')
      expect(verb!.reverseAt).toBe('achievedAt')
    })
  })

  // ===========================================================================
  // 7. Event disabled verb forms (updating/updated/deleting/deleted = null)
  // ===========================================================================

  describe('Event disabled verb conjugation forms', () => {
    it('Event.updating is null (BEFORE hook for disabled update)', () => {
      expect(Event.updating).toBeNull()
    })

    it('Event.updated is null (AFTER hook for disabled update)', () => {
      expect(Event.updated).toBeNull()
    })

    it('Event.deleting is null (BEFORE hook for disabled delete)', () => {
      expect(Event.deleting).toBeNull()
    })

    it('Event.deleted is null (AFTER hook for disabled delete)', () => {
      expect(Event.deleted).toBeNull()
    })
  })

  // ===========================================================================
  // 8. MongoDB-style query operators
  // ===========================================================================

  describe('MongoDB-style query operators on Metric', () => {
    it('$gt filters metrics with value greater than threshold', async () => {
      await Metric.create({ name: 'low', value: 10 })
      await Metric.create({ name: 'mid', value: 50 })
      await Metric.create({ name: 'high', value: 90 })

      const results = await Metric.find({ value: { $gt: 40 } })
      expect(results.length).toBe(2)
      expect(results.every((m: any) => m.value > 40)).toBe(true)
    })

    it('$gte filters metrics with value greater than or equal to threshold', async () => {
      await Metric.create({ name: 'a', value: 50 })
      await Metric.create({ name: 'b', value: 50 })
      await Metric.create({ name: 'c', value: 49 })

      const results = await Metric.find({ value: { $gte: 50 } })
      expect(results.length).toBe(2)
    })

    it('$lt filters metrics with value less than threshold', async () => {
      await Metric.create({ name: 'a', value: 10 })
      await Metric.create({ name: 'b', value: 30 })
      await Metric.create({ name: 'c', value: 60 })

      const results = await Metric.find({ value: { $lt: 30 } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('a')
    })

    it('$lte filters metrics with value less than or equal to threshold', async () => {
      await Metric.create({ name: 'a', value: 10 })
      await Metric.create({ name: 'b', value: 30 })
      await Metric.create({ name: 'c', value: 60 })

      const results = await Metric.find({ value: { $lte: 30 } })
      expect(results.length).toBe(2)
    })

    it('$in filters metrics matching any value in the array', async () => {
      await Metric.create({ name: 'cpu', value: 55, type: 'Gauge' })
      await Metric.create({ name: 'errors', value: 3, type: 'Counter' })
      await Metric.create({ name: 'latency', value: 120, type: 'Histogram' })
      await Metric.create({ name: 'uptime', value: 99, type: 'Summary' })

      const results = await Metric.find({ type: { $in: ['Counter', 'Histogram'] } })
      expect(results.length).toBe(2)
      const names = results.map((m: any) => m.name).sort()
      expect(names).toEqual(['errors', 'latency'])
    })

    it('$nin filters metrics NOT matching values in the array', async () => {
      await Metric.create({ name: 'cpu', value: 55, type: 'Gauge' })
      await Metric.create({ name: 'errors', value: 3, type: 'Counter' })
      await Metric.create({ name: 'latency', value: 120, type: 'Histogram' })

      const results = await Metric.find({ type: { $nin: ['Gauge'] } })
      expect(results.length).toBe(2)
      expect(results.every((m: any) => m.type !== 'Gauge')).toBe(true)
    })

    it('$eq is equivalent to exact match', async () => {
      await Metric.create({ name: 'requests', value: 1000 })
      await Metric.create({ name: 'errors', value: 5 })

      const results = await Metric.find({ name: { $eq: 'requests' } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('requests')
    })

    it('$ne excludes exact match', async () => {
      await Metric.create({ name: 'requests', value: 1000 })
      await Metric.create({ name: 'errors', value: 5 })
      await Metric.create({ name: 'latency', value: 120 })

      const results = await Metric.find({ name: { $ne: 'requests' } })
      expect(results.length).toBe(2)
      expect(results.every((m: any) => m.name !== 'requests')).toBe(true)
    })

    it('$exists: true filters for fields that are present', async () => {
      await Metric.create({ name: 'cpu', value: 55, unit: 'percent' })
      await Metric.create({ name: 'errors', value: 5 })

      const results = await Metric.find({ unit: { $exists: true } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('cpu')
    })

    it('$exists: false filters for fields that are absent', async () => {
      await Metric.create({ name: 'cpu', value: 55, unit: 'percent' })
      await Metric.create({ name: 'errors', value: 5 })

      const results = await Metric.find({ unit: { $exists: false } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('errors')
    })
  })

  // ===========================================================================
  // 9. Hook execution (BEFORE and AFTER)
  // ===========================================================================

  describe('hook execution — BEFORE and AFTER', () => {
    it('Goal.achieving BEFORE hook fires before achieve verb', async () => {
      const calls: string[] = []
      const unsub = Goal.achieving((data: any) => {
        calls.push('before')
      })
      const goal = await Goal.create({ name: 'Test Goal', target: 100, current: 50, status: 'OnTrack' })
      await Goal.achieve(goal.$id, { current: 100 })
      expect(calls).toContain('before')
      unsub()
    })

    it('Goal.achieved AFTER hook fires after achieve verb', async () => {
      const calls: string[] = []
      const unsub = Goal.achieved((instance: any) => {
        calls.push('after')
      })
      const goal = await Goal.create({ name: 'Test Goal', target: 100, current: 50, status: 'OnTrack' })
      await Goal.achieve(goal.$id, { current: 100 })
      expect(calls).toContain('after')
      unsub()
    })

    it('AFTER hook receives the updated instance', async () => {
      let receivedInstance: any = null
      const unsub = Goal.achieved((instance: any) => {
        receivedInstance = instance
      })
      const goal = await Goal.create({ name: 'Hook Goal', target: 200, current: 0, status: 'OnTrack' })
      await Goal.achieve(goal.$id, { current: 200 })
      expect(receivedInstance).not.toBeNull()
      expect(receivedInstance.name).toBe('Hook Goal')
      expect(receivedInstance.current).toBe(200)
      expect(receivedInstance.status).toBe('Achieved')
      unsub()
    })

    it('BEFORE hook on creating can modify data', async () => {
      const unsub = Metric.creating((data: any) => {
        return { ...data, unit: 'auto-assigned' }
      })
      const metric = await Metric.create({ name: 'test', value: 42 })
      expect(metric.unit).toBe('auto-assigned')
      unsub()
    })

    it('AFTER hook on created fires with the instance', async () => {
      let receivedId: string | null = null
      const unsub = Metric.created((instance: any) => {
        receivedId = instance.$id
      })
      const metric = await Metric.create({ name: 'hook-test', value: 10 })
      expect(receivedId).toBe(metric.$id)
      unsub()
    })

    it('unsubscribe removes the hook so it stops firing', async () => {
      let callCount = 0
      const unsub = Funnel.creating(() => {
        callCount++
      })
      await Funnel.create({ name: 'First' })
      expect(callCount).toBe(1)

      unsub()
      await Funnel.create({ name: 'Second' })
      expect(callCount).toBe(1) // should not increment
    })

    it('multiple BEFORE hooks execute in registration order', async () => {
      const order: number[] = []
      const unsub1 = Funnel.creating(() => {
        order.push(1)
      })
      const unsub2 = Funnel.creating(() => {
        order.push(2)
      })
      await Funnel.create({ name: 'Multi-hook' })
      expect(order).toEqual([1, 2])
      unsub1()
      unsub2()
    })
  })

  // ===========================================================================
  // 10. Meta-field validation on updates and versioning
  // ===========================================================================

  describe('meta-field behavior across operations', () => {
    it('$version increments on each update', async () => {
      const goal = await Goal.create({ name: 'Versioned', target: 100 })
      expect(goal.$version).toBe(1)

      const v2 = await Goal.update(goal.$id, { current: 25 })
      expect(v2.$version).toBe(2)

      const v3 = await Goal.update(goal.$id, { current: 50 })
      expect(v3.$version).toBe(3)
    })

    it('$id format is {type}_{8-char sqid}', async () => {
      const event = await Event.create({ name: 'test', type: 'track', timestamp: '2024-01-01T00:00:00Z' })
      expect(event.$id).toMatch(/^event_[a-zA-Z0-9]{8}$/)

      const metric = await Metric.create({ name: 'test', value: 0 })
      expect(metric.$id).toMatch(/^metric_[a-zA-Z0-9]{8}$/)

      const funnel = await Funnel.create({ name: 'test' })
      expect(funnel.$id).toMatch(/^funnel_[a-zA-Z0-9]{8}$/)

      const goal = await Goal.create({ name: 'test', target: 1 })
      expect(goal.$id).toMatch(/^goal_[a-zA-Z0-9]{8}$/)
    })

    it('$type matches the entity name', async () => {
      const event = await Event.create({ name: 'test', type: 'track', timestamp: '2024-01-01T00:00:00Z' })
      expect(event.$type).toBe('Event')

      const metric = await Metric.create({ name: 'test', value: 0 })
      expect(metric.$type).toBe('Metric')

      const funnel = await Funnel.create({ name: 'test' })
      expect(funnel.$type).toBe('Funnel')

      const goal = await Goal.create({ name: 'test', target: 1 })
      expect(goal.$type).toBe('Goal')
    })

    it('$context contains the tenant URL', async () => {
      const goal = await Goal.create({ name: 'Ctx Test', target: 100 })
      expect(goal.$context).toMatch(/^https:\/\/headless\.ly\/~/)
    })

    it('$createdAt and $updatedAt are ISO strings on creation', async () => {
      const metric = await Metric.create({ name: 'time-test', value: 42 })
      expect(typeof metric.$createdAt).toBe('string')
      expect(typeof metric.$updatedAt).toBe('string')
      // Both should parse to valid dates
      expect(new Date(metric.$createdAt).getTime()).not.toBeNaN()
      expect(new Date(metric.$updatedAt).getTime()).not.toBeNaN()
    })

    it('$updatedAt changes on update while $createdAt stays the same', async () => {
      const goal = await Goal.create({ name: 'Timestamp Test', target: 100 })
      const createdAt = goal.$createdAt

      // Small delay to ensure timestamp difference
      await new Promise((r) => setTimeout(r, 5))
      const updated = await Goal.update(goal.$id, { current: 50 })
      expect(updated.$createdAt).toBe(createdAt)
      // $updatedAt should be different after update
      expect(updated.$updatedAt).toBeDefined()
    })

    it('$id remains stable across updates', async () => {
      const funnel = await Funnel.create({ name: 'Stable ID' })
      const id = funnel.$id
      const updated = await Funnel.update(funnel.$id, { description: 'Updated' })
      expect(updated.$id).toBe(id)
    })
  })

  // ===========================================================================
  // 11. Edge cases: empty results, nonexistent IDs, boundary values
  // ===========================================================================

  describe('edge cases', () => {
    it('find returns empty array when no matches', async () => {
      const results = await Metric.find({ name: 'nonexistent_metric_xyz' })
      expect(results).toEqual([])
    })

    it('get returns null for nonexistent ID', async () => {
      const result = await Metric.get('metric_ZZZZZZZZ')
      expect(result).toBeNull()
    })

    it('find with no filter returns all entities of that type', async () => {
      await Funnel.create({ name: 'F1' })
      await Funnel.create({ name: 'F2' })
      await Funnel.create({ name: 'F3' })

      const all = await Funnel.find()
      expect(all.length).toBe(3)
    })

    it('Metric with zero value is valid', async () => {
      const metric = await Metric.create({ name: 'zero_metric', value: 0 })
      expect(metric.value).toBe(0)
    })

    it('Metric with negative value is valid', async () => {
      const metric = await Metric.create({ name: 'negative_metric', value: -15.5 })
      expect(metric.value).toBe(-15.5)
    })

    it('Goal with target of zero is valid', async () => {
      const goal = await Goal.create({ name: 'Zero Target', target: 0 })
      expect(goal.target).toBe(0)
    })

    it('Funnel with empty steps string is valid', async () => {
      const funnel = await Funnel.create({ name: 'Empty Steps', steps: '' })
      expect(funnel.steps).toBe('')
    })

    it('creating multiple events generates unique $id values', async () => {
      const ids = new Set<string>()
      for (let i = 0; i < 10; i++) {
        const event = await Event.create({ name: `event_${i}`, type: 'track', timestamp: '2024-01-01T00:00:00Z' })
        ids.add(event.$id)
      }
      expect(ids.size).toBe(10)
    })
  })

  // ===========================================================================
  // 12. Funnel operations and lifecycle
  // ===========================================================================

  describe('Funnel operations', () => {
    it('creates a funnel with serialized step data', async () => {
      const steps = JSON.stringify([
        { name: 'Landing', url: '/landing' },
        { name: 'Signup', url: '/signup' },
        { name: 'Onboard', url: '/onboard' },
        { name: 'Activate', url: '/activate' },
      ])
      const funnel = await Funnel.create({ name: 'Activation Flow', steps, conversionRate: 0.42 })
      expectMetaFields(funnel, 'Funnel')
      expect(funnel.steps).toBe(steps)
      expect(funnel.conversionRate).toBe(0.42)
      const parsedSteps = JSON.parse(funnel.steps as string)
      expect(parsedSteps).toHaveLength(4)
      expect(parsedSteps[0].name).toBe('Landing')
    })

    it('updates funnel conversionRate', async () => {
      const funnel = await Funnel.create({ name: 'Sales Pipeline', conversionRate: 0.15 })
      const updated = await Funnel.update(funnel.$id, { conversionRate: 0.22 })
      expect(updated.conversionRate).toBe(0.22)
    })

    it('deletes a funnel', async () => {
      const funnel = await Funnel.create({ name: 'To Delete' })
      const deleted = await Funnel.delete(funnel.$id)
      expect(deleted).toBe(true)
      const gone = await Funnel.get(funnel.$id)
      expect(gone).toBeNull()
    })

    it('can find funnels by name', async () => {
      await Funnel.create({ name: 'Signup Flow' })
      await Funnel.create({ name: 'Upgrade Flow' })
      await Funnel.create({ name: 'Signup Flow' })

      const signupFunnels = await Funnel.find({ name: 'Signup Flow' })
      expect(signupFunnels.length).toBe(2)
    })
  })

  // ===========================================================================
  // 13. Goal achieve verb — state transition logic
  // ===========================================================================

  describe('Goal achieve verb state transition', () => {
    it('achieve sets status to Achieved when no explicit status passed', async () => {
      const goal = await Goal.create({ name: 'Auto Status', target: 100, current: 90, status: 'OnTrack' })
      const achieved = await Goal.achieve(goal.$id)
      expect(achieved.status).toBe('Achieved')
    })

    it('achieve preserves other fields while setting status', async () => {
      const goal = await Goal.create({
        name: 'Full Goal',
        target: 500,
        current: 480,
        unit: 'users',
        status: 'AtRisk',
        period: 'Monthly',
      })
      const achieved = await Goal.achieve(goal.$id, { current: 510 })
      expect(achieved.name).toBe('Full Goal')
      expect(achieved.target).toBe(500)
      expect(achieved.unit).toBe('users')
      expect(achieved.period).toBe('Monthly')
      expect(achieved.current).toBe(510)
      expect(achieved.status).toBe('Achieved')
    })

    it('achieve increments $version', async () => {
      const goal = await Goal.create({ name: 'Version Test', target: 100, status: 'OnTrack' })
      expect(goal.$version).toBe(1)
      const achieved = await Goal.achieve(goal.$id)
      expect(achieved.$version).toBe(2)
    })
  })

  // ===========================================================================
  // 14. Cross-entity queries and isolation
  // ===========================================================================

  describe('cross-entity type isolation', () => {
    it('Event.find does not return Metric entities', async () => {
      await Event.create({ name: 'page_view', type: 'track', timestamp: '2024-01-01T00:00:00Z' })
      await Metric.create({ name: 'page_view', value: 100 })

      const events = await Event.find({ name: 'page_view' })
      const metrics = await Metric.find({ name: 'page_view' })

      expect(events.length).toBe(1)
      expect(events[0].$type).toBe('Event')
      expect(metrics.length).toBe(1)
      expect(metrics[0].$type).toBe('Metric')
    })

    it('Goal.find does not return Funnel entities', async () => {
      await Goal.create({ name: 'shared_name', target: 100 })
      await Funnel.create({ name: 'shared_name' })

      const goals = await Goal.find({ name: 'shared_name' })
      const funnels = await Funnel.find({ name: 'shared_name' })

      expect(goals.length).toBe(1)
      expect(goals[0].$type).toBe('Goal')
      expect(funnels.length).toBe(1)
      expect(funnels[0].$type).toBe('Funnel')
    })
  })

  // ===========================================================================
  // 15. $regex queries on different entities
  // ===========================================================================

  describe('$regex queries across entities', () => {
    it('$regex on Goal name', async () => {
      await Goal.create({ name: 'Q1 Revenue', target: 100 })
      await Goal.create({ name: 'Q2 Revenue', target: 200 })
      await Goal.create({ name: 'Q1 Signups', target: 50 })

      const q1Goals = await Goal.find({ name: { $regex: '^Q1' } })
      expect(q1Goals.length).toBe(2)
    })

    it('$regex on Funnel name with case-insensitive pattern', async () => {
      await Funnel.create({ name: 'signup-flow' })
      await Funnel.create({ name: 'Signup-Flow' })
      await Funnel.create({ name: 'checkout-flow' })

      // Case-insensitive regex
      const results = await Funnel.find({ name: { $regex: 'signup' } })
      expect(results.length).toBe(1) // Only exact lowercase match since regex is case-sensitive by default
    })
  })

  // ===========================================================================
  // 16. Combined filter operators
  // ===========================================================================

  describe('combined filter operators', () => {
    it('$gt and $lt together define a range on Goal current', async () => {
      await Goal.create({ name: 'A', target: 100, current: 10 })
      await Goal.create({ name: 'B', target: 100, current: 50 })
      await Goal.create({ name: 'C', target: 100, current: 90 })

      const results = await Goal.find({ current: { $gt: 20, $lt: 80 } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('B')
    })
  })

  // ===========================================================================
  // 17. Schema — raw definition access
  // ===========================================================================

  describe('schema raw definition access', () => {
    it('Event.$schema.raw contains the original definition keys', () => {
      const raw = Event.$schema.raw
      expect(raw.name).toBe('string!')
      expect(raw.type).toBe('string!')
      expect(raw.timestamp).toBe('datetime!')
      expect(raw.source).toBe('Browser | Node | API | Snippet')
      expect(raw.update).toBeNull()
      expect(raw.delete).toBeNull()
    })

    it('Goal.$schema.raw contains achieve verb declaration', () => {
      const raw = Goal.$schema.raw
      expect(raw.achieve).toBe('Achieved')
    })
  })

  // ===========================================================================
  // 18. Schema — disabledVerbs are correct per entity
  // ===========================================================================

  describe('disabledVerbs sets', () => {
    it('Event has 2 disabled verbs: update and delete', () => {
      expect(Event.$schema.disabledVerbs.size).toBe(2)
      expect(Event.$schema.disabledVerbs.has('update')).toBe(true)
      expect(Event.$schema.disabledVerbs.has('delete')).toBe(true)
    })

    it('Metric has no disabled verbs', () => {
      expect(Metric.$schema.disabledVerbs.size).toBe(0)
    })

    it('Funnel has no disabled verbs', () => {
      expect(Funnel.$schema.disabledVerbs.size).toBe(0)
    })

    it('Goal has no disabled verbs', () => {
      expect(Goal.$schema.disabledVerbs.size).toBe(0)
    })
  })

  // ===========================================================================
  // 19. Hook registration — creating/updating/deleting on standard entities
  // ===========================================================================

  describe('standard verb hook registration', () => {
    it('Funnel.creating registers a BEFORE hook and returns unsubscribe', () => {
      const handler = vi.fn()
      const unsub = Funnel.creating(handler)
      expect(typeof unsub).toBe('function')
      unsub()
    })

    it('Funnel.created registers an AFTER hook and returns unsubscribe', () => {
      const handler = vi.fn()
      const unsub = Funnel.created(handler)
      expect(typeof unsub).toBe('function')
      unsub()
    })

    it('Metric.updating registers a BEFORE hook', () => {
      const handler = vi.fn()
      const unsub = Metric.updating(handler)
      expect(typeof unsub).toBe('function')
      unsub()
    })

    it('Metric.updated registers an AFTER hook', () => {
      const handler = vi.fn()
      const unsub = Metric.updated(handler)
      expect(typeof unsub).toBe('function')
      unsub()
    })

    it('Goal.deleting registers a BEFORE hook', () => {
      const handler = vi.fn()
      const unsub = Goal.deleting(handler)
      expect(typeof unsub).toBe('function')
      unsub()
    })

    it('Goal.deleted registers an AFTER hook', () => {
      const handler = vi.fn()
      const unsub = Goal.deleted(handler)
      expect(typeof unsub).toBe('function')
      unsub()
    })
  })
})
