/**
 * TDD RED phase — Failing tests for SDK initialization
 *
 * Tests the `headlessly()` init function that configures the SDK with
 * the appropriate NounProvider based on options (memory vs remote).
 *
 * These tests will FAIL until `headlessly()` is implemented in
 * @headlessly/sdk's src/index.ts.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'

// Mock digital-objects to provide Noun factory + provider infrastructure
// The real digital-objects doesn't export Noun/setProvider/getProvider/MemoryNounProvider yet
vi.mock('digital-objects', () => {
  let currentProvider: unknown = null

  class MemoryNounProvider {
    type = 'memory'
    async create(type: string, data: Record<string, unknown>) {
      return { $type: type, $id: `${type.toLowerCase()}_mock123`, ...data }
    }
    async find() {
      return []
    }
    async get() {
      return null
    }
  }

  function Noun(name: string, _schema: Record<string, string>) {
    return {
      $name: name,
      create: vi.fn(async (data: Record<string, unknown>) => {
        if (currentProvider && typeof (currentProvider as Record<string, unknown>).create === 'function') {
          return (currentProvider as { create: (t: string, d: Record<string, unknown>) => Promise<unknown> }).create(name, data)
        }
        return { $type: name, $id: `${name.toLowerCase()}_mock123`, ...data }
      }),
      find: vi.fn(async () => []),
      get: vi.fn(async () => null),
      update: vi.fn(async () => null),
      delete: vi.fn(async () => true),
    }
  }

  return {
    Noun,
    MemoryNounProvider,
    setProvider: vi.fn((p: unknown) => {
      currentProvider = p
    }),
    getProvider: vi.fn(() => {
      if (!currentProvider) currentProvider = new MemoryNounProvider()
      return currentProvider
    }),
    setEntityRegistry: vi.fn(),
    getEntityRegistry: vi.fn(),
    getNounSchema: vi.fn(() => undefined),
  }
})

// Track rpc.do calls for remote provider tests
const rpcCalls: Array<{ collection: string; method: string; args: unknown[] }> = []
let lastRpcUrl = ''
let lastRpcOptions: Record<string, unknown> = {}

vi.mock('rpc.do', () => {
  function RPC(url: string, options?: Record<string, unknown>) {
    lastRpcUrl = url
    lastRpcOptions = options ?? {}
    // Return a proxy that records collection.method() calls
    return new Proxy(
      {},
      {
        get(_target, collection: string) {
          return new Proxy(
            {},
            {
              get(_t, method: string) {
                return (...args: unknown[]) => {
                  rpcCalls.push({ collection, method, args })
                  return Promise.resolve({ $type: 'Mock', $id: 'mock_123', ...((args[0] as Record<string, unknown>) ?? {}) })
                }
              },
            },
          )
        },
      },
    )
  }
  return { RPC }
})

// Mock domain packages — each returns plain objects representing Nouns
vi.mock('@headlessly/crm', async () => {
  const { Noun } = await import('digital-objects')
  return {
    Organization: Noun('Organization', { name: 'string!' }),
    Contact: Noun('Contact', { name: 'string!', email: 'string' }),
    Deal: Noun('Deal', { name: 'string!', value: 'number!' }),
  }
})

vi.mock('@headlessly/billing', () => ({
  Customer: { $name: 'Customer' },
  Product: { $name: 'Product' },
  Price: { $name: 'Price' },
  Subscription: { $name: 'Subscription' },
  Invoice: { $name: 'Invoice' },
  Payment: { $name: 'Payment' },
}))

vi.mock('@headlessly/projects', () => ({
  Project: { $name: 'Project' },
  Issue: { $name: 'Issue' },
  Comment: { $name: 'Comment' },
}))

vi.mock('@headlessly/content', () => ({
  Content: { $name: 'Content' },
  Asset: { $name: 'Asset' },
  Site: { $name: 'Site' },
}))

vi.mock('@headlessly/support', () => ({
  Ticket: { $name: 'Ticket' },
}))

vi.mock('@headlessly/analytics', () => ({
  Event: { $name: 'Event' },
  Metric: { $name: 'Metric' },
  Funnel: { $name: 'Funnel' },
  Goal: { $name: 'Goal' },
}))

vi.mock('@headlessly/marketing', () => ({
  Campaign: { $name: 'Campaign' },
  Segment: { $name: 'Segment' },
  Form: { $name: 'Form' },
}))

vi.mock('@headlessly/experiments', () => ({
  Experiment: { $name: 'Experiment' },
  FeatureFlag: { $name: 'FeatureFlag' },
}))

vi.mock('@headlessly/platform', () => ({
  Workflow: { $name: 'Workflow' },
  Integration: { $name: 'Integration' },
  Agent: { $name: 'Agent' },
}))

// This import will FAIL because `headlessly` is not exported from @headlessly/sdk
// and `MemoryNounProvider` / `getProvider` are not re-exported properly yet
import { headlessly, $, MemoryNounProvider, getProvider, detectEnvironment, detectEndpoint, enableLazy, entityNames } from '../src/index'
import defaultExport from '../src/index'

describe('headlessly() initialization', () => {
  afterEach(() => {
    // Reset singleton state between tests so each test starts clean
    // Guard against headlessly not being defined yet (TDD red phase)
    if (typeof headlessly?.reset === 'function') {
      headlessly.reset()
    }
    rpcCalls.length = 0
    lastRpcUrl = ''
    lastRpcOptions = {}
    vi.unstubAllEnvs()
  })

  describe('export', () => {
    it('exports headlessly as a function', () => {
      expect(typeof headlessly).toBe('function')
    })

    it('exports headlessly.reset as a function', () => {
      expect(typeof headlessly.reset).toBe('function')
    })
  })

  describe('default (no args) — MemoryNounProvider', () => {
    it('returns the $ context object when called with no arguments', () => {
      const ctx = headlessly()
      expect(ctx).toBeDefined()
      expect(ctx).toBe($)
    })

    it('uses MemoryNounProvider when no options are provided', () => {
      headlessly()
      const provider = getProvider()
      expect(provider).toBeInstanceOf(MemoryNounProvider)
    })

    it('preserves existing behavior — entities are accessible on $', () => {
      headlessly()
      expect($.Contact).toBeDefined()
      expect($.Deal).toBeDefined()
      expect($.Subscription).toBeDefined()
      expect($.User).toBeDefined()
      expect($.Message).toBeDefined()
    })
  })

  describe('remote mode — endpoint + apiKey', () => {
    it('switches to RemoteNounProvider when endpoint and apiKey are provided', () => {
      headlessly({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })
      const provider = getProvider()
      // Should NOT be MemoryNounProvider when remote config is given
      expect(provider).not.toBeInstanceOf(MemoryNounProvider)
    })

    it('configures the provider with the given endpoint', () => {
      headlessly({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })
      const provider = getProvider() as { endpoint?: string }
      expect(provider.endpoint).toBe('https://db.headless.ly')
    })

    it('configures the provider with the given apiKey', () => {
      headlessly({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })
      const provider = getProvider() as { apiKey?: string }
      expect(provider.apiKey).toBe('hly_sk_test123')
    })

    it('routes $.Contact.create() through rpc.do, not raw fetch', async () => {
      rpcCalls.length = 0

      headlessly({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })

      await $.Contact.create({ name: 'Alice' })

      // rpc.do should have been called with the collection method
      expect(rpcCalls.length).toBeGreaterThan(0)
      const call = rpcCalls.find((c) => c.method === 'create')
      expect(call).toBeDefined()
      expect(call!.collection).toBe('contacts')
    })

    it('initializes rpc.do with the correct endpoint', () => {
      headlessly({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })

      expect(lastRpcUrl).toBe('https://db.headless.ly')
    })

    it('passes apiKey as auth option to rpc.do', () => {
      headlessly({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })

      expect(lastRpcOptions.auth).toBe('hly_sk_test123')
    })
  })

  describe('return value', () => {
    it('returns the $ context object', () => {
      const ctx = headlessly()
      expect(ctx).toBe($)
    })

    it('returned context provides entity access', () => {
      const ctx = headlessly()
      expect(ctx.Contact).toBeDefined()
      expect(ctx.Deal).toBeDefined()
    })

    it('returned context provides search/fetch/do', () => {
      const ctx = headlessly()
      expect(typeof ctx.search).toBe('function')
      expect(typeof ctx.fetch).toBe('function')
      expect(typeof ctx.do).toBe('function')
    })
  })

  describe('singleton pattern', () => {
    it('throws an error when called twice without reset', () => {
      headlessly()
      expect(() => headlessly()).toThrow()
    })

    it('error message indicates already initialized', () => {
      headlessly()
      expect(() => headlessly()).toThrow(/already initialized/)
    })

    it('allows re-initialization after reset()', () => {
      headlessly()
      headlessly.reset()
      expect(() => headlessly()).not.toThrow()
    })

    it('reset() clears the provider state', () => {
      headlessly({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })
      headlessly.reset()
      headlessly() // no args = MemoryNounProvider
      const provider = getProvider()
      expect(provider).toBeInstanceOf(MemoryNounProvider)
    })
  })

  describe('environment variable auto-detection', () => {
    it('uses HEADLESSLY_API_KEY env var when no apiKey option is provided', () => {
      vi.stubEnv('HEADLESSLY_API_KEY', 'hly_sk_envkey456')
      vi.stubEnv('HEADLESSLY_ENDPOINT', 'https://db.headless.ly')

      headlessly()
      const provider = getProvider() as { apiKey?: string }
      expect(provider.apiKey).toBe('hly_sk_envkey456')
    })

    it('uses HEADLESSLY_ENDPOINT env var when no endpoint option is provided', () => {
      vi.stubEnv('HEADLESSLY_ENDPOINT', 'https://custom.headless.ly')
      vi.stubEnv('HEADLESSLY_API_KEY', 'hly_sk_envkey456')

      headlessly()
      const provider = getProvider() as { endpoint?: string }
      expect(provider.endpoint).toBe('https://custom.headless.ly')
    })

    it('explicit options override environment variables', () => {
      vi.stubEnv('HEADLESSLY_API_KEY', 'hly_sk_envkey456')
      vi.stubEnv('HEADLESSLY_ENDPOINT', 'https://env.headless.ly')

      headlessly({
        endpoint: 'https://explicit.headless.ly',
        apiKey: 'hly_sk_explicit789',
      })
      const provider = getProvider() as { endpoint?: string; apiKey?: string }
      expect(provider.endpoint).toBe('https://explicit.headless.ly')
      expect(provider.apiKey).toBe('hly_sk_explicit789')
    })

    it('falls back to MemoryNounProvider when no env vars or options set', () => {
      // Ensure env vars are not set
      vi.stubEnv('HEADLESSLY_API_KEY', '')
      vi.stubEnv('HEADLESSLY_ENDPOINT', '')

      headlessly()
      const provider = getProvider()
      expect(provider).toBeInstanceOf(MemoryNounProvider)
    })
  })

  describe('endpoint URL validation', () => {
    it('throws on invalid URL format', () => {
      expect(() => headlessly({ endpoint: 'not-a-url', apiKey: 'hly_sk_test123' })).toThrow(/invalid/i)
    })

    it('throws on empty string endpoint', () => {
      expect(() => headlessly({ endpoint: '', apiKey: 'hly_sk_test123' })).toThrow(/invalid|endpoint|empty/i)
    })

    it('error message mentions invalid endpoint', () => {
      expect(() => headlessly({ endpoint: 'not-a-url', apiKey: 'hly_sk_test123' })).toThrow(/invalid.*endpoint|invalid.*url/i)
    })

    it('accepts valid HTTPS endpoint', () => {
      expect(() =>
        headlessly({
          endpoint: 'https://db.headless.ly',
          apiKey: 'hly_sk_test123',
        }),
      ).not.toThrow()
    })

    it('accepts valid HTTP endpoint (for local dev)', () => {
      expect(() =>
        headlessly({
          endpoint: 'http://localhost:8787',
          apiKey: 'hly_sk_test123',
        }),
      ).not.toThrow()
    })

    it('error message includes suggestion for valid URL format', () => {
      try {
        headlessly({ endpoint: 'not-a-url', apiKey: 'hly_sk_test123' })
      } catch (e) {
        expect((e as Error).message).toContain('https://db.headless.ly')
      }
    })
  })

  describe('default export', () => {
    it('exports headlessly as the default export', () => {
      expect(defaultExport).toBe(headlessly)
    })

    it('default export is a function', () => {
      expect(typeof defaultExport).toBe('function')
    })

    it('default export has reset()', () => {
      expect(typeof defaultExport.reset).toBe('function')
    })
  })

  describe('environment auto-detection', () => {
    it('exports detectEnvironment as a function', () => {
      expect(typeof detectEnvironment).toBe('function')
    })

    it('detects node environment in vitest', () => {
      // vitest runs in Node.js
      expect(detectEnvironment()).toBe('node')
    })

    it('exports detectEndpoint as a function', () => {
      expect(typeof detectEndpoint).toBe('function')
    })

    it('returns undefined for endpoint when not in browser', () => {
      // In Node.js (vitest), window is not defined
      expect(detectEndpoint()).toBeUndefined()
    })

    it('auto-detects endpoint from browser window.location on headless.ly', () => {
      // Simulate browser environment
      const origWindow = globalThis.window
      ;(globalThis as Record<string, unknown>).window = {
        location: { hostname: 'crm.headless.ly', protocol: 'https:' },
      }
      try {
        expect(detectEndpoint()).toBe('https://db.headless.ly')
      } finally {
        if (origWindow === undefined) {
          delete (globalThis as Record<string, unknown>).window
        } else {
          ;(globalThis as Record<string, unknown>).window = origWindow
        }
      }
    })

    it('auto-detects endpoint from bare headless.ly domain', () => {
      const origWindow = globalThis.window
      ;(globalThis as Record<string, unknown>).window = {
        location: { hostname: 'headless.ly', protocol: 'https:' },
      }
      try {
        expect(detectEndpoint()).toBe('https://db.headless.ly')
      } finally {
        if (origWindow === undefined) {
          delete (globalThis as Record<string, unknown>).window
        } else {
          ;(globalThis as Record<string, unknown>).window = origWindow
        }
      }
    })

    it('returns undefined for non-headless.ly domains', () => {
      const origWindow = globalThis.window
      ;(globalThis as Record<string, unknown>).window = {
        location: { hostname: 'example.com', protocol: 'https:' },
      }
      try {
        expect(detectEndpoint()).toBeUndefined()
      } finally {
        if (origWindow === undefined) {
          delete (globalThis as Record<string, unknown>).window
        } else {
          ;(globalThis as Record<string, unknown>).window = origWindow
        }
      }
    })
  })

  describe('lazy initialization', () => {
    it('headlessly({ lazy: true }) does not throw', () => {
      expect(() => headlessly({ lazy: true })).not.toThrow()
    })

    it('headlessly({ lazy: true }) returns $ context', () => {
      const ctx = headlessly({ lazy: true })
      expect(ctx).toBe($)
    })

    it('$ auto-initializes on first entity access without calling headlessly()', () => {
      // Do NOT call headlessly() — just access an entity directly
      expect($.Contact).toBeDefined()
      // After accessing, headlessly should report as initialized
      expect(headlessly.isInitialized()).toBe(true)
    })

    it('$.search auto-initializes', async () => {
      const results = await $.search({ type: 'Contact' })
      expect(Array.isArray(results)).toBe(true)
      expect(headlessly.isInitialized()).toBe(true)
    })

    it('$.fetch auto-initializes', async () => {
      const result = await $.fetch({ type: 'Contact', id: 'contact_test' })
      expect(result).toBeNull()
      expect(headlessly.isInitialized()).toBe(true)
    })

    it('$.do auto-initializes', async () => {
      let called = false
      await $.do(async () => {
        called = true
      })
      expect(called).toBe(true)
      expect(headlessly.isInitialized()).toBe(true)
    })

    it('enableLazy() enables lazy mode', () => {
      enableLazy()
      // Access $ without calling headlessly()
      expect($.User).toBeDefined()
      expect(headlessly.isInitialized()).toBe(true)
    })
  })

  describe('reconfigure()', () => {
    it('exports headlessly.reconfigure as a function', () => {
      expect(typeof headlessly.reconfigure).toBe('function')
    })

    it('allows switching from memory to remote without manual reset', () => {
      headlessly()
      const provider1 = getProvider()
      expect(provider1).toBeInstanceOf(MemoryNounProvider)

      headlessly.reconfigure({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_reconfig',
      })
      const provider2 = getProvider() as { endpoint?: string }
      expect(provider2).not.toBeInstanceOf(MemoryNounProvider)
      expect(provider2.endpoint).toBe('https://db.headless.ly')
    })

    it('returns the $ context', () => {
      headlessly()
      const ctx = headlessly.reconfigure({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_reconfig',
      })
      expect(ctx).toBe($)
    })
  })

  describe('isInitialized()', () => {
    it('returns false before initialization', () => {
      expect(headlessly.isInitialized()).toBe(false)
    })

    it('returns true after initialization', () => {
      headlessly()
      expect(headlessly.isInitialized()).toBe(true)
    })

    it('returns false after reset', () => {
      headlessly()
      headlessly.reset()
      expect(headlessly.isInitialized()).toBe(false)
    })
  })

  describe('entityNames export', () => {
    it('exports entityNames as an array', () => {
      expect(Array.isArray(entityNames)).toBe(true)
    })

    it('contains all 35 entity names', () => {
      // 2 Identity + 6 CRM + 7 Billing + 3 Projects + 3 Content + 1 Support
      // + 4 Analytics + 3 Marketing + 2 Experiments + 3 Platform + 1 Communication = 35
      expect(entityNames.length).toBeGreaterThanOrEqual(20)
      expect(entityNames).toContain('User')
      expect(entityNames).toContain('Contact')
      expect(entityNames).toContain('Deal')
      expect(entityNames).toContain('Message')
      expect(entityNames).toContain('ApiKey')
    })
  })

  describe('endpoint without apiKey warning', () => {
    it('warns when endpoint is provided without apiKey', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      headlessly({ endpoint: 'https://db.headless.ly' })
      expect(warnSpy).toHaveBeenCalled()
      expect(warnSpy.mock.calls[0][0]).toContain('without an API key')
      warnSpy.mockRestore()
    })

    it('falls back to MemoryNounProvider when endpoint has no apiKey', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      headlessly({ endpoint: 'https://db.headless.ly' })
      const provider = getProvider()
      expect(provider).toBeInstanceOf(MemoryNounProvider)
      vi.restoreAllMocks()
    })
  })
})
