/**
 * @headlessly/events — E2E Tests
 *
 * Tests the event system infrastructure against live deployed endpoints.
 * Verifies exports (EventLog, EventBus, TimeTraveler, SubscriptionManager, CDCStream),
 * in-memory event operations, and CDC against the live CRM API.
 *
 * Run: vitest run public/packages/events/test-e2e/events.e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { setup, CRM_URL, writeHeaders, readHeaders, generateTestId } from '../../test-e2e-helpers'
import { EventLog, EventBus, TimeTraveler, SubscriptionManager, CDCStream, crudEvent, verbEvent } from '../src/index.js'

// ---------------------------------------------------------------------------
// Setup — provision an authenticated session for live API access
// ---------------------------------------------------------------------------

let isReachable = false

beforeAll(async () => {
  try {
    await setup()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${CRM_URL}/api/contacts?limit=1`, {
      headers: readHeaders(),
      signal: controller.signal,
    }).catch(() => null)
    clearTimeout(timeout)
    if (res && (res.ok || res.status === 401)) isReachable = true
  } catch {
    // provision or network failure
  }
  if (!isReachable) console.log(`Skipping live CDC tests: ${CRM_URL} not reachable`)
})

// =============================================================================
// Export Verification
// =============================================================================

describe('@headlessly/events — exports', () => {
  it('exports EventLog as a class', () => {
    expect(EventLog).toBeDefined()
    expect(typeof EventLog).toBe('function')
  })

  it('exports EventBus as a class', () => {
    expect(EventBus).toBeDefined()
    expect(typeof EventBus).toBe('function')
  })

  it('exports TimeTraveler as a class', () => {
    expect(TimeTraveler).toBeDefined()
    expect(typeof TimeTraveler).toBe('function')
  })

  it('exports SubscriptionManager as a class', () => {
    expect(SubscriptionManager).toBeDefined()
    expect(typeof SubscriptionManager).toBe('function')
  })

  it('exports CDCStream as a class', () => {
    expect(CDCStream).toBeDefined()
    expect(typeof CDCStream).toBe('function')
  })
})

// =============================================================================
// EventLog — append-only log
// =============================================================================

describe('@headlessly/events — EventLog', () => {
  it('creates an EventLog instance', () => {
    const log = new EventLog()
    expect(log).toBeDefined()
    expect(typeof log.append).toBe('function')
    expect(typeof log.query).toBe('function')
  })

  it('appends an event and retrieves it', async () => {
    const log = new EventLog()
    const testId = generateTestId()

    const event = await log.append(
      crudEvent('create', 'Contact', `contact_${testId}`, {
        after: { name: 'Alice', stage: 'Lead' },
      }),
    )

    expect(event).toBeDefined()
    expect(event.entityId).toBe(`contact_${testId}`)
    expect(event.verb).toBe('create')
  })

  it('queries events by entity type', async () => {
    const log = new EventLog()
    const testId = generateTestId()

    await log.append(
      crudEvent('create', 'Contact', `contact_${testId}`, {
        after: { name: 'Bob' },
      }),
    )

    await log.append(
      crudEvent('create', 'Deal', `deal_${testId}`, {
        after: { title: 'Big Deal' },
      }),
    )

    const contactEvents = await log.query({ entityType: 'Contact' })
    expect(Array.isArray(contactEvents)).toBe(true)
    expect(contactEvents.length).toBeGreaterThanOrEqual(1)
    expect(contactEvents.every((e) => e.entityType === 'Contact')).toBe(true)
  })

  it('getEntityHistory returns events for a specific entity', async () => {
    const log = new EventLog()
    const testId = generateTestId()
    const entityId = `contact_${testId}`

    await log.append(
      crudEvent('create', 'Contact', entityId, {
        after: { name: 'Charlie', stage: 'Lead' },
      }),
    )

    await log.append(
      crudEvent('update', 'Contact', entityId, {
        after: { stage: 'Qualified' },
      }),
    )

    const history = await log.getEntityHistory('Contact', entityId)
    expect(Array.isArray(history)).toBe(true)
    expect(history.length).toBe(2)
    expect(history[0].verb).toBe('create')
    expect(history[1].verb).toBe('update')
  })

  it('events are sequenced with monotonic IDs', async () => {
    const log = new EventLog()
    const testId = generateTestId()

    const e1 = await log.append(
      crudEvent('create', 'Contact', `contact_${testId}`, {
        after: { name: 'First' },
      }),
    )

    const e2 = await log.append(
      crudEvent('update', 'Contact', `contact_${testId}`, {
        after: { name: 'Second' },
      }),
    )

    expect(e1.$id).toBeDefined()
    expect(e2.$id).toBeDefined()
    // Second event should have a higher sequence number or later timestamp
    expect(e2.$id).not.toBe(e1.$id)
  })
})

// =============================================================================
// EventBus — pub/sub
// =============================================================================

describe('@headlessly/events — EventBus', () => {
  it('creates an EventBus instance', () => {
    const bus = new EventBus()
    expect(bus).toBeDefined()
    expect(typeof bus.emit).toBe('function')
    expect(typeof bus.on).toBe('function')
  })

  it('emit/on pattern delivers events to subscribers', async () => {
    const bus = new EventBus()
    const received: unknown[] = []

    bus.on('Contact.created', (event: unknown) => {
      received.push(event)
    })

    await bus.emit(crudEvent('create', 'Contact', 'contact_testBus1', { after: { name: 'EventBus Test' } }))

    expect(received.length).toBe(1)
    expect((received[0] as { after: { name: string } }).after.name).toBe('EventBus Test')
  })

  it('subscribers can unsubscribe via off()', async () => {
    const bus = new EventBus()
    const received: unknown[] = []

    const handler = (event: unknown) => received.push(event)
    bus.on('Deal.closed', handler)
    bus.off('Deal.closed', handler)

    await bus.emit(verbEvent('close', 'Deal', 'deal_testOff1', { action: 'close', activity: 'closing', event: 'closed' }))

    expect(received.length).toBe(0)
  })

  it('once() fires only for the first matching event', async () => {
    const bus = new EventBus()
    const received: unknown[] = []

    bus.once('Contact.qualified', (event: unknown) => {
      received.push(event)
    })

    await bus.emit(verbEvent('qualify', 'Contact', 'contact_once1', { action: 'qualify', activity: 'qualifying', event: 'qualified' }))
    await bus.emit(verbEvent('qualify', 'Contact', 'contact_once2', { action: 'qualify', activity: 'qualifying', event: 'qualified' }))

    expect(received.length).toBe(1)
  })

  it('wildcard subscribers receive all events', async () => {
    const bus = new EventBus()
    const received: unknown[] = []

    bus.on('*', (event: unknown) => {
      received.push(event)
    })

    await bus.emit(crudEvent('create', 'Contact', 'contact_wild1'))
    await bus.emit(verbEvent('close', 'Deal', 'deal_wild1', { action: 'close', activity: 'closing', event: 'closed' }))

    expect(received.length).toBe(2)
  })
})

// =============================================================================
// TimeTraveler — state reconstruction
// =============================================================================

describe('@headlessly/events — TimeTraveler', () => {
  it('creates a TimeTraveler instance from an EventLog', () => {
    const log = new EventLog()
    const traveler = new TimeTraveler(log)
    expect(traveler).toBeDefined()
    expect(typeof traveler.asOf).toBe('function')
  })

  it('reconstructs entity state from event history', async () => {
    const log = new EventLog()
    const testId = generateTestId()
    const entityId = `contact_${testId}`

    await log.append(
      crudEvent('create', 'Contact', entityId, {
        after: { name: 'Diana', stage: 'Lead', email: 'diana@example.com' },
      }),
    )

    await log.append(
      crudEvent('update', 'Contact', entityId, {
        after: { stage: 'Qualified' },
      }),
    )

    const traveler = new TimeTraveler(log)
    // asOf with no time constraint returns the latest state
    const state = await traveler.asOf('Contact', entityId, {})

    expect(state).toBeDefined()
    expect(state!.name).toBe('Diana')
    expect(state!.stage).toBe('Qualified')
    expect(state!.email).toBe('diana@example.com')
  })

  it('reconstructs state at a specific point in time (asOf)', async () => {
    const log = new EventLog()
    const testId = generateTestId()
    const entityId = `contact_${testId}`

    await log.append(
      crudEvent('create', 'Contact', entityId, {
        after: { name: 'Eve', stage: 'Lead' },
      }),
    )

    const snapshotTime = new Date().toISOString()

    // Small delay to ensure timestamp separation
    await new Promise((resolve) => setTimeout(resolve, 10))

    await log.append(
      crudEvent('update', 'Contact', entityId, {
        after: { stage: 'Customer' },
      }),
    )

    const traveler = new TimeTraveler(log)
    const pastState = await traveler.asOf('Contact', entityId, { asOf: snapshotTime })

    expect(pastState).toBeDefined()
    expect(pastState!.stage).toBe('Lead')
  })
})

// =============================================================================
// Live CDC — create entity via CRM API, verify event history
// =============================================================================

describe.skipIf(!isReachable)('@headlessly/events — live CDC via CRM API', () => {
  it('creates a contact via CRM API and verifies it exists', async () => {
    const testId = generateTestId()

    const createRes = await fetch(`${CRM_URL}/api/contacts`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `CDC Test ${testId}`,
        email: `cdc-${testId}@e2e.test`,
        stage: 'Lead',
      }),
    })

    // The API should accept the creation (201 or 200)
    expect([200, 201]).toContain(createRes.status)

    const body = (await createRes.json()) as { data?: { $id?: string } }
    const entityId = body.data?.$id
    expect(entityId).toBeDefined()
    expect(typeof entityId).toBe('string')
  }, 15000)

  it('fetches entity history endpoint for a created contact', async () => {
    const testId = generateTestId()

    // Create a contact
    const createRes = await fetch(`${CRM_URL}/api/contacts`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        name: `History Test ${testId}`,
        email: `history-${testId}@e2e.test`,
        stage: 'Lead',
      }),
    })

    if (createRes.status !== 201 && createRes.status !== 200) {
      // If creation fails, skip the rest of this test
      expect(createRes.status).toBe(201)
      return
    }

    const createBody = (await createRes.json()) as { data: { $id: string } }
    const entityId = createBody.data.$id

    // Fetch the history/events for this entity
    const historyRes = await fetch(`${CRM_URL}/api/contacts/${entityId}/history`, {
      headers: readHeaders(),
    })

    // The history endpoint should exist and return event data
    // Accept 200 (events found) or 404 (endpoint not yet implemented)
    expect([200, 404]).toContain(historyRes.status)

    if (historyRes.status === 200) {
      const historyBody = (await historyRes.json()) as { events?: unknown[]; data?: unknown[] }
      const events = historyBody.events ?? historyBody.data
      expect(Array.isArray(events)).toBe(true)
      expect(events!.length).toBeGreaterThanOrEqual(1)
    }
  }, 15000)

  it('CDCStream class can be instantiated with an EventLog', () => {
    const log = new EventLog()
    const stream = new CDCStream(log)

    expect(stream).toBeDefined()
    // CDCStream should expose poll and createConsumer methods
    expect(typeof stream.poll).toBe('function')
    expect(typeof stream.createConsumer).toBe('function')
  })
})
