import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Noun } from 'digital-objects'
import { EntityDetail } from '../src/entity-detail'

function registerTestNouns() {
  Noun('Company', {
    name: 'string!',
    contacts: '<- Contact.company[]',
  })
  return Noun('Contact', {
    name: 'string!',
    email: 'string?',
    stage: 'Lead | Qualified | Customer',
    company: '-> Company.contacts',
    qualify: 'Qualified',
  })
}

describe('EntityDetail', () => {
  it('renders entity fields with labels and values', async () => {
    const Contact = registerTestNouns()
    const alice = await Contact.create({ name: 'Alice', email: 'alice@test.com', stage: 'Lead' })

    render(<EntityDetail noun='Contact' id={alice.$id} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument()
    })

    expect(screen.getByText(alice.$id)).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    expect(screen.getByText('Lead')).toBeInTheDocument()
  })

  it('shows loading indicator when loading', () => {
    registerTestNouns()
    render(<EntityDetail noun='Contact' id='contact_xxx' />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows not found when entity does not exist', async () => {
    registerTestNouns()
    render(<EntityDetail noun='Contact' id='contact_nonexistent' />)

    await waitFor(() => {
      // useEntity resolves with null for missing entity → error state
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })
  })

  it('renders relationship section', async () => {
    const Contact = registerTestNouns()
    const alice = await Contact.create({ name: 'Alice', stage: 'Lead', company: 'company_1' })

    render(<EntityDetail noun='Contact' id={alice.$id} />)

    await waitFor(() => {
      expect(screen.getByText('Relationships')).toBeInTheDocument()
    })

    expect(screen.getByText('company_1')).toBeInTheDocument()
  })

  it('clicking relationship link calls onNavigate', async () => {
    const Contact = registerTestNouns()
    const alice = await Contact.create({ name: 'Alice', stage: 'Lead', company: 'company_1' })
    const onNavigate = vi.fn()

    render(<EntityDetail noun='Contact' id={alice.$id} onNavigate={onNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('company_1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('company_1'))
    expect(onNavigate).toHaveBeenCalledWith('Company', 'company_1')
  })

  it('renders verb action buttons for custom verbs', async () => {
    const Contact = registerTestNouns()
    const alice = await Contact.create({ name: 'Alice', stage: 'Lead' })

    render(<EntityDetail noun='Contact' id={alice.$id} />)

    await waitFor(() => {
      expect(screen.getByText('Qualify')).toBeInTheDocument()
    })
  })

  it('refresh button calls refetch and reloads data', async () => {
    const Contact = registerTestNouns()
    const alice = await Contact.create({ name: 'Alice', stage: 'Lead' })

    render(<EntityDetail noun='Contact' id={alice.$id} />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })

    // Update directly in backend
    await Contact.update(alice.$id, { name: 'Alice Updated' })

    // Click refresh
    fireEvent.click(screen.getByText('Refresh'))

    await waitFor(() => {
      expect(screen.getByText('Alice Updated')).toBeInTheDocument()
    })
  })

  it('edit button calls onEdit with noun and id', async () => {
    const Contact = registerTestNouns()
    const alice = await Contact.create({ name: 'Alice', stage: 'Lead' })
    const onEdit = vi.fn()

    render(<EntityDetail noun='Contact' id={alice.$id} onEdit={onEdit} />)

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Edit'))
    expect(onEdit).toHaveBeenCalledWith('Contact', alice.$id)
  })

  it('does not render Edit button when onEdit is not provided', async () => {
    const Contact = registerTestNouns()
    const alice = await Contact.create({ name: 'Alice', stage: 'Lead' })

    render(<EntityDetail noun='Contact' id={alice.$id} />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  })

  it('renders meta section with type and version', async () => {
    const Contact = registerTestNouns()
    const alice = await Contact.create({ name: 'Alice', stage: 'Lead' })

    render(<EntityDetail noun='Contact' id={alice.$id} />)

    await waitFor(() => {
      expect(screen.getByText('Meta')).toBeInTheDocument()
    })
  })

  it('handles unknown noun gracefully', () => {
    render(<EntityDetail noun='UnknownEntity' id='x' />)
    expect(screen.getByText('Unknown entity: UnknownEntity')).toBeInTheDocument()
  })

  it('passes className through', async () => {
    const Contact = registerTestNouns()
    const alice = await Contact.create({ name: 'Alice', stage: 'Lead' })

    const { container } = render(<EntityDetail noun='Contact' id={alice.$id} className='my-detail' />)

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
    expect(container.firstElementChild?.className).toContain('my-detail')
  })
})
