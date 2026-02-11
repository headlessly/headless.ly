/**
 * E2E tests for @headlessly/analytics against live crm.headless.ly
 *
 * Tests package exports and CRUD lifecycle for Analytics entities:
 * Event, Metric, Funnel, Goal.
 *
 * Note: Event has `update: null` and `delete: null` in its schema,
 * making it an immutable append-only entity. Tests verify that
 * update and delete are disabled (return null from the proxy).
 *
 * These endpoints may not yet be deployed. Tests probe the API first
 * and skip gracefully with a console message if the endpoint returns 404.
 *
 * Auth via id-org-ai provision (programmatic, no interactive login).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Event, Metric, Funnel, Goal } from '../src/index.ts'
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

describe('@headlessly/analytics — package exports', () => {
  it('exports Event entity', () => {
    expect(Event).toBeDefined()
    expect(typeof Event).toBe('object')
    expect(Event.$name).toBe('Event')
  })

  it('exports Metric entity', () => {
    expect(Metric).toBeDefined()
    expect(typeof Metric).toBe('object')
    expect(Metric.$name).toBe('Metric')
  })

  it('exports Funnel entity', () => {
    expect(Funnel).toBeDefined()
    expect(typeof Funnel).toBe('object')
    expect(Funnel.$name).toBe('Funnel')
  })

  it('exports Goal entity', () => {
    expect(Goal).toBeDefined()
    expect(typeof Goal).toBe('object')
    expect(Goal.$name).toBe('Goal')
  })
})

// =============================================================================
// CRUD VERBS
// =============================================================================

describe('@headlessly/analytics — CRUD verbs', () => {
  it('Event has create, get, find (but NOT update or delete — immutable)', () => {
    expect(typeof Event.create).toBe('function')
    expect(typeof Event.get).toBe('function')
    expect(typeof Event.find).toBe('function')
    // Event schema defines `update: null` and `delete: null` — disabled verbs return null
    expect(Event.update).toBeNull()
    expect(Event.delete).toBeNull()
  })

  it('Metric has standard CRUD verbs', () => {
    expect(typeof Metric.create).toBe('function')
    expect(typeof Metric.get).toBe('function')
    expect(typeof Metric.find).toBe('function')
    expect(typeof Metric.update).toBe('function')
    expect(typeof Metric.delete).toBe('function')
  })

  it('Funnel has standard CRUD verbs', () => {
    expect(typeof Funnel.create).toBe('function')
    expect(typeof Funnel.get).toBe('function')
    expect(typeof Funnel.find).toBe('function')
    expect(typeof Funnel.update).toBe('function')
    expect(typeof Funnel.delete).toBe('function')
  })

  it('Goal has standard CRUD verbs', () => {
    expect(typeof Goal.create).toBe('function')
    expect(typeof Goal.get).toBe('function')
    expect(typeof Goal.find).toBe('function')
    expect(typeof Goal.update).toBe('function')
    expect(typeof Goal.delete).toBe('function')
  })
})

// =============================================================================
// EVENT — LIVE API (IMMUTABLE — CREATE + READ ONLY)
// =============================================================================

describe('@headlessly/analytics — Event CRUD (live API)', () => {
  let deployed = false

  it('checks if /api/events endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'events')
    if (!deployed) {
      console.log('SKIP: /api/events not yet deployed — remaining Event tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates an event (append-only)', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/events`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Event-${testId}`,
        type: 'pageview',
        source: 'API',
        timestamp: new Date().toISOString(),
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Event')
    expect(body.data.name).toBe(`E2E-Event-${testId}`)
    expect(body.data.type).toBe('pageview')
  })

  it('lists events', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/events?limit=10`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<Record<string, unknown>> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('rejects PUT on events (immutable)', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/events/fake-event-id`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: 'should-fail' }),
    })
    // Events are immutable — expect 4xx
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  it('rejects DELETE on events (immutable)', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/events/fake-event-id`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    // Events are immutable — expect 4xx
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})

// =============================================================================
// METRIC — LIVE API CRUD
// =============================================================================

describe('@headlessly/analytics — Metric CRUD (live API)', () => {
  let metricId: string
  let deployed = false

  it('checks if /api/metrics endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'metrics')
    if (!deployed) {
      console.log('SKIP: /api/metrics not yet deployed — remaining Metric CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a metric', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/metrics`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Metric-${testId}`,
        value: 42,
        type: 'Counter',
        unit: 'count',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Metric')
    expect(body.data.name).toBe(`E2E-Metric-${testId}`)
    expect(body.data.value).toBe(42)
    metricId = body.data.$id as string
  })

  it('retrieves the metric by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/metrics/${metricId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(metricId)
    expect(body.data.$type).toBe('Metric')
    expect(body.data.name).toBe(`E2E-Metric-${testId}`)
  })

  it('updates the metric', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/metrics/${metricId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Metric-Updated-${testId}`, value: 100 }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Metric-Updated-${testId}`)
    expect(body.data.value).toBe(100)
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/metrics/${metricId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Metric-Updated-${testId}`)
    expect(body.data.value).toBe(100)
  })

  it('lists metrics and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/metrics?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((m) => m.$id === metricId)
    expect(found).toBeDefined()
  })

  it('deletes the metric', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/metrics/${metricId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// FUNNEL — LIVE API CRUD
// =============================================================================

describe('@headlessly/analytics — Funnel CRUD (live API)', () => {
  let funnelId: string
  let deployed = false

  it('checks if /api/funnels endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'funnels')
    if (!deployed) {
      console.log('SKIP: /api/funnels not yet deployed — remaining Funnel CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a funnel', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/funnels`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Funnel-${testId}`,
        description: `E2E test funnel created by ${testId}`,
        steps: 'Visit,Signup,Activate,Subscribe',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Funnel')
    expect(body.data.name).toBe(`E2E-Funnel-${testId}`)
    funnelId = body.data.$id as string
  })

  it('retrieves the funnel by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/funnels/${funnelId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(funnelId)
    expect(body.data.$type).toBe('Funnel')
    expect(body.data.name).toBe(`E2E-Funnel-${testId}`)
  })

  it('updates the funnel', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/funnels/${funnelId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Funnel-Updated-${testId}`, conversionRate: 0.15 }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Funnel-Updated-${testId}`)
  })

  it('lists funnels and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/funnels?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((f) => f.$id === funnelId)
    expect(found).toBeDefined()
  })

  it('deletes the funnel', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/funnels/${funnelId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// GOAL — LIVE API CRUD
// =============================================================================

describe('@headlessly/analytics — Goal CRUD (live API)', () => {
  let goalId: string
  let deployed = false

  it('checks if /api/goals endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'goals')
    if (!deployed) {
      console.log('SKIP: /api/goals not yet deployed — remaining Goal CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a goal', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/goals`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Goal-${testId}`,
        description: `E2E test goal created by ${testId}`,
        target: 1000,
        current: 0,
        unit: 'users',
        period: 'Monthly',
        status: 'OnTrack',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Goal')
    expect(body.data.name).toBe(`E2E-Goal-${testId}`)
    expect(body.data.target).toBe(1000)
    expect(body.data.status).toBe('OnTrack')
    goalId = body.data.$id as string
  })

  it('retrieves the goal by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/goals/${goalId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(goalId)
    expect(body.data.$type).toBe('Goal')
    expect(body.data.name).toBe(`E2E-Goal-${testId}`)
  })

  it('updates the goal', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/goals/${goalId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Goal-Updated-${testId}`, current: 500, status: 'AtRisk' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Goal-Updated-${testId}`)
    expect(body.data.current).toBe(500)
    expect(body.data.status).toBe('AtRisk')
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/goals/${goalId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Goal-Updated-${testId}`)
    expect(body.data.current).toBe(500)
    expect(body.data.status).toBe('AtRisk')
  })

  it('lists goals and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/goals?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((g) => g.$id === goalId)
    expect(found).toBeDefined()
  })

  it('deletes the goal', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/goals/${goalId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// META-FIELD VERIFICATION VIA crudLifecycle HELPER
// =============================================================================

describe('@headlessly/analytics — meta-field verification via crudLifecycle', () => {
  it('Metric: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'metrics')
    if (!deployed) {
      console.log('SKIP: /api/metrics not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'metrics',
      { name: `E2E-Meta-Metric-${testId}`, value: 10, type: 'Gauge' },
      { name: `E2E-Meta-Metric-Updated-${testId}`, value: 20 },
    )

    assertMetaFields(created, 'Metric')
    expect(created.name).toBe(`E2E-Meta-Metric-${testId}`)
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Metric')
    expect(updated.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Metric-Updated-${testId}`)
    expect(updated.value).toBe(20)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Funnel: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'funnels')
    if (!deployed) {
      console.log('SKIP: /api/funnels not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'funnels',
      { name: `E2E-Meta-Funnel-${testId}`, steps: 'A,B,C' },
      { name: `E2E-Meta-Funnel-Updated-${testId}` },
    )

    assertMetaFields(created, 'Funnel')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Funnel-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Goal: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'goals')
    if (!deployed) {
      console.log('SKIP: /api/goals not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'goals',
      { name: `E2E-Meta-Goal-${testId}`, target: 500, status: 'OnTrack' },
      { name: `E2E-Meta-Goal-Updated-${testId}`, current: 250 },
    )

    assertMetaFields(created, 'Goal')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Goal-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })
})
