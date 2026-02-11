/**
 * E2E tests for @headlessly/crm against live crm.headless.ly
 *
 * Tests CRUD lifecycle for all CRM entities: Contact, Organization, Deal, Activity, Pipeline.
 * Lead is defined in the package but its API endpoint is not yet available (returns 404).
 *
 * Tests hit actual deployed endpoints — no mocks.
 * Auth via id-org-ai provision (programmatic, no interactive login).
 * If the service is down, tests FAIL. That's the point.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Organization, Contact, Lead, Deal, Activity, Pipeline } from '../src/index.ts'
import { setup, CRM_URL, writeHeaders, readHeaders, generateTestId, crudLifecycle, endpointExists } from '../../test-e2e-helpers'

const testId = generateTestId()

beforeAll(async () => {
  await setup()
}, 30_000)

// =============================================================================
// PACKAGE EXPORTS
// =============================================================================

describe('crm — package exports', () => {
  it('exports Organization entity', () => {
    expect(Organization).toBeDefined()
    expect(typeof Organization).toBe('object')
  })

  it('exports Contact entity', () => {
    expect(Contact).toBeDefined()
    expect(typeof Contact).toBe('object')
  })

  it('exports Lead entity', () => {
    expect(Lead).toBeDefined()
    expect(typeof Lead).toBe('object')
  })

  it('exports Deal entity', () => {
    expect(Deal).toBeDefined()
    expect(typeof Deal).toBe('object')
  })

  it('exports Activity entity', () => {
    expect(Activity).toBeDefined()
    expect(typeof Activity).toBe('object')
  })

  it('exports Pipeline entity', () => {
    expect(Pipeline).toBeDefined()
    expect(typeof Pipeline).toBe('object')
  })
})

// =============================================================================
// HELPERS
// =============================================================================

/** Assert all standard meta-fields on a created entity */
function assertMetaFields(entity: Record<string, unknown>, expectedType: string) {
  expect(entity.$id).toBeDefined()
  expect(typeof entity.$id).toBe('string')
  expect(entity.$type).toBe(expectedType)
  expect(entity.$version).toBeDefined()
  expect(entity.$createdAt).toBeDefined()
  expect(entity.$updatedAt).toBeDefined()

  // $id format: {type_lowercase}_{alphanumeric}
  const id = entity.$id as string
  const prefix = expectedType.toLowerCase()
  expect(id).toMatch(new RegExp(`^${prefix}_[a-zA-Z0-9]+$`))
}

// =============================================================================
// CONTACT — FULL CRUD LIFECYCLE
// =============================================================================

