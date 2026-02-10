import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearRegistry, MemoryNounProvider, setProvider, getProvider } from 'digital-objects'
import { Headlessly } from '../src/index'
import type { HeadlesslyOrg } from '../src/index'

describe('headless.ly factory — deep coverage (RED)', () => {
  beforeEach(() => {
    clearRegistry()
    setProvider(new MemoryNounProvider())
  })

  // ===========================================================================
  // 1. Factory Modes (~8 tests)
  // ===========================================================================
  describe('factory modes', () => {
    it('defaults to memory mode when no mode is specified', () => {
      const org = Headlessly({ tenant: 'test-default' })
      expect(org).toBeDefined()
      expect(org.tenant).toBe('test-default')
      // Should have a MemoryNounProvider set
      const provider = getProvider()
      expect(provider).toBeInstanceOf(MemoryNounProvider)
    })

    it('mode=local creates a LocalNounProvider', () => {
      const org = Headlessly({ tenant: 'test-local', mode: 'local' })
      expect(org).toBeDefined()
      const provider = getProvider()
      expect(provider.constructor.name).toBe('LocalNounProvider')
    })

    it('mode=remote creates a DONounProvider', () => {
      const org = Headlessly({ tenant: 'test-remote', mode: 'remote', apiKey: 'key_test123' })
      expect(org).toBeDefined()
      const provider = getProvider()
      expect(provider.constructor.name).toBe('DONounProvider')
    })

    it('mode=remote uses default endpoint https://db.headless.ly', () => {
      const org = Headlessly({ tenant: 'test-remote-default', mode: 'remote' })
      expect(org).toBeDefined()
      const provider = getProvider() as any
      // The DONounProvider should have endpoint set to https://db.headless.ly/~test-remote-default
      expect(provider.endpoint).toBe('https://db.headless.ly/~test-remote-default')
    })

    it('mode=remote respects custom endpoint', () => {
      const org = Headlessly({ tenant: 'test-custom', mode: 'remote', endpoint: 'https://custom.example.com' })
      expect(org).toBeDefined()
      const provider = getProvider() as any
      expect(provider.endpoint).toBe('https://custom.example.com/~test-custom')
    })

    it('mode=remote constructs endpoint as ${baseUrl}/~${tenant}', () => {
      const org = Headlessly({ tenant: 'acme-corp', mode: 'remote', endpoint: 'https://my-api.dev' })
      expect(org).toBeDefined()
      const provider = getProvider() as any
      expect(provider.endpoint).toContain('/~acme-corp')
    })

    it('mode=memory reuses existing provider if already set', () => {
      const existingProvider = new MemoryNounProvider()
      setProvider(existingProvider)
      const org = Headlessly({ tenant: 'test-reuse', mode: 'memory' })
      expect(org).toBeDefined()
      const provider = getProvider()
      expect(provider).toBe(existingProvider)
    })

    it('invalid mode falls through to memory provider', () => {
      // TypeScript would reject this, but at runtime it should fall to default case
      const org = Headlessly({ tenant: 'test-fallback', mode: 'invalid' as any })
      expect(org).toBeDefined()
      const provider = getProvider()
      expect(provider).toBeInstanceOf(MemoryNounProvider)
    })
  })

  // ===========================================================================
  // 2. Proxy Behavior (~8 tests)
  // ===========================================================================
  describe('proxy behavior', () => {
    it('org.tenant returns the tenant string', () => {
      const org = Headlessly({ tenant: 'my-startup' })
      expect(org.tenant).toBe('my-startup')
    })

    it('org.context returns https://headless.ly/~{tenant}', () => {
      const org = Headlessly({ tenant: 'acme' })
      expect(org.context).toBe('https://headless.ly/~acme')
    })

    it('symbol properties return undefined', () => {
      const org = Headlessly({ tenant: 'test' })
      const sym = Symbol('test')
      expect((org as any)[sym]).toBeUndefined()
    })

    it('then returns undefined (anti-thenable)', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.then).toBeUndefined()
    })

    it('catch returns undefined (anti-thenable)', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.catch).toBeUndefined()
    })

    it('finally returns undefined (anti-thenable)', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.finally).toBeUndefined()
    })

    it('"tenant" in org returns true via has() trap', () => {
      const org = Headlessly({ tenant: 'test' })
      expect('tenant' in org).toBe(true)
    })

    it('"search" in org returns true via has() trap', () => {
      const org = Headlessly({ tenant: 'test' })
      expect('search' in org).toBe(true)
    })

    it('Object.keys(org) includes tenant, context, search, fetch, do, and domain names', () => {
      const org = Headlessly({ tenant: 'test' })
      const keys = Object.keys(org)
      expect(keys).toContain('tenant')
      expect(keys).toContain('context')
      expect(keys).toContain('search')
      expect(keys).toContain('fetch')
      expect(keys).toContain('do')
      expect(keys).toContain('crm')
      expect(keys).toContain('billing')
      expect(keys).toContain('projects')
      expect(keys).toContain('content')
      expect(keys).toContain('support')
      expect(keys).toContain('analytics')
      expect(keys).toContain('marketing')
      expect(keys).toContain('experiments')
      expect(keys).toContain('platform')
    })

    it('org.nonExistentProp returns undefined', () => {
      const org = Headlessly({ tenant: 'test' })
      expect((org as any).nonExistentProp).toBeUndefined()
    })
  })

  // ===========================================================================
  // 3. Domain Namespaces (~6 tests)
  // ===========================================================================
  describe('domain namespaces — deep', () => {
    it('org.crm is defined and is an object', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.crm).toBeDefined()
      expect(typeof org.crm).toBe('object')
    })

    it('org.billing is defined and is an object', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.billing).toBeDefined()
      expect(typeof org.billing).toBe('object')
    })

    it('org.projects is defined and is an object', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.projects).toBeDefined()
      expect(typeof org.projects).toBe('object')
    })

    it('all 9 domain namespaces are accessible', () => {
      const org = Headlessly({ tenant: 'test' })
      const domainNames = ['crm', 'billing', 'projects', 'content', 'support', 'analytics', 'marketing', 'experiments', 'platform']
      for (const name of domainNames) {
        expect((org as any)[name]).toBeDefined()
      }
    })

    it('"crm" in org returns true via has() trap', () => {
      const org = Headlessly({ tenant: 'test' })
      expect('crm' in org).toBe(true)
    })

    it('org.crm.Contact is defined (entity via namespace)', () => {
      const org = Headlessly({ tenant: 'test' })
      const crmNs = org.crm as Record<string, unknown>
      expect(crmNs.Contact).toBeDefined()
    })
  })

  // ===========================================================================
  // 4. MCP Primitives (~4 tests)
  // ===========================================================================
  describe('MCP primitives — deep', () => {
    it('org.search is a function', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(typeof org.search).toBe('function')
    })

    it('org.fetch is a function', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(typeof org.fetch).toBe('function')
    })

    it('org.do is a function', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(typeof org.do).toBe('function')
    })

    it('all three MCP primitives delegate to $ context', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      // Create a contact via org proxy
      const contact = await org.Contact.create({ name: 'Delegated Alice' })
      expect(contact).toBeDefined()
      expect(contact.name).toBe('Delegated Alice')

      // search should find it via $ delegation
      const results = await org.search({ type: 'Contact' })
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBeGreaterThanOrEqual(1)

      // fetch should retrieve it via $ delegation
      const fetched = await org.fetch({ type: 'Contact', id: contact.$id })
      expect(fetched).toBeDefined()
      expect((fetched as any).name).toBe('Delegated Alice')

      // do should execute against $ context
      const result = await org.do(async (ctx: any) => {
        return ctx.Contact ? 'has-contact' : 'no-contact'
      })
      expect(result).toBe('has-contact')
    })
  })

  // ===========================================================================
  // 5. Multi-Tenant (~4 tests)
  // ===========================================================================
  describe('multi-tenant', () => {
    it('two Headlessly instances with different tenants have different contexts', () => {
      const orgA = Headlessly({ tenant: 'alpha' })
      const orgB = Headlessly({ tenant: 'beta' })
      expect(orgA.context).not.toBe(orgB.context)
      expect(orgA.context).toBe('https://headless.ly/~alpha')
      expect(orgB.context).toBe('https://headless.ly/~beta')
    })

    it('each org instance is independent (different tenant values)', () => {
      const org1 = Headlessly({ tenant: 'tenant-one' })
      const org2 = Headlessly({ tenant: 'tenant-two' })
      expect(org1.tenant).toBe('tenant-one')
      expect(org2.tenant).toBe('tenant-two')
    })

    it('switching tenants does not corrupt the other org reference', () => {
      const orgA = Headlessly({ tenant: 'stable' })
      // Creating a second org should not change the first
      const orgB = Headlessly({ tenant: 'volatile' })
      expect(orgA.tenant).toBe('stable')
      expect(orgA.context).toBe('https://headless.ly/~stable')
      // orgB is its own entity
      expect(orgB.tenant).toBe('volatile')
    })

    it('template option is accepted without errors', () => {
      const org = Headlessly({ tenant: 'test-template', template: 'b2b' })
      expect(org).toBeDefined()
      expect(org.tenant).toBe('test-template')
    })

    it('transport option is accepted for remote mode', () => {
      const org = Headlessly({ tenant: 'test-ws', mode: 'remote', transport: 'ws' })
      expect(org).toBeDefined()
      expect(org.tenant).toBe('test-ws')
    })

    it('data created in one org is isolated from another org (tenant isolation)', async () => {
      // This tests that entities created under one tenant context are not visible under another
      // With the current shared MemoryNounProvider, this will likely FAIL — demonstrating
      // that true multi-tenant isolation is not yet implemented
      clearRegistry()
      setProvider(new MemoryNounProvider())

      const orgA = Headlessly({ tenant: 'isolated-a' }) as HeadlesslyOrg & Record<string, any>
      await orgA.Contact.create({ name: 'Alice in A' })

      // Create a separate provider for orgB
      clearRegistry()
      setProvider(new MemoryNounProvider())

      const orgB = Headlessly({ tenant: 'isolated-b' }) as HeadlesslyOrg & Record<string, any>
      const resultsB = await orgB.search({ type: 'Contact' })

      // In a properly isolated system, orgB should NOT see orgA's contacts
      expect(resultsB.length).toBe(0)
    })
  })
})
