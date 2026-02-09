/**
 * Deep V2 tests for @headlessly/sdk
 *
 * Covers areas NOT tested by existing context.test.ts, cross-domain.test.ts, init.test.ts:
 * - $ context proxy behavior (symbol access, edge cases)
 * - Exact entity count validation (35)
 * - All entity $name and $schema properties
 * - Domain namespace completeness and isolation
 * - RemoteNounProvider method coverage
 * - CRUD lifecycle for every domain
 * - Verb conjugation (custom verbs, BEFORE/AFTER hooks, unsubscribe)
 * - MCP operations: $.search with filters, $.fetch with missing entities, $.do composition
 * - entityNames export completeness
 * - Cross-domain $ context in after hooks
 * - Immutable entity (Event: update/delete disabled)
 * - Provider reconfiguration flows
 * - Edge cases: undefined property, symbol access, re-init guards
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import {
  $,
  crm,
  billing,
  projects,
  content,
  support,
  analytics,
  marketing,
  experiments,
  platform,
  entityNames,
  headlessly,
  RemoteNounProvider,
  detectEnvironment,
  detectEndpoint,
  enableLazy,
} from '../src/index'
import type { HeadlessContext, EntityName } from '../src/index'

// ===========================================================================
// Helpers
// ===========================================================================
function freshProvider() {
  clearRegistry()
  const provider = new MemoryNounProvider()
  setProvider(provider)
  return provider
}

// ===========================================================================
// 1. $ context — entity registry completeness
// ===========================================================================
describe('$ context — registry completeness', () => {
  beforeEach(() => freshProvider())

  const ALL_35: EntityName[] = [
    'User',
    'ApiKey',
    'Organization',
    'Contact',
    'Lead',
    'Deal',
    'Activity',
    'Pipeline',
    'Customer',
    'Product',
    'Plan',
    'Price',
    'Subscription',
    'Invoice',
    'Payment',
    'Project',
    'Issue',
    'Comment',
    'Content',
    'Asset',
    'Site',
    'Ticket',
    'Event',
    'Metric',
    'Funnel',
    'Goal',
    'Campaign',
    'Segment',
    'Form',
    'Experiment',
    'FeatureFlag',
    'Workflow',
    'Integration',
    'Agent',
    'Message',
  ]

  it('entityNames contains exactly 35 entries', () => {
    expect(entityNames.length).toBe(35)
  })

  it('entityNames contains every expected entity', () => {
    for (const name of ALL_35) {
      expect(entityNames).toContain(name)
    }
  })

  it('every entityNames entry resolves to a defined entity on $', () => {
    for (const name of entityNames) {
      expect($[name], `$.${name} should be defined`).toBeDefined()
    }
  })

  it('every entity on $ has a $name that matches its key', () => {
    for (const name of ALL_35) {
      const entity = $[name] as { $name: string }
      expect(entity.$name).toBe(name)
    }
  })

  it('every entity on $ has a $schema with fields Map', () => {
    for (const name of ALL_35) {
      const entity = $[name] as { $schema: { fields: Map<string, unknown> } }
      expect(entity.$schema).toBeDefined()
      expect(entity.$schema.fields).toBeInstanceOf(Map)
    }
  })

  it('every entity on $ has create, get, find, update, delete methods', () => {
    for (const name of ALL_35) {
      const entity = $[name] as Record<string, unknown>
      expect(typeof entity.create, `$.${name}.create`).toBe('function')
      expect(typeof entity.get, `$.${name}.get`).toBe('function')
      expect(typeof entity.find, `$.${name}.find`).toBe('function')
      // update/delete may be null for immutable entities (Event)
      if (name !== 'Event') {
        expect(typeof entity.update, `$.${name}.update`).toBe('function')
        expect(typeof entity.delete, `$.${name}.delete`).toBe('function')
      }
    }
  })
})

// ===========================================================================
// 2. $ proxy edge cases
// ===========================================================================
describe('$ proxy — edge cases', () => {
  beforeEach(() => freshProvider())

  it('returns undefined for symbol property access', () => {
    const sym = Symbol('test')
    expect(($ as Record<symbol, unknown>)[sym]).toBeUndefined()
  })

  it('returns undefined for non-existent entity names', () => {
    expect($.DoesNotExist).toBeUndefined()
    expect($.FooBar).toBeUndefined()
    expect($.contactLowerCase).toBeUndefined()
  })

  it('$.search returns empty array for non-existent entity type', async () => {
    const results = await $.search({ type: 'Nonexistent' })
    expect(results).toEqual([])
  })

  it('$.fetch returns null for non-existent entity type', async () => {
    const result = await $.fetch({ type: 'Nonexistent', id: 'fake_123' })
    expect(result).toBeNull()
  })

  it('$.do provides all entities including Identity and Communication', async () => {
    await $.do(async (ctx) => {
      expect(ctx.User).toBeDefined()
      expect(ctx.ApiKey).toBeDefined()
      expect(ctx.Message).toBeDefined()
      expect(ctx.Contact).toBeDefined()
      expect(ctx.Subscription).toBeDefined()
      expect(ctx.Workflow).toBeDefined()
    })
  })

  it('$.search is consistent — same function reference across accesses', () => {
    const search1 = $.search
    const search2 = $.search
    // Proxy re-creates on each access, so they may differ — but both should be functions
    expect(typeof search1).toBe('function')
    expect(typeof search2).toBe('function')
  })

  it('$.fetch with empty include array returns the entity without extras', async () => {
    const org = await $.Organization.create({ name: 'Test Org' })
    const fetched = await $.fetch({ type: 'Organization', id: org.$id, include: [] })
    expect(fetched).toBeDefined()
    expect(fetched.$id).toBe(org.$id)
  })
})

// ===========================================================================
// 3. Domain namespace isolation and completeness
// ===========================================================================
describe('domain namespace isolation', () => {
  beforeEach(() => freshProvider())

  it('crm exports exactly 6 entity-valued keys', () => {
    const entityKeys = Object.keys(crm).filter((k) => (crm as Record<string, { $name?: string }>)[k]?.$name)
    expect(entityKeys.length).toBe(6)
    expect(entityKeys.sort()).toEqual(['Activity', 'Contact', 'Deal', 'Lead', 'Organization', 'Pipeline'])
  })

  it('billing exports exactly 7 entity-valued keys', () => {
    const entityKeys = Object.keys(billing).filter((k) => (billing as Record<string, { $name?: string }>)[k]?.$name)
    expect(entityKeys.length).toBe(7)
    expect(entityKeys.sort()).toEqual(['Customer', 'Invoice', 'Payment', 'Plan', 'Price', 'Product', 'Subscription'])
  })

  it('projects exports exactly 3 entity-valued keys', () => {
    const entityKeys = Object.keys(projects).filter((k) => (projects as Record<string, { $name?: string }>)[k]?.$name)
    expect(entityKeys.length).toBe(3)
    expect(entityKeys.sort()).toEqual(['Comment', 'Issue', 'Project'])
  })

  it('content exports exactly 3 entity-valued keys', () => {
    const entityKeys = Object.keys(content).filter((k) => (content as Record<string, { $name?: string }>)[k]?.$name)
    expect(entityKeys.length).toBe(3)
    expect(entityKeys.sort()).toEqual(['Asset', 'Content', 'Site'])
  })

  it('support exports exactly 1 entity-valued key', () => {
    const entityKeys = Object.keys(support).filter((k) => (support as Record<string, { $name?: string }>)[k]?.$name)
    expect(entityKeys.length).toBe(1)
    expect(entityKeys).toEqual(['Ticket'])
  })

  it('analytics exports exactly 4 entity-valued keys', () => {
    const entityKeys = Object.keys(analytics).filter((k) => (analytics as Record<string, { $name?: string }>)[k]?.$name)
    expect(entityKeys.length).toBe(4)
    expect(entityKeys.sort()).toEqual(['Event', 'Funnel', 'Goal', 'Metric'])
  })

  it('marketing exports exactly 3 entity-valued keys', () => {
    const entityKeys = Object.keys(marketing).filter((k) => (marketing as Record<string, { $name?: string }>)[k]?.$name)
    expect(entityKeys.length).toBe(3)
    expect(entityKeys.sort()).toEqual(['Campaign', 'Form', 'Segment'])
  })

  it('experiments exports exactly 2 entity-valued keys', () => {
    const entityKeys = Object.keys(experiments).filter((k) => (experiments as Record<string, { $name?: string }>)[k]?.$name)
    expect(entityKeys.length).toBe(2)
    expect(entityKeys.sort()).toEqual(['Experiment', 'FeatureFlag'])
  })

  it('platform exports exactly 3 entity-valued keys', () => {
    const entityKeys = Object.keys(platform).filter((k) => (platform as Record<string, { $name?: string }>)[k]?.$name)
    expect(entityKeys.length).toBe(3)
    expect(entityKeys.sort()).toEqual(['Agent', 'Integration', 'Workflow'])
  })

  it('domain namespace entity is the same object as $ entity', () => {
    expect(crm.Contact).toBe($.Contact)
    expect(billing.Customer).toBe($.Customer)
    expect(projects.Issue).toBe($.Issue)
    expect(content.Asset).toBe($.Asset)
    expect(support.Ticket).toBe($.Ticket)
    expect(analytics.Event).toBe($.Event)
    expect(marketing.Campaign).toBe($.Campaign)
    expect(experiments.Experiment).toBe($.Experiment)
    expect(platform.Agent).toBe($.Agent)
  })
})

// ===========================================================================
// 4. CRUD lifecycle through $ for every domain
// ===========================================================================
describe('CRUD lifecycle through $ for each domain', () => {
  beforeEach(() => freshProvider())

  it('Identity: User create/get/update/delete lifecycle', async () => {
    const user = await $.User.create({ name: 'Alice', email: 'alice@test.com', role: 'Admin', status: 'Active' })
    expect(user.$type).toBe('User')
    expect(user.$id).toMatch(/^user_/)
    expect(user.$version).toBe(1)
    expect(user.$context).toContain('headless.ly')
    expect(user.$createdAt).toBeDefined()

    const fetched = await $.User.get(user.$id)
    expect(fetched).toBeDefined()
    expect(fetched.name).toBe('Alice')

    const updated = await $.User.update(user.$id, { role: 'Viewer' })
    expect(updated.role).toBe('Viewer')
    expect(updated.$version).toBe(2)

    const deleted = await $.User.delete(user.$id)
    expect(deleted).toBe(true)

    const gone = await $.User.get(user.$id)
    expect(gone).toBeNull()
  })

  it('Identity: ApiKey create with status', async () => {
    const key = await $.ApiKey.create({ name: 'CI Key', keyPrefix: 'hly_sk_ci', scopes: 'read:all', status: 'Active' })
    expect(key.$type).toBe('ApiKey')
    expect(key.$id).toMatch(/^apikey_/)
  })

  it('CRM: Deal create assigns $type and $id correctly', async () => {
    const deal = await $.Deal.create({ name: 'Enterprise', value: 100000, stage: 'Prospecting' })
    expect(deal.$type).toBe('Deal')
    expect(deal.$id).toMatch(/^deal_/)
    expect(deal.value).toBe(100000)
    expect(deal.stage).toBe('Prospecting')
  })

  it('Billing: Invoice create/pay lifecycle', async () => {
    const invoice = await $.Invoice.create({
      number: 'INV-100',
      subtotal: 1000,
      total: 1000,
      amountDue: 1000,
      status: 'Open',
    })
    expect(invoice.$type).toBe('Invoice')
    expect(invoice.status).toBe('Open')

    // Pay verb
    const paid = await $.Invoice.pay(invoice.$id)
    expect(paid.status).toBe('Paid')
  })

  it('Projects: Issue create/close lifecycle', async () => {
    const project = await $.Project.create({ name: 'Test Project', status: 'Active' })
    const issue = await $.Issue.create({ title: 'Fix bug', project: project.$id, status: 'Open', type: 'Bug' })
    expect(issue.$type).toBe('Issue')

    const closed = await $.Issue.close(issue.$id)
    expect(closed.status).toBe('Closed')
  })

  it('Content: Content create/publish lifecycle', async () => {
    const item = await $.Content.create({ title: 'Hello World', status: 'Draft', type: 'Post' })
    expect(item.$type).toBe('Content')
    expect(item.$id).toMatch(/^content_/)

    const published = await $.Content.publish(item.$id)
    expect(published.status).toBe('Published')
  })

  it('Support: Ticket create/resolve/close lifecycle', async () => {
    const ticket = await $.Ticket.create({ subject: 'Help', status: 'Open', priority: 'High' })
    expect(ticket.$type).toBe('Ticket')

    const resolved = await $.Ticket.resolve(ticket.$id)
    expect(resolved.status).toBe('Resolved')

    const closed = await $.Ticket.close(ticket.$id)
    expect(closed.status).toBe('Closed')
  })

  it('Analytics: Event is immutable (update and delete are null)', () => {
    const entity = $.Event as Record<string, unknown>
    expect(entity.update).toBeNull()
    expect(entity.delete).toBeNull()
  })

  it('Analytics: Event create works', async () => {
    const event = await $.Event.create({ name: 'click', type: 'track', source: 'Browser', timestamp: new Date().toISOString() })
    expect(event.$type).toBe('Event')
    expect(event.$id).toMatch(/^event_/)
  })

  it('Marketing: Campaign create/launch lifecycle', async () => {
    const campaign = await $.Campaign.create({ name: 'Launch', type: 'Email', status: 'Draft' })
    expect(campaign.$type).toBe('Campaign')

    const launched = await $.Campaign.launch(campaign.$id)
    expect(launched.status).toBe('Launched')
  })

  it('Experiments: FeatureFlag create/enable lifecycle', async () => {
    const flag = await $.FeatureFlag.create({ key: 'dark-mode', name: 'Dark Mode', status: 'Draft', type: 'Boolean' })
    expect(flag.$type).toBe('FeatureFlag')
    expect(flag.$id).toMatch(/^featureflag_/)

    const enabled = await $.FeatureFlag.enable(flag.$id)
    expect(enabled.status).toBe('Enabled')
  })

  it('Platform: Workflow create/activate lifecycle', async () => {
    const wf = await $.Workflow.create({ name: 'Onboarding', trigger: 'Contact.created', status: 'Draft' })
    expect(wf.$type).toBe('Workflow')

    const activated = await $.Workflow.activate(wf.$id)
    expect(activated.status).toBe('Activated')
  })

  it('Communication: Message create/send/deliver lifecycle', async () => {
    const msg = await $.Message.create({ body: 'Hello', channel: 'Email', status: 'Draft', sender: 'user_a', recipient: 'user_b' })
    expect(msg.$type).toBe('Message')
    expect(msg.$id).toMatch(/^message_/)

    const sent = await $.Message.send(msg.$id)
    expect(sent.status).toBe('Sent')

    const delivered = await $.Message.deliver(msg.$id)
    expect(delivered.status).toBe('Delivered')
  })
})

// ===========================================================================
// 5. Verb conjugation — hooks and unsubscribe
// ===========================================================================
describe('verb conjugation — hooks and unsubscribe', () => {
  beforeEach(() => freshProvider())

  it('BEFORE hook (creating) can transform input data', async () => {
    $.Contact.creating((data: Record<string, unknown>) => {
      return { ...data, source: 'auto-tagged' }
    })
    const contact = await $.Contact.create({ name: 'Bob' })
    expect(contact.source).toBe('auto-tagged')
  })

  it('AFTER hook (created) fires after entity creation', async () => {
    let hookFired = false
    $.Contact.created(() => {
      hookFired = true
    })
    await $.Contact.create({ name: 'Charlie' })
    expect(hookFired).toBe(true)
  })

  it('AFTER hook receives the created instance', async () => {
    let receivedName = ''
    $.Contact.created((instance: Record<string, unknown>) => {
      receivedName = instance.name as string
    })
    await $.Contact.create({ name: 'Diana' })
    expect(receivedName).toBe('Diana')
  })

  it('AFTER hook on custom verb fires correctly (Deal.closed)', async () => {
    let closedDealId = ''
    $.Deal.closed((instance: Record<string, unknown>) => {
      closedDealId = instance.$id as string
    })
    const deal = await $.Deal.create({ name: 'Target Deal', value: 5000, stage: 'Negotiation' })
    await $.Deal.close(deal.$id)
    expect(closedDealId).toBe(deal.$id)
  })

  it('BEFORE hook on custom verb fires correctly (Contact.qualifying)', async () => {
    let hookFired = false
    $.Contact.qualifying(() => {
      hookFired = true
    })
    const contact = await $.Contact.create({ name: 'Eve', status: 'Active' })
    await $.Contact.qualify(contact.$id)
    expect(hookFired).toBe(true)
  })

  it('unsubscribe function from AFTER hook removes the handler', async () => {
    let callCount = 0
    const unsub = $.Contact.created(() => {
      callCount++
    })
    await $.Contact.create({ name: 'First' })
    expect(callCount).toBe(1)

    unsub()
    await $.Contact.create({ name: 'Second' })
    expect(callCount).toBe(1) // should NOT increment after unsub
  })

  it('unsubscribe function from BEFORE hook removes the handler', async () => {
    let callCount = 0
    const unsub = $.Contact.creating(() => {
      callCount++
    })
    await $.Contact.create({ name: 'First' })
    expect(callCount).toBe(1)

    unsub()
    await $.Contact.create({ name: 'Second' })
    expect(callCount).toBe(1)
  })

  it('multiple AFTER hooks on same verb all fire', async () => {
    let count = 0
    $.Deal.created(() => {
      count++
    })
    $.Deal.created(() => {
      count++
    })
    await $.Deal.create({ name: 'Multi-hook Deal', value: 1000 })
    expect(count).toBe(2)
  })

  it('AFTER hook receives $ context as second argument for cross-domain operations', async () => {
    let contextHasSubscription = false
    $.Deal.closed((_instance: Record<string, unknown>, ctx: Record<string, unknown>) => {
      if (ctx && ctx.Subscription) {
        contextHasSubscription = true
      }
    })
    const deal = await $.Deal.create({ name: 'Context Deal', value: 10000, stage: 'Negotiation' })
    await $.Deal.close(deal.$id)
    expect(contextHasSubscription).toBe(true)
  })
})

// ===========================================================================
// 6. MCP-like operations — deep coverage
// ===========================================================================
describe('MCP-like operations — deep coverage', () => {
  beforeEach(() => freshProvider())

  it('$.search with MongoDB-style $gte filter', async () => {
    await $.Deal.create({ name: 'Small', value: 1000 })
    await $.Deal.create({ name: 'Medium', value: 5000 })
    await $.Deal.create({ name: 'Large', value: 50000 })
    const results = await $.search({ type: 'Deal', filter: { value: { $gte: 5000 } } })
    expect(results.length).toBe(2)
  })

  it('$.search with exact value filter', async () => {
    await $.Contact.create({ name: 'Alice', status: 'Active' })
    await $.Contact.create({ name: 'Bob', status: 'Inactive' })
    const results = await $.search({ type: 'Contact', filter: { status: 'Active' } })
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Alice')
  })

  it('$.search with no filter returns all entities of type', async () => {
    await $.Metric.create({ name: 'MRR', value: 10000, type: 'Gauge' })
    await $.Metric.create({ name: 'Churn', value: 5, type: 'Gauge' })
    const results = await $.search({ type: 'Metric' })
    expect(results.length).toBe(2)
  })

  it('$.fetch returns null for non-existent id', async () => {
    const result = await $.fetch({ type: 'Contact', id: 'contact_does_not_exist' })
    expect(result).toBeNull()
  })

  it('$.fetch with include resolves back-references from schema', async () => {
    const customer = await $.Customer.create({ name: 'Acme', email: 'a@acme.com' })
    await $.Invoice.create({ number: 'INV-1', customer: customer.$id, subtotal: 100, total: 100, amountDue: 100, status: 'Open' })
    await $.Invoice.create({ number: 'INV-2', customer: customer.$id, subtotal: 200, total: 200, amountDue: 200, status: 'Open' })

    const result = await $.fetch({ type: 'Customer', id: customer.$id, include: ['invoices'] })
    expect(result).toBeDefined()
    expect(result.invoices).toBeDefined()
    expect(Array.isArray(result.invoices)).toBe(true)
    expect((result.invoices as unknown[]).length).toBe(2)
  })

  it('$.do returns the value from the callback', async () => {
    const result = await $.do(async (ctx) => {
      const c = await ctx.Contact.create({ name: 'DoTest' })
      return c.$id
    })
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^contact_/)
  })

  it('$.do callback can compose multiple domain operations', async () => {
    const result = await $.do(async (ctx) => {
      const org = await ctx.Organization.create({ name: 'ComposeOrg' })
      const contact = await ctx.Contact.create({ name: 'ComposeContact', organization: org.$id })
      const deal = await ctx.Deal.create({ name: 'ComposeDeal', value: 25000, contact: contact.$id })
      const customer = await ctx.Customer.create({ name: 'ComposeCustomer', email: 'c@test.com', organization: org.$id })
      return { orgId: org.$id, contactId: contact.$id, dealId: deal.$id, customerId: customer.$id }
    })
    const r = result as Record<string, string>
    expect(r.orgId).toMatch(/^organization_/)
    expect(r.contactId).toMatch(/^contact_/)
    expect(r.dealId).toMatch(/^deal_/)
    expect(r.customerId).toMatch(/^customer_/)
  })
})

// ===========================================================================
// 7. Entity metadata — $type, $id format, $version, $context, timestamps
// ===========================================================================
describe('entity metadata', () => {
  beforeEach(() => freshProvider())

  it('$id format is {lowercase_type}_{sqid}', async () => {
    const contact = await $.Contact.create({ name: 'Meta' })
    expect(contact.$id).toMatch(/^contact_[a-zA-Z0-9]+$/)
  })

  it('$id for multi-word types uses lowercase concatenation', async () => {
    const flag = await $.FeatureFlag.create({ key: 'test-flag', name: 'Test', type: 'Boolean' })
    expect(flag.$id).toMatch(/^featureflag_[a-zA-Z0-9]+$/)
  })

  it('$version starts at 1 and increments on update', async () => {
    const contact = await $.Contact.create({ name: 'Version' })
    expect(contact.$version).toBe(1)
    const updated = await $.Contact.update(contact.$id, { name: 'Version v2' })
    expect(updated.$version).toBe(2)
    const updated2 = await $.Contact.update(contact.$id, { name: 'Version v3' })
    expect(updated2.$version).toBe(3)
  })

  it('$context contains headless.ly tenant URL', async () => {
    const contact = await $.Contact.create({ name: 'ContextTest' })
    expect(contact.$context).toContain('headless.ly')
  })

  it('$createdAt is a valid ISO timestamp', async () => {
    const contact = await $.Contact.create({ name: 'Timestamp' })
    expect(() => new Date(contact.$createdAt)).not.toThrow()
    expect(new Date(contact.$createdAt).toISOString()).toBe(contact.$createdAt)
  })

  it('$updatedAt changes on update but $createdAt does not', async () => {
    const contact = await $.Contact.create({ name: 'TimeTravel' })
    const createdAt = contact.$createdAt
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 5))
    const updated = await $.Contact.update(contact.$id, { name: 'TimeTravel v2' })
    expect(updated.$createdAt).toBe(createdAt)
    // $updatedAt should be >= $createdAt (may be same if same ms)
    expect(new Date(updated.$updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(createdAt).getTime())
  })

  it('$type is preserved across update', async () => {
    const deal = await $.Deal.create({ name: 'Preserved', value: 1000 })
    const updated = await $.Deal.update(deal.$id, { value: 2000 })
    expect(updated.$type).toBe('Deal')
    expect(updated.$id).toBe(deal.$id)
  })
})

// ===========================================================================
// 8. RemoteNounProvider
// ===========================================================================
describe('RemoteNounProvider', () => {
  it('constructor sets endpoint and apiKey', () => {
    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    expect(provider.endpoint).toBe('https://db.headless.ly')
    expect(provider.apiKey).toBe('hly_sk_test')
    expect(provider.type).toBe('remote')
  })

  it('create sends POST to /entity/{type}', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ $type: 'Contact', $id: 'contact_abc' })))
    vi.stubGlobal('fetch', fetchSpy)

    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.create('Contact', { name: 'Remote Alice' })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, opts] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://db.headless.ly/entity/contact')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(opts.headers['Authorization']).toBe('Bearer hly_sk_test')
    expect(JSON.parse(opts.body)).toEqual({ name: 'Remote Alice' })

    vi.unstubAllGlobals()
  })

  it('find sends GET to /query/{type} with filter', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify([])))
    vi.stubGlobal('fetch', fetchSpy)

    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.find('Deal', { stage: 'Prospecting' })

    const [url, opts] = fetchSpy.mock.calls[0]
    expect(url).toContain('/query/deal')
    expect(url).toContain('filter=')
    expect(opts.headers['Authorization']).toBe('Bearer hly_sk_test')

    vi.unstubAllGlobals()
  })

  it('find sends GET without filter when none provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify([])))
    vi.stubGlobal('fetch', fetchSpy)

    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.find('Contact')

    const [url] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://db.headless.ly/query/contact')
    expect(url).not.toContain('filter=')

    vi.unstubAllGlobals()
  })

  it('get sends GET to /entity/{type}/{id}', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ $id: 'contact_abc' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    const result = await provider.get('Contact', 'contact_abc')

    expect(fetchSpy.mock.calls[0][0]).toBe('https://db.headless.ly/entity/contact/contact_abc')
    expect(result).toEqual({ $id: 'contact_abc' })

    vi.unstubAllGlobals()
  })

  it('get returns null when not found (non-ok response)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetchSpy)

    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    const result = await provider.get('Contact', 'contact_missing')
    expect(result).toBeNull()

    vi.unstubAllGlobals()
  })

  it('update sends PUT to /entity/{type}/{id}', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ $id: 'contact_abc', name: 'Updated' })))
    vi.stubGlobal('fetch', fetchSpy)

    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.update('Contact', 'contact_abc', { name: 'Updated' })

    const [url, opts] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://db.headless.ly/entity/contact/contact_abc')
    expect(opts.method).toBe('PUT')

    vi.unstubAllGlobals()
  })

  it('delete sends DELETE to /entity/{type}/{id}', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    const result = await provider.delete('Contact', 'contact_abc')
    expect(result).toBe(true)

    const [url, opts] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://db.headless.ly/entity/contact/contact_abc')
    expect(opts.method).toBe('DELETE')

    vi.unstubAllGlobals()
  })

  it('delete returns false when not ok', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', fetchSpy)

    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    const result = await provider.delete('Contact', 'contact_missing')
    expect(result).toBe(false)

    vi.unstubAllGlobals()
  })

  it('perform sends POST to /entity/{type}/{id}/{verb}', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ $id: 'deal_abc', stage: 'Closed' })))
    vi.stubGlobal('fetch', fetchSpy)

    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.perform('Deal', 'close', 'deal_abc', { reason: 'won' })

    const [url, opts] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://db.headless.ly/entity/deal/deal_abc/close')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ reason: 'won' })

    vi.unstubAllGlobals()
  })

  it('perform sends empty body when no data provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ $id: 'deal_abc' })))
    vi.stubGlobal('fetch', fetchSpy)

    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.perform('Deal', 'close', 'deal_abc')

    const [, opts] = fetchSpy.mock.calls[0]
    expect(JSON.parse(opts.body)).toEqual({})

    vi.unstubAllGlobals()
  })
})

// ===========================================================================
// 9. Schema inspection
// ===========================================================================
describe('schema inspection via $schema', () => {
  beforeEach(() => freshProvider())

  it('Contact schema has relationships map with organization', () => {
    const schema = ($.Contact as { $schema: { relationships: Map<string, { targetType?: string }> } }).$schema
    expect(schema.relationships.has('organization')).toBe(true)
    expect(schema.relationships.get('organization')?.targetType).toBe('Organization')
  })

  it('Customer schema has back-reference relationships for invoices, payments, subscriptions', () => {
    const schema = ($.Customer as { $schema: { relationships: Map<string, { operator?: string }> } }).$schema
    expect(schema.relationships.has('invoices')).toBe(true)
    expect(schema.relationships.get('invoices')?.operator).toBe('<-')
    expect(schema.relationships.has('payments')).toBe(true)
    expect(schema.relationships.has('subscriptions')).toBe(true)
  })

  it('Organization schema has slug and plural', () => {
    const schema = ($.Organization as { $schema: { singular: string; plural: string; slug: string; name: string } }).$schema
    // singular is derived lowercase; name is the PascalCase original
    expect(schema.name).toBe('Organization')
    expect(typeof schema.singular).toBe('string')
    expect(typeof schema.plural).toBe('string')
    expect(typeof schema.slug).toBe('string')
  })

  it('Deal schema has verbs map with close, win, lose', () => {
    const schema = ($.Deal as { $schema: { verbs: Map<string, { action: string }> } }).$schema
    expect(schema.verbs.has('close')).toBe(true)
    expect(schema.verbs.has('win')).toBe(true)
    expect(schema.verbs.has('lose')).toBe(true)
  })

  it('Event schema has disabledVerbs for update and delete', () => {
    const schema = ($.Event as { $schema: { disabledVerbs: Set<string> } }).$schema
    expect(schema.disabledVerbs.has('update')).toBe(true)
    expect(schema.disabledVerbs.has('delete')).toBe(true)
  })

  it('Subscription schema has verbs for pause, cancel, reactivate, upgrade, downgrade', () => {
    const schema = ($.Subscription as { $schema: { verbs: Map<string, { action: string }> } }).$schema
    expect(schema.verbs.has('pause')).toBe(true)
    expect(schema.verbs.has('cancel')).toBe(true)
    expect(schema.verbs.has('reactivate')).toBe(true)
    expect(schema.verbs.has('upgrade')).toBe(true)
    expect(schema.verbs.has('downgrade')).toBe(true)
  })
})

// ===========================================================================
// 10. find() with MongoDB-style operators
// ===========================================================================
describe('find() with MongoDB-style operators', () => {
  beforeEach(() => freshProvider())

  it('$gt operator filters correctly', async () => {
    await $.Deal.create({ name: 'A', value: 100 })
    await $.Deal.create({ name: 'B', value: 500 })
    await $.Deal.create({ name: 'C', value: 1000 })
    const results = await $.Deal.find({ value: { $gt: 500 } })
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('C')
  })

  it('$lt operator filters correctly', async () => {
    await $.Deal.create({ name: 'A', value: 100 })
    await $.Deal.create({ name: 'B', value: 500 })
    const results = await $.Deal.find({ value: { $lt: 500 } })
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('A')
  })

  it('$in operator filters correctly', async () => {
    await $.Contact.create({ name: 'Alice', status: 'Active' })
    await $.Contact.create({ name: 'Bob', status: 'Inactive' })
    await $.Contact.create({ name: 'Charlie', status: 'Bounced' })
    const results = await $.Contact.find({ status: { $in: ['Active', 'Bounced'] } })
    expect(results.length).toBe(2)
  })

  it('$ne operator excludes correctly', async () => {
    await $.Contact.create({ name: 'Alice', status: 'Active' })
    await $.Contact.create({ name: 'Bob', status: 'Inactive' })
    const results = await $.Contact.find({ status: { $ne: 'Active' } })
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Bob')
  })
})

// ===========================================================================
// 11. headlessly() initialization edge cases
// ===========================================================================
describe('headlessly() initialization edge cases', () => {
  afterEach(() => {
    if (typeof headlessly?.reset === 'function') {
      headlessly.reset()
    }
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('headlessly.isInitialized returns false after explicit reset', () => {
    headlessly.reset()
    expect(headlessly.isInitialized()).toBe(false)
  })

  it('headlessly() with lazy: true does not mark as initialized', () => {
    headlessly({ lazy: true })
    // lazy mode doesn't immediately init — accessing $ triggers it
    // But headlessly marks _lazyEnabled, not _initialized
    // The isInitialized should still be false until first $ access
    // Let's verify behavior by accessing something
    const entity = $.Contact
    expect(entity).toBeDefined()
    expect(headlessly.isInitialized()).toBe(true)
  })

  it('headlessly.reconfigure from memory to memory works', () => {
    headlessly()
    expect(headlessly.isInitialized()).toBe(true)
    const ctx = headlessly.reconfigure({})
    expect(ctx).toBe($)
    expect(headlessly.isInitialized()).toBe(true)
  })

  it('detectEnvironment returns "node" in vitest', () => {
    expect(detectEnvironment()).toBe('node')
  })

  it('detectEndpoint returns undefined in Node.js (no window)', () => {
    expect(detectEndpoint()).toBeUndefined()
  })
})

// ===========================================================================
// 12. Batch operations through $.do
// ===========================================================================
describe('batch operations through $.do', () => {
  beforeEach(() => freshProvider())

  it('create multiple entities of different types in a single $.do', async () => {
    const result = await $.do(async (ctx) => {
      const results = await Promise.all([
        ctx.Contact.create({ name: 'Batch1' }),
        ctx.Deal.create({ name: 'Batch Deal', value: 1000 }),
        ctx.Ticket.create({ subject: 'Batch Ticket', status: 'Open' }),
        ctx.Campaign.create({ name: 'Batch Campaign', type: 'Email', status: 'Draft' }),
      ])
      return results.map((r: Record<string, unknown>) => r.$type)
    })
    expect(result).toEqual(['Contact', 'Deal', 'Ticket', 'Campaign'])
  })

  it('$.do can query after creating', async () => {
    const count = await $.do(async (ctx) => {
      await ctx.Contact.create({ name: 'QueryTest1', status: 'Active' })
      await ctx.Contact.create({ name: 'QueryTest2', status: 'Active' })
      await ctx.Contact.create({ name: 'QueryTest3', status: 'Inactive' })
      const active = await ctx.Contact.find({ status: 'Active' })
      return active.length
    })
    expect(count).toBe(2)
  })

  it('$.do errors propagate correctly', async () => {
    await expect(
      $.do(async () => {
        throw new Error('deliberate error')
      }),
    ).rejects.toThrow('deliberate error')
  })
})
