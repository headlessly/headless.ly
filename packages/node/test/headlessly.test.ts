import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { headlessly } from '../src/headlessly.js'
import type { HeadlesslyNodeOptions } from '../src/headlessly.js'

describe('headlessly() — Node-specific initialization', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clean env vars before each test
    delete process.env.HEADLESSLY_ENDPOINT
    delete process.env.HEADLESSLY_API_KEY
    delete process.env.HEADLESSLY_TENANT
  })

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
  })

  // =========================================================================
  // Mode auto-detection
  // =========================================================================

  describe('mode auto-detection', () => {
    it('defaults to memory mode when no env vars set', () => {
      const result = headlessly()
      expect(result.mode).toBe('memory')
    })

    it('auto-detects remote mode when HEADLESSLY_ENDPOINT and HEADLESSLY_API_KEY are set', () => {
      process.env.HEADLESSLY_ENDPOINT = 'https://db.headless.ly'
      process.env.HEADLESSLY_API_KEY = 'hly_sk_test123'

      const result = headlessly()
      expect(result.mode).toBe('remote')
      expect(result.endpoint).toBe('https://db.headless.ly')
      expect(result.apiKey).toBe('hly_sk_test123')
    })

    it('falls back to memory when only endpoint is set (no apiKey)', () => {
      process.env.HEADLESSLY_ENDPOINT = 'https://db.headless.ly'

      const result = headlessly()
      expect(result.mode).toBe('memory')
    })

    it('falls back to memory when only apiKey is set (no endpoint)', () => {
      process.env.HEADLESSLY_API_KEY = 'hly_sk_test123'

      const result = headlessly()
      expect(result.mode).toBe('memory')
    })
  })

  // =========================================================================
  // Explicit mode selection
  // =========================================================================

  describe('explicit mode selection', () => {
    it('uses memory mode when explicitly specified', () => {
      const result = headlessly({ mode: 'memory' })
      expect(result.mode).toBe('memory')
    })

    it('uses local mode when explicitly specified', () => {
      const result = headlessly({ mode: 'local' })
      expect(result.mode).toBe('local')
    })

    it('uses remote mode when explicitly specified with options', () => {
      const result = headlessly({
        mode: 'remote',
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })
      expect(result.mode).toBe('remote')
      expect(result.endpoint).toBe('https://db.headless.ly')
      expect(result.apiKey).toBe('hly_sk_test123')
    })

    it('explicit mode overrides auto-detection', () => {
      process.env.HEADLESSLY_ENDPOINT = 'https://db.headless.ly'
      process.env.HEADLESSLY_API_KEY = 'hly_sk_test123'

      const result = headlessly({ mode: 'memory' })
      expect(result.mode).toBe('memory')
    })

    it('explicit mode: local even when remote env vars are set', () => {
      process.env.HEADLESSLY_ENDPOINT = 'https://db.headless.ly'
      process.env.HEADLESSLY_API_KEY = 'hly_sk_test123'

      const result = headlessly({ mode: 'local' })
      expect(result.mode).toBe('local')
    })
  })

  // =========================================================================
  // Environment variable reading
  // =========================================================================

  describe('environment variable reading', () => {
    it('reads HEADLESSLY_TENANT from env', () => {
      process.env.HEADLESSLY_TENANT = 'acme'

      const result = headlessly()
      expect(result.tenant).toBe('acme')
    })

    it('options override env vars', () => {
      process.env.HEADLESSLY_ENDPOINT = 'https://env-endpoint.example.com'
      process.env.HEADLESSLY_API_KEY = 'env_key'
      process.env.HEADLESSLY_TENANT = 'env-tenant'

      const result = headlessly({
        endpoint: 'https://custom-endpoint.example.com',
        apiKey: 'custom_key',
        tenant: 'custom-tenant',
      })
      expect(result.endpoint).toBe('https://custom-endpoint.example.com')
      expect(result.apiKey).toBe('custom_key')
      expect(result.tenant).toBe('custom-tenant')
    })

    it('falls back to env vars when options are not specified', () => {
      process.env.HEADLESSLY_ENDPOINT = 'https://db.headless.ly'
      process.env.HEADLESSLY_API_KEY = 'hly_sk_env'
      process.env.HEADLESSLY_TENANT = 'acme'

      const result = headlessly()
      expect(result.endpoint).toBe('https://db.headless.ly')
      expect(result.apiKey).toBe('hly_sk_env')
      expect(result.tenant).toBe('acme')
    })
  })

  // =========================================================================
  // Return value shape
  // =========================================================================

  describe('return value shape', () => {
    it('always returns an object with mode', () => {
      const result = headlessly()
      expect(result).toHaveProperty('mode')
      expect(typeof result.mode).toBe('string')
    })

    it('memory mode result has no endpoint or apiKey', () => {
      const result = headlessly({ mode: 'memory' })
      expect(result.endpoint).toBeUndefined()
      expect(result.apiKey).toBeUndefined()
    })

    it('remote mode result includes endpoint and apiKey', () => {
      const result = headlessly({
        mode: 'remote',
        endpoint: 'https://db.headless.ly',
        apiKey: 'hly_sk_test123',
      })
      expect(result.endpoint).toBe('https://db.headless.ly')
      expect(result.apiKey).toBe('hly_sk_test123')
    })

    it('local mode result has no endpoint or apiKey', () => {
      const result = headlessly({ mode: 'local', tenant: 'test' })
      expect(result.endpoint).toBeUndefined()
      expect(result.apiKey).toBeUndefined()
    })

    it('tenant is returned when provided', () => {
      const result = headlessly({ tenant: 'acme' })
      expect(result.tenant).toBe('acme')
    })

    it('tenant is undefined when not provided and env var not set', () => {
      const result = headlessly()
      expect(result.tenant).toBeUndefined()
    })
  })

  // =========================================================================
  // No-arg call
  // =========================================================================

  describe('no-arg call', () => {
    it('works with no arguments at all', () => {
      const result = headlessly()
      expect(result).toBeDefined()
      expect(result.mode).toBe('memory')
    })

    it('works with empty options object', () => {
      const result = headlessly({})
      expect(result).toBeDefined()
      expect(result.mode).toBe('memory')
    })
  })
})
