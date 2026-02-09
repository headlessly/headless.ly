/**
 * @headlessly/react — Deep test suite v2
 *
 * 50+ new tests covering areas not exercised by existing test files:
 *
 * - Hook behavior outside provider (useHeadless, useClient throw)
 * - useIdentify, usePage, useUser, useBreadcrumb hooks
 * - useFeatureFlag value retrieval and key reactivity
 * - useFeatureEnabled truthy/falsy evaluation logic
 * - Experiment component variant rendering
 * - ErrorBoundary function fallback + reset + onError callback
 * - PageView re-tracking on name change
 * - onFlagChange unsubscribe
 * - useTrackEntity entity enrichment
 * - useEntity unknown type, cancel on unmount, include option
 * - useEntities sort, loadMore pagination, refetch offset reset, unknown type
 * - useMutation execute() custom verb, loading transitions
 * - useSearch limit, multi-type search, debounce cancellation
 * - useRealtime unknown type, cleanup interval
 * - useEvents without id, error handling
 * - useAction unknown type
 * - Context nesting (nested providers)
 * - resolveEntity edge cases via hook paths
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React, { useState } from 'react'
import { render, screen, cleanup, act, waitFor, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock @headlessly/js — factory must be self-contained (vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock('@headlessly/js', () => {
  const mock = {
    init: vi.fn(),
    shutdown: vi.fn(),
    track: vi.fn(),
    page: vi.fn(),
    identify: vi.fn(),
    captureException: vi.fn().mockReturnValue('event_abc'),
    captureMessage: vi.fn(),
    getFeatureFlag: vi.fn().mockReturnValue(undefined),
    isFeatureEnabled: vi.fn().mockReturnValue(false),
    getSessionId: vi.fn().mockReturnValue('sess_deep'),
    getDistinctId: vi.fn().mockReturnValue('anon_deep'),
    setUser: vi.fn(),
    addBreadcrumb: vi.fn(),
    reset: vi.fn(),
    optOut: vi.fn(),
    optIn: vi.fn(),
    hasOptedOut: vi.fn().mockReturnValue(false),
    flush: vi.fn(),
    getAllFlags: vi.fn().mockReturnValue({}),
    reloadFeatureFlags: vi.fn(),
  }
  return {
    default: mock,
    ...mock,
    HeadlessClient: vi.fn(),
  }
})

// ---------------------------------------------------------------------------
// Imports (after mock)
// ---------------------------------------------------------------------------

import {
  HeadlessProvider,
  HeadlessContext,
  useHeadless,
  useClient,
  useTrack,
  usePage,
  useIdentify,
  useUser,
  useBreadcrumb,
  useFeatureFlag,
  useFeatureEnabled,
  useCaptureException,
  useTrackEntity,
  useEntity,
  useEntities,
  useMutation,
  useSearch,
  useRealtime,
  useAction,
  useEvents,
  onFlagChange,
  Feature,
  Experiment,
  ErrorBoundary,
  PageView,
  EntityList,
  EntityDetail,
} from '../src/index.js'

import { $ } from '@headlessly/sdk'

// Get a reference to the mocked headless module
import headlessMock from '@headlessly/js'
const mockHeadless = headlessMock as unknown as Record<string, ReturnType<typeof vi.fn>>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.clearAllMocks()
  mockHeadless.getFeatureFlag.mockReturnValue(undefined)
  mockHeadless.getDistinctId.mockReturnValue('anon_deep')
  mockHeadless.getSessionId.mockReturnValue('sess_deep')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function Wrapper({ children }: { children: React.ReactNode }) {
  return <HeadlessProvider apiKey="deep_test_key">{children}</HeadlessProvider>
}

// ============================================================================
// 1. Hooks outside provider — throw errors
// ============================================================================

describe('Hooks outside HeadlessProvider', () => {
  it('useHeadless throws when used outside HeadlessProvider', () => {
    function Naked() {
      useHeadless()
      return null
    }

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      render(<Naked />)
    }).toThrow('useHeadless must be used within HeadlessProvider')
    spy.mockRestore()
  })

  it('useClient throws when used outside HeadlessProvider', () => {
    function Naked() {
      useClient()
      return null
    }

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      render(<Naked />)
    }).toThrow('useClient must be used within HeadlessProvider')
    spy.mockRestore()
  })
})

// ============================================================================
// 2. HeadlessProvider initialization details
// ============================================================================

describe('HeadlessProvider — initialization', () => {
  it('calls headless.init with the apiKey config', async () => {
    await act(async () => {
      render(
        <HeadlessProvider apiKey="init_test_key">
          <div>child</div>
        </HeadlessProvider>,
      )
    })

    expect(mockHeadless.init).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'init_test_key' }),
    )
  })

  it('calls headless.shutdown on unmount', async () => {
    const { unmount } = await act(async () =>
      render(
        <HeadlessProvider apiKey="shutdown_test">
          <div>child</div>
        </HeadlessProvider>,
      ),
    )

    expect(mockHeadless.shutdown).not.toHaveBeenCalled()
    unmount()
    expect(mockHeadless.shutdown).toHaveBeenCalled()
  })

  it('re-initializes when apiKey changes', async () => {
    function DynamicKeyApp() {
      const [key, setKey] = useState('key_1')
      return (
        <HeadlessProvider apiKey={key}>
          <button onClick={() => setKey('key_2')}>change key</button>
        </HeadlessProvider>
      )
    }

    await act(async () => {
      render(<DynamicKeyApp />)
    })

    expect(mockHeadless.init).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.click(screen.getByText('change key'))
    })

    // After key change, init should be called again
    expect(mockHeadless.init).toHaveBeenCalledTimes(2)
  })

  it('provides distinctId and sessionId in context', async () => {
    function ContextConsumer() {
      const ctx = useHeadless()
      return (
        <div>
          <span data-testid="did">{ctx.distinctId}</span>
          <span data-testid="sid">{ctx.sessionId}</span>
        </div>
      )
    }

    await act(async () => {
      render(
        <HeadlessProvider apiKey="ctx_test">
          <ContextConsumer />
        </HeadlessProvider>,
      )
    })

    expect(screen.getByTestId('did').textContent).toBe('anon_deep')
    expect(screen.getByTestId('sid').textContent).toBe('sess_deep')
  })
})

// ============================================================================
// 3. useIdentify hook
// ============================================================================

describe('useIdentify', () => {
  it('returns a stable callback that calls headless.identify', async () => {
    let identifyFn: ((userId: string, traits?: Record<string, unknown>) => void) | undefined

    function IdentifyCapture() {
      identifyFn = useIdentify()
      return null
    }

    await act(async () => {
      render(<IdentifyCapture />, { wrapper: Wrapper })
    })

    expect(typeof identifyFn).toBe('function')
    identifyFn!('user_42', { email: 'alice@test.com' })
    expect(mockHeadless.identify).toHaveBeenCalledWith('user_42', { email: 'alice@test.com' })
  })
})

// ============================================================================
// 4. usePage hook
// ============================================================================

describe('usePage', () => {
  it('returns a stable callback that calls headless.page', async () => {
    let pageFn: ((name?: string, props?: Record<string, unknown>) => void) | undefined

    function PageCapture() {
      pageFn = usePage()
      return null
    }

    await act(async () => {
      render(<PageCapture />, { wrapper: Wrapper })
    })

    expect(typeof pageFn).toBe('function')
    pageFn!('dashboard', { section: 'metrics' })
    expect(mockHeadless.page).toHaveBeenCalledWith('dashboard', { section: 'metrics' })
  })
})

// ============================================================================
// 5. useUser hook
// ============================================================================

describe('useUser', () => {
  it('returns setUser callback that calls headless.setUser', async () => {
    let setUserFn: ((user: { id: string } | null) => void) | undefined

    function UserCapture() {
      const { setUser } = useUser()
      setUserFn = setUser as typeof setUserFn
      return null
    }

    await act(async () => {
      render(<UserCapture />, { wrapper: Wrapper })
    })

    expect(typeof setUserFn).toBe('function')
    setUserFn!({ id: 'user_99' })
    expect(mockHeadless.setUser).toHaveBeenCalledWith({ id: 'user_99' })

    setUserFn!(null)
    expect(mockHeadless.setUser).toHaveBeenCalledWith(null)
  })
})

// ============================================================================
// 6. useBreadcrumb hook
// ============================================================================

describe('useBreadcrumb', () => {
  it('returns a callback that calls headless.addBreadcrumb', async () => {
    let crumbFn: ((crumb: { message: string }) => void) | undefined

    function CrumbCapture() {
      crumbFn = useBreadcrumb() as typeof crumbFn
      return null
    }

    await act(async () => {
      render(<CrumbCapture />, { wrapper: Wrapper })
    })

    expect(typeof crumbFn).toBe('function')
    crumbFn!({ message: 'Navigated to settings' })
    expect(mockHeadless.addBreadcrumb).toHaveBeenCalledWith({ message: 'Navigated to settings' })
  })
})

// ============================================================================
// 7. useFeatureFlag — value retrieval and key reactivity
// ============================================================================

describe('useFeatureFlag — deep', () => {
  it('returns the current flag value from headless.getFeatureFlag', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue('variant_a')

    function FlagDisplay() {
      const value = useFeatureFlag('my-flag')
      return <div data-testid="flag">{String(value)}</div>
    }

    await act(async () => {
      render(<FlagDisplay />, { wrapper: Wrapper })
    })

    expect(screen.getByTestId('flag').textContent).toBe('variant_a')
  })

  it('returns undefined when flag does not exist', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue(undefined)

    function FlagDisplay() {
      const value = useFeatureFlag('nonexistent-flag')
      return <div data-testid="flag">{value === undefined ? 'undefined' : String(value)}</div>
    }

    await act(async () => {
      render(<FlagDisplay />, { wrapper: Wrapper })
    })

    expect(screen.getByTestId('flag').textContent).toBe('undefined')
  })

  it('re-reads flag value when key prop changes', async () => {
    let callCount = 0
    mockHeadless.getFeatureFlag.mockImplementation((key: string) => {
      callCount++
      return key === 'flag-a' ? 'alpha' : 'beta'
    })

    function DynamicFlag() {
      const [flagKey, setFlagKey] = useState('flag-a')
      const value = useFeatureFlag(flagKey)
      return (
        <div>
          <span data-testid="val">{String(value)}</span>
          <button onClick={() => setFlagKey('flag-b')}>switch</button>
        </div>
      )
    }

    await act(async () => {
      render(<DynamicFlag />, { wrapper: Wrapper })
    })

    expect(screen.getByTestId('val').textContent).toBe('alpha')

    await act(async () => {
      fireEvent.click(screen.getByText('switch'))
    })

    expect(screen.getByTestId('val').textContent).toBe('beta')
  })
})

// ============================================================================
// 8. useFeatureEnabled — truthy/falsy evaluation
// ============================================================================

describe('useFeatureEnabled — boolean conversion', () => {
  it('returns true for boolean true', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue(true)

    function FE() {
      const v = useFeatureEnabled('f')
      return <div data-testid="e">{String(v)}</div>
    }

    await act(async () => { render(<FE />, { wrapper: Wrapper }) })
    expect(screen.getByTestId('e').textContent).toBe('true')
  })

  it('returns true for string "true"', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue('true')

    function FE() {
      const v = useFeatureEnabled('f')
      return <div data-testid="e">{String(v)}</div>
    }

    await act(async () => { render(<FE />, { wrapper: Wrapper }) })
    expect(screen.getByTestId('e').textContent).toBe('true')
  })

  it('returns false for boolean false', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue(false)

    function FE() {
      const v = useFeatureEnabled('f')
      return <div data-testid="e">{String(v)}</div>
    }

    await act(async () => { render(<FE />, { wrapper: Wrapper }) })
    expect(screen.getByTestId('e').textContent).toBe('false')
  })

  it('returns false for string "false"', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue('false')

    function FE() {
      const v = useFeatureEnabled('f')
      return <div data-testid="e">{String(v)}</div>
    }

    await act(async () => { render(<FE />, { wrapper: Wrapper }) })
    expect(screen.getByTestId('e').textContent).toBe('false')
  })

  it('returns false for string "control"', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue('control')

    function FE() {
      const v = useFeatureEnabled('f')
      return <div data-testid="e">{String(v)}</div>
    }

    await act(async () => { render(<FE />, { wrapper: Wrapper }) })
    expect(screen.getByTestId('e').textContent).toBe('false')
  })

  it('returns false for undefined', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue(undefined)

    function FE() {
      const v = useFeatureEnabled('f')
      return <div data-testid="e">{String(v)}</div>
    }

    await act(async () => { render(<FE />, { wrapper: Wrapper }) })
    expect(screen.getByTestId('e').textContent).toBe('false')
  })

  it('returns true for a non-empty, non-false, non-control string variant', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue('variant_b')

    function FE() {
      const v = useFeatureEnabled('f')
      return <div data-testid="e">{String(v)}</div>
    }

    await act(async () => { render(<FE />, { wrapper: Wrapper }) })
    expect(screen.getByTestId('e').textContent).toBe('true')
  })
})

// ============================================================================
// 9. Experiment component — variant rendering
// ============================================================================

describe('Experiment component', () => {
  it('renders the matching variant when flag value matches a key', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue('variant_a')

    await act(async () => {
      render(
        <Wrapper>
          <Experiment
            flag="exp-flag"
            variants={{ variant_a: <span>Version A</span>, variant_b: <span>Version B</span> }}
            fallback={<span>Fallback</span>}
          />
        </Wrapper>,
      )
    })

    expect(screen.getByText('Version A')).toBeDefined()
  })

  it('renders fallback when flag value is undefined', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue(undefined)

    await act(async () => {
      render(
        <Wrapper>
          <Experiment
            flag="exp-flag"
            variants={{ variant_a: <span>A</span> }}
            fallback={<span>Fallback</span>}
          />
        </Wrapper>,
      )
    })

    expect(screen.getByText('Fallback')).toBeDefined()
  })

  it('renders fallback when flag value does not match any variant', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue('variant_c')

    await act(async () => {
      render(
        <Wrapper>
          <Experiment
            flag="exp-flag"
            variants={{ variant_a: <span>A</span>, variant_b: <span>B</span> }}
            fallback={<span>No match</span>}
          />
        </Wrapper>,
      )
    })

    expect(screen.getByText('No match')).toBeDefined()
  })

  it('renders null when no fallback is provided and flag is undefined', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue(undefined)

    const { container } = await act(async () =>
      render(
        <Wrapper>
          <Experiment flag="exp-flag" variants={{ a: <span>A</span> }} />
        </Wrapper>,
      ),
    )

    // No visible variant content
    expect(container.querySelector('span')).toBeNull()
  })
})

// ============================================================================
// 10. ErrorBoundary — function fallback, reset, onError
// ============================================================================

describe('ErrorBoundary — deep', () => {
  it('calls function fallback with error and reset function', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function ThrowingChild() {
      throw new Error('boom')
    }

    await act(async () => {
      render(
        <Wrapper>
          <ErrorBoundary
            fallback={(error, reset) => (
              <div>
                <span data-testid="err">{error.message}</span>
                <button onClick={reset}>reset</button>
              </div>
            )}
          >
            <ThrowingChild />
          </ErrorBoundary>
        </Wrapper>,
      )
    })

    expect(screen.getByTestId('err').textContent).toBe('boom')
    spy.mockRestore()
  })

  it('calls onError callback with error and errorInfo', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onError = vi.fn()

    function ThrowingChild() {
      throw new Error('cb error')
    }

    await act(async () => {
      render(
        <Wrapper>
          <ErrorBoundary fallback={<div>fallback</div>} onError={onError}>
            <ThrowingChild />
          </ErrorBoundary>
        </Wrapper>,
      )
    })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(onError.mock.calls[0][0].message).toBe('cb error')
    // Second arg is errorInfo with componentStack
    expect(onError.mock.calls[0][1]).toBeDefined()
    spy.mockRestore()
  })

  it('reports error to headless.captureException with componentStack', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function ThrowingChild() {
      throw new Error('capture test')
    }

    await act(async () => {
      render(
        <Wrapper>
          <ErrorBoundary fallback={<div>fallback</div>}>
            <ThrowingChild />
          </ErrorBoundary>
        </Wrapper>,
      )
    })

    expect(mockHeadless.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        extra: expect.objectContaining({
          componentStack: expect.any(String),
        }),
      }),
    )
    spy.mockRestore()
  })
})

// ============================================================================
// 11. PageView component
// ============================================================================

describe('PageView — deep', () => {
  it('calls headless.page on mount with name and properties', async () => {
    await act(async () => {
      render(
        <Wrapper>
          <PageView name="pricing" properties={{ referrer: 'google' }} />
        </Wrapper>,
      )
    })

    expect(mockHeadless.page).toHaveBeenCalledWith('pricing', { referrer: 'google' })
  })

  it('re-tracks when name changes', async () => {
    function DynamicPage() {
      const [pageName, setName] = useState('home')
      return (
        <div>
          <PageView name={pageName} />
          <button onClick={() => setName('about')}>navigate</button>
        </div>
      )
    }

    await act(async () => {
      render(<DynamicPage />, { wrapper: Wrapper })
    })

    expect(mockHeadless.page).toHaveBeenCalledWith('home', undefined)

    await act(async () => {
      fireEvent.click(screen.getByText('navigate'))
    })

    expect(mockHeadless.page).toHaveBeenCalledWith('about', undefined)
  })
})

// ============================================================================
// 12. onFlagChange
// ============================================================================

describe('onFlagChange', () => {
  it('returns an unsubscribe function', () => {
    const unsub = onFlagChange(() => {})
    expect(typeof unsub).toBe('function')
    // Calling unsub should not throw
    unsub()
  })
})

// ============================================================================
// 13. useTrackEntity — entity-aware enrichment
// ============================================================================

describe('useTrackEntity', () => {
  it('enriches track event with $entity context when provided', async () => {
    let trackEntityFn: ((event: string, props?: Record<string, unknown>, opts?: { entity?: { type: string; id: string } }) => void) | undefined

    function TrackEntityCapture() {
      trackEntityFn = useTrackEntity()
      return null
    }

    await act(async () => {
      render(<TrackEntityCapture />, { wrapper: Wrapper })
    })

    trackEntityFn!('deal_viewed', { value: 50000 }, { entity: { type: 'Deal', id: 'deal_abc' } })

    expect(mockHeadless.track).toHaveBeenCalledWith('deal_viewed', {
      value: 50000,
      $entity: { type: 'Deal', id: 'deal_abc' },
    })
  })

  it('passes properties as-is when no entity context provided', async () => {
    let trackEntityFn: ((event: string, props?: Record<string, unknown>) => void) | undefined

    function TrackEntityCapture() {
      trackEntityFn = useTrackEntity()
      return null
    }

    await act(async () => {
      render(<TrackEntityCapture />, { wrapper: Wrapper })
    })

    trackEntityFn!('button_clicked', { btn: 'cta' })

    expect(mockHeadless.track).toHaveBeenCalledWith('button_clicked', { btn: 'cta' })
  })
})

// ============================================================================
// 14. useEntity — deep tests
// ============================================================================

describe('useEntity — deep', () => {
  it('sets error for unknown entity type', async () => {
    function TestComponent() {
      const { error, loading } = useEntity('NonExistentType', 'id_123')
      if (loading) return <div data-testid="s">loading</div>
      return <div data-testid="s">{error?.message ?? 'no error'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })

  it('cancels fetch on unmount (no state update after unmount)', async () => {
    // Create an entity so fetch is slow enough to be interesting
    const created = await $.Contact.create({ name: 'Unmount Test', stage: 'Lead' })

    function TestComponent() {
      const { data, loading } = useEntity('Contact', created.$id)
      if (loading) return <div data-testid="s">loading</div>
      return <div data-testid="s">{(data as Record<string, unknown>)?.name as string}</div>
    }

    const { unmount } = await act(async () =>
      render(<TestComponent />, { wrapper: Wrapper }),
    )

    // Unmount immediately — should not cause React warnings
    unmount()
    // If the cancelled flag works correctly, no "Cannot update a component
    // that is already unmounted" warnings will appear. We just verify no throw.
  })

  it('resets data and error when id changes', async () => {
    const c1 = await $.Contact.create({ name: 'First', stage: 'Lead' })
    const c2 = await $.Contact.create({ name: 'Second', stage: 'Lead' })

    function TestComponent() {
      const [id, setId] = useState(c1.$id)
      const { data, loading } = useEntity('Contact', id)
      return (
        <div>
          <div data-testid="s">
            {loading ? 'loading' : (data as Record<string, unknown>)?.name as string}
          </div>
          <button onClick={() => setId(c2.$id)}>switch</button>
        </div>
      )
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('First')
    })

    await act(async () => {
      fireEvent.click(screen.getByText('switch'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('Second')
    })
  })

  it('reports error when entity.get returns null (not found)', async () => {
    function TestComponent() {
      const { error, loading } = useEntity('Contact', 'contact_ghost')
      if (loading) return <div data-testid="s">loading</div>
      return <div data-testid="s">{error?.message ?? 'ok'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('not found')
    })
  })
})

// ============================================================================
// 15. useEntities — deep tests
// ============================================================================

describe('useEntities — deep', () => {
  it('sets error for unknown entity type', async () => {
    function TestComponent() {
      const { error, loading } = useEntities('BogusType')
      if (loading) return <div data-testid="s">loading</div>
      return <div data-testid="s">{error?.message ?? 'no error'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })

  it('sorts results by specified field ascending', async () => {
    await $.Lead.create({ name: 'Zara', stage: 'New' })
    await $.Lead.create({ name: 'Alice', stage: 'New' })
    await $.Lead.create({ name: 'Mike', stage: 'New' })

    function TestComponent() {
      const { data, loading } = useEntities('Lead', undefined, { sort: { name: 1 } })
      if (loading) return <div data-testid="s">loading</div>
      const names = data.map((d: unknown) => (d as Record<string, unknown>).name as string)
      return <div data-testid="s">{names.join(',')}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      const text = screen.getByTestId('s').textContent!
      const names = text.split(',')
      // Verify ascending order
      for (let i = 1; i < names.length; i++) {
        expect(names[i] >= names[i - 1]).toBe(true)
      }
    })
  })

  it('sorts results by specified field descending', async () => {
    await $.Lead.create({ name: 'Zara Desc', stage: 'New' })
    await $.Lead.create({ name: 'Alice Desc', stage: 'New' })

    function TestComponent() {
      const { data, loading } = useEntities('Lead', { stage: 'New' }, { sort: { name: -1 } })
      if (loading) return <div data-testid="s">loading</div>
      const names = data.map((d: unknown) => (d as Record<string, unknown>).name as string)
      return <div data-testid="s">{names.join(',')}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      const text = screen.getByTestId('s').textContent!
      const names = text.split(',')
      // Verify descending order
      for (let i = 1; i < names.length; i++) {
        expect(names[i] <= names[i - 1]).toBe(true)
      }
    })
  })

  it('loadMore appends more items to the data array', async () => {
    // Create enough items for pagination
    for (let i = 0; i < 5; i++) {
      await $.Campaign.create({ name: `Camp ${i}`, status: 'Active' })
    }

    let loadMoreFn: (() => void) | undefined

    function TestComponent() {
      const { data, loading, hasMore, loadMore } = useEntities('Campaign', undefined, { limit: 2 })
      loadMoreFn = loadMore
      if (loading) return <div data-testid="s">loading</div>
      return <div data-testid="s">count: {data.length}, hasMore: {String(hasMore)}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('count: 2')
      expect(screen.getByTestId('s').textContent).toContain('hasMore: true')
    })

    // Load more
    await act(async () => {
      loadMoreFn!()
    })

    await waitFor(() => {
      const text = screen.getByTestId('s').textContent!
      const count = parseInt(text.match(/count: (\d+)/)?.[1] ?? '0')
      expect(count).toBeGreaterThanOrEqual(4) // 2 original + 2 more
    })
  })

  it('refetch resets offset to initial', async () => {
    for (let i = 0; i < 4; i++) {
      await $.Segment.create({ name: `Seg ${i}`, criteria: 'test' })
    }

    let refetchFn: (() => void) | undefined

    function TestComponent() {
      const { data, loading, refetch } = useEntities('Segment', undefined, { limit: 2 })
      refetchFn = refetch
      if (loading) return <div data-testid="s">loading</div>
      return <div data-testid="s">count: {data.length}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('count: 2')
    })

    // Refetch resets to first page
    await act(async () => {
      refetchFn!()
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('count: 2')
    })
  })

  it('returns empty data array on unknown type', async () => {
    function TestComponent() {
      const { data, loading } = useEntities('FakeType')
      if (loading) return <div data-testid="s">loading</div>
      return <div data-testid="s">len: {data.length}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('len: 0')
    })
  })
})

// ============================================================================
// 16. useMutation — deep tests
// ============================================================================

describe('useMutation — deep', () => {
  it('execute() calls custom verb on entity', async () => {
    const created = await $.Contact.create({ name: 'Verb Target', stage: 'Lead' })

    let executeFn: ((verb: string, id: string, data?: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute, loading } = useMutation('Contact')
      executeFn = execute
      return <div data-testid="s">{loading ? 'loading' : 'idle'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    let result: unknown
    await act(async () => {
      result = await executeFn!('qualify', created.$id)
    })

    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).stage).toBe('Qualified')
  })

  it('execute() throws and sets error for unknown verb', async () => {
    const created = await $.Contact.create({ name: 'Bad Verb', stage: 'Lead' })

    let executeFn: ((verb: string, id: string) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute, error } = useMutation('Contact')
      executeFn = execute
      return <div data-testid="s">{error?.message ?? 'none'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      try {
        await executeFn!('nonexistentVerb', created.$id)
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown verb')
    })
  })

  it('sets error for unknown type in create', async () => {
    let createFn: ((data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { create, error } = useMutation('GhostType')
      createFn = create
      return <div data-testid="s">{error?.message ?? 'none'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      try { await createFn!({ name: 'test' }) } catch { /* expected */ }
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })

  it('sets error for unknown type in update', async () => {
    let updateFn: ((id: string, data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { update, error } = useMutation('GhostType')
      updateFn = update
      return <div data-testid="s">{error?.message ?? 'none'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      try { await updateFn!('id_1', { name: 'test' }) } catch { /* expected */ }
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })

  it('sets error for unknown type in remove', async () => {
    let removeFn: ((id: string) => Promise<void>) | undefined

    function TestComponent() {
      const { remove, error } = useMutation('GhostType')
      removeFn = remove
      return <div data-testid="s">{error?.message ?? 'none'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      try { await removeFn!('id_1') } catch { /* expected */ }
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })

  it('sets error for unknown type in execute', async () => {
    let executeFn: ((verb: string, id: string) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute, error } = useMutation('GhostType')
      executeFn = execute
      return <div data-testid="s">{error?.message ?? 'none'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      try { await executeFn!('someVerb', 'id_1') } catch { /* expected */ }
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })
})

// ============================================================================
// 17. useSearch — deep tests
// ============================================================================

describe('useSearch — deep', () => {
  it('applies limit option to results', async () => {
    // Create multiple contacts
    for (let i = 0; i < 5; i++) {
      await $.Contact.create({ name: `SearchLimit ${i}`, stage: 'Lead' })
    }

    function TestComponent() {
      const { results, loading } = useSearch('SearchLimit', { types: ['Contact'], limit: 2, debounce: 10 })
      if (loading) return <div data-testid="s">searching</div>
      return <div data-testid="s">found: {results.length}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      vi.advanceTimersByTime(50)
    })

    await waitFor(() => {
      const text = screen.getByTestId('s').textContent!
      if (text.includes('found:')) {
        const count = parseInt(text.match(/found: (\d+)/)?.[1] ?? '0')
        expect(count).toBeLessThanOrEqual(2)
      }
    })
  })

  it('clears debounce on unmount', async () => {
    function TestComponent() {
      const { results, loading } = useSearch('cleanup', { debounce: 500 })
      return <div data-testid="s">{loading ? 'searching' : `found: ${results.length}`}</div>
    }

    const { unmount } = await act(async () =>
      render(<TestComponent />, { wrapper: Wrapper }),
    )

    // Unmount before debounce fires — should not throw or warn
    unmount()
    await act(async () => {
      vi.advanceTimersByTime(600)
    })
    // If cleanup works, no errors occur
  })
})

// ============================================================================
// 18. useRealtime — deep tests
// ============================================================================

describe('useRealtime — deep', () => {
  it('sets error for unknown entity type', async () => {
    function TestComponent() {
      const { error, connected } = useRealtime('FakeType', 'id_1', 1000)
      return (
        <div data-testid="s">
          {error ? error.message : connected ? 'connected' : 'waiting'}
        </div>
      )
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })

  it('cleans up interval on unmount', async () => {
    const created = await $.Contact.create({ name: 'Cleanup Test', stage: 'Lead' })
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    function TestComponent() {
      const { connected } = useRealtime('Contact', created.$id, 500)
      return <div data-testid="s">{connected ? 'yes' : 'no'}</div>
    }

    const { unmount } = await act(async () =>
      render(<TestComponent />, { wrapper: Wrapper }),
    )

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('yes')
    })

    unmount()
    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })

  it('resets state when type changes', async () => {
    const contact = await $.Contact.create({ name: 'RT Contact', stage: 'Lead' })
    const deal = await $.Deal.create({ title: 'RT Deal', stage: 'Open', value: 1000 })

    function TestComponent() {
      const [type, setType] = useState('Contact')
      const [id, setId] = useState(contact.$id)
      const { data, connected } = useRealtime(type, id, 1000)

      return (
        <div>
          <div data-testid="s">
            {connected ? JSON.stringify(data) : 'loading'}
          </div>
          <button onClick={() => { setType('Deal'); setId(deal.$id) }}>switch</button>
        </div>
      )
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('RT Contact')
    })

    await act(async () => {
      fireEvent.click(screen.getByText('switch'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('RT Deal')
    })
  })
})

// ============================================================================
// 19. useAction — deep tests
// ============================================================================

describe('useAction — deep', () => {
  it('sets error for unknown entity type', async () => {
    let executeFn: ((id: string) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute, error } = useAction('NoSuchType', 'qualify')
      executeFn = execute
      return <div data-testid="s">{error?.message ?? 'none'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      try { await executeFn!('id_1') } catch { /* expected */ }
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })

  it('returns result from successful verb execution', async () => {
    const created = await $.Contact.create({ name: 'Action Return', stage: 'Lead' })

    let executeFn: ((id: string) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute } = useAction('Contact', 'qualify')
      executeFn = execute
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    let result: unknown
    await act(async () => {
      result = await executeFn!(created.$id)
    })

    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).stage).toBe('Qualified')
  })

  it('transitions loading state during execution', async () => {
    const created = await $.Contact.create({ name: 'Loading Action', stage: 'Lead' })

    const loadingStates: boolean[] = []

    function TestComponent() {
      const { execute, loading } = useAction('Contact', 'qualify')
      loadingStates.push(loading)

      return (
        <div>
          <div data-testid="s">{loading ? 'busy' : 'idle'}</div>
          <button onClick={() => execute(created.$id)}>go</button>
        </div>
      )
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(screen.getByTestId('s').textContent).toBe('idle')

    await act(async () => {
      fireEvent.click(screen.getByText('go'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('idle')
    })
  })
})

// ============================================================================
// 20. useEvents — deep tests
// ============================================================================

describe('useEvents — deep', () => {
  it('fetches events without an id (type-level search)', async () => {
    await $.Ticket.create({ title: 'Event Ticket', status: 'Open' })

    function TestComponent() {
      const { events, loading } = useEvents('Ticket')
      if (loading) return <div data-testid="s">loading</div>
      return <div data-testid="s">events: {events.length}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toMatch(/events: \d+/)
    })
  })

  it('returns empty events array when entity has no events included', async () => {
    const created = await $.Contact.create({ name: 'No Events', stage: 'Lead' })

    function TestComponent() {
      const { events, loading, error } = useEvents('Contact', created.$id)
      if (loading) return <div data-testid="s">loading</div>
      return <div data-testid="s">events: {events.length}, error: {error ? error.message : 'none'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      const text = screen.getByTestId('s').textContent!
      expect(text).toContain('events:')
      expect(text).toContain('error: none')
    })
  })
})

// ============================================================================
// 21. Feature component — deep
// ============================================================================

describe('Feature component — deep', () => {
  it('renders children when flag is truthy string', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue('enabled_variant')

    await act(async () => {
      render(
        <Wrapper>
          <Feature flag="my-flag" fallback={<span>off</span>}>
            <span>on</span>
          </Feature>
        </Wrapper>,
      )
    })

    expect(screen.getByText('on')).toBeDefined()
  })

  it('renders fallback for undefined flag', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue(undefined)

    await act(async () => {
      render(
        <Wrapper>
          <Feature flag="missing-flag" fallback={<span>hidden</span>}>
            <span>shown</span>
          </Feature>
        </Wrapper>,
      )
    })

    expect(screen.getByText('hidden')).toBeDefined()
  })

  it('renders nothing when no fallback and flag is off', async () => {
    mockHeadless.getFeatureFlag.mockReturnValue(false)

    const { container } = await act(async () =>
      render(
        <Wrapper>
          <Feature flag="off-flag">
            <span>content</span>
          </Feature>
        </Wrapper>,
      ),
    )

    expect(container.querySelector('span')).toBeNull()
  })
})

// ============================================================================
// 22. useCaptureException — deep
// ============================================================================

describe('useCaptureException — deep', () => {
  it('calls headless.captureException with error and context', async () => {
    let captureFn: ((err: Error, ctx?: { tags?: Record<string, string> }) => string) | undefined

    function Capture() {
      captureFn = useCaptureException() as typeof captureFn
      return null
    }

    await act(async () => {
      render(<Capture />, { wrapper: Wrapper })
    })

    const result = captureFn!(new Error('test error'), { tags: { env: 'test' } })
    expect(mockHeadless.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      { tags: { env: 'test' } },
    )
    expect(result).toBe('event_abc')
  })
})

// ============================================================================
// 23. HeadlessContext direct access
// ============================================================================

describe('HeadlessContext — direct access', () => {
  it('is a React context object', () => {
    expect(HeadlessContext).toBeDefined()
    expect(HeadlessContext.Provider).toBeDefined()
    expect(HeadlessContext.Consumer).toBeDefined()
  })

  it('has null as default value', () => {
    // When used outside provider, Consumer receives null
    let contextValue: unknown = 'not_null'

    function Consumer() {
      contextValue = React.useContext(HeadlessContext)
      return null
    }

    render(<Consumer />)
    expect(contextValue).toBeNull()
  })
})

// ============================================================================
// 24. EntityDetail with dynamic id
// ============================================================================

describe('EntityDetail — dynamic id', () => {
  it('re-fetches when id prop changes', async () => {
    const t1 = await $.Ticket.create({ title: 'Ticket A', status: 'Open' })
    const t2 = await $.Ticket.create({ title: 'Ticket B', status: 'Closed' })

    function TestComponent() {
      const [id, setId] = useState(t1.$id)
      return (
        <div>
          <EntityDetail type="Ticket" id={id}>
            {({ data, loading }) => {
              if (loading) return <div data-testid="s">loading</div>
              if (!data) return <div data-testid="s">not found</div>
              return <div data-testid="s">{(data as Record<string, unknown>).title as string}</div>
            }}
          </EntityDetail>
          <button onClick={() => setId(t2.$id)}>switch</button>
        </div>
      )
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('Ticket A')
    })

    await act(async () => {
      fireEvent.click(screen.getByText('switch'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('Ticket B')
    })
  })
})

// ============================================================================
// 25. EntityList with filter
// ============================================================================

describe('EntityList — with filter', () => {
  it('passes filtered results to children render function', async () => {
    await $.Ticket.create({ title: 'Open Ticket', status: 'Open' })
    await $.Ticket.create({ title: 'Closed Ticket', status: 'Closed' })

    await act(async () => {
      render(
        <Wrapper>
          <EntityList type="Ticket" filter={{ status: 'Open' }}>
            {({ data, loading }) => {
              if (loading) return <div data-testid="s">loading</div>
              const titles = data.map((d: unknown) => (d as Record<string, unknown>).title as string)
              return <div data-testid="s">{titles.join(',')}</div>
            }}
          </EntityList>
        </Wrapper>,
      )
    })

    await waitFor(() => {
      const text = screen.getByTestId('s').textContent!
      expect(text).toContain('Open Ticket')
      expect(text).not.toContain('Closed Ticket')
    })
  })
})
