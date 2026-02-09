import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Event, Metric, Funnel, Goal } from '../src/index.ts'
import { setupTestProvider, expectMetaFields, expectCrudVerbs, expectVerbConjugation, testCrudLifecycle } from '../../test-utils'

describe('@headlessly/analytics', () => {
  setupTestProvider()

  describe('exports', () => {
    it('exports Event', () => {
      expect(Event).toBeDefined()
      expect(Event.$name).toBe('Event')
    })

    it('exports Metric', () => {
      expect(Metric).toBeDefined()
      expect(Metric.$name).toBe('Metric')
    })

    it('exports Funnel', () => {
      expect(Funnel).toBeDefined()
      expect(Funnel.$name).toBe('Funnel')
    })

    it('exports Goal', () => {
      expect(Goal).toBeDefined()
      expect(Goal.$name).toBe('Goal')
    })
  })

  describe('CRUD verbs', () => {
    it('Event has create, get, find (but update and delete are null)', () => {
      expect(typeof Event.create).toBe('function')
      expect(typeof Event.get).toBe('function')
      expect(typeof Event.find).toBe('function')
      expect(Event.update).toBeNull()
      expect(Event.delete).toBeNull()
    })

    it('Metric has standard CRUD verbs', () => {
      expectCrudVerbs(Metric)
    })

    it('Funnel has standard CRUD verbs', () => {
      expectCrudVerbs(Funnel)
    })

    it('Goal has standard CRUD verbs', () => {
      expectCrudVerbs(Goal)
    })
  })

  describe('verb conjugation', () => {
    it('Goal has achieve verb conjugation', () => {
      expectVerbConjugation(Goal, 'achieve', 'achieving', 'achieved')
    })
  })

  describe('Event immutability', () => {
    it('has update disabled (null)', () => {
      expect(Event.update).toBeNull()
    })

    it('has delete disabled (null)', () => {
      expect(Event.delete).toBeNull()
    })
  })

  describe('create with meta-fields', () => {
    it('Event has correct meta-fields on create', async () => {
      const event = await Event.create({ name: 'page_view', type: 'track', timestamp: '2024-01-15T10:00:00Z' })
      expectMetaFields(event, 'Event')
      expect(event.name).toBe('page_view')
      expect(event.type).toBe('track')
      expect(event.timestamp).toBe('2024-01-15T10:00:00Z')
    })

    it('Metric has correct meta-fields on create', async () => {
      const metric = await Metric.create({ name: 'MRR', value: 50000 })
      expectMetaFields(metric, 'Metric')
      expect(metric.name).toBe('MRR')
      expect(metric.value).toBe(50000)
    })

    it('Funnel has correct meta-fields on create', async () => {
      const funnel = await Funnel.create({ name: 'Signup Flow' })
      expectMetaFields(funnel, 'Funnel')
      expect(funnel.name).toBe('Signup Flow')
    })

    it('Goal has correct meta-fields on create', async () => {
      const goal = await Goal.create({ name: 'Q1 Revenue Target', target: 100000 })
      expectMetaFields(goal, 'Goal')
      expect(goal.name).toBe('Q1 Revenue Target')
      expect(goal.target).toBe(100000)
    })
  })

  describe('full CRUD lifecycle', () => {
    it('Event supports create and get only (immutable)', async () => {
      const created = await Event.create({ name: 'page_view', type: 'track', timestamp: '2024-01-15T10:00:00Z' })
      expectMetaFields(created, 'Event')
      expect(created.name).toBe('page_view')

      const fetched = await Event.get(created.$id)
      expect(fetched).toBeDefined()
      expect(fetched!.$id).toBe(created.$id)
      expect(fetched!.name).toBe('page_view')
    })

    it('Metric supports full CRUD lifecycle', async () => {
      await testCrudLifecycle(Metric, 'Metric', { name: 'MRR', value: 50000 }, { value: 75000 })
    })

    it('Funnel supports full CRUD lifecycle', async () => {
      await testCrudLifecycle(Funnel, 'Funnel', { name: 'Signup Flow' }, { name: 'Onboarding Flow' })
    })

    it('Goal supports full CRUD lifecycle', async () => {
      await testCrudLifecycle(Goal, 'Goal', { name: 'Q1 Revenue Target', target: 100000 }, { target: 150000 })
    })
  })
})
