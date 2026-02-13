import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Noun } from 'digital-objects'
import { DatabaseGrid } from '@mdxui/admin'
import { EntityGrid } from '../src/entity-grid'

function registerTestNoun() {
  return Noun('Contact', {
    name: 'string!',
    email: 'string?',
    stage: 'Lead | Qualified | Customer',
  })
}

describe('EntityGrid', () => {
  beforeEach(() => {
    vi.mocked(DatabaseGrid).mockClear()
  })

  it('renders DatabaseGrid with schema-derived columns', async () => {
    registerTestNoun()
    render(<EntityGrid noun="Contact" />)

    await waitFor(() => {
      expect(screen.getByTestId('database-grid')).toBeInTheDocument()
    })

    const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    const columns = props.columns as Array<{ accessorKey: string }>
    const keys = columns.map((c) => c.accessorKey)
    expect(keys).toContain('$id')
    expect(keys).toContain('name')
    expect(keys).toContain('email')
    expect(keys).toContain('stage')
  })

  it('passes real data from useEntities through to DatabaseGrid', async () => {
    const Contact = registerTestNoun()
    await Contact.create({ name: 'Alice', email: 'alice@test.com', stage: 'Lead' })
    await Contact.create({ name: 'Bob', email: 'bob@test.com', stage: 'Qualified' })

    render(<EntityGrid noun="Contact" />)

    await waitFor(() => {
      const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
      const props = lastCall?.[0] as Record<string, unknown>
      const data = props.data as Array<Record<string, unknown>>
      expect(data).toHaveLength(2)
    })

    const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    const data = props.data as Array<Record<string, unknown>>
    expect(data.some((r) => r.name === 'Alice')).toBe(true)
    expect(data.some((r) => r.name === 'Bob')).toBe(true)
  })

  it('shows loading state initially', () => {
    registerTestNoun()
    render(<EntityGrid noun="Contact" />)

    // First render should pass loading state to the grid
    const firstCall = vi.mocked(DatabaseGrid).mock.calls[0]
    const props = firstCall?.[0] as Record<string, unknown>
    expect(props.isLoading).toBe(true)
  })

  it('inline edit actually updates the entity in the backend', async () => {
    const Contact = registerTestNoun()
    const alice = await Contact.create({ name: 'Alice', email: 'alice@test.com', stage: 'Lead' })

    render(<EntityGrid noun="Contact" />)

    await waitFor(() => {
      const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
      const props = lastCall?.[0] as Record<string, unknown>
      expect((props.data as unknown[]).length).toBe(1)
    })

    const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    const onCellUpdate = props.onCellUpdate as (rowIndex: number, columnId: string, value: unknown) => void
    onCellUpdate(0, 'name', 'Updated Alice')

    // Verify the real backend was updated
    await waitFor(async () => {
      const updated = await Contact.get(alice.$id)
      expect(updated?.name).toBe('Updated Alice')
    })
  })

  it('row insert actually creates an entity in the backend', async () => {
    const Contact = registerTestNoun()
    render(<EntityGrid noun="Contact" />)

    await waitFor(() => {
      const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
      const props = lastCall?.[0] as Record<string, unknown>
      expect(props.isLoading).toBe(false)
    })

    const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    const onInsert = props.onInsert as (row: Record<string, unknown>) => void
    onInsert({ name: 'Charlie', stage: 'Lead' })

    // Verify the real backend has the new entity
    await waitFor(async () => {
      const all = await Contact.find()
      expect(all.length).toBe(1)
      expect(all[0].name).toBe('Charlie')
    })
  })

  it('row delete actually removes entities from the backend', async () => {
    const Contact = registerTestNoun()
    const alice = await Contact.create({ name: 'Alice', stage: 'Lead' })
    const bob = await Contact.create({ name: 'Bob', stage: 'Qualified' })

    render(<EntityGrid noun="Contact" />)

    await waitFor(() => {
      const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
      const props = lastCall?.[0] as Record<string, unknown>
      expect((props.data as unknown[]).length).toBe(2)
    })

    const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    const onDeleteRows = props.onDeleteRows as (ids: string[]) => void
    onDeleteRows([alice.$id, bob.$id])

    // Verify the real backend is empty
    await waitFor(async () => {
      const all = await Contact.find()
      expect(all.length).toBe(0)
    })
  })

  it('shows empty message when no data', async () => {
    registerTestNoun()
    render(<EntityGrid noun="Contact" />)

    await waitFor(() => {
      const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
      const props = lastCall?.[0] as Record<string, unknown>
      expect(props.isLoading).toBe(false)
    })

    const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    expect(props.emptyMessage).toBe('No contacts found')
  })

  it('handles unknown noun gracefully', () => {
    render(<EntityGrid noun="UnknownEntity" />)
    expect(screen.getByText('Unknown entity: UnknownEntity')).toBeInTheDocument()
  })

  it('passes rowHeight prop through to DatabaseGrid', async () => {
    registerTestNoun()
    render(<EntityGrid noun="Contact" rowHeight="compact" />)

    await waitFor(() => {
      expect(screen.getByTestId('database-grid')).toBeInTheDocument()
    })

    const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    expect(props.rowHeight).toBe('compact')
  })

  it('disables editing callbacks when editable=false', async () => {
    registerTestNoun()
    render(<EntityGrid noun="Contact" editable={false} />)

    await waitFor(() => {
      expect(screen.getByTestId('database-grid')).toBeInTheDocument()
    })

    const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    expect(props.onCellUpdate).toBeUndefined()
    expect(props.onInsert).toBeUndefined()
    expect(props.onDeleteRows).toBeUndefined()
  })

  it('marks columns as non-editable when editable=false', async () => {
    registerTestNoun()
    render(<EntityGrid noun="Contact" editable={false} />)

    await waitFor(() => {
      expect(screen.getByTestId('database-grid')).toBeInTheDocument()
    })

    const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    const columns = props.columns as Array<{ editable: boolean }>
    for (const col of columns) {
      expect(col.editable).toBe(false)
    }
  })

  it('passes onViewRow callback through', async () => {
    const Contact = registerTestNoun()
    await Contact.create({ name: 'Alice', stage: 'Lead' })
    const onViewRow = vi.fn()

    render(<EntityGrid noun="Contact" onViewRow={onViewRow} />)

    await waitFor(() => {
      const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
      const props = lastCall?.[0] as Record<string, unknown>
      expect((props.data as unknown[]).length).toBe(1)
    })

    const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    const handleViewRow = props.onViewRow as (id: string, row: Record<string, unknown>) => void
    handleViewRow('contact_1', { name: 'Alice' })
    expect(onViewRow).toHaveBeenCalledWith('contact_1', { name: 'Alice' })
  })

  it('sets rowIdField to $id', async () => {
    registerTestNoun()
    render(<EntityGrid noun="Contact" />)

    await waitFor(() => {
      expect(screen.getByTestId('database-grid')).toBeInTheDocument()
    })

    const lastCall = vi.mocked(DatabaseGrid).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    expect(props.rowIdField).toBe('$id')
  })
})
