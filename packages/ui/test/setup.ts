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
