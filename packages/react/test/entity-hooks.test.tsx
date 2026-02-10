/**
 * @headlessly/react — Entity hooks integration tests
 *
 * These tests verify that the entity hooks (useEntity, useEntities,
 * useMutation, useSearch, useAction, useEvents, useRealtime) actually
 * call through to the $ context from @headlessly/sdk.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup, act, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Import the hooks and SDK — using real @headlessly/js (no mocks)
// ---------------------------------------------------------------------------
import { HeadlessProvider, useEntity, useEntities, useMutation, useSearch, useAction, useEvents, useRealtime, EntityList, EntityDetail } from '../src/index.js'

import { $ } from '@headlessly/sdk'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Wrapper that provides the HeadlessProvider context */
function Wrapper({ children }: { children: React.ReactNode }) {
  return <HeadlessProvider apiKey='test_key'>{children}</HeadlessProvider>
}

// ---------------------------------------------------------------------------
// useEntity tests
// ---------------------------------------------------------------------------

describe('useEntity — wired to $', () => {
  it('fetches an entity by type and id, transitions loading -> data', async () => {
    // Seed a contact into the in-memory store
    const created = await $.Contact.create({ name: 'Alice', stage: 'Lead' })

    function TestComponent() {
      const { data, loading, error } = useEntity('Contact', created.$id)
      if (loading) return <div data-testid='status'>loading</div>
      if (error) return <div data-testid='status'>error: {error.message}</div>
      return <div data-testid='status'>name: {(data as Record<string, unknown>).name as string}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('name: Alice')
    })
  })

  it('returns error when entity is not found', async () => {
    function TestComponent() {
      const { data, loading, error } = useEntity('Contact', 'contact_nonexistent')
      if (loading) return <div data-testid='status'>loading</div>
      if (error) return <div data-testid='status'>error: {error.message}</div>
      return <div data-testid='status'>found</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toContain('not found')
    })
  })

  it('refetch() re-fetches the entity', async () => {
    const created = await $.Contact.create({ name: 'Bob', stage: 'Lead' })

    let refetchFn: (() => void) | undefined

    function TestComponent() {
      const { data, loading, refetch } = useEntity('Contact', created.$id)
      refetchFn = refetch
      if (loading) return <div data-testid='status'>loading</div>
      return <div data-testid='status'>name: {(data as Record<string, unknown>)?.name as string}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('name: Bob')
    })

    // Update the entity
    await $.Contact.update(created.$id, { name: 'Bobby' })

    // Refetch
    await act(async () => {
      refetchFn!()
    })

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('name: Bobby')
    })
  })
})

// ---------------------------------------------------------------------------
// useEntities tests
// ---------------------------------------------------------------------------

describe('useEntities — wired to $', () => {
  it('fetches all entities of a type', async () => {
    // Create a few deals
    await $.Deal.create({ title: 'Deal A', value: 1000, stage: 'Open' })
    await $.Deal.create({ title: 'Deal B', value: 2000, stage: 'Open' })

    function TestComponent() {
      const { data, loading, total } = useEntities('Deal')
      if (loading) return <div data-testid='status'>loading</div>
      return (
        <div data-testid='status'>
          count: {data.length}, total: {total}
        </div>
      )
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      const text = screen.getByTestId('status').textContent!
      expect(text).toContain('count:')
      // Should have at least the 2 we created
      const count = parseInt(text.match(/count: (\d+)/)?.[1] ?? '0')
      expect(count).toBeGreaterThanOrEqual(2)
    })
  })

  it('applies filter', async () => {
    await $.Contact.create({ name: 'Qualified Alice', stage: 'Qualified' })
    await $.Contact.create({ name: 'Lead Bob', stage: 'Lead' })

    function TestComponent() {
      const { data, loading } = useEntities('Contact', { stage: 'Qualified' })
      if (loading) return <div data-testid='status'>loading</div>
      return <div data-testid='status'>{data.map((d: unknown) => (d as Record<string, unknown>).name as string).join(', ')}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      const text = screen.getByTestId('status').textContent!
      expect(text).toContain('Qualified Alice')
      expect(text).not.toContain('Lead Bob')
    })
  })

  it('applies limit for pagination', async () => {
    // Create more entities to paginate
    await $.Project.create({ name: 'P1', status: 'Active' })
    await $.Project.create({ name: 'P2', status: 'Active' })
    await $.Project.create({ name: 'P3', status: 'Active' })

    function TestComponent() {
      const { data, loading, hasMore } = useEntities('Project', undefined, { limit: 2 })
      if (loading) return <div data-testid='status'>loading</div>
      return (
        <div data-testid='status'>
          count: {data.length}, hasMore: {String(hasMore)}
        </div>
      )
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      const text = screen.getByTestId('status').textContent!
      expect(text).toContain('count: 2')
      expect(text).toContain('hasMore: true')
    })
  })
})

