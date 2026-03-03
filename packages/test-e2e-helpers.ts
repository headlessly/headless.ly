/**
 * Shared E2E test helpers for @headlessly/* packages
 *
 * Tests hit live deployed endpoints — no mocks, no skips.
 * Auth via TEST_API_KEY (sk_* WorkOS key) passed as Bearer token.
 * If endpoints are unreachable, tests FAIL.
 */

import { config } from 'dotenv'
import { resolve } from 'node:path'

// Load TEST_API_KEY from .do/snippets/.env if not already in env
config({ path: resolve(import.meta.dirname, '../../.do/snippets/.env') })

const API_URL = process.env.API_URL || 'https://api.headless.ly'
const CRM_URL = process.env.CRM_URL || API_URL
const BILLING_URL = process.env.BILLING_URL || API_URL

let apiKey: string
let tenantId: string

export { API_URL, CRM_URL, BILLING_URL }

export function getSessionToken(): string {
  if (!apiKey) throw new Error('setup() must be called before getSessionToken()')
  return apiKey
}

export function getTenantId(): string {
  if (!tenantId) throw new Error('setup() must be called before getTenantId()')
  return tenantId
}

/**
 * Initialize auth for E2E tests. Call in beforeAll().
 *
 * Uses TEST_API_KEY from env (loaded from .do/snippets/.env).
 * The sk_* key is a valid WorkOS API key that the auth middleware
 * accepts via Authorization: Bearer header (grants L1 access).
 */
export async function setup(): Promise<void> {
  const key = process.env.TEST_API_KEY
  if (!key) {
    throw new Error(
      'TEST_API_KEY not set. Expected sk_* key in process.env or .do/snippets/.env',
    )
  }
  apiKey = key
  tenantId = process.env.TEST_TENANT_ID || 'default'
}

export function writeHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
}

export function readHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` }
}

export function generateTestId(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Full CRUD lifecycle test against a live endpoint.
 *
 * Creates, reads, updates, lists, and deletes an entity.
 * Returns results so the caller can make additional assertions.
 */
export async function crudLifecycle(
  baseUrl: string,
  resource: string,
  createData: Record<string, unknown>,
  updateData: Record<string, unknown>,
): Promise<{
  created: Record<string, unknown>
  fetched: Record<string, unknown>
  updated: Record<string, unknown>
  listed: Record<string, unknown>[]
  deleted: boolean
}> {
  // Create
  const createRes = await fetch(`${baseUrl}/api/${resource}`, {
    method: 'POST',
    headers: writeHeaders(),
    body: JSON.stringify(createData),
  })
  if (createRes.status !== 201) {
    const text = await createRes.text()
    throw new Error(`CREATE ${resource} failed: ${createRes.status} ${text}`)
  }
  const createBody = (await createRes.json()) as { success: boolean; data: Record<string, unknown> }
  const created = createBody.data

  // Read
  const getRes = await fetch(`${baseUrl}/api/${resource}/${created.$id}`, { headers: readHeaders() })
  if (getRes.status !== 200) throw new Error(`GET ${resource}/${created.$id} failed: ${getRes.status}`)
  const getBody = (await getRes.json()) as { data: Record<string, unknown> }
  const fetched = getBody.data

  // Update
  const putRes = await fetch(`${baseUrl}/api/${resource}/${created.$id}`, {
    method: 'PUT',
    headers: writeHeaders(),
    body: JSON.stringify(updateData),
  })
  if (putRes.status !== 200) throw new Error(`PUT ${resource}/${created.$id} failed: ${putRes.status}`)
  const putBody = (await putRes.json()) as { data: Record<string, unknown> }
  const updated = putBody.data

  // List
  const listRes = await fetch(`${baseUrl}/api/${resource}?limit=100`, { headers: readHeaders() })
  if (listRes.status !== 200) throw new Error(`LIST ${resource} failed: ${listRes.status}`)
  const listBody = (await listRes.json()) as { data: Record<string, unknown>[] }
  const listed = listBody.data

  // Delete
  const delRes = await fetch(`${baseUrl}/api/${resource}/${created.$id}`, {
    method: 'DELETE',
    headers: readHeaders(),
  })
  const deleted = delRes.status === 200

  return { created, fetched, updated, listed, deleted }
}

/**
 * Check if an API endpoint exists (returns 200 for GET).
 */
export async function endpointExists(baseUrl: string, resource: string): Promise<boolean> {
  const res = await fetch(`${baseUrl}/api/${resource}`, { headers: readHeaders() })
  return res.status === 200
}
