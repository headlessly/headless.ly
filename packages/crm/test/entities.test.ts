import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Organization, Contact, Lead, Deal, Activity, Pipeline } from '../src/index.ts'
import { setupTestProvider, expectMetaFields, expectCrudVerbs, expectVerbConjugation, testCrudLifecycle } from '../../test-utils'

describe('@headlessly/crm', () => {
  setupTestProvider()

  describe('exports', () => {
    it('exports Organization', () => {
      expect(Organization).toBeDefined()
      expect(Organization.$name).toBe('Organization')
    })

    it('exports Contact', () => {
      expect(Contact).toBeDefined()
      expect(Contact.$name).toBe('Contact')
    })

    it('exports Lead', () => {
      expect(Lead).toBeDefined()
      expect(Lead.$name).toBe('Lead')
    })

    it('exports Deal', () => {
      expect(Deal).toBeDefined()
      expect(Deal.$name).toBe('Deal')
    })

    it('exports Activity', () => {
      expect(Activity).toBeDefined()
      expect(Activity.$name).toBe('Activity')
    })

    it('exports Pipeline', () => {
      expect(Pipeline).toBeDefined()
      expect(Pipeline.$name).toBe('Pipeline')
    })
  })

  describe('CRUD verbs', () => {
    it('Organization has CRUD verbs', () => {
      expectCrudVerbs(Organization)
    })

    it('Contact has CRUD verbs', () => {
      expectCrudVerbs(Contact)
    })

    it('Lead has CRUD verbs', () => {
      expectCrudVerbs(Lead)
    })

    it('Deal has CRUD verbs', () => {
      expectCrudVerbs(Deal)
    })

    it('Activity has CRUD verbs', () => {
      expectCrudVerbs(Activity)
    })

    it('Pipeline has CRUD verbs', () => {
      expectCrudVerbs(Pipeline)
    })
  })

  describe('verb conjugation', () => {
    it('Contact.qualify conjugation', () => {
      expectVerbConjugation(Contact, 'qualify', 'qualifying', 'qualified')
    })

    it('Lead.convert conjugation', () => {
      expectVerbConjugation(Lead, 'convert', 'converting', 'converted')
    })

    it('Lead.lose conjugation', () => {
      expectVerbConjugation(Lead, 'lose', 'losing', 'losed')
    })

    it('Deal.close conjugation', () => {
      expectVerbConjugation(Deal, 'close', 'closing', 'closed')
    })

    it('Deal.win conjugation', () => {
      expectVerbConjugation(Deal, 'win', 'winning', 'winned')
    })

    it('Deal.lose conjugation', () => {
      expectVerbConjugation(Deal, 'lose', 'losing', 'losed')
    })

    it('Activity.complete conjugation', () => {
      expectVerbConjugation(Activity, 'complete', 'completing', 'completed')
    })

    it('Activity.cancel conjugation', () => {
      expectVerbConjugation(Activity, 'cancel', 'cancelling', 'cancelled')
    })
  })

  describe('create with meta-fields', () => {
    it('creates Organization with meta-fields', async () => {
      const org = await Organization.create({ name: 'Acme Corp' })
      expectMetaFields(org, 'Organization')
      expect(org.name).toBe('Acme Corp')
    })

    it('creates Contact with meta-fields', async () => {
      const contact = await Contact.create({ name: 'Alice Smith', email: 'alice@acme.co' })
      expectMetaFields(contact, 'Contact')
      expect(contact.name).toBe('Alice Smith')
      expect(contact.email).toBe('alice@acme.co')
    })

    it('creates Lead with meta-fields', async () => {
      const lead = await Lead.create({ name: 'New Lead', source: 'Website' })
      expectMetaFields(lead, 'Lead')
      expect(lead.name).toBe('New Lead')
      expect(lead.source).toBe('Website')
    })

    it('creates Deal with meta-fields', async () => {
      const deal = await Deal.create({ name: 'Enterprise Deal', value: 50000 })
      expectMetaFields(deal, 'Deal')
      expect(deal.name).toBe('Enterprise Deal')
      expect(deal.value).toBe(50000)
    })

    it('creates Activity with meta-fields', async () => {
      const activity = await Activity.create({ subject: 'Follow up call', type: 'Call' })
      expectMetaFields(activity, 'Activity')
      expect(activity.subject).toBe('Follow up call')
      expect(activity.type).toBe('Call')
    })

    it('creates Pipeline with meta-fields', async () => {
      const pipeline = await Pipeline.create({ name: 'Sales Pipeline' })
      expectMetaFields(pipeline, 'Pipeline')
      expect(pipeline.name).toBe('Sales Pipeline')
    })
  })

  describe('full CRUD lifecycle', () => {
    it('Organization CRUD lifecycle', async () => {
      await testCrudLifecycle(Organization, 'Organization', { name: 'Acme Corp' }, { name: 'Acme Inc' })
    })

    it('Contact CRUD lifecycle', async () => {
      await testCrudLifecycle(Contact, 'Contact', { name: 'Alice Smith', email: 'alice@acme.co' }, { name: 'Alice Johnson' })
    })

    it('Lead CRUD lifecycle', async () => {
      await testCrudLifecycle(Lead, 'Lead', { name: 'New Lead', source: 'Website' }, { source: 'Referral' })
    })

    it('Deal CRUD lifecycle', async () => {
      await testCrudLifecycle(Deal, 'Deal', { name: 'Enterprise Deal', value: 50000 }, { value: 75000 })
    })

    it('Activity CRUD lifecycle', async () => {
      await testCrudLifecycle(Activity, 'Activity', { subject: 'Follow up call', type: 'Call' }, { subject: 'Updated call' })
    })

    it('Pipeline CRUD lifecycle', async () => {
      await testCrudLifecycle(Pipeline, 'Pipeline', { name: 'Sales Pipeline' }, { name: 'Enterprise Pipeline' })
    })
  })
})
