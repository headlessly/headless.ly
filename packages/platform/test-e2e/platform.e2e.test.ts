/**
 * E2E tests for @headlessly/platform against live crm.headless.ly
 *
 * Tests package exports and CRUD lifecycle for Platform entities:
 * Workflow, Integration, Agent.
 *
 * These endpoints may not yet be deployed. Tests probe the API first
 * and skip gracefully with a console message if the endpoint returns 404.
 *
 * Auth via id-org-ai provision (programmatic, no interactive login).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Workflow, Integration, Agent } from '../src/index.ts'
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

describe('@headlessly/platform — package exports', () => {
  it('exports Workflow entity', () => {
    expect(Workflow).toBeDefined()
    expect(typeof Workflow).toBe('object')
    expect(Workflow.$name).toBe('Workflow')
  })

  it('exports Integration entity', () => {
    expect(Integration).toBeDefined()
    expect(typeof Integration).toBe('object')
    expect(Integration.$name).toBe('Integration')
  })

  it('exports Agent entity', () => {
    expect(Agent).toBeDefined()
    expect(typeof Agent).toBe('object')
    expect(Agent.$name).toBe('Agent')
  })
})

// =============================================================================
// CRUD VERBS
// =============================================================================

describe('@headlessly/platform — CRUD verbs', () => {
  it('Workflow has standard CRUD verbs', () => {
    expect(typeof Workflow.create).toBe('function')
    expect(typeof Workflow.get).toBe('function')
    expect(typeof Workflow.find).toBe('function')
    expect(typeof Workflow.update).toBe('function')
    expect(typeof Workflow.delete).toBe('function')
  })

  it('Workflow has custom verbs from schema', () => {
    expect(typeof Workflow.activate).toBe('function')
    expect(typeof Workflow.pause).toBe('function')
    expect(typeof Workflow.trigger).toBe('function')
    expect(typeof Workflow.archive).toBe('function')
  })

  it('Integration has standard CRUD verbs', () => {
    expect(typeof Integration.create).toBe('function')
    expect(typeof Integration.get).toBe('function')
    expect(typeof Integration.find).toBe('function')
    expect(typeof Integration.update).toBe('function')
    expect(typeof Integration.delete).toBe('function')
  })

  it('Integration has custom verbs from schema', () => {
    expect(typeof Integration.connect).toBe('function')
    expect(typeof Integration.disconnect).toBe('function')
    expect(typeof Integration.sync).toBe('function')
  })

  it('Agent has standard CRUD verbs', () => {
    expect(typeof Agent.create).toBe('function')
    expect(typeof Agent.get).toBe('function')
    expect(typeof Agent.find).toBe('function')
    expect(typeof Agent.update).toBe('function')
    expect(typeof Agent.delete).toBe('function')
  })

  it('Agent has custom verbs from schema', () => {
    expect(typeof Agent.do).toBe('function')
    expect(typeof Agent.ask).toBe('function')
    expect(typeof Agent.decide).toBe('function')
    expect(typeof Agent.approve).toBe('function')
    expect(typeof Agent.deploy).toBe('function')
    expect(typeof Agent.pause).toBe('function')
    expect(typeof Agent.stop).toBe('function')
    expect(typeof Agent.retire).toBe('function')
  })
})

// =============================================================================
// WORKFLOW — LIVE API CRUD
// =============================================================================

describe('@headlessly/platform — Workflow CRUD (live API)', () => {
  let workflowId: string
  let deployed = false

  it('checks if /api/workflows endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'workflows')
    if (!deployed) {
      console.log('SKIP: /api/workflows not yet deployed — remaining Workflow CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a workflow', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/workflows`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Workflow-${testId}`,
        description: `E2E test workflow created by ${testId}`,
        triggerEvent: 'contact.created',
        status: 'Draft',
        errorHandling: 'Stop',
        timeout: 30000,
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Workflow')
    expect(body.data.name).toBe(`E2E-Workflow-${testId}`)
    expect(body.data.triggerEvent).toBe('contact.created')
    expect(body.data.status).toBe('Draft')
    workflowId = body.data.$id as string
  })

  it('retrieves the workflow by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/workflows/${workflowId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(workflowId)
    expect(body.data.$type).toBe('Workflow')
    expect(body.data.name).toBe(`E2E-Workflow-${testId}`)
  })

  it('updates the workflow', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/workflows/${workflowId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Workflow-Updated-${testId}`, status: 'Active', timeout: 60000 }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Workflow-Updated-${testId}`)
    expect(body.data.status).toBe('Active')
    expect(body.data.timeout).toBe(60000)
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/workflows/${workflowId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Workflow-Updated-${testId}`)
    expect(body.data.status).toBe('Active')
  })

  it('lists workflows and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/workflows?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((w) => w.$id === workflowId)
    expect(found).toBeDefined()
  })

  it('deletes the workflow', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/workflows/${workflowId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// INTEGRATION — LIVE API CRUD
// =============================================================================

describe('@headlessly/platform — Integration CRUD (live API)', () => {
  let integrationId: string
  let deployed = false

  it('checks if /api/integrations endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'integrations')
    if (!deployed) {
      console.log('SKIP: /api/integrations not yet deployed — remaining Integration CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates an integration', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/integrations`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Integration-${testId}`,
        slug: `e2e-integration-${testId}`,
        description: `E2E test integration created by ${testId}`,
        provider: 'stripe',
        category: 'Payment',
        authType: 'OAuth2',
        status: 'Available',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Integration')
    expect(body.data.name).toBe(`E2E-Integration-${testId}`)
    expect(body.data.provider).toBe('stripe')
    expect(body.data.category).toBe('Payment')
    integrationId = body.data.$id as string
  })

  it('retrieves the integration by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/integrations/${integrationId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(integrationId)
    expect(body.data.$type).toBe('Integration')
    expect(body.data.name).toBe(`E2E-Integration-${testId}`)
  })

  it('updates the integration', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/integrations/${integrationId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Integration-Updated-${testId}`, status: 'ComingSoon' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Integration-Updated-${testId}`)
    expect(body.data.status).toBe('ComingSoon')
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/integrations/${integrationId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Integration-Updated-${testId}`)
    expect(body.data.status).toBe('ComingSoon')
  })

  it('lists integrations and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/integrations?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((i) => i.$id === integrationId)
    expect(found).toBeDefined()
  })

  it('deletes the integration', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/integrations/${integrationId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// AGENT — LIVE API CRUD
// =============================================================================

describe('@headlessly/platform — Agent CRUD (live API)', () => {
  let agentId: string
  let deployed = false

  it('checks if /api/agents endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'agents')
    if (!deployed) {
      console.log('SKIP: /api/agents not yet deployed — remaining Agent CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates an agent', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/agents`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Agent-${testId}`,
        slug: `e2e-agent-${testId}`,
        description: `E2E test agent created by ${testId}`,
        type: 'Assistant',
        status: 'Draft',
        model: 'claude-opus-4-6',
        visibility: 'Private',
        memory: 'Session',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Agent')
    expect(body.data.name).toBe(`E2E-Agent-${testId}`)
    expect(body.data.type).toBe('Assistant')
    expect(body.data.status).toBe('Draft')
    agentId = body.data.$id as string
  })

  it('retrieves the agent by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/agents/${agentId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(agentId)
    expect(body.data.$type).toBe('Agent')
    expect(body.data.name).toBe(`E2E-Agent-${testId}`)
  })

  it('updates the agent', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/agents/${agentId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Agent-Updated-${testId}`, status: 'Active', temperature: 0.7, maxTokens: 4096 }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Agent-Updated-${testId}`)
    expect(body.data.status).toBe('Active')
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/agents/${agentId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Agent-Updated-${testId}`)
    expect(body.data.status).toBe('Active')
  })

  it('lists agents and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/agents?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((a) => a.$id === agentId)
    expect(found).toBeDefined()
  })

  it('deletes the agent', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/agents/${agentId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// META-FIELD VERIFICATION VIA crudLifecycle HELPER
// =============================================================================

describe('@headlessly/platform — meta-field verification via crudLifecycle', () => {
  it('Workflow: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'workflows')
    if (!deployed) {
      console.log('SKIP: /api/workflows not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'workflows',
      { name: `E2E-Meta-Workflow-${testId}`, triggerEvent: 'deal.closed', status: 'Draft' },
      { name: `E2E-Meta-Workflow-Updated-${testId}`, status: 'Active' },
    )

    assertMetaFields(created, 'Workflow')
    expect(created.name).toBe(`E2E-Meta-Workflow-${testId}`)
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Workflow')
    expect(updated.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Workflow-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Integration: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'integrations')
    if (!deployed) {
      console.log('SKIP: /api/integrations not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'integrations',
      { name: `E2E-Meta-Integration-${testId}`, provider: 'github', category: 'Other', authType: 'OAuth2', status: 'Available' },
      { name: `E2E-Meta-Integration-Updated-${testId}` },
    )

    assertMetaFields(created, 'Integration')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Integration-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Agent: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'agents')
    if (!deployed) {
      console.log('SKIP: /api/agents not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'agents',
      { name: `E2E-Meta-Agent-${testId}`, type: 'Autonomous', status: 'Draft', visibility: 'Private' },
      { name: `E2E-Meta-Agent-Updated-${testId}`, status: 'Active' },
    )

    assertMetaFields(created, 'Agent')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Agent-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })
})
