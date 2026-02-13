import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Noun } from 'digital-objects'
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
  it('renders sidebar with entity names from schemas', () => {
    registerTestNouns()
    render(<HeadlessAdmin />)

    // Real DatabaseSidebar renders with role="navigation"
    expect(screen.getByRole('navigation', { name: 'Database tables' })).toBeInTheDocument()

    // Table names appear as buttons in the sidebar
    expect(screen.getByText('Contact')).toBeInTheDocument()
    expect(screen.getByText('Deal')).toBeInTheDocument()
    expect(screen.getByText('Project')).toBeInTheDocument()
  })

  it('shows empty state when no entity is selected', () => {
    registerTestNouns()
    render(<HeadlessAdmin />)
    expect(screen.getByText('Select an entity from the sidebar')).toBeInTheDocument()
  })

  it('does not render grid when no entity selected', () => {
    registerTestNouns()
    render(<HeadlessAdmin />)
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('selecting entity in sidebar renders grid for that entity', async () => {
    registerTestNouns()
    render(<HeadlessAdmin />)

    // Click on "Contact" in the sidebar (it's a button with role="option")
    const contactButtons = screen.getAllByRole('option').filter((el) => el.textContent?.includes('Contact'))
    expect(contactButtons.length).toBeGreaterThan(0)
    fireEvent.click(contactButtons[0])

    await waitFor(() => {
      expect(screen.queryByText('Select an entity from the sidebar')).not.toBeInTheDocument()
    })

    // Grid should now be rendered (real DatabaseGrid uses role="grid")
    await waitFor(() => {
      // Either grid or skeleton should be present
      const grid = screen.queryByRole('grid')
      const skeletons = screen.queryAllByTestId('skeleton')
      expect(grid || skeletons.length > 0).toBeTruthy()
    })
  })

  it('defaultEntity prop pre-selects an entity', async () => {
    registerTestNouns()
    render(<HeadlessAdmin defaultEntity="Deal" />)

    expect(screen.queryByText('Select an entity from the sidebar')).not.toBeInTheDocument()

    // Grid or loading state should be present
    await waitFor(() => {
      const grid = screen.queryByRole('grid')
      const skeletons = screen.queryAllByTestId('skeleton')
      expect(grid || skeletons.length > 0).toBeTruthy()
    })
  })

  it('entities prop limits which entities appear in sidebar', () => {
    registerTestNouns()
    render(<HeadlessAdmin entities={['Contact', 'Deal']} />)

    expect(screen.getByText('Contact')).toBeInTheDocument()
    expect(screen.getByText('Deal')).toBeInTheDocument()
    expect(screen.queryByText('Project')).not.toBeInTheDocument()
  })

  it('passes className to wrapper', () => {
    registerTestNouns()
    const { container } = render(<HeadlessAdmin className="my-admin" />)
    expect(container.firstElementChild?.className).toContain('my-admin')
  })

  it('renders sidebar even with no nouns registered', () => {
    render(<HeadlessAdmin />)
    expect(screen.getByRole('navigation', { name: 'Database tables' })).toBeInTheDocument()
    expect(screen.getByText('Select an entity from the sidebar')).toBeInTheDocument()
  })

  it('shows column headers after selecting an entity', async () => {
    registerTestNouns()
    const Contact = Noun('Contact', {
      name: 'string!',
      email: 'string?',
      stage: 'Lead | Qualified | Customer',
    })
    await Contact.create({ name: 'Alice', stage: 'Lead' })

    render(<HeadlessAdmin defaultEntity="Contact" />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    // Column headers from schema-bridge should appear (may appear in sidebar too)
    expect(screen.getAllByText('Name').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Stage').length).toBeGreaterThan(0)
  })

  it('renders real data in the grid', async () => {
    registerTestNouns()
    const Contact = Noun('Contact', {
      name: 'string!',
      email: 'string?',
      stage: 'Lead | Qualified | Customer',
    })
    await Contact.create({ name: 'Alice', email: 'alice@test.com', stage: 'Lead' })
    await Contact.create({ name: 'Bob', email: 'bob@test.com', stage: 'Qualified' })

    render(<HeadlessAdmin defaultEntity="Contact" />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
  })
})
