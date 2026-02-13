import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Noun } from 'digital-objects'
import { DatabaseSidebar, TableEditorToolbar, DatabaseGrid } from '@mdxui/admin'
import { HeadlessAdmin } from '../src/headless-admin'

function registerTestNouns() {
  Noun('Contact', {
    name: 'string!',
    email: 'string?',
    stage: 'Lead | Qualified | Customer',
  })
  Noun('Deal', {
    title: 'string!',
    value: 'number',
    stage: 'Open | Won | Lost',
  })
  Noun('Project', {
    name: 'string!',
    status: 'Active | Archived',
  })
}

describe('HeadlessAdmin', () => {
  beforeEach(() => {
    vi.mocked(DatabaseSidebar).mockClear()
    vi.mocked(TableEditorToolbar).mockClear()
    vi.mocked(DatabaseGrid).mockClear()
  })

  it('renders DatabaseSidebar with entity schemas', () => {
    registerTestNouns()
    render(<HeadlessAdmin />)

    expect(screen.getByTestId('database-sidebar')).toBeInTheDocument()
    expect(DatabaseSidebar).toHaveBeenCalled()

    const props = vi.mocked(DatabaseSidebar).mock.calls[0][0] as Record<string, unknown>
    const schemas = props.schemas as Array<{ name: string; tables: Array<{ name: string }> }>
    expect(schemas.length).toBeGreaterThan(0)

    const allTables = schemas.flatMap((s) => s.tables.map((t) => t.name))
    expect(allTables).toContain('Contact')
    expect(allTables).toContain('Deal')
    expect(allTables).toContain('Project')
  })

  it('shows empty state when no entity is selected', () => {
    registerTestNouns()
    render(<HeadlessAdmin />)
    expect(screen.getByText('Select an entity from the sidebar')).toBeInTheDocument()
  })

  it('does not render toolbar or grid when no entity selected', () => {
    registerTestNouns()
    render(<HeadlessAdmin />)
    expect(screen.queryByTestId('table-editor-toolbar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('database-grid')).not.toBeInTheDocument()
  })

  it('selecting entity in sidebar renders EntityGrid for that entity', async () => {
    registerTestNouns()
    render(<HeadlessAdmin />)

    fireEvent.click(screen.getByTestId('table-Contact'))

    await waitFor(() => {
      expect(screen.queryByText('Select an entity from the sidebar')).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('table-editor-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('database-grid')).toBeInTheDocument()
  })

  it('shows TableEditorToolbar when entity is selected', async () => {
    registerTestNouns()
    render(<HeadlessAdmin />)

    fireEvent.click(screen.getByTestId('table-Contact'))

    await waitFor(() => {
      expect(screen.getByTestId('table-editor-toolbar')).toBeInTheDocument()
    })

    const lastCall = vi.mocked(TableEditorToolbar).mock.calls.at(-1)
    const props = lastCall?.[0] as Record<string, unknown>
    expect(props.tableName).toBe('Contact')
  })

  it('defaultEntity prop pre-selects an entity', () => {
    registerTestNouns()
    render(<HeadlessAdmin defaultEntity="Deal" />)

    expect(screen.queryByText('Select an entity from the sidebar')).not.toBeInTheDocument()
    expect(screen.getByTestId('table-editor-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('database-grid')).toBeInTheDocument()
  })

  it('entities prop limits which entities appear in sidebar', () => {
    registerTestNouns()
    render(<HeadlessAdmin entities={['Contact', 'Deal']} />)

    const props = vi.mocked(DatabaseSidebar).mock.calls[0][0] as Record<string, unknown>
    const schemas = props.schemas as Array<{ name: string; tables: Array<{ name: string }> }>
    const allTables = schemas.flatMap((s) => s.tables.map((t) => t.name))
    expect(allTables).toContain('Contact')
    expect(allTables).toContain('Deal')
    expect(allTables).not.toContain('Project')
  })

  it('onViewRow callback passes through with noun context', async () => {
    registerTestNouns()
    const onViewRow = vi.fn()
    render(<HeadlessAdmin defaultEntity="Contact" onViewRow={onViewRow} />)

    await waitFor(() => {
      expect(vi.mocked(DatabaseGrid).mock.calls.length).toBeGreaterThan(0)
    })

    const gridProps = vi.mocked(DatabaseGrid).mock.calls.at(-1)?.[0] as Record<string, unknown>
    const handleViewRow = gridProps.onViewRow as (id: string, row: Record<string, unknown>) => void
    handleViewRow('contact_1', { name: 'Alice' })
    expect(onViewRow).toHaveBeenCalledWith('Contact', 'contact_1', { name: 'Alice' })
  })

  it('onRelationshipNavigate callback passes through', async () => {
    registerTestNouns()
    const onRelationshipNavigate = vi.fn()
    render(<HeadlessAdmin defaultEntity="Contact" onRelationshipNavigate={onRelationshipNavigate} />)

    await waitFor(() => {
      expect(vi.mocked(DatabaseGrid).mock.calls.length).toBeGreaterThan(0)
    })

    const gridProps = vi.mocked(DatabaseGrid).mock.calls.at(-1)?.[0] as Record<string, unknown>
    const handleNav = gridProps.onRelationshipNavigate as (link: { targetTable: string; targetId: string }, col: unknown) => void
    handleNav({ targetTable: 'Deal', targetId: 'deal_1' }, {})
    expect(onRelationshipNavigate).toHaveBeenCalledWith('Deal', 'deal_1')
  })

  it('editable=false disables editing on EntityGrid', async () => {
    registerTestNouns()
    render(<HeadlessAdmin defaultEntity="Contact" editable={false} />)

    await waitFor(() => {
      expect(vi.mocked(DatabaseGrid).mock.calls.length).toBeGreaterThan(0)
    })

    const gridProps = vi.mocked(DatabaseGrid).mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(gridProps.onCellUpdate).toBeUndefined()
    expect(gridProps.onInsert).toBeUndefined()
  })

  it('passes className to wrapper', () => {
    registerTestNouns()
    const { container } = render(<HeadlessAdmin className="my-admin" />)
    expect(container.firstElementChild?.className).toContain('my-admin')
  })

  it('renders sidebar even with no nouns registered', () => {
    render(<HeadlessAdmin />)
    expect(screen.getByTestId('database-sidebar')).toBeInTheDocument()
    expect(screen.getByText('Select an entity from the sidebar')).toBeInTheDocument()
  })
})
