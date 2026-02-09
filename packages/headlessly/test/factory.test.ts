import { describe, it, expect, beforeEach } from 'vitest'
import { clearRegistry, MemoryNounProvider, setProvider } from 'digital-objects'
import Headlessly from '../src/index'
import type { HeadlesslyOrg } from '../src/index'

describe('headless.ly — Headlessly() factory', () => {
  beforeEach(() => {
    clearRegistry()
    setProvider(new MemoryNounProvider())
  })

  describe('initialization', () => {
    it('returns an org object with tenant', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.tenant).toBe('test')
    })

    it('returns an org with context URL', () => {
      const org = Headlessly({ tenant: 'acme' })
      expect(org.context).toBe('https://headless.ly/~acme')
    })

    it('defaults to memory mode', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org).toBeDefined()
      // Should work without errors (memory mode)
    })
  })

  describe('entity access via proxy', () => {
    it('resolves Contact on org', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.Contact).toBeDefined()
    })

    it('resolves Deal on org', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.Deal).toBeDefined()
    })

    it('resolves Subscription on org', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.Subscription).toBeDefined()
    })

    it('resolves User on org', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.User).toBeDefined()
    })

    it('creates an entity through org proxy', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      const contact = await org.Contact.create({ name: 'Alice' })
      expect(contact.$type).toBe('Contact')
      expect(contact.name).toBe('Alice')
    })
  })

  describe('domain namespaces', () => {
    it('exposes crm namespace', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.crm).toBeDefined()
      expect((org.crm as any).Contact).toBeDefined()
    })

    it('exposes billing namespace', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.billing).toBeDefined()
      expect((org.billing as any).Subscription).toBeDefined()
    })

    it('exposes projects namespace', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.projects).toBeDefined()
    })

    it('exposes content namespace', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.content).toBeDefined()
    })

    it('exposes support namespace', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.support).toBeDefined()
    })

    it('exposes analytics namespace', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.analytics).toBeDefined()
    })

    it('exposes marketing namespace', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.marketing).toBeDefined()
    })

    it('exposes experiments namespace', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.experiments).toBeDefined()
    })

    it('exposes platform namespace', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.platform).toBeDefined()
    })
  })

  describe('MCP-like primitives', () => {
    it('has search function', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(typeof org.search).toBe('function')
    })

    it('has fetch function', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(typeof org.fetch).toBe('function')
    })

    it('has do function', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(typeof org.do).toBe('function')
    })

    it('search returns results', async () => {
      const org = Headlessly({ tenant: 'test' }) as HeadlesslyOrg & Record<string, any>
      await org.Contact.create({ name: 'Alice' })
      const results = await org.search({ type: 'Contact' })
      expect(results.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('proxy behavior', () => {
    it('returns undefined for unknown properties', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.nonExistent).toBeUndefined()
    })

    it('is not thenable (avoids auto-await)', () => {
      const org = Headlessly({ tenant: 'test' })
      expect(org.then).toBeUndefined()
      expect(org.catch).toBeUndefined()
      expect(org.finally).toBeUndefined()
    })
  })
})
