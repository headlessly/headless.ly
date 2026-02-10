import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Experiment, FeatureFlag } from '../src/index.ts'
import { setupTestProvider, expectMetaFields, expectCrudVerbs, expectVerbConjugation, testCrudLifecycle } from '../../test-utils'

describe('@headlessly/experiments', () => {
  setupTestProvider()

  describe('exports', () => {
    it('exports Experiment', () => {
      expect(Experiment).toBeDefined()
    })

    it('exports FeatureFlag', () => {
      expect(FeatureFlag).toBeDefined()
    })
  })

  describe('Experiment', () => {
    describe('CRUD verbs', () => {
      it('has standard CRUD verbs', () => {
        expectCrudVerbs(Experiment)
      })
    })

    describe('verb conjugation', () => {
      it('has start verb conjugation', () => {
        expectVerbConjugation(Experiment, 'start', 'starting', 'started')
      })

      it('has conclude verb conjugation', () => {
        expectVerbConjugation(Experiment, 'conclude', 'concluding', 'concluded')
      })

      it('has pause verb conjugation', () => {
        expectVerbConjugation(Experiment, 'pause', 'pausing', 'paused')
      })
    })

    describe('create with meta-fields', () => {
      it('creates an Experiment with correct meta-fields', async () => {
        const experiment = await Experiment.create({ name: 'Checkout Flow Test' })
        expectMetaFields(experiment, 'Experiment')
        expect(experiment.name).toBe('Checkout Flow Test')
      })
    })

    describe('full CRUD lifecycle', () => {
      it('supports create, get, update, delete', async () => {
        await testCrudLifecycle(Experiment, 'Experiment', { name: 'Checkout Flow Test' }, { name: 'Pricing Page Test' })
      })
    })
  })

  describe('FeatureFlag', () => {
    describe('CRUD verbs', () => {
      it('has standard CRUD verbs', () => {
        expectCrudVerbs(FeatureFlag)
      })
    })

    describe('verb conjugation', () => {
      it('has rollout verb conjugation', () => {
        expectVerbConjugation(FeatureFlag, 'rollout', 'rollingOut', 'rolledOut')
      })

      it('has enable verb conjugation', () => {
        expectVerbConjugation(FeatureFlag, 'enable', 'enabling', 'enabled')
      })

      it('has disable verb conjugation', () => {
        expectVerbConjugation(FeatureFlag, 'disable', 'disabling', 'disabled')
      })
    })

    describe('create with meta-fields', () => {
      it('creates a FeatureFlag with correct meta-fields', async () => {
        const flag = await FeatureFlag.create({ key: 'new-dashboard', name: 'New Dashboard UI' })
        expectMetaFields(flag, 'FeatureFlag')
        expect(flag.key).toBe('new-dashboard')
        expect(flag.name).toBe('New Dashboard UI')
      })
    })

    describe('full CRUD lifecycle', () => {
      it('supports create, get, update, delete', async () => {
        await testCrudLifecycle(FeatureFlag, 'FeatureFlag', { key: 'new-dashboard', name: 'New Dashboard UI' }, { name: 'Updated Dashboard UI' })
      })
    })
  })
})
