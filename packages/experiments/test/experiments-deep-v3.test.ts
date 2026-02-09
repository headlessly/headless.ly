import { describe, it, expect, vi, afterEach } from 'vitest'
import { Experiment, FeatureFlag } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

// =============================================================================
// @headlessly/experiments — deep coverage v3
//
// 65+ NEW tests covering gaps not addressed in any previous test file.
//
// IMPORTANT: Hooks persist on the Noun proxy across tests (clearRegistry only
// resets the schema registry and provider, not proxy-level hooks). Every test
// that registers a hook MUST unsubscribe it to avoid poisoning later tests.
// =============================================================================

describe('@headlessly/experiments — deep coverage v3', () => {
  setupTestProvider()

  // Collect hook unsubscribe functions for automatic cleanup
  const unsubs: (() => void)[] = []
  afterEach(() => {
    for (const unsub of unsubs) unsub()
    unsubs.length = 0
  })

  // ===========================================================================
  // 1. Slug field modifier details (## = unique + indexed, NOT required)
  // ===========================================================================

  describe('Experiment slug field modifier parsing', () => {
    it('slug field has unique=true and indexed=true from ## modifier', () => {
      const field = Experiment.$schema.fields.get('slug')
      expect(field).toBeDefined()
      expect(field!.modifiers?.unique).toBe(true)
      expect(field!.modifiers?.indexed).toBe(true)
    })

    it('slug field is NOT required (no ! modifier)', () => {
      const field = Experiment.$schema.fields.get('slug')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('slug field is not optional (no ? modifier)', () => {
      const field = Experiment.$schema.fields.get('slug')
      expect(field!.modifiers?.optional).toBe(false)
    })

    it('slug field is not an array', () => {
      const field = Experiment.$schema.fields.get('slug')
      expect(field!.modifiers?.array).toBe(false)
    })
  })

  // ===========================================================================
  // 2. CRUD verb conjugation details (full conjugation for create/update/delete)
  // ===========================================================================

  describe('CRUD verb full conjugation details', () => {
    it('create verb: action=create, activity=creating, event=created', () => {
      const verb = Experiment.$schema.verbs.get('create')!
      expect(verb.action).toBe('create')
      expect(verb.activity).toBe('creating')
      expect(verb.event).toBe('created')
    })

    it('update verb: action=update, activity=updating, event=updated', () => {
      const verb = Experiment.$schema.verbs.get('update')!
      expect(verb.action).toBe('update')
      expect(verb.activity).toBe('updating')
      expect(verb.event).toBe('updated')
    })

    it('delete verb: action=delete, activity=deleting, event=deleted', () => {
      const verb = Experiment.$schema.verbs.get('delete')!
      expect(verb.action).toBe('delete')
      expect(verb.activity).toBe('deleting')
      expect(verb.event).toBe('deleted')
    })

    it('FeatureFlag create verb matches Experiment create verb conjugation', () => {
      const expVerb = Experiment.$schema.verbs.get('create')!
      const ffVerb = FeatureFlag.$schema.verbs.get('create')!
      expect(ffVerb.action).toBe(expVerb.action)
      expect(ffVerb.activity).toBe(expVerb.activity)
      expect(ffVerb.event).toBe(expVerb.event)
    })

    it('update verb has updatedBy and updatedAt reverse forms', () => {
      const verb = Experiment.$schema.verbs.get('update')!
      expect(verb.reverseBy).toBe('updatedBy')
      expect(verb.reverseAt).toBe('updatedAt')
    })
  })

  // ===========================================================================
  // 3. Rollout verb irregular conjugation (rollingOut, rolledOut)
  // ===========================================================================

  describe('Rollout verb irregular conjugation', () => {
    it('rollout activity is rollingOut (camelCase, irregular)', () => {
      const verb = FeatureFlag.$schema.verbs.get('rollout')!
      expect(verb.activity).toBe('rollingOut')
    })

    it('rollout event is rolledOut (camelCase, irregular)', () => {
      const verb = FeatureFlag.$schema.verbs.get('rollout')!
      expect(verb.event).toBe('rolledOut')
    })

    it('rollingOut is a function on FeatureFlag proxy (BEFORE hook registration)', () => {
      expect(typeof FeatureFlag.rollingOut).toBe('function')
    })

    it('rolledOut is a function on FeatureFlag proxy (AFTER hook registration)', () => {
      expect(typeof FeatureFlag.rolledOut).toBe('function')
    })

    it('rollout verb reverse forms are rolledOutBy and rolledOutAt', () => {
      const verb = FeatureFlag.$schema.verbs.get('rollout')!
      expect(verb.reverseBy).toBe('rolledOutBy')
      expect(verb.reverseAt).toBe('rolledOutAt')
    })
  })

  // ===========================================================================
  // 4. Schema disabledVerbs (should be empty for both entities)
  // ===========================================================================

  describe('disabledVerbs set', () => {
    it('Experiment has no disabled verbs', () => {
      expect(Experiment.$schema.disabledVerbs.size).toBe(0)
    })

    it('FeatureFlag has no disabled verbs', () => {
      expect(FeatureFlag.$schema.disabledVerbs.size).toBe(0)
    })
  })

  // ===========================================================================
  // 5. NounSchema singular form
  // ===========================================================================

  describe('NounSchema singular form', () => {
    it('Experiment singular is "experiment"', () => {
      expect(Experiment.$schema.singular).toBe('experiment')
    })

    it('FeatureFlag singular is "feature flag"', () => {
      expect(FeatureFlag.$schema.singular).toBe('feature flag')
    })
  })

  // ===========================================================================
  // 6. $updatedAt changes on update
  // ===========================================================================

  describe('$updatedAt behavior', () => {
    it('$updatedAt changes after update while $createdAt stays the same', async () => {
      const exp = await Experiment.create({ name: 'Timestamp Test' })
      const createdAt = exp.$createdAt
      const originalUpdated = exp.$updatedAt

      await new Promise((r) => setTimeout(r, 5))

      const updated = await Experiment.update(exp.$id, { name: 'Timestamp Test Updated' })
      expect(updated.$createdAt).toBe(createdAt)
      expect(updated.$updatedAt).not.toBe(originalUpdated)
    })

    it('$updatedAt changes after custom verb execution', async () => {
      const exp = await Experiment.create({ name: 'Verb Timestamp', status: 'Draft' })
      const originalUpdated = exp.$updatedAt

      await new Promise((r) => setTimeout(r, 5))

      const started = await Experiment.start(exp.$id)
      expect(started.$updatedAt).not.toBe(originalUpdated)
    })
  })

  // ===========================================================================
  // 7. BEFORE hook data transformation on update verb
  // ===========================================================================

  describe('BEFORE hook on update verb', () => {
    it('updating hook transforms data before update', async () => {
      const u = Experiment.updating((data) => ({
        ...data,
        name: typeof data.name === 'string' ? data.name.toUpperCase() : data.name,
      }))
      unsubs.push(u)

      const exp = await Experiment.create({ name: 'Original' })
      const updated = await Experiment.update(exp.$id, { name: 'modified' })
      expect(updated.name).toBe('MODIFIED')
    })
  })

  // ===========================================================================
  // 8. AFTER hooks for update and delete verbs
  // ===========================================================================

  describe('AFTER hooks for update and delete', () => {
    it('updated hook fires after update verb with new entity state', async () => {
      const hook = vi.fn()
      const u = Experiment.updated(hook)
      unsubs.push(u)

      const exp = await Experiment.create({ name: 'Update Hook Test' })
      await Experiment.update(exp.$id, { name: 'Changed' })

      expect(hook).toHaveBeenCalledOnce()
      const [entity] = hook.mock.calls[0]
      expect(entity.name).toBe('Changed')
      expect(entity.$version).toBe(2)
    })

    it('deleted hook fires after delete verb', async () => {
      const hook = vi.fn()
      const u = Experiment.deleted(hook)
      unsubs.push(u)

      const exp = await Experiment.create({ name: 'Delete Hook Test' })
      await Experiment.delete(exp.$id)

      expect(hook).toHaveBeenCalledOnce()
      const [entity] = hook.mock.calls[0]
      expect(entity.$type).toBe('Experiment')
    })
  })

  // ===========================================================================
  // 9. Chained BEFORE hook transforms (multiple hooks each modify data)
  // ===========================================================================

  describe('Chained BEFORE hook transforms', () => {
    it('multiple creating hooks chain transforms sequentially', async () => {
      const u1 = FeatureFlag.creating((data) => ({
        ...data,
        description: 'Step 1',
      }))
      const u2 = FeatureFlag.creating((data) => ({
        ...data,
        description: (data.description || '') + ' -> Step 2',
      }))
      const u3 = FeatureFlag.creating((data) => ({
        ...data,
        description: (data.description || '') + ' -> Step 3',
      }))
      unsubs.push(u1, u2, u3)

      const flag = await FeatureFlag.create({ key: 'chain-test', name: 'Chain Test' })
      expect(flag.description).toBe('Step 1 -> Step 2 -> Step 3')
    })
  })

  // ===========================================================================
  // 10. BEFORE hook that rejects (throws) prevents operation
  // ===========================================================================

  describe('BEFORE hook rejection', () => {
    it('creating hook that throws prevents entity creation', async () => {
      const u = Experiment.creating(() => {
        throw new Error('Validation failed: name required')
      })
      unsubs.push(u)

      await expect(Experiment.create({ name: 'Should Fail' })).rejects.toThrow('Validation failed')
    })

    it('deleting hook that throws prevents entity deletion', async () => {
      const exp = await Experiment.create({ name: 'Protected' })

      const u = Experiment.deleting(() => {
        throw new Error('Deletion blocked')
      })
      unsubs.push(u)

      await expect(Experiment.delete(exp.$id)).rejects.toThrow('Deletion blocked')

      // Entity should still exist
      const stillExists = await Experiment.get(exp.$id)
      expect(stillExists).toBeDefined()
      expect(stillExists!.name).toBe('Protected')
    })
  })

  // ===========================================================================
  // 11. BEFORE -> AFTER propagation (BEFORE transforms, AFTER sees result)
  // ===========================================================================

  describe('BEFORE -> AFTER propagation', () => {
    it('AFTER hook receives the data transformed by BEFORE hook', async () => {
      const afterSpy = vi.fn()

      const u1 = FeatureFlag.creating((data) => ({
        ...data,
        defaultValue: 'injected-by-before',
      }))
      const u2 = FeatureFlag.created(afterSpy)
      unsubs.push(u1, u2)

      const flag = await FeatureFlag.create({ key: 'propagation-test', name: 'Propagation' })

      expect(afterSpy).toHaveBeenCalledOnce()
      const [entity] = afterSpy.mock.calls[0]
      expect(entity.defaultValue).toBe('injected-by-before')
      expect(flag.defaultValue).toBe('injected-by-before')
    })
  })

  // ===========================================================================
  // 12. Delete hooks (deleting/deleted lifecycle)
  // ===========================================================================

  describe('Delete hooks lifecycle', () => {
    it('deleting hook fires before deletion', async () => {
      const beforeHook = vi.fn()
      const u = FeatureFlag.deleting(beforeHook)
      unsubs.push(u)

      const flag = await FeatureFlag.create({ key: 'del-hook', name: 'Del Hook' })
      await FeatureFlag.delete(flag.$id)

      expect(beforeHook).toHaveBeenCalledOnce()
    })

    it('deleted hook fires after deletion with entity info', async () => {
      const afterHook = vi.fn()
      const u = FeatureFlag.deleted(afterHook)
      unsubs.push(u)

      const flag = await FeatureFlag.create({ key: 'del-after', name: 'Del After' })
      await FeatureFlag.delete(flag.$id)

      expect(afterHook).toHaveBeenCalledOnce()
      const [entity] = afterHook.mock.calls[0]
      expect(entity.$type).toBe('FeatureFlag')
    })
  })

  // ===========================================================================
  // 13. MongoDB filter operators: $nin, $eq, $gte, $lt
  // ===========================================================================

  describe('Additional MongoDB filter operators', () => {
    it('$nin excludes experiments with specified statuses', async () => {
      await Experiment.create({ name: 'E1', status: 'Draft' })
      await Experiment.create({ name: 'E2', status: 'Running' })
      await Experiment.create({ name: 'E3', status: 'Completed' })

      const results = await Experiment.find({ status: { $nin: ['Draft', 'Completed'] } })
      expect(results.length).toBe(1)
      expect(results[0]!.status).toBe('Running')
    })

    it('$eq filters experiments by exact match', async () => {
      await Experiment.create({ name: 'Exact Match', status: 'Running' })
      await Experiment.create({ name: 'Not This', status: 'Draft' })

      const results = await Experiment.find({ status: { $eq: 'Running' } })
      expect(results.length).toBe(1)
      expect(results[0]!.name).toBe('Exact Match')
    })

    it('$gte filters by trafficAllocation >= threshold', async () => {
      await Experiment.create({ name: 'Low', trafficAllocation: 10 })
      await Experiment.create({ name: 'Mid', trafficAllocation: 50 })
      await Experiment.create({ name: 'High', trafficAllocation: 90 })

      const results = await Experiment.find({ trafficAllocation: { $gte: 50 } })
      expect(results.length).toBe(2)
    })

    it('$lt filters by trafficAllocation < threshold', async () => {
      await Experiment.create({ name: 'Low', trafficAllocation: 10 })
      await Experiment.create({ name: 'Mid', trafficAllocation: 50 })
      await Experiment.create({ name: 'High', trafficAllocation: 90 })

      const results = await Experiment.find({ trafficAllocation: { $lt: 50 } })
      expect(results.length).toBe(1)
      expect(results[0]!.name).toBe('Low')
    })
  })

  // ===========================================================================
  // 14. Combined filter operators on same field
  // ===========================================================================

  describe('Combined filter operators', () => {
    it('$gte + $lte combines to a range filter', async () => {
      await Experiment.create({ name: 'E10', trafficAllocation: 10 })
      await Experiment.create({ name: 'E50', trafficAllocation: 50 })
      await Experiment.create({ name: 'E75', trafficAllocation: 75 })
      await Experiment.create({ name: 'E100', trafficAllocation: 100 })

      const results = await Experiment.find({ trafficAllocation: { $gte: 50, $lte: 75 } })
      expect(results.length).toBe(2)
      for (const r of results) {
        expect(r.trafficAllocation as number).toBeGreaterThanOrEqual(50)
        expect(r.trafficAllocation as number).toBeLessThanOrEqual(75)
      }
    })

    it('$gt + $lt creates exclusive range', async () => {
      await Experiment.create({ name: 'R10', confidence: 10 })
      await Experiment.create({ name: 'R50', confidence: 50 })
      await Experiment.create({ name: 'R90', confidence: 90 })
      await Experiment.create({ name: 'R100', confidence: 100 })

      const results = await Experiment.find({ confidence: { $gt: 10, $lt: 100 } })
      expect(results.length).toBe(2)
    })
  })

  // ===========================================================================
  // 15. Multiple filter conditions at once
  // ===========================================================================

  describe('Multiple filter conditions', () => {
    it('filters by both status and type simultaneously', async () => {
      await Experiment.create({ name: 'AB Draft', status: 'Draft', type: 'ABTest' })
      await Experiment.create({ name: 'AB Running', status: 'Running', type: 'ABTest' })
      await Experiment.create({ name: 'MV Draft', status: 'Draft', type: 'Multivariate' })

      const results = await Experiment.find({ status: 'Draft', type: 'ABTest' })
      expect(results.length).toBe(1)
      expect(results[0]!.name).toBe('AB Draft')
    })

    it('filters by name regex and status together', async () => {
      await Experiment.create({ name: 'Checkout A/B', status: 'Running' })
      await Experiment.create({ name: 'Checkout Pricing', status: 'Draft' })
      await Experiment.create({ name: 'Header Color', status: 'Running' })

      const results = await Experiment.find({ name: { $regex: '^Checkout' }, status: 'Running' })
      expect(results.length).toBe(1)
      expect(results[0]!.name).toBe('Checkout A/B')
    })
  })

  // ===========================================================================
  // 16. Relationship backref parsing
  // ===========================================================================

  describe('Relationship backref details', () => {
    it('Experiment.organization has no backref (simple -> Organization)', () => {
      const rel = Experiment.$schema.relationships.get('organization')!
      expect(rel.backref).toBeUndefined()
    })

    it('Experiment.owner has no backref (simple -> Contact)', () => {
      const rel = Experiment.$schema.relationships.get('owner')!
      expect(rel.backref).toBeUndefined()
    })

    it('FeatureFlag.experiment has no backref (simple -> Experiment)', () => {
      const rel = FeatureFlag.$schema.relationships.get('experiment')!
      expect(rel.backref).toBeUndefined()
    })

    it('all relationships have isArray=false (no [] suffix)', () => {
      for (const [, rel] of Experiment.$schema.relationships) {
        expect(rel.isArray).toBe(false)
      }
      for (const [, rel] of FeatureFlag.$schema.relationships) {
        expect(rel.isArray).toBe(false)
      }
    })
  })

  // ===========================================================================
  // 17. FeatureFlag schema field count
  // ===========================================================================

  describe('FeatureFlag schema field count', () => {
    it('FeatureFlag schema has all expected field names', () => {
      const fields = FeatureFlag.$schema.fields
      const fieldNames = [...fields.keys()]
      expect(fieldNames).toContain('key')
      expect(fieldNames).toContain('name')
      expect(fieldNames).toContain('description')
      expect(fieldNames).toContain('type')
      expect(fieldNames).toContain('defaultValue')
      expect(fieldNames).toContain('variants')
      expect(fieldNames).toContain('targetingRules')
      expect(fieldNames).toContain('status')
      expect(fieldNames).toContain('rolloutPercentage')
      expect(fieldNames).toContain('evaluations')
      expect(fieldNames).toContain('lastEvaluatedAt')
    })
  })

  // ===========================================================================
  // 18. Raw schema key-by-key completeness for ALL keys
  // ===========================================================================

  describe('Raw schema key-by-key completeness', () => {
    it('Experiment raw has all 24 keys from the Noun definition', () => {
      const raw = Experiment.$schema.raw
      const keys = Object.keys(raw)
      const expected = [
        'name',
        'slug',
        'description',
        'hypothesis',
        'type',
        'status',
        'organization',
        'owner',
        'startAt',
        'endAt',
        'targetAudience',
        'trafficAllocation',
        'variants',
        'metrics',
        'primaryMetric',
        'results',
        'winner',
        'confidence',
        'sampleSize',
        'conversions',
        'tags',
        'start',
        'conclude',
        'pause',
      ]
      for (const key of expected) {
        expect(keys).toContain(key)
      }
      expect(keys.length).toBe(expected.length)
    })

    it('FeatureFlag raw has all 16 keys from the Noun definition', () => {
      const raw = FeatureFlag.$schema.raw
      const keys = Object.keys(raw)
      const expected = [
        'key',
        'name',
        'description',
        'organization',
        'experiment',
        'type',
        'defaultValue',
        'variants',
        'targetingRules',
        'status',
        'rolloutPercentage',
        'evaluations',
        'lastEvaluatedAt',
        'rollout',
        'enable',
        'disable',
      ]
      for (const key of expected) {
        expect(keys).toContain(key)
      }
      expect(keys.length).toBe(expected.length)
    })

    it('Experiment raw organization is "-> Organization"', () => {
      expect(Experiment.$schema.raw.organization).toBe('-> Organization')
    })

    it('Experiment raw owner is "-> Contact"', () => {
      expect(Experiment.$schema.raw.owner).toBe('-> Contact')
    })

    it('FeatureFlag raw experiment is "-> Experiment"', () => {
      expect(FeatureFlag.$schema.raw.experiment).toBe('-> Experiment')
    })

    it('Experiment raw slug is "string##"', () => {
      expect(Experiment.$schema.raw.slug).toBe('string##')
    })

    it('FeatureFlag raw key is "string!##"', () => {
      expect(FeatureFlag.$schema.raw.key).toBe('string!##')
    })

    it('Experiment raw trafficAllocation is "number"', () => {
      expect(Experiment.$schema.raw.trafficAllocation).toBe('number')
    })

    it('Experiment raw startAt is "datetime"', () => {
      expect(Experiment.$schema.raw.startAt).toBe('datetime')
    })

    it('FeatureFlag raw lastEvaluatedAt is "datetime"', () => {
      expect(FeatureFlag.$schema.raw.lastEvaluatedAt).toBe('datetime')
    })
  })

  // ===========================================================================
  // 19. Bulk CRUD operations
  // ===========================================================================

  describe('Bulk CRUD operations', () => {
    it('bulk create 10 experiments and find them all', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => Experiment.create({ name: `Bulk Exp ${i}`, status: 'Draft' }))
      const created = await Promise.all(promises)
      expect(created.length).toBe(10)

      const all = await Experiment.find({ status: 'Draft' })
      expect(all.length).toBe(10)
    })

    it('bulk update all experiments sequentially', async () => {
      const exps = await Promise.all(Array.from({ length: 5 }, (_, i) => Experiment.create({ name: `Batch ${i}`, status: 'Draft' })))

      const updates = await Promise.all(exps.map((e) => Experiment.update(e.$id, { status: 'Running' })))

      for (const u of updates) {
        expect(u.status).toBe('Running')
        expect(u.$version).toBe(2)
      }
    })

    it('bulk delete all feature flags', async () => {
      const flags = await Promise.all(Array.from({ length: 5 }, (_, i) => FeatureFlag.create({ key: `bulk-${i}`, name: `Bulk Flag ${i}` })))

      const deletes = await Promise.all(flags.map((f) => FeatureFlag.delete(f.$id)))

      for (const d of deletes) {
        expect(d).toBe(true)
      }

      const remaining = await FeatureFlag.find()
      expect(remaining.length).toBe(0)
    })
  })

  // ===========================================================================
  // 20. $type consistency across operations
  // ===========================================================================

  describe('$type consistency', () => {
    it('$type remains Experiment through create, update, and verb execution', async () => {
      const exp = await Experiment.create({ name: 'Type Check', status: 'Draft' })
      expect(exp.$type).toBe('Experiment')

      const updated = await Experiment.update(exp.$id, { name: 'Type Check Updated' })
      expect(updated.$type).toBe('Experiment')

      const started = await Experiment.start(exp.$id)
      expect(started.$type).toBe('Experiment')
    })

    it('$type remains FeatureFlag through create, update, and verb execution', async () => {
      const flag = await FeatureFlag.create({ key: 'type-check', name: 'Type Check', status: 'Draft' })
      expect(flag.$type).toBe('FeatureFlag')

      const updated = await FeatureFlag.update(flag.$id, { name: 'Updated Type Check' })
      expect(updated.$type).toBe('FeatureFlag')

      const enabled = await FeatureFlag.enable(flag.$id)
      expect(enabled.$type).toBe('FeatureFlag')
    })
  })

  // ===========================================================================
  // 21. Hook unsubscribe for custom verb hooks
  // ===========================================================================

  describe('Hook unsubscribe for custom verbs', () => {
    it('unsubscribe from starting hook stops it from firing', async () => {
      const hook = vi.fn()
      const u = Experiment.starting(hook)

      const exp1 = await Experiment.create({ name: 'Unsub Start 1', status: 'Draft' })
      await Experiment.start(exp1.$id)
      expect(hook).toHaveBeenCalledOnce()

      u()

      const exp2 = await Experiment.create({ name: 'Unsub Start 2', status: 'Draft' })
      await Experiment.start(exp2.$id)
      expect(hook).toHaveBeenCalledOnce() // still 1
    })

    it('unsubscribe from enabling hook stops it from firing', async () => {
      const hook = vi.fn()
      const u = FeatureFlag.enabling(hook)

      const flag1 = await FeatureFlag.create({ key: 'unsub-en-1', name: 'UE1', status: 'Draft' })
      await FeatureFlag.enable(flag1.$id)
      expect(hook).toHaveBeenCalledOnce()

      u()

      const flag2 = await FeatureFlag.create({ key: 'unsub-en-2', name: 'UE2', status: 'Draft' })
      await FeatureFlag.enable(flag2.$id)
      expect(hook).toHaveBeenCalledOnce()
    })
  })

  // ===========================================================================
  // 22. State machine transition paths for Experiment
  // ===========================================================================

  describe('Experiment state machine transitions', () => {
    it('Draft -> Started via start verb', async () => {
      const exp = await Experiment.create({ name: 'SM1', status: 'Draft' })
      const started = await Experiment.start(exp.$id)
      expect(started.status).toBe('Started')
    })

    it('Running -> Paused via pause verb (Paused matches enum)', async () => {
      const exp = await Experiment.create({ name: 'SM2', status: 'Running' })
      const paused = await Experiment.pause(exp.$id)
      expect(paused.status).toBe('Paused')
    })

    it('Running -> Concluded via conclude verb', async () => {
      const exp = await Experiment.create({ name: 'SM3', status: 'Running' })
      const concluded = await Experiment.conclude(exp.$id)
      expect(concluded.status).toBe('Concluded')
    })

    it('Draft -> Paused via pause verb (transition from Draft)', async () => {
      const exp = await Experiment.create({ name: 'SM4', status: 'Draft' })
      const paused = await Experiment.pause(exp.$id)
      expect(paused.status).toBe('Paused')
    })

    it('Completed -> Started via start verb (re-run)', async () => {
      const exp = await Experiment.create({ name: 'SM5', status: 'Completed' })
      const started = await Experiment.start(exp.$id)
      expect(started.status).toBe('Started')
    })
  })

  // ===========================================================================
  // 23. State machine transition paths for FeatureFlag
  // ===========================================================================

  describe('FeatureFlag state machine transitions', () => {
    it('Draft -> Enabled via enable verb', async () => {
      const flag = await FeatureFlag.create({ key: 'sm-ff-1', name: 'SM FF1', status: 'Draft' })
      const enabled = await FeatureFlag.enable(flag.$id)
      expect(enabled.status).toBe('Enabled')
    })

    it('Active -> Disabled via disable verb', async () => {
      const flag = await FeatureFlag.create({ key: 'sm-ff-2', name: 'SM FF2', status: 'Active' })
      const disabled = await FeatureFlag.disable(flag.$id)
      expect(disabled.status).toBe('Disabled')
    })

    it('Draft -> RolledOut via rollout verb', async () => {
      const flag = await FeatureFlag.create({ key: 'sm-ff-3', name: 'SM FF3', status: 'Draft' })
      const rolledOut = await FeatureFlag.rollout(flag.$id)
      expect(rolledOut.status).toBe('RolledOut')
    })

    it('Paused -> Enabled via enable verb (resume)', async () => {
      const flag = await FeatureFlag.create({ key: 'sm-ff-4', name: 'SM FF4', status: 'Paused' })
      const enabled = await FeatureFlag.enable(flag.$id)
      expect(enabled.status).toBe('Enabled')
    })

    it('Active -> RolledOut via rollout verb (full rollout)', async () => {
      const flag = await FeatureFlag.create({ key: 'sm-ff-5', name: 'SM FF5', status: 'Active' })
      const rolledOut = await FeatureFlag.rollout(flag.$id)
      expect(rolledOut.status).toBe('RolledOut')
    })
  })

  // ===========================================================================
  // 24. Custom verb with additional data merge
  // ===========================================================================

  describe('Custom verb with additional data', () => {
    it('start verb with extra data merges transition + data', async () => {
      const exp = await Experiment.create({ name: 'Data Merge', status: 'Draft' })
      const started = await Experiment.start(exp.$id, { trafficAllocation: 100 })
      expect(started.status).toBe('Started')
      expect(started.trafficAllocation).toBe(100)
    })

    it('enable verb with extra data merges transition + data', async () => {
      const flag = await FeatureFlag.create({ key: 'extra-data', name: 'Extra Data', status: 'Draft' })
      const enabled = await FeatureFlag.enable(flag.$id, { rolloutPercentage: 50 })
      expect(enabled.status).toBe('Enabled')
      expect(enabled.rolloutPercentage).toBe(50)
    })
  })

  // ===========================================================================
  // 25. Concurrent mixed operations
  // ===========================================================================

  describe('Concurrent mixed operations', () => {
    it('concurrent create and find do not interfere', async () => {
      const createPromise = Experiment.create({ name: 'Concurrent Create', status: 'Draft' })
      const findPromise = Experiment.find({ status: 'Draft' })

      const [created, found] = await Promise.all([createPromise, findPromise])
      expect(created.$type).toBe('Experiment')
      expect(Array.isArray(found)).toBe(true)
    })

    it('concurrent updates to different experiments succeed independently', async () => {
      const exp1 = await Experiment.create({ name: 'Concurrent 1', status: 'Draft' })
      const exp2 = await Experiment.create({ name: 'Concurrent 2', status: 'Draft' })

      const [updated1, updated2] = await Promise.all([
        Experiment.update(exp1.$id, { status: 'Running' }),
        Experiment.update(exp2.$id, { status: 'Completed' }),
      ])

      expect(updated1.status).toBe('Running')
      expect(updated2.status).toBe('Completed')
      expect(updated1.$id).not.toBe(updated2.$id)
    })
  })

  // ===========================================================================
  // 26. Custom verb version increments
  // ===========================================================================

  describe('Custom verb version increments', () => {
    it('sequential custom verbs each increment version', async () => {
      const exp = await Experiment.create({ name: 'Multi Verb', status: 'Draft' })
      expect(exp.$version).toBe(1)

      const started = await Experiment.start(exp.$id)
      expect(started.$version).toBe(2)

      const paused = await Experiment.pause(exp.$id)
      expect(paused.$version).toBe(3)

      const concluded = await Experiment.conclude(exp.$id)
      expect(concluded.$version).toBe(4)
    })

    it('FeatureFlag verb sequence increments correctly', async () => {
      const flag = await FeatureFlag.create({ key: 'version-seq', name: 'VS', status: 'Draft' })
      expect(flag.$version).toBe(1)

      const enabled = await FeatureFlag.enable(flag.$id)
      expect(enabled.$version).toBe(2)

      const disabled = await FeatureFlag.disable(flag.$id)
      expect(disabled.$version).toBe(3)

      const rolledOut = await FeatureFlag.rollout(flag.$id)
      expect(rolledOut.$version).toBe(4)
    })
  })

  // ===========================================================================
  // 27. Experiment tags field operations
  // ===========================================================================

  describe('Experiment tags field', () => {
    it('stores comma-separated tags and retrieves them', async () => {
      const exp = await Experiment.create({ name: 'Tagged', tags: 'checkout,pricing,urgent' })
      expect(exp.tags).toBe('checkout,pricing,urgent')

      const fetched = await Experiment.get(exp.$id)
      expect(fetched!.tags).toBe('checkout,pricing,urgent')
    })

    it('tags field schema is plain string kind', () => {
      const field = Experiment.$schema.fields.get('tags')!
      expect(field.kind).toBe('field')
      expect(field.type).toBe('string')
      expect(field.modifiers?.required).toBe(false)
    })
  })

  // ===========================================================================
  // 28. FeatureFlag variants and targetingRules field schema
  // ===========================================================================

  describe('FeatureFlag variants and targetingRules field schema', () => {
    it('variants field is a plain string', () => {
      const field = FeatureFlag.$schema.fields.get('variants')!
      expect(field.kind).toBe('field')
      expect(field.type).toBe('string')
    })

    it('targetingRules field is a plain string', () => {
      const field = FeatureFlag.$schema.fields.get('targetingRules')!
      expect(field.kind).toBe('field')
      expect(field.type).toBe('string')
    })
  })

  // ===========================================================================
  // 29. Experiment results-related field schema
  // ===========================================================================

  describe('Experiment results-related field schema', () => {
    it('winner field is a plain string', () => {
      const field = Experiment.$schema.fields.get('winner')!
      expect(field.kind).toBe('field')
      expect(field.type).toBe('string')
      expect(field.modifiers?.required).toBe(false)
    })

    it('results field is a plain string', () => {
      const field = Experiment.$schema.fields.get('results')!
      expect(field.kind).toBe('field')
      expect(field.type).toBe('string')
    })

    it('primaryMetric field is a plain string', () => {
      const field = Experiment.$schema.fields.get('primaryMetric')!
      expect(field.kind).toBe('field')
      expect(field.type).toBe('string')
    })

    it('metrics field is a plain string', () => {
      const field = Experiment.$schema.fields.get('metrics')!
      expect(field.kind).toBe('field')
      expect(field.type).toBe('string')
    })
  })

  // ===========================================================================
  // 30. $context consistency
  // ===========================================================================

  describe('$context consistency', () => {
    it('$context is identical for Experiment and FeatureFlag in same provider', async () => {
      const exp = await Experiment.create({ name: 'Context Test' })
      const flag = await FeatureFlag.create({ key: 'ctx-flag', name: 'Context Flag' })
      expect(exp.$context).toBe(flag.$context)
    })

    it('$context does not change after update', async () => {
      const exp = await Experiment.create({ name: 'Ctx Persist' })
      const original = exp.$context
      const updated = await Experiment.update(exp.$id, { name: 'Ctx Persist Updated' })
      expect(updated.$context).toBe(original)
    })
  })

  // ===========================================================================
  // 31. $id immutability through operations
  // ===========================================================================

  describe('$id immutability', () => {
    it('$id does not change after update', async () => {
      const exp = await Experiment.create({ name: 'ID Persist' })
      const updated = await Experiment.update(exp.$id, { name: 'ID Persist Updated' })
      expect(updated.$id).toBe(exp.$id)
    })

    it('$id does not change after custom verb', async () => {
      const flag = await FeatureFlag.create({ key: 'id-verb', name: 'ID Verb', status: 'Draft' })
      const enabled = await FeatureFlag.enable(flag.$id)
      expect(enabled.$id).toBe(flag.$id)
    })
  })

  // ===========================================================================
  // 32. Experiment Noun proxy has no undefined for non-existent properties
  // ===========================================================================

  describe('Noun proxy property access', () => {
    it('accessing non-existent property on Experiment proxy returns undefined', () => {
      expect(Experiment.nonExistentProperty).toBeUndefined()
    })

    it('accessing non-existent property on FeatureFlag proxy returns undefined', () => {
      expect(FeatureFlag.nonExistentProperty).toBeUndefined()
    })

    it('symbol property access returns undefined', () => {
      const sym = Symbol('test')
      expect((Experiment as any)[sym]).toBeUndefined()
    })
  })
})
