import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Event, Metric, Funnel, Goal } from '../src/index.ts'
import { setupTestProvider, expectMetaFields } from '../../test-utils'

describe('@headlessly/analytics — deep coverage', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Event Noun schema (~6 tests)
  // ===========================================================================

  describe('Event Noun schema', () => {
    it('has correct field names in schema', () => {
      const schema = Event.$schema
      expect(schema.name).toBe('Event')
      const fieldNames = [...schema.fields.keys()]
      expect(fieldNames).toContain('name')
      expect(fieldNames).toContain('type')
      expect(fieldNames).toContain('properties')
      expect(fieldNames).toContain('timestamp')
      expect(fieldNames).toContain('source')
      expect(fieldNames).toContain('userId')
    })

    it('name field is required string', () => {
      const field = Event.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('type field is required string', () => {
      const field = Event.$schema.fields.get('type')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('timestamp field is required datetime', () => {
      const field = Event.$schema.fields.get('timestamp')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('datetime')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('source field is an enum with Browser | Node | API | Snippet', () => {
      const field = Event.$schema.fields.get('source')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Browser', 'Node', 'API', 'Snippet'])
    })

    it('has update and delete in disabledVerbs (immutable)', () => {
      const schema = Event.$schema
      expect(schema.disabledVerbs.has('update')).toBe(true)
      expect(schema.disabledVerbs.has('delete')).toBe(true)
    })
  })

  // ===========================================================================
  // 2. Metric Noun schema (~5 tests)
  // ===========================================================================

  describe('Metric Noun schema', () => {
    it('has correct field names in schema', () => {
      const schema = Metric.$schema
      expect(schema.name).toBe('Metric')
      const fieldNames = [...schema.fields.keys()]
      expect(fieldNames).toContain('name')
      expect(fieldNames).toContain('value')
      expect(fieldNames).toContain('unit')
      expect(fieldNames).toContain('dimensions')
    })

    it('name field is required string', () => {
      const field = Metric.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('value field is required number', () => {
      const field = Metric.$schema.fields.get('value')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('number')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('type field is an enum with Counter | Gauge | Histogram | Summary', () => {
      const field = Metric.$schema.fields.get('type')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Counter', 'Gauge', 'Histogram', 'Summary'])
    })

    it('unit field is an optional string', () => {
      const field = Metric.$schema.fields.get('unit')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })
  })

  // ===========================================================================
  // 3. Funnel Noun schema (~5 tests)
  // ===========================================================================

  describe('Funnel Noun schema', () => {
    it('has correct field names in schema', () => {
      const schema = Funnel.$schema
      expect(schema.name).toBe('Funnel')
      const fieldNames = [...schema.fields.keys()]
      expect(fieldNames).toContain('name')
      expect(fieldNames).toContain('steps')
      expect(fieldNames).toContain('conversionRate')
      expect(fieldNames).toContain('description')
    })

    it('name field is required string', () => {
      const field = Funnel.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('steps field is a string (serialized JSON)', () => {
      const field = Funnel.$schema.fields.get('steps')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('conversionRate field is a number', () => {
      const field = Funnel.$schema.fields.get('conversionRate')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('number')
    })

    it('has organization relationship', () => {
      const schema = Funnel.$schema
      const relNames = [...schema.relationships.keys()]
      expect(relNames).toContain('organization')
      const rel = schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.targetType).toBe('Organization')
    })
  })

  // ===========================================================================
  // 4. Goal Noun schema (~5 tests)
  // ===========================================================================

  describe('Goal Noun schema', () => {
    it('has correct field names in schema', () => {
      const schema = Goal.$schema
      expect(schema.name).toBe('Goal')
      const fieldNames = [...schema.fields.keys()]
      expect(fieldNames).toContain('name')
      expect(fieldNames).toContain('target')
      expect(fieldNames).toContain('current')
      expect(fieldNames).toContain('unit')
      expect(fieldNames).toContain('status')
    })

    it('target field is required number', () => {
      const field = Goal.$schema.fields.get('target')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('number')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('status field is an enum with OnTrack | AtRisk | Behind | Achieved | Completed | Missed', () => {
      const field = Goal.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['OnTrack', 'AtRisk', 'Behind', 'Achieved', 'Completed', 'Missed'])
    })

    it('period field is an enum with Daily | Weekly | Monthly | Quarterly | Yearly', () => {
      const field = Goal.$schema.fields.get('period')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'])
    })

    it('has achieve verb registered in schema verbs', () => {
      const schema = Goal.$schema
      expect(schema.verbs.has('achieve')).toBe(true)
      const verb = schema.verbs.get('achieve')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('achieve')
      expect(verb!.activity).toBe('achieving')
      expect(verb!.event).toBe('achieved')
    })
  })

  // ===========================================================================
  // 5. Event tracking (~6 tests)
  // ===========================================================================

  describe('Event tracking', () => {
    it('creates an event with properties as a serialized string', async () => {
      const props = JSON.stringify({ page: '/pricing', referrer: 'google.com' })
      const event = await Event.create({
        name: 'page_view',
        type: 'track',
        timestamp: '2024-06-15T10:30:00Z',
        properties: props,
      })
      expect(event.name).toBe('page_view')
      expect(event.properties).toBe(props)
    })

    it('events are append-only — update returns null', () => {
      expect(Event.update).toBeNull()
    })

    it('events are append-only — delete returns null', () => {
      expect(Event.delete).toBeNull()
    })

    it('can find events by type', async () => {
      await Event.create({ name: 'page_view', type: 'track', timestamp: '2024-06-15T10:00:00Z' })
      await Event.create({ name: 'signup', type: 'identify', timestamp: '2024-06-15T10:01:00Z' })
      await Event.create({ name: 'click_cta', type: 'track', timestamp: '2024-06-15T10:02:00Z' })

      const trackEvents = await Event.find({ type: 'track' })
      expect(trackEvents.length).toBe(2)
      expect(trackEvents.every((e: any) => e.type === 'track')).toBe(true)
    })

    it('creates event with all optional fields populated', async () => {
      const event = await Event.create({
        name: 'button_click',
        type: 'track',
        timestamp: '2024-06-15T11:00:00Z',
        source: 'Browser',
        sessionId: 'sess_abc123',
        userId: 'user_xyz789',
        anonymousId: 'anon_456',
        url: 'https://example.com/pricing',
        path: '/pricing',
        referrer: 'https://google.com',
        properties: JSON.stringify({ buttonId: 'cta-main' }),
      })
      expect(event.source).toBe('Browser')
      expect(event.sessionId).toBe('sess_abc123')
      expect(event.userId).toBe('user_xyz789')
      expect(event.anonymousId).toBe('anon_456')
      expect(event.url).toBe('https://example.com/pricing')
      expect(event.path).toBe('/pricing')
      expect(event.referrer).toBe('https://google.com')
    })

    it('can query events using $regex filter on name', async () => {
      await Event.create({ name: 'page_view_home', type: 'track', timestamp: '2024-06-15T10:00:00Z' })
      await Event.create({ name: 'page_view_pricing', type: 'track', timestamp: '2024-06-15T10:01:00Z' })
      await Event.create({ name: 'signup_complete', type: 'identify', timestamp: '2024-06-15T10:02:00Z' })

      const pageViews = await Event.find({ name: { $regex: '^page_view' } })
      expect(pageViews.length).toBe(2)
    })
  })

  // ===========================================================================
  // 6. Goal lifecycle (~8 tests)
  // ===========================================================================

  describe('Goal lifecycle', () => {
    it('creates an active goal with initial status', async () => {
      const goal = await Goal.create({
        name: 'Q1 Revenue',
        target: 100000,
        current: 0,
        status: 'OnTrack',
        period: 'Quarterly',
      })
      expectMetaFields(goal, 'Goal')
      expect(goal.name).toBe('Q1 Revenue')
      expect(goal.target).toBe(100000)
      expect(goal.current).toBe(0)
      expect(goal.status).toBe('OnTrack')
    })

    it('updates current value toward target', async () => {
      const goal = await Goal.create({
        name: 'Monthly Signups',
        target: 500,
        current: 0,
        status: 'OnTrack',
        period: 'Monthly',
      })

      const updated = await Goal.update(goal.$id, { current: 250 })
      expect(updated.current).toBe(250)
      expect(updated.$version).toBe(2)
    })

    it('can mark goal as AtRisk when behind pace', async () => {
      const goal = await Goal.create({
        name: 'Weekly Active Users',
        target: 1000,
        current: 100,
        status: 'OnTrack',
        period: 'Weekly',
      })

      const updated = await Goal.update(goal.$id, { status: 'AtRisk', current: 150 })
      expect(updated.status).toBe('AtRisk')
      expect(updated.current).toBe(150)
    })

    it('achieves goal using the achieve verb', async () => {
      const goal = await Goal.create({
        name: 'First 100 Users',
        target: 100,
        current: 95,
        status: 'OnTrack',
      })

      const achieved = await Goal.achieve(goal.$id, { current: 105 })
      expect(achieved.status).toBe('Achieved')
      expect(achieved.current).toBe(105)
    })

    it('can update goal status to Behind', async () => {
      const goal = await Goal.create({
        name: 'MRR Target',
        target: 50000,
        current: 10000,
        status: 'OnTrack',
        period: 'Monthly',
      })

      const updated = await Goal.update(goal.$id, { status: 'Behind' })
      expect(updated.status).toBe('Behind')
    })

    it('goal can reference a metric name', async () => {
      const metric = await Metric.create({
        name: 'MRR',
        value: 25000,
        type: 'Gauge',
        unit: 'USD',
      })

      const goal = await Goal.create({
        name: 'MRR Target Q1',
        target: 50000,
        current: 25000,
        unit: 'USD',
        status: 'OnTrack',
        period: 'Quarterly',
        description: `Tracking metric: ${metric.$id}`,
      })

      expect(goal.description).toContain(metric.$id)
      expect(goal.unit).toBe('USD')
    })

    it('find goals by status', async () => {
      await Goal.create({ name: 'Goal A', target: 100, current: 50, status: 'OnTrack' })
      await Goal.create({ name: 'Goal B', target: 200, current: 10, status: 'Behind' })
      await Goal.create({ name: 'Goal C', target: 50, current: 50, status: 'Achieved' })
      await Goal.create({ name: 'Goal D', target: 300, current: 280, status: 'OnTrack' })

      const onTrack = await Goal.find({ status: 'OnTrack' })
      expect(onTrack.length).toBe(2)
      expect(onTrack.every((g: any) => g.status === 'OnTrack')).toBe(true)
    })

    it('Goal.achieving registers a BEFORE hook', () => {
      const handler = vi.fn()
      const unsubscribe = Goal.achieving(handler)
      expect(typeof unsubscribe).toBe('function')
    })
  })

  // ===========================================================================
  // 7. Metric operations (~5 tests)
  // ===========================================================================

  describe('Metric operations', () => {
    it('creates a counter metric', async () => {
      const metric = await Metric.create({
        name: 'requests_total',
        value: 0,
        type: 'Counter',
        unit: 'count',
      })
      expectMetaFields(metric, 'Metric')
      expect(metric.name).toBe('requests_total')
      expect(metric.type).toBe('Counter')
    })

    it('updates metric value', async () => {
      const metric = await Metric.create({ name: 'cpu_usage', value: 45.2, type: 'Gauge', unit: 'percent' })
      const updated = await Metric.update(metric.$id, { value: 72.8 })
      expect(updated.value).toBe(72.8)
      expect(updated.$version).toBe(2)
    })

    it('find metrics by type', async () => {
      await Metric.create({ name: 'requests', value: 1000, type: 'Counter' })
      await Metric.create({ name: 'cpu', value: 55, type: 'Gauge' })
      await Metric.create({ name: 'latency', value: 120, type: 'Histogram' })
      await Metric.create({ name: 'errors', value: 5, type: 'Counter' })

      const counters = await Metric.find({ type: 'Counter' })
      expect(counters.length).toBe(2)
    })

    it('deletes a metric', async () => {
      const metric = await Metric.create({ name: 'temp_metric', value: 0 })
      const deleted = await Metric.delete(metric.$id)
      expect(deleted).toBe(true)
      const gone = await Metric.get(metric.$id)
      expect(gone).toBeNull()
    })

    it('metric with dimensions as serialized JSON', async () => {
      const dims = JSON.stringify({ region: 'us-east-1', service: 'api' })
      const metric = await Metric.create({
        name: 'latency_p99',
        value: 250,
        type: 'Summary',
        unit: 'ms',
        dimensions: dims,
      })
      expect(metric.dimensions).toBe(dims)
    })
  })
})
