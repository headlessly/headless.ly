/**
 * headless.ly Tests
 * @generated
 *
 * Combined runtime and type tests for the headless.ly package
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { expectTypeOf } from 'vitest'

// ============================================================================
// Test Setup
// ============================================================================

const isE2E = process.env.E2E === 'true' || process.env.CI_E2E === 'true'
let apiKey: string

beforeAll(async () => {
  if (isE2E) {
    // Real E2E: authenticate via oauth.do
    const { ensureLoggedIn } = await import('oauth.do/node')
    const auth = await ensureLoggedIn({
      service: 'headless.ly',
      scopes: ['read', 'write']
    })
    apiKey = auth.apiKey
    process.env.HEADLESSLY_API_KEY = apiKey
    console.log('Authenticated for E2E tests')
  } else {
    // Unit tests: use mock API key
    apiKey = 'test-mock-api-key'
    process.env.HEADLESSLY_API_KEY = apiKey

    // Mock rpc.do for unit tests
    vi.mock('rpc.do', () => ({
      rpc: vi.fn((service) => ({
        call: vi.fn().mockResolvedValue({ data: {}, ok: true })
      })),
      $: vi.fn()
    }))
  }
})

afterAll(async () => {
  vi.restoreAllMocks()
})

// ============================================================================
// Runtime Tests
// ============================================================================

describe('headless.ly', () => {
  describe('exports', () => {
    it('should export rpc from rpc.do', async () => {
      const { rpc } = await import('headless.ly')
      expect(typeof rpc).toBe('function')
    })

    it('should export service client functions', async () => {
      const { crm, sell, market, db } = await import('headless.ly')
      expect(typeof crm).toBe('function')
      expect(typeof sell).toBe('function')
      expect(typeof market).toBe('function')
      expect(typeof db).toBe('function')
    })
  })

  describe('service clients', () => {
    it('should create client instances', async () => {
      const { crm } = await import('headless.ly')
      const client = crm({ apiKey: 'test-key' })
      expect(client).toBeDefined()
    })
  })
})

// ============================================================================
// E2E Tests (run with E2E=true)
// ============================================================================

describe.skipIf(!isE2E)('e2e', () => {
  it('should authenticate and make real API call', async () => {
    const { crm } = await import('headless.ly')
    const client = crm({ apiKey: process.env.HEADLESSLY_API_KEY })
    const result = await client.call('ping')
    expect(result.ok).toBe(true)
  })
})

// ============================================================================
// Type Tests
// ============================================================================

describe('types', () => {
  it('should have correct types for service functions', async () => {
    const { crm, db } = await import('headless.ly')

    // Type assertions
    expectTypeOf(crm).toBeFunction()
    expectTypeOf(db).toBeFunction()
  })
})
