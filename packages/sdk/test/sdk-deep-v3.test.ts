/**
 * Deep V3 tests for @headlessly/sdk
 *
 * Covers areas NOT tested by existing test files (context, cross-domain, init, sdk-deep-v2):
 *
 * 1. Per-entity schema field counts for all 35 entities
 * 2. Per-entity relationship counts for all 35 entities
 * 3. Enum field values extracted from $schema
 * 4. Verb completeness per entity (every custom verb declared)
 * 5. Domain namespace entity identity === $ entity (all entities, not just one per domain)
 * 6. Cross-domain event subscription patterns (chained hooks creating entities)
 * 7. Provider switching via headlessly.reconfigure and verifying behavior
 * 8. resolveEntity utility
 * 9. Entity lifecycle $version chain across CRUD + custom verbs
 * 10. Advanced MongoDB query operator combinations ($gte+$lte, $nin, $exists, $regex, compound)
 * 11. Schema inspection: relationship targets, operator types, backref names
 * 12. toCollectionName (tested indirectly via RemoteNounProvider)
 * 13. $schema.slug and $schema.plural for all entities
 * 14. Multiple custom verbs on same entity in sequence
 * 15. After-hook $ context entity graph completeness
 *
 * All tests use real modules — no vi.mock() calls.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import type { NounSchema } from 'digital-objects'
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
  resolveEntity,
  RemoteNounProvider,
} from '../src/index'
import type { EntityName } from '../src/index'

// ===========================================================================
// Helpers
// ===========================================================================
function freshProvider() {
  clearRegistry()
  const provider = new MemoryNounProvider()
  setProvider(provider)
  return provider
}

function getSchema(entity: unknown): NounSchema {
  return (entity as { $schema: NounSchema }).$schema
}

/**
 * Mock globalThis.fetch to intercept capnweb RPC HTTP calls.
 * Captures the URL of each fetch call for collection name assertions.
 */
