/**
 * E2E tests for @headlessly/projects against live crm.headless.ly
 *
 * Tests package exports and CRUD lifecycle for Projects entities:
 * Project, Issue, Comment.
 *
 * These endpoints may not yet be deployed. Tests probe the API first
 * and skip gracefully with a console message if the endpoint returns 404.
 *
 * Auth via id-org-ai provision (programmatic, no interactive login).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Project, Issue, Comment } from '../src/index.ts'
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

describe('@headlessly/projects — package exports', () => {
  it('exports Project entity', () => {
    expect(Project).toBeDefined()
    expect(typeof Project).toBe('object')
    expect(Project.$name).toBe('Project')
  })

  it('exports Issue entity', () => {
    expect(Issue).toBeDefined()
    expect(typeof Issue).toBe('object')
    expect(Issue.$name).toBe('Issue')
  })

  it('exports Comment entity', () => {
    expect(Comment).toBeDefined()
    expect(typeof Comment).toBe('object')
    expect(Comment.$name).toBe('Comment')
  })
})

// =============================================================================
// CRUD VERBS
// =============================================================================

describe('@headlessly/projects — CRUD verbs', () => {
  it('Project has standard CRUD verbs', () => {
    expect(typeof Project.create).toBe('function')
    expect(typeof Project.get).toBe('function')
    expect(typeof Project.find).toBe('function')
    expect(typeof Project.update).toBe('function')
    expect(typeof Project.delete).toBe('function')
  })

  it('Issue has standard CRUD verbs', () => {
    expect(typeof Issue.create).toBe('function')
    expect(typeof Issue.get).toBe('function')
    expect(typeof Issue.find).toBe('function')
    expect(typeof Issue.update).toBe('function')
    expect(typeof Issue.delete).toBe('function')
  })

  it('Comment has standard CRUD verbs', () => {
    expect(typeof Comment.create).toBe('function')
    expect(typeof Comment.get).toBe('function')
    expect(typeof Comment.find).toBe('function')
    expect(typeof Comment.update).toBe('function')
    expect(typeof Comment.delete).toBe('function')
  })
})

// =============================================================================
// PROJECT — LIVE API CRUD
// =============================================================================

describe('@headlessly/projects — Project CRUD (live API)', () => {
  let projectId: string
  let deployed = false

  it('checks if /api/projects endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'projects')
    if (!deployed) {
      console.log('SKIP: /api/projects not yet deployed — remaining Project CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a project', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/projects`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E-Project-${testId}`,
        description: `E2E test project created by ${testId}`,
        status: 'Active',
        visibility: 'Private',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Project')
    expect(body.data.name).toBe(`E2E-Project-${testId}`)
    expect(body.data.status).toBe('Active')
    projectId = body.data.$id as string
  })

  it('retrieves the project by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/projects/${projectId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(projectId)
    expect(body.data.$type).toBe('Project')
    expect(body.data.name).toBe(`E2E-Project-${testId}`)
  })

  it('updates the project', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/projects/${projectId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E-Project-Updated-${testId}`, status: 'Archived' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.name).toBe(`E2E-Project-Updated-${testId}`)
    expect(body.data.status).toBe('Archived')
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/projects/${projectId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.name).toBe(`E2E-Project-Updated-${testId}`)
    expect(body.data.status).toBe('Archived')
  })

  it('lists projects and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/projects?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((p) => p.$id === projectId)
    expect(found).toBeDefined()
  })

  it('deletes the project', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// ISSUE — LIVE API CRUD
// =============================================================================

describe('@headlessly/projects — Issue CRUD (live API)', () => {
  let issueId: string
  let deployed = false

  it('checks if /api/issues endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'issues')
    if (!deployed) {
      console.log('SKIP: /api/issues not yet deployed — remaining Issue CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates an issue', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/issues`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        title: `E2E-Issue-${testId}`,
        description: `E2E test issue created by ${testId}`,
        status: 'Open',
        priority: 'Medium',
        type: 'Task',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Issue')
    expect(body.data.title).toBe(`E2E-Issue-${testId}`)
    expect(body.data.status).toBe('Open')
    expect(body.data.priority).toBe('Medium')
    issueId = body.data.$id as string
  })

  it('retrieves the issue by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/issues/${issueId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(issueId)
    expect(body.data.$type).toBe('Issue')
    expect(body.data.title).toBe(`E2E-Issue-${testId}`)
  })

  it('updates the issue', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/issues/${issueId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ title: `E2E-Issue-Updated-${testId}`, status: 'InProgress', priority: 'High' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.title).toBe(`E2E-Issue-Updated-${testId}`)
    expect(body.data.status).toBe('InProgress')
    expect(body.data.priority).toBe('High')
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/issues/${issueId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.title).toBe(`E2E-Issue-Updated-${testId}`)
    expect(body.data.status).toBe('InProgress')
  })

  it('lists issues and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/issues?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((i) => i.$id === issueId)
    expect(found).toBeDefined()
  })

  it('deletes the issue', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/issues/${issueId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// COMMENT — LIVE API CRUD
// =============================================================================

describe('@headlessly/projects — Comment CRUD (live API)', () => {
  let commentId: string
  let deployed = false

  it('checks if /api/comments endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'comments')
    if (!deployed) {
      console.log('SKIP: /api/comments not yet deployed — remaining Comment CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a comment', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/comments`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        body: `E2E test comment by ${testId}`,
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Comment')
    expect(body.data.body).toBe(`E2E test comment by ${testId}`)
    commentId = body.data.$id as string
  })

  it('retrieves the comment by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/comments/${commentId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(commentId)
    expect(body.data.$type).toBe('Comment')
  })

  it('updates the comment', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/comments/${commentId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ body: `E2E comment updated by ${testId}` }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.body).toBe(`E2E comment updated by ${testId}`)
  })

  it('lists comments and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/comments?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((c) => c.$id === commentId)
    expect(found).toBeDefined()
  })

  it('deletes the comment', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// META-FIELD VERIFICATION VIA crudLifecycle HELPER
// =============================================================================

describe('@headlessly/projects — meta-field verification via crudLifecycle', () => {
  it('Project: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'projects')
    if (!deployed) {
      console.log('SKIP: /api/projects not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'projects',
      { name: `E2E-Meta-Project-${testId}`, status: 'Active' },
      { name: `E2E-Meta-Project-Updated-${testId}` },
    )

    assertMetaFields(created, 'Project')
    expect(created.name).toBe(`E2E-Meta-Project-${testId}`)
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Project')
    expect(updated.$id).toBe(created.$id)
    expect(updated.name).toBe(`E2E-Meta-Project-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Issue: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'issues')
    if (!deployed) {
      console.log('SKIP: /api/issues not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'issues',
      { title: `E2E-Meta-Issue-${testId}`, status: 'Open', priority: 'Low' },
      { title: `E2E-Meta-Issue-Updated-${testId}`, priority: 'High' },
    )

    assertMetaFields(created, 'Issue')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.title).toBe(`E2E-Meta-Issue-Updated-${testId}`)
    expect(updated.priority).toBe('High')
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })

  it('Comment: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'comments')
    if (!deployed) {
      console.log('SKIP: /api/comments not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'comments',
      { body: `E2E-Meta-Comment-${testId}` },
      { body: `E2E-Meta-Comment-Updated-${testId}` },
    )

    assertMetaFields(created, 'Comment')
    expect(fetched.$id).toBe(created.$id)
    expect(updated.body).toBe(`E2E-Meta-Comment-Updated-${testId}`)
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })
})
