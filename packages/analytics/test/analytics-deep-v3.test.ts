import { describe, it, expect, vi } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Event, Metric, Funnel, Goal } from '../src/index.ts'
import { setupTestProvider, expectMetaFields } from '../../test-utils'

describe('@headlessly/analytics — deep coverage v3', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Event immutability enforcement — runtime behavior
  // ===========================================================================

  describe('Event immutability enforcement at runtime', () => {
    it('Event.create succeeds and returns a valid immutable record', async () => {
      const event = await Event.create({
        name: 'purchase',
        type: 'track',
        timestamp: '2024-03-01T09:00:00Z',
        data: JSON.stringify({ amount: 99.99, currency: 'USD' }),
      })
      expectMetaFields(event, 'Event')
      expect(event.data).toBe(JSON.stringify({ amount: 99.99, currency: 'USD' }))
    })

    it('Event.get retrieves the exact same data that was created', async () => {
      const created = await Event.create({
        name: 'checkout_start',
        type: 'track',
        timestamp: '2024-03-01T10:00:00Z',
        properties: JSON.stringify({ cart_value: 250 }),
      })
      const fetched = await Event.get(created.$id)
      expect(fetched).not.toBeNull()
      expect(fetched!.name).toBe('checkout_start')
      expect(fetched!.properties).toBe(JSON.stringify({ cart_value: 250 }))
      expect(fetched!.$version).toBe(1)
    })

    it('Event has no updating hook (null) since update is disabled', () => {
      // Accessing conjugated forms of disabled verbs returns null
      expect(Event.updating).toBeNull()
    })

    it('Event has no updated hook (null) since update is disabled', () => {
      expect(Event.updated).toBeNull()
    })

    it('Event has no deleting hook (null) since delete is disabled', () => {
      expect(Event.deleting).toBeNull()
    })

    it('Event has no deleted hook (null) since delete is disabled', () => {
      expect(Event.deleted).toBeNull()
    })

    it('Event.$version remains 1 forever since updates are impossible', async () => {
      const event = await Event.create({
        name: 'immutable_check',
        type: 'track',
        timestamp: '2024-03-01T11:00:00Z',
      })
      expect(event.$version).toBe(1)
      // Re-fetch to confirm version stays at 1
      const fetched = await Event.get(event.$id)
      expect(fetched!.$version).toBe(1)
    })
  })

  // ===========================================================================
  // 2. Funnel step calculations and conversion rate modeling
  // ===========================================================================

  describe('Funnel step calculations and conversion rates', () => {
    it('creates a funnel with multi-step JSON and computes step-to-step conversion', async () => {
      const steps = JSON.stringify([
        { name: 'Visit', count: 10000 },
        { name: 'Signup', count: 2500 },
        { name: 'Activate', count: 1000 },
        { name: 'Subscribe', count: 250 },
      ])
      const funnel = await Funnel.create({
        name: 'SaaS Conversion Funnel',
        steps,
        conversionRate: 0.025,
      })
      const parsed = JSON.parse(funnel.steps as string)
      expect(parsed).toHaveLength(4)
      // Overall conversion: 250/10000 = 0.025
      expect(funnel.conversionRate).toBe(0.025)
    })

    it('updates funnel steps to reflect changes in user journey', async () => {
      const steps1 = JSON.stringify([{ name: 'Landing', count: 500 }, { name: 'Signup', count: 100 }])
      const funnel = await Funnel.create({ name: 'V1 Funnel', steps: steps1, conversionRate: 0.2 })

      const steps2 = JSON.stringify([
        { name: 'Landing', count: 500 },
        { name: 'Signup', count: 100 },
        { name: 'Onboard', count: 60 },
      ])
      const updated = await Funnel.update(funnel.$id, { steps: steps2, conversionRate: 0.12 })
      const parsed = JSON.parse(updated.steps as string)
      expect(parsed).toHaveLength(3)
      expect(updated.conversionRate).toBe(0.12)
    })

    it('funnel with zero conversion rate is valid', async () => {
      const funnel = await Funnel.create({ name: 'Zero Funnel', conversionRate: 0 })
      expect(funnel.conversionRate).toBe(0)
    })

    it('funnel with 100% conversion rate is valid', async () => {
      const funnel = await Funnel.create({ name: 'Perfect Funnel', conversionRate: 1.0 })
      expect(funnel.conversionRate).toBe(1.0)
    })

    it('funnel without steps or conversionRate still creates successfully', async () => {
      const funnel = await Funnel.create({ name: 'Minimal Funnel' })
      expectMetaFields(funnel, 'Funnel')
      expect(funnel.steps).toBeUndefined()
      expect(funnel.conversionRate).toBeUndefined()
    })
  })

  // ===========================================================================
  // 3. Goal achievement tracking with targets
  // ===========================================================================

  describe('Goal achievement tracking with targets', () => {
    it('tracks progress from 0% to 100% through sequential updates', async () => {
      const goal = await Goal.create({
        name: 'First 1000 Users',
        target: 1000,
        current: 0,
        status: 'Behind',
        period: 'Monthly',
      })
      expect(goal.current).toBe(0)

      const at250 = await Goal.update(goal.$id, { current: 250, status: 'Behind' })
      expect(at250.current).toBe(250)

      const at500 = await Goal.update(goal.$id, { current: 500, status: 'OnTrack' })
      expect(at500.current).toBe(500)
      expect(at500.status).toBe('OnTrack')

      const at900 = await Goal.update(goal.$id, { current: 900, status: 'OnTrack' })
      expect(at900.current).toBe(900)

      const achieved = await Goal.achieve(goal.$id, { current: 1050 })
      expect(achieved.status).toBe('Achieved')
      expect(achieved.current).toBe(1050)
      expect(achieved.$version).toBe(5)
    })

    it('goal with negative target is valid (debt reduction)', async () => {
      const goal = await Goal.create({
        name: 'Reduce Churn Rate',
        target: -5,
        current: -2,
        unit: 'percent',
        status: 'OnTrack',
      })
      expect(goal.target).toBe(-5)
      expect(goal.current).toBe(-2)
    })

    it('goal with fractional target is valid', async () => {
      const goal = await Goal.create({
        name: 'NPS Score',
        target: 8.5,
        current: 7.2,
        status: 'OnTrack',
      })
      expect(goal.target).toBe(8.5)
      expect(goal.current).toBe(7.2)
    })

    it('achieve without extra data just sets status to Achieved', async () => {
      const goal = await Goal.create({
        name: 'Ship MVP',
        target: 1,
        current: 0,
        status: 'OnTrack',
      })
      const achieved = await Goal.achieve(goal.$id)
      expect(achieved.status).toBe('Achieved')
      // current should retain original value when no data passed
      expect(achieved.current).toBe(0)
    })

    it('Goal period enum values are all queryable', async () => {
      const periods = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'] as const
      for (const period of periods) {
        await Goal.create({ name: `${period} Goal`, target: 100, period })
      }

      for (const period of periods) {
        const results = await Goal.find({ period })
        expect(results.length).toBe(1)
        expect(results[0].period).toBe(period)
      }
    })
  })

  // ===========================================================================
  // 4. Metric aggregation and time series patterns
  // ===========================================================================

  describe('Metric aggregation and time series patterns', () => {
    it('creates multiple metric snapshots at different timestamps', async () => {
      const timestamps = [
        '2024-01-01T00:00:00Z',
        '2024-02-01T00:00:00Z',
        '2024-03-01T00:00:00Z',
      ]
      const metrics = await Promise.all(
        timestamps.map((ts, i) =>
          Metric.create({
            name: 'MRR',
            value: 10000 + i * 5000,
            type: 'Gauge',
            unit: 'USD',
            timestamp: ts,
          }),
        ),
      )
      expect(metrics).toHaveLength(3)
      expect(metrics[0].value).toBe(10000)
      expect(metrics[1].value).toBe(15000)
      expect(metrics[2].value).toBe(20000)

      // Query all MRR metrics
      const allMrr = await Metric.find({ name: 'MRR' })
      expect(allMrr.length).toBe(3)
    })

    it('creates histogram metric with dimensions for percentile tracking', async () => {
      const dims = JSON.stringify({ endpoint: '/api/contacts', method: 'GET' })
      const metric = await Metric.create({
        name: 'response_time_p99',
        value: 342.5,
        type: 'Histogram',
        unit: 'ms',
        dimensions: dims,
      })
      expect(metric.type).toBe('Histogram')
      expect(metric.value).toBe(342.5)
      const parsedDims = JSON.parse(metric.dimensions as string)
      expect(parsedDims.endpoint).toBe('/api/contacts')
    })

    it('Metric type enum values cover Counter, Gauge, Histogram, Summary', async () => {
      const types = ['Counter', 'Gauge', 'Histogram', 'Summary'] as const
      for (const t of types) {
        await Metric.create({ name: `metric_${t.toLowerCase()}`, value: 42, type: t })
      }
      for (const t of types) {
        const results = await Metric.find({ type: t })
        expect(results.length).toBe(1)
        expect(results[0].type).toBe(t)
      }
    })

    it('multiple metric updates increment version sequentially', async () => {
      const metric = await Metric.create({ name: 'cpu_usage', value: 10, type: 'Gauge', unit: 'percent' })
      expect(metric.$version).toBe(1)

      const v2 = await Metric.update(metric.$id, { value: 25 })
      expect(v2.$version).toBe(2)

      const v3 = await Metric.update(metric.$id, { value: 50 })
      expect(v3.$version).toBe(3)

      const v4 = await Metric.update(metric.$id, { value: 85 })
      expect(v4.$version).toBe(4)
    })
  })

  // ===========================================================================
  // 5. Cross-entity analytics queries
  // ===========================================================================

  describe('cross-entity analytics queries', () => {
    it('same name across all four entity types remains isolated', async () => {
      const sharedName = 'revenue_tracker'
      await Event.create({ name: sharedName, type: 'track', timestamp: '2024-01-01T00:00:00Z' })
      await Metric.create({ name: sharedName, value: 50000 })
      await Funnel.create({ name: sharedName })
      await Goal.create({ name: sharedName, target: 100000 })

      const events = await Event.find({ name: sharedName })
      const metrics = await Metric.find({ name: sharedName })
      const funnels = await Funnel.find({ name: sharedName })
      const goals = await Goal.find({ name: sharedName })

      expect(events.length).toBe(1)
      expect(events[0].$type).toBe('Event')
      expect(metrics.length).toBe(1)
      expect(metrics[0].$type).toBe('Metric')
      expect(funnels.length).toBe(1)
      expect(funnels[0].$type).toBe('Funnel')
      expect(goals.length).toBe(1)
      expect(goals[0].$type).toBe('Goal')
    })

    it('get with wrong type ID returns null', async () => {
      const metric = await Metric.create({ name: 'test_metric', value: 100 })
      // Try to get a metric ID from Event
      const result = await Event.get(metric.$id)
      expect(result).toBeNull()
    })

    it('each entity type has its own ID prefix', async () => {
      const event = await Event.create({ name: 'e', type: 'track', timestamp: '2024-01-01T00:00:00Z' })
      const metric = await Metric.create({ name: 'm', value: 0 })
      const funnel = await Funnel.create({ name: 'f' })
      const goal = await Goal.create({ name: 'g', target: 1 })

      expect(event.$id).toMatch(/^event_/)
      expect(metric.$id).toMatch(/^metric_/)
      expect(funnel.$id).toMatch(/^funnel_/)
      expect(goal.$id).toMatch(/^goal_/)
    })
  })

  // ===========================================================================
  // 6. Concurrent event ingestion
  // ===========================================================================

  describe('concurrent event ingestion', () => {
    it('creates 50 events concurrently with unique IDs', async () => {
      const promises = Array.from({ length: 50 }, (_, i) =>
        Event.create({
          name: `concurrent_event_${i}`,
          type: 'track',
          timestamp: `2024-06-15T10:${String(i).padStart(2, '0')}:00Z`,
          source: 'API',
        }),
      )
      const results = await Promise.all(promises)
      expect(results).toHaveLength(50)

      const ids = new Set(results.map((r) => r.$id))
      expect(ids.size).toBe(50)

      // All should be Events
      expect(results.every((r) => r.$type === 'Event')).toBe(true)
    })

    it('concurrent metric creates produce distinct entities', async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        Metric.create({ name: `concurrent_metric_${i}`, value: i * 10, type: 'Counter' }),
      )
      const results = await Promise.all(promises)
      expect(results).toHaveLength(20)

      const ids = new Set(results.map((r) => r.$id))
      expect(ids.size).toBe(20)
    })

    it('concurrent goal creates and achieves do not interfere', async () => {
      // Create 5 goals concurrently
      const goals = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          Goal.create({ name: `parallel_goal_${i}`, target: 100, current: 0, status: 'OnTrack' }),
        ),
      )
      expect(goals).toHaveLength(5)

      // Achieve them all concurrently
      const achieved = await Promise.all(goals.map((g) => Goal.achieve(g.$id, { current: 100 })))
      expect(achieved).toHaveLength(5)
      expect(achieved.every((g) => g.status === 'Achieved')).toBe(true)
    })
  })

  // ===========================================================================
  // 7. Advanced compound MongoDB queries
  // ===========================================================================

  describe('advanced compound MongoDB queries', () => {
    it('$gt and $lte combined on Goal current for range query', async () => {
      await Goal.create({ name: 'G1', target: 100, current: 10 })
      await Goal.create({ name: 'G2', target: 100, current: 50 })
      await Goal.create({ name: 'G3', target: 100, current: 75 })
      await Goal.create({ name: 'G4', target: 100, current: 100 })

      const results = await Goal.find({ current: { $gt: 10, $lte: 75 } })
      expect(results.length).toBe(2)
      const names = results.map((g: any) => g.name).sort()
      expect(names).toEqual(['G2', 'G3'])
    })

    it('$in on Event source enum', async () => {
      await Event.create({ name: 'browser_event', type: 'track', timestamp: '2024-01-01T00:00:00Z', source: 'Browser' })
      await Event.create({ name: 'node_event', type: 'track', timestamp: '2024-01-01T01:00:00Z', source: 'Node' })
      await Event.create({ name: 'api_event', type: 'track', timestamp: '2024-01-01T02:00:00Z', source: 'API' })
      await Event.create({ name: 'snippet_event', type: 'track', timestamp: '2024-01-01T03:00:00Z', source: 'Snippet' })

      const results = await Event.find({ source: { $in: ['Browser', 'API'] } })
      expect(results.length).toBe(2)
      const sources = results.map((e: any) => e.source).sort()
      expect(sources).toEqual(['API', 'Browser'])
    })

    it('$nin excludes specific Goal statuses', async () => {
      await Goal.create({ name: 'A', target: 100, status: 'OnTrack' })
      await Goal.create({ name: 'B', target: 100, status: 'AtRisk' })
      await Goal.create({ name: 'C', target: 100, status: 'Behind' })
      await Goal.create({ name: 'D', target: 100, status: 'Achieved' })

      const results = await Goal.find({ status: { $nin: ['Achieved', 'Behind'] } })
      expect(results.length).toBe(2)
      const statuses = results.map((g: any) => g.status).sort()
      expect(statuses).toEqual(['AtRisk', 'OnTrack'])
    })

    it('$ne on Metric type excludes a single type', async () => {
      await Metric.create({ name: 'a', value: 10, type: 'Counter' })
      await Metric.create({ name: 'b', value: 20, type: 'Gauge' })
      await Metric.create({ name: 'c', value: 30, type: 'Counter' })

      const results = await Metric.find({ type: { $ne: 'Counter' } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('b')
    })

    it('$regex with partial match on Metric name', async () => {
      await Metric.create({ name: 'api_latency_p50', value: 100, type: 'Histogram' })
      await Metric.create({ name: 'api_latency_p99', value: 500, type: 'Histogram' })
      await Metric.create({ name: 'db_latency_p50', value: 50, type: 'Histogram' })
      await Metric.create({ name: 'api_errors_total', value: 3, type: 'Counter' })

      const apiLatency = await Metric.find({ name: { $regex: '^api_latency' } })
      expect(apiLatency.length).toBe(2)
    })

    it('$exists combined with $gt for metrics that have unit and high value', async () => {
      await Metric.create({ name: 'high_with_unit', value: 500, unit: 'ms' })
      await Metric.create({ name: 'high_without_unit', value: 800 })
      await Metric.create({ name: 'low_with_unit', value: 10, unit: 'ms' })

      const withUnit = await Metric.find({ unit: { $exists: true } })
      expect(withUnit.length).toBe(2)

      const highValue = await Metric.find({ value: { $gt: 100 } })
      expect(highValue.length).toBe(2)
    })
  })

  // ===========================================================================
  // 8. Schema completeness assertions
  // ===========================================================================

  describe('schema completeness assertions', () => {
    it('Event schema has exactly 12 fields (not counting relationships)', () => {
      // name, type, data, source, sessionId, userId, anonymousId, timestamp, url, path, referrer, properties
      const fieldCount = Event.$schema.fields.size
      expect(fieldCount).toBe(12)
    })

    it('Metric schema has exactly 5 fields (not counting relationships)', () => {
      // name, value, type, unit, dimensions, timestamp = 6... let me count from schema
      const fieldCount = Metric.$schema.fields.size
      expect(fieldCount).toBe(6)
    })

    it('Funnel schema has exactly 4 fields (not counting relationships)', () => {
      // name, description, steps, conversionRate
      const fieldCount = Funnel.$schema.fields.size
      expect(fieldCount).toBe(4)
    })

    it('Goal schema has exactly 7 fields (not counting relationships)', () => {
      // name, description, target, current, unit, period, status
      const fieldCount = Goal.$schema.fields.size
      expect(fieldCount).toBe(7)
    })

    it('Event has exactly 1 relationship (organization)', () => {
      expect(Event.$schema.relationships.size).toBe(1)
      expect(Event.$schema.relationships.has('organization')).toBe(true)
    })

    it('Metric has exactly 1 relationship (organization)', () => {
      expect(Metric.$schema.relationships.size).toBe(1)
    })

    it('Funnel has exactly 1 relationship (organization)', () => {
      expect(Funnel.$schema.relationships.size).toBe(1)
    })

    it('Goal has exactly 1 relationship (organization)', () => {
      expect(Goal.$schema.relationships.size).toBe(1)
    })

    it('Event schema verbs map has exactly 1 verb (create only)', () => {
      expect(Event.$schema.verbs.size).toBe(1)
      expect(Event.$schema.verbs.has('create')).toBe(true)
    })

    it('Metric schema verbs map has exactly 5 verbs (create, update, delete, record, reset)', () => {
      expect(Metric.$schema.verbs.size).toBe(5)
      expect(Metric.$schema.verbs.has('create')).toBe(true)
      expect(Metric.$schema.verbs.has('update')).toBe(true)
      expect(Metric.$schema.verbs.has('delete')).toBe(true)
      expect(Metric.$schema.verbs.has('record')).toBe(true)
      expect(Metric.$schema.verbs.has('reset')).toBe(true)
    })

    it('Funnel schema verbs map has exactly 4 verbs (create, update, delete, analyze)', () => {
      expect(Funnel.$schema.verbs.size).toBe(4)
      expect(Funnel.$schema.verbs.has('analyze')).toBe(true)
    })

    it('Goal schema verbs map has exactly 7 verbs (create, update, delete, achieve, complete, miss, reset)', () => {
      expect(Goal.$schema.verbs.size).toBe(7)
      expect(Goal.$schema.verbs.has('achieve')).toBe(true)
      expect(Goal.$schema.verbs.has('complete')).toBe(true)
      expect(Goal.$schema.verbs.has('miss')).toBe(true)
      expect(Goal.$schema.verbs.has('reset')).toBe(true)
    })
  })

  // ===========================================================================
  // 9. Verb conjugation edge cases for achieve/track
  // ===========================================================================

  describe('verb conjugation edge cases for achieve', () => {
    it('achieve conjugates to achieving (gerund)', () => {
      const verb = Goal.$schema.verbs.get('achieve')
      expect(verb).toBeDefined()
      expect(verb!.activity).toBe('achieving')
    })

    it('achieve conjugates to achieved (past participle)', () => {
      const verb = Goal.$schema.verbs.get('achieve')
      expect(verb!.event).toBe('achieved')
    })

    it('achieve has achievedBy as reverseBy', () => {
      const verb = Goal.$schema.verbs.get('achieve')
      expect(verb!.reverseBy).toBe('achievedBy')
    })

    it('achieve has achievedAt as reverseAt', () => {
      const verb = Goal.$schema.verbs.get('achieve')
      expect(verb!.reverseAt).toBe('achievedAt')
    })

    it('Goal.achieve is a function', () => {
      expect(typeof Goal.achieve).toBe('function')
    })

    it('Goal.achieving is a function (BEFORE hook registrar)', () => {
      expect(typeof Goal.achieving).toBe('function')
    })

    it('Goal.achieved is a function (AFTER hook registrar)', () => {
      expect(typeof Goal.achieved).toBe('function')
    })

    it('create verb conjugation is consistent across all entities', () => {
      const entities = [Event, Metric, Funnel, Goal] as const
      for (const entity of entities) {
        const verb = entity.$schema.verbs.get('create')
        expect(verb).toBeDefined()
        expect(verb!.action).toBe('create')
        expect(verb!.activity).toBe('creating')
        expect(verb!.event).toBe('created')
        expect(verb!.reverseBy).toBe('createdBy')
        expect(verb!.reverseAt).toBe('createdAt')
      }
    })

    it('delete verb conjugation uses correct irregular forms', () => {
      const verb = Metric.$schema.verbs.get('delete')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('delete')
      expect(verb!.activity).toBe('deleting')
      expect(verb!.event).toBe('deleted')
      expect(verb!.reverseBy).toBe('deletedBy')
      expect(verb!.reverseAt).toBe('deletedAt')
    })

    it('update verb conjugation uses correct forms', () => {
      const verb = Goal.$schema.verbs.get('update')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('update')
      expect(verb!.activity).toBe('updating')
      expect(verb!.event).toBe('updated')
    })
  })

  // ===========================================================================
  // 10. Bulk operations patterns
  // ===========================================================================

  describe('bulk operations patterns', () => {
    it('creates and retrieves a large batch of events', async () => {
      const batch = Array.from({ length: 25 }, (_, i) => ({
        name: `batch_event_${i}`,
        type: 'track',
        timestamp: '2024-06-01T00:00:00Z',
        source: i % 2 === 0 ? 'Browser' : 'Node',
      }))

      const created = await Promise.all(batch.map((data) => Event.create(data)))
      expect(created).toHaveLength(25)

      // Verify they are all findable
      const browserEvents = await Event.find({ source: 'Browser' })
      const nodeEvents = await Event.find({ source: 'Node' })
      // 0,2,4,...24 = 13 browser events
      expect(browserEvents.length).toBe(13)
      // 1,3,5,...23 = 12 node events
      expect(nodeEvents.length).toBe(12)
    })

    it('bulk creates and deletes metrics', async () => {
      const metrics = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          Metric.create({ name: `bulk_metric_${i}`, value: i * 100, type: 'Counter' }),
        ),
      )
      expect(metrics).toHaveLength(10)

      // Delete half
      const deleteResults = await Promise.all(metrics.slice(0, 5).map((m) => Metric.delete(m.$id)))
      expect(deleteResults.every((r) => r === true)).toBe(true)

      // Verify remaining count
      const remaining = await Metric.find({ type: 'Counter' })
      expect(remaining.length).toBe(5)
    })

    it('bulk update goals status in parallel', async () => {
      const goals = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          Goal.create({ name: `bulk_goal_${i}`, target: 100, current: i * 12, status: 'OnTrack' }),
        ),
      )

      // Update all to AtRisk concurrently
      const updated = await Promise.all(goals.map((g) => Goal.update(g.$id, { status: 'AtRisk' })))
      expect(updated).toHaveLength(8)
      expect(updated.every((g) => g.status === 'AtRisk')).toBe(true)
      expect(updated.every((g) => g.$version === 2)).toBe(true)
    })
  })

  // ===========================================================================
  // 11. Event source enum values querying
  // ===========================================================================

  describe('Event source enum individual values', () => {
    it('can create and query events for each source type', async () => {
      const sources = ['Browser', 'Node', 'API', 'Snippet'] as const
      for (const source of sources) {
        await Event.create({
          name: `source_test_${source.toLowerCase()}`,
          type: 'track',
          timestamp: '2024-01-01T00:00:00Z',
          source,
        })
      }

      for (const source of sources) {
        const results = await Event.find({ source })
        expect(results.length).toBe(1)
        expect(results[0].source).toBe(source)
      }
    })
  })

  // ===========================================================================
  // 12. Goal status state machine transitions
  // ===========================================================================

  describe('Goal status state machine transitions', () => {
    it('transitions through OnTrack -> AtRisk -> Behind -> Achieved', async () => {
      const goal = await Goal.create({ name: 'State Machine', target: 100, current: 80, status: 'OnTrack' })
      expect(goal.status).toBe('OnTrack')

      const atRisk = await Goal.update(goal.$id, { status: 'AtRisk', current: 60 })
      expect(atRisk.status).toBe('AtRisk')

      const behind = await Goal.update(goal.$id, { status: 'Behind', current: 40 })
      expect(behind.status).toBe('Behind')

      const achieved = await Goal.achieve(goal.$id, { current: 105 })
      expect(achieved.status).toBe('Achieved')
      expect(achieved.$version).toBe(4)
    })

    it('all four Goal status values are queryable via $in', async () => {
      await Goal.create({ name: 'S1', target: 100, status: 'OnTrack' })
      await Goal.create({ name: 'S2', target: 100, status: 'AtRisk' })
      await Goal.create({ name: 'S3', target: 100, status: 'Behind' })
      await Goal.create({ name: 'S4', target: 100, status: 'Achieved' })

      const activeGoals = await Goal.find({ status: { $in: ['OnTrack', 'AtRisk'] } })
      expect(activeGoals.length).toBe(2)

      const inactiveGoals = await Goal.find({ status: { $in: ['Behind', 'Achieved'] } })
      expect(inactiveGoals.length).toBe(2)
    })
  })

  // ===========================================================================
  // 13. Hook chains for achieve verb
  // ===========================================================================

  describe('hook chains for achieve verb', () => {
    it('multiple BEFORE hooks on achieving execute in order', async () => {
      const order: number[] = []
      const unsub1 = Goal.achieving(() => {
        order.push(1)
      })
      const unsub2 = Goal.achieving(() => {
        order.push(2)
      })
      const unsub3 = Goal.achieving(() => {
        order.push(3)
      })

      const goal = await Goal.create({ name: 'Hook Chain', target: 100, status: 'OnTrack' })
      await Goal.achieve(goal.$id)
      expect(order).toEqual([1, 2, 3])
      unsub1()
      unsub2()
      unsub3()
    })

    it('achieved AFTER hook receives entity with Achieved status', async () => {
      let receivedStatus: string | null = null
      const unsub = Goal.achieved((instance: any) => {
        receivedStatus = instance.status
      })

      const goal = await Goal.create({ name: 'After Hook Check', target: 100, status: 'OnTrack' })
      await Goal.achieve(goal.$id)
      expect(receivedStatus).toBe('Achieved')
      unsub()
    })

    it('unsubscribing from achieving hook stops it from firing', async () => {
      let count = 0
      const unsub = Goal.achieving(() => {
        count++
      })

      const goal1 = await Goal.create({ name: 'Unsub Test 1', target: 100, status: 'OnTrack' })
      await Goal.achieve(goal1.$id)
      expect(count).toBe(1)

      unsub()

      const goal2 = await Goal.create({ name: 'Unsub Test 2', target: 100, status: 'OnTrack' })
      await Goal.achieve(goal2.$id)
      expect(count).toBe(1) // Should not have incremented
    })
  })

  // ===========================================================================
  // 14. Raw schema definition access for all entities
  // ===========================================================================

  describe('raw schema definition access', () => {
    it('Goal.$schema.raw contains all field declarations', () => {
      const raw = Goal.$schema.raw
      expect(raw.name).toBe('string!')
      expect(raw.description).toBe('string')
      expect(raw.target).toBe('number!')
      expect(raw.current).toBe('number')
      expect(raw.unit).toBe('string')
      expect(raw.period).toBe('Daily | Weekly | Monthly | Quarterly | Yearly')
      expect(raw.status).toBe('OnTrack | AtRisk | Behind | Achieved | Completed | Missed')
      expect(raw.organization).toBe('-> Organization')
      expect(raw.achieve).toBe('Achieved')
      expect(raw.complete).toBe('Completed')
      expect(raw.miss).toBe('Missed')
      expect(raw.reset).toBe('Reset')
    })

    it('Metric.$schema.raw contains all field declarations', () => {
      const raw = Metric.$schema.raw
      expect(raw.name).toBe('string!')
      expect(raw.value).toBe('number!')
      expect(raw.type).toBe('Counter | Gauge | Histogram | Summary')
      expect(raw.unit).toBe('string')
      expect(raw.dimensions).toBe('string')
      expect(raw.organization).toBe('-> Organization')
      expect(raw.timestamp).toBe('datetime')
    })

    it('Funnel.$schema.raw contains all field declarations', () => {
      const raw = Funnel.$schema.raw
      expect(raw.name).toBe('string!')
      expect(raw.description).toBe('string')
      expect(raw.steps).toBe('string')
      expect(raw.organization).toBe('-> Organization')
      expect(raw.conversionRate).toBe('number')
    })
  })
})