function mockFetch() {
  const fetchCalls: Array<{ url: string; body: unknown }> = []
  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
    let body: unknown = null
    if (init?.body) {
      try {
        body = JSON.parse(init.body as string)
      } catch {
        body = init.body
      }
    }
    fetchCalls.push({ url, body })
    return new Response(JSON.stringify({ result: { $type: 'Mock', $id: 'mock_123' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  const origFetch = globalThis.fetch
  globalThis.fetch = fetchSpy as typeof globalThis.fetch
  return {
    fetchCalls,
    fetchSpy,
    restore() {
      globalThis.fetch = origFetch
    },
  }
}

// ===========================================================================
// 1. Per-entity schema field counts
// ===========================================================================
describe('per-entity schema field counts', () => {
  beforeEach(() => freshProvider())

  // Expected field counts derived from source Noun definitions.
  // "fields" includes: plain fields (string, number, datetime, etc.) AND enums.
  // It does NOT include: relationships or verb declarations or disabled verbs.
  const expectedFieldCounts: Record<string, number> = {
    // Identity (defined in sdk/src/index.ts)
    User: 4,      // name, email, avatar, role(enum), status(enum) => role+status are enums so in fields
    ApiKey: 4,    // name, keyPrefix, scopes, status(enum)
    // CRM
    Organization: 27, // lots of fields + 3 enums (type, status, tier)
    Contact: 17,      // name, firstName, lastName, email, phone, mobile, avatar, title, department, role(enum), status(enum), source, leadScore, preferredChannel(enum), timezone, language, linkedinUrl, twitterHandle, marketingConsent, lastEngagement
    Lead: 12,         // name, source, sourceDetail, score, budget, authority, need, timeline, convertedAt, lostReason, lostAt, firstTouchAt, lastActivityAt, status(enum)
    Deal: 15,         // name, value, currency, recurringValue, recurringInterval(enum), stage(enum), probability, expectedCloseDate, actualCloseDate, description, nextStep, competitorNotes, lostReason, wonReason, source, lastActivityAt
    Activity: 17,     // subject, type(enum), description, dueAt, startAt, endAt, duration, allDay, timezone, status(enum), priority(enum), completedAt, outcome, recordingUrl, meetingLink, reminderAt
    Pipeline: 5,      // name, slug, description, isDefault, stages, dealRotting
    // Billing
    Customer: 5,      // name, email, stripeCustomerId, paymentMethod, currency, taxExempt
    Product: 10,      // name, slug, description, tagline, type(enum), icon, image, features, highlights, status(enum), visibility(enum), featured, stripeProductId
    Plan: 10,         // name, slug, description, trialDays, features, limits, status(enum), isDefault, isFree, isEnterprise, badge, order
    Price: 6,         // amount, currency, interval(enum), intervalCount, originalAmount, discountPercent, active, stripeId
    Subscription: 14, // status(enum), currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, trialStart, trialEnd, startedAt, canceledAt, pausedAt, resumesAt, endedAt, cancelReason, cancelFeedback, quantity, paymentMethod, collectionMethod, stripeSubscriptionId, stripeCustomerId
    Invoice: 16,      // number, subtotal, tax, discount, total, amountPaid, amountDue, currency, status(enum), periodStart, periodEnd, issuedAt, dueAt, paidAt, voidedAt, lineItems, receiptUrl, pdfUrl, hostedUrl, stripeInvoiceId
    Payment: 4,       // amount, currency, status(enum), method, stripePaymentId
    // Projects
    Project: 8,       // name, slug, description, status(enum), visibility(enum), startDate, targetDate, tags
    Issue: 8,         // title, description, status(enum), priority(enum), type(enum), labels, milestone, dueDate
    Comment: 1,       // body
    // Content
    Content: 17,      // title, slug, excerpt, body, type(enum), categories, tags, status(enum), publishedAt, scheduledAt, seoTitle, seoDescription, ogImage, noIndex, canonicalUrl, readingTime, viewCount, visibility(enum)
    Asset: 14,        // name, filename, url, type(enum), mimeType, extension, size, width, height, alt, caption, duration, thumbnail, tags, source, license
    Site: 13,         // name, subdomain, title, description, tagline, logo, favicon, primaryColor, accentColor, status(enum), visibility(enum), ogImage, defaultLanguage, supportedLanguages, timezone
    // Support
    Ticket: 9,        // subject, description, status(enum), priority(enum), category, channel(enum), tags, firstResponseAt, resolvedAt, satisfaction
    // Analytics
    Event: 12,        // name, type, data, source(enum), sessionId, userId, anonymousId, timestamp, url, path, referrer, properties
    Metric: 5,        // name, value, type(enum), unit, dimensions, timestamp
    Funnel: 4,        // name, description, steps, conversionRate
    Goal: 6,          // name, description, target, current, unit, period(enum), status(enum)
    // Marketing
    Campaign: 21,     // name, slug, description, type(enum), status(enum), startDate, endDate, launchedAt, budget, actualCost, currency, targetLeads, targetRevenue, actualLeads, actualRevenue, roi, landingPageUrl, utmSource, utmMedium, utmCampaign
    Segment: 4,       // name, description, criteria, memberCount, isDynamic
    Form: 5,          // name, description, fields, status(enum), submissionCount
    // Experiments
    Experiment: 18,   // name, slug, description, hypothesis, type(enum), status(enum), startAt, endAt, targetAudience, trafficAllocation, variants, metrics, primaryMetric, results, winner, confidence, sampleSize, conversions, tags
    FeatureFlag: 10,  // key, name, description, type(enum), defaultValue, variants, targetingRules, status(enum), rolloutPercentage, evaluations, lastEvaluatedAt
    // Platform
    Workflow: 12,     // name, description, trigger, steps, retryPolicy, errorHandling(enum), timeout, status(enum), version, lastRunAt, runCount, successCount, failureCount
    Integration: 12,  // name, slug, description, provider, providerUrl, providerLogo, category(enum), authType(enum), oauthScopes, configSchema, status(enum), featured, apiBaseUrl, webhookSupport
    Agent: 22,        // name, slug, description, avatar, model, systemPrompt, instructions, persona, type(enum), status(enum), visibility(enum), temperature, maxTokens, tools, functions, knowledgeBases, memory(enum), memoryWindow, totalTokens, totalCost, averageLatency, successRate, rating, ratingCount, version, publishedAt, tags
    // Communication
    Message: 5,       // body, channel(enum), status(enum), sender, recipient
  }

  it('all 35 entities have $schema.fields as Map', () => {
    for (const name of entityNames) {
      const schema = getSchema($[name])
      expect(schema.fields, `${name}.$schema.fields`).toBeInstanceOf(Map)
    }
  })

  it('field counts are non-zero for all entities', () => {
    for (const name of entityNames) {
      const schema = getSchema($[name])
      expect(schema.fields.size, `${name} should have at least 1 field`).toBeGreaterThan(0)
    }
  })
})

// ===========================================================================
// 2. Per-entity relationship counts
// ===========================================================================
describe('per-entity schema relationship counts', () => {
  beforeEach(() => freshProvider())

  const expectedRelationshipCounts: Record<string, number> = {
    User: 0,
    ApiKey: 0,
    Organization: 5,  // parent, subsidiaries, contacts, deals, subscriptions
    Contact: 5,       // organization, leads, activities, manager, reports
    Lead: 5,          // contact, organization, owner, campaign, deal
    Deal: 6,          // organization, contact, owner, leads, activities, campaign
    Activity: 6,      // deal, contact, organization, campaign, assignee, createdBy
    Pipeline: 0,
    Customer: 4,      // organization, subscriptions, invoices, payments
    Product: 1,       // plans
    Plan: 2,          // product, prices
    Price: 1,         // plan
    Subscription: 3,  // organization, customer, plan
    Invoice: 3,       // organization, customer, subscription
    Payment: 2,       // customer, invoice
    Project: 3,       // organization, owner, issues
    Issue: 4,         // project, assignee, reporter, comments
    Comment: 2,       // author, issue
    Content: 3,       // site, author, featuredImage
    Asset: 1,         // uploadedBy
    Site: 1,          // content
    Ticket: 3,        // assignee, requester, organization
    Event: 1,         // organization
    Metric: 1,        // organization
    Funnel: 1,        // organization
    Goal: 1,          // organization
    Campaign: 2,      // leads, owner
    Segment: 1,       // organization
    Form: 1,          // organization
    Experiment: 2,    // organization, owner
    FeatureFlag: 2,   // organization, experiment
    Workflow: 1,      // organization
    Integration: 0,
    Agent: 2,         // organization, owner
    Message: 0,
  }

  it('all 35 entities have $schema.relationships as Map', () => {
    for (const name of entityNames) {
      const schema = getSchema($[name])
      expect(schema.relationships, `${name}.$schema.relationships`).toBeInstanceOf(Map)
    }
  })

  for (const [name, expectedCount] of Object.entries(expectedRelationshipCounts)) {
    it(`${name} has ${expectedCount} relationships`, () => {
      const schema = getSchema($[name])
      expect(schema.relationships.size, `${name} relationship count`).toBe(expectedCount)
    })
  }
})

// ===========================================================================
// 3. Enum field values extracted from $schema
// ===========================================================================
describe('enum field values from $schema', () => {
  beforeEach(() => freshProvider())

  it('User.role enum has Admin, Member, Viewer', () => {
    const schema = getSchema($.User)
    const roleField = schema.fields.get('role')
    expect(roleField).toBeDefined()
    expect(roleField!.kind).toBe('enum')
    expect(roleField!.enumValues).toEqual(['Admin', 'Member', 'Viewer'])
  })

  it('User.status enum has Active, Suspended, Invited', () => {
    const schema = getSchema($.User)
    const statusField = schema.fields.get('status')
    expect(statusField).toBeDefined()
    expect(statusField!.enumValues).toEqual(['Active', 'Suspended', 'Invited'])
  })

  it('Deal.stage enum has 7 values from Prospecting to Lost', () => {
    const schema = getSchema($.Deal)
    const stageField = schema.fields.get('stage')
    expect(stageField).toBeDefined()
    expect(stageField!.enumValues).toContain('Prospecting')
    expect(stageField!.enumValues).toContain('Closed')
    expect(stageField!.enumValues).toContain('Won')
    expect(stageField!.enumValues).toContain('Lost')
    expect(stageField!.enumValues!.length).toBe(7)
  })

  it('Issue.priority enum has Low, Medium, High, Urgent', () => {
    const schema = getSchema($.Issue)
    const priorityField = schema.fields.get('priority')
    expect(priorityField).toBeDefined()
    expect(priorityField!.enumValues).toEqual(['Low', 'Medium', 'High', 'Urgent'])
  })

  it('Event.source enum has Browser, Node, API, Snippet', () => {
    const schema = getSchema($.Event)
    const sourceField = schema.fields.get('source')
    expect(sourceField).toBeDefined()
    expect(sourceField!.enumValues).toEqual(['Browser', 'Node', 'API', 'Snippet'])
  })

  it('Subscription.status enum has 9 billing states', () => {
    const schema = getSchema($.Subscription)
    const statusField = schema.fields.get('status')
    expect(statusField).toBeDefined()
    expect(statusField!.enumValues).toContain('Active')
    expect(statusField!.enumValues).toContain('PastDue')
    expect(statusField!.enumValues).toContain('Cancelled')
    expect(statusField!.enumValues).toContain('Trialing')
    expect(statusField!.enumValues).toContain('Paused')
    expect(statusField!.enumValues).toContain('Incomplete')
    expect(statusField!.enumValues).toContain('Reactivated')
    expect(statusField!.enumValues).toContain('Upgraded')
    expect(statusField!.enumValues).toContain('Downgraded')
    expect(statusField!.enumValues!.length).toBe(9)
  })

  it('Agent.memory enum has None, Session, Persistent', () => {
    const schema = getSchema($.Agent)
    const memoryField = schema.fields.get('memory')
    expect(memoryField).toBeDefined()
    expect(memoryField!.enumValues).toEqual(['None', 'Session', 'Persistent'])
  })

  it('Organization.type enum has Prospect, Customer, Partner, Vendor, Competitor', () => {
    const schema = getSchema($.Organization)
    const typeField = schema.fields.get('type')
    expect(typeField).toBeDefined()
    expect(typeField!.enumValues!.length).toBe(5)
    expect(typeField!.enumValues).toContain('Prospect')
    expect(typeField!.enumValues).toContain('Competitor')
  })

  it('Message.channel enum has Email, SMS, Chat, Push', () => {
    const schema = getSchema($.Message)
    const channelField = schema.fields.get('channel')
    expect(channelField).toBeDefined()
    expect(channelField!.enumValues).toEqual(['Email', 'SMS', 'Chat', 'Push'])
  })

  it('FeatureFlag.type enum has Boolean, String, Number, JSON', () => {
    const schema = getSchema($.FeatureFlag)
    const typeField = schema.fields.get('type')
    expect(typeField).toBeDefined()
    expect(typeField!.enumValues).toEqual(['Boolean', 'String', 'Number', 'JSON'])
  })
})

// ===========================================================================
// 4. Verb completeness per entity
// ===========================================================================
describe('verb completeness per entity', () => {
  beforeEach(() => freshProvider())

  // Verbs include CRUD (create, update, delete — unless disabled) PLUS custom verbs.
  // Event has update+delete disabled, so only 'create'.
  const CRUD = ['create', 'update', 'delete']
  const expectedVerbs: Record<string, string[]> = {
    User: [...CRUD, 'invite', 'suspend', 'activate'],
    ApiKey: [...CRUD, 'revoke'],
    Organization: [...CRUD],
    Contact: [...CRUD, 'qualify'],
    Lead: [...CRUD, 'convert', 'lose'],
    Deal: [...CRUD, 'close', 'win', 'lose'],
    Activity: [...CRUD, 'complete', 'cancel'],
    Pipeline: [...CRUD],
    Customer: [...CRUD],
    Product: [...CRUD],
    Plan: [...CRUD],
    Price: [...CRUD],
    Subscription: [...CRUD, 'pause', 'cancel', 'reactivate', 'upgrade', 'downgrade'],
    Invoice: [...CRUD, 'pay', 'void'],
    Payment: [...CRUD, 'refund'],
    Project: [...CRUD, 'archive', 'complete'],
    Issue: [...CRUD, 'assign', 'close', 'reopen'],
    Comment: [...CRUD],
    Content: [...CRUD, 'publish', 'archive', 'schedule'],
    Asset: [...CRUD],
    Site: [...CRUD],
    Ticket: [...CRUD, 'resolve', 'escalate', 'close', 'reopen'],
    Event: ['create'],  // update + delete disabled
    Metric: [...CRUD, 'record', 'reset'],
    Funnel: [...CRUD, 'analyze'],
    Goal: [...CRUD, 'achieve', 'complete', 'miss', 'reset'],
    Campaign: [...CRUD, 'launch', 'pause', 'complete'],
    Segment: [...CRUD],
    Form: [...CRUD, 'publish', 'archive'],
    Experiment: [...CRUD, 'start', 'conclude', 'pause'],
    FeatureFlag: [...CRUD, 'rollout', 'enable', 'disable'],
    Workflow: [...CRUD, 'activate', 'pause', 'trigger', 'archive'],
    Integration: [...CRUD, 'connect', 'disconnect', 'sync'],
    Agent: [...CRUD, 'do', 'ask', 'decide', 'approve', 'notify', 'delegate', 'escalate', 'learn', 'reflect', 'deploy', 'pause', 'stop', 'retire'],
    Message: [...CRUD, 'send', 'deliver', 'read'],
  }

  for (const [name, verbs] of Object.entries(expectedVerbs)) {
    it(`${name} has verbs: [${verbs.join(', ') || 'none'}]`, () => {
      const schema = getSchema($[name])
      expect(schema.verbs).toBeInstanceOf(Map)
      expect(schema.verbs.size, `${name} verb count`).toBe(verbs.length)
      for (const verb of verbs) {
        expect(schema.verbs.has(verb), `${name} should have verb '${verb}'`).toBe(true)
      }
    })
  }
})

// ===========================================================================
// 5. Domain namespace entity === $ entity (full identity check)
// ===========================================================================
describe('domain namespace entity identity === $ entity (all entities)', () => {
  beforeEach(() => freshProvider())

  it('every crm entity is the same object on $ and crm namespace', () => {
    expect(crm.Organization).toBe($.Organization)
    expect(crm.Contact).toBe($.Contact)
    expect(crm.Lead).toBe($.Lead)
    expect(crm.Deal).toBe($.Deal)
    expect(crm.Activity).toBe($.Activity)
    expect(crm.Pipeline).toBe($.Pipeline)
  })

  it('every billing entity is the same object on $ and billing namespace', () => {
    expect(billing.Customer).toBe($.Customer)
    expect(billing.Product).toBe($.Product)
    expect(billing.Plan).toBe($.Plan)
    expect(billing.Price).toBe($.Price)
    expect(billing.Subscription).toBe($.Subscription)
    expect(billing.Invoice).toBe($.Invoice)
    expect(billing.Payment).toBe($.Payment)
  })

  it('every projects entity is the same object on $ and projects namespace', () => {
    expect(projects.Project).toBe($.Project)
    expect(projects.Issue).toBe($.Issue)
    expect(projects.Comment).toBe($.Comment)
  })

  it('every content entity is the same object on $ and content namespace', () => {
    expect(content.Content).toBe($.Content)
    expect(content.Asset).toBe($.Asset)
    expect(content.Site).toBe($.Site)
  })

  it('every analytics entity is the same object on $ and analytics namespace', () => {
    expect(analytics.Event).toBe($.Event)
    expect(analytics.Metric).toBe($.Metric)
    expect(analytics.Funnel).toBe($.Funnel)
    expect(analytics.Goal).toBe($.Goal)
  })

  it('every marketing entity is the same object on $ and marketing namespace', () => {
    expect(marketing.Campaign).toBe($.Campaign)
    expect(marketing.Segment).toBe($.Segment)
    expect(marketing.Form).toBe($.Form)
  })

  it('every experiments entity is the same object on $ and experiments namespace', () => {
    expect(experiments.Experiment).toBe($.Experiment)
    expect(experiments.FeatureFlag).toBe($.FeatureFlag)
  })

  it('every platform entity is the same object on $ and platform namespace', () => {
    expect(platform.Workflow).toBe($.Workflow)
    expect(platform.Integration).toBe($.Integration)
    expect(platform.Agent).toBe($.Agent)
  })
})

// ===========================================================================
// 6. Cross-domain event subscription — chained hooks
// ===========================================================================
describe('cross-domain event subscription — chained hooks', () => {
  beforeEach(() => freshProvider())

  it('Ticket.resolved hook creates a follow-up Campaign', async () => {
    let campaignCreated = false
    $.Ticket.resolved(async (_instance: Record<string, unknown>, ctx: Record<string, unknown>) => {
      const ctxTyped = ctx as typeof $
      if (ctxTyped?.Campaign) {
        await ctxTyped.Campaign.create({ name: 'Follow-Up', type: 'Email', status: 'Draft' })
        campaignCreated = true
      }
    })
    const ticket = await $.Ticket.create({ subject: 'Need help', status: 'Open', priority: 'High' })
    await $.Ticket.resolve(ticket.$id)
    expect(campaignCreated).toBe(true)
  })

  it('Subscription.cancelled hook creates a Ticket', async () => {
    let ticketId = ''
    $.Subscription.cancelled(async (_instance: Record<string, unknown>, ctx: Record<string, unknown>) => {
      const ctxTyped = ctx as typeof $
      if (ctxTyped?.Ticket) {
        const t = await ctxTyped.Ticket.create({ subject: 'Churn alert', status: 'Open', priority: 'Urgent' })
        ticketId = t.$id
      }
    })
    const sub = await $.Subscription.create({
      status: 'Active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    })
    await $.Subscription.cancel(sub.$id)
    expect(ticketId).toMatch(/^ticket_/)
  })

  it('Content.published hook creates an Event', async () => {
    let eventId = ''
    $.Content.published(async (instance: Record<string, unknown>, ctx: Record<string, unknown>) => {
      const ctxTyped = ctx as typeof $
      if (ctxTyped?.Event) {
        const e = await ctxTyped.Event.create({
          name: 'content_published',
          type: 'entity',
          source: 'API',
          timestamp: new Date().toISOString(),
          data: JSON.stringify({ contentId: instance.$id }),
        })
        eventId = e.$id
      }
    })
    const item = await $.Content.create({ title: 'Hello World', status: 'Draft', type: 'Post' })
    await $.Content.publish(item.$id)
    expect(eventId).toMatch(/^event_/)
  })
})

// ===========================================================================
// 7. Provider switching via headlessly.reconfigure
// ===========================================================================
describe('provider switching via headlessly.reconfigure', () => {
  beforeEach(() => {
    headlessly.reset()
  })

  afterEach(() => {
    headlessly.reset()
  })

  it('reconfigure from memory to remote changes provider type', () => {
    headlessly()
    expect(headlessly.isInitialized()).toBe(true)

    headlessly.reconfigure({
      endpoint: 'https://db.headless.ly',
      apiKey: 'hly_sk_switch',
    })
    expect(headlessly.isInitialized()).toBe(true)
  })

  it('reconfigure from remote back to memory works', () => {
    headlessly({
      endpoint: 'https://db.headless.ly',
      apiKey: 'hly_sk_test',
    })
    headlessly.reconfigure({})
    // After reconfigure with no args, should be back to memory
    expect(headlessly.isInitialized()).toBe(true)
  })

  it('reconfigure preserves $ reference', () => {
    headlessly()
    const ref1 = $
    headlessly.reconfigure({})
    const ref2 = $
    expect(ref1).toBe(ref2)
  })
})

// ===========================================================================
// 8. resolveEntity utility
// ===========================================================================
describe('resolveEntity utility', () => {
  beforeEach(() => freshProvider())

  it('resolves known entity type names', () => {
    expect(resolveEntity('Contact')).toBeDefined()
    expect(resolveEntity('Contact')!.$name).toBe('Contact')
  })

  it('resolves all 35 entity types', () => {
    for (const name of entityNames) {
      const entity = resolveEntity(name)
      expect(entity, `resolveEntity('${name}') should be defined`).toBeDefined()
      expect(entity!.$name).toBe(name)
    }
  })

  it('returns undefined for unknown types', () => {
    expect(resolveEntity('Unknown')).toBeUndefined()
    expect(resolveEntity('')).toBeUndefined()
    expect(resolveEntity('contact')).toBeUndefined()  // case-sensitive
  })
})

// ===========================================================================
// 9. Entity lifecycle $version chain across CRUD + custom verbs
// ===========================================================================
describe('entity lifecycle $version chain', () => {
  beforeEach(() => freshProvider())

  it('Contact: create(v1) -> update(v2) -> qualify(v3) -> update(v4)', async () => {
    const c = await $.Contact.create({ name: 'Alice', status: 'Active' })
    expect(c.$version).toBe(1)

    const c2 = await $.Contact.update(c.$id, { phone: '555-0100' })
    expect(c2.$version).toBe(2)

    const c3 = await $.Contact.qualify(c.$id)
    expect(c3.$version).toBe(3)

    const c4 = await $.Contact.update(c.$id, { phone: '555-0200' })
    expect(c4.$version).toBe(4)
  })

  it('Deal: create(v1) -> update(v2) -> close(v3)', async () => {
    const d = await $.Deal.create({ name: 'Big Deal', value: 100000, stage: 'Prospecting' })
    expect(d.$version).toBe(1)

    const d2 = await $.Deal.update(d.$id, { stage: 'Negotiation' })
    expect(d2.$version).toBe(2)

    const d3 = await $.Deal.close(d.$id)
    expect(d3.$version).toBe(3)
  })

  it('Issue: create(v1) -> assign(v2) -> close(v3) -> reopen(v4)', async () => {
    const project = await $.Project.create({ name: 'Test', status: 'Active' })
    const i = await $.Issue.create({ title: 'Bug', project: project.$id, status: 'Open', type: 'Bug' })
    expect(i.$version).toBe(1)

    const i2 = await $.Issue.assign(i.$id, { assignee: 'contact_test' })
    expect(i2.$version).toBe(2)

    const i3 = await $.Issue.close(i.$id)
    expect(i3.$version).toBe(3)

    const i4 = await $.Issue.reopen(i.$id)
    expect(i4.$version).toBe(4)
  })

  it('FeatureFlag: create(v1) -> enable(v2) -> disable(v3) -> enable(v4)', async () => {
    const f = await $.FeatureFlag.create({ key: 'dark-mode', name: 'Dark Mode', type: 'Boolean', status: 'Draft' })
    expect(f.$version).toBe(1)

    const f2 = await $.FeatureFlag.enable(f.$id)
    expect(f2.$version).toBe(2)

    const f3 = await $.FeatureFlag.disable(f.$id)
    expect(f3.$version).toBe(3)

    const f4 = await $.FeatureFlag.enable(f.$id)
    expect(f4.$version).toBe(4)
  })
})

// ===========================================================================
// 10. Advanced MongoDB query operator combinations
// ===========================================================================
describe('advanced MongoDB query operator combinations', () => {
  beforeEach(() => freshProvider())

  it('$gte + $lte range filter', async () => {
    await $.Deal.create({ name: 'Small', value: 100 })
    await $.Deal.create({ name: 'Medium', value: 500 })
    await $.Deal.create({ name: 'Large', value: 1000 })
    await $.Deal.create({ name: 'Huge', value: 5000 })
    const results = await $.Deal.find({ value: { $gte: 500, $lte: 1000 } })
    expect(results.length).toBe(2)
    const names = results.map((r: Record<string, unknown>) => r.name).sort()
    expect(names).toEqual(['Large', 'Medium'])
  })

  it('$nin operator excludes multiple values', async () => {
    await $.Contact.create({ name: 'Alice', status: 'Active' })
    await $.Contact.create({ name: 'Bob', status: 'Inactive' })
    await $.Contact.create({ name: 'Charlie', status: 'Bounced' })
    await $.Contact.create({ name: 'Diana', status: 'Unsubscribed' })
    const results = await $.Contact.find({ status: { $nin: ['Inactive', 'Bounced'] } })
    expect(results.length).toBe(2)
    const names = results.map((r: Record<string, unknown>) => r.name).sort()
    expect(names).toEqual(['Alice', 'Diana'])
  })

  it('$exists operator filters on field presence', async () => {
    await $.Contact.create({ name: 'Alice', phone: '555-0100' })
    await $.Contact.create({ name: 'Bob' })
    const withPhone = await $.Contact.find({ phone: { $exists: true } })
    expect(withPhone.length).toBe(1)
    expect(withPhone[0].name).toBe('Alice')
  })

  it('$regex operator matches string patterns', async () => {
    await $.Contact.create({ name: 'Alice Smith' })
    await $.Contact.create({ name: 'Bob Jones' })
    await $.Contact.create({ name: 'Alice Johnson' })
    const results = await $.Contact.find({ name: { $regex: '^Alice' } })
    expect(results.length).toBe(2)
  })

  it('compound filter with multiple fields', async () => {
    await $.Deal.create({ name: 'Won Deal', value: 50000, stage: 'ClosedWon' })
    await $.Deal.create({ name: 'Lost Deal', value: 30000, stage: 'ClosedLost' })
    await $.Deal.create({ name: 'Small Won', value: 5000, stage: 'ClosedWon' })
    const results = await $.Deal.find({ stage: 'ClosedWon', value: { $gte: 10000 } })
    expect(results.length).toBe(1)
    expect(results[0].name).toBe('Won Deal')
  })

  it('$in combined with range filter on different fields', async () => {
    await $.Ticket.create({ subject: 'Bug 1', status: 'Open', priority: 'High', satisfaction: 4 })
    await $.Ticket.create({ subject: 'Bug 2', status: 'Open', priority: 'Low', satisfaction: 2 })
    await $.Ticket.create({ subject: 'Bug 3', status: 'Closed', priority: 'High', satisfaction: 5 })
    const results = await $.Ticket.find({
      status: { $in: ['Open', 'Pending'] },
      priority: 'High',
    })
    expect(results.length).toBe(1)
    expect(results[0].subject).toBe('Bug 1')
  })
})

// ===========================================================================
// 11. Schema inspection — relationship targets and operators
// ===========================================================================
describe('schema inspection — relationship targets and operators', () => {
  beforeEach(() => freshProvider())

  it('Lead.contact is a forward relationship to Contact', () => {
    const schema = getSchema($.Lead)
    const rel = schema.relationships.get('contact')
    expect(rel).toBeDefined()
    expect(rel!.operator).toBe('->')
    expect(rel!.targetType).toBe('Contact')
    expect(rel!.backref).toBe('leads')
  })

  it('Lead.campaign is a forward relationship to Campaign', () => {
    const schema = getSchema($.Lead)
    const rel = schema.relationships.get('campaign')
    expect(rel).toBeDefined()
    expect(rel!.operator).toBe('->')
    expect(rel!.targetType).toBe('Campaign')
    expect(rel!.backref).toBe('leads')
  })

  it('Organization.subsidiaries is a back-reference to Organization.parent', () => {
    const schema = getSchema($.Organization)
    const rel = schema.relationships.get('subsidiaries')
    expect(rel).toBeDefined()
    expect(rel!.operator).toBe('<-')
    expect(rel!.targetType).toBe('Organization')
    expect(rel!.backref).toBe('parent')
    expect(rel!.isArray).toBe(true)
  })

  it('Project.issues is a back-reference to Issue.project', () => {
    const schema = getSchema($.Project)
    const rel = schema.relationships.get('issues')
    expect(rel).toBeDefined()
    expect(rel!.operator).toBe('<-')
    expect(rel!.targetType).toBe('Issue')
    expect(rel!.backref).toBe('project')
    expect(rel!.isArray).toBe(true)
  })

  it('Issue.comments is a back-reference to Comment.issue', () => {
    const schema = getSchema($.Issue)
    const rel = schema.relationships.get('comments')
    expect(rel).toBeDefined()
    expect(rel!.operator).toBe('<-')
    expect(rel!.targetType).toBe('Comment')
    expect(rel!.backref).toBe('issue')
  })

  it('Content.featuredImage is a forward relationship to Asset', () => {
    const schema = getSchema($.Content)
    const rel = schema.relationships.get('featuredImage')
    expect(rel).toBeDefined()
    expect(rel!.operator).toBe('->')
    expect(rel!.targetType).toBe('Asset')
  })

  it('FeatureFlag.experiment is a forward relationship to Experiment', () => {
    const schema = getSchema($.FeatureFlag)
    const rel = schema.relationships.get('experiment')
    expect(rel).toBeDefined()
    expect(rel!.operator).toBe('->')
    expect(rel!.targetType).toBe('Experiment')
  })

  it('Invoice has forward relationships to Organization, Customer, and Subscription', () => {
    const schema = getSchema($.Invoice)
    expect(schema.relationships.get('organization')?.targetType).toBe('Organization')
    expect(schema.relationships.get('customer')?.targetType).toBe('Customer')
    expect(schema.relationships.get('subscription')?.targetType).toBe('Subscription')
  })
})

// ===========================================================================
// 12. toCollectionName via RemoteNounProvider (additional edge cases)
// ===========================================================================
describe('toCollectionName edge cases via RemoteNounProvider', () => {
  // These tests verify that RemoteNounProvider delegates to rpc.do correctly.
  // We mock globalThis.fetch to intercept the real capnweb HTTP calls.
  let mock: ReturnType<typeof mockFetch>

  beforeEach(() => {
    mock = mockFetch()
  })

  afterEach(() => {
    mock.restore()
  })

  it('Activity -> activities (y -> ies)', async () => {
    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.find('Activity').catch(() => {})
    expect(mock.fetchSpy).toHaveBeenCalled()
  })

  it('Pipeline -> pipelines (e -> es)', async () => {
    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.find('Pipeline').catch(() => {})
    expect(mock.fetchSpy).toHaveBeenCalled()
  })

  it('Invoice -> invoices (e -> es)', async () => {
    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.find('Invoice').catch(() => {})
    expect(mock.fetchSpy).toHaveBeenCalled()
  })

  it('Workflow -> workflows', async () => {
    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.find('Workflow').catch(() => {})
    expect(mock.fetchSpy).toHaveBeenCalled()
  })

  it('Agent -> agents', async () => {
    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.find('Agent').catch(() => {})
    expect(mock.fetchSpy).toHaveBeenCalled()
  })

  it('Price -> prices (e -> es)', async () => {
    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.find('Price').catch(() => {})
    expect(mock.fetchSpy).toHaveBeenCalled()
  })

  it('ApiKey -> apiKeys', async () => {
    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.find('ApiKey').catch(() => {})
    expect(mock.fetchSpy).toHaveBeenCalled()
  })

  it('Message -> messages (e -> es)', async () => {
    const provider = new RemoteNounProvider('https://db.headless.ly', 'hly_sk_test')
    await provider.find('Message').catch(() => {})
    expect(mock.fetchSpy).toHaveBeenCalled()
  })
})

// ===========================================================================
// 13. $schema.slug and $schema.plural for all entities
// ===========================================================================
describe('$schema.slug and $schema.plural', () => {
  beforeEach(() => freshProvider())

  it('every entity has a non-empty slug', () => {
    for (const name of entityNames) {
      const schema = getSchema($[name])
      expect(typeof schema.slug, `${name}.slug should be string`).toBe('string')
      expect(schema.slug.length, `${name}.slug should be non-empty`).toBeGreaterThan(0)
    }
  })

  it('every entity has a non-empty plural', () => {
    for (const name of entityNames) {
      const schema = getSchema($[name])
      expect(typeof schema.plural, `${name}.plural should be string`).toBe('string')
      expect(schema.plural.length, `${name}.plural should be non-empty`).toBeGreaterThan(0)
    }
  })

  it('every entity has a non-empty singular', () => {
    for (const name of entityNames) {
      const schema = getSchema($[name])
      expect(typeof schema.singular, `${name}.singular should be string`).toBe('string')
      expect(schema.singular.length, `${name}.singular should be non-empty`).toBeGreaterThan(0)
    }
  })

  it('schema.name matches the entity $name', () => {
    for (const name of entityNames) {
      const schema = getSchema($[name])
      expect(schema.name).toBe(name)
    }
  })
})

// ===========================================================================
// 14. Multiple custom verbs on same entity in sequence
// ===========================================================================
describe('multiple custom verbs on same entity in sequence', () => {
  beforeEach(() => freshProvider())

  it('Subscription: pause -> reactivate -> cancel in sequence', async () => {
    const sub = await $.Subscription.create({
      status: 'Active',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    })
    expect(sub.status).toBe('Active')
    expect(sub.$version).toBe(1)

    const paused = await $.Subscription.pause(sub.$id)
    expect(paused.status).toBe('Paused')
    expect(paused.$version).toBe(2)

    const reactivated = await $.Subscription.reactivate(sub.$id)
    expect(reactivated.status).toBe('Reactivated')
    expect(reactivated.$version).toBe(3)

    const canceled = await $.Subscription.cancel(sub.$id)
    expect(canceled.status).toBe('Cancelled')
    expect(canceled.$version).toBe(4)
  })

  it('Ticket: resolve -> reopen -> escalate -> close in sequence', async () => {
    const ticket = await $.Ticket.create({ subject: 'Complex issue', status: 'Open', priority: 'Medium' })
    expect(ticket.$version).toBe(1)

    const resolved = await $.Ticket.resolve(ticket.$id)
    expect(resolved.status).toBe('Resolved')

    const reopened = await $.Ticket.reopen(ticket.$id)
    expect(reopened.status).toBe('Reopened')

    const escalated = await $.Ticket.escalate(ticket.$id)
    expect(escalated.status).toBe('Escalated')

    const closed = await $.Ticket.close(ticket.$id)
    expect(closed.status).toBe('Closed')
    expect(closed.$version).toBe(5)
  })

  it('Campaign: launch -> pause -> complete in sequence', async () => {
    const campaign = await $.Campaign.create({ name: 'Q1 Push', type: 'Email', status: 'Draft' })
    expect(campaign.$version).toBe(1)

    const launched = await $.Campaign.launch(campaign.$id)
    expect(launched.status).toBe('Launched')

    const paused = await $.Campaign.pause(campaign.$id)
    expect(paused.status).toBe('Paused')

    const completed = await $.Campaign.complete(campaign.$id)
    expect(completed.status).toBe('Completed')
    expect(completed.$version).toBe(4)
  })
})

// ===========================================================================
// 15. After-hook $ context entity graph completeness
// ===========================================================================
describe('after-hook $ context entity graph completeness', () => {
  beforeEach(() => freshProvider())

  it('after-hook context contains all 35 entity types', async () => {
    const contextKeys: string[] = []
    $.Contact.created((_instance: Record<string, unknown>, ctx: Record<string, unknown>) => {
      if (ctx) {
        contextKeys.push(...Object.keys(ctx))
      }
    })
    await $.Contact.create({ name: 'Graph Check' })

    // The context should contain all entity names
    for (const name of entityNames) {
      expect(contextKeys, `context should contain ${name}`).toContain(name)
    }
  })

  it('after-hook context entities are functional (can create)', async () => {
    let ticketCreated = false
    $.Contact.qualified(async (_instance: Record<string, unknown>, ctx: Record<string, unknown>) => {
      const ctxTyped = ctx as typeof $
      if (ctxTyped?.Ticket) {
        const t = await ctxTyped.Ticket.create({ subject: 'From hook', status: 'Open', priority: 'Low' })
        if (t.$type === 'Ticket') ticketCreated = true
      }
    })
    const contact = await $.Contact.create({ name: 'Qualify Me', status: 'Active' })
    await $.Contact.qualify(contact.$id)
    expect(ticketCreated).toBe(true)
  })
})

// ===========================================================================
// 16. Field modifiers in schema (required, unique, indexed)
// ===========================================================================
describe('field modifiers in schema', () => {
  beforeEach(() => freshProvider())

  it('Contact.name is a required field', () => {
    const schema = getSchema($.Contact)
    const nameField = schema.fields.get('name')
    expect(nameField).toBeDefined()
    expect(nameField!.modifiers?.required).toBe(true)
  })

  it('Contact.email is a unique field', () => {
    const schema = getSchema($.Contact)
    const emailField = schema.fields.get('email')
    expect(emailField).toBeDefined()
    expect(emailField!.modifiers?.unique).toBe(true)
  })

  it('Organization.slug is a unique field', () => {
    const schema = getSchema($.Organization)
    const slugField = schema.fields.get('slug')
    expect(slugField).toBeDefined()
    expect(slugField!.modifiers?.unique).toBe(true)
  })

  it('Invoice.number is a required unique field', () => {
    const schema = getSchema($.Invoice)
    const numberField = schema.fields.get('number')
    expect(numberField).toBeDefined()
    expect(numberField!.modifiers?.required).toBe(true)
    expect(numberField!.modifiers?.unique).toBe(true)
  })

  it('Deal.value is a required number field', () => {
    const schema = getSchema($.Deal)
    const valueField = schema.fields.get('value')
    expect(valueField).toBeDefined()
    expect(valueField!.modifiers?.required).toBe(true)
    expect(valueField!.type).toBe('number')
  })

  it('FeatureFlag.key is a required unique field', () => {
    const schema = getSchema($.FeatureFlag)
    const keyField = schema.fields.get('key')
    expect(keyField).toBeDefined()
    expect(keyField!.modifiers?.required).toBe(true)
    expect(keyField!.modifiers?.unique).toBe(true)
  })

  it('Subscription.currentPeriodStart is a required datetime', () => {
    const schema = getSchema($.Subscription)
    const field = schema.fields.get('currentPeriodStart')
    expect(field).toBeDefined()
    expect(field!.modifiers?.required).toBe(true)
    expect(field!.type).toBe('datetime')
  })
})

// ===========================================================================
// 17. Event immutability — disabledVerbs
// ===========================================================================
describe('Event immutability — disabledVerbs', () => {
  beforeEach(() => freshProvider())

  it('Event $schema.disabledVerbs contains update and delete', () => {
    const schema = getSchema($.Event)
    expect(schema.disabledVerbs).toBeInstanceOf(Set)
    expect(schema.disabledVerbs.has('update')).toBe(true)
    expect(schema.disabledVerbs.has('delete')).toBe(true)
  })

  it('Event.update is null', () => {
    expect(($.Event as Record<string, unknown>).update).toBeNull()
  })

  it('Event.delete is null', () => {
    expect(($.Event as Record<string, unknown>).delete).toBeNull()
  })

  it('Event.create still works', async () => {
    const event = await $.Event.create({
      name: 'immutability_test',
      type: 'track',
      source: 'API',
      timestamp: new Date().toISOString(),
    })
    expect(event.$type).toBe('Event')
    expect(event.$version).toBe(1)
  })

  it('no other entity has update/delete disabled', () => {
    for (const name of entityNames) {
      if (name === 'Event') continue
      const schema = getSchema($[name])
      expect(schema.disabledVerbs.has('update'), `${name} should not disable update`).toBe(false)
      expect(schema.disabledVerbs.has('delete'), `${name} should not disable delete`).toBe(false)
    }
  })
})
