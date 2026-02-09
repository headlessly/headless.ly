import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Campaign, Segment, Form } from '../src/index.ts'
import { setupTestProvider, expectMetaFields, expectCrudVerbs, expectVerbConjugation, testCrudLifecycle } from '../../test-utils'

describe('@headlessly/marketing', () => {
  setupTestProvider()

  describe('exports', () => {
    it('exports Campaign', () => {
      expect(Campaign).toBeDefined()
    })

    it('exports Segment', () => {
      expect(Segment).toBeDefined()
    })

    it('exports Form', () => {
      expect(Form).toBeDefined()
    })
  })

  describe('Campaign', () => {
    describe('CRUD verbs', () => {
      it('has standard CRUD verbs', () => {
        expectCrudVerbs(Campaign)
      })
    })

    describe('verb conjugation', () => {
      it('has launch verb conjugation', () => {
        expectVerbConjugation(Campaign, 'launch', 'launching', 'launched')
      })

      it('has pause verb conjugation', () => {
        expectVerbConjugation(Campaign, 'pause', 'pausing', 'paused')
      })

      it('has complete verb conjugation', () => {
        expectVerbConjugation(Campaign, 'complete', 'completing', 'completed')
      })
    })

    describe('create with meta-fields', () => {
      it('creates a Campaign with correct meta-fields', async () => {
        const campaign = await Campaign.create({ name: 'Q1 Product Launch' })
        expectMetaFields(campaign, 'Campaign')
        expect(campaign.name).toBe('Q1 Product Launch')
      })
    })

    describe('full CRUD lifecycle', () => {
      it('supports create, get, update, delete', async () => {
        await testCrudLifecycle(Campaign, 'Campaign', { name: 'Q1 Product Launch' }, { name: 'Q2 Product Launch' })
      })
    })
  })

  describe('Segment', () => {
    describe('CRUD verbs', () => {
      it('has standard CRUD verbs', () => {
        expectCrudVerbs(Segment)
      })
    })

    describe('create with meta-fields', () => {
      it('creates a Segment with correct meta-fields', async () => {
        const segment = await Segment.create({ name: 'Enterprise Accounts' })
        expectMetaFields(segment, 'Segment')
        expect(segment.name).toBe('Enterprise Accounts')
      })
    })

    describe('full CRUD lifecycle', () => {
      it('supports create, get, update, delete', async () => {
        await testCrudLifecycle(Segment, 'Segment', { name: 'Enterprise Accounts' }, { name: 'SMB Accounts' })
      })
    })
  })

  describe('Form', () => {
    describe('CRUD verbs', () => {
      it('has standard CRUD verbs', () => {
        expectCrudVerbs(Form)
      })
    })

    describe('verb conjugation', () => {
      it('has publish verb conjugation', () => {
        expectVerbConjugation(Form, 'publish', 'publishing', 'published')
      })

      it('has archive verb conjugation', () => {
        expectVerbConjugation(Form, 'archive', 'archiving', 'archived')
      })
    })

    describe('create with meta-fields', () => {
      it('creates a Form with correct meta-fields', async () => {
        const form = await Form.create({ name: 'Contact Us' })
        expectMetaFields(form, 'Form')
        expect(form.name).toBe('Contact Us')
      })
    })

    describe('full CRUD lifecycle', () => {
      it('supports create, get, update, delete', async () => {
        await testCrudLifecycle(Form, 'Form', { name: 'Contact Us' }, { name: 'Request Demo' })
      })
    })
  })
})
