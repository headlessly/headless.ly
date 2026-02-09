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
    async find() { return [] }
    async get() { return null }
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
    setProvider: vi.fn((p: unknown) => { currentProvider = p }),
    getProvider: vi.fn(() => {
      if (!currentProvider) currentProvider = new MemoryNounProvider()
      return currentProvider
    }),
  }
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
import { headlessly, $, MemoryNounProvider, getProvider } from '../src/index'

describe('headlessly() initialization', () => {
  afterEach(() => {
    // Reset singleton state between tests so each test starts clean
    // Guard against headlessly not being defined yet (TDD red phase)
    if (typeof headlessly?.reset === 'function') {
      headlessly.reset()
    }
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

    it('routes $.Contact.create() through the remote provider, not local memory', async () => {
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          $type: 'Contact',
          $id: 'contact_fX9bL5nRd',
          name: 'Alice',
        }), { status: 200 })
      )
      vi.stubGlobal('fetch', fetchSpy)

      headlessly({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })

      await $.Contact.create({ name: 'Alice' })

      // fetch should have been called with the remote endpoint
      expect(fetchSpy).toHaveBeenCalled()
      const callUrl = fetchSpy.mock.calls[0][0]
      expect(String(callUrl)).toContain('db.headless.ly')
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
      expect(() =>
        headlessly({ endpoint: 'not-a-url', apiKey: 'hly_sk_test123' })
      ).toThrow(/invalid/i)
    })

    it('throws on empty string endpoint', () => {
      expect(() =>
        headlessly({ endpoint: '', apiKey: 'hly_sk_test123' })
      ).toThrow(/invalid|endpoint|empty/i)
    })

    it('error message mentions invalid endpoint', () => {
      expect(() =>
        headlessly({ endpoint: 'not-a-url', apiKey: 'hly_sk_test123' })
      ).toThrow(/invalid.*endpoint|invalid.*url/i)
    })

    it('accepts valid HTTPS endpoint', () => {
      expect(() =>
        headlessly({
          endpoint: 'https://db.headless.ly',
          apiKey: 'hly_sk_test123',
        })
      ).not.toThrow()
    })

    it('accepts valid HTTP endpoint (for local dev)', () => {
      expect(() =>
        headlessly({
          endpoint: 'http://localhost:8787',
          apiKey: 'hly_sk_test123',
        })
      ).not.toThrow()
    })
  })
})
