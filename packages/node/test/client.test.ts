import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock fetch for Node
const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
vi.stubGlobal('fetch', mockFetch)

import { HeadlessNodeClient, createClient } from '../src/index'

describe('@headlessly/node — Node.js SDK', () => {
  let client: HeadlessNodeClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = createClient({ apiKey: 'test_key' })
  })

  describe('exports', () => {
    it('exports HeadlessNodeClient class', () => {
      expect(HeadlessNodeClient).toBeDefined()
    })

    it('exports createClient function', () => {
      expect(typeof createClient).toBe('function')
    })

    it('createClient returns HeadlessNodeClient instance', () => {
      const c = createClient({ apiKey: 'test_key' })
      expect(c).toBeInstanceOf(HeadlessNodeClient)
    })
  })

  describe('track', () => {
    it('accepts event name and properties', () => {
      expect(() => client.track('page_view', { path: '/home' })).not.toThrow()
    })

    it('accepts event with distinctId', () => {
      expect(() => client.track('signup', { plan: 'pro' }, 'user_123')).not.toThrow()
    })
  })

  describe('identify', () => {
    it('accepts userId and traits', () => {
      expect(() => client.identify('user_123', { email: 'bob@test.com' })).not.toThrow()
    })
  })

  describe('captureException', () => {
    it('captures an error and returns event id', () => {
      const eventId = client.captureException(new Error('test error'))
      expect(eventId).toBeDefined()
      expect(typeof eventId).toBe('string')
    })

    it('captures with context', () => {
      const eventId = client.captureException(new Error('test'), 'user_123', { extra: 'data' } as any)
      expect(eventId).toBeDefined()
    })
  })

  describe('captureMessage', () => {
    it('captures a message', () => {
      const eventId = client.captureMessage('Something happened')
      expect(eventId).toBeDefined()
      expect(typeof eventId).toBe('string')
    })
  })

  describe('middleware', () => {
    it('returns a middleware function', () => {
      const mw = client.middleware()
      expect(typeof mw).toBe('function')
    })
  })

  describe('flush', () => {
    it('flushes without error when queue is empty', async () => {
      await expect(client.flush()).resolves.not.toThrow()
    })
  })

  describe('feature flags', () => {
    it('getFeatureFlag returns undefined for unknown flag', async () => {
      const value = await client.getFeatureFlag('unknown_flag', 'user_123')
      expect(value).toBeUndefined()
    })

    it('isFeatureEnabled returns false for unknown flag', async () => {
      const enabled = await client.isFeatureEnabled('unknown_flag', 'user_123')
      expect(enabled).toBe(false)
    })
  })
})
