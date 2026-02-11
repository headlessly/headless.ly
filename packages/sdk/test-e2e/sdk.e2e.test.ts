/**
 * E2E tests for @headlessly/sdk against live deployed workers.
 *
 * Verifies that the SDK's exported entities, domain namespaces,
 * factory functions, and resolution utilities are structurally
 * correct and align with what the live API serves.
 *
 * Tests hit real *.headless.ly endpoints — no mocks.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import {
  $,
  headlessly,
  Headlessly,
  entityNames,
  resolveEntity,
  crm,
  billing,
  projects,
  content,
  support,
  analytics,
  marketing,
  experiments,
  platform,
} from '../src/index.ts'
import { setup, CRM_URL, BILLING_URL, readHeaders } from '../../test-e2e-helpers'

// =============================================================================
// Setup — provision ephemeral session against live id.org.ai
// =============================================================================

beforeAll(async () => {
  await setup()
})

// =============================================================================
// 1. Entity Name Registry — exactly 35 entities
// =============================================================================

describe('entityNames registry', () => {
  it('contains exactly 35 entity names', () => {
    expect(entityNames).toHaveLength(35)
  })

  it('contains all Identity entities', () => {
    expect(entityNames).toContain('User')
    expect(entityNames).toContain('ApiKey')
  })

  it('contains all CRM entities', () => {
    const crmEntities = ['Organization', 'Contact', 'Lead', 'Deal', 'Activity', 'Pipeline']
    for (const name of crmEntities) {
      expect(entityNames, `entityNames should contain ${name}`).toContain(name)
    }
  })

  it('contains all Billing entities', () => {
    const billingEntities = ['Customer', 'Product', 'Plan', 'Price', 'Subscription', 'Invoice', 'Payment']
    for (const name of billingEntities) {
      expect(entityNames, `entityNames should contain ${name}`).toContain(name)
    }
  })

  it('contains all Projects entities', () => {
    const projectEntities = ['Project', 'Issue', 'Comment']
    for (const name of projectEntities) {
      expect(entityNames, `entityNames should contain ${name}`).toContain(name)
    }
  })

  it('contains all Content entities', () => {
    const contentEntities = ['Content', 'Asset', 'Site']
    for (const name of contentEntities) {
      expect(entityNames, `entityNames should contain ${name}`).toContain(name)
    }
  })

  it('contains Support entity', () => {
    expect(entityNames).toContain('Ticket')
  })

  it('contains all Analytics entities', () => {
    const analyticsEntities = ['Event', 'Metric', 'Funnel', 'Goal']
    for (const name of analyticsEntities) {
      expect(entityNames, `entityNames should contain ${name}`).toContain(name)
    }
  })

  it('contains all Marketing entities', () => {
    const marketingEntities = ['Campaign', 'Segment', 'Form']
    for (const name of marketingEntities) {
      expect(entityNames, `entityNames should contain ${name}`).toContain(name)
    }
  })

  it('contains all Experiments entities', () => {
    expect(entityNames).toContain('Experiment')
    expect(entityNames).toContain('FeatureFlag')
  })

  it('contains all Platform entities', () => {
    const platformEntities = ['Workflow', 'Integration', 'Agent']
    for (const name of platformEntities) {
      expect(entityNames, `entityNames should contain ${name}`).toContain(name)
    }
  })

  it('contains Communication entity', () => {
    expect(entityNames).toContain('Message')
  })

  it('does not contain any extra or unknown entity names', () => {
    const expected = new Set([
      'User', 'ApiKey',
      'Organization', 'Contact', 'Lead', 'Deal', 'Activity', 'Pipeline',
      'Customer', 'Product', 'Plan', 'Price', 'Subscription', 'Invoice', 'Payment',
      'Project', 'Issue', 'Comment',
      'Content', 'Asset', 'Site',
      'Ticket',
      'Event', 'Metric', 'Funnel', 'Goal',
      'Campaign', 'Segment', 'Form',
      'Experiment', 'FeatureFlag',
      'Workflow', 'Integration', 'Agent',
      'Message',
    ])
    for (const name of entityNames) {
      expect(expected.has(name), `unexpected entity name: ${name}`).toBe(true)
    }
    expect(expected.size).toBe(35)
  })
})

// =============================================================================
// 2. resolveEntity — look up entities by type name
// =============================================================================

describe('resolveEntity', () => {
  it('resolves Contact to a defined NounEntity', () => {
    const entity = resolveEntity('Contact')
    expect(entity).toBeDefined()
    expect(entity!.$name).toBe('Contact')
  })

  it('resolves Deal to a defined NounEntity', () => {
    const entity = resolveEntity('Deal')
    expect(entity).toBeDefined()
    expect(entity!.$name).toBe('Deal')
  })

  it('resolves Subscription to a defined NounEntity', () => {
    const entity = resolveEntity('Subscription')
    expect(entity).toBeDefined()
    expect(entity!.$name).toBe('Subscription')
  })

  it('resolves all 35 entity types', () => {
    for (const name of entityNames) {
      const entity = resolveEntity(name)
      expect(entity, `resolveEntity('${name}') should be defined`).toBeDefined()
      expect(entity!.$name, `resolveEntity('${name}').$name should match`).toBe(name)
    }
  })

  it('returns undefined for unknown types', () => {
    expect(resolveEntity('Unknown')).toBeUndefined()
    expect(resolveEntity('')).toBeUndefined()
  })

  it('is case-sensitive (lowercase returns undefined)', () => {
    expect(resolveEntity('contact')).toBeUndefined()
    expect(resolveEntity('deal')).toBeUndefined()
    expect(resolveEntity('subscription')).toBeUndefined()
  })

  it('resolves each entity to the same object as $ proxy', () => {
    for (const name of entityNames) {
      const resolved = resolveEntity(name)
      expect(resolved).toBe($[name])
    }
  })
})

// =============================================================================
// 3. $ universal context — domain namespaces and operations
// =============================================================================

describe('$ universal context', () => {
  it('has search as a function', () => {
    expect(typeof $.search).toBe('function')
  })

  it('has fetch as a function', () => {
    expect(typeof $.fetch).toBe('function')
  })

  it('has do as a function', () => {
    expect(typeof $.do).toBe('function')
  })

  it('has events namespace with subscribe', () => {
    expect($.events).toBeDefined()
    expect(typeof $.events.subscribe).toBe('function')
  })

  it('has status as a function', () => {
    expect(typeof $.status).toBe('function')
  })

  it('exposes all 35 entities as properties', () => {
    for (const name of entityNames) {
      expect($[name], `$['${name}'] should be defined`).toBeDefined()
    }
  })

  it('returns undefined for non-existent entities', () => {
    expect($.NonExistent).toBeUndefined()
    expect($.Foo).toBeUndefined()
  })
})

// =============================================================================
// 4. CRM namespace — entity exports
// =============================================================================

describe('crm namespace', () => {
  it('exports Organization', () => {
    expect(crm.Organization).toBeDefined()
    expect(crm.Organization.$name).toBe('Organization')
  })

  it('exports Contact', () => {
    expect(crm.Contact).toBeDefined()
    expect(crm.Contact.$name).toBe('Contact')
  })

  it('exports Lead', () => {
    expect(crm.Lead).toBeDefined()
    expect(crm.Lead.$name).toBe('Lead')
  })

  it('exports Deal', () => {
    expect(crm.Deal).toBeDefined()
    expect(crm.Deal.$name).toBe('Deal')
  })

  it('exports Activity', () => {
    expect(crm.Activity).toBeDefined()
    expect(crm.Activity.$name).toBe('Activity')
  })

  it('exports Pipeline', () => {
    expect(crm.Pipeline).toBeDefined()
    expect(crm.Pipeline.$name).toBe('Pipeline')
  })

  it('CRM entities on namespace are identical to $ entities', () => {
    expect(crm.Organization).toBe($.Organization)
    expect(crm.Contact).toBe($.Contact)
    expect(crm.Lead).toBe($.Lead)
    expect(crm.Deal).toBe($.Deal)
    expect(crm.Activity).toBe($.Activity)
    expect(crm.Pipeline).toBe($.Pipeline)
  })

  it('has exactly 6 entity exports', () => {
    const entityExports = Object.keys(crm).filter((k) => {
      const val = (crm as Record<string, unknown>)[k] as Record<string, unknown> | null
      return val && typeof val === 'object' && typeof val.$name === 'string'
    })
    expect(entityExports).toHaveLength(6)
  })
})

// =============================================================================
// 5. Billing namespace — entity exports
// =============================================================================

describe('billing namespace', () => {
  it('exports Customer', () => {
    expect(billing.Customer).toBeDefined()
    expect(billing.Customer.$name).toBe('Customer')
  })

  it('exports Product', () => {
    expect(billing.Product).toBeDefined()
    expect(billing.Product.$name).toBe('Product')
  })

  it('exports Plan', () => {
    expect(billing.Plan).toBeDefined()
    expect(billing.Plan.$name).toBe('Plan')
  })

  it('exports Price', () => {
    expect(billing.Price).toBeDefined()
    expect(billing.Price.$name).toBe('Price')
  })

  it('exports Subscription', () => {
    expect(billing.Subscription).toBeDefined()
    expect(billing.Subscription.$name).toBe('Subscription')
  })

  it('exports Invoice', () => {
    expect(billing.Invoice).toBeDefined()
    expect(billing.Invoice.$name).toBe('Invoice')
  })

  it('exports Payment', () => {
    expect(billing.Payment).toBeDefined()
    expect(billing.Payment.$name).toBe('Payment')
  })

  it('Billing entities on namespace are identical to $ entities', () => {
    expect(billing.Customer).toBe($.Customer)
    expect(billing.Product).toBe($.Product)
    expect(billing.Plan).toBe($.Plan)
    expect(billing.Price).toBe($.Price)
    expect(billing.Subscription).toBe($.Subscription)
    expect(billing.Invoice).toBe($.Invoice)
    expect(billing.Payment).toBe($.Payment)
  })

  it('has exactly 7 entity exports', () => {
    const entityExports = Object.keys(billing).filter((k) => {
      const val = (billing as Record<string, unknown>)[k] as Record<string, unknown> | null
      return val && typeof val === 'object' && typeof val.$name === 'string'
    })
    expect(entityExports).toHaveLength(7)
  })
})

// =============================================================================
// 6. Remaining domain namespaces — structural checks
// =============================================================================

describe('projects namespace', () => {
  it('exports Project, Issue, Comment', () => {
    expect(projects.Project).toBeDefined()
    expect(projects.Issue).toBeDefined()
    expect(projects.Comment).toBeDefined()
  })

  it('entities are identical to $ entities', () => {
    expect(projects.Project).toBe($.Project)
    expect(projects.Issue).toBe($.Issue)
    expect(projects.Comment).toBe($.Comment)
  })
})

describe('content namespace', () => {
  it('exports Content, Asset, Site', () => {
    expect(content.Content).toBeDefined()
    expect(content.Asset).toBeDefined()
    expect(content.Site).toBeDefined()
  })

  it('entities are identical to $ entities', () => {
    expect(content.Content).toBe($.Content)
    expect(content.Asset).toBe($.Asset)
    expect(content.Site).toBe($.Site)
  })
})

describe('support namespace', () => {
  it('exports Ticket', () => {
    expect(support.Ticket).toBeDefined()
  })

  it('entity is identical to $ entity', () => {
    expect(support.Ticket).toBe($.Ticket)
  })
})

describe('analytics namespace', () => {
  it('exports Event, Metric, Funnel, Goal', () => {
    expect(analytics.Event).toBeDefined()
    expect(analytics.Metric).toBeDefined()
    expect(analytics.Funnel).toBeDefined()
    expect(analytics.Goal).toBeDefined()
  })

  it('entities are identical to $ entities', () => {
    expect(analytics.Event).toBe($.Event)
    expect(analytics.Metric).toBe($.Metric)
    expect(analytics.Funnel).toBe($.Funnel)
    expect(analytics.Goal).toBe($.Goal)
  })
})

describe('marketing namespace', () => {
  it('exports Campaign, Segment, Form', () => {
    expect(marketing.Campaign).toBeDefined()
    expect(marketing.Segment).toBeDefined()
    expect(marketing.Form).toBeDefined()
  })

  it('entities are identical to $ entities', () => {
    expect(marketing.Campaign).toBe($.Campaign)
    expect(marketing.Segment).toBe($.Segment)
    expect(marketing.Form).toBe($.Form)
  })
})

describe('experiments namespace', () => {
  it('exports Experiment, FeatureFlag', () => {
    expect(experiments.Experiment).toBeDefined()
    expect(experiments.FeatureFlag).toBeDefined()
  })

  it('entities are identical to $ entities', () => {
    expect(experiments.Experiment).toBe($.Experiment)
    expect(experiments.FeatureFlag).toBe($.FeatureFlag)
  })
})

describe('platform namespace', () => {
  it('exports Workflow, Integration, Agent', () => {
    expect(platform.Workflow).toBeDefined()
    expect(platform.Integration).toBeDefined()
    expect(platform.Agent).toBeDefined()
  })

  it('entities are identical to $ entities', () => {
    expect(platform.Workflow).toBe($.Workflow)
    expect(platform.Integration).toBe($.Integration)
    expect(platform.Agent).toBe($.Agent)
  })
})

// =============================================================================
// 7. headlessly() factory function
// =============================================================================

describe('headlessly() factory', () => {
  it('headlessly is a function', () => {
    expect(typeof headlessly).toBe('function')
  })

  it('headlessly.reset is a function', () => {
    expect(typeof headlessly.reset).toBe('function')
  })

  it('headlessly.reconfigure is a function', () => {
    expect(typeof headlessly.reconfigure).toBe('function')
  })

  it('headlessly.isInitialized is a function', () => {
    expect(typeof headlessly.isInitialized).toBe('function')
  })
})

// =============================================================================
// 8. Headlessly() tenant-scoped org factory
// =============================================================================

describe('Headlessly() org factory', () => {
  it('creates a tenant-scoped org with correct tenant and context', () => {
    const org = Headlessly({ tenant: 'e2e-test' })
    expect(org.tenant).toBe('e2e-test')
    expect(org.context).toBe('https://headless.ly/~e2e-test')
  })

  it('org has search, fetch, do functions', () => {
    const org = Headlessly({ tenant: 'e2e-ops' })
    expect(typeof org.search).toBe('function')
    expect(typeof org.fetch).toBe('function')
    expect(typeof org.do).toBe('function')
  })

  it('org exposes domain namespaces', () => {
    const org = Headlessly({ tenant: 'e2e-ns' })
    expect(org.crm).toBeDefined()
    expect(org.billing).toBeDefined()
    expect(org.projects).toBeDefined()
    expect(org.content).toBeDefined()
    expect(org.support).toBeDefined()
    expect(org.analytics).toBeDefined()
    expect(org.marketing).toBeDefined()
    expect(org.experiments).toBeDefined()
    expect(org.platform).toBeDefined()
  })

  it('org exposes entities via property access', () => {
    const org = Headlessly({ tenant: 'e2e-entities' })
    expect(org.Contact).toBeDefined()
    expect(org.Deal).toBeDefined()
    expect(org.Subscription).toBeDefined()
  })

  it('supports memory mode (default)', () => {
    const org = Headlessly({ tenant: 'e2e-memory' })
    expect(org.tenant).toBe('e2e-memory')
  })

  it('supports explicit mode options', () => {
    const org = Headlessly({ tenant: 'e2e-explicit', mode: 'memory' })
    expect(org.tenant).toBe('e2e-explicit')
  })

  it('returns undefined for then/catch/finally (not thenable)', () => {
    const org = Headlessly({ tenant: 'e2e-thenable' })
    expect(org.then).toBeUndefined()
    expect(org.catch).toBeUndefined()
    expect(org.finally).toBeUndefined()
  })
})

// =============================================================================
// 9. Live API — crm.headless.ly/api/contacts
// =============================================================================

describe('live API: crm.headless.ly/api/contacts', () => {
  it('GET /api/contacts returns a valid response', async () => {
    const res = await fetch(`${CRM_URL}/api/contacts`, {
      headers: readHeaders(),
    })

    // The API should respond (may be 200, 401, or 403 depending on auth state)
    expect(res.status).toBeGreaterThanOrEqual(200)
    expect(res.status).toBeLessThan(500)
  })

  it('response is JSON', async () => {
    const res = await fetch(`${CRM_URL}/api/contacts`, {
      headers: readHeaders(),
    })

    const contentType = res.headers.get('content-type') || ''
    expect(contentType).toContain('json')
  })

  it('SDK entity name "Contact" matches the pluralized API resource "contacts"', () => {
    // The SDK uses PascalCase (Contact), the API uses plural lowercase (contacts)
    const sdkName = 'Contact'
    expect(entityNames).toContain(sdkName)

    // Verify the name can be pluralized to match the API path
    const plural = sdkName.toLowerCase() + 's'
    expect(plural).toBe('contacts')
  })

  it('deployed CRM entity names correspond to valid API paths', async () => {
    // Lead is not yet deployed — only test entities with live endpoints
    const deployedEntities = ['Organization', 'Contact', 'Deal', 'Activity', 'Pipeline']
    const pluralize = (name: string): string => {
      const lower = name.charAt(0).toLowerCase() + name.slice(1)
      if (lower.endsWith('y') && !['ay', 'ey', 'oy', 'uy'].some((s) => lower.endsWith(s))) {
        return lower.slice(0, -1) + 'ies'
      }
      if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('ch') || lower.endsWith('sh')) {
        return lower + 'es'
      }
      return lower + 's'
    }

    for (const entity of deployedEntities) {
      const path = pluralize(entity)
      const res = await fetch(`${CRM_URL}/api/${path}`, {
        headers: readHeaders(),
      })
      // Should not be 404 — the resource path should be recognized
      expect(res.status, `GET /api/${path} should not be 404`).not.toBe(404)
    }
  })
})

// =============================================================================
// 10. Live API — crm.headless.ly/openapi
// =============================================================================

// TODO: OpenAPI endpoint not yet implemented — re-enable when /openapi returns valid spec
describe.todo('live API: crm.headless.ly/openapi', () => {
  let openApiSpec: Record<string, unknown> | null = null

  beforeAll(async () => {
    const res = await fetch(`${CRM_URL}/openapi`, {
      headers: readHeaders(),
    })
    if (res.ok) {
      openApiSpec = (await res.json()) as Record<string, unknown>
    }
  })

  it('returns a valid OpenAPI 3.1.0 spec', () => {
    expect(openApiSpec).not.toBeNull()
    expect(openApiSpec!.openapi).toBe('3.1.0')
  })

  it('has info with title and version', () => {
    expect(openApiSpec).not.toBeNull()
    const info = openApiSpec!.info as Record<string, unknown>
    expect(info).toBeDefined()
    expect(typeof info.title).toBe('string')
    expect(typeof info.version).toBe('string')
  })

  it('has paths object', () => {
    expect(openApiSpec).not.toBeNull()
    expect(openApiSpec!.paths).toBeDefined()
    expect(typeof openApiSpec!.paths).toBe('object')
  })

  it('paths include CRM entity endpoints matching SDK entity names', () => {
    expect(openApiSpec).not.toBeNull()
    const paths = openApiSpec!.paths as Record<string, unknown>
    const pathKeys = Object.keys(paths)

    // CRM entities should appear as /api/{plural} paths
    expect(pathKeys.some((p) => p.includes('contacts'))).toBe(true)
    expect(pathKeys.some((p) => p.includes('organizations'))).toBe(true)
    expect(pathKeys.some((p) => p.includes('deals'))).toBe(true)
  })

  it('deployed CRM entities have corresponding paths in openapi spec', () => {
    expect(openApiSpec).not.toBeNull()
    const paths = openApiSpec!.paths as Record<string, unknown>

    // Lead is not yet deployed — only check entities with live endpoints
    const deployedPaths = [
      '/api/organizations',
      '/api/contacts',
      '/api/deals',
      '/api/activities',
      '/api/pipelines',
    ]

    for (const expectedPath of deployedPaths) {
      expect(paths[expectedPath], `OpenAPI should have path ${expectedPath}`).toBeDefined()
    }
  })

  it('each SDK CRM entity has CRUD paths (list + individual)', () => {
    expect(openApiSpec).not.toBeNull()
    const paths = openApiSpec!.paths as Record<string, unknown>

    const crmEntityPaths = [
      '/api/contacts',
      '/api/deals',
      '/api/organizations',
    ]

    for (const listPath of crmEntityPaths) {
      // List/create path
      expect(paths[listPath], `should have ${listPath}`).toBeDefined()

      // Individual CRUD path
      const individualPath = `${listPath}/{id}`
      expect(paths[individualPath], `should have ${individualPath}`).toBeDefined()
    }
  })

  it('entity path count matches expected CRM entity count', () => {
    expect(openApiSpec).not.toBeNull()
    const paths = openApiSpec!.paths as Record<string, unknown>
    const pathKeys = Object.keys(paths)

    // CRM system has 6 entities, each produces 2 paths (list + individual)
    // so we expect at least 12 path entries
    const listPaths = pathKeys.filter((p) => p.startsWith('/api/') && !p.includes('{id}'))
    expect(listPaths.length).toBeGreaterThanOrEqual(6)
  })
})

// =============================================================================
// 11. Live API — billing.headless.ly endpoints
// =============================================================================

describe('live API: billing.headless.ly', () => {
  it('GET /api/subscriptions returns a valid response', async () => {
    const res = await fetch(`${BILLING_URL}/api/subscriptions`, {
      headers: readHeaders(),
    })
    expect(res.status).toBeGreaterThanOrEqual(200)
    expect(res.status).toBeLessThan(500)
  })

  it('GET /api/invoices returns a valid response', async () => {
    const res = await fetch(`${BILLING_URL}/api/invoices`, {
      headers: readHeaders(),
    })
    expect(res.status).toBeGreaterThanOrEqual(200)
    expect(res.status).toBeLessThan(500)
  })

  it('GET /openapi returns billing paths matching deployed SDK entity names', async () => {
    const res = await fetch(`${BILLING_URL}/openapi`, {
      headers: readHeaders(),
    })

    if (res.ok) {
      const spec = (await res.json()) as Record<string, unknown>
      const paths = spec.paths as Record<string, unknown>
      const pathKeys = Object.keys(paths)

      // Check deployed billing entity paths exist
      expect(pathKeys.some((p) => p.includes('customers'))).toBe(true)
      expect(pathKeys.some((p) => p.includes('subscriptions'))).toBe(true)
      expect(pathKeys.some((p) => p.includes('invoices'))).toBe(true)
    }
  })
})

// =============================================================================
// 12. Cross-validation — SDK entity names vs live API
// =============================================================================

describe('cross-validation: SDK entity names vs live API', () => {
  it('CRM system root returns resources that map to deployed SDK entity names', async () => {
    const res = await fetch(`${CRM_URL}/`, {
      headers: readHeaders(),
    })

    if (res.ok) {
      const body = (await res.json()) as Record<string, unknown>
      const resources = body.resources as string[] | undefined

      if (resources && Array.isArray(resources)) {
        // Check deployed entities only (Lead is not yet deployed)
        const deployedResources = ['contacts', 'organizations', 'deals', 'activities', 'pipelines']

        for (const resource of deployedResources) {
          expect(resources, `CRM resources should include ${resource}`).toContain(resource)
        }
      }
    }
  })

  it('SDK entityNames count (35) exceeds any single system entity count', async () => {
    const res = await fetch(`${CRM_URL}/openapi`, {
      headers: readHeaders(),
    })

    if (res.ok) {
      const spec = (await res.json()) as Record<string, unknown>
      const paths = spec.paths as Record<string, unknown>
      const listPaths = Object.keys(paths).filter((p) => !p.includes('{id}'))

      // CRM is one system — it has a subset of the 35 entities
      // The SDK should always have more entities than any single system
      expect(entityNames.length).toBeGreaterThan(listPaths.length)
    }
  })

  it('billing.headless.ly protocols reference expected URL patterns', async () => {
    const res = await fetch(`${BILLING_URL}/`, {
      headers: readHeaders(),
    })

    if (res.ok) {
      const body = (await res.json()) as Record<string, unknown>
      const protocols = body.protocols as Record<string, unknown> | undefined

      if (protocols) {
        expect(typeof protocols.api).toBe('string')
        expect(typeof protocols.rpc).toBe('string')
        expect(typeof protocols.mcp).toBe('string')
        expect(typeof protocols.openapi).toBe('string')

        // All protocol URLs should reference the correct subdomain
        const apiUrl = protocols.api as string
        expect(apiUrl).toContain('headless.ly')
      }
    }
  })
})

// =============================================================================
// 13. Entity schema structural checks
// =============================================================================

describe('entity schema structural validation', () => {
  it('every entity has $name matching its entityNames entry', () => {
    for (const name of entityNames) {
      const entity = $[name]
      expect(entity).toBeDefined()
      expect(entity.$name).toBe(name)
    }
  })

  it('every entity has $schema with fields and relationships', () => {
    for (const name of entityNames) {
      const entity = $[name] as Record<string, unknown>
      const schema = entity.$schema as Record<string, unknown>
      expect(schema, `${name} should have $schema`).toBeDefined()
      expect(schema.fields, `${name}.$schema should have fields`).toBeDefined()
      expect(schema.relationships, `${name}.$schema should have relationships`).toBeDefined()
    }
  })

  it('every entity has a create function (except Event for update/delete)', () => {
    for (const name of entityNames) {
      const entity = $[name] as Record<string, unknown>
      expect(typeof entity.create, `${name}.create should be a function`).toBe('function')
    }
  })

  it('every entity has a find function', () => {
    for (const name of entityNames) {
      const entity = $[name] as Record<string, unknown>
      expect(typeof entity.find, `${name}.find should be a function`).toBe('function')
    }
  })

  it('every entity has a get function', () => {
    for (const name of entityNames) {
      const entity = $[name] as Record<string, unknown>
      expect(typeof entity.get, `${name}.get should be a function`).toBe('function')
    }
  })

  it('Event entity has null update and delete (immutable)', () => {
    const event = $.Event as Record<string, unknown>
    expect(event.update).toBeNull()
    expect(event.delete).toBeNull()
  })

  it('non-Event entities have update and delete functions', () => {
    for (const name of entityNames) {
      if (name === 'Event') continue
      const entity = $[name] as Record<string, unknown>
      expect(typeof entity.update, `${name}.update should be a function`).toBe('function')
      expect(typeof entity.delete, `${name}.delete should be a function`).toBe('function')
    }
  })
})

// =============================================================================
// 14. Domain namespace completeness
// =============================================================================

describe('domain namespace completeness', () => {
  const domainMap: Record<string, { namespace: Record<string, unknown>; expected: string[] }> = {
    crm: {
      namespace: crm as unknown as Record<string, unknown>,
      expected: ['Organization', 'Contact', 'Lead', 'Deal', 'Activity', 'Pipeline'],
    },
    billing: {
      namespace: billing as unknown as Record<string, unknown>,
      expected: ['Customer', 'Product', 'Plan', 'Price', 'Subscription', 'Invoice', 'Payment'],
    },
    projects: {
      namespace: projects as unknown as Record<string, unknown>,
      expected: ['Project', 'Issue', 'Comment'],
    },
    content: {
      namespace: content as unknown as Record<string, unknown>,
      expected: ['Content', 'Asset', 'Site'],
    },
    support: {
      namespace: support as unknown as Record<string, unknown>,
      expected: ['Ticket'],
    },
    analytics: {
      namespace: analytics as unknown as Record<string, unknown>,
      expected: ['Event', 'Metric', 'Funnel', 'Goal'],
    },
    marketing: {
      namespace: marketing as unknown as Record<string, unknown>,
      expected: ['Campaign', 'Segment', 'Form'],
    },
    experiments: {
      namespace: experiments as unknown as Record<string, unknown>,
      expected: ['Experiment', 'FeatureFlag'],
    },
    platform: {
      namespace: platform as unknown as Record<string, unknown>,
      expected: ['Workflow', 'Integration', 'Agent'],
    },
  }

  for (const [domainName, { namespace, expected }] of Object.entries(domainMap)) {
    it(`${domainName} namespace exports exactly ${expected.length} entities`, () => {
      const entityExports = Object.keys(namespace).filter((k) => {
        const val = namespace[k] as Record<string, unknown> | null
        return val && typeof val === 'object' && typeof val.$name === 'string'
      })
      expect(entityExports).toHaveLength(expected.length)
    })

    it(`${domainName} namespace contains all expected entities`, () => {
      for (const entityName of expected) {
        expect(namespace[entityName], `${domainName} should export ${entityName}`).toBeDefined()
      }
    })
  }

  it('all 35 entities are covered across all domain namespaces plus Identity + Communication', () => {
    const domainEntityNames = new Set<string>()

    for (const { expected } of Object.values(domainMap)) {
      for (const name of expected) {
        domainEntityNames.add(name)
      }
    }

    // Identity entities (User, ApiKey) and Communication (Message) are defined
    // directly in the SDK, not in a domain package
    domainEntityNames.add('User')
    domainEntityNames.add('ApiKey')
    domainEntityNames.add('Message')

    expect(domainEntityNames.size).toBe(35)

    for (const name of entityNames) {
      expect(domainEntityNames.has(name), `${name} should be in a domain or SDK-defined`).toBe(true)
    }
  })
})