describe('crm — Contact CRUD', () => {
  let contactId: string

  it('creates a contact', async () => {
    const res = await fetch(`${CRM_URL}/api/contacts`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Contact-${testId}`,
        email: `contact-${testId}@e2e.test`,
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Contact')
    expect(body.data.name).toBe(`E2E-Contact-${testId}`)
    expect(body.data.email).toBe(`contact-${testId}@e2e.test`)
    contactId = body.data.$id as string
  })

  it('retrieves the contact by id', async () => {
    const res = await fetch(`${CRM_URL}/api/contacts/${contactId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(contactId)
    expect(body.data.$type).toBe('Contact')
    expect(body.data.name).toBe(`E2E-Contact-${testId}`)
    expect(body.data.email).toBe(`contact-${testId}@e2e.test`)
  })

  it('updates the contact', async () => {
    const res = await fetch(`${CRM_URL}/api/contacts/${contactId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Contact-Updated-${testId}`, title: 'CTO' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Contact-Updated-${testId}`)
    expect(body.data.title).toBe('CTO')
  })

  it('verifies update persisted on re-fetch', async () => {
    const res = await fetch(`${CRM_URL}/api/contacts/${contactId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Contact-Updated-${testId}`)
    expect(body.data.title).toBe('CTO')
  })

  it('lists contacts and finds the created one', async () => {
    const res = await fetch(`${CRM_URL}/api/contacts?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((c) => c.$id === contactId)
    expect(found).toBeDefined()
  })

  it('deletes the contact', async () => {
    const res = await fetch(`${CRM_URL}/api/contacts/${contactId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// ORGANIZATION — FULL CRUD LIFECYCLE
// =============================================================================

describe('crm — Organization CRUD', () => {
  let orgId: string

  it('creates an organization', async () => {
    const res = await fetch(`${CRM_URL}/api/organizations`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Org-${testId}`,
        domain: `e2e-${testId}.test`,
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Organization')
    expect(body.data.name).toBe(`E2E-Org-${testId}`)
    orgId = body.data.$id as string
  })

  it('retrieves the organization by id', async () => {
    const res = await fetch(`${CRM_URL}/api/organizations/${orgId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(orgId)
    expect(body.data.$type).toBe('Organization')
    expect(body.data.name).toBe(`E2E-Org-${testId}`)
  })

  it('updates the organization', async () => {
    const res = await fetch(`${CRM_URL}/api/organizations/${orgId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Org-Updated-${testId}` }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Org-Updated-${testId}`)
  })

  it('verifies update persisted on re-fetch', async () => {
    const res = await fetch(`${CRM_URL}/api/organizations/${orgId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Org-Updated-${testId}`)
  })

  it('lists organizations and finds the created one', async () => {
    const res = await fetch(`${CRM_URL}/api/organizations?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((o) => o.$id === orgId)
    expect(found).toBeDefined()
  })

  it('deletes the organization', async () => {
    const res = await fetch(`${CRM_URL}/api/organizations/${orgId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// DEAL — FULL CRUD LIFECYCLE
// =============================================================================

describe('crm — Deal CRUD', () => {
  let dealId: string

  it('creates a deal', async () => {
    const res = await fetch(`${CRM_URL}/api/deals`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Deal-${testId}`,
        value: 50000,
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Deal')
    expect(body.data.name).toBe(`E2E-Deal-${testId}`)
    expect(body.data.value).toBe(50000)
    dealId = body.data.$id as string
  })

  it('retrieves the deal by id', async () => {
    const res = await fetch(`${CRM_URL}/api/deals/${dealId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(dealId)
    expect(body.data.$type).toBe('Deal')
    expect(body.data.name).toBe(`E2E-Deal-${testId}`)
    expect(body.data.value).toBe(50000)
  })

  it('updates the deal', async () => {
    const res = await fetch(`${CRM_URL}/api/deals/${dealId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Deal-Updated-${testId}`, value: 75000 }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Deal-Updated-${testId}`)
    expect(body.data.value).toBe(75000)
  })

  it('verifies update persisted on re-fetch', async () => {
    const res = await fetch(`${CRM_URL}/api/deals/${dealId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Deal-Updated-${testId}`)
    expect(body.data.value).toBe(75000)
  })

  it('lists deals and finds the created one', async () => {
    const res = await fetch(`${CRM_URL}/api/deals?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((d) => d.$id === dealId)
    expect(found).toBeDefined()
  })

  it('deletes the deal', async () => {
    const res = await fetch(`${CRM_URL}/api/deals/${dealId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// ACTIVITY — FULL CRUD LIFECYCLE
// =============================================================================

describe('crm — Activity CRUD', () => {
  let activityId: string

  it('creates an activity', async () => {
    const res = await fetch(`${CRM_URL}/api/activities`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        subject: `E2E-Activity-${testId}`,
        type: 'Call',
        description: `E2E test activity created by ${testId}`,
        status: 'Pending',
        priority: 'Medium',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Activity')
    expect(body.data.subject).toBe(`E2E-Activity-${testId}`)
    expect(body.data.type).toBe('Call')
    expect(body.data.status).toBe('Pending')
    activityId = body.data.$id as string
  })

  it('retrieves the activity by id', async () => {
    const res = await fetch(`${CRM_URL}/api/activities/${activityId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(activityId)
    expect(body.data.$type).toBe('Activity')
    expect(body.data.subject).toBe(`E2E-Activity-${testId}`)
  })

  it('updates the activity', async () => {
    const res = await fetch(`${CRM_URL}/api/activities/${activityId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ subject: `E2E-Activity-Updated-${testId}`, status: 'InProgress', priority: 'High' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.subject).toBe(`E2E-Activity-Updated-${testId}`)
    expect(body.data.status).toBe('InProgress')
    expect(body.data.priority).toBe('High')
  })

  it('verifies update persisted on re-fetch', async () => {
    const res = await fetch(`${CRM_URL}/api/activities/${activityId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.subject).toBe(`E2E-Activity-Updated-${testId}`)
    expect(body.data.status).toBe('InProgress')
    expect(body.data.priority).toBe('High')
  })

  it('lists activities and finds the created one', async () => {
    const res = await fetch(`${CRM_URL}/api/activities?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((a) => a.$id === activityId)
    expect(found).toBeDefined()
  })

  it('deletes the activity', async () => {
    const res = await fetch(`${CRM_URL}/api/activities/${activityId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// PIPELINE — FULL CRUD LIFECYCLE
// =============================================================================

describe('crm — Pipeline CRUD', () => {
  let pipelineId: string

  it('creates a pipeline', async () => {
    const res = await fetch(`${CRM_URL}/api/pipelines`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Pipeline-${testId}`,
        description: `E2E test pipeline created by ${testId}`,
        stages: 'Prospect,Qualified,Proposal,Negotiation,Closed',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Pipeline')
    expect(body.data.name).toBe(`E2E-Pipeline-${testId}`)
    pipelineId = body.data.$id as string
  })

  it('retrieves the pipeline by id', async () => {
    const res = await fetch(`${CRM_URL}/api/pipelines/${pipelineId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(pipelineId)
    expect(body.data.$type).toBe('Pipeline')
    expect(body.data.name).toBe(`E2E-Pipeline-${testId}`)
  })

  it('updates the pipeline', async () => {
    const res = await fetch(`${CRM_URL}/api/pipelines/${pipelineId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Pipeline-Updated-${testId}`, dealRotting: 14 }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Pipeline-Updated-${testId}`)
    expect(body.data.dealRotting).toBe(14)
  })

  it('verifies update persisted on re-fetch', async () => {
    const res = await fetch(`${CRM_URL}/api/pipelines/${pipelineId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Pipeline-Updated-${testId}`)
    expect(body.data.dealRotting).toBe(14)
  })

  it('lists pipelines and finds the created one', async () => {
    const res = await fetch(`${CRM_URL}/api/pipelines?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((p) => p.$id === pipelineId)
    expect(found).toBeDefined()
  })

  it('deletes the pipeline', async () => {
    const res = await fetch(`${CRM_URL}/api/pipelines/${pipelineId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// LEAD — PACKAGE EXPORT + ENDPOINT STATUS
// =============================================================================

describe('crm — Lead entity', () => {
  it('Lead is defined in the package with expected Noun shape', () => {
    expect(Lead).toBeDefined()
    expect(typeof Lead).toBe('object')
  })

  it('leads API endpoint is not yet available (returns 404)', async () => {
    const exists = await endpointExists(CRM_URL, 'leads')
    expect(exists).toBe(false)
  })
})

// =============================================================================
// META-FIELDS — DEEP VERIFICATION VIA crudLifecycle HELPER
// =============================================================================

describe('crm — meta-field verification via crudLifecycle', () => {
  it('Contact: full lifecycle returns correct meta-fields', async () => {
    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'contacts',
      { name: `E2E-Meta-Contact-${testId}`, email: `meta-contact-${testId}@e2e.test` },
      { name: `E2E-Meta-Contact-Updated-${testId}` },
    )

    // created
    assertMetaFields(created, 'Contact')
    expect(created.name).toBe(`E2E-Meta-Contact-${testId}`)

    // fetched matches created
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Contact')
    expect(fetched.name).toBe(`E2E-Meta-Contact-${testId}`)

    // updated reflects changes
    expect(updated.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Contact-Updated-${testId}`)

    // listed includes the entity
    const found = listed.find((e) => e.$id === created.$id)
    expect(found).toBeDefined()

    // deleted successfully
    expect(deleted).toBe(true)
  })

  it('Organization: full lifecycle returns correct meta-fields', async () => {
    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'organizations',
      { name: `E2E-Meta-Org-${testId}`, domain: `meta-org-${testId}.test` },
      { name: `E2E-Meta-Org-Updated-${testId}` },
    )

    assertMetaFields(created, 'Organization')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Org-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Deal: full lifecycle returns correct meta-fields', async () => {
    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'deals',
      { name: `E2E-Meta-Deal-${testId}`, value: 25000 },
      { name: `E2E-Meta-Deal-Updated-${testId}`, value: 30000 },
    )

    assertMetaFields(created, 'Deal')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Deal-Updated-${testId}`)
    expect(updated.value).toBe(30000)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Activity: full lifecycle returns correct meta-fields', async () => {
    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'activities',
      { subject: `E2E-Meta-Activity-${testId}`, type: 'Meeting', status: 'Pending' },
      { subject: `E2E-Meta-Activity-Updated-${testId}`, status: 'Completed' },
    )

    assertMetaFields(created, 'Activity')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.subject).toBe(`E2E-Meta-Activity-Updated-${testId}`)
    expect(updated.status).toBe('Completed')
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Pipeline: full lifecycle returns correct meta-fields', async () => {
    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'pipelines',
      { name: `E2E-Meta-Pipeline-${testId}` },
      { name: `E2E-Meta-Pipeline-Updated-${testId}` },
    )

    assertMetaFields(created, 'Pipeline')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Pipeline-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })
})

// =============================================================================
// $id FORMAT VERIFICATION
// =============================================================================

describe('crm — $id format verification', () => {
  const entityTests: Array<{ resource: string; type: string; data: Record<string, unknown> }> = [
    { resource: 'contacts', type: 'Contact', data: { name: `E2E-IdFmt-Contact-${testId}` } },
    { resource: 'organizations', type: 'Organization', data: { name: `E2E-IdFmt-Org-${testId}` } },
    { resource: 'deals', type: 'Deal', data: { name: `E2E-IdFmt-Deal-${testId}`, value: 1000 } },
    { resource: 'activities', type: 'Activity', data: { subject: `E2E-IdFmt-Activity-${testId}`, type: 'Note' } },
    { resource: 'pipelines', type: 'Pipeline', data: { name: `E2E-IdFmt-Pipeline-${testId}` } },
  ]

  for (const { resource, type, data } of entityTests) {
    it(`${type} $id matches {type_lowercase}_{alphanumeric} format`, async () => {
      const createRes = await fetch(`${CRM_URL}/api/${resource}`, {
        method: 'POST',
        headers: writeHeaders(),
        body: JSON.stringify(data),
      })
      expect(createRes.status).toBe(201)

      const body = (await createRes.json()) as { data: Record<string, unknown> }
      const id = body.data.$id as string
      const prefix = type.toLowerCase()

      expect(id).toMatch(new RegExp(`^${prefix}_[a-zA-Z0-9]+$`))
      expect(id.length).toBeGreaterThan(prefix.length + 1)

      // Cleanup
      const delRes = await fetch(`${CRM_URL}/api/${resource}/${id}`, {
        method: 'DELETE',
        headers: readHeaders(),
      })
      expect(delRes.status).toBe(200)
    })
  }
})
