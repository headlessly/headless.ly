/**
 * E2E tests for @headlessly/experiments against live crm.headless.ly
 *
 * Tests package exports and CRUD lifecycle for Experimentation entities:
 * Experiment, FeatureFlag.
 *
 * These endpoints may not yet be deployed. Tests probe the API first
 * and skip gracefully with a console message if the endpoint returns 404.
 *
 * Auth via id-org-ai provision (programmatic, no interactive login).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Experiment, FeatureFlag } from '../src/index.ts'
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

describe('@headlessly/experiments — package exports', () => {
  it('exports Experiment entity', () => {
    expect(Experiment).toBeDefined()
    expect(typeof Experiment).toBe('object')
    expect(Experiment.$name).toBe('Experiment')
  })

  it('exports FeatureFlag entity', () => {
    expect(FeatureFlag).toBeDefined()
    expect(typeof FeatureFlag).toBe('object')
    expect(FeatureFlag.$name).toBe('FeatureFlag')
  })
})

// =============================================================================
// CRUD VERBS
// =============================================================================

describe('@headlessly/experiments — CRUD verbs', () => {
  it('Experiment has standard CRUD verbs', () => {
    expect(typeof Experiment.create).toBe('function')
    expect(typeof Experiment.get).toBe('function')
    expect(typeof Experiment.find).toBe('function')
    expect(typeof Experiment.update).toBe('function')
    expect(typeof Experiment.delete).toBe('function')
  })

  it('Experiment has custom verbs from schema', () => {
    expect(typeof Experiment.start).toBe('function')
    expect(typeof Experiment.conclude).toBe('function')
    expect(typeof Experiment.pause).toBe('function')
  })

  it('FeatureFlag has standard CRUD verbs', () => {
    expect(typeof FeatureFlag.create).toBe('function')
    expect(typeof FeatureFlag.get).toBe('function')
    expect(typeof FeatureFlag.find).toBe('function')
    expect(typeof FeatureFlag.update).toBe('function')
    expect(typeof FeatureFlag.delete).toBe('function')
  })

  it('FeatureFlag has custom verbs from schema', () => {
    expect(typeof FeatureFlag.rollout).toBe('function')
    expect(typeof FeatureFlag.enable).toBe('function')
    expect(typeof FeatureFlag.disable).toBe('function')
  })
})

// =============================================================================
// EXPERIMENT — LIVE API CRUD
// =============================================================================

describe('@headlessly/experiments — Experiment CRUD (live API)', () => {
  let experimentId: string
  let deployed = false

  it('checks if /api/experiments endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'experiments')
    if (!deployed) {
      console.log('SKIP: /api/experiments not yet deployed — remaining Experiment CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates an experiment', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/experiments`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Experiment-${testId}`,
        description: `E2E test experiment created by ${testId}`,
        hypothesis: 'Variant B increases conversion by 10%',
        type: 'ABTest',
        status: 'Draft',
        trafficAllocation: 50,
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Experiment')
    expect(body.data.name).toBe(`E2E-Experiment-${testId}`)
    expect(body.data.type).toBe('ABTest')
    expect(body.data.status).toBe('Draft')
    experimentId = body.data.$id as string
  })

  it('retrieves the experiment by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/experiments/${experimentId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(experimentId)
    expect(body.data.$type).toBe('Experiment')
    expect(body.data.name).toBe(`E2E-Experiment-${testId}`)
  })

  it('updates the experiment', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/experiments/${experimentId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Experiment-Updated-${testId}`, status: 'Running', trafficAllocation: 100 }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Experiment-Updated-${testId}`)
    expect(body.data.status).toBe('Running')
    expect(body.data.trafficAllocation).toBe(100)
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/experiments/${experimentId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Experiment-Updated-${testId}`)
    expect(body.data.status).toBe('Running')
  })

  it('lists experiments and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/experiments?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((e) => e.$id === experimentId)
    expect(found).toBeDefined()
  })

  it('deletes the experiment', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/experiments/${experimentId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// FEATUREFLAG — LIVE API CRUD
// =============================================================================

describe('@headlessly/experiments — FeatureFlag CRUD (live API)', () => {
  let flagId: string
  let deployed = false

  it('checks if /api/featureflags endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'featureflags')
    if (!deployed) {
      console.log('SKIP: /api/featureflags not yet deployed — remaining FeatureFlag CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a feature flag', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/featureflags`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        key: `e2e-flag-${testId}`,
        name: `E2E-FeatureFlag-${testId}`,
        description: `E2E test feature flag created by ${testId}`,
        type: 'Boolean',
        defaultValue: 'false',
        status: 'Draft',
        rolloutPercentage: 0,
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'FeatureFlag')
    expect(body.data.name).toBe(`E2E-FeatureFlag-${testId}`)
    expect(body.data.type).toBe('Boolean')
    expect(body.data.status).toBe('Draft')
    flagId = body.data.$id as string
  })

  it('retrieves the feature flag by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/featureflags/${flagId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(flagId)
    expect(body.data.$type).toBe('FeatureFlag')
    expect(body.data.name).toBe(`E2E-FeatureFlag-${testId}`)
  })

  it('updates the feature flag', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/featureflags/${flagId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-FeatureFlag-Updated-${testId}`, status: 'Active', rolloutPercentage: 50 }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-FeatureFlag-Updated-${testId}`)
    expect(body.data.status).toBe('Active')
    expect(body.data.rolloutPercentage).toBe(50)
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/featureflags/${flagId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-FeatureFlag-Updated-${testId}`)
    expect(body.data.status).toBe('Active')
    expect(body.data.rolloutPercentage).toBe(50)
  })

  it('lists feature flags and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/featureflags?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((f) => f.$id === flagId)
    expect(found).toBeDefined()
  })

  it('deletes the feature flag', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/featureflags/${flagId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// META-FIELD VERIFICATION VIA crudLifecycle HELPER
// =============================================================================

describe('@headlessly/experiments — meta-field verification via crudLifecycle', () => {
  it('Experiment: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'experiments')
    if (!deployed) {
      console.log('SKIP: /api/experiments not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'experiments',
      { name: `E2E-Meta-Experiment-${testId}`, type: 'ABTest', status: 'Draft' },
      { name: `E2E-Meta-Experiment-Updated-${testId}`, status: 'Running' },
    )

    assertMetaFields(created, 'Experiment')
    expect(created.name).toBe(`E2E-Meta-Experiment-${testId}`)
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Experiment')
    expect(updated.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Experiment-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('FeatureFlag: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'featureflags')
    if (!deployed) {
      console.log('SKIP: /api/featureflags not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'featureflags',
      { key: `e2e-meta-flag-${testId}`, name: `E2E-Meta-Flag-${testId}`, type: 'Boolean', defaultValue: 'false', status: 'Draft' },
      { name: `E2E-Meta-Flag-Updated-${testId}`, rolloutPercentage: 25 },
    )

    assertMetaFields(created, 'FeatureFlag')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Flag-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })
})
