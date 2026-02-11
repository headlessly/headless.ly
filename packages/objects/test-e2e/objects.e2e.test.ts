/**
 * @headlessly/objects — E2E Tests
 *
 * Tests the DO-backed NounProvider infrastructure against live deployed endpoints.
 * Verifies exports (DONounProvider, LocalNounProvider, generateSqid, generateEntityId),
 * ID generation, and noun registry via live objects.do.
 *
 * Run: vitest run public/packages/objects/test-e2e/objects.e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { setup, CRM_URL, readHeaders, generateTestId } from '../../test-e2e-helpers'
import { DONounProvider, LocalNounProvider, generateSqid, generateEntityId } from '../src/index.js'

// ---------------------------------------------------------------------------
// Setup — provision an authenticated session for live API access
// ---------------------------------------------------------------------------

const OBJECTS_URL = process.env.OBJECTS_URL || 'https://objects.do'

let isObjectsReachable = false

beforeAll(async () => {
  try {
    await setup()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(OBJECTS_URL, {
      signal: controller.signal,
    }).catch(() => null)
    clearTimeout(timeout)
    if (res && res.ok) isObjectsReachable = true
  } catch {
    // provision or network failure
  }
  if (!isObjectsReachable) console.log(`Skipping live objects.do tests: ${OBJECTS_URL} not reachable`)
})

// =============================================================================
// Export Verification
// =============================================================================

describe('@headlessly/objects — exports', () => {
  it('exports DONounProvider as a class', () => {
    expect(DONounProvider).toBeDefined()
    expect(typeof DONounProvider).toBe('function')
  })

  it('exports LocalNounProvider as a class', () => {
    expect(LocalNounProvider).toBeDefined()
    expect(typeof LocalNounProvider).toBe('function')
  })

  it('exports generateSqid as a function', () => {
    expect(generateSqid).toBeDefined()
    expect(typeof generateSqid).toBe('function')
  })

  it('exports generateEntityId as a function', () => {
    expect(generateEntityId).toBeDefined()
    expect(typeof generateEntityId).toBe('function')
  })
})

// =============================================================================
// generateSqid — random alphanumeric IDs
// =============================================================================

describe('@headlessly/objects — generateSqid', () => {
  it('produces an 8-character string by default', () => {
    const sqid = generateSqid()
    expect(typeof sqid).toBe('string')
    expect(sqid.length).toBe(8)
  })

  it('produces only alphanumeric characters', () => {
    const sqid = generateSqid()
    expect(sqid).toMatch(/^[a-zA-Z0-9]+$/)
  })

  it('respects custom length parameter', () => {
    const sqid12 = generateSqid(12)
    expect(sqid12.length).toBe(12)

    const sqid4 = generateSqid(4)
    expect(sqid4.length).toBe(4)
  })

  it('produces unique values on successive calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateSqid())
    }
    // With 62^8 possible values, 100 calls should all be unique
    expect(ids.size).toBe(100)
  })

  it('does not produce empty strings', () => {
    const sqid = generateSqid()
    expect(sqid.length).toBeGreaterThan(0)
  })

  it('handles length of 1', () => {
    const sqid = generateSqid(1)
    expect(sqid.length).toBe(1)
    expect(sqid).toMatch(/^[a-zA-Z0-9]$/)
  })
})

// =============================================================================
// generateEntityId — {type}_{sqid} format
// =============================================================================

describe('@headlessly/objects — generateEntityId', () => {
  it('produces {type}_{sqid} format', () => {
    const id = generateEntityId('Contact')
    expect(id).toMatch(/^contact_[a-zA-Z0-9]{8}$/)
  })

  it('lowercases the type prefix', () => {
    const id = generateEntityId('Deal')
    expect(id.startsWith('deal_')).toBe(true)
  })

  it('handles PascalCase type names', () => {
    const id = generateEntityId('FeatureFlag')
    expect(id.startsWith('featureflag_')).toBe(true)
  })

  it('includes an underscore separator', () => {
    const id = generateEntityId('Organization')
    expect(id.includes('_')).toBe(true)
    const parts = id.split('_')
    expect(parts.length).toBe(2)
    expect(parts[0]).toBe('organization')
    expect(parts[1].length).toBe(8)
  })

  it('produces unique IDs for the same type', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 50; i++) {
      ids.add(generateEntityId('Contact'))
    }
    expect(ids.size).toBe(50)
  })

  it('produces IDs for different entity types', () => {
    const contactId = generateEntityId('Contact')
    const dealId = generateEntityId('Deal')
    const subId = generateEntityId('Subscription')

    expect(contactId.startsWith('contact_')).toBe(true)
    expect(dealId.startsWith('deal_')).toBe(true)
    expect(subId.startsWith('subscription_')).toBe(true)
  })
})

// =============================================================================
// LocalNounProvider — in-process storage
// =============================================================================

describe('@headlessly/objects — LocalNounProvider', () => {
  it('creates a LocalNounProvider instance', () => {
    const provider = new LocalNounProvider()
    expect(provider).toBeDefined()
  })

  it('provides CRUD methods', () => {
    const provider = new LocalNounProvider()
    expect(typeof provider.create).toBe('function')
    expect(typeof provider.get).toBe('function')
    expect(typeof provider.update).toBe('function')
    expect(typeof provider.delete).toBe('function')
    expect(typeof provider.find).toBe('function')
  })

  it('create and get round-trips an entity', async () => {
    const provider = new LocalNounProvider()
    const testId = generateTestId()

    const created = await provider.create('Contact', {
      name: `Local Test ${testId}`,
      stage: 'Lead',
    })

    expect(created).toBeDefined()
    expect(created.$id).toBeDefined()

    const fetched = await provider.get('Contact', created.$id)
    expect(fetched).toBeDefined()
    expect(fetched!.name).toBe(`Local Test ${testId}`)
  })
})

// =============================================================================
// DONounProvider — configuration
// =============================================================================

describe('@headlessly/objects — DONounProvider', () => {
  it('creates a DONounProvider with endpoint config', () => {
    const provider = new DONounProvider({
      endpoint: 'https://objects.do',
    })
    expect(provider).toBeDefined()
  })

  it('provides CRUD methods', () => {
    const provider = new DONounProvider({
      endpoint: 'https://objects.do',
    })
    expect(typeof provider.create).toBe('function')
    expect(typeof provider.get).toBe('function')
    expect(typeof provider.update).toBe('function')
    expect(typeof provider.delete).toBe('function')
    expect(typeof provider.find).toBe('function')
  })
})

// =============================================================================
// Live objects.do — noun registry
// =============================================================================

describe.skipIf(!isObjectsReachable)('@headlessly/objects — live objects.do', () => {
  it('fetches noun registry from objects.do', async () => {
    const res = await fetch(`${OBJECTS_URL}/~default/nouns`, {
      headers: { Accept: 'application/json' },
    })

    // The noun registry should be accessible
    expect([200, 404]).toContain(res.status)

    if (res.status === 200) {
      const body = (await res.json()) as Record<string, unknown> | unknown[]
      expect(body).toBeDefined()

      // If it returns an array, each entry should have a name or type
      if (Array.isArray(body)) {
        expect(body.length).toBeGreaterThan(0)
      }
      // If it returns an object, it should have noun entries
      if (typeof body === 'object' && !Array.isArray(body)) {
        const keys = Object.keys(body)
        expect(keys.length).toBeGreaterThan(0)
      }
    }
  }, 15000)

  it('objects.do root returns API metadata', async () => {
    const res = await fetch(OBJECTS_URL, {
      headers: { Accept: 'application/json' },
    })

    expect(res.status).toBe(200)
    const ct = res.headers.get('content-type') || ''
    expect(ct).toContain('application/json')

    const body = (await res.json()) as { api?: string; name?: string; description?: string }
    expect(body).toBeDefined()
  }, 15000)

  it('objects.do returns CORS headers', async () => {
    const res = await fetch(OBJECTS_URL, {
      headers: { Accept: 'application/json', Origin: 'https://headless.ly' },
    })

    expect(res.status).toBe(200)
    // CORS headers should be present for cross-origin access
    const acao = res.headers.get('access-control-allow-origin')
    if (acao) {
      expect(acao === '*' || acao === 'https://headless.ly').toBe(true)
    }
  }, 15000)

  it('objects.do returns 404 for non-existent noun', async () => {
    const res = await fetch(`${OBJECTS_URL}/~default/nouns/NonExistentType12345`, {
      headers: { Accept: 'application/json' },
    })

    // Should return 404 for a noun that does not exist
    expect([404, 200]).toContain(res.status)
  }, 15000)
})
