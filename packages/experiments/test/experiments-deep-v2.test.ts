import { describe, it, expect, vi } from 'vitest'
import { Experiment, FeatureFlag } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

// =============================================================================
// @headlessly/experiments — deep coverage v2
//
// 40+ NEW tests covering gaps not addressed in entities.test.ts or
// experiments-deep.test.ts:
//
//   - Field modifier details (required, optional, indexed, unique)
//   - Relationship operator/direction parsing
//   - Verb reverseBy / reverseAt forms
//   - MongoDB-style filter operators ($gt, $in, $regex, etc.)
//   - Cross-entity isolation (Experiment.find never returns FeatureFlags)
//   - Version increment chains (multiple sequential updates)
//   - Meta-field format validation ($id pattern, $context URL, timestamps)
//   - Edge cases: empty find, get non-existent, delete non-existent
//   - Update non-existent entity throws
//   - Experiment type enum completeness (all 5 values)
//   - FeatureFlag type enum completeness (all 4 values)
//   - Percentage rollout edge cases (0%, 100%, boundary values)
//   - JSON-serialised variant/targeting-rule storage
//   - Numeric field storage and querying (confidence, sampleSize, etc.)
//   - Concurrent creates produce distinct IDs
//   - BEFORE hooks that transform data for custom verbs
//   - AFTER hooks on custom verbs (concluded, paused, disabled, rolledout)
//   - Hook interaction with verb state transitions
//   - Full enum value sets as stored data
//   - FeatureFlag evaluations & lastEvaluatedAt tracking
//   - Raw schema definition preserved on $schema.raw
// =============================================================================

