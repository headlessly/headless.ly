/**
 * E2E tests for @headlessly/content against live crm.headless.ly
 *
 * Tests package exports and CRUD lifecycle for Content entities:
 * Content, Asset, Site.
 *
 * These endpoints may not yet be deployed. Tests probe the API first
 * and skip gracefully with a console message if the endpoint returns 404.
 *
 * Auth via id-org-ai provision (programmatic, no interactive login).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Content, Asset, Site } from '../src/index.ts'
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

describe('@headlessly/content — package exports', () => {
  it('exports Content entity', () => {
    expect(Content).toBeDefined()
    expect(typeof Content).toBe('object')
    expect(Content.$name).toBe('Content')
  })

  it('exports Asset entity', () => {
    expect(Asset).toBeDefined()
    expect(typeof Asset).toBe('object')
    expect(Asset.$name).toBe('Asset')
  })

  it('exports Site entity', () => {
    expect(Site).toBeDefined()
    expect(typeof Site).toBe('object')
    expect(Site.$name).toBe('Site')
  })
})

// =============================================================================
// CRUD VERBS
// =============================================================================

describe('@headlessly/content — CRUD verbs', () => {
  it('Content has standard CRUD verbs', () => {
    expect(typeof Content.create).toBe('function')
    expect(typeof Content.get).toBe('function')
    expect(typeof Content.find).toBe('function')
    expect(typeof Content.update).toBe('function')
    expect(typeof Content.delete).toBe('function')
  })

  it('Asset has standard CRUD verbs', () => {
    expect(typeof Asset.create).toBe('function')
    expect(typeof Asset.get).toBe('function')
    expect(typeof Asset.find).toBe('function')
    expect(typeof Asset.update).toBe('function')
    expect(typeof Asset.delete).toBe('function')
  })

  it('Site has standard CRUD verbs', () => {
    expect(typeof Site.create).toBe('function')
    expect(typeof Site.get).toBe('function')
    expect(typeof Site.find).toBe('function')
    expect(typeof Site.update).toBe('function')
    expect(typeof Site.delete).toBe('function')
  })
})

// =============================================================================
// CONTENT — LIVE API CRUD
// =============================================================================

describe('@headlessly/content — Content CRUD (live API)', () => {
  let contentId: string
  let deployed = false

  it('checks if /api/contents endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'contents')
    if (!deployed) {
      console.log('SKIP: /api/contents not yet deployed — remaining Content CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates content', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/contents`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        title: `E2E-Content-${testId}`,
        slug: `e2e-content-${testId}`,
        body: `This is E2E test content created by ${testId}`,
        type: 'Post',
        status: 'Draft',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Content')
    expect(body.data.title).toBe(`E2E-Content-${testId}`)
    expect(body.data.status).toBe('Draft')
    contentId = body.data.$id as string
  })

  it('retrieves the content by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/contents/${contentId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(contentId)
    expect(body.data.$type).toBe('Content')
    expect(body.data.title).toBe(`E2E-Content-${testId}`)
  })

  it('updates the content', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/contents/${contentId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ title: `E2E-Content-Updated-${testId}`, status: 'Published' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.title).toBe(`E2E-Content-Updated-${testId}`)
    expect(body.data.status).toBe('Published')
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/contents/${contentId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.title).toBe(`E2E-Content-Updated-${testId}`)
    expect(body.data.status).toBe('Published')
  })

  it('lists contents and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/contents?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((c) => c.$id === contentId)
    expect(found).toBeDefined()
  })

  it('deletes the content', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/contents/${contentId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// ASSET — LIVE API CRUD
// =============================================================================

describe('@headlessly/content — Asset CRUD (live API)', () => {
  let assetId: string
  let deployed = false

  it('checks if /api/assets endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'assets')
    if (!deployed) {
      console.log('SKIP: /api/assets not yet deployed — remaining Asset CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates an asset', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/assets`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Asset-${testId}`,
        filename: `e2e-asset-${testId}.png`,
        url: `https://example.com/assets/e2e-${testId}.png`,
        type: 'Image',
        mimeType: 'image/png',
        size: 1024,
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Asset')
    expect(body.data.name).toBe(`E2E-Asset-${testId}`)
    expect(body.data.mimeType).toBe('image/png')
    assetId = body.data.$id as string
  })

  it('retrieves the asset by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/assets/${assetId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(assetId)
    expect(body.data.$type).toBe('Asset')
    expect(body.data.name).toBe(`E2E-Asset-${testId}`)
  })

  it('updates the asset', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/assets/${assetId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Asset-Updated-${testId}`, alt: 'Updated alt text' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Asset-Updated-${testId}`)
    expect(body.data.alt).toBe('Updated alt text')
  })

  it('lists assets and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/assets?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((a) => a.$id === assetId)
    expect(found).toBeDefined()
  })

  it('deletes the asset', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/assets/${assetId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// SITE — LIVE API CRUD
// =============================================================================

describe('@headlessly/content — Site CRUD (live API)', () => {
  let siteId: string
  let deployed = false

  it('checks if /api/sites endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'sites')
    if (!deployed) {
      console.log('SKIP: /api/sites not yet deployed — remaining Site CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a site', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/sites`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Site-${testId}`,
        subdomain: `e2e-site-${testId}`,
        title: `E2E Test Site ${testId}`,
        description: `E2E test site created by ${testId}`,
        status: 'Draft',
        visibility: 'Private',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Site')
    expect(body.data.name).toBe(`E2E-Site-${testId}`)
    expect(body.data.status).toBe('Draft')
    siteId = body.data.$id as string
  })

  it('retrieves the site by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/sites/${siteId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(siteId)
    expect(body.data.$type).toBe('Site')
    expect(body.data.name).toBe(`E2E-Site-${testId}`)
  })

  it('updates the site', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/sites/${siteId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Site-Updated-${testId}`, status: 'Published' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Site-Updated-${testId}`)
    expect(body.data.status).toBe('Published')
  })

  it('lists sites and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/sites?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((s) => s.$id === siteId)
    expect(found).toBeDefined()
  })

  it('deletes the site', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/sites/${siteId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// META-FIELD VERIFICATION VIA crudLifecycle HELPER
// =============================================================================

describe('@headlessly/content — meta-field verification via crudLifecycle', () => {
  it('Content: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'contents')
    if (!deployed) {
      console.log('SKIP: /api/contents not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'contents',
      { title: `E2E-Meta-Content-${testId}`, type: 'Page', status: 'Draft' },
      { title: `E2E-Meta-Content-Updated-${testId}` },
    )

    assertMetaFields(created, 'Content')
    expect(created.title).toBe(`E2E-Meta-Content-${testId}`)
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Content')
    expect(updated.$id).toBe(created.$id)
    expect(updated.title).toBe(`E2E-Meta-Content-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Asset: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'assets')
    if (!deployed) {
      console.log('SKIP: /api/assets not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'assets',
      { name: `E2E-Meta-Asset-${testId}`, filename: 'test.png', url: 'https://example.com/test.png', mimeType: 'image/png', size: 512 },
      { name: `E2E-Meta-Asset-Updated-${testId}` },
    )

    assertMetaFields(created, 'Asset')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Asset-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Site: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'sites')
    if (!deployed) {
      console.log('SKIP: /api/sites not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'sites',
      { name: `E2E-Meta-Site-${testId}`, status: 'Draft' },
      { name: `E2E-Meta-Site-Updated-${testId}` },
    )

    assertMetaFields(created, 'Site')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Site-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })
})
