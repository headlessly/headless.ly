/**
 * @headlessly/react -- Tests for new hooks
 *
 * Tests for:
 * - HeadlesslyProvider (tenant-scoped provider)
 * - useHeadlessly (tenant context hook)
 * - useEntity.mutate (inline mutation)
 * - useCreate(type) (focused create hook)
 * - useUpdate(type) (focused update hook)
 * - useDelete(type) (focused delete hook)
 * - useVerb(type, verb) (custom verb execution)
 * - useSubscription(type, filter?, handler) (real-time subscription)
 * - useDomain(domain) (domain namespace access)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React, { useState } from 'react'
import { render, screen, cleanup, act, waitFor, fireEvent } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Imports — using real @headlessly/js (no mocks)
// ---------------------------------------------------------------------------

import {
  HeadlessProvider,
  HeadlesslyProvider,
  HeadlesslyContext,
  useHeadlessly,
  useEntity,
  useCreate,
  useUpdate,
  useDelete,
  useVerb,
  useSubscription,
  useDomain,
} from '../src/index.js'

import { $ } from '@headlessly/sdk'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function Wrapper({ children }: { children: React.ReactNode }) {
  return <HeadlessProvider apiKey='new_hooks_test'>{children}</HeadlessProvider>
}

// ============================================================================
// 1. HeadlesslyProvider
// ============================================================================

describe('HeadlesslyProvider', () => {
  it('is exported as a function', async () => {
    expect(HeadlesslyProvider).toBeDefined()
    expect(typeof HeadlesslyProvider).toBe('function')
  })

  it('renders children', async () => {
    await act(async () => {
      render(
        <HeadlesslyProvider tenant='test-tenant'>
          <div data-testid='child'>content</div>
        </HeadlesslyProvider>,
      )
    })

    expect(screen.getByTestId('child').textContent).toBe('content')
  })

  it('provides tenant in context', async () => {
    function TenantDisplay() {
      const ctx = useHeadlessly()
      return <div data-testid='tenant'>{ctx.tenant}</div>
    }

    await act(async () => {
      render(
        <HeadlesslyProvider tenant='acme'>
          <TenantDisplay />
        </HeadlesslyProvider>,
      )
    })

    expect(screen.getByTestId('tenant').textContent).toBe('acme')
  })

  it('sets initialized to true after mount', async () => {
    function InitDisplay() {
      const ctx = useHeadlessly()
      return <div data-testid='init'>{String(ctx.initialized)}</div>
    }

    await act(async () => {
      render(
        <HeadlesslyProvider tenant='init-test'>
          <InitDisplay />
        </HeadlesslyProvider>,
      )
    })

    expect(screen.getByTestId('init').textContent).toBe('true')
  })

  it('provides org object in context', async () => {
    function OrgDisplay() {
      const ctx = useHeadlessly()
      return <div data-testid='org'>{ctx.org ? 'present' : 'null'}</div>
    }

    await act(async () => {
      render(
        <HeadlesslyProvider tenant='org-test'>
          <OrgDisplay />
        </HeadlesslyProvider>,
      )
    })

    expect(screen.getByTestId('org').textContent).toBe('present')
  })

  it('accepts apiKey prop', async () => {
    function TenantDisplay() {
      const ctx = useHeadlessly()
      return <div data-testid='s'>{ctx.tenant}</div>
    }

    await act(async () => {
      render(
        <HeadlesslyProvider tenant='key-test' apiKey='hly_sk_test'>
          <TenantDisplay />
        </HeadlesslyProvider>,
      )
    })

    expect(screen.getByTestId('s').textContent).toBe('key-test')
  })

  it('accepts endpoint prop', async () => {
    function TenantDisplay() {
      const ctx = useHeadlessly()
      return <div data-testid='s'>{ctx.tenant}</div>
    }

    await act(async () => {
      render(
        <HeadlesslyProvider tenant='endpoint-test' endpoint='https://db.headless.ly'>
          <TenantDisplay />
        </HeadlesslyProvider>,
      )
    })

    expect(screen.getByTestId('s').textContent).toBe('endpoint-test')
  })

  it('accepts mode prop', async () => {
    function TenantDisplay() {
      const ctx = useHeadlessly()
      return <div data-testid='s'>{ctx.tenant}</div>
    }

    await act(async () => {
      render(
        <HeadlesslyProvider tenant='mode-test' mode='memory'>
          <TenantDisplay />
        </HeadlesslyProvider>,
      )
    })

    expect(screen.getByTestId('s').textContent).toBe('mode-test')
  })

  it('exports HeadlesslyContext', () => {
    expect(HeadlesslyContext).toBeDefined()
    expect(HeadlesslyContext.Provider).toBeDefined()
    expect(HeadlesslyContext.Consumer).toBeDefined()
  })

  it('HeadlesslyContext has null as default value', () => {
    let contextValue: unknown = 'not_null'

    function Consumer() {
      contextValue = React.useContext(HeadlesslyContext)
      return null
    }

    render(<Consumer />)
    expect(contextValue).toBeNull()
  })
})

// ============================================================================
// 2. useHeadlessly
// ============================================================================

describe('useHeadlessly', () => {
  it('throws when used outside HeadlesslyProvider', () => {
    function Naked() {
      useHeadlessly()
      return null
    }

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      render(<Naked />)
    }).toThrow('useHeadlessly must be used within HeadlesslyProvider')
    spy.mockRestore()
  })

  it('returns tenant, initialized, and org', async () => {
    let result: ReturnType<typeof useHeadlessly> | undefined

    function Capture() {
      result = useHeadlessly()
      return null
    }

    await act(async () => {
      render(
        <HeadlesslyProvider tenant='capture-test'>
          <Capture />
        </HeadlesslyProvider>,
      )
    })

    expect(result).toBeDefined()
    expect(result!.tenant).toBe('capture-test')
    expect(typeof result!.initialized).toBe('boolean')
    expect(result!.org).toBeDefined()
  })
})

// ============================================================================
// 3. useEntity.mutate
// ============================================================================

describe('useEntity.mutate', () => {
  it('returns mutate function in result', async () => {
    const created = await $.Contact.create({ name: 'MutateTest', stage: 'Lead' })

    let mutateFn: ((data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { data, loading, mutate } = useEntity('Contact', created.$id)
      mutateFn = mutate
      if (loading) return <div data-testid='s'>loading</div>
      return <div data-testid='s'>{(data as Record<string, unknown>)?.name as string}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('MutateTest')
    })

    expect(typeof mutateFn).toBe('function')
  })

  it('mutate updates the entity and reflects in data', async () => {
    const created = await $.Contact.create({ name: 'BeforeMutate', stage: 'Lead' })

    let mutateFn: ((data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { data, loading, mutate } = useEntity('Contact', created.$id)
      mutateFn = mutate
      if (loading) return <div data-testid='s'>loading</div>
      return <div data-testid='s'>{(data as Record<string, unknown>)?.name as string}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('BeforeMutate')
    })

    await act(async () => {
      await mutateFn!({ name: 'AfterMutate' })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('AfterMutate')
    })
  })

  it('mutate returns the updated entity', async () => {
    const created = await $.Contact.create({ name: 'MutateReturn', stage: 'Lead' })

    let mutateFn: ((data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { mutate } = useEntity('Contact', created.$id)
      mutateFn = mutate
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    let result: unknown
    await act(async () => {
      result = await mutateFn!({ name: 'MutateReturnUpdated' })
    })

    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).name).toBe('MutateReturnUpdated')
  })

  it('mutate throws for unknown entity type', async () => {
    let mutateFn: ((data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { mutate } = useEntity('FakeType', 'id_fake')
      mutateFn = mutate
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await expect(
      act(async () => {
        await mutateFn!({ name: 'test' })
      }),
    ).rejects.toThrow('Unknown entity type')
  })
})

// ============================================================================
// 4. useCreate
// ============================================================================

describe('useCreate', () => {
  it('is exported as a function', () => {
    expect(useCreate).toBeDefined()
    expect(typeof useCreate).toBe('function')
  })

  it('returns { create, loading, error, data }', async () => {
    let hookResult: ReturnType<typeof useCreate> | undefined

    function TestComponent() {
      hookResult = useCreate('Contact')
      return <div data-testid='s'>{hookResult.loading ? 'loading' : 'idle'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(hookResult).toBeDefined()
    expect(typeof hookResult!.create).toBe('function')
    expect(typeof hookResult!.loading).toBe('boolean')
    expect(hookResult!.error).toBeNull()
    expect(hookResult!.data).toBeNull()
  })

  it('creates an entity and returns it', async () => {
    let createFn: ((data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { create, loading, data } = useCreate('Contact')
      createFn = create
      return <div data-testid='s'>{loading ? 'loading' : data ? ((data as Record<string, unknown>).name as string) : 'idle'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(screen.getByTestId('s').textContent).toBe('idle')

    let result: unknown
    await act(async () => {
      result = await createFn!({ name: 'Created Contact', stage: 'Lead' })
    })

    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).$type).toBe('Contact')
    expect((result as Record<string, unknown>).name).toBe('Created Contact')

    // data state should be updated
    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('Created Contact')
    })
  })

  it('sets error for unknown entity type', async () => {
    let createFn: ((data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { create, error } = useCreate('BogusType')
      createFn = create
      return <div data-testid='s'>{error?.message ?? 'clean'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      try {
        await createFn!({ name: 'test' })
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })

  it('loading transitions correctly', async () => {
    let createFn: ((data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { create, loading } = useCreate('Contact')
      createFn = create
      return <div data-testid='s'>{loading ? 'busy' : 'idle'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(screen.getByTestId('s').textContent).toBe('idle')

    await act(async () => {
      await createFn!({ name: 'LoadingTest', stage: 'Lead' })
    })

    expect(screen.getByTestId('s').textContent).toBe('idle')
  })
})

// ============================================================================
// 5. useUpdate
// ============================================================================

describe('useUpdate', () => {
  it('is exported as a function', () => {
    expect(useUpdate).toBeDefined()
    expect(typeof useUpdate).toBe('function')
  })

  it('returns { update, loading, error, data }', async () => {
    let hookResult: ReturnType<typeof useUpdate> | undefined

    function TestComponent() {
      hookResult = useUpdate('Contact')
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(hookResult).toBeDefined()
    expect(typeof hookResult!.update).toBe('function')
    expect(typeof hookResult!.loading).toBe('boolean')
    expect(hookResult!.error).toBeNull()
    expect(hookResult!.data).toBeNull()
  })

  it('updates an entity and returns it', async () => {
    const created = await $.Contact.create({ name: 'UpdateTarget', stage: 'Lead' })

    let updateFn: ((id: string, data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { update, data } = useUpdate('Contact')
      updateFn = update
      return <div data-testid='s'>{data ? ((data as Record<string, unknown>).name as string) : 'idle'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    let result: unknown
    await act(async () => {
      result = await updateFn!(created.$id, { name: 'UpdatedContact' })
    })

    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).name).toBe('UpdatedContact')

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('UpdatedContact')
    })
  })

  it('sets error for unknown entity type', async () => {
    let updateFn: ((id: string, data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { update, error } = useUpdate('FakeType')
      updateFn = update
      return <div data-testid='s'>{error?.message ?? 'clean'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      try {
        await updateFn!('id_1', { name: 'test' })
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })
})

// ============================================================================
// 6. useDelete
// ============================================================================

describe('useDelete', () => {
  it('is exported as a function', () => {
    expect(useDelete).toBeDefined()
    expect(typeof useDelete).toBe('function')
  })

  it('returns { remove, loading, error }', async () => {
    let hookResult: ReturnType<typeof useDelete> | undefined

    function TestComponent() {
      hookResult = useDelete('Contact')
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(hookResult).toBeDefined()
    expect(typeof hookResult!.remove).toBe('function')
    expect(typeof hookResult!.loading).toBe('boolean')
    expect(hookResult!.error).toBeNull()
  })

  it('deletes an entity', async () => {
    const created = await $.Contact.create({ name: 'DeleteTarget', stage: 'Lead' })

    let removeFn: ((id: string) => Promise<void>) | undefined

    function TestComponent() {
      const { remove, loading } = useDelete('Contact')
      removeFn = remove
      return <div data-testid='s'>{loading ? 'busy' : 'idle'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      await removeFn!(created.$id)
    })

    // Verify entity is gone
    const fetched = await $.Contact.get(created.$id)
    expect(fetched).toBeNull()
  })

  it('sets error for unknown entity type', async () => {
    let removeFn: ((id: string) => Promise<void>) | undefined

    function TestComponent() {
      const { remove, error } = useDelete('GhostType')
      removeFn = remove
      return <div data-testid='s'>{error?.message ?? 'clean'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      try {
        await removeFn!('id_1')
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })
})

// ============================================================================
// 7. useVerb
// ============================================================================

describe('useVerb', () => {
  it('is exported as a function', () => {
    expect(useVerb).toBeDefined()
    expect(typeof useVerb).toBe('function')
  })

  it('returns { execute, loading, error }', async () => {
    let hookResult: ReturnType<typeof useVerb> | undefined

    function TestComponent() {
      hookResult = useVerb('Contact', 'qualify')
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(hookResult).toBeDefined()
    expect(typeof hookResult!.execute).toBe('function')
    expect(typeof hookResult!.loading).toBe('boolean')
    expect(hookResult!.error).toBeNull()
  })

  it('executes a verb and returns the result', async () => {
    const created = await $.Contact.create({ name: 'VerbTarget', stage: 'Lead' })

    let executeFn: ((id: string) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute, loading } = useVerb('Contact', 'qualify')
      executeFn = execute
      return <div data-testid='s'>{loading ? 'busy' : 'idle'}</div>
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

  it('sets error for unknown verb', async () => {
    const created = await $.Contact.create({ name: 'UnknownVerb', stage: 'Lead' })

    let executeFn: ((id: string) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute, error } = useVerb('Contact', 'nonExistentVerb')
      executeFn = execute
      return <div data-testid='s'>{error?.message ?? 'clean'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      try {
        await executeFn!(created.$id)
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown verb')
    })
  })

  it('sets error for unknown entity type', async () => {
    let executeFn: ((id: string) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute, error } = useVerb('NoSuchType', 'qualify')
      executeFn = execute
      return <div data-testid='s'>{error?.message ?? 'clean'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      try {
        await executeFn!('id_1')
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })

  it('passes data through to the verb function', async () => {
    const created = await $.Contact.create({ name: 'VerbData', stage: 'Lead' })

    let executeFn: ((id: string, data?: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute } = useVerb('Contact', 'qualify')
      executeFn = execute
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    let result: unknown
    await act(async () => {
      result = await executeFn!(created.$id, { reason: 'met criteria' })
    })

    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).stage).toBe('Qualified')
  })

  it('loading transitions correctly during execution', async () => {
    const created = await $.Contact.create({ name: 'VerbLoading', stage: 'Lead' })

    let executeFn: ((id: string) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute, loading } = useVerb('Contact', 'qualify')
      executeFn = execute
      return <div data-testid='s'>{loading ? 'busy' : 'idle'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(screen.getByTestId('s').textContent).toBe('idle')

    await act(async () => {
      await executeFn!(created.$id)
    })

    // After completion, should be idle
    expect(screen.getByTestId('s').textContent).toBe('idle')
  })

  it('executes send on Message', async () => {
    const msg = await $.Message.create({
      body: 'Verb send test',
      channel: 'Email',
      status: 'Draft',
      sender: 'alice',
      recipient: 'bob',
    })

    let executeFn: ((id: string) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute } = useVerb('Message', 'send')
      executeFn = execute
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    let result: unknown
    await act(async () => {
      result = await executeFn!(msg.$id)
    })

    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).status).toBe('Sent')
  })
})

// ============================================================================
// 8. useSubscription
// ============================================================================

describe('useSubscription', () => {
  it('is exported as a function', () => {
    expect(useSubscription).toBeDefined()
    expect(typeof useSubscription).toBe('function')
  })

  it('returns { connected, error, unsubscribe }', async () => {
    let hookResult: ReturnType<typeof useSubscription> | undefined

    function TestComponent() {
      hookResult = useSubscription('Contact', {}, () => {})
      return <div data-testid='s'>{hookResult.connected ? 'yes' : 'no'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(hookResult).toBeDefined()
    expect(typeof hookResult!.connected).toBe('boolean')
    expect(hookResult!.error).toBeNull()
    expect(typeof hookResult!.unsubscribe).toBe('function')
  })

  it('calls handler with entity data on initial poll', async () => {
    await $.Contact.create({ name: 'SubContact1', stage: 'Lead' })
    await $.Contact.create({ name: 'SubContact2', stage: 'Lead' })

    const handler = vi.fn()

    function TestComponent() {
      const { connected } = useSubscription('Contact', { stage: 'Lead' }, handler)
      return <div data-testid='s'>{connected ? 'connected' : 'waiting'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('connected')
    })

    expect(handler).toHaveBeenCalled()
    const callArg = handler.mock.calls[0][0]
    expect(Array.isArray(callArg)).toBe(true)
  })

  it('accepts handler as second argument (no filter)', async () => {
    await $.Ticket.create({ title: 'SubTicket', status: 'Open' })

    const handler = vi.fn()

    function TestComponent() {
      const { connected } = useSubscription('Ticket', handler)
      return <div data-testid='s'>{connected ? 'connected' : 'waiting'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('connected')
    })

    expect(handler).toHaveBeenCalled()
  })

  it('sets error for unknown entity type', async () => {
    function TestComponent() {
      const { error, connected } = useSubscription('FakeEntity', () => {})
      return <div data-testid='s'>{error ? error.message : connected ? 'connected' : 'waiting'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toContain('Unknown entity type')
    })
  })

  it('cleans up on unmount (no errors)', async () => {
    await $.Contact.create({ name: 'SubCleanup', stage: 'Lead' })

    const handler = vi.fn()
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    function TestComponent() {
      const { connected } = useSubscription('Contact', handler)
      return <div data-testid='s'>{connected ? 'yes' : 'no'}</div>
    }

    const { unmount } = await act(async () => render(<TestComponent />, { wrapper: Wrapper }))

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('yes')
    })

    const clearCountBefore = clearIntervalSpy.mock.calls.length
    unmount()
    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(clearCountBefore)
    clearIntervalSpy.mockRestore()
  })

  it('unsubscribe stops further polling', async () => {
    await $.Contact.create({ name: 'Unsub', stage: 'Lead' })

    const handler = vi.fn()
    let unsubscribeFn: (() => void) | undefined

    function TestComponent() {
      const { connected, unsubscribe } = useSubscription('Contact', handler)
      unsubscribeFn = unsubscribe
      return <div data-testid='s'>{connected ? 'yes' : 'no'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('yes')
    })

    const callCountBefore = handler.mock.calls.length

    // Unsubscribe
    await act(async () => {
      unsubscribeFn!()
    })

    // Advance past poll interval
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    // Handler should not have been called again after unsubscribe
    expect(handler.mock.calls.length).toBe(callCountBefore)
  })
})

// ============================================================================
// 9. useDomain
// ============================================================================

describe('useDomain', () => {
  it('is exported as a function', () => {
    expect(useDomain).toBeDefined()
    expect(typeof useDomain).toBe('function')
  })

  it('returns CRM domain entities', async () => {
    let domain: Record<string, unknown> | undefined

    function TestComponent() {
      domain = useDomain('crm') as unknown as Record<string, unknown>
      return <div data-testid='s'>loaded</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(domain).toBeDefined()
    expect(domain!.Contact).toBeDefined()
    expect(domain!.Deal).toBeDefined()
    expect(domain!.Organization).toBeDefined()
    expect(domain!.Lead).toBeDefined()
    expect(domain!.Activity).toBeDefined()
    expect(domain!.Pipeline).toBeDefined()
  })

  it('returns Billing domain entities', async () => {
    let domain: Record<string, unknown> | undefined

    function TestComponent() {
      domain = useDomain('billing') as unknown as Record<string, unknown>
      return <div data-testid='s'>loaded</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(domain).toBeDefined()
    expect(domain!.Customer).toBeDefined()
    expect(domain!.Product).toBeDefined()
    expect(domain!.Plan).toBeDefined()
    expect(domain!.Subscription).toBeDefined()
    expect(domain!.Invoice).toBeDefined()
    expect(domain!.Payment).toBeDefined()
  })

  it('returns Projects domain entities', async () => {
    let domain: Record<string, unknown> | undefined

    function TestComponent() {
      domain = useDomain('projects') as unknown as Record<string, unknown>
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(domain).toBeDefined()
    expect(domain!.Project).toBeDefined()
    expect(domain!.Issue).toBeDefined()
  })

  it('returns Marketing domain entities', async () => {
    let domain: Record<string, unknown> | undefined

    function TestComponent() {
      domain = useDomain('marketing') as unknown as Record<string, unknown>
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(domain).toBeDefined()
    expect(domain!.Campaign).toBeDefined()
    expect(domain!.Segment).toBeDefined()
    expect(domain!.Form).toBeDefined()
  })

  it('returns Experiments domain entities', async () => {
    let domain: Record<string, unknown> | undefined

    function TestComponent() {
      domain = useDomain('experiments') as unknown as Record<string, unknown>
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(domain).toBeDefined()
    expect(domain!.Experiment).toBeDefined()
    expect(domain!.FeatureFlag).toBeDefined()
  })

  it('returns Platform domain entities', async () => {
    let domain: Record<string, unknown> | undefined

    function TestComponent() {
      domain = useDomain('platform') as unknown as Record<string, unknown>
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(domain).toBeDefined()
    expect(domain!.Workflow).toBeDefined()
    expect(domain!.Integration).toBeDefined()
    expect(domain!.Agent).toBeDefined()
  })

  it('returns Analytics domain entities', async () => {
    let domain: Record<string, unknown> | undefined

    function TestComponent() {
      domain = useDomain('analytics') as unknown as Record<string, unknown>
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(domain).toBeDefined()
    expect(domain!.Event).toBeDefined()
    expect(domain!.Metric).toBeDefined()
    expect(domain!.Funnel).toBeDefined()
    expect(domain!.Goal).toBeDefined()
  })

  it('returns Content domain entities', async () => {
    let domain: Record<string, unknown> | undefined

    function TestComponent() {
      domain = useDomain('content') as unknown as Record<string, unknown>
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(domain).toBeDefined()
    expect(domain!.Content).toBeDefined()
    expect(domain!.Asset).toBeDefined()
    expect(domain!.Site).toBeDefined()
  })

  it('returns Support domain entities', async () => {
    let domain: Record<string, unknown> | undefined

    function TestComponent() {
      domain = useDomain('support') as unknown as Record<string, unknown>
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(domain).toBeDefined()
    expect(domain!.Ticket).toBeDefined()
  })

  it('throws for unknown domain', () => {
    function TestComponent() {
      useDomain('nonexistent')
      return null
    }

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      render(<TestComponent />, { wrapper: Wrapper })
    }).toThrow('Unknown domain: "nonexistent"')
    spy.mockRestore()
  })

  it('domain entities can perform operations', async () => {
    let domain: Record<string, unknown> | undefined

    function TestComponent() {
      domain = useDomain('crm') as unknown as Record<string, unknown>
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    // The returned Contact should be a NounEntity with create/find/get methods
    const Contact = domain!.Contact as { create: (data: Record<string, unknown>) => Promise<Record<string, unknown>> }
    const result = await Contact.create({ name: 'DomainContact', stage: 'Lead' })
    expect(result).toBeDefined()
    expect(result.name).toBe('DomainContact')
  })

  it('is memoized across re-renders', async () => {
    const domainRefs: Record<string, unknown>[] = []

    function TestComponent() {
      const domain = useDomain('crm') as unknown as Record<string, unknown>
      domainRefs.push(domain)
      const [, setCount] = useState(0)
      return (
        <div>
          <div data-testid='s'>renders: {domainRefs.length}</div>
          <button onClick={() => setCount((c) => c + 1)}>rerender</button>
        </div>
      )
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await act(async () => {
      fireEvent.click(screen.getByText('rerender'))
    })

    await act(async () => {
      fireEvent.click(screen.getByText('rerender'))
    })

    // All refs should be the same object (memoized)
    expect(domainRefs.length).toBeGreaterThanOrEqual(2)
    expect(domainRefs[0]).toBe(domainRefs[1])
    if (domainRefs.length >= 3) {
      expect(domainRefs[1]).toBe(domainRefs[2])
    }
  })
})

// ============================================================================
// 10. Composition tests — new hooks together
// ============================================================================

describe('Composition: new hooks together', () => {
  it('useCreate + useEntity for create-and-display workflow', async () => {
    let createFn: ((data: Record<string, unknown>) => Promise<unknown>) | undefined
    let createdId: string | undefined

    function TestComponent() {
      const [id, setId] = useState<string | null>(null)
      const { create } = useCreate('Contact')
      createFn = async (data: Record<string, unknown>) => {
        const result = await create(data)
        const entityId = (result as Record<string, unknown>).$id as string
        setId(entityId)
        createdId = entityId
        return result
      }

      if (!id) return <div data-testid='s'>no entity</div>

      return <EntityDisplay type='Contact' id={id} />
    }

    function EntityDisplay({ type, id }: { type: string; id: string }) {
      const { data, loading } = useEntity(type, id)
      if (loading) return <div data-testid='s'>loading</div>
      return <div data-testid='s'>{(data as Record<string, unknown>)?.name as string}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(screen.getByTestId('s').textContent).toBe('no entity')

    await act(async () => {
      await createFn!({ name: 'Composed Contact', stage: 'Lead' })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('Composed Contact')
    })
  })

  it('useVerb + useEntity refetch for action-and-display workflow', async () => {
    const created = await $.Contact.create({ name: 'VerbRefresh', stage: 'Lead' })

    let executeFn: ((id: string) => Promise<unknown>) | undefined
    let refetchFn: (() => void) | undefined

    function TestComponent() {
      const { data, loading, refetch } = useEntity('Contact', created.$id)
      const { execute } = useVerb('Contact', 'qualify')
      executeFn = execute
      refetchFn = refetch

      if (loading) return <div data-testid='s'>loading</div>
      return <div data-testid='s'>{(data as Record<string, unknown>)?.stage as string}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('Lead')
    })

    await act(async () => {
      await executeFn!(created.$id)
    })

    await act(async () => {
      refetchFn!()
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('Qualified')
    })
  })

  it('useDomain entities with useCreate for domain-aware creation', async () => {
    let domainModule: Record<string, unknown> | undefined

    function TestComponent() {
      domainModule = useDomain('crm') as unknown as Record<string, unknown>
      const { create, data } = useCreate('Contact')

      return (
        <div>
          <div data-testid='s'>{data ? ((data as Record<string, unknown>).name as string) : 'idle'}</div>
          <div data-testid='domain'>{domainModule ? Object.keys(domainModule).length : 0}</div>
          <button onClick={() => create({ name: 'DomainCreated', stage: 'Lead' })}>create</button>
        </div>
      )
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    // Domain should have entities
    expect(parseInt(screen.getByTestId('domain').textContent!)).toBeGreaterThan(0)

    await act(async () => {
      fireEvent.click(screen.getByText('create'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('s').textContent).toBe('DomainCreated')
    })
  })
})
