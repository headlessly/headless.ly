import { describe, it, expect, beforeEach } from 'vitest'
import { clearRegistry, MemoryNounProvider, setProvider, getProvider } from 'digital-objects'
import Headlessly, { Headlessly as NamedHeadlessly } from '../src/index'
import type { HeadlesslyOrg, HeadlesslyOptions } from '../src/index'
import { $ } from '@headlessly/sdk'

// Helper to create a fresh org with isolated provider
function freshOrg(opts: HeadlesslyOptions): HeadlesslyOrg {
  clearRegistry()
  setProvider(new MemoryNounProvider())
  return Headlessly(opts)
}

describe('headlessly-deep-v2 — 50+ new tests', () => {
  beforeEach(() => {
    clearRegistry()
    setProvider(new MemoryNounProvider())
  })

  // ===========================================================================
  // 1. Exports and Module Shape (6 tests)
  // ===========================================================================
  describe('exports and module shape', () => {
    it('default export is a function', () => {
      expect(typeof Headlessly).toBe('function')
    })

    it('named export Headlessly is the same function as default', () => {
      expect(NamedHeadlessly).toBe(Headlessly)
    })

    it('re-exports setProvider from digital-objects', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.setProvider).toBe('function')
    })

    it('re-exports getProvider from digital-objects', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.getProvider).toBe('function')
    })

    it('re-exports MemoryNounProvider from digital-objects', async () => {
      const mod = await import('../src/index')
      expect(mod.MemoryNounProvider).toBeDefined()
    })

    it('re-exports $ from @headlessly/sdk', async () => {
      const mod = await import('../src/index')
      expect(mod.$).toBeDefined()
    })
  })

  // ===========================================================================
  // 2. Proxy — getOwnPropertyDescriptor Trap (5 tests)
  // ===========================================================================
  describe('proxy getOwnPropertyDescriptor trap', () => {
    it('returns a descriptor for "tenant"', () => {
      const org = Headlessly({ tenant: 'test' })
      const desc = Object.getOwnPropertyDescriptor(org, 'tenant')
      expect(desc).toBeDefined()
      expect(desc!.configurable).toBe(true)
      expect(desc!.enumerable).toBe(true)
      expect(desc!.writable).toBe(false)
    })

    it('returns a descriptor for "search"', () => {
      const org = Headlessly({ tenant: 'test' })
      const desc = Object.getOwnPropertyDescriptor(org, 'search')
      expect(desc).toBeDefined()
      expect(desc!.enumerable).toBe(true)
    })

    it('returns a descriptor for domain namespace "crm"', () => {
      const org = Headlessly({ tenant: 'test' })
      const desc = Object.getOwnPropertyDescriptor(org, 'crm')
      expect(desc).toBeDefined()
      expect(desc!.configurable).toBe(true)
    })

    it('returns undefined for unknown property descriptor', () => {
      const org = Headlessly({ tenant: 'test' })
      const desc = Object.getOwnPropertyDescriptor(org, 'nonExistent')
      expect(desc).toBeUndefined()
    })

    it('returns undefined descriptor for entity names (not in ownKeys)', () => {
      const org = Headlessly({ tenant: 'test' })
      const desc = Object.getOwnPropertyDescriptor(org, 'Contact')
      expect(desc).toBeUndefined()
    })
  })

  // ===========================================================================
  // 3. Proxy — has Trap Depth (6 tests)
  // ===========================================================================
  describe('proxy has trap — depth', () => {
    it('"context" in org returns true', () => {
      const org = Headlessly({ tenant: 'test' })
      expect('context' in org).toBe(true)
    })

    it('"fetch" in org returns true', () => {
      const org = Headlessly({ tenant: 'test' })
      expect('fetch' in org).toBe(true)
    })

    it('"do" in org returns true', () => {
      const org = Headlessly({ tenant: 'test' })
      expect('do' in org).toBe(true)
    })

    it('"billing" in org returns true', () => {
      const org = Headlessly({ tenant: 'test' })
      expect('billing' in org).toBe(true)
    })

    it('entity name "Contact" in org returns true ($ lookup)', () => {
      const org = Headlessly({ tenant: 'test' })
      expect('Contact' in org).toBe(true)
    })

    it('non-existent key returns false from has trap', () => {
      const org = Headlessly({ tenant: 'test' })
      expect('totallyFake' in org).toBe(false)
    })
  })

  // ===========================================================================
  // 4. Proxy — ownKeys and Enumeration (4 tests)
  // ===========================================================================
  describe('proxy ownKeys and enumeration', () => {
    it('Object.keys returns exactly 14 keys', () => {
      const org = Headlessly({ tenant: 'test' })
      const keys = Object.keys(org)
      // tenant, context, search, fetch, do, crm, billing, projects, content, support, analytics, marketing, experiments, platform
      expect(keys.length).toBe(14)
    })

    it('Object.keys does NOT include entity names like Contact', () => {
      const org = Headlessly({ tenant: 'test' })
      const keys = Object.keys(org)
      expect(keys).not.toContain('Contact')
      expect(keys).not.toContain('Deal')
    })

    it('Object.entries works on the proxy (each entry is [key, value])', () => {
      const org = Headlessly({ tenant: 'test' })
      const entries = Object.entries(org)
      expect(entries.length).toBe(14)
      for (const [key, _value] of entries) {
        expect(typeof key).toBe('string')
      }
    })

    it('JSON.stringify does not throw on the proxy', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(() => JSON.stringify(org)).not.toThrow()
    })
  })

  // ===========================================================================
  // 5. All 35 Entity Types Accessible (5 tests covering groups)
  // ===========================================================================
  describe('all 35 entity types accessible through factory', () => {
    it('Identity entities: User, ApiKey', () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      expect(org.User).toBeDefined()
      expect(org.ApiKey).toBeDefined()
    })

    it('CRM entities: Organization, Contact, Lead, Deal, Activity, Pipeline', () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      expect(org.Organization).toBeDefined()
      expect(org.Contact).toBeDefined()
      expect(org.Lead).toBeDefined()
      expect(org.Deal).toBeDefined()
      expect(org.Activity).toBeDefined()
      expect(org.Pipeline).toBeDefined()
    })

    it('Billing entities: Customer, Product, Plan, Price, Subscription, Invoice, Payment', () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      expect(org.Customer).toBeDefined()
      expect(org.Product).toBeDefined()
      expect(org.Plan).toBeDefined()
      expect(org.Price).toBeDefined()
      expect(org.Subscription).toBeDefined()
      expect(org.Invoice).toBeDefined()
      expect(org.Payment).toBeDefined()
    })

    it('Projects, Content, Support entities', () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      expect(org.Project).toBeDefined()
      expect(org.Issue).toBeDefined()
      expect(org.Comment).toBeDefined()
      expect(org.Content).toBeDefined()
      expect(org.Asset).toBeDefined()
      expect(org.Site).toBeDefined()
      expect(org.Ticket).toBeDefined()
    })

    it('Analytics, Marketing, Experiments, Platform, Communication entities', () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      expect(org.Event).toBeDefined()
      expect(org.Metric).toBeDefined()
      expect(org.Funnel).toBeDefined()
      expect(org.Goal).toBeDefined()
      expect(org.Campaign).toBeDefined()
      expect(org.Segment).toBeDefined()
      expect(org.Form).toBeDefined()
      expect(org.Experiment).toBeDefined()
      expect(org.FeatureFlag).toBeDefined()
      expect(org.Workflow).toBeDefined()
      expect(org.Integration).toBeDefined()
      expect(org.Agent).toBeDefined()
      expect(org.Message).toBeDefined()
    })
  })

  // ===========================================================================
  // 6. CRUD Operations Through Org Proxy (8 tests)
  // ===========================================================================
  describe('CRUD operations through org proxy', () => {
    it('create returns instance with $type field', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const contact = await org.Contact.create({ name: 'Bob' })
      expect(contact.$type).toBe('Contact')
    })

    it('create returns instance with $id field', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const contact = await org.Contact.create({ name: 'Charlie' })
      expect(contact.$id).toBeDefined()
      expect(typeof contact.$id).toBe('string')
      expect(contact.$id.startsWith('contact_')).toBe(true)
    })

    it('create returns instance with $version = 1', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const contact = await org.Contact.create({ name: 'Dave' })
      expect(contact.$version).toBe(1)
    })

    it('create returns instance with $createdAt and $updatedAt', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const contact = await org.Contact.create({ name: 'Eve' })
      expect(contact.$createdAt).toBeDefined()
      expect(contact.$updatedAt).toBeDefined()
    })

    it('get retrieves a previously created entity', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const created = await org.Contact.create({ name: 'Frank' })
      const fetched = await org.Contact.get(created.$id)
      expect(fetched).toBeDefined()
      expect(fetched.name).toBe('Frank')
      expect(fetched.$id).toBe(created.$id)
    })

    it('find returns array of matching entities', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      await org.Contact.create({ name: 'Grace' })
      await org.Contact.create({ name: 'Hank' })
      const results = await org.Contact.find()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThanOrEqual(2)
    })

    it('update modifies an entity and increments $version', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const contact = await org.Contact.create({ name: 'Ivy' })
      const updated = await org.Contact.update(contact.$id, { name: 'Ivy Updated' })
      expect(updated.name).toBe('Ivy Updated')
      expect(updated.$version).toBe(2)
    })

    it('delete removes an entity', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const contact = await org.Contact.create({ name: 'Jack' })
      const deleted = await org.Contact.delete(contact.$id)
      expect(deleted).toBe(true)
      const fetched = await org.Contact.get(contact.$id)
      expect(fetched).toBeNull()
    })
  })

  // ===========================================================================
  // 7. Cross-Entity Operations (4 tests)
  // ===========================================================================
  describe('cross-entity operations through factory', () => {
    it('create entities of different types through same org', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const contact = await org.Contact.create({ name: 'Alice' })
      const deal = await org.Deal.create({ name: 'Big Deal', value: 10000 })
      const project = await org.Project.create({ name: 'Alpha Project' })
      expect(contact.$type).toBe('Contact')
      expect(deal.$type).toBe('Deal')
      expect(project.$type).toBe('Project')
    })

    it('search finds entities of a specific type across multiple created', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      await org.Contact.create({ name: 'Alice' })
      await org.Deal.create({ name: 'Deal A', value: 5000 })
      await org.Contact.create({ name: 'Bob' })
      const contacts = await org.search({ type: 'Contact' })
      expect(contacts.length).toBe(2)
    })

    it('search with filter narrows results', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      await org.Contact.create({ name: 'Alice', department: 'Sales' })
      await org.Contact.create({ name: 'Bob', department: 'Engineering' })
      const results = await org.search({ type: 'Contact', filter: { department: 'Sales' } })
      expect(results.length).toBe(1)
      expect((results[0] as any).name).toBe('Alice')
    })

    it('search for non-existent type returns empty array', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const results = await org.search({ type: 'NonExistentType' })
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)
    })
  })

  // ===========================================================================
  // 8. Fetch Primitive (4 tests)
  // ===========================================================================
  describe('fetch primitive through factory', () => {
    it('fetch retrieves entity by type and id', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const contact = await org.Contact.create({ name: 'Zara' })
      const fetched = await org.fetch({ type: 'Contact', id: contact.$id })
      expect(fetched).toBeDefined()
      expect((fetched as any).name).toBe('Zara')
    })

    it('fetch returns null for non-existent id', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const fetched = await org.fetch({ type: 'Contact', id: 'contact_nonexistent' })
      expect(fetched).toBeNull()
    })

    it('fetch returns null for non-existent type', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const fetched = await org.fetch({ type: 'FakeType', id: 'fake_123' })
      expect(fetched).toBeNull()
    })

    it('fetch with include returns enriched result', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const orgEntity = await org.Organization.create({ name: 'Acme Inc' })
      await org.Contact.create({ name: 'Alice', organization: orgEntity.$id })
      const fetched = await org.fetch({ type: 'Organization', id: orgEntity.$id, include: ['contacts'] })
      expect(fetched).toBeDefined()
      // The include mechanism attempts to resolve back-references
      expect((fetched as any).name).toBe('Acme Inc')
    })
  })

  // ===========================================================================
  // 9. Do Primitive (3 tests)
  // ===========================================================================
  describe('do primitive through factory', () => {
    it('do() executes a function with entity access', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const result = await org.do(async (ctx: any) => {
        const contact = await ctx.Contact.create({ name: 'DoTest' })
        return contact.name
      })
      expect(result).toBe('DoTest')
    })

    it('do() can perform multiple operations in sequence', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const result = await org.do(async (ctx: any) => {
        await ctx.Contact.create({ name: 'First' })
        await ctx.Contact.create({ name: 'Second' })
        const all = await ctx.Contact.find()
        return all.length
      })
      expect(result).toBeGreaterThanOrEqual(2)
    })

    it('do() provides access to all entity types', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const result = await org.do(async (ctx: any) => {
        const entityNames = ['Contact', 'Deal', 'Subscription', 'Project', 'Ticket', 'Campaign', 'Workflow']
        return entityNames.every((name) => ctx[name] !== undefined)
      })
      expect(result).toBe(true)
    })
  })

  // ===========================================================================
  // 10. Domain Namespace Entity Access — Deep (5 tests)
  // ===========================================================================
  describe('domain namespace entity access — deep', () => {
    it('org.crm has all 6 CRM entities', () => {
      const org = Headlessly({ tenant: 'test' })
      const crmNs = org.crm as Record<string, any>
      expect(crmNs.Organization).toBeDefined()
      expect(crmNs.Contact).toBeDefined()
      expect(crmNs.Lead).toBeDefined()
      expect(crmNs.Deal).toBeDefined()
      expect(crmNs.Activity).toBeDefined()
      expect(crmNs.Pipeline).toBeDefined()
    })

    it('org.billing has all 7 Billing entities', () => {
      const org = Headlessly({ tenant: 'test' })
      const billingNs = org.billing as Record<string, any>
      expect(billingNs.Customer).toBeDefined()
      expect(billingNs.Product).toBeDefined()
      expect(billingNs.Plan).toBeDefined()
      expect(billingNs.Price).toBeDefined()
      expect(billingNs.Subscription).toBeDefined()
      expect(billingNs.Invoice).toBeDefined()
      expect(billingNs.Payment).toBeDefined()
    })

    it('org.projects has Project, Issue, Comment', () => {
      const org = Headlessly({ tenant: 'test' })
      const ns = org.projects as Record<string, any>
      expect(ns.Project).toBeDefined()
      expect(ns.Issue).toBeDefined()
      expect(ns.Comment).toBeDefined()
    })

    it('org.analytics has Event, Metric, Funnel, Goal', () => {
      const org = Headlessly({ tenant: 'test' })
      const ns = org.analytics as Record<string, any>
      expect(ns.Event).toBeDefined()
      expect(ns.Metric).toBeDefined()
      expect(ns.Funnel).toBeDefined()
      expect(ns.Goal).toBeDefined()
    })

    it('namespace entities have create method (are NounEntity proxies)', () => {
      const org = Headlessly({ tenant: 'test' })
      const crmNs = org.crm as Record<string, any>
      expect(typeof crmNs.Contact.create).toBe('function')
      expect(typeof crmNs.Deal.create).toBe('function')
    })
  })

  // ===========================================================================
  // 11. Context URL Formation (4 tests)
  // ===========================================================================
  describe('context URL formation', () => {
    it('context includes tenant name after /~', () => {
      const org = Headlessly({ tenant: 'startup-xyz' })
      expect(org.context).toBe('https://headless.ly/~startup-xyz')
    })

    it('context handles hyphens in tenant name', () => {
      const org = Headlessly({ tenant: 'my-cool-startup' })
      expect(org.context).toBe('https://headless.ly/~my-cool-startup')
    })

    it('context handles numeric tenant name', () => {
      const org = Headlessly({ tenant: '12345' })
      expect(org.context).toBe('https://headless.ly/~12345')
    })

    it('context handles single character tenant', () => {
      const org = Headlessly({ tenant: 'x' })
      expect(org.context).toBe('https://headless.ly/~x')
    })
  })

  // ===========================================================================
  // 12. Template Options (4 tests)
  // ===========================================================================
  describe('template options', () => {
    it('accepts template: b2b', () => {
      const org = Headlessly({ tenant: 'test', template: 'b2b' })
      expect(org.tenant).toBe('test')
    })

    it('accepts template: b2c', () => {
      const org = Headlessly({ tenant: 'test', template: 'b2c' })
      expect(org.tenant).toBe('test')
    })

    it('accepts template: b2d', () => {
      const org = Headlessly({ tenant: 'test', template: 'b2d' })
      expect(org.tenant).toBe('test')
    })

    it('accepts template: b2a', () => {
      const org = Headlessly({ tenant: 'test', template: 'b2a' })
      expect(org.tenant).toBe('test')
    })
  })

  // ===========================================================================
  // 13. Provider Modes — Edge Cases (3 tests)
  // ===========================================================================
  describe('provider modes — edge cases', () => {
    it('mode=local returns defined org with entity access', () => {
      const org = Headlessly({ tenant: 'test-local', mode: 'local' }) as HeadlesslyOrg & Record<string, any>
      expect(org.Contact).toBeDefined()
      expect(typeof org.Contact.create).toBe('function')
    })

    it('mode=remote without apiKey still initializes', () => {
      const org = Headlessly({ tenant: 'test-remote-nokey', mode: 'remote' })
      expect(org).toBeDefined()
      expect(org.tenant).toBe('test-remote-nokey')
    })

    it('mode=remote with transport=ws initializes without error', () => {
      const org = Headlessly({ tenant: 'test-ws', mode: 'remote', transport: 'ws' })
      expect(org).toBeDefined()
      const provider = getProvider() as any
      expect(provider.constructor.name).toBe('DONounProvider')
    })
  })

  // ===========================================================================
  // 14. Double Initialization / Sequential Creation (3 tests)
  // ===========================================================================
  describe('double initialization and sequential creation', () => {
    it('creating two orgs sequentially does not throw', () => {
      expect(() => {
        Headlessly({ tenant: 'first' })
        Headlessly({ tenant: 'second' })
      }).not.toThrow()
    })

    it('second org creation overrides global provider (last writer wins)', () => {
      Headlessly({ tenant: 'org-a', mode: 'memory' })
      Headlessly({ tenant: 'org-b', mode: 'local' })
      const provider = getProvider()
      // The second call should have set a LocalNounProvider
      expect(provider.constructor.name).toBe('LocalNounProvider')
    })

    it('org references remain stable after second Headlessly() call', () => {
      const orgA = Headlessly({ tenant: 'stable-a' })
      const orgB = Headlessly({ tenant: 'stable-b' })
      // orgA still has its tenant
      expect(orgA.tenant).toBe('stable-a')
      expect(orgA.context).toBe('https://headless.ly/~stable-a')
      expect(orgB.tenant).toBe('stable-b')
    })
  })

  // ===========================================================================
  // 15. Symbol Handling (2 tests)
  // ===========================================================================
  describe('symbol handling on proxy', () => {
    it('Symbol.toPrimitive returns undefined', () => {
      const org = Headlessly({ tenant: 'test' })
      expect((org as any)[Symbol.toPrimitive]).toBeUndefined()
    })

    it('Symbol.iterator returns undefined', () => {
      const org = Headlessly({ tenant: 'test' })
      expect((org as any)[Symbol.iterator]).toBeUndefined()
    })
  })

  // ===========================================================================
  // 16. Org Is Not a Promise (3 tests)
  // ===========================================================================
  describe('org is not a promise', () => {
    it('can be used directly without await', () => {
      const org = Headlessly({ tenant: 'test' })
      // If the org were thenable, this assignment would trigger resolution
      expect(org.tenant).toBe('test')
    })

    it('wrapping in Promise.resolve does not alter behavior', async () => {
      const org = Headlessly({ tenant: 'test' })
      const resolved = await Promise.resolve(org)
      // Because then/catch/finally are undefined, Promise.resolve(org) returns the org itself
      expect(resolved.tenant).toBe('test')
    })

    it('org can be stored in an array without Promise.all issues', async () => {
      const orgs = [Headlessly({ tenant: 'a' }), Headlessly({ tenant: 'b' })]
      const results = await Promise.all(orgs.map((o) => Promise.resolve(o)))
      expect(results[0].tenant).toBe('a')
      expect(results[1].tenant).toBe('b')
    })
  })

  // ===========================================================================
  // 17. Entity Operations — Billing Domain (3 tests)
  // ===========================================================================
  describe('entity operations — billing domain through factory', () => {
    it('creates a Product through org proxy', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const product = await org.Product.create({ name: 'Pro Plan' })
      expect(product.$type).toBe('Product')
      expect(product.name).toBe('Pro Plan')
    })

    it('creates a Subscription through org proxy', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const sub = await org.Subscription.create({ name: 'Monthly Pro' })
      expect(sub.$type).toBe('Subscription')
    })

    it('creates an Invoice through org proxy', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const invoice = await org.Invoice.create({ name: 'INV-001' })
      expect(invoice.$type).toBe('Invoice')
    })
  })

  // ===========================================================================
  // 18. Entity Operations — Support, Marketing, Platform (4 tests)
  // ===========================================================================
  describe('entity operations — support, marketing, platform', () => {
    it('creates a Ticket through org proxy', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const ticket = await org.Ticket.create({ name: 'Bug report' })
      expect(ticket.$type).toBe('Ticket')
    })

    it('creates a Campaign through org proxy', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const campaign = await org.Campaign.create({ name: 'Launch Campaign' })
      expect(campaign.$type).toBe('Campaign')
    })

    it('creates a Workflow through org proxy', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const workflow = await org.Workflow.create({ name: 'Onboarding Flow' })
      expect(workflow.$type).toBe('Workflow')
    })

    it('creates an Experiment through org proxy', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const exp = await org.Experiment.create({ name: 'Pricing A/B Test' })
      expect(exp.$type).toBe('Experiment')
    })
  })

  // ===========================================================================
  // 19. Verb Access Through Factory (3 tests)
  // ===========================================================================
  describe('verb access through factory', () => {
    it('Contact has qualify verb', () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      expect(typeof org.Contact.qualify).toBe('function')
    })

    it('Deal has close verb', () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      expect(typeof org.Deal.close).toBe('function')
    })

    it('executing a custom verb through factory works', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const contact = await org.Contact.create({ name: 'VerbTest', status: 'Active' })
      // qualify should set the stage/status to 'Qualified'
      const qualified = await org.Contact.qualify(contact.$id)
      expect(qualified).toBeDefined()
    })
  })

  // ===========================================================================
  // 20. Entity Schema Access (2 tests)
  // ===========================================================================
  describe('entity schema access through factory', () => {
    it('entity $schema is accessible through org proxy', () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const schema = org.Contact.$schema
      expect(schema).toBeDefined()
      expect(schema.name).toBe('Contact')
    })

    it('entity $name returns the entity name', () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      expect(org.Contact.$name).toBe('Contact')
      expect(org.Deal.$name).toBe('Deal')
    })
  })
})
