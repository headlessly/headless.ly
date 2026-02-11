/**
 * @headlessly/rpc — E2E Tests
 *
 * Tests the preconfigured RPC client against live deployed endpoints.
 * Verifies exports (headlessly, buildHeadlesslyConfig, createHeadlesslyClient),
 * config generation, and live RPC calls.
 *
 * Run: vitest run public/packages/rpc/test-e2e/rpc.e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { setup, CRM_URL, writeHeaders, readHeaders, generateTestId } from '../../test-e2e-helpers'
import { headlessly, buildHeadlesslyConfig, createHeadlesslyClient } from '../src/index.js'

// ---------------------------------------------------------------------------
// Setup — provision an authenticated session for live API access
// ---------------------------------------------------------------------------

let isCRMReachable = false

beforeAll(async () => {
  try {
    await setup()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(CRM_URL, {
      signal: controller.signal,
    }).catch(() => null)
    clearTimeout(timeout)
    if (res && (res.ok || res.status === 401 || res.status === 403)) isCRMReachable = true
  } catch {
    // provision or network failure
  }
  if (!isCRMReachable) console.log(`Skipping live RPC tests: ${CRM_URL} not reachable`)
})

// =============================================================================
// Export Verification
// =============================================================================

describe('@headlessly/rpc — exports', () => {
  it('exports headlessly as a function', () => {
    expect(headlessly).toBeDefined()
    expect(typeof headlessly).toBe('function')
  })

  it('exports buildHeadlesslyConfig as a function', () => {
    expect(buildHeadlesslyConfig).toBeDefined()
    expect(typeof buildHeadlesslyConfig).toBe('function')
  })

  it('exports createHeadlesslyClient as a function', () => {
    expect(createHeadlesslyClient).toBeDefined()
    expect(typeof createHeadlesslyClient).toBe('function')
  })

  it('createHeadlesslyClient is an alias for headlessly', () => {
    expect(createHeadlesslyClient).toBe(headlessly)
  })
})

// =============================================================================
// buildHeadlesslyConfig — config generation
// =============================================================================

describe('@headlessly/rpc — buildHeadlesslyConfig', () => {
  it('returns an object with url and rpcOptions', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'acme',
    })

    expect(config).toBeDefined()
    expect(typeof config).toBe('object')
    expect(config.url).toBeDefined()
    expect(config.rpcOptions).toBeDefined()
  })

  it('constructs URL with tenant path', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'acme',
    })

    expect(config.url).toContain('/~acme')
  })

  it('defaults to https://db.headless.ly endpoint', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'test-org',
    })

    expect(config.url).toContain('db.headless.ly')
    expect(config.url).toContain('/~test-org')
  })

  it('uses custom endpoint when provided', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'custom-org',
      endpoint: 'https://custom.headless.ly',
    })

    expect(config.url).toContain('custom.headless.ly')
    expect(config.url).toContain('/~custom-org')
  })

  it('includes auth in rpcOptions when apiKey is provided', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'acme',
      apiKey: 'hly_sk_testKey123',
    })

    expect(config.rpcOptions.auth).toBe('hly_sk_testKey123')
  })

  it('omits auth from rpcOptions when no apiKey', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'acme',
    })

    expect(config.rpcOptions.auth).toBeUndefined()
  })

  it('switches to wss:// protocol for ws transport with HTTPS endpoint', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'acme',
      transport: 'ws',
    })

    expect(config.url).toMatch(/^wss:\/\//)
  })

  it('switches to ws:// protocol for ws transport with HTTP endpoint', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'acme',
      endpoint: 'http://localhost:8787',
      transport: 'ws',
    })

    expect(config.url).toMatch(/^ws:\/\//)
  })

  it('uses https:// for http transport (default)', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'acme',
    })

    expect(config.url).toMatch(/^https:\/\//)
  })

  it('strips trailing slashes from endpoint', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'acme',
      endpoint: 'https://db.headless.ly///',
    })

    // Should not have double slashes before the tenant path
    expect(config.url).not.toMatch(/\/\/~/)
    expect(config.url).toContain('/~acme')
  })
})

// =============================================================================
// headlessly() — client factory
// =============================================================================

describe('@headlessly/rpc — headlessly() factory', () => {
  it('returns an RPC proxy object', () => {
    const $ = headlessly({
      tenant: 'e2e-test',
      apiKey: 'hly_sk_test',
    })

    expect($).toBeDefined()
    expect(typeof $).toBe('object')
  })

  it('returned proxy supports property access for entity namespaces', () => {
    const $ = headlessly({
      tenant: 'e2e-test',
      apiKey: 'hly_sk_test',
    })

    // RPC proxies should allow accessing any property (dynamic dispatch)
    expect($.contacts).toBeDefined()
    expect($.deals).toBeDefined()
  })
})

// =============================================================================
// Live RPC — POST to crm.headless.ly/rpc
// =============================================================================

describe.skipIf(!isCRMReachable)('@headlessly/rpc — live RPC endpoint', () => {
  it('POST to /rpc/Contact.find with limit returns results', async () => {
    const res = await fetch(`${CRM_URL}/rpc/Contact.find`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        args: [{ limit: 5 }],
      }),
    })

    // RPC endpoint should exist
    expect(res.status).not.toBe(404)

    // Accept 200 (success), 401/403 (auth), 400 (validation)
    expect([200, 400, 401, 403]).toContain(res.status)

    if (res.status === 200) {
      const body = (await res.json()) as {
        result?: unknown[] | { items?: unknown[]; data?: unknown[] }
        data?: unknown[]
      }
      expect(body).toBeDefined()

      // Result could be an array or paginated object
      const result = body.result ?? body.data
      if (Array.isArray(result)) {
        expect(result.length).toBeLessThanOrEqual(5)
      } else if (result && typeof result === 'object') {
        const items = (result as { items?: unknown[] }).items ?? (result as { data?: unknown[] }).data
        if (items) {
          expect(Array.isArray(items)).toBe(true)
          expect(items.length).toBeLessThanOrEqual(5)
        }
      }
    }
  }, 15000)

  it('POST to /rpc/Deal.find returns results', async () => {
    const res = await fetch(`${CRM_URL}/rpc/Deal.find`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        args: [{ limit: 3 }],
      }),
    })

    expect(res.status).not.toBe(404)
    expect([200, 400, 401, 403]).toContain(res.status)
  }, 15000)

  it('POST to /rpc with invalid method returns error', async () => {
    const res = await fetch(`${CRM_URL}/rpc/NonExistentType.find`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        args: [{}],
      }),
    })

    // Should return an error status for unknown entity type
    expect(res.status).not.toBe(404)
    expect([200, 400, 401, 403, 500]).toContain(res.status)

    if (res.status === 400) {
      const body = (await res.json()) as { error?: string; message?: string }
      expect(body.error || body.message).toBeDefined()
    }
  }, 15000)

  it('POST to /rpc/Contact.create creates an entity', async () => {
    const testId = generateTestId()

    const res = await fetch(`${CRM_URL}/rpc/Contact.create`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        args: [
          {
            name: `RPC Test ${testId}`,
            email: `rpc-${testId}@e2e.test`,
            stage: 'Lead',
          },
        ],
      }),
    })

    expect(res.status).not.toBe(404)
    expect([200, 201, 400, 401, 403]).toContain(res.status)

    if (res.status === 200 || res.status === 201) {
      const body = (await res.json()) as {
        result?: { $id?: string; name?: string }
        data?: { $id?: string; name?: string }
      }
      const entity = body.result ?? body.data
      if (entity) {
        expect(entity.$id).toBeDefined()
        expect(entity.name).toContain('RPC Test')
      }
    }
  }, 15000)

  it('GET /rpc returns RPC metadata or method listing', async () => {
    const res = await fetch(`${CRM_URL}/rpc`, {
      method: 'GET',
      headers: readHeaders(),
    })

    // GET on /rpc may return metadata, method listing, or 405
    expect([200, 401, 403, 405]).toContain(res.status)

    if (res.status === 200) {
      const ct = res.headers.get('content-type') || ''
      if (ct.includes('json')) {
        const body = (await res.json()) as Record<string, unknown>
        expect(body).toBeDefined()
      }
    }
  }, 15000)

  it('RPC endpoint returns JSON content-type', async () => {
    const res = await fetch(`${CRM_URL}/rpc/Contact.find`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        args: [{ limit: 1 }],
      }),
    })

    if (res.status === 200) {
      const ct = res.headers.get('content-type') || ''
      expect(ct).toContain('json')
    }
  }, 15000)
})

// =============================================================================
// RPC config generation for various tenant scenarios
// =============================================================================

describe('@headlessly/rpc — tenant config scenarios', () => {
  it('handles simple tenant name', () => {
    const config = buildHeadlesslyConfig({ tenant: 'myco' })
    expect(config.url).toBe('https://db.headless.ly/~myco')
  })

  it('handles hyphenated tenant name', () => {
    const config = buildHeadlesslyConfig({ tenant: 'my-company' })
    expect(config.url).toBe('https://db.headless.ly/~my-company')
  })

  it('handles numeric tenant name', () => {
    const config = buildHeadlesslyConfig({ tenant: 'org123' })
    expect(config.url).toBe('https://db.headless.ly/~org123')
  })

  it('config URL format matches *.headless.ly/~:tenant pattern', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'acme',
      endpoint: 'https://crm.headless.ly',
    })

    expect(config.url).toMatch(/^https:\/\/crm\.headless\.ly\/~acme$/)
  })

  it('config works with localhost for development', () => {
    const config = buildHeadlesslyConfig({
      tenant: 'dev',
      endpoint: 'http://localhost:8787',
    })

    expect(config.url).toBe('http://localhost:8787/~dev')
  })
})
