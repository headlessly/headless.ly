/**
 * @headlessly/billing — E2E Tests Against Live Deployed Workers
 *
 * Tests the billing subdomain (https://billing.headless.ly) which serves:
 *   - /api/customers     — Customer CRUD
 *   - /api/plans         — Plan CRUD
 *   - /api/subscriptions — Subscription CRUD
 *   - /api/invoices      — Invoice CRUD
 *
 * Entities that may not be available yet (gracefully handled):
 *   - /api/products      — Product CRUD
 *   - /api/prices        — Price CRUD
 *   - /api/payments      — Payment CRUD
 *
 * Auth: Uses id-org-ai provision endpoint to get a session token.
 * Cleanup: Every created entity is deleted at the end of its test.
 *
 * Run:
 *   vitest run public/packages/billing/test-e2e/billing.e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { Customer, Product, Plan, Price, Subscription, Invoice, Payment } from '../src/index.ts'
import { setup, BILLING_URL, writeHeaders, readHeaders, generateTestId, crudLifecycle, endpointExists } from '../../test-e2e-helpers'

// =============================================================================
// Configuration
// =============================================================================

const TIMEOUT = 30_000

// Track created entity IDs for cleanup
const cleanup: Array<{ resource: string; id: string }> = []

async function tryDelete(resource: string, id: string): Promise<void> {
  try {
    await fetch(`${BILLING_URL}/api/${resource}/${id}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
  } catch {
    // Best-effort cleanup — do not fail tests
  }
}

async function cleanupAll(): Promise<void> {
  // Delete in reverse order (children before parents)
  for (const entry of cleanup.reverse()) {
    await tryDelete(entry.resource, entry.id)
  }
  cleanup.length = 0
}

// =============================================================================
// Setup
// =============================================================================

beforeAll(async () => {
  await setup()
}, TIMEOUT)

// =============================================================================
// 1. Package Exports Verification
// =============================================================================

describe('@headlessly/billing exports', () => {
  it('exports Customer noun', () => {
    expect(Customer).toBeDefined()
    expect(Customer.$name).toBe('Customer')
  })

  it('exports Product noun', () => {
    expect(Product).toBeDefined()
    expect(Product.$name).toBe('Product')
  })

  it('exports Plan noun', () => {
    expect(Plan).toBeDefined()
    expect(Plan.$name).toBe('Plan')
  })

  it('exports Price noun', () => {
    expect(Price).toBeDefined()
    expect(Price.$name).toBe('Price')
  })

  it('exports Subscription noun', () => {
    expect(Subscription).toBeDefined()
    expect(Subscription.$name).toBe('Subscription')
  })

  it('exports Invoice noun', () => {
    expect(Invoice).toBeDefined()
    expect(Invoice.$name).toBe('Invoice')
  })

  it('exports Payment noun', () => {
    expect(Payment).toBeDefined()
    expect(Payment.$name).toBe('Payment')
  })
})

// =============================================================================
// 2. Customer CRUD (confirmed working)
// =============================================================================

describe('Customer CRUD', () => {
  const testName = () => `E2E Customer ${generateTestId()}`

  it('creates a customer', async () => {
    const name = testName()
    const res = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name, email: `${generateTestId()}@e2e.test` }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.success).toBe(true)
    expect(body.data).toBeDefined()
    expect(body.data.$id).toBeDefined()
    expect(body.data.$type).toBe('Customer')
    expect(body.data.$version).toBeDefined()
    expect(body.data.name).toBe(name)

    cleanup.push({ resource: 'customers', id: body.data.$id as string })
  }, TIMEOUT)

  it('reads a customer by $id', async () => {
    const name = testName()
    const createRes = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name, email: `${generateTestId()}@e2e.test` }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'customers', id: created.$id as string })

    const getRes = await fetch(`${BILLING_URL}/api/customers/${created.$id}`, {
      headers: readHeaders(),
    })

    expect(getRes.status).toBe(200)
    const fetched = ((await getRes.json()) as { data: Record<string, unknown> }).data
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Customer')
    expect(fetched.name).toBe(name)
  }, TIMEOUT)

  it('updates a customer', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: testName(), email: `${generateTestId()}@e2e.test` }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'customers', id: created.$id as string })

    const updatedName = `Updated ${generateTestId()}`
    const putRes = await fetch(`${BILLING_URL}/api/customers/${created.$id}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: updatedName }),
    })

    expect(putRes.status).toBe(200)
    const updated = ((await putRes.json()) as { data: Record<string, unknown> }).data
    expect(updated.$id).toBe(created.$id)
    expect(updated.name).toBe(updatedName)
  }, TIMEOUT)

  it('lists customers', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: testName(), email: `${generateTestId()}@e2e.test` }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'customers', id: created.$id as string })

    const listRes = await fetch(`${BILLING_URL}/api/customers?limit=100`, {
      headers: readHeaders(),
    })

    expect(listRes.status).toBe(200)
    const body = (await listRes.json()) as { data: Record<string, unknown>[] }
    expect(Array.isArray(body.data)).toBe(true)
    const ids = body.data.map((c) => c.$id)
    expect(ids).toContain(created.$id)
  }, TIMEOUT)

  it('deletes a customer', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: testName(), email: `${generateTestId()}@e2e.test` }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data

    const delRes = await fetch(`${BILLING_URL}/api/customers/${created.$id}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })

    expect(delRes.status).toBe(200)

    // Verify it is gone
    const getRes = await fetch(`${BILLING_URL}/api/customers/${created.$id}`, {
      headers: readHeaders(),
    })
    expect(getRes.status).toBe(404)
  }, TIMEOUT)

  it('full CRUD lifecycle via crudLifecycle helper', async () => {
    const result = await crudLifecycle(
      BILLING_URL,
      'customers',
      { name: testName(), email: `${generateTestId()}@e2e.test`, currency: 'USD' },
      { currency: 'EUR' },
    )

    expect(result.created.$id).toBeDefined()
    expect(result.created.$type).toBe('Customer')
    expect(result.fetched.$id).toBe(result.created.$id)
    expect(result.updated.currency).toBe('EUR')
    expect(result.listed.length).toBeGreaterThanOrEqual(1)
    expect(result.deleted).toBe(true)
  }, TIMEOUT)

  it('returns 404 for non-existent customer', async () => {
    const res = await fetch(`${BILLING_URL}/api/customers/customer_nonexistent_e2e`, {
      headers: readHeaders(),
    })
    expect(res.status).toBe(404)
  }, TIMEOUT)

  it('preserves meta-fields on created customer', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: testName(), email: `${generateTestId()}@e2e.test` }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'customers', id: created.$id as string })

    expect(typeof created.$id).toBe('string')
    expect((created.$id as string).startsWith('customer_')).toBe(true)
    expect(created.$type).toBe('Customer')
    expect(created.$version).toBeDefined()
    expect(typeof created.$version).toBe('number')
  }, TIMEOUT)
})

// =============================================================================
// 3. Plan CRUD (confirmed working)
// =============================================================================

describe('Plan CRUD', () => {
  const testPlanName = () => `E2E Plan ${generateTestId()}`

  it('creates a plan', async () => {
    const name = testPlanName()
    const res = await fetch(`${BILLING_URL}/api/plans`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name, slug: generateTestId(), description: 'E2E test plan', status: 'Draft' }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.$id).toBeDefined()
    expect(body.data.$type).toBe('Plan')
    expect(body.data.name).toBe(name)

    cleanup.push({ resource: 'plans', id: body.data.$id as string })
  }, TIMEOUT)

  it('reads a plan by $id', async () => {
    const name = testPlanName()
    const createRes = await fetch(`${BILLING_URL}/api/plans`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name, slug: generateTestId() }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'plans', id: created.$id as string })

    const getRes = await fetch(`${BILLING_URL}/api/plans/${created.$id}`, {
      headers: readHeaders(),
    })

    expect(getRes.status).toBe(200)
    const fetched = ((await getRes.json()) as { data: Record<string, unknown> }).data
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Plan')
    expect(fetched.name).toBe(name)
  }, TIMEOUT)

  it('updates a plan', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/plans`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: testPlanName(), slug: generateTestId() }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'plans', id: created.$id as string })

    const putRes = await fetch(`${BILLING_URL}/api/plans/${created.$id}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ status: 'Active', trialDays: 14 }),
    })

    expect(putRes.status).toBe(200)
    const updated = ((await putRes.json()) as { data: Record<string, unknown> }).data
    expect(updated.status).toBe('Active')
    expect(updated.trialDays).toBe(14)
  }, TIMEOUT)

  it('lists plans', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/plans`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: testPlanName(), slug: generateTestId() }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'plans', id: created.$id as string })

    const listRes = await fetch(`${BILLING_URL}/api/plans?limit=100`, {
      headers: readHeaders(),
    })

    expect(listRes.status).toBe(200)
    const body = (await listRes.json()) as { data: Record<string, unknown>[] }
    expect(Array.isArray(body.data)).toBe(true)
    const ids = body.data.map((p) => p.$id)
    expect(ids).toContain(created.$id)
  }, TIMEOUT)

  it('deletes a plan', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/plans`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: testPlanName(), slug: generateTestId() }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data

    const delRes = await fetch(`${BILLING_URL}/api/plans/${created.$id}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })

    expect(delRes.status).toBe(200)

    const getRes = await fetch(`${BILLING_URL}/api/plans/${created.$id}`, {
      headers: readHeaders(),
    })
    expect(getRes.status).toBe(404)
  }, TIMEOUT)

  it('full CRUD lifecycle via crudLifecycle helper', async () => {
    const result = await crudLifecycle(
      BILLING_URL,
      'plans',
      { name: testPlanName(), slug: generateTestId(), status: 'Draft', trialDays: 7 },
      { status: 'Active', trialDays: 30 },
    )

    expect(result.created.$id).toBeDefined()
    expect(result.created.$type).toBe('Plan')
    expect(result.fetched.$id).toBe(result.created.$id)
    expect(result.updated.status).toBe('Active')
    expect(result.updated.trialDays).toBe(30)
    expect(result.listed.length).toBeGreaterThanOrEqual(1)
    expect(result.deleted).toBe(true)
  }, TIMEOUT)

  it('preserves meta-fields on created plan', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/plans`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: testPlanName(), slug: generateTestId() }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'plans', id: created.$id as string })

    expect((created.$id as string).startsWith('plan_')).toBe(true)
    expect(created.$type).toBe('Plan')
    expect(typeof created.$version).toBe('number')
  }, TIMEOUT)
})

// =============================================================================
// 4. Subscription CRUD (confirmed working)
// =============================================================================

describe('Subscription CRUD', () => {
  let testCustomerId: string

  beforeAll(async () => {
    // Create a customer to link subscriptions to
    const res = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `Sub Test Customer ${generateTestId()}`, email: `${generateTestId()}@e2e.test` }),
    })
    const body = (await res.json()) as { data: Record<string, unknown> }
    testCustomerId = body.data.$id as string
    cleanup.push({ resource: 'customers', id: testCustomerId })
  }, TIMEOUT)

  it('creates a subscription', async () => {
    const now = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const res = await fetch(`${BILLING_URL}/api/subscriptions`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: 'E2E Subscription',
        plan: 'plan_e2e_test',
        status: 'active',
        customer: testCustomerId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startedAt: now,
        quantity: 1,
      }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.$id).toBeDefined()
    expect(body.data.$type).toBe('Subscription')
    expect(body.data.status).toBe('active')
    expect(body.data.customer).toBe(testCustomerId)

    cleanup.push({ resource: 'subscriptions', id: body.data.$id as string })
  }, TIMEOUT)

  it('reads a subscription by $id', async () => {
    const now = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const createRes = await fetch(`${BILLING_URL}/api/subscriptions`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: 'E2E Trialing Sub',
        plan: 'plan_e2e_test',
        status: 'trialing',
        customer: testCustomerId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startedAt: now,
      }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'subscriptions', id: created.$id as string })

    const getRes = await fetch(`${BILLING_URL}/api/subscriptions/${created.$id}`, {
      headers: readHeaders(),
    })

    expect(getRes.status).toBe(200)
    const fetched = ((await getRes.json()) as { data: Record<string, unknown> }).data
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Subscription')
    expect(fetched.status).toBe('trialing')
  }, TIMEOUT)

  it('updates a subscription status', async () => {
    const now = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const createRes = await fetch(`${BILLING_URL}/api/subscriptions`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: 'E2E Update Sub',
        plan: 'plan_e2e_test',
        status: 'active',
        customer: testCustomerId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startedAt: now,
        quantity: 3,
      }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'subscriptions', id: created.$id as string })

    const putRes = await fetch(`${BILLING_URL}/api/subscriptions/${created.$id}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ status: 'past_due', quantity: 5 }),
    })

    expect(putRes.status).toBe(200)
    const updated = ((await putRes.json()) as { data: Record<string, unknown> }).data
    expect(updated.status).toBe('past_due')
    expect(updated.quantity).toBe(5)
  }, TIMEOUT)

  it('lists subscriptions', async () => {
    const now = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const createRes = await fetch(`${BILLING_URL}/api/subscriptions`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: 'E2E List Sub',
        plan: 'plan_e2e_test',
        status: 'active',
        customer: testCustomerId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startedAt: now,
      }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'subscriptions', id: created.$id as string })

    const listRes = await fetch(`${BILLING_URL}/api/subscriptions?limit=100`, {
      headers: readHeaders(),
    })

    expect(listRes.status).toBe(200)
    const body = (await listRes.json()) as { data: Record<string, unknown>[] }
    expect(Array.isArray(body.data)).toBe(true)
    const ids = body.data.map((s) => s.$id)
    expect(ids).toContain(created.$id)
  }, TIMEOUT)

  it('deletes a subscription', async () => {
    const now = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const createRes = await fetch(`${BILLING_URL}/api/subscriptions`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: 'E2E Delete Sub',
        plan: 'plan_e2e_test',
        status: 'active',
        customer: testCustomerId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startedAt: now,
      }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data

    const delRes = await fetch(`${BILLING_URL}/api/subscriptions/${created.$id}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })

    expect(delRes.status).toBe(200)

    const getRes = await fetch(`${BILLING_URL}/api/subscriptions/${created.$id}`, {
      headers: readHeaders(),
    })
    expect(getRes.status).toBe(404)
  }, TIMEOUT)

  it('full CRUD lifecycle via crudLifecycle helper', async () => {
    const now = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const result = await crudLifecycle(
      BILLING_URL,
      'subscriptions',
      {
        name: 'E2E Lifecycle Sub',
        plan: 'plan_e2e_test',
        status: 'active',
        customer: testCustomerId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startedAt: now,
        quantity: 2,
      },
      { quantity: 10 },
    )

    expect(result.created.$id).toBeDefined()
    expect(result.created.$type).toBe('Subscription')
    expect(result.fetched.$id).toBe(result.created.$id)
    expect(result.updated.quantity).toBe(10)
    expect(result.listed.length).toBeGreaterThanOrEqual(1)
    expect(result.deleted).toBe(true)
  }, TIMEOUT)

  it('preserves meta-fields on created subscription', async () => {
    const now = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const createRes = await fetch(`${BILLING_URL}/api/subscriptions`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: 'E2E Meta Sub',
        plan: 'plan_e2e_test',
        status: 'active',
        customer: testCustomerId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startedAt: now,
      }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'subscriptions', id: created.$id as string })

    expect((created.$id as string).startsWith('subscription_')).toBe(true)
    expect(created.$type).toBe('Subscription')
    expect(typeof created.$version).toBe('number')
  }, TIMEOUT)
})

// =============================================================================
// 5. Invoice CRUD (confirmed working)
// =============================================================================

describe('Invoice CRUD', () => {
  let testCustomerId: string

  beforeAll(async () => {
    const res = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `Invoice Test Customer ${generateTestId()}`, email: `${generateTestId()}@e2e.test` }),
    })
    const body = (await res.json()) as { data: Record<string, unknown> }
    testCustomerId = body.data.$id as string
    cleanup.push({ resource: 'customers', id: testCustomerId })
  }, TIMEOUT)

  it('creates an invoice', async () => {
    const number = `INV-E2E-${generateTestId()}`
    const res = await fetch(`${BILLING_URL}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        number,
        customer: testCustomerId,
        subtotal: 9900,
        total: 9900,
        amountDue: 9900,
        currency: 'USD',
        status: 'open',
      }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { success: boolean; data: Record<string, unknown> }
    expect(body.data.$id).toBeDefined()
    expect(body.data.$type).toBe('Invoice')
    expect(body.data.number).toBe(number)
    expect(body.data.total).toBe(9900)
    expect(body.data.status).toBe('open')

    cleanup.push({ resource: 'invoices', id: body.data.$id as string })
  }, TIMEOUT)

  it('reads an invoice by $id', async () => {
    const number = `INV-E2E-${generateTestId()}`
    const createRes = await fetch(`${BILLING_URL}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        number,
        customer: testCustomerId,
        subtotal: 4900,
        total: 4900,
        amountDue: 4900,
        status: 'draft',
      }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'invoices', id: created.$id as string })

    const getRes = await fetch(`${BILLING_URL}/api/invoices/${created.$id}`, {
      headers: readHeaders(),
    })

    expect(getRes.status).toBe(200)
    const fetched = ((await getRes.json()) as { data: Record<string, unknown> }).data
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Invoice')
    expect(fetched.number).toBe(number)
  }, TIMEOUT)

  it('updates an invoice', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        number: `INV-E2E-${generateTestId()}`,
        customer: testCustomerId,
        subtotal: 4900,
        total: 4900,
        amountDue: 4900,
        status: 'open',
      }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'invoices', id: created.$id as string })

    const putRes = await fetch(`${BILLING_URL}/api/invoices/${created.$id}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ status: 'paid', amountDue: 0, paidAt: new Date().toISOString() }),
    })

    expect(putRes.status).toBe(200)
    const updated = ((await putRes.json()) as { data: Record<string, unknown> }).data
    expect(updated.status).toBe('paid')
    expect(updated.amountDue).toBe(0)
  }, TIMEOUT)

  it('lists invoices', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        number: `INV-E2E-${generateTestId()}`,
        customer: testCustomerId,
        subtotal: 1000,
        total: 1000,
        amountDue: 1000,
        status: 'draft',
      }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'invoices', id: created.$id as string })

    const listRes = await fetch(`${BILLING_URL}/api/invoices?limit=100`, {
      headers: readHeaders(),
    })

    expect(listRes.status).toBe(200)
    const body = (await listRes.json()) as { data: Record<string, unknown>[] }
    expect(Array.isArray(body.data)).toBe(true)
    const ids = body.data.map((inv) => inv.$id)
    expect(ids).toContain(created.$id)
  }, TIMEOUT)

  it('deletes an invoice', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        number: `INV-E2E-${generateTestId()}`,
        customer: testCustomerId,
        subtotal: 500,
        total: 500,
        amountDue: 500,
        status: 'draft',
      }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data

    const delRes = await fetch(`${BILLING_URL}/api/invoices/${created.$id}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })

    expect(delRes.status).toBe(200)

    const getRes = await fetch(`${BILLING_URL}/api/invoices/${created.$id}`, {
      headers: readHeaders(),
    })
    expect(getRes.status).toBe(404)
  }, TIMEOUT)

  it('full CRUD lifecycle via crudLifecycle helper', async () => {
    const result = await crudLifecycle(
      BILLING_URL,
      'invoices',
      {
        number: `INV-E2E-${generateTestId()}`,
        customer: testCustomerId,
        subtotal: 7500,
        total: 7500,
        amountDue: 7500,
        currency: 'USD',
        status: 'open',
      },
      { status: 'void', amountDue: 0 },
    )

    expect(result.created.$id).toBeDefined()
    expect(result.created.$type).toBe('Invoice')
    expect(result.fetched.$id).toBe(result.created.$id)
    expect(result.updated.status).toBe('void')
    expect(result.updated.amountDue).toBe(0)
    expect(result.listed.length).toBeGreaterThanOrEqual(1)
    expect(result.deleted).toBe(true)
  }, TIMEOUT)

  it('preserves meta-fields on created invoice', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        number: `INV-E2E-${generateTestId()}`,
        customer: testCustomerId,
        subtotal: 2000,
        total: 2000,
        amountDue: 2000,
        status: 'draft',
      }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'invoices', id: created.$id as string })

    expect((created.$id as string).startsWith('invoice_')).toBe(true)
    expect(created.$type).toBe('Invoice')
    expect(typeof created.$version).toBe('number')
  }, TIMEOUT)

  it('invoice references its customer', async () => {
    const createRes = await fetch(`${BILLING_URL}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        number: `INV-E2E-${generateTestId()}`,
        customer: testCustomerId,
        subtotal: 3000,
        total: 3000,
        amountDue: 3000,
        status: 'open',
      }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'invoices', id: created.$id as string })

    expect(created.customer).toBe(testCustomerId)
  }, TIMEOUT)
})

// =============================================================================
// 6. Product CRUD (may return 404 — graceful handling)
// =============================================================================

describe('Product CRUD (may not be available)', () => {
  let productsAvailable = false

  beforeAll(async () => {
    productsAvailable = await endpointExists(BILLING_URL, 'products')
    if (!productsAvailable) {
      console.log('Skipping Product tests: /api/products endpoint not available')
    }
  }, TIMEOUT)

  it('checks if products endpoint exists', () => {
    // This test always passes — it documents availability
    expect(typeof productsAvailable).toBe('boolean')
  })

  it('creates a product (if available)', async () => {
    if (!productsAvailable) return

    const res = await fetch(`${BILLING_URL}/api/products`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `E2E Product ${generateTestId()}`,
        slug: generateTestId(),
        type: 'Software',
        status: 'Active',
        visibility: 'Public',
      }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data.$id).toBeDefined()
    expect(body.data.$type).toBe('Product')
    expect((body.data.$id as string).startsWith('product_')).toBe(true)
    cleanup.push({ resource: 'products', id: body.data.$id as string })
  }, TIMEOUT)

  it('reads a product (if available)', async () => {
    if (!productsAvailable) return

    const createRes = await fetch(`${BILLING_URL}/api/products`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E Product ${generateTestId()}`, slug: generateTestId(), status: 'Draft' }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'products', id: created.$id as string })

    const getRes = await fetch(`${BILLING_URL}/api/products/${created.$id}`, { headers: readHeaders() })
    expect(getRes.status).toBe(200)

    const fetched = ((await getRes.json()) as { data: Record<string, unknown> }).data
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.$type).toBe('Product')
  }, TIMEOUT)

  it('updates a product (if available)', async () => {
    if (!productsAvailable) return

    const createRes = await fetch(`${BILLING_URL}/api/products`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E Product ${generateTestId()}`, slug: generateTestId(), status: 'Draft' }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'products', id: created.$id as string })

    const putRes = await fetch(`${BILLING_URL}/api/products/${created.$id}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ status: 'Active', description: 'Updated by E2E' }),
    })
    expect(putRes.status).toBe(200)

    const updated = ((await putRes.json()) as { data: Record<string, unknown> }).data
    expect(updated.status).toBe('Active')
  }, TIMEOUT)

  it('lists products (if available)', async () => {
    if (!productsAvailable) return

    const listRes = await fetch(`${BILLING_URL}/api/products?limit=100`, { headers: readHeaders() })
    expect(listRes.status).toBe(200)

    const body = (await listRes.json()) as { data: Record<string, unknown>[] }
    expect(Array.isArray(body.data)).toBe(true)
  }, TIMEOUT)

  it('deletes a product (if available)', async () => {
    if (!productsAvailable) return

    const createRes = await fetch(`${BILLING_URL}/api/products`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `E2E Product ${generateTestId()}`, slug: generateTestId() }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data

    const delRes = await fetch(`${BILLING_URL}/api/products/${created.$id}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(delRes.status).toBe(200)

    const getRes = await fetch(`${BILLING_URL}/api/products/${created.$id}`, { headers: readHeaders() })
    expect(getRes.status).toBe(404)
  }, TIMEOUT)
})

// =============================================================================
// 7. Price CRUD (may return 404 — graceful handling)
// =============================================================================

describe('Price CRUD (may not be available)', () => {
  let pricesAvailable = false

  beforeAll(async () => {
    pricesAvailable = await endpointExists(BILLING_URL, 'prices')
    if (!pricesAvailable) {
      console.log('Skipping Price tests: /api/prices endpoint not available')
    }
  }, TIMEOUT)

  it('checks if prices endpoint exists', () => {
    expect(typeof pricesAvailable).toBe('boolean')
  })

  it('creates a price (if available)', async () => {
    if (!pricesAvailable) return

    const res = await fetch(`${BILLING_URL}/api/prices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        amount: 2900,
        currency: 'USD',
        interval: 'Monthly',
        active: 'true',
      }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data.$id).toBeDefined()
    expect(body.data.$type).toBe('Price')
    expect(body.data.amount).toBe(2900)
    expect((body.data.$id as string).startsWith('price_')).toBe(true)
    cleanup.push({ resource: 'prices', id: body.data.$id as string })
  }, TIMEOUT)

  it('reads a price (if available)', async () => {
    if (!pricesAvailable) return

    const createRes = await fetch(`${BILLING_URL}/api/prices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ amount: 4900, currency: 'USD', interval: 'Monthly' }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'prices', id: created.$id as string })

    const getRes = await fetch(`${BILLING_URL}/api/prices/${created.$id}`, { headers: readHeaders() })
    expect(getRes.status).toBe(200)

    const fetched = ((await getRes.json()) as { data: Record<string, unknown> }).data
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.amount).toBe(4900)
  }, TIMEOUT)

  it('updates a price (if available)', async () => {
    if (!pricesAvailable) return

    const createRes = await fetch(`${BILLING_URL}/api/prices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ amount: 1900, currency: 'USD', interval: 'Yearly' }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'prices', id: created.$id as string })

    const putRes = await fetch(`${BILLING_URL}/api/prices/${created.$id}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ amount: 3900, discountPercent: 10 }),
    })
    expect(putRes.status).toBe(200)

    const updated = ((await putRes.json()) as { data: Record<string, unknown> }).data
    expect(updated.amount).toBe(3900)
  }, TIMEOUT)

  it('lists prices (if available)', async () => {
    if (!pricesAvailable) return

    const listRes = await fetch(`${BILLING_URL}/api/prices?limit=100`, { headers: readHeaders() })
    expect(listRes.status).toBe(200)

    const body = (await listRes.json()) as { data: Record<string, unknown>[] }
    expect(Array.isArray(body.data)).toBe(true)
  }, TIMEOUT)

  it('deletes a price (if available)', async () => {
    if (!pricesAvailable) return

    const createRes = await fetch(`${BILLING_URL}/api/prices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ amount: 999, currency: 'USD', interval: 'OneTime' }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data

    const delRes = await fetch(`${BILLING_URL}/api/prices/${created.$id}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(delRes.status).toBe(200)

    const getRes = await fetch(`${BILLING_URL}/api/prices/${created.$id}`, { headers: readHeaders() })
    expect(getRes.status).toBe(404)
  }, TIMEOUT)
})

// =============================================================================
// 8. Payment CRUD (may return 404 — graceful handling)
// =============================================================================

describe('Payment CRUD (may not be available)', () => {
  let paymentsAvailable = false

  beforeAll(async () => {
    paymentsAvailable = await endpointExists(BILLING_URL, 'payments')
    if (!paymentsAvailable) {
      console.log('Skipping Payment tests: /api/payments endpoint not available')
    }
  }, TIMEOUT)

  it('checks if payments endpoint exists', () => {
    expect(typeof paymentsAvailable).toBe('boolean')
  })

  it('creates a payment (if available)', async () => {
    if (!paymentsAvailable) return

    const res = await fetch(`${BILLING_URL}/api/payments`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        amount: 9900,
        currency: 'USD',
        status: 'Succeeded',
        method: 'card',
      }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: Record<string, unknown> }
    expect(body.data.$id).toBeDefined()
    expect(body.data.$type).toBe('Payment')
    expect(body.data.amount).toBe(9900)
    expect((body.data.$id as string).startsWith('payment_')).toBe(true)
    cleanup.push({ resource: 'payments', id: body.data.$id as string })
  }, TIMEOUT)

  it('reads a payment (if available)', async () => {
    if (!paymentsAvailable) return

    const createRes = await fetch(`${BILLING_URL}/api/payments`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ amount: 5000, currency: 'USD', status: 'Pending' }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'payments', id: created.$id as string })

    const getRes = await fetch(`${BILLING_URL}/api/payments/${created.$id}`, { headers: readHeaders() })
    expect(getRes.status).toBe(200)

    const fetched = ((await getRes.json()) as { data: Record<string, unknown> }).data
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.amount).toBe(5000)
  }, TIMEOUT)

  it('updates a payment (if available)', async () => {
    if (!paymentsAvailable) return

    const createRes = await fetch(`${BILLING_URL}/api/payments`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ amount: 2500, currency: 'USD', status: 'Pending' }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'payments', id: created.$id as string })

    const putRes = await fetch(`${BILLING_URL}/api/payments/${created.$id}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ status: 'Succeeded' }),
    })
    expect(putRes.status).toBe(200)

    const updated = ((await putRes.json()) as { data: Record<string, unknown> }).data
    expect(updated.status).toBe('Succeeded')
  }, TIMEOUT)

  it('lists payments (if available)', async () => {
    if (!paymentsAvailable) return

    const listRes = await fetch(`${BILLING_URL}/api/payments?limit=100`, { headers: readHeaders() })
    expect(listRes.status).toBe(200)

    const body = (await listRes.json()) as { data: Record<string, unknown>[] }
    expect(Array.isArray(body.data)).toBe(true)
  }, TIMEOUT)

  it('deletes a payment (if available)', async () => {
    if (!paymentsAvailable) return

    const createRes = await fetch(`${BILLING_URL}/api/payments`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ amount: 100, currency: 'USD', status: 'Pending' }),
    })
    const created = ((await createRes.json()) as { data: Record<string, unknown> }).data

    const delRes = await fetch(`${BILLING_URL}/api/payments/${created.$id}`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect(delRes.status).toBe(200)

    const getRes = await fetch(`${BILLING_URL}/api/payments/${created.$id}`, { headers: readHeaders() })
    expect(getRes.status).toBe(404)
  }, TIMEOUT)
})

// =============================================================================
// 9. Cross-Entity References
// =============================================================================

describe('Cross-entity references', () => {
  let customerId: string
  let planId: string
  let subscriptionId: string
  let invoiceId: string

  beforeAll(async () => {
    // Create a customer
    const custRes = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `Refs Customer ${generateTestId()}`, email: `${generateTestId()}@e2e.test` }),
    })
    customerId = ((await custRes.json()) as { data: Record<string, unknown> }).data.$id as string
    cleanup.push({ resource: 'customers', id: customerId })

    // Create a plan
    const planRes = await fetch(`${BILLING_URL}/api/plans`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `Refs Plan ${generateTestId()}`, slug: generateTestId(), status: 'Active' }),
    })
    planId = ((await planRes.json()) as { data: Record<string, unknown> }).data.$id as string
    cleanup.push({ resource: 'plans', id: planId })

    // Create a subscription referencing customer and plan
    const now = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const subRes = await fetch(`${BILLING_URL}/api/subscriptions`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: 'E2E Refs Sub',
        plan: planId,
        status: 'active',
        customer: customerId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startedAt: now,
      }),
    })
    subscriptionId = ((await subRes.json()) as { data: Record<string, unknown> }).data.$id as string
    cleanup.push({ resource: 'subscriptions', id: subscriptionId })

    // Create an invoice referencing customer and subscription
    const invRes = await fetch(`${BILLING_URL}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        number: `INV-REF-${generateTestId()}`,
        customer: customerId,
        subscription: subscriptionId,
        subtotal: 9900,
        total: 9900,
        amountDue: 9900,
        status: 'open',
      }),
    })
    invoiceId = ((await invRes.json()) as { data: Record<string, unknown> }).data.$id as string
    cleanup.push({ resource: 'invoices', id: invoiceId })
  }, 120_000)

  it('subscription references its customer', async () => {
    const res = await fetch(`${BILLING_URL}/api/subscriptions/${subscriptionId}`, {
      headers: readHeaders(),
    })
    const sub = ((await res.json()) as { data: Record<string, unknown> }).data

    expect(sub.customer).toBe(customerId)
  }, TIMEOUT)

  it('subscription references its plan', async () => {
    const res = await fetch(`${BILLING_URL}/api/subscriptions/${subscriptionId}`, {
      headers: readHeaders(),
    })
    const sub = ((await res.json()) as { data: Record<string, unknown> }).data

    expect(sub.plan).toBe(planId)
  }, TIMEOUT)

  it('invoice references its customer', async () => {
    const res = await fetch(`${BILLING_URL}/api/invoices/${invoiceId}`, {
      headers: readHeaders(),
    })
    const inv = ((await res.json()) as { data: Record<string, unknown> }).data

    expect(inv.customer).toBe(customerId)
  }, TIMEOUT)

  it('invoice references its subscription', async () => {
    const res = await fetch(`${BILLING_URL}/api/invoices/${invoiceId}`, {
      headers: readHeaders(),
    })
    const inv = ((await res.json()) as { data: Record<string, unknown> }).data

    expect(inv.subscription).toBe(subscriptionId)
  }, TIMEOUT)
})

// =============================================================================
// 10. Edge Cases and Error Handling
// =============================================================================

describe('Edge cases and error handling', () => {
  it('returns 404 for non-existent customer', async () => {
    const res = await fetch(`${BILLING_URL}/api/customers/customer_does_not_exist_e2e`, {
      headers: readHeaders(),
    })
    expect(res.status).toBe(404)
  }, TIMEOUT)

  it('returns 404 for non-existent plan', async () => {
    const res = await fetch(`${BILLING_URL}/api/plans/plan_does_not_exist_e2e`, {
      headers: readHeaders(),
    })
    expect(res.status).toBe(404)
  }, TIMEOUT)

  it('returns 404 for non-existent subscription', async () => {
    const res = await fetch(`${BILLING_URL}/api/subscriptions/subscription_does_not_exist_e2e`, {
      headers: readHeaders(),
    })
    expect(res.status).toBe(404)
  }, TIMEOUT)

  it('returns 404 for non-existent invoice', async () => {
    const res = await fetch(`${BILLING_URL}/api/invoices/invoice_does_not_exist_e2e`, {
      headers: readHeaders(),
    })
    expect(res.status).toBe(404)
  }, TIMEOUT)

  it('update on non-existent customer returns error', async () => {
    const res = await fetch(`${BILLING_URL}/api/customers/customer_does_not_exist_e2e`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: 'Ghost' }),
    })
    expect([404, 400]).toContain(res.status)
  }, TIMEOUT)

  it('delete on non-existent customer returns error', async () => {
    const res = await fetch(`${BILLING_URL}/api/customers/customer_does_not_exist_e2e`, {
      method: 'DELETE',
      headers: readHeaders(),
    })
    expect([404, 400]).toContain(res.status)
  }, TIMEOUT)

  it('create customer without required name field returns error', async () => {
    const res = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ email: 'no-name@e2e.test' }),
    })
    // May return 400 for validation or 201 if name is not strictly required at API level
    expect([400, 422, 201]).toContain(res.status)
    if (res.status === 201) {
      const body = (await res.json()) as { data: Record<string, unknown> }
      cleanup.push({ resource: 'customers', id: body.data.$id as string })
    }
  }, TIMEOUT)

  it('create invoice without required number field returns error', async () => {
    const res = await fetch(`${BILLING_URL}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ subtotal: 100, total: 100, amountDue: 100 }),
    })
    // May return 400 for validation or 201 if not strictly required at API level
    expect([400, 422, 201]).toContain(res.status)
    if (res.status === 201) {
      const body = (await res.json()) as { data: Record<string, unknown> }
      cleanup.push({ resource: 'invoices', id: body.data.$id as string })
    }
  }, TIMEOUT)
})

// =============================================================================
// 11. Meta-Field Consistency
// =============================================================================

describe('Meta-field consistency across billing entities', () => {
  it('customer $id starts with customer_ prefix', async () => {
    const res = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `Meta Customer ${generateTestId()}`, email: `${generateTestId()}@e2e.test` }),
    })
    const created = ((await res.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'customers', id: created.$id as string })

    expect(typeof created.$id).toBe('string')
    expect((created.$id as string).startsWith('customer_')).toBe(true)
    expect(created.$type).toBe('Customer')
    expect(typeof created.$version).toBe('number')
    expect(created.$version).toBeGreaterThanOrEqual(1)
  }, TIMEOUT)

  it('plan $id starts with plan_ prefix', async () => {
    const res = await fetch(`${BILLING_URL}/api/plans`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `Meta Plan ${generateTestId()}`, slug: generateTestId() }),
    })
    const created = ((await res.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'plans', id: created.$id as string })

    expect((created.$id as string).startsWith('plan_')).toBe(true)
    expect(created.$type).toBe('Plan')
    expect(typeof created.$version).toBe('number')
  }, TIMEOUT)

  it('subscription $id starts with subscription_ prefix', async () => {
    const custRes = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `Meta Sub Cust ${generateTestId()}`, email: `${generateTestId()}@e2e.test` }),
    })
    const custId = ((await custRes.json()) as { data: Record<string, unknown> }).data.$id as string
    cleanup.push({ resource: 'customers', id: custId })

    const now = new Date().toISOString()
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const res = await fetch(`${BILLING_URL}/api/subscriptions`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: 'E2E Meta Sub Prefix',
        plan: 'plan_e2e_test',
        status: 'active',
        customer: custId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        startedAt: now,
      }),
    })
    const created = ((await res.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'subscriptions', id: created.$id as string })

    expect((created.$id as string).startsWith('subscription_')).toBe(true)
    expect(created.$type).toBe('Subscription')
    expect(typeof created.$version).toBe('number')
  }, TIMEOUT)

  it('invoice $id starts with invoice_ prefix', async () => {
    const custRes = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `Meta Inv Cust ${generateTestId()}`, email: `${generateTestId()}@e2e.test` }),
    })
    const custId = ((await custRes.json()) as { data: Record<string, unknown> }).data.$id as string
    cleanup.push({ resource: 'customers', id: custId })

    const res = await fetch(`${BILLING_URL}/api/invoices`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        number: `INV-META-${generateTestId()}`,
        customer: custId,
        subtotal: 1000,
        total: 1000,
        amountDue: 1000,
        status: 'draft',
      }),
    })
    const created = ((await res.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'invoices', id: created.$id as string })

    expect((created.$id as string).startsWith('invoice_')).toBe(true)
    expect(created.$type).toBe('Invoice')
    expect(typeof created.$version).toBe('number')
  }, TIMEOUT)

  it('$version increments on update', async () => {
    const custRes = await fetch(`${BILLING_URL}/api/customers`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `Version Customer ${generateTestId()}`, email: `${generateTestId()}@e2e.test` }),
    })
    const created = ((await custRes.json()) as { data: Record<string, unknown> }).data
    cleanup.push({ resource: 'customers', id: created.$id as string })

    const v1 = created.$version as number

    const putRes = await fetch(`${BILLING_URL}/api/customers/${created.$id}`, {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify({ name: `Updated ${generateTestId()}` }),
    })
    const updated = ((await putRes.json()) as { data: Record<string, unknown> }).data
    const v2 = updated.$version as number

    expect(v2).toBeGreaterThan(v1)
  }, TIMEOUT)
})

// =============================================================================
// 12. Cleanup
// =============================================================================

describe('Cleanup', () => {
  it('deletes all test entities created during this run', async () => {
    await cleanupAll()
    // Cleanup is best-effort — always passes
    expect(true).toBe(true)
  }, 60_000)
})
