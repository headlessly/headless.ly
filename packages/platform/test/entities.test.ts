import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Workflow, Integration, Agent } from '../src/index.ts'
import { setupTestProvider, expectMetaFields, expectCrudVerbs, expectVerbConjugation, testCrudLifecycle } from '../../test-utils'

describe('@headlessly/platform', () => {
  setupTestProvider()

  describe('exports', () => {
    it('exports Workflow', () => {
      expect(Workflow).toBeDefined()
    })

    it('exports Integration', () => {
      expect(Integration).toBeDefined()
    })

    it('exports Agent', () => {
      expect(Agent).toBeDefined()
    })
  })

  describe('Workflow', () => {
    describe('CRUD verbs', () => {
      it('has standard CRUD verbs', () => {
        expectCrudVerbs(Workflow)
      })
    })

    describe('verb conjugation', () => {
      it('has activate verb conjugation', () => {
        expectVerbConjugation(Workflow, 'activate', 'activating', 'activated')
      })

      it('has pause verb conjugation', () => {
        expectVerbConjugation(Workflow, 'pause', 'pausing', 'paused')
      })

      it('has archive verb conjugation', () => {
        expectVerbConjugation(Workflow, 'archive', 'archiving', 'archived')
      })
    })

    describe('create with meta-fields', () => {
      it('creates a Workflow with correct meta-fields', async () => {
        const workflow = await Workflow.create({ name: 'Lead Qualification', trigger: 'Contact.created' })
        expectMetaFields(workflow, 'Workflow')
        expect(workflow.name).toBe('Lead Qualification')
        expect(workflow.trigger).toBe('Contact.created')
      })
    })

    describe('full CRUD lifecycle', () => {
      it('supports create, get, update, delete', async () => {
        await testCrudLifecycle(Workflow, 'Workflow', { name: 'Lead Qualification', trigger: 'Contact.created' }, { name: 'Deal Routing' })
      })
    })
  })

  describe('Integration', () => {
    describe('CRUD verbs', () => {
      it('has standard CRUD verbs', () => {
        expectCrudVerbs(Integration)
      })
    })

    describe('verb conjugation', () => {
      it('has connect verb conjugation', () => {
        expectVerbConjugation(Integration, 'connect', 'connecting', 'connected')
      })

      it('has disconnect verb conjugation', () => {
        expectVerbConjugation(Integration, 'disconnect', 'disconnecting', 'disconnected')
      })
    })

    describe('create with meta-fields', () => {
      it('creates an Integration with correct meta-fields', async () => {
        const integration = await Integration.create({ name: 'Stripe Payments', provider: 'stripe' })
        expectMetaFields(integration, 'Integration')
        expect(integration.name).toBe('Stripe Payments')
        expect(integration.provider).toBe('stripe')
      })
    })

    describe('full CRUD lifecycle', () => {
      it('supports create, get, update, delete', async () => {
        await testCrudLifecycle(Integration, 'Integration', { name: 'Stripe Payments', provider: 'stripe' }, { name: 'Stripe Billing' })
      })
    })
  })

  describe('Agent', () => {
    describe('CRUD verbs', () => {
      it('has standard CRUD verbs', () => {
        expectCrudVerbs(Agent)
      })
    })

    describe('verb conjugation', () => {
      it('has deploy verb conjugation', () => {
        expectVerbConjugation(Agent, 'deploy', 'deploying', 'deployed')
      })

      it('has pause verb conjugation', () => {
        expectVerbConjugation(Agent, 'pause', 'pausing', 'paused')
      })

      it('has retire verb conjugation', () => {
        expectVerbConjugation(Agent, 'retire', 'retiring', 'retired')
      })
    })

    describe('create with meta-fields', () => {
      it('creates an Agent with correct meta-fields', async () => {
        const agent = await Agent.create({ name: 'Support Bot' })
        expectMetaFields(agent, 'Agent')
        expect(agent.name).toBe('Support Bot')
      })
    })

    describe('full CRUD lifecycle', () => {
      it('supports create, get, update, delete', async () => {
        await testCrudLifecycle(Agent, 'Agent', { name: 'Support Bot' }, { name: 'Sales Bot' })
      })
    })
  })
})
