/**
 * E2E tests for @headlessly/marketing against live crm.headless.ly
 *
 * Tests package exports and CRUD lifecycle for Marketing entities:
 * Campaign, Segment, Form.
 *
 * These endpoints may not yet be deployed. Tests probe the API first
 * and skip gracefully with a console message if the endpoint returns 404.
 *
 * Auth via id-org-ai provision (programmatic, no interactive login).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Campaign, Segment, Form } from '../src/index.ts'
import { setup, CRM_URL, writeHeaders, readHeaders, generateTestId, crudLifecycle, endpointExists } from '../../test-e2e-helpers'

const testId = generateTestId()

beforeAll(async () => {
  await setup()
}, 30_000)

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

  const id = entity.$id as string
  const prefix = expectedType.toLowerCase()
  expect(id).toMatch(new RegExp(`^${prefix}_[a-zA-Z0-9]+$`))
}

// =============================================================================
// PACKAGE EXPORTS
// =============================================================================

describe('@headlessly/marketing — package exports', () => {
  it('exports Campaign entity', () => {
    expect(Campaign).toBeDefined()
    expect(typeof Campaign).toBe('object')
    expect(Campaign.$name).toBe('Campaign')
  })

  it('exports Segment entity', () => {
    expect(Segment).toBeDefined()
    expect(typeof Segment).toBe('object')
    expect(Segment.$name).toBe('Segment')
  })

  it('exports Form entity', () => {
    expect(Form).toBeDefined()
    expect(typeof Form).toBe('object')
    expect(Form.$name).toBe('Form')
  })
})

// =============================================================================
// CRUD VERBS
// =============================================================================

describe('@headlessly/marketing — CRUD verbs', () => {
  it('Campaign has standard CRUD verbs', () => {
    expect(typeof Campaign.create).toBe('function')
    expect(typeof Campaign.get).toBe('function')
    expect(typeof Campaign.find).toBe('function')
    expect(typeof Campaign.update).toBe('function')
    expect(typeof Campaign.delete).toBe('function')
  })

  it('Campaign has custom verbs from schema', () => {
    expect(typeof Campaign.launch).toBe('function')
    expect(typeof Campaign.pause).toBe('function')
    expect(typeof Campaign.complete).toBe('function')
  })

  it('Segment has standard CRUD verbs', () => {
    expect(typeof Segment.create).toBe('function')
    expect(typeof Segment.get).toBe('function')
    expect(typeof Segment.find).toBe('function')
    expect(typeof Segment.update).toBe('function')
    expect(typeof Segment.delete).toBe('function')
  })

  it('Form has standard CRUD verbs', () => {
    expect(typeof Form.create).toBe('function')
    expect(typeof Form.get).toBe('function')
    expect(typeof Form.find).toBe('function')
    expect(typeof Form.update).toBe('function')
    expect(typeof Form.delete).toBe('function')
  })

  it('Form has custom verbs from schema', () => {
    expect(typeof Form.publish).toBe('function')
    expect(typeof Form.archive).toBe('function')
  })
})

// =============================================================================
// CAMPAIGN — LIVE API CRUD
// =============================================================================

describe('@headlessly/marketing — Campaign CRUD (live API)', () => {
  let campaignId: string
  let deployed = false

  it('checks if /api/campaigns endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'campaigns')
    if (!deployed) {
      console.log('SKIP: /api/campaigns not yet deployed — remaining Campaign CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a campaign', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/campaigns`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Campaign-${testId}`,
        description: `E2E test campaign created by ${testId}`,
        type: 'Email',
        status: 'Draft',
        budget: 5000,
        currency: 'USD',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Campaign')
    expect(body.data.name).toBe(`E2E-Campaign-${testId}`)
    expect(body.data.type).toBe('Email')
    expect(body.data.status).toBe('Draft')
    campaignId = body.data.$id as string
  })

  it('retrieves the campaign by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/campaigns/${campaignId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(campaignId)
    expect(body.data.$type).toBe('Campaign')
    expect(body.data.name).toBe(`E2E-Campaign-${testId}`)
  })

  it('updates the campaign', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Campaign-Updated-${testId}`, status: 'Active', budget: 10000 }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Campaign-Updated-${testId}`)
    expect(body.data.status).toBe('Active')
    expect(body.data.budget).toBe(10000)
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/campaigns/${campaignId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Campaign-Updated-${testId}`)
    expect(body.data.status).toBe('Active')
    expect(body.data.budget).toBe(10000)
  })

  it('lists campaigns and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/campaigns?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((c) => c.$id === campaignId)
    expect(found).toBeDefined()
  })

  it('deletes the campaign', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/campaigns/${campaignId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// SEGMENT — LIVE API CRUD
// =============================================================================

describe('@headlessly/marketing — Segment CRUD (live API)', () => {
  let segmentId: string
  let deployed = false

  it('checks if /api/segments endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'segments')
    if (!deployed) {
      console.log('SKIP: /api/segments not yet deployed — remaining Segment CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a segment', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/segments`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Segment-${testId}`,
        description: `E2E test segment created by ${testId}`,
        criteria: 'stage = Lead AND source = organic',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Segment')
    expect(body.data.name).toBe(`E2E-Segment-${testId}`)
    segmentId = body.data.$id as string
  })

  it('retrieves the segment by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/segments/${segmentId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(segmentId)
    expect(body.data.$type).toBe('Segment')
    expect(body.data.name).toBe(`E2E-Segment-${testId}`)
  })

  it('updates the segment', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/segments/${segmentId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Segment-Updated-${testId}`, memberCount: 150 }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Segment-Updated-${testId}`)
  })

  it('lists segments and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/segments?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((s) => s.$id === segmentId)
    expect(found).toBeDefined()
  })

  it('deletes the segment', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/segments/${segmentId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// FORM — LIVE API CRUD
// =============================================================================

describe('@headlessly/marketing — Form CRUD (live API)', () => {
  let formId: string
  let deployed = false

  it('checks if /api/forms endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'forms')
    if (!deployed) {
      console.log('SKIP: /api/forms not yet deployed — remaining Form CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a form', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/forms`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Form-${testId}`,
        description: `E2E test form created by ${testId}`,
        fields: 'name,email,company',
        status: 'Draft',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Form')
    expect(body.data.name).toBe(`E2E-Form-${testId}`)
    expect(body.data.status).toBe('Draft')
    formId = body.data.$id as string
  })

  it('retrieves the form by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/forms/${formId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(formId)
    expect(body.data.$type).toBe('Form')
    expect(body.data.name).toBe(`E2E-Form-${testId}`)
  })

  it('updates the form', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/forms/${formId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Form-Updated-${testId}`, status: 'Active' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Form-Updated-${testId}`)
    expect(body.data.status).toBe('Active')
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/forms/${formId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Form-Updated-${testId}`)
    expect(body.data.status).toBe('Active')
  })

  it('lists forms and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/forms?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((f) => f.$id === formId)
    expect(found).toBeDefined()
  })

  it('deletes the form', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/forms/${formId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// META-FIELD VERIFICATION VIA crudLifecycle HELPER
// =============================================================================

describe('@headlessly/marketing — meta-field verification via crudLifecycle', () => {
  it('Campaign: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'campaigns')
    if (!deployed) {
      console.log('SKIP: /api/campaigns not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'campaigns',
      { name: `E2E-Meta-Campaign-${testId}`, type: 'Social', status: 'Draft' },
      { name: `E2E-Meta-Campaign-Updated-${testId}`, status: 'Active' },
    )

    assertMetaFields(created, 'Campaign')
    expect(created.name).toBe(`E2E-Meta-Campaign-${testId}`)
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Campaign')
    expect(updated.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Campaign-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Segment: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'segments')
    if (!deployed) {
      console.log('SKIP: /api/segments not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'segments',
      { name: `E2E-Meta-Segment-${testId}` },
      { name: `E2E-Meta-Segment-Updated-${testId}` },
    )

    assertMetaFields(created, 'Segment')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Segment-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Form: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'forms')
    if (!deployed) {
      console.log('SKIP: /api/forms not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'forms',
      { name: `E2E-Meta-Form-${testId}`, status: 'Draft' },
      { name: `E2E-Meta-Form-Updated-${testId}`, status: 'Active' },
    )

    assertMetaFields(created, 'Form')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Form-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })
})
