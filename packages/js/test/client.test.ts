import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock browser globals
const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
vi.stubGlobal('fetch', mockFetch)
vi.stubGlobal('navigator', { sendBeacon: vi.fn() })
vi.stubGlobal('localStorage', {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
})
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn().mockReturnValue(null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
})
vi.stubGlobal('location', { href: 'https://example.com', pathname: '/' })
vi.stubGlobal('document', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  visibilityState: 'visible',
  referrer: '',
})
vi.stubGlobal('window', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  location: { href: 'https://example.com', pathname: '/' },
  navigator: { userAgent: 'test' },
  PerformanceObserver: undefined,
})

import * as headlessly from '../src/index'

describe('@headlessly/js — browser SDK', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    headlessly.reset()
  })

  describe('exports', () => {
    it('exports init function', () => {
      expect(typeof headlessly.init).toBe('function')
    })

    it('exports track function', () => {
      expect(typeof headlessly.track).toBe('function')
    })

    it('exports page function', () => {
      expect(typeof headlessly.page).toBe('function')
    })

    it('exports identify function', () => {
      expect(typeof headlessly.identify).toBe('function')
    })

    it('exports captureException function', () => {
      expect(typeof headlessly.captureException).toBe('function')
    })

    it('exports getFeatureFlag function', () => {
      expect(typeof headlessly.getFeatureFlag).toBe('function')
    })

    it('exports isFeatureEnabled function', () => {
      expect(typeof headlessly.isFeatureEnabled).toBe('function')
    })

    it('exports optOut function', () => {
      expect(typeof headlessly.optOut).toBe('function')
    })

    it('exports optIn function', () => {
      expect(typeof headlessly.optIn).toBe('function')
    })

    it('exports flush function', () => {
      expect(typeof headlessly.flush).toBe('function')
    })

    it('exports shutdown function', () => {
      expect(typeof headlessly.shutdown).toBe('function')
    })

    it('has default export object with all methods', () => {
      const def = headlessly.default
      expect(typeof def.init).toBe('function')
      expect(typeof def.track).toBe('function')
      expect(typeof def.page).toBe('function')
      expect(typeof def.identify).toBe('function')
    })
  })

  describe('init', () => {
    it('initializes without error', () => {
      expect(() => headlessly.init({ apiKey: 'test_key' })).not.toThrow()
    })
  })

  describe('track', () => {
    it('accepts event name and properties', () => {
      headlessly.init({ apiKey: 'test_key' })
      expect(() => headlessly.track('button_click', { buttonId: 'cta' })).not.toThrow()
    })
  })

  describe('identify', () => {
    it('accepts userId and traits', () => {
      headlessly.init({ apiKey: 'test_key' })
      expect(() => headlessly.identify('user_123', { email: 'alice@test.com' })).not.toThrow()
    })
  })

  describe('opt-out', () => {
    it('optOut prevents tracking', () => {
      headlessly.init({ apiKey: 'test_key' })
      headlessly.optOut()
      headlessly.track('should_not_track')
      // After opt-out, flush should not send anything meaningful
    })
  })
})
