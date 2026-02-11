/**
 * E2E tests for @headlessly/support against live crm.headless.ly
 *
 * Tests package exports and CRUD lifecycle for Support entities:
 * Ticket.
 *
 * The /api/tickets endpoint may not yet be deployed. Tests probe the API
 * first and skip gracefully with a console message if it returns 404.
 *
 * Auth via id-org-ai provision (programmatic, no interactive login).
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Ticket } from '../src/index.ts'
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

describe('@headlessly/support — package exports', () => {
  it('exports Ticket entity', () => {
    expect(Ticket).toBeDefined()
    expect(typeof Ticket).toBe('object')
    expect(Ticket.$name).toBe('Ticket')
  })
})

// =============================================================================
// CRUD VERBS
// =============================================================================

describe('@headlessly/support — CRUD verbs', () => {
  it('Ticket has standard CRUD verbs', () => {
    expect(typeof Ticket.create).toBe('function')
    expect(typeof Ticket.get).toBe('function')
    expect(typeof Ticket.find).toBe('function')
    expect(typeof Ticket.update).toBe('function')
    expect(typeof Ticket.delete).toBe('function')
  })

  it('Ticket has custom verbs from schema', () => {
    expect(typeof Ticket.resolve).toBe('function')
    expect(typeof Ticket.escalate).toBe('function')
    expect(typeof Ticket.close).toBe('function')
    expect(typeof Ticket.reopen).toBe('function')
  })
})

// =============================================================================
// TICKET — LIVE API CRUD
// =============================================================================

describe('@headlessly/support — Ticket CRUD (live API)', () => {
  let ticketId: string
  let deployed = false

  it('checks if /api/tickets endpoint exists', async () => {
    deployed = await endpointExists(CRM_URL, 'tickets')
    if (!deployed) {
      console.log('SKIP: /api/tickets not yet deployed — remaining Ticket CRUD tests will be skipped')
    }
    expect(true).toBe(true)
  })

  it('creates a ticket', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/tickets`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        subject: `E2E-Ticket-${testId}`,
        description: `E2E test ticket created by ${testId}`,
        status: 'Open',
        priority: 'Medium',
        category: 'Bug',
        channel: 'API',
      }),
    })
    expect(res.status).toBe(201)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    assertMetaFields(body.data, 'Ticket')
    expect(body.data.subject).toBe(`E2E-Ticket-${testId}`)
    expect(body.data.status).toBe('Open')
    expect(body.data.priority).toBe('Medium')
    ticketId = body.data.$id as string
  })

  it('retrieves the ticket by id', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/tickets/${ticketId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.$id).toBe(ticketId)
    expect(body.data.$type).toBe('Ticket')
    expect(body.data.subject).toBe(`E2E-Ticket-${testId}`)
  })

  it('updates the ticket', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/tickets/${ticketId}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ subject: `E2E-Ticket-Updated-${testId}`, status: 'InProgress', priority: 'High' }),
    })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data.subject).toBe(`E2E-Ticket-Updated-${testId}`)
    expect(body.data.status).toBe('InProgress')
    expect(body.data.priority).toBe('High')
  })

  it('verifies update persisted on re-fetch', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/tickets/${ticketId}`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.subject).toBe(`E2E-Ticket-Updated-${testId}`)
    expect(body.data.status).toBe('InProgress')
    expect(body.data.priority).toBe('High')
  })

  it('lists tickets and finds the created one', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/tickets?limit=100`, { headers: readHeaders() })
    expect(res.status).toBe(200)

    const body = (await res.json()) as { success: boolean; data: Array<{ $id: string }> }
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
    const found = body.data.find((t) => t.$id === ticketId)
    expect(found).toBeDefined()
  })

  it('deletes the ticket', async () => {
    if (!deployed) return
    const res = await fetch(`${CRM_URL}/api/tickets/${ticketId}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(res.status).toBe(200)
  })
})

// =============================================================================
// META-FIELD VERIFICATION VIA crudLifecycle HELPER
// =============================================================================

describe('@headlessly/support — meta-field verification via crudLifecycle', () => {
  it('Ticket: full lifecycle returns correct meta-fields', async () => {
    const deployed = await endpointExists(CRM_URL, 'tickets')
    if (!deployed) {
      console.log('SKIP: /api/tickets not yet deployed')
      return
    }

    const { created, fetched, updated, listed, deleted } = await crudLifecycle(
      CRM_URL,
      'tickets',
      { subject: `E2E-Meta-Ticket-${testId}`, status: 'Open', priority: 'Low', channel: 'Web' },
      { subject: `E2E-Meta-Ticket-Updated-${testId}`, status: 'Resolved' },
    )

    assertMetaFields(created, 'Ticket')
    expect(created.subject).toBe(`E2E-Meta-Ticket-${testId}`)
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Ticket')
    expect(updated.$id).toBe(created.$id)
    expect(updated.subject).toBe(`E2E-Meta-Ticket-Updated-${testId}`)
    expect(updated.status).toBe('Resolved')
    expect(listed.find((e) => e.$id === created.$id)).toBeDefined()
    expect(deleted).toBe(true)
  })
})
