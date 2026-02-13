import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { clearRegistry, setProvider, MemoryNounProvider } from 'digital-objects'

// Fresh in-memory backend for every test
beforeEach(() => {
  clearRegistry()
  setProvider(new MemoryNounProvider())
})

afterEach(() => {
  cleanup()
})

// Mock browser APIs not available in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

class IntersectionObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds = [] as number[]
  takeRecords = vi.fn().mockReturnValue([])
  constructor(_cb: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
}
globalThis.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver

// jsdom's nwsapi can't parse Tailwind v4's group/name CSS selectors (e.g. group/menu-item).
// The escaped slash in selectors like `.group\/menu-item` causes SyntaxError in nwsapi.
// These work fine in real browsers — suppress the errors in tests.
for (const method of ['querySelector', 'querySelectorAll', 'matches', 'closest'] as const) {
  const original = Element.prototype[method] as Function
  if (!original) continue
  const fallback = method === 'querySelectorAll' ? [] : method === 'matches' ? false : null
  ;(Element.prototype as any)[method] = function (...args: any[]) {
    try {
      return original.apply(this, args)
    } catch (e: any) {
      if (e?.name === 'SyntaxError' && String(e?.message || '').includes('is not a valid selector')) {
        return fallback
      }
      throw e
    }
  }
}