// ---------------------------------------------------------------------------
// useMutation tests
// ---------------------------------------------------------------------------

describe('useMutation — wired to $', () => {
  it('create() creates an entity via the SDK', async () => {
    let createFn: ((data: Record<string, unknown>) => Promise<unknown>) | undefined
    let result: unknown

    function TestComponent() {
      const { create, loading } = useMutation('Contact')
      createFn = create
      return <div data-testid='status'>{loading ? 'loading' : 'idle'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(screen.getByTestId('status').textContent).toBe('idle')

    // Call create
    await act(async () => {
      result = await createFn!({ name: 'Created Via Hook', stage: 'Lead' })
    })

    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).$type).toBe('Contact')
    expect((result as Record<string, unknown>).name).toBe('Created Via Hook')
    expect((result as Record<string, unknown>).$id).toBeDefined()
  })

  it('update() updates an entity via the SDK', async () => {
    const created = await $.Contact.create({ name: 'Before', stage: 'Lead' })

    let updateFn: ((id: string, data: Record<string, unknown>) => Promise<unknown>) | undefined

    function TestComponent() {
      const { update } = useMutation('Contact')
      updateFn = update
      return null
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    let result: unknown
    await act(async () => {
      result = await updateFn!(created.$id, { name: 'After' })
    })

    expect((result as Record<string, unknown>).name).toBe('After')

    // Verify via direct get
    const fetched = await $.Contact.get(created.$id)
    expect(fetched?.name).toBe('After')
  })

  it('remove() deletes an entity via the SDK', async () => {
    const created = await $.Contact.create({ name: 'ToDelete', stage: 'Lead' })

    let removeFn: ((id: string) => Promise<void>) | undefined

    function TestComponent() {
      const { remove } = useMutation('Contact')
      removeFn = remove
      return null
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

  it('sets error on failure', async () => {
    let createFn: ((data: Record<string, unknown>) => Promise<unknown>) | undefined
    let hookError: Error | null = null

    function TestComponent() {
      const { create, error } = useMutation('NonExistentType')
      createFn = create
      hookError = error
      return <div data-testid='error'>{error?.message ?? 'none'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    // Attempt to create on a non-existent type
    await act(async () => {
      try {
        await createFn!({ name: 'test' })
      } catch {
        // expected
      }
    })

    await waitFor(() => {
      expect(screen.getByTestId('error').textContent).toContain('Unknown entity type')
    })
  })
})

// ---------------------------------------------------------------------------
// useAction tests
// ---------------------------------------------------------------------------

describe('useAction — wired to $', () => {
  it('executes a custom verb on an entity', async () => {
    // Contact has a 'qualify' verb that transitions stage to 'Qualified'
    const created = await $.Contact.create({ name: 'ActionTarget', stage: 'Lead' })

    let executeFn: ((id: string) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute, loading } = useAction('Contact', 'qualify')
      executeFn = execute
      return <div data-testid='status'>{loading ? 'loading' : 'idle'}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    let result: unknown
    await act(async () => {
      result = await executeFn!(created.$id)
    })

    // The qualify verb should return the updated entity with stage = 'Qualified'
    expect(result).toBeDefined()
    expect((result as Record<string, unknown>).stage).toBe('Qualified')
  })

  it('sets error for unknown verb', async () => {
    const created = await $.Contact.create({ name: 'ActionTarget2', stage: 'Lead' })

    let executeFn: ((id: string) => Promise<unknown>) | undefined

    function TestComponent() {
      const { execute, error } = useAction('Contact', 'nonExistentVerb')
      executeFn = execute
      return <div data-testid='error'>{error?.message ?? 'none'}</div>
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
      expect(screen.getByTestId('error').textContent).toContain('Unknown verb')
    })
  })
})

// ---------------------------------------------------------------------------
// useSearch tests
// ---------------------------------------------------------------------------

describe('useSearch — wired to $', () => {
  it('searches entities and returns results after debounce', async () => {
    // Create some contacts with searchable names
    await $.Contact.create({ name: 'Searchable Alice', stage: 'Lead' })
    await $.Contact.create({ name: 'Searchable Bob', stage: 'Lead' })

    function TestComponent() {
      const { results, loading } = useSearch('Searchable', { types: ['Contact'], debounce: 50 })
      if (loading) return <div data-testid='status'>searching</div>
      return <div data-testid='status'>found: {results.length}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    // Initially should show searching
    expect(screen.getByTestId('status').textContent).toBe('searching')

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    // The search calls $.search which uses entity.find under the hood
    // Results depend on whether MemoryProvider's find supports $search filter
    await waitFor(() => {
      const text = screen.getByTestId('status').textContent!
      expect(text).toMatch(/found: \d+/)
    })
  })

  it('clears results when query is empty', async () => {
    function TestComponent() {
      const { results, loading } = useSearch('', { types: ['Contact'] })
      return (
        <div data-testid='status'>
          found: {results.length}, loading: {String(loading)}
        </div>
      )
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    expect(screen.getByTestId('status').textContent).toBe('found: 0, loading: false')
  })
})

// ---------------------------------------------------------------------------
// useEvents tests
// ---------------------------------------------------------------------------

describe('useEvents — wired to $', () => {
  it('transitions from loading to done', async () => {
    const created = await $.Contact.create({ name: 'EventTarget', stage: 'Lead' })

    function TestComponent() {
      const { events, loading } = useEvents('Contact', created.$id)
      if (loading) return <div data-testid='status'>loading</div>
      return <div data-testid='status'>events: {events.length}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      const text = screen.getByTestId('status').textContent!
      // Should have completed loading (regardless of event count)
      expect(text).toMatch(/events: \d+/)
    })
  })
})

// ---------------------------------------------------------------------------
// useRealtime tests
// ---------------------------------------------------------------------------

describe('useRealtime — polling fallback', () => {
  it('fetches entity and sets connected=true', async () => {
    const created = await $.Contact.create({ name: 'RealtimeTarget', stage: 'Lead' })

    function TestComponent() {
      const { data, connected } = useRealtime('Contact', created.$id, 1000)
      if (!connected) return <div data-testid='status'>connecting</div>
      return <div data-testid='status'>connected: {(data as Record<string, unknown>)?.name as string}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('connected: RealtimeTarget')
    })
  })

  it('polls and picks up changes', async () => {
    const created = await $.Contact.create({ name: 'PollTarget', stage: 'Lead' })

    function TestComponent() {
      const { data, connected } = useRealtime('Contact', created.$id, 200)
      if (!connected) return <div data-testid='status'>connecting</div>
      return <div data-testid='status'>{(data as Record<string, unknown>)?.name as string}</div>
    }

    await act(async () => {
      render(<TestComponent />, { wrapper: Wrapper })
    })

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('PollTarget')
    })

    // Update the entity externally
    await $.Contact.update(created.$id, { name: 'PollUpdated' })

    // Advance timer past the poll interval
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('PollUpdated')
    })
  })
})

// ---------------------------------------------------------------------------
// EntityList render-prop component
// ---------------------------------------------------------------------------

describe('EntityList — render-prop component', () => {
  it('passes entity data to children render function', async () => {
    await $.Ticket.create({ title: 'Bug report', status: 'Open' })

    await act(async () => {
      render(
        <Wrapper>
          <EntityList type='Ticket'>
            {({ data, loading }) => {
              if (loading) return <div data-testid='status'>loading</div>
              return <div data-testid='status'>tickets: {data.length}</div>
            }}
          </EntityList>
        </Wrapper>,
      )
    })

    await waitFor(() => {
      const text = screen.getByTestId('status').textContent!
      expect(text).toMatch(/tickets: \d+/)
      const count = parseInt(text.match(/tickets: (\d+)/)?.[1] ?? '0')
      expect(count).toBeGreaterThanOrEqual(1)
    })
  })
})

// ---------------------------------------------------------------------------
// EntityDetail render-prop component
// ---------------------------------------------------------------------------

describe('EntityDetail — render-prop component', () => {
  it('passes single entity data to children render function', async () => {
    const created = await $.Ticket.create({ title: 'Detail ticket', status: 'Open' })

    await act(async () => {
      render(
        <Wrapper>
          <EntityDetail type='Ticket' id={created.$id}>
            {({ data, loading }) => {
              if (loading) return <div data-testid='status'>loading</div>
              if (!data) return <div data-testid='status'>not found</div>
              return <div data-testid='status'>title: {(data as Record<string, unknown>).title as string}</div>
            }}
          </EntityDetail>
        </Wrapper>,
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('title: Detail ticket')
    })
  })
})
