import { describe, it, expect, vi } from 'vitest'

// Mock @headlessly/js before importing react components
vi.mock('@headlessly/js', () => ({
  default: {
    init: vi.fn(),
    shutdown: vi.fn(),
    track: vi.fn(),
    page: vi.fn(),
    identify: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    getFeatureFlag: vi.fn().mockResolvedValue(undefined),
    isFeatureEnabled: vi.fn().mockResolvedValue(false),
    getSessionId: vi.fn().mockReturnValue('sess_123'),
    getDistinctId: vi.fn().mockReturnValue('anon_123'),
    setUser: vi.fn(),
    addBreadcrumb: vi.fn(),
  },
  init: vi.fn(),
  track: vi.fn(),
  page: vi.fn(),
  identify: vi.fn(),
  captureException: vi.fn(),
  getFeatureFlag: vi.fn().mockResolvedValue(undefined),
  isFeatureEnabled: vi.fn().mockResolvedValue(false),
}))

import * as ReactSDK from '../src/index'

describe('@headlessly/react — exports', () => {
  it('exports HeadlessProvider', () => {
    expect(ReactSDK.HeadlessProvider).toBeDefined()
    expect(typeof ReactSDK.HeadlessProvider).toBe('function')
  })

  it('exports useTrack hook', () => {
    expect(typeof ReactSDK.useTrack).toBe('function')
  })

  it('exports useFeatureFlag hook', () => {
    expect(typeof ReactSDK.useFeatureFlag).toBe('function')
  })

  it('exports useFeatureEnabled hook', () => {
    expect(typeof ReactSDK.useFeatureEnabled).toBe('function')
  })

  it('exports useCaptureException hook', () => {
    expect(typeof ReactSDK.useCaptureException).toBe('function')
  })

  it('exports ErrorBoundary component', () => {
    expect(ReactSDK.ErrorBoundary).toBeDefined()
  })

  it('exports Feature component', () => {
    expect(typeof ReactSDK.Feature).toBe('function')
  })

  it('exports PageView component', () => {
    expect(typeof ReactSDK.PageView).toBe('function')
  })
})