describe('@headlessly/experiments — deep coverage v2', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Field modifier details
  // ===========================================================================

  describe('Experiment field modifier details', () => {
    it('name field is required (! modifier)', () => {
      const field = Experiment.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.modifiers?.required).toBe(true)
      expect(field!.modifiers?.optional).toBe(false)
    })

    it('slug field is unique and indexed (## modifier)', () => {
      const field = Experiment.$schema.fields.get('slug')
      expect(field).toBeDefined()
      expect(field!.modifiers?.unique).toBe(true)
      expect(field!.modifiers?.indexed).toBe(true)
    })

    it('description field has no required/unique modifiers', () => {
      const field = Experiment.$schema.fields.get('description')
      expect(field).toBeDefined()
      expect(field!.modifiers?.required).toBe(false)
      expect(field!.modifiers?.unique).toBe(false)
      expect(field!.modifiers?.indexed).toBe(false)
    })

    it('hypothesis field is optional string (no modifiers)', () => {
      const field = Experiment.$schema.fields.get('hypothesis')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('targetAudience is a plain string field', () => {
      const field = Experiment.$schema.fields.get('targetAudience')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })
  })

  describe('FeatureFlag field modifier details', () => {
    it('key field is required AND unique (! and ## modifiers)', () => {
      const field = FeatureFlag.$schema.fields.get('key')
      expect(field).toBeDefined()
      expect(field!.modifiers?.required).toBe(true)
      expect(field!.modifiers?.unique).toBe(true)
      expect(field!.modifiers?.indexed).toBe(true)
    })

    it('name field is required but not unique', () => {
      const field = FeatureFlag.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.modifiers?.required).toBe(true)
      expect(field!.modifiers?.unique).toBe(false)
    })

    it('defaultValue is a plain string field', () => {
      const field = FeatureFlag.$schema.fields.get('defaultValue')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('evaluations is a number field', () => {
      const field = FeatureFlag.$schema.fields.get('evaluations')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('lastEvaluatedAt is a datetime field', () => {
      const field = FeatureFlag.$schema.fields.get('lastEvaluatedAt')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })
  })

  // ===========================================================================
  // 2. Relationship operator and direction parsing
  // ===========================================================================

  describe('Relationship details', () => {
    it('Experiment.organization is a forward relationship (->)', () => {
      const rel = Experiment.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
    })

    it('Experiment.owner is a forward relationship to Contact', () => {
      const rel = Experiment.$schema.relationships.get('owner')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Contact')
    })

    it('FeatureFlag.experiment is a forward relationship to Experiment', () => {
      const rel = FeatureFlag.$schema.relationships.get('experiment')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Experiment')
    })

    it('FeatureFlag.organization is a forward relationship to Organization', () => {
      const rel = FeatureFlag.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
    })
  })

  // ===========================================================================
  // 3. Verb reverseBy / reverseAt forms
  // ===========================================================================

  describe('Verb reverse forms', () => {
    it('start verb has startedBy and startedAt reverse forms', () => {
      const verb = Experiment.$schema.verbs.get('start')
      expect(verb).toBeDefined()
      expect(verb!.reverseBy).toBe('startedBy')
      expect(verb!.reverseAt).toBe('startedAt')
    })

    it('conclude verb has concludedBy and concludedAt reverse forms', () => {
      const verb = Experiment.$schema.verbs.get('conclude')
      expect(verb).toBeDefined()
      expect(verb!.reverseBy).toBe('concludedBy')
      expect(verb!.reverseAt).toBe('concludedAt')
    })

    it('pause verb has pausedBy and pausedAt reverse forms', () => {
      const verb = Experiment.$schema.verbs.get('pause')
      expect(verb).toBeDefined()
      expect(verb!.reverseBy).toBe('pausedBy')
      expect(verb!.reverseAt).toBe('pausedAt')
    })

    it('enable verb has enabledBy and enabledAt reverse forms', () => {
      const verb = FeatureFlag.$schema.verbs.get('enable')
      expect(verb).toBeDefined()
      expect(verb!.reverseBy).toBe('enabledBy')
      expect(verb!.reverseAt).toBe('enabledAt')
    })

    it('disable verb has disabledBy and disabledAt reverse forms', () => {
      const verb = FeatureFlag.$schema.verbs.get('disable')
      expect(verb).toBeDefined()
      expect(verb!.reverseBy).toBe('disabledBy')
      expect(verb!.reverseAt).toBe('disabledAt')
    })

    it('rollout verb has rolledoutBy and rolledoutAt reverse forms', () => {
      const verb = FeatureFlag.$schema.verbs.get('rollout')
      expect(verb).toBeDefined()
      expect(verb!.reverseBy).toBe('rolledoutBy')
      expect(verb!.reverseAt).toBe('rolledoutAt')
    })

    it('create verb has createdBy and createdAt reverse forms', () => {
      const verb = Experiment.$schema.verbs.get('create')
      expect(verb).toBeDefined()
      expect(verb!.reverseBy).toBe('createdBy')
      expect(verb!.reverseAt).toBe('createdAt')
    })

    it('delete verb has deletedBy and deletedAt reverse forms', () => {
      const verb = FeatureFlag.$schema.verbs.get('delete')
      expect(verb).toBeDefined()
      expect(verb!.reverseBy).toBe('deletedBy')
      expect(verb!.reverseAt).toBe('deletedAt')
    })
  })

  // ===========================================================================
  // 4. Cross-entity isolation
  // ===========================================================================

  describe('Cross-entity isolation', () => {
    it('Experiment.find does not return FeatureFlag instances', async () => {
      await Experiment.create({ name: 'Cross-entity Exp' })
      await FeatureFlag.create({ key: 'cross-flag', name: 'Cross Flag' })

      const experiments = await Experiment.find()
      for (const exp of experiments) {
        expect(exp.$type).toBe('Experiment')
      }
      expect(experiments.length).toBe(1)
    })

    it('FeatureFlag.find does not return Experiment instances', async () => {
      await Experiment.create({ name: 'Another Exp' })
      await FeatureFlag.create({ key: 'iso-flag', name: 'Iso Flag' })

      const flags = await FeatureFlag.find()
      for (const flag of flags) {
        expect(flag.$type).toBe('FeatureFlag')
      }
      expect(flags.length).toBe(1)
    })
  })

  // ===========================================================================
  // 5. Meta-field format validation
  // ===========================================================================

  describe('Meta-field format validation', () => {
    it('$id follows {lowercase_type}_{8-char sqid} pattern for Experiment', async () => {
      const exp = await Experiment.create({ name: 'ID Test' })
      expect(exp.$id).toMatch(/^experiment_[a-zA-Z0-9]{8}$/)
    })

    it('$id follows {lowercase_type}_{8-char sqid} pattern for FeatureFlag', async () => {
      const flag = await FeatureFlag.create({ key: 'id-test', name: 'ID Test' })
      expect(flag.$id).toMatch(/^featureflag_[a-zA-Z0-9]{8}$/)
    })

    it('$context is a headless.ly URL', async () => {
      const exp = await Experiment.create({ name: 'Context Test' })
      expect(exp.$context).toMatch(/^https:\/\/headless\.ly\/~/)
    })

    it('$createdAt is a valid ISO-8601 timestamp', async () => {
      const exp = await Experiment.create({ name: 'Timestamp Test' })
      expect(exp.$createdAt).toBeDefined()
      const parsed = new Date(exp.$createdAt)
      expect(parsed.getTime()).not.toBeNaN()
    })

    it('$updatedAt is a valid ISO-8601 timestamp', async () => {
      const flag = await FeatureFlag.create({ key: 'ts-flag', name: 'TS Flag' })
      const parsed = new Date(flag.$updatedAt)
      expect(parsed.getTime()).not.toBeNaN()
    })

    it('$version starts at 1 for new entities', async () => {
      const exp = await Experiment.create({ name: 'Version Test' })
      expect(exp.$version).toBe(1)
    })
  })

  // ===========================================================================
  // 6. Edge cases: empty find, non-existent get/delete, update non-existent
  // ===========================================================================

  describe('Edge cases', () => {
    it('find with no matching filter returns empty array', async () => {
      const results = await Experiment.find({ status: 'NoSuchStatus' })
      expect(results).toEqual([])
    })

    it('find with no entities returns empty array', async () => {
      const results = await Experiment.find()
      expect(results).toEqual([])
    })

    it('get with non-existent ID returns null', async () => {
      const result = await Experiment.get('experiment_ZZZZZZZZ')
      expect(result).toBeNull()
    })

    it('delete a non-existent entity returns false', async () => {
      const result = await Experiment.delete('experiment_ZZZZZZZZ')
      expect(result).toBe(false)
    })

    it('update a non-existent entity throws an error', async () => {
      await expect(Experiment.update('experiment_ZZZZZZZZ', { name: 'Ghost' })).rejects.toThrow()
    })
  })

  // ===========================================================================
  // 7. Version increment chains
  // ===========================================================================

  describe('Version increment chains', () => {
    it('three sequential updates increment version to 4', async () => {
      const exp = await Experiment.create({ name: 'V1', status: 'Draft' })
      expect(exp.$version).toBe(1)

      const v2 = await Experiment.update(exp.$id, { name: 'V2' })
      expect(v2.$version).toBe(2)

      const v3 = await Experiment.update(exp.$id, { name: 'V3' })
      expect(v3.$version).toBe(3)

      const v4 = await Experiment.update(exp.$id, { name: 'V4' })
      expect(v4.$version).toBe(4)
    })

    it('custom verb (start) also increments version', async () => {
      const exp = await Experiment.create({ name: 'Verb Version', status: 'Draft' })
      expect(exp.$version).toBe(1)

      const started = await Experiment.start(exp.$id)
      expect(started.$version).toBe(2)
    })
  })

  // ===========================================================================
  // 8. Experiment type enum completeness
  // ===========================================================================

  describe('Experiment type enum completeness', () => {
    it('type enum contains exactly 5 values', () => {
      const field = Experiment.$schema.fields.get('type')
      expect(field!.enumValues).toHaveLength(5)
    })

    it('type enum includes MLExperiment and PromptExperiment', () => {
      const field = Experiment.$schema.fields.get('type')
      expect(field!.enumValues).toContain('MLExperiment')
      expect(field!.enumValues).toContain('PromptExperiment')
    })

    it('can create experiments with each type', async () => {
      const types = ['ABTest', 'Multivariate', 'FeatureFlag', 'MLExperiment', 'PromptExperiment']
      for (const type of types) {
        const exp = await Experiment.create({ name: `Type ${type}`, type })
        expect(exp.type).toBe(type)
      }
    })
  })

  // ===========================================================================
  // 9. FeatureFlag type enum completeness
  // ===========================================================================

  describe('FeatureFlag type enum completeness', () => {
    it('type enum contains exactly 4 values', () => {
      const field = FeatureFlag.$schema.fields.get('type')
      expect(field!.enumValues).toHaveLength(4)
    })

    it('can create feature flags with each type', async () => {
      const types = ['Boolean', 'String', 'Number', 'JSON']
      for (const type of types) {
        const flag = await FeatureFlag.create({ key: `flag-${type.toLowerCase()}`, name: `${type} Flag`, type })
        expect(flag.type).toBe(type)
      }
    })
  })

  // ===========================================================================
  // 10. Percentage rollout edge cases
  // ===========================================================================

  describe('Percentage rollout edge cases', () => {
    it('stores rolloutPercentage of 0 (fully off)', async () => {
      const flag = await FeatureFlag.create({ key: 'zero-pct', name: 'Zero Percent', rolloutPercentage: 0 })
      expect(flag.rolloutPercentage).toBe(0)
    })

    it('stores rolloutPercentage of 100 (fully on)', async () => {
      const flag = await FeatureFlag.create({ key: 'full-pct', name: 'Full Percent', rolloutPercentage: 100 })
      expect(flag.rolloutPercentage).toBe(100)
    })

    it('updates rolloutPercentage incrementally from 10 to 25 to 50 to 100', async () => {
      const flag = await FeatureFlag.create({ key: 'gradual', name: 'Gradual', rolloutPercentage: 10 })
      expect(flag.rolloutPercentage).toBe(10)

      const step2 = await FeatureFlag.update(flag.$id, { rolloutPercentage: 25 })
      expect(step2.rolloutPercentage).toBe(25)

      const step3 = await FeatureFlag.update(flag.$id, { rolloutPercentage: 50 })
      expect(step3.rolloutPercentage).toBe(50)

      const step4 = await FeatureFlag.update(flag.$id, { rolloutPercentage: 100 })
      expect(step4.rolloutPercentage).toBe(100)
    })
  })

  // ===========================================================================
  // 11. JSON-serialized variant and targeting-rule storage
  // ===========================================================================

  describe('Variant and targeting rule storage', () => {
    it('stores JSON-encoded variant definitions on Experiment', async () => {
      const variants = JSON.stringify([
        { name: 'control', weight: 50 },
        { name: 'treatment', weight: 50 },
      ])
      const exp = await Experiment.create({ name: 'Variant Test', variants })
      expect(exp.variants).toBe(variants)
      const parsed = JSON.parse(exp.variants as string)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].name).toBe('control')
    })

    it('stores JSON-encoded targeting rules on FeatureFlag', async () => {
      const targetingRules = JSON.stringify([{ attribute: 'country', operator: 'in', values: ['US', 'CA'] }])
      const flag = await FeatureFlag.create({ key: 'geo-flag', name: 'Geo Flag', targetingRules })
      expect(flag.targetingRules).toBe(targetingRules)
      const parsed = JSON.parse(flag.targetingRules as string)
      expect(parsed[0].attribute).toBe('country')
    })

    it('stores JSON-encoded variants on FeatureFlag', async () => {
      const variants = JSON.stringify({ on: 'new-ui', off: 'old-ui' })
      const flag = await FeatureFlag.create({ key: 'ui-flag', name: 'UI Flag', variants })
      expect(flag.variants).toBe(variants)
    })
  })

  // ===========================================================================
  // 12. Numeric field storage and querying
  // ===========================================================================

  describe('Numeric field storage and querying', () => {
    it('stores confidence as a float value', async () => {
      const exp = await Experiment.create({ name: 'Stats', confidence: 95.5 })
      expect(exp.confidence).toBe(95.5)
    })

    it('stores sampleSize and conversions as integers', async () => {
      const exp = await Experiment.create({ name: 'Sample Test', sampleSize: 10000, conversions: 1250 })
      expect(exp.sampleSize).toBe(10000)
      expect(exp.conversions).toBe(1250)
    })

    it('stores evaluations count on FeatureFlag', async () => {
      const flag = await FeatureFlag.create({ key: 'eval-flag', name: 'Eval Flag', evaluations: 500000 })
      expect(flag.evaluations).toBe(500000)
    })
  })

  // ===========================================================================
  // 13. Concurrent creates produce distinct IDs
  // ===========================================================================

  describe('Concurrent creates produce distinct IDs', () => {
    it('five concurrent Experiment.create calls produce five unique IDs', async () => {
      const names = ['A', 'B', 'C', 'D', 'E']
      const results = await Promise.all(names.map((n) => Experiment.create({ name: `Concurrent ${n}` })))
      const ids = results.map((r) => r.$id)
      const unique = new Set(ids)
      expect(unique.size).toBe(5)
    })

    it('five concurrent FeatureFlag.create calls produce five unique IDs', async () => {
      const keys = ['cf-a', 'cf-b', 'cf-c', 'cf-d', 'cf-e']
      const results = await Promise.all(keys.map((k) => FeatureFlag.create({ key: k, name: `Flag ${k}` })))
      const ids = results.map((r) => r.$id)
      const unique = new Set(ids)
      expect(unique.size).toBe(5)
    })
  })

  // ===========================================================================
  // 14. MongoDB-style filter operators
  // ===========================================================================

  describe('MongoDB-style filter operators', () => {
    it('$in filters experiments by multiple statuses', async () => {
      await Experiment.create({ name: 'D1', status: 'Draft' })
      await Experiment.create({ name: 'R1', status: 'Running' })
      await Experiment.create({ name: 'C1', status: 'Completed' })

      const results = await Experiment.find({ status: { $in: ['Draft', 'Running'] } })
      expect(results.length).toBe(2)
      for (const r of results) {
        expect(['Draft', 'Running']).toContain(r.status)
      }
    })

    it('$gt filters experiments by trafficAllocation > threshold', async () => {
      await Experiment.create({ name: 'Low Traffic', trafficAllocation: 10 })
      await Experiment.create({ name: 'High Traffic', trafficAllocation: 80 })
      await Experiment.create({ name: 'Mid Traffic', trafficAllocation: 50 })

      const results = await Experiment.find({ trafficAllocation: { $gt: 40 } })
      expect(results.length).toBe(2)
    })

    it('$lte filters feature flags by rolloutPercentage', async () => {
      await FeatureFlag.create({ key: 'f1', name: 'F1', rolloutPercentage: 10 })
      await FeatureFlag.create({ key: 'f2', name: 'F2', rolloutPercentage: 50 })
      await FeatureFlag.create({ key: 'f3', name: 'F3', rolloutPercentage: 100 })

      const results = await FeatureFlag.find({ rolloutPercentage: { $lte: 50 } })
      expect(results.length).toBe(2)
    })

    it('$regex filters experiments by name pattern', async () => {
      await Experiment.create({ name: 'Checkout Flow Test' })
      await Experiment.create({ name: 'Pricing Page Test' })
      await Experiment.create({ name: 'Checkout Button Color' })

      const results = await Experiment.find({ name: { $regex: '^Checkout' } })
      expect(results.length).toBe(2)
    })

    it('$ne excludes experiments with specific status', async () => {
      await Experiment.create({ name: 'Active Exp', status: 'Running' })
      await Experiment.create({ name: 'Archived Exp', status: 'Archived' })

      const results = await Experiment.find({ status: { $ne: 'Archived' } })
      expect(results.length).toBe(1)
      expect(results[0]!.status).toBe('Running')
    })

    it('$exists filters for presence of a field', async () => {
      await Experiment.create({ name: 'With Hypothesis', hypothesis: 'Users prefer blue' })
      await Experiment.create({ name: 'No Hypothesis' })

      const results = await Experiment.find({ hypothesis: { $exists: true } })
      expect(results.length).toBe(1)
      expect(results[0]!.name).toBe('With Hypothesis')
    })
  })

  // ===========================================================================
  // 15. BEFORE hooks on custom verbs
  // ===========================================================================

  describe('BEFORE hooks on custom verbs', () => {
    it('pausing hook fires before pause verb', async () => {
      const hook = vi.fn()
      Experiment.pausing(hook)

      const exp = await Experiment.create({ name: 'Pause Hook Test', status: 'Running' })
      await Experiment.pause(exp.$id)
      expect(hook).toHaveBeenCalledOnce()
    })

    it('concluding hook fires before conclude verb', async () => {
      const hook = vi.fn()
      Experiment.concluding(hook)

      const exp = await Experiment.create({ name: 'Conclude Hook Test', status: 'Running' })
      await Experiment.conclude(exp.$id)
      expect(hook).toHaveBeenCalledOnce()
    })

    it('disabling hook fires before disable verb', async () => {
      const hook = vi.fn()
      FeatureFlag.disabling(hook)

      const flag = await FeatureFlag.create({ key: 'dis-hook', name: 'Dis Hook', status: 'Active' })
      await FeatureFlag.disable(flag.$id)
      expect(hook).toHaveBeenCalledOnce()
    })
  })

  // ===========================================================================
  // 16. AFTER hooks on custom verbs
  // ===========================================================================

  describe('AFTER hooks on custom verbs', () => {
    it('concluded hook fires after conclude verb with entity', async () => {
      const hook = vi.fn()
      Experiment.concluded(hook)

      const exp = await Experiment.create({ name: 'Concluded Hook', status: 'Running' })
      await Experiment.conclude(exp.$id)
      expect(hook).toHaveBeenCalledOnce()
      const [entity] = hook.mock.calls[0]
      expect(entity.$type).toBe('Experiment')
      expect(entity.status).toBe('Concluded')
    })

    it('paused hook fires after pause verb', async () => {
      const hook = vi.fn()
      Experiment.paused(hook)

      const exp = await Experiment.create({ name: 'Paused Hook', status: 'Running' })
      await Experiment.pause(exp.$id)
      expect(hook).toHaveBeenCalledOnce()
      const [entity] = hook.mock.calls[0]
      expect(entity.status).toBe('Paused')
    })

    it('disabled hook fires after disable verb on FeatureFlag', async () => {
      const hook = vi.fn()
      FeatureFlag.disabled(hook)

      const flag = await FeatureFlag.create({ key: 'disabled-hook', name: 'DH', status: 'Active' })
      await FeatureFlag.disable(flag.$id)
      expect(hook).toHaveBeenCalledOnce()
      const [entity] = hook.mock.calls[0]
      expect(entity.status).toBe('Disabled')
    })

    it('rolledout hook fires after rollout verb on FeatureFlag', async () => {
      const hook = vi.fn()
      FeatureFlag.rolledout(hook)

      const flag = await FeatureFlag.create({ key: 'ro-hook', name: 'RO Hook', status: 'Draft' })
      await FeatureFlag.rollout(flag.$id)
      expect(hook).toHaveBeenCalledOnce()
      const [entity] = hook.mock.calls[0]
      expect(entity.status).toBe('RolledOut')
    })
  })

  // ===========================================================================
  // 17. Raw schema definition preserved
  // ===========================================================================

  describe('Raw schema definition', () => {
    it('Experiment.$schema.raw preserves original definition keys', () => {
      const raw = Experiment.$schema.raw
      expect(raw.name).toBe('string!')
      expect(raw.hypothesis).toBe('string')
      expect(raw.start).toBe('Started')
      expect(raw.conclude).toBe('Concluded')
      expect(raw.pause).toBe('Paused')
      expect(raw.status).toBe('Draft | Running | Paused | Completed | Archived')
      expect(raw.type).toBe('ABTest | Multivariate | FeatureFlag | MLExperiment | PromptExperiment')
    })

    it('FeatureFlag.$schema.raw preserves original definition keys', () => {
      const raw = FeatureFlag.$schema.raw
      expect(raw.key).toBe('string!##')
      expect(raw.name).toBe('string!')
      expect(raw.enable).toBe('Enabled')
      expect(raw.disable).toBe('Disabled')
      expect(raw.rollout).toBe('RolledOut')
      expect(raw.status).toBe('Draft | Active | Paused | Archived')
    })
  })

  // ===========================================================================
  // 18. Experiment status enum value count
  // ===========================================================================

  describe('Experiment status enum', () => {
    it('status enum contains exactly 5 values', () => {
      const field = Experiment.$schema.fields.get('status')
      expect(field!.enumValues).toHaveLength(5)
    })

    it('can create experiments with each status', async () => {
      const statuses = ['Draft', 'Running', 'Paused', 'Completed', 'Archived']
      for (const status of statuses) {
        const exp = await Experiment.create({ name: `Status ${status}`, status })
        expect(exp.status).toBe(status)
      }
    })
  })

  // ===========================================================================
  // 19. FeatureFlag status enum
  // ===========================================================================

  describe('FeatureFlag status enum', () => {
    it('status enum contains exactly 4 values', () => {
      const field = FeatureFlag.$schema.fields.get('status')
      expect(field!.enumValues).toHaveLength(4)
    })

    it('can create feature flags with each status', async () => {
      const statuses = ['Draft', 'Active', 'Paused', 'Archived']
      for (const status of statuses) {
        const flag = await FeatureFlag.create({ key: `s-${status.toLowerCase()}`, name: `Flag ${status}`, status })
        expect(flag.status).toBe(status)
      }
    })
  })

  // ===========================================================================
  // 20. Creating with all fields and retrieving preserves them
  // ===========================================================================

  describe('Full field round-trip', () => {
    it('Experiment with all fields persists and retrieves correctly', async () => {
      const now = new Date().toISOString()
      const exp = await Experiment.create({
        name: 'Full Experiment',
        slug: 'full-experiment',
        description: 'A comprehensive A/B test',
        hypothesis: 'Red buttons convert better',
        type: 'ABTest',
        status: 'Draft',
        startAt: now,
        endAt: now,
        targetAudience: 'logged-in-users',
        trafficAllocation: 75,
        variants: '["control","treatment"]',
        metrics: '["clicks","conversions"]',
        primaryMetric: 'conversions',
        results: '{}',
        winner: 'treatment',
        confidence: 97.2,
        sampleSize: 50000,
        conversions: 6250,
        tags: 'checkout,cta',
      })

      const fetched = await Experiment.get(exp.$id)
      expect(fetched).toBeDefined()
      expect(fetched!.name).toBe('Full Experiment')
      expect(fetched!.slug).toBe('full-experiment')
      expect(fetched!.description).toBe('A comprehensive A/B test')
      expect(fetched!.hypothesis).toBe('Red buttons convert better')
      expect(fetched!.type).toBe('ABTest')
      expect(fetched!.trafficAllocation).toBe(75)
      expect(fetched!.confidence).toBe(97.2)
      expect(fetched!.sampleSize).toBe(50000)
      expect(fetched!.conversions).toBe(6250)
      expect(fetched!.tags).toBe('checkout,cta')
    })

    it('FeatureFlag with all fields persists and retrieves correctly', async () => {
      const now = new Date().toISOString()
      const flag = await FeatureFlag.create({
        key: 'full-flag',
        name: 'Full Feature Flag',
        description: 'Complete feature flag',
        type: 'Boolean',
        defaultValue: 'false',
        variants: '{"on": true, "off": false}',
        targetingRules: '[{"attr":"plan","op":"eq","val":"pro"}]',
        status: 'Active',
        rolloutPercentage: 42,
        evaluations: 999,
        lastEvaluatedAt: now,
      })

      const fetched = await FeatureFlag.get(flag.$id)
      expect(fetched).toBeDefined()
      expect(fetched!.key).toBe('full-flag')
      expect(fetched!.name).toBe('Full Feature Flag')
      expect(fetched!.type).toBe('Boolean')
      expect(fetched!.defaultValue).toBe('false')
      expect(fetched!.rolloutPercentage).toBe(42)
      expect(fetched!.evaluations).toBe(999)
      expect(fetched!.lastEvaluatedAt).toBe(now)
    })
  })

  // ===========================================================================
  // 21. Verb state transition: pause matches enum exactly
  // ===========================================================================

  describe('Verb state transitions', () => {
    it('pause resolves to status "Paused" which matches the status enum', async () => {
      const exp = await Experiment.create({ name: 'Enum Match', status: 'Running' })
      const paused = await Experiment.pause(exp.$id)
      // "Paused" is in the status enum, so Strategy 1 resolves it directly
      expect(paused.status).toBe('Paused')
    })

    it('start resolves to status "Started" which falls back to convention field', async () => {
      const exp = await Experiment.create({ name: 'Convention Test', status: 'Draft' })
      const started = await Experiment.start(exp.$id)
      // "Started" is NOT in the status enum, falls back to convention field
      expect(started.status).toBe('Started')
    })

    it('conclude resolves to status "Concluded" via convention fallback', async () => {
      const exp = await Experiment.create({ name: 'Convention Test 2', status: 'Running' })
      const concluded = await Experiment.conclude(exp.$id)
      expect(concluded.status).toBe('Concluded')
    })
  })

  // ===========================================================================
  // 22. CRUD BEFORE hooks that transform data
  // ===========================================================================

  describe('BEFORE hooks that transform data', () => {
    it('creating hook can inject default fields into Experiment', async () => {
      Experiment.creating((data) => ({
        ...data,
        status: 'Draft',
        trafficAllocation: 50,
      }))

      const exp = await Experiment.create({ name: 'Auto-Default' })
      expect(exp.status).toBe('Draft')
      expect(exp.trafficAllocation).toBe(50)
    })

    it('creating hook can normalize FeatureFlag key to lowercase', async () => {
      FeatureFlag.creating((data) => ({
        ...data,
        key: typeof data.key === 'string' ? data.key.toLowerCase() : data.key,
      }))

      const flag = await FeatureFlag.create({ key: 'MY-FEATURE', name: 'My Feature' })
      expect(flag.key).toBe('my-feature')
    })
  })

  // ===========================================================================
  // 23. Schema completeness: Experiment has all expected field count
  // ===========================================================================

  describe('Schema completeness', () => {
    it('Experiment schema has all expected fields (14 fields + 2 enums)', () => {
      const fields = Experiment.$schema.fields
      const fieldNames = [...fields.keys()]
      expect(fieldNames).toContain('name')
      expect(fieldNames).toContain('slug')
      expect(fieldNames).toContain('description')
      expect(fieldNames).toContain('hypothesis')
      expect(fieldNames).toContain('type')
      expect(fieldNames).toContain('status')
      expect(fieldNames).toContain('startAt')
      expect(fieldNames).toContain('endAt')
      expect(fieldNames).toContain('targetAudience')
      expect(fieldNames).toContain('trafficAllocation')
      expect(fieldNames).toContain('variants')
      expect(fieldNames).toContain('metrics')
      expect(fieldNames).toContain('primaryMetric')
      expect(fieldNames).toContain('results')
      expect(fieldNames).toContain('winner')
      expect(fieldNames).toContain('confidence')
      expect(fieldNames).toContain('sampleSize')
      expect(fieldNames).toContain('conversions')
      expect(fieldNames).toContain('tags')
    })

    it('Experiment schema has 2 relationships', () => {
      const rels = Experiment.$schema.relationships
      expect(rels.size).toBe(2)
      expect(rels.has('organization')).toBe(true)
      expect(rels.has('owner')).toBe(true)
    })

    it('Experiment schema has 6 verbs (3 CRUD + 3 custom)', () => {
      const verbs = Experiment.$schema.verbs
      expect(verbs.size).toBe(6)
      expect(verbs.has('create')).toBe(true)
      expect(verbs.has('update')).toBe(true)
      expect(verbs.has('delete')).toBe(true)
      expect(verbs.has('start')).toBe(true)
      expect(verbs.has('conclude')).toBe(true)
      expect(verbs.has('pause')).toBe(true)
    })

    it('FeatureFlag schema has 2 relationships', () => {
      const rels = FeatureFlag.$schema.relationships
      expect(rels.size).toBe(2)
      expect(rels.has('organization')).toBe(true)
      expect(rels.has('experiment')).toBe(true)
    })

    it('FeatureFlag schema has 6 verbs (3 CRUD + 3 custom)', () => {
      const verbs = FeatureFlag.$schema.verbs
      expect(verbs.size).toBe(6)
      expect(verbs.has('create')).toBe(true)
      expect(verbs.has('update')).toBe(true)
      expect(verbs.has('delete')).toBe(true)
      expect(verbs.has('rollout')).toBe(true)
      expect(verbs.has('enable')).toBe(true)
      expect(verbs.has('disable')).toBe(true)
    })
  })
})
