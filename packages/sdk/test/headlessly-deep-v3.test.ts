import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { clearRegistry, setProvider, getProvider } from 'digital-objects'
import { Headlessly, LocalNounProvider } from '../src/index'
import type { HeadlesslyOrg } from '../src/index'

type OrgWithEntities = HeadlesslyOrg & Record<string, any>

/**
 * Hook-safe test helpers.
 *
 * Because NounEntity proxies are module-level singletons, hooks registered
 * on them persist across tests. Every hook registered in these tests MUST
 * be unsubscribed via the returned function in afterEach to avoid pollution.
 */
const hookCleanups: Array<() => void> = []

function trackHook(unsub: () => void): () => void {
  hookCleanups.push(unsub)
  return unsub
}

describe('headlessly-deep-v3 — 74 new tests', () => {
  beforeEach(() => {
    clearRegistry()
    setProvider(new LocalNounProvider())
  })

  afterEach(() => {
    // Unsubscribe all hooks registered during this test
    for (const unsub of hookCleanups) unsub()
    hookCleanups.length = 0
  })

  // ===========================================================================
  // 1. BEFORE Hook Registration and Execution (8 tests)
  // ===========================================================================
  describe('BEFORE hook lifecycle (creating/qualifying)', () => {
    it('Contact.creating() registers a BEFORE hook that fires on create', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const calls: string[] = []
      trackHook(
        org.Contact.creating((data: Record<string, unknown>) => {
          calls.push(`creating:${data.name}`)
        }),
      )
      await org.Contact.create({ name: 'Alice' })
      expect(calls).toEqual(['creating:Alice'])
    })

    it('BEFORE hook can transform input data', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      trackHook(
        org.Contact.creating((data: Record<string, unknown>) => {
          return { ...data, name: data.name + ' (enriched)' }
        }),
      )
      const contact = await org.Contact.create({ name: 'Bob' })
      expect(contact.name).toBe('Bob (enriched)')
    })

    it('multiple BEFORE hooks execute in registration order', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const order: number[] = []
      trackHook(org.Contact.creating(() => { order.push(1) }))
      trackHook(org.Contact.creating(() => { order.push(2) }))
      trackHook(org.Contact.creating(() => { order.push(3) }))
      await org.Contact.create({ name: 'Multi' })
      expect(order).toEqual([1, 2, 3])
    })

    it('BEFORE hook for update fires on update', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const calls: string[] = []
      trackHook(
        org.Contact.updating((data: Record<string, unknown>) => {
          calls.push(`updating:${data.name}`)
        }),
      )
      const contact = await org.Contact.create({ name: 'Eve' })
      await org.Contact.update(contact.$id, { name: 'Eve Updated' })
      expect(calls).toEqual(['updating:Eve Updated'])
    })

    it('BEFORE hook for delete fires on delete', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const calls: string[] = []
      trackHook(
        org.Contact.deleting((data: Record<string, unknown>) => {
          calls.push(`deleting:${data.$id}`)
        }),
      )
      const contact = await org.Contact.create({ name: 'ToDelete' })
      await org.Contact.delete(contact.$id)
      expect(calls.length).toBe(1)
      expect(calls[0]).toContain('deleting:')
    })

    it('qualifying BEFORE hook fires when qualify verb is called', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const calls: string[] = []
      trackHook(
        org.Contact.qualifying(() => {
          calls.push('qualifying')
        }),
      )
      const contact = await org.Contact.create({ name: 'QualifyMe', status: 'Active' })
      await org.Contact.qualify(contact.$id)
      expect(calls).toEqual(['qualifying'])
    })

    it('BEFORE hook that throws rejects the operation', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      trackHook(
        org.Contact.creating(() => {
          throw new Error('Validation failed')
        }),
      )
      await expect(org.Contact.create({ name: 'Rejected' })).rejects.toThrow('Validation failed')
    })

    it('BEFORE hook chaining: second hook receives transformed data from first', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      trackHook(
        org.Contact.creating((data: Record<string, unknown>) => {
          return { ...data, step: 'first' }
        }),
      )
      trackHook(
        org.Contact.creating((data: Record<string, unknown>) => {
          return { ...data, step: data.step + '+second' }
        }),
      )
      const contact = await org.Contact.create({ name: 'Chain' })
      expect(contact.step).toBe('first+second')
    })
  })

  // ===========================================================================
  // 2. AFTER Hook Registration and Execution (7 tests)
  // ===========================================================================
  describe('AFTER hook lifecycle (created/qualified)', () => {
    it('Contact.created() registers an AFTER hook that fires after create', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const calls: string[] = []
      trackHook(
        org.Contact.created((instance: any) => {
          calls.push(`created:${instance.name}`)
        }),
      )
      await org.Contact.create({ name: 'Alice' })
      expect(calls).toEqual(['created:Alice'])
    })

    it('AFTER hook receives the created instance with $id and $type', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      let capturedInstance: any = null
      trackHook(
        org.Contact.created((instance: any) => {
          capturedInstance = instance
        }),
      )
      await org.Contact.create({ name: 'PostCreate' })
      expect(capturedInstance).not.toBeNull()
      expect(capturedInstance.$id).toBeDefined()
      expect(capturedInstance.$type).toBe('Contact')
      expect(capturedInstance.name).toBe('PostCreate')
    })

    it('AFTER hook receives $ entity registry as second argument', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      let receivedCtx: any = null
      trackHook(
        org.Contact.created((_instance: any, $ctx: any) => {
          receivedCtx = $ctx
        }),
      )
      await org.Contact.create({ name: 'CtxTest' })
      expect(receivedCtx).toBeDefined()
      expect(receivedCtx.Contact).toBeDefined()
      expect(receivedCtx.Deal).toBeDefined()
    })

    it('qualified AFTER hook fires after qualify verb executes', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const calls: string[] = []
      trackHook(
        org.Contact.qualified((instance: any) => {
          calls.push(`qualified:${instance.name}`)
        }),
      )
      const contact = await org.Contact.create({ name: 'QualTarget', status: 'Active' })
      await org.Contact.qualify(contact.$id)
      expect(calls.length).toBe(1)
      expect(calls[0]).toContain('qualified:QualTarget')
    })

    it('multiple AFTER hooks execute in registration order', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const order: number[] = []
      trackHook(org.Contact.created(() => { order.push(1) }))
      trackHook(org.Contact.created(() => { order.push(2) }))
      await org.Contact.create({ name: 'MultiAfter' })
      expect(order).toEqual([1, 2])
    })

    it('AFTER hook for update fires after update', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const calls: string[] = []
      trackHook(
        org.Contact.updated((instance: any) => {
          calls.push(`updated:${instance.name}`)
        }),
      )
      const contact = await org.Contact.create({ name: 'BeforeUpdate' })
      await org.Contact.update(contact.$id, { name: 'AfterUpdate' })
      expect(calls).toEqual(['updated:AfterUpdate'])
    })

    it('AFTER hook for delete fires after delete', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const calls: string[] = []
      trackHook(
        org.Contact.deleted(() => {
          calls.push('deleted')
        }),
      )
      const contact = await org.Contact.create({ name: 'WillDelete' })
      await org.Contact.delete(contact.$id)
      expect(calls).toEqual(['deleted'])
    })
  })

  // ===========================================================================
  // 3. Hook Unsubscribe Lifecycle (4 tests)
  // ===========================================================================
  describe('hook unsubscribe lifecycle', () => {
    it('creating() returns an unsubscribe function', () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const unsub = org.Contact.creating(() => {})
      expect(typeof unsub).toBe('function')
      unsub() // clean up
    })

    it('calling unsubscribe prevents the hook from firing', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const calls: string[] = []
      const unsub = org.Contact.creating(() => {
        calls.push('should-not-fire')
      })
      unsub()
      await org.Contact.create({ name: 'NoHook' })
      expect(calls).toEqual([])
    })

    it('created() returns an unsubscribe function', () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const unsub = org.Contact.created(() => {})
      expect(typeof unsub).toBe('function')
      unsub() // clean up
    })

    it('unsubscribing one hook does not affect other hooks', async () => {
      const org = Headlessly({ tenant: 'hooks' }) as OrgWithEntities
      const calls: string[] = []
      const unsub1 = org.Contact.created(() => { calls.push('hook1') })
      trackHook(org.Contact.created(() => { calls.push('hook2') }))
      unsub1()
      await org.Contact.create({ name: 'PartialUnsub' })
      expect(calls).toEqual(['hook2'])
    })
  })

  // ===========================================================================
  // 4. Multi-Tenant Data Isolation (5 tests)
  // ===========================================================================
  describe('multi-tenant data isolation with separate providers', () => {
    it('org A data is invisible to org B with separate providers', async () => {
      const providerA = new LocalNounProvider()
      setProvider(providerA)
      const orgA = Headlessly({ tenant: 'tenant-a' }) as OrgWithEntities
      await orgA.Contact.create({ name: 'Alice in A' })
      await orgA.Contact.create({ name: 'Bob in A' })

      // Switch to org B with a fresh provider
      const providerB = new LocalNounProvider()
      setProvider(providerB)
      const orgB = Headlessly({ tenant: 'tenant-b' }) as OrgWithEntities
      const resultsB = await orgB.search({ type: 'Contact' })
      expect(resultsB.length).toBe(0)
    })

    it('org B data is invisible to org A after provider swap', async () => {
      const providerA = new LocalNounProvider()
      setProvider(providerA)
      Headlessly({ tenant: 'tenant-a' })

      // Create data in B
      const providerB = new LocalNounProvider()
      setProvider(providerB)
      const orgB = Headlessly({ tenant: 'tenant-b' }) as OrgWithEntities
      await orgB.Contact.create({ name: 'Charlie in B' })

      // Switch back to A
      setProvider(providerA)
      Headlessly({ tenant: 'tenant-a' })
      const orgA = Headlessly({ tenant: 'tenant-a' }) as OrgWithEntities
      const resultsA = await orgA.search({ type: 'Contact' })
      expect(resultsA.length).toBe(0)
    })

    it('each tenant context URL is unique', () => {
      const org1 = Headlessly({ tenant: 'alpha' })
      const org2 = Headlessly({ tenant: 'beta' })
      const org3 = Headlessly({ tenant: 'gamma' })
      expect(org1.context).toBe('https://headless.ly/~alpha')
      expect(org2.context).toBe('https://headless.ly/~beta')
      expect(org3.context).toBe('https://headless.ly/~gamma')
      const contexts = new Set([org1.context, org2.context, org3.context])
      expect(contexts.size).toBe(3)
    })

    it('creating entities in tenant A does not affect tenant B counts', async () => {
      setProvider(new LocalNounProvider())
      const orgA = Headlessly({ tenant: 'count-a' }) as OrgWithEntities
      await orgA.Deal.create({ name: 'Deal 1', value: 100 })
      await orgA.Deal.create({ name: 'Deal 2', value: 200 })
      await orgA.Deal.create({ name: 'Deal 3', value: 300 })

      setProvider(new LocalNounProvider())
      const orgB = Headlessly({ tenant: 'count-b' }) as OrgWithEntities
      const dealsB = await orgB.Deal.find()
      expect(dealsB.length).toBe(0)
    })

    it('delete in tenant A does not affect tenant B', async () => {
      const provA = new LocalNounProvider()
      setProvider(provA)
      const orgA = Headlessly({ tenant: 'del-a' }) as OrgWithEntities
      const c = await orgA.Contact.create({ name: 'ToDelete' })

      const provB = new LocalNounProvider()
      setProvider(provB)
      const orgB = Headlessly({ tenant: 'del-b' }) as OrgWithEntities
      await orgB.Contact.create({ name: 'Safe' })

      // Delete in A
      setProvider(provA)
      await orgA.Contact.delete(c.$id)

      // B's data still intact
      setProvider(provB)
      const safe = await orgB.Contact.find()
      expect(safe.length).toBe(1)
      expect(safe[0].name).toBe('Safe')
    })
  })

  // ===========================================================================
  // 5. MongoDB-Style Query Operators through Search (8 tests)
  // ===========================================================================
  describe('MongoDB-style query operators through search/find', () => {
    it('$gt operator filters by greater than', async () => {
      const org = Headlessly({ tenant: 'query' }) as OrgWithEntities
      await org.Deal.create({ name: 'Small', value: 1000 })
      await org.Deal.create({ name: 'Medium', value: 5000 })
      await org.Deal.create({ name: 'Large', value: 15000 })
      const results = await org.Deal.find({ value: { $gt: 5000 } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('Large')
    })

    it('$gte operator filters by greater than or equal', async () => {
      const org = Headlessly({ tenant: 'query' }) as OrgWithEntities
      await org.Deal.create({ name: 'Small', value: 1000 })
      await org.Deal.create({ name: 'Medium', value: 5000 })
      await org.Deal.create({ name: 'Large', value: 15000 })
      const results = await org.Deal.find({ value: { $gte: 5000 } })
      expect(results.length).toBe(2)
    })

    it('$lt operator filters by less than', async () => {
      const org = Headlessly({ tenant: 'query' }) as OrgWithEntities
      await org.Deal.create({ name: 'Small', value: 1000 })
      await org.Deal.create({ name: 'Medium', value: 5000 })
      await org.Deal.create({ name: 'Large', value: 15000 })
      const results = await org.Deal.find({ value: { $lt: 5000 } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('Small')
    })

    it('$lte operator filters by less than or equal', async () => {
      const org = Headlessly({ tenant: 'query' }) as OrgWithEntities
      await org.Deal.create({ name: 'Small', value: 1000 })
      await org.Deal.create({ name: 'Medium', value: 5000 })
      await org.Deal.create({ name: 'Large', value: 15000 })
      const results = await org.Deal.find({ value: { $lte: 5000 } })
      expect(results.length).toBe(2)
    })

    it('$in operator matches values in a set', async () => {
      const org = Headlessly({ tenant: 'query' }) as OrgWithEntities
      await org.Contact.create({ name: 'Alice', department: 'Sales' })
      await org.Contact.create({ name: 'Bob', department: 'Engineering' })
      await org.Contact.create({ name: 'Carol', department: 'Marketing' })
      const results = await org.Contact.find({ department: { $in: ['Sales', 'Marketing'] } })
      expect(results.length).toBe(2)
    })

    it('$nin operator excludes values in a set', async () => {
      const org = Headlessly({ tenant: 'query' }) as OrgWithEntities
      await org.Contact.create({ name: 'Alice', department: 'Sales' })
      await org.Contact.create({ name: 'Bob', department: 'Engineering' })
      await org.Contact.create({ name: 'Carol', department: 'Marketing' })
      const results = await org.Contact.find({ department: { $nin: ['Sales', 'Marketing'] } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('Bob')
    })

    it('$regex operator matches patterns', async () => {
      const org = Headlessly({ tenant: 'query' }) as OrgWithEntities
      await org.Contact.create({ name: 'Alice Smith' })
      await org.Contact.create({ name: 'Bob Johnson' })
      await org.Contact.create({ name: 'Alice Jones' })
      const results = await org.Contact.find({ name: { $regex: '^Alice' } })
      expect(results.length).toBe(2)
    })

    it('$exists operator checks field presence', async () => {
      const org = Headlessly({ tenant: 'query' }) as OrgWithEntities
      await org.Contact.create({ name: 'WithPhone', phone: '555-1234' })
      await org.Contact.create({ name: 'NoPhone' })
      const results = await org.Contact.find({ phone: { $exists: true } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('WithPhone')
    })
  })

  // ===========================================================================
  // 6. Concurrent Operations via Promise.all (4 tests)
  // ===========================================================================
  describe('concurrent operations through factory', () => {
    it('concurrent creates via Promise.all all succeed', async () => {
      const org = Headlessly({ tenant: 'concurrent' }) as OrgWithEntities
      const results = await Promise.all([
        org.Contact.create({ name: 'A' }),
        org.Contact.create({ name: 'B' }),
        org.Contact.create({ name: 'C' }),
        org.Contact.create({ name: 'D' }),
        org.Contact.create({ name: 'E' }),
      ])
      expect(results.length).toBe(5)
      results.forEach((r: any) => {
        expect(r.$type).toBe('Contact')
        expect(r.$id).toBeDefined()
      })
    })

    it('concurrent creates across entity types succeed', async () => {
      const org = Headlessly({ tenant: 'concurrent' }) as OrgWithEntities
      const [contact, deal, project, ticket, campaign] = await Promise.all([
        org.Contact.create({ name: 'CrossA' }),
        org.Deal.create({ name: 'CrossDeal', value: 1000 }),
        org.Project.create({ name: 'CrossProject' }),
        org.Ticket.create({ name: 'CrossTicket' }),
        org.Campaign.create({ name: 'CrossCampaign' }),
      ])
      expect(contact.$type).toBe('Contact')
      expect(deal.$type).toBe('Deal')
      expect(project.$type).toBe('Project')
      expect(ticket.$type).toBe('Ticket')
      expect(campaign.$type).toBe('Campaign')
    })

    it('concurrent find operations return consistent results', async () => {
      const org = Headlessly({ tenant: 'concurrent' }) as OrgWithEntities
      await org.Contact.create({ name: 'Consistent1' })
      await org.Contact.create({ name: 'Consistent2' })
      const [r1, r2, r3] = await Promise.all([org.Contact.find(), org.Contact.find(), org.Contact.find()])
      expect(r1.length).toBe(r2.length)
      expect(r2.length).toBe(r3.length)
    })

    it('all unique $ids across concurrent creates', async () => {
      const org = Headlessly({ tenant: 'concurrent' }) as OrgWithEntities
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) => org.Contact.create({ name: `Batch${i}` })),
      )
      const ids = results.map((r: any) => r.$id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(20)
    })
  })

  // ===========================================================================
  // 7. Schema Inspection Depth (6 tests)
  // ===========================================================================
  describe('schema inspection through factory', () => {
    it('Contact.$schema has fields map with name field', () => {
      const org = Headlessly({ tenant: 'schema' }) as OrgWithEntities
      const schema = org.Contact.$schema
      expect(schema.fields).toBeDefined()
      expect(schema.fields instanceof Map).toBe(true)
      expect(schema.fields.has('name')).toBe(true)
    })

    it('Contact.$schema has relationships map with organization', () => {
      const org = Headlessly({ tenant: 'schema' }) as OrgWithEntities
      const schema = org.Contact.$schema
      expect(schema.relationships).toBeDefined()
      expect(schema.relationships instanceof Map).toBe(true)
      expect(schema.relationships.has('organization')).toBe(true)
    })

    it('Contact.$schema.verbs includes qualify verb conjugation', () => {
      const org = Headlessly({ tenant: 'schema' }) as OrgWithEntities
      const schema = org.Contact.$schema
      expect(schema.verbs).toBeDefined()
      expect(schema.verbs instanceof Map).toBe(true)
      const qualifyVerb = schema.verbs.get('qualify')
      expect(qualifyVerb).toBeDefined()
      expect(qualifyVerb!.action).toBe('qualify')
      expect(qualifyVerb!.activity).toBe('qualifying')
      expect(qualifyVerb!.event).toBe('qualified')
    })

    it('Deal.$schema.verbs includes close, win, lose', () => {
      const org = Headlessly({ tenant: 'schema' }) as OrgWithEntities
      const schema = org.Deal.$schema
      expect(schema.verbs.has('close')).toBe(true)
      expect(schema.verbs.has('win')).toBe(true)
      expect(schema.verbs.has('lose')).toBe(true)
    })

    it('schema.singular and schema.plural are correctly derived', () => {
      const org = Headlessly({ tenant: 'schema' }) as OrgWithEntities
      expect(org.Contact.$schema.singular).toBe('contact')
      expect(org.Contact.$schema.plural).toBe('contacts')
      expect(org.Deal.$schema.singular).toBe('deal')
      expect(org.Deal.$schema.plural).toBe('deals')
    })

    it('schema.slug is lowercase of the noun name', () => {
      const org = Headlessly({ tenant: 'schema' }) as OrgWithEntities
      expect(org.Contact.$schema.slug).toBe('contact')
      expect(org.FeatureFlag.$schema.slug).toBe('feature-flag')
    })
  })

  // ===========================================================================
  // 8. Cross-Domain Verb Execution (6 tests)
  // ===========================================================================
  describe('cross-domain verb execution through factory', () => {
    it('Deal.close() transitions the entity', async () => {
      const org = Headlessly({ tenant: 'verbs' }) as OrgWithEntities
      const deal = await org.Deal.create({ name: 'CloseDeal', value: 5000, stage: 'Negotiation' })
      const closed = await org.Deal.close(deal.$id)
      expect(closed).toBeDefined()
      expect(closed.$version).toBeGreaterThanOrEqual(2)
    })

    it('Issue.close() transitions the issue', async () => {
      const org = Headlessly({ tenant: 'verbs' }) as OrgWithEntities
      const issue = await org.Issue.create({ title: 'Bug Fix', status: 'Open' })
      const closed = await org.Issue.close(issue.$id)
      expect(closed).toBeDefined()
    })

    it('Issue.reopen() verb is available', () => {
      const org = Headlessly({ tenant: 'verbs' }) as OrgWithEntities
      expect(typeof org.Issue.reopen).toBe('function')
    })

    it('Subscription.cancel() verb is available', () => {
      const org = Headlessly({ tenant: 'verbs' }) as OrgWithEntities
      expect(typeof org.Subscription.cancel).toBe('function')
    })

    it('Subscription.pause() verb is available', () => {
      const org = Headlessly({ tenant: 'verbs' }) as OrgWithEntities
      expect(typeof org.Subscription.pause).toBe('function')
    })

    it('Subscription.reactivate() verb is available', () => {
      const org = Headlessly({ tenant: 'verbs' }) as OrgWithEntities
      expect(typeof org.Subscription.reactivate).toBe('function')
    })
  })

  // ===========================================================================
  // 9. Entity ID Format Validation (4 tests)
  // ===========================================================================
  describe('entity ID format validation', () => {
    it('Contact $id starts with "contact_"', async () => {
      const org = Headlessly({ tenant: 'ids' }) as OrgWithEntities
      const contact = await org.Contact.create({ name: 'ID Test' })
      expect(contact.$id).toMatch(/^contact_/)
    })

    it('Deal $id starts with "deal_"', async () => {
      const org = Headlessly({ tenant: 'ids' }) as OrgWithEntities
      const deal = await org.Deal.create({ name: 'Deal ID', value: 100 })
      expect(deal.$id).toMatch(/^deal_/)
    })

    it('Subscription $id starts with "subscription_"', async () => {
      const org = Headlessly({ tenant: 'ids' }) as OrgWithEntities
      const sub = await org.Subscription.create({ name: 'Sub ID' })
      expect(sub.$id).toMatch(/^subscription_/)
    })

    it('$id suffix is alphanumeric (sqid format)', async () => {
      const org = Headlessly({ tenant: 'ids' }) as OrgWithEntities
      const contact = await org.Contact.create({ name: 'Sqid Test' })
      const suffix = contact.$id.replace('contact_', '')
      expect(suffix).toMatch(/^[a-zA-Z0-9]+$/)
      expect(suffix.length).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // 10. Metadata Field Semantics (5 tests)
  // ===========================================================================
  describe('metadata field semantics ($version, $createdAt, $updatedAt)', () => {
    it('newly created entity has $version = 1', async () => {
      const org = Headlessly({ tenant: 'meta' }) as OrgWithEntities
      const c = await org.Contact.create({ name: 'V1' })
      expect(c.$version).toBe(1)
    })

    it('updated entity has $version = 2', async () => {
      const org = Headlessly({ tenant: 'meta' }) as OrgWithEntities
      const c = await org.Contact.create({ name: 'V1' })
      const u = await org.Contact.update(c.$id, { name: 'V2' })
      expect(u.$version).toBe(2)
    })

    it('double update increments $version to 3', async () => {
      const org = Headlessly({ tenant: 'meta' }) as OrgWithEntities
      const c = await org.Contact.create({ name: 'V1' })
      await org.Contact.update(c.$id, { name: 'V2' })
      const u3 = await org.Contact.update(c.$id, { name: 'V3' })
      expect(u3.$version).toBe(3)
    })

    it('$createdAt is an ISO datetime string', async () => {
      const org = Headlessly({ tenant: 'meta' }) as OrgWithEntities
      const c = await org.Contact.create({ name: 'TimeTest' })
      expect(typeof c.$createdAt).toBe('string')
      const parsed = new Date(c.$createdAt)
      expect(parsed.getTime()).not.toBeNaN()
    })

    it('$updatedAt changes on update but $createdAt does not', async () => {
      const org = Headlessly({ tenant: 'meta' }) as OrgWithEntities
      const c = await org.Contact.create({ name: 'TimeCheck' })
      const originalCreatedAt = c.$createdAt
      await new Promise((r) => setTimeout(r, 5))
      const u = await org.Contact.update(c.$id, { name: 'Updated' })
      expect(u.$createdAt).toBe(originalCreatedAt)
      expect(new Date(u.$updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(originalCreatedAt).getTime())
    })
  })

  // ===========================================================================
  // 11. Do Primitive Error Handling (3 tests)
  // ===========================================================================
  describe('do primitive error handling', () => {
    it('do() propagates errors from the function', async () => {
      const org = Headlessly({ tenant: 'errors' }) as OrgWithEntities
      await expect(
        org.do(async () => {
          throw new Error('do-error')
        }),
      ).rejects.toThrow('do-error')
    })

    it('do() propagates errors from failed entity operations', async () => {
      const org = Headlessly({ tenant: 'errors' }) as OrgWithEntities
      await expect(
        org.do(async (ctx: any) => {
          await ctx.Contact.update('contact_nonexistent', { name: 'nope' })
        }),
      ).rejects.toThrow()
    })

    it('do() returns undefined when function returns undefined', async () => {
      const org = Headlessly({ tenant: 'errors' }) as OrgWithEntities
      const result = await org.do(async () => {
        return undefined
      })
      expect(result).toBeUndefined()
    })
  })

  // ===========================================================================
  // 12. Namespace Entity CRUD (4 tests)
  // ===========================================================================
  describe('namespace entity CRUD operations', () => {
    it('org.crm.Contact.create works through namespace', async () => {
      const org = Headlessly({ tenant: 'ns-crud' }) as OrgWithEntities
      const crmNs = org.crm as Record<string, any>
      const contact = await crmNs.Contact.create({ name: 'NsAlice' })
      expect(contact.$type).toBe('Contact')
      expect(contact.name).toBe('NsAlice')
    })

    it('org.billing.Product.create works through namespace', async () => {
      const org = Headlessly({ tenant: 'ns-crud' }) as OrgWithEntities
      const billingNs = org.billing as Record<string, any>
      const product = await billingNs.Product.create({ name: 'NsProduct' })
      expect(product.$type).toBe('Product')
    })

    it('org.projects.Issue.create works through namespace', async () => {
      const org = Headlessly({ tenant: 'ns-crud' }) as OrgWithEntities
      const projectsNs = org.projects as Record<string, any>
      const issue = await projectsNs.Issue.create({ title: 'NsIssue' })
      expect(issue.$type).toBe('Issue')
    })

    it('entities created via namespace are findable via direct proxy', async () => {
      const org = Headlessly({ tenant: 'ns-crud' }) as OrgWithEntities
      const crmNs = org.crm as Record<string, any>
      await crmNs.Contact.create({ name: 'NsCross' })
      const results = await org.Contact.find()
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some((r: any) => r.name === 'NsCross')).toBe(true)
    })
  })

  // ===========================================================================
  // 13. Provider Lifecycle (3 tests)
  // ===========================================================================
  describe('provider lifecycle', () => {
    it('setProvider followed by getProvider returns the same instance', () => {
      const provider = new LocalNounProvider()
      setProvider(provider)
      expect(getProvider()).toBe(provider)
    })

    it('Headlessly memory mode sets a LocalNounProvider', () => {
      Headlessly({ tenant: 'provider-test', mode: 'memory' })
      const provider = getProvider()
      expect(provider).toBeInstanceOf(LocalNounProvider)
    })

    it('provider persists across entity operations', async () => {
      const provider = new LocalNounProvider()
      setProvider(provider)
      const org = Headlessly({ tenant: 'persist' }) as OrgWithEntities
      await org.Contact.create({ name: 'Persist1' })
      await org.Contact.create({ name: 'Persist2' })
      expect(getProvider()).toBe(provider)
    })
  })

  // ===========================================================================
  // 14. Verb Conjugation Completeness (4 tests)
  // ===========================================================================
  describe('verb conjugation completeness', () => {
    it('CRUD verbs produce correct conjugations (create/creating/created)', () => {
      const org = Headlessly({ tenant: 'conj' }) as OrgWithEntities
      const schema = org.Contact.$schema
      const createVerb = schema.verbs.get('create')
      expect(createVerb).toBeDefined()
      expect(createVerb!.action).toBe('create')
      expect(createVerb!.activity).toBe('creating')
      expect(createVerb!.event).toBe('created')
    })

    it('update verb has correct conjugation (update/updating/updated)', () => {
      const org = Headlessly({ tenant: 'conj' }) as OrgWithEntities
      const schema = org.Contact.$schema
      const updateVerb = schema.verbs.get('update')
      expect(updateVerb).toBeDefined()
      expect(updateVerb!.action).toBe('update')
      expect(updateVerb!.activity).toBe('updating')
      expect(updateVerb!.event).toBe('updated')
    })

    it('delete verb has correct conjugation (delete/deleting/deleted)', () => {
      const org = Headlessly({ tenant: 'conj' }) as OrgWithEntities
      const schema = org.Contact.$schema
      const deleteVerb = schema.verbs.get('delete')
      expect(deleteVerb).toBeDefined()
      expect(deleteVerb!.action).toBe('delete')
      expect(deleteVerb!.activity).toBe('deleting')
      expect(deleteVerb!.event).toBe('deleted')
    })

    it('custom verb qualify has reverseBy field', () => {
      const org = Headlessly({ tenant: 'conj' }) as OrgWithEntities
      const schema = org.Contact.$schema
      const qualifyVerb = schema.verbs.get('qualify')
      expect(qualifyVerb).toBeDefined()
      expect(qualifyVerb!.reverseBy).toBeDefined()
      expect(typeof qualifyVerb!.reverseBy).toBe('string')
    })
  })

  // ===========================================================================
  // 15. Factory Reconfiguration via New Instance (3 tests)
  // ===========================================================================
  describe('factory reconfiguration', () => {
    it('creating new factory instance with different mode changes provider', () => {
      Headlessly({ tenant: 'first', mode: 'memory' })
      expect(getProvider()).toBeInstanceOf(LocalNounProvider)

      Headlessly({ tenant: 'second', mode: 'local' })
      const provider = getProvider()
      expect(provider.constructor.name).toBe('LocalNounProvider')
    })

    it('creating new factory instance with remote mode changes provider', () => {
      Headlessly({ tenant: 'mem', mode: 'memory' })
      expect(getProvider()).toBeInstanceOf(LocalNounProvider)

      Headlessly({ tenant: 'rem', mode: 'remote', apiKey: 'key_test' })
      const provider = getProvider()
      expect(provider.constructor.name).toBe('DONounProvider')
    })

    it('fresh setProvider with new LocalNounProvider resets data', async () => {
      const org1 = Headlessly({ tenant: 'reset1' }) as OrgWithEntities
      await org1.Contact.create({ name: 'Before Reset' })

      setProvider(new LocalNounProvider())
      const org2 = Headlessly({ tenant: 'reset2' }) as OrgWithEntities
      const results = await org2.Contact.find()
      expect(results.length).toBe(0)
    })
  })

  // ===========================================================================
  // 16. Additional Verb Coverage from Other Domains (5 tests)
  // ===========================================================================
  describe('additional domain verb coverage', () => {
    it('Campaign.launch() verb is available', () => {
      const org = Headlessly({ tenant: 'dverbs' }) as OrgWithEntities
      expect(typeof org.Campaign.launch).toBe('function')
    })

    it('Experiment.start() verb is available', () => {
      const org = Headlessly({ tenant: 'dverbs' }) as OrgWithEntities
      expect(typeof org.Experiment.start).toBe('function')
    })

    it('Workflow.activate() verb is available', () => {
      const org = Headlessly({ tenant: 'dverbs' }) as OrgWithEntities
      expect(typeof org.Workflow.activate).toBe('function')
    })

    it('Agent.deploy() verb is available', () => {
      const org = Headlessly({ tenant: 'dverbs' }) as OrgWithEntities
      expect(typeof org.Agent.deploy).toBe('function')
    })

    it('FeatureFlag.enable() and FeatureFlag.disable() verbs are available', () => {
      const org = Headlessly({ tenant: 'dverbs' }) as OrgWithEntities
      expect(typeof org.FeatureFlag.enable).toBe('function')
      expect(typeof org.FeatureFlag.disable).toBe('function')
    })
  })

  // ===========================================================================
  // 17. Search Across Entity Types (3 tests)
  // ===========================================================================
  describe('search across entity types', () => {
    it('search({ type: "Deal" }) returns only Deal entities', async () => {
      const org = Headlessly({ tenant: 'search' }) as OrgWithEntities
      await org.Contact.create({ name: 'NotADeal' })
      await org.Deal.create({ name: 'RealDeal', value: 5000 })
      const results = await org.search({ type: 'Deal' })
      expect(results.length).toBe(1)
      expect((results[0] as any).$type).toBe('Deal')
    })

    it('search with no filter returns all entities of that type', async () => {
      const org = Headlessly({ tenant: 'search' }) as OrgWithEntities
      await org.Contact.create({ name: 'A' })
      await org.Contact.create({ name: 'B' })
      await org.Contact.create({ name: 'C' })
      const results = await org.search({ type: 'Contact' })
      expect(results.length).toBe(3)
    })

    it('search with filter returns only matching entities', async () => {
      const org = Headlessly({ tenant: 'search' }) as OrgWithEntities
      await org.Deal.create({ name: 'Small', value: 100 })
      await org.Deal.create({ name: 'Big', value: 50000 })
      const results = await org.search({ type: 'Deal', filter: { name: 'Big' } })
      expect(results.length).toBe(1)
      expect((results[0] as any).name).toBe('Big')
    })
  })

  // ===========================================================================
  // 18. Combined $eq and $ne operators (2 tests)
  // ===========================================================================
  describe('$eq and $ne query operators', () => {
    it('$eq matches exact value', async () => {
      const org = Headlessly({ tenant: 'ops' }) as OrgWithEntities
      await org.Contact.create({ name: 'Alice', department: 'Sales' })
      await org.Contact.create({ name: 'Bob', department: 'Engineering' })
      const results = await org.Contact.find({ department: { $eq: 'Sales' } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('Alice')
    })

    it('$ne excludes matching value', async () => {
      const org = Headlessly({ tenant: 'ops' }) as OrgWithEntities
      await org.Contact.create({ name: 'Alice', department: 'Sales' })
      await org.Contact.create({ name: 'Bob', department: 'Engineering' })
      const results = await org.Contact.find({ department: { $ne: 'Sales' } })
      expect(results.length).toBe(1)
      expect(results[0].name).toBe('Bob')
    })
  })

  // ===========================================================================
  // 19. Relationship Metadata in Schema (2 tests)
  // ===========================================================================
  describe('relationship metadata in schema', () => {
    it('Contact.organization relationship has forward operator "->"', () => {
      const org = Headlessly({ tenant: 'rel' }) as OrgWithEntities
      const schema = org.Contact.$schema
      const orgRel = schema.relationships.get('organization')
      expect(orgRel).toBeDefined()
      expect(orgRel!.operator).toBe('->')
      expect(orgRel!.targetType).toBe('Organization')
    })

    it('Organization.contacts relationship has back-reference operator "<-"', () => {
      const org = Headlessly({ tenant: 'rel' }) as OrgWithEntities
      const schema = org.Organization.$schema
      const contactsRel = schema.relationships.get('contacts')
      expect(contactsRel).toBeDefined()
      expect(contactsRel!.operator).toBe('<-')
    })
  })

  // ===========================================================================
  // 20. Enum Field Schema Parsing (2 tests)
  // ===========================================================================
  describe('enum field schema parsing', () => {
    it('Contact.role has enum values parsed correctly', () => {
      const org = Headlessly({ tenant: 'enum' }) as OrgWithEntities
      const schema = org.Contact.$schema
      const roleField = schema.fields.get('role')
      expect(roleField).toBeDefined()
      expect(roleField!.kind).toBe('enum')
      expect(roleField!.enumValues).toBeDefined()
      expect(roleField!.enumValues).toContain('DecisionMaker')
      expect(roleField!.enumValues).toContain('Champion')
    })

    it('Deal.stage has enum values parsed correctly', () => {
      const org = Headlessly({ tenant: 'enum' }) as OrgWithEntities
      const schema = org.Deal.$schema
      const stageField = schema.fields.get('stage')
      expect(stageField).toBeDefined()
      expect(stageField!.kind).toBe('enum')
      expect(stageField!.enumValues).toContain('Prospecting')
      expect(stageField!.enumValues).toContain('Closed')
    })
  })
})
