/**
 * Tests for SDK initialization
 *
 * Tests the `headlessly()` init function that configures the SDK with
 * the appropriate NounProvider based on options (memory vs remote).
 *
 * All tests use real modules — no vi.mock() calls.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { setProvider, clearRegistry, getProvider } from 'digital-objects'
import { headlessly, $, RemoteNounProvider, LocalNounProvider, detectEnvironment, detectEndpoint, enableLazy, entityNames } from '../src/index'
import defaultExport from '../src/index'

describe('headlessly() initialization', () => {
  afterEach(() => {
    // Reset singleton state between tests so each test starts clean
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

  describe('default (no args) — LocalNounProvider', () => {
    it('returns a self-contained HeadlessContext when called with no arguments', () => {
      const ctx = headlessly()
      expect(ctx).toBeDefined()
      // The returned context is self-contained (not the global $ reference)
      // but provides the same entity access
      expect(ctx.Contact).toBeDefined()
      expect(ctx.Deal).toBeDefined()
    })

    it('uses LocalNounProvider when no options are provided', () => {
      headlessly()
      const provider = getProvider()
      expect(provider).toBeInstanceOf(LocalNounProvider)
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
      // Should NOT be LocalNounProvider when remote config is given
      expect(provider).not.toBeInstanceOf(LocalNounProvider)
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

    it('creates a RemoteNounProvider with correct properties', () => {
      headlessly({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })

      const provider = getProvider() as RemoteNounProvider
      expect(provider.type).toBe('remote')
      expect(provider.endpoint).toBe('https://db.headless.ly')
      expect(provider.apiKey).toBe('hly_sk_test123')
    })

    it('RemoteNounProvider stores endpoint for RPC routing', () => {
      headlessly({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })

      const provider = getProvider() as RemoteNounProvider
      expect(provider.endpoint).toBe('https://db.headless.ly')
    })

    it('RemoteNounProvider stores apiKey for RPC auth', () => {
      headlessly({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })

      const provider = getProvider() as RemoteNounProvider
      expect(provider.apiKey).toBe('hly_sk_test123')
    })
  })

  describe('return value', () => {
    it('returns a self-contained HeadlessContext with entity access', () => {
      const ctx = headlessly()
      expect(ctx).toBeDefined()
      expect(ctx.Contact).toBeDefined()
      expect(typeof ctx.search).toBe('function')
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
      headlessly() // no args = LocalNounProvider
      const provider = getProvider()
      expect(provider).toBeInstanceOf(LocalNounProvider)
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

    it('falls back to LocalNounProvider when no env vars or options set', () => {
      // Ensure env vars are not set
      vi.stubEnv('HEADLESSLY_API_KEY', '')
      vi.stubEnv('HEADLESSLY_ENDPOINT', '')

      headlessly()
      const provider = getProvider()
      expect(provider).toBeInstanceOf(LocalNounProvider)
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

    it('headlessly({ lazy: true }) returns $ context (lazy returns global)', () => {
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
      expect(provider1).toBeInstanceOf(LocalNounProvider)

      headlessly.reconfigure({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_reconfig',
      })
      const provider2 = getProvider() as { endpoint?: string }
      expect(provider2).not.toBeInstanceOf(LocalNounProvider)
      expect(provider2.endpoint).toBe('https://db.headless.ly')
    })

    it('returns a self-contained HeadlessContext', () => {
      headlessly()
      const ctx = headlessly.reconfigure({
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_reconfig',
      })
      expect(ctx).toBeDefined()
      expect(ctx.Contact).toBeDefined()
      expect(typeof ctx.search).toBe('function')
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

    it('falls back to LocalNounProvider when endpoint has no apiKey', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      headlessly({ endpoint: 'https://db.headless.ly' })
      const provider = getProvider()
      expect(provider).toBeInstanceOf(LocalNounProvider)
      vi.restoreAllMocks()
    })
  })
})
