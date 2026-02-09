import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Experiment, FeatureFlag } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

// =============================================================================
// Tests
// =============================================================================

describe('@headlessly/experiments — deep coverage', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Experiment Noun schema (~6 tests)
  // ===========================================================================

  describe('Experiment Noun schema', () => {
    it('has a name field of type string with required modifier', () => {
      const field = Experiment.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('has a hypothesis field of type string', () => {
      const field = Experiment.$schema.fields.get('hypothesis')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has a status enum field with Draft, Running, Paused, Completed, Archived values', () => {
      const field = Experiment.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toBeDefined()
      expect(field!.enumValues).toContain('Draft')
      expect(field!.enumValues).toContain('Running')
      expect(field!.enumValues).toContain('Paused')
      expect(field!.enumValues).toContain('Completed')
      expect(field!.enumValues).toContain('Archived')
    })

    it('has a type enum field with experiment types', () => {
      const field = Experiment.$schema.fields.get('type')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toContain('ABTest')
      expect(field!.enumValues).toContain('Multivariate')
      expect(field!.enumValues).toContain('FeatureFlag')
    })

    it('has startAt and endAt datetime fields', () => {
      const startAt = Experiment.$schema.fields.get('startAt')
      expect(startAt).toBeDefined()
      expect(startAt!.type).toBe('datetime')

      const endAt = Experiment.$schema.fields.get('endAt')
      expect(endAt).toBeDefined()
      expect(endAt!.type).toBe('datetime')
    })

    it('has relationship to Organization', () => {
      const rel = Experiment.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.targetType).toBe('Organization')
    })

    it('has variants, metrics, primaryMetric, results, winner fields', () => {
      for (const fieldName of ['variants', 'metrics', 'primaryMetric', 'results', 'winner']) {
        const field = Experiment.$schema.fields.get(fieldName)
        expect(field).toBeDefined()
        expect(field!.type).toBe('string')
      }
    })

    it('has numeric fields: trafficAllocation, confidence, sampleSize, conversions', () => {
      for (const fieldName of ['trafficAllocation', 'confidence', 'sampleSize', 'conversions']) {
        const field = Experiment.$schema.fields.get(fieldName)
        expect(field).toBeDefined()
        expect(field!.type).toBe('number')
      }
    })
  })

  // ===========================================================================
  // 2. FeatureFlag Noun schema (~6 tests)
  // ===========================================================================

  describe('FeatureFlag Noun schema', () => {
    it('has a key field that is required and unique', () => {
      const field = FeatureFlag.$schema.fields.get('key')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(true)
      expect(field!.modifiers?.unique).toBe(true)
    })

    it('has a name field that is required', () => {
      const field = FeatureFlag.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('has a description field of type string', () => {
      const field = FeatureFlag.$schema.fields.get('description')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has a type enum field with Boolean, String, Number, JSON', () => {
      const field = FeatureFlag.$schema.fields.get('type')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toContain('Boolean')
      expect(field!.enumValues).toContain('String')
      expect(field!.enumValues).toContain('Number')
      expect(field!.enumValues).toContain('JSON')
    })

    it('has a status enum field with Draft, Active, Paused, Archived', () => {
      const field = FeatureFlag.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toContain('Draft')
      expect(field!.enumValues).toContain('Active')
      expect(field!.enumValues).toContain('Paused')
      expect(field!.enumValues).toContain('Archived')
    })

    it('has rolloutPercentage as a number field', () => {
      const field = FeatureFlag.$schema.fields.get('rolloutPercentage')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('has relationship to Experiment', () => {
      const rel = FeatureFlag.$schema.relationships.get('experiment')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.targetType).toBe('Experiment')
    })

    it('has relationship to Organization', () => {
      const rel = FeatureFlag.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.targetType).toBe('Organization')
    })
  })

  // ===========================================================================
  // 3. Experiment verbs (~5 tests)
  // ===========================================================================

  describe('Experiment verbs', () => {
    it('has default CRUD verbs: create, update, delete', () => {
      const verbs = Experiment.$schema.verbs
      expect(verbs.has('create')).toBe(true)
      expect(verbs.has('update')).toBe(true)
      expect(verbs.has('delete')).toBe(true)
    })

    it('has custom start verb with full conjugation', () => {
      const verbs = Experiment.$schema.verbs
      expect(verbs.has('start')).toBe(true)
      const start = verbs.get('start')!
      expect(start.action).toBe('start')
      expect(start.activity).toBe('starting')
      expect(start.event).toBe('started')
    })

    it('has custom conclude verb with full conjugation', () => {
      const verbs = Experiment.$schema.verbs
      expect(verbs.has('conclude')).toBe(true)
      const conclude = verbs.get('conclude')!
      expect(conclude.action).toBe('conclude')
      expect(conclude.activity).toBe('concluding')
      expect(conclude.event).toBe('concluded')
    })

    it('has custom pause verb with full conjugation', () => {
      const verbs = Experiment.$schema.verbs
      expect(verbs.has('pause')).toBe(true)
      const pause = verbs.get('pause')!
      expect(pause.action).toBe('pause')
      expect(pause.activity).toBe('pausing')
      expect(pause.event).toBe('paused')
    })

    it('exposes verb action methods on the proxy', () => {
      expect(typeof Experiment.start).toBe('function')
      expect(typeof Experiment.conclude).toBe('function')
      expect(typeof Experiment.pause).toBe('function')
    })

    it('exposes BEFORE hook methods (activity forms) on the proxy', () => {
      expect(typeof Experiment.starting).toBe('function')
      expect(typeof Experiment.concluding).toBe('function')
      expect(typeof Experiment.pausing).toBe('function')
    })

    it('exposes AFTER hook methods (event forms) on the proxy', () => {
      expect(typeof Experiment.started).toBe('function')
      expect(typeof Experiment.concluded).toBe('function')
      expect(typeof Experiment.paused).toBe('function')
    })
  })

  // ===========================================================================
  // 4. FeatureFlag verbs (~5 tests)
  // ===========================================================================

  describe('FeatureFlag verbs', () => {
    it('has default CRUD verbs: create, update, delete', () => {
      const verbs = FeatureFlag.$schema.verbs
      expect(verbs.has('create')).toBe(true)
      expect(verbs.has('update')).toBe(true)
      expect(verbs.has('delete')).toBe(true)
    })

    it('has custom enable verb with full conjugation', () => {
      const verbs = FeatureFlag.$schema.verbs
      expect(verbs.has('enable')).toBe(true)
      const enable = verbs.get('enable')!
      expect(enable.action).toBe('enable')
      expect(enable.activity).toBe('enabling')
      expect(enable.event).toBe('enabled')
    })

    it('has custom disable verb with full conjugation', () => {
      const verbs = FeatureFlag.$schema.verbs
      expect(verbs.has('disable')).toBe(true)
      const disable = verbs.get('disable')!
      expect(disable.action).toBe('disable')
      expect(disable.activity).toBe('disabling')
      expect(disable.event).toBe('disabled')
    })

    it('has custom rollout verb with full conjugation', () => {
      const verbs = FeatureFlag.$schema.verbs
      expect(verbs.has('rollout')).toBe(true)
      const rollout = verbs.get('rollout')!
      expect(rollout.action).toBe('rollout')
      expect(rollout.activity).toBe('rollingout')
      expect(rollout.event).toBe('rolledout')
    })

    it('exposes verb action methods on the proxy', () => {
      expect(typeof FeatureFlag.enable).toBe('function')
      expect(typeof FeatureFlag.disable).toBe('function')
      expect(typeof FeatureFlag.rollout).toBe('function')
    })

    it('exposes hook registration for all custom verbs', () => {
      expect(typeof FeatureFlag.enabling).toBe('function')
      expect(typeof FeatureFlag.enabled).toBe('function')
      expect(typeof FeatureFlag.disabling).toBe('function')
      expect(typeof FeatureFlag.disabled).toBe('function')
      expect(typeof FeatureFlag.rollingout).toBe('function')
      expect(typeof FeatureFlag.rolledout).toBe('function')
    })
  })

  // ===========================================================================
  // 5. Experiment lifecycle (~7 tests)
  // ===========================================================================

  describe('Experiment lifecycle', () => {
    it('creates a draft experiment with all fields', async () => {
      const exp = await Experiment.create({
        name: 'Checkout Flow A/B Test',
        hypothesis: 'Simplified checkout increases conversions by 15%',
        status: 'Draft',
        type: 'ABTest',
        targetAudience: 'new-users',
        trafficAllocation: 50,
      })
      expect(exp.$type).toBe('Experiment')
      expect(exp.name).toBe('Checkout Flow A/B Test')
      expect(exp.hypothesis).toBe('Simplified checkout increases conversions by 15%')
      expect(exp.status).toBe('Draft')
      expect(exp.type).toBe('ABTest')
      expect(exp.trafficAllocation).toBe(50)
    })

    it('creates an experiment and retrieves it by id', async () => {
      const exp = await Experiment.create({ name: 'Pricing Test', status: 'Draft' })
      const fetched = await Experiment.get(exp.$id)
      expect(fetched).toBeDefined()
      expect(fetched!.$id).toBe(exp.$id)
      expect(fetched!.name).toBe('Pricing Test')
    })

    it('updates experiment fields via update()', async () => {
      const exp = await Experiment.create({ name: 'Color Test', status: 'Draft' })
      const updated = await Experiment.update(exp.$id, { name: 'Button Color Test', trafficAllocation: 75 })
      expect(updated.name).toBe('Button Color Test')
      expect(updated.trafficAllocation).toBe(75)
      expect(updated.$version).toBe(2)
    })

    it('start verb sets status on experiment via perform()', async () => {
      const exp = await Experiment.create({ name: 'Nav Test', status: 'Draft' })
      const started = await Experiment.start(exp.$id)
      expect(started).toBeDefined()
      // The start verb declares 'Started' which should resolve to status field
      expect(started.status).toBe('Started')
    })

    it('pause verb sets status on experiment', async () => {
      const exp = await Experiment.create({ name: 'Hero Test', status: 'Running' })
      const paused = await Experiment.pause(exp.$id)
      expect(paused).toBeDefined()
      // The pause verb target 'Paused' matches the status enum exactly
      expect(paused.status).toBe('Paused')
    })

    it('conclude verb sets status on experiment', async () => {
      const exp = await Experiment.create({ name: 'CTA Test', status: 'Running' })
      const concluded = await Experiment.conclude(exp.$id)
      expect(concluded).toBeDefined()
      expect(concluded.status).toBe('Concluded')
    })

    it('find returns experiments matching filter', async () => {
      await Experiment.create({ name: 'Experiment A', status: 'Draft' })
      await Experiment.create({ name: 'Experiment B', status: 'Running' })
      await Experiment.create({ name: 'Experiment C', status: 'Draft' })

      const drafts = await Experiment.find({ status: 'Draft' })
      expect(drafts.length).toBe(2)
      for (const draft of drafts) {
        expect(draft.status).toBe('Draft')
      }
    })

    it('deletes an experiment and confirms it is gone', async () => {
      const exp = await Experiment.create({ name: 'Temp Test', status: 'Draft' })
      const result = await Experiment.delete(exp.$id)
      expect(result).toBe(true)

      const gone = await Experiment.get(exp.$id)
      expect(gone).toBeNull()
    })
  })

  // ===========================================================================
  // 6. Feature flag operations (~7 tests)
  // ===========================================================================

  describe('FeatureFlag operations', () => {
    it('creates a feature flag with key and name', async () => {
      const flag = await FeatureFlag.create({
        key: 'dark-mode',
        name: 'Dark Mode',
        description: 'Enable dark mode UI',
        type: 'Boolean',
        status: 'Draft',
        defaultValue: 'false',
      })
      expect(flag.$type).toBe('FeatureFlag')
      expect(flag.key).toBe('dark-mode')
      expect(flag.name).toBe('Dark Mode')
      expect(flag.type).toBe('Boolean')
      expect(flag.defaultValue).toBe('false')
    })

    it('creates a flag and retrieves it by id', async () => {
      const flag = await FeatureFlag.create({ key: 'new-header', name: 'New Header' })
      const fetched = await FeatureFlag.get(flag.$id)
      expect(fetched).toBeDefined()
      expect(fetched!.key).toBe('new-header')
    })

    it('enable verb sets status on the flag', async () => {
      const flag = await FeatureFlag.create({ key: 'beta-feature', name: 'Beta Feature', status: 'Draft' })
      const enabled = await FeatureFlag.enable(flag.$id)
      expect(enabled).toBeDefined()
      expect(enabled.status).toBe('Enabled')
    })

    it('disable verb sets status on the flag', async () => {
      const flag = await FeatureFlag.create({ key: 'old-feature', name: 'Old Feature', status: 'Active' })
      const disabled = await FeatureFlag.disable(flag.$id)
      expect(disabled).toBeDefined()
      expect(disabled.status).toBe('Disabled')
    })

    it('rollout verb sets status on the flag', async () => {
      const flag = await FeatureFlag.create({ key: 'gradual-release', name: 'Gradual Release', status: 'Draft' })
      const rolledOut = await FeatureFlag.rollout(flag.$id)
      expect(rolledOut).toBeDefined()
      expect(rolledOut.status).toBe('RolledOut')
    })

    it('updates rolloutPercentage via update()', async () => {
      const flag = await FeatureFlag.create({ key: 'progressive-flag', name: 'Progressive', rolloutPercentage: 10 })
      const updated = await FeatureFlag.update(flag.$id, { rolloutPercentage: 50 })
      expect(updated.rolloutPercentage).toBe(50)
      expect(updated.$version).toBe(2)
    })

    it('find returns feature flags matching filter', async () => {
      await FeatureFlag.create({ key: 'flag-a', name: 'Flag A', status: 'Active' })
      await FeatureFlag.create({ key: 'flag-b', name: 'Flag B', status: 'Draft' })
      await FeatureFlag.create({ key: 'flag-c', name: 'Flag C', status: 'Active' })

      const active = await FeatureFlag.find({ status: 'Active' })
      expect(active.length).toBe(2)
      for (const flag of active) {
        expect(flag.status).toBe('Active')
      }
    })

    it('deletes a feature flag and confirms it is gone', async () => {
      const flag = await FeatureFlag.create({ key: 'temp-flag', name: 'Temp Flag' })
      const result = await FeatureFlag.delete(flag.$id)
      expect(result).toBe(true)

      const gone = await FeatureFlag.get(flag.$id)
      expect(gone).toBeNull()
    })
  })

  // ===========================================================================
  // 7. Hook registration and lifecycle hooks (~5 tests)
  // ===========================================================================

  describe('Hook registration', () => {
    it('registers a BEFORE hook on Experiment.starting and it fires on create', async () => {
      const beforeHook = vi.fn((data) => ({ ...data, hypothesis: 'Auto-generated hypothesis' }))
      Experiment.creating(beforeHook)

      const exp = await Experiment.create({ name: 'Hook Test' })
      expect(beforeHook).toHaveBeenCalledOnce()
      expect(exp.hypothesis).toBe('Auto-generated hypothesis')
    })

    it('registers an AFTER hook on Experiment.started and it fires on start', async () => {
      const afterHook = vi.fn()
      Experiment.started(afterHook)

      const exp = await Experiment.create({ name: 'After Hook Test', status: 'Draft' })
      const started = await Experiment.start(exp.$id)
      expect(afterHook).toHaveBeenCalledOnce()
      expect(afterHook).toHaveBeenCalledWith(started, undefined)
    })

    it('registers a BEFORE hook on FeatureFlag.enabling', async () => {
      const beforeHook = vi.fn()
      FeatureFlag.enabling(beforeHook)

      const flag = await FeatureFlag.create({ key: 'hook-flag', name: 'Hook Flag', status: 'Draft' })
      await FeatureFlag.enable(flag.$id)
      expect(beforeHook).toHaveBeenCalledOnce()
    })

    it('unsubscribe function returned from hook registration removes the hook', async () => {
      const hook = vi.fn()
      const unsub = Experiment.concluded(hook)

      const exp1 = await Experiment.create({ name: 'Unsub Test 1', status: 'Running' })
      await Experiment.conclude(exp1.$id)
      expect(hook).toHaveBeenCalledOnce()

      // Unsubscribe
      unsub()

      const exp2 = await Experiment.create({ name: 'Unsub Test 2', status: 'Running' })
      await Experiment.conclude(exp2.$id)
      // Should still be 1 call — the hook was removed
      expect(hook).toHaveBeenCalledOnce()
    })

    it('multiple hooks fire in registration order', async () => {
      const order: number[] = []
      Experiment.creating(() => {
        order.push(1)
      })
      Experiment.creating(() => {
        order.push(2)
      })
      Experiment.creating(() => {
        order.push(3)
      })

      await Experiment.create({ name: 'Multi-Hook Test' })
      expect(order).toEqual([1, 2, 3])
    })
  })

  // ===========================================================================
  // 8. Schema metadata (~3 tests)
  // ===========================================================================

  describe('Schema metadata', () => {
    it('Experiment.$name returns the correct name', () => {
      expect(Experiment.$name).toBe('Experiment')
    })

    it('FeatureFlag.$name returns the correct name', () => {
      expect(FeatureFlag.$name).toBe('FeatureFlag')
    })

    it('Experiment schema has correct slug', () => {
      expect(Experiment.$schema.slug).toBe('experiment')
    })

    it('FeatureFlag schema has correct slug', () => {
      expect(FeatureFlag.$schema.slug).toBe('feature-flag')
    })

    it('Experiment schema has correct plural form', () => {
      expect(Experiment.$schema.plural).toBe('experiments')
    })

    it('FeatureFlag schema has correct plural form', () => {
      expect(FeatureFlag.$schema.plural).toBe('feature flags')
    })
  })
})
