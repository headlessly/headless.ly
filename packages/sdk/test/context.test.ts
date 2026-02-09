import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { $, crm, billing, projects, content, support, analytics, marketing, experiments, platform } from '../src/index'

describe('@headlessly/sdk — $ context', () => {
  beforeEach(() => {
    clearRegistry()
    setProvider(new MemoryNounProvider())
  })

  describe('entity resolution', () => {
    it('resolves all CRM entities', () => {
      expect($.Organization).toBeDefined()
      expect($.Contact).toBeDefined()
      expect($.Lead).toBeDefined()
      expect($.Deal).toBeDefined()
      expect($.Activity).toBeDefined()
      expect($.Pipeline).toBeDefined()
    })

    it('resolves all Billing entities', () => {
      expect($.Customer).toBeDefined()
      expect($.Product).toBeDefined()
      expect($.Plan).toBeDefined()
      expect($.Price).toBeDefined()
      expect($.Subscription).toBeDefined()
      expect($.Invoice).toBeDefined()
      expect($.Payment).toBeDefined()
    })

    it('resolves all Projects entities', () => {
      expect($.Project).toBeDefined()
      expect($.Issue).toBeDefined()
      expect($.Comment).toBeDefined()
    })

    it('resolves all Content entities', () => {
      expect($.Content).toBeDefined()
      expect($.Asset).toBeDefined()
      expect($.Site).toBeDefined()
    })

    it('resolves Support entities', () => {
      expect($.Ticket).toBeDefined()
    })

    it('resolves all Analytics entities', () => {
      expect($.Event).toBeDefined()
      expect($.Metric).toBeDefined()
      expect($.Funnel).toBeDefined()
      expect($.Goal).toBeDefined()
    })

    it('resolves all Marketing entities', () => {
      expect($.Campaign).toBeDefined()
      expect($.Segment).toBeDefined()
      expect($.Form).toBeDefined()
    })

    it('resolves all Experiments entities', () => {
      expect($.Experiment).toBeDefined()
      expect($.FeatureFlag).toBeDefined()
    })

    it('resolves all Platform entities', () => {
      expect($.Workflow).toBeDefined()
      expect($.Integration).toBeDefined()
      expect($.Agent).toBeDefined()
    })

    it('resolves Identity entities (User, ApiKey)', () => {
      expect($.User).toBeDefined()
      expect($.ApiKey).toBeDefined()
    })

    it('resolves Communication entity (Message)', () => {
      expect($.Message).toBeDefined()
    })

    it('returns undefined for non-existent entities', () => {
      expect($.NonExistent).toBeUndefined()
    })
  })

  describe('domain namespaces', () => {
    it('exports crm namespace with CRM entities', () => {
      expect(crm.Organization).toBeDefined()
      expect(crm.Contact).toBeDefined()
      expect(crm.Deal).toBeDefined()
    })

    it('exports billing namespace with Billing entities', () => {
      expect(billing.Customer).toBeDefined()
      expect(billing.Subscription).toBeDefined()
    })

    it('exports projects namespace', () => {
      expect(projects.Project).toBeDefined()
      expect(projects.Issue).toBeDefined()
    })

    it('exports content namespace', () => {
      expect(content.Content).toBeDefined()
      expect(content.Asset).toBeDefined()
    })

    it('exports support namespace', () => {
      expect(support.Ticket).toBeDefined()
    })

    it('exports analytics namespace', () => {
      expect(analytics.Event).toBeDefined()
      expect(analytics.Metric).toBeDefined()
    })

    it('exports marketing namespace', () => {
      expect(marketing.Campaign).toBeDefined()
    })

    it('exports experiments namespace', () => {
      expect(experiments.Experiment).toBeDefined()
      expect(experiments.FeatureFlag).toBeDefined()
    })

    it('exports platform namespace', () => {
      expect(platform.Workflow).toBeDefined()
      expect(platform.Agent).toBeDefined()
    })
  })

  describe('MCP-like operations', () => {
    it('$.search is a function', () => {
      expect(typeof $.search).toBe('function')
    })

    it('$.fetch is a function', () => {
      expect(typeof $.fetch).toBe('function')
    })

    it('$.do is a function', () => {
      expect(typeof $.do).toBe('function')
    })

    it('$.search returns results for created entities', async () => {
      await $.Contact.create({ name: 'Alice', email: 'alice@test.com' })
      await $.Contact.create({ name: 'Bob', email: 'bob@test.com' })
      const results = await $.search({ type: 'Contact' })
      expect(results.length).toBeGreaterThanOrEqual(2)
    })

    it('$.fetch returns a specific entity', async () => {
      const created = await $.Contact.create({ name: 'Charlie' })
      const fetched = await $.fetch({ type: 'Contact', id: created.$id })
      expect(fetched).toBeDefined()
      expect(fetched.$id).toBe(created.$id)
    })

    it('$.do executes with all entities in context', async () => {
      const result = await $.do(async (ctx) => {
        expect(ctx.Contact).toBeDefined()
        expect(ctx.Deal).toBeDefined()
        expect(ctx.Subscription).toBeDefined()
        return 'ok'
      })
      expect(result).toBe('ok')
    })
  })

  describe('entity CRUD through $', () => {
    it('creates an entity through $ proxy', async () => {
      const contact = await $.Contact.create({ name: 'Test User' })
      expect(contact.$type).toBe('Contact')
      expect(contact.name).toBe('Test User')
    })

    it('finds entities through $ proxy', async () => {
      await $.Deal.create({ name: 'Big Deal', value: 100000 })
      const deals = await $.Deal.find()
      expect(deals.length).toBeGreaterThanOrEqual(1)
    })

    it('gets entity by id through $ proxy', async () => {
      const created = await $.Ticket.create({ subject: 'Help me' })
      const fetched = await $.Ticket.get(created.$id)
      expect(fetched).toBeDefined()
      expect(fetched.subject).toBe('Help me')
    })
  })
})
