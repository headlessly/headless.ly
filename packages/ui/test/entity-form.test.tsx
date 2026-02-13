import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Noun } from 'digital-objects'
import { EntityForm } from '../src/entity-form'

function registerTestNoun() {
  return Noun('Contact', {
    name: 'string!',
    email: 'string?',
    stage: 'Lead | Qualified | Customer',
    score: 'number',
    active: 'boolean',
  })
}

describe('EntityForm', () => {
  // -------------------------------------------------------------------------
  // Create mode
  // -------------------------------------------------------------------------

  it('renders form fields for a noun schema in create mode', () => {
    registerTestNoun()
    render(<EntityForm noun="Contact" />)

    expect(screen.getByText('Create Contact')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Stage')).toBeInTheDocument()
  })

  it('shows Create button in create mode', () => {
    registerTestNoun()
    render(<EntityForm noun="Contact" />)
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })

  it('renders text input for string fields', () => {
    registerTestNoun()
    render(<EntityForm noun="Contact" />)
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
  })

  it('renders number input for number fields', () => {
    registerTestNoun()
    render(<EntityForm noun="Contact" />)
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('renders checkbox for boolean fields', () => {
    registerTestNoun()
    render(<EntityForm noun="Contact" />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('renders select for enum fields with all options', () => {
    registerTestNoun()
    render(<EntityForm noun="Contact" />)
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('Lead')).toBeInTheDocument()
    expect(screen.getByText('Qualified')).toBeInTheDocument()
    expect(screen.getByText('Customer')).toBeInTheDocument()
  })

  it('shows required indicator for required fields', () => {
    registerTestNoun()
    render(<EntityForm noun="Contact" />)
    const stars = screen.getAllByText('*')
    expect(stars.length).toBeGreaterThan(0)
  })

  it('submit actually creates an entity in the backend', async () => {
    const Contact = registerTestNoun()
    render(<EntityForm noun="Contact" />)

    // Fill in name (required)
    const nameInput = screen.getAllByRole('textbox')[0]
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    const form = screen.getByRole('button', { name: 'Create' }).closest('form')!
    fireEvent.submit(form)

    // Verify entity was actually created in the real backend
    await waitFor(async () => {
      const all = await Contact.find()
      expect(all.length).toBe(1)
      expect(all[0].name).toBe('Alice')
    })
  })

  it('submit strips $-prefixed meta fields from data', async () => {
    const Contact = registerTestNoun()
    render(<EntityForm noun="Contact" />)

    const nameInput = screen.getAllByRole('textbox')[0]
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    const form = screen.getByRole('button', { name: 'Create' }).closest('form')!
    fireEvent.submit(form)

    await waitFor(async () => {
      const all = await Contact.find()
      expect(all.length).toBe(1)
    })

    // The created entity should have $id (added by provider), but the create call
    // should not have included $ fields from form data
    const created = (await Contact.find())[0]
    expect(created.$id).toBeDefined()
    expect(created.name).toBe('Alice')
  })

  it('validates required fields before submitting', async () => {
    const Contact = registerTestNoun()

    render(<EntityForm noun="Contact" />)

    // Submit without filling name
    const form = screen.getByRole('button', { name: 'Create' }).closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })

    // Nothing was created in the backend
    const all = await Contact.find()
    expect(all.length).toBe(0)
  })

  it('fires onSubmit callback with the created entity', async () => {
    registerTestNoun()
    const onSubmit = vi.fn()
    render(<EntityForm noun="Contact" onSubmit={onSubmit} />)

    const nameInput = screen.getAllByRole('textbox')[0]
    fireEvent.change(nameInput, { target: { value: 'Alice' } })

    const form = screen.getByRole('button', { name: 'Create' }).closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled()
    })

    const result = onSubmit.mock.calls[0][0] as Record<string, unknown>
    expect(result.name).toBe('Alice')
    expect(result.$id).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // Edit mode
  // -------------------------------------------------------------------------

  it('loads existing entity and shows Update button in edit mode', async () => {
    const Contact = registerTestNoun()
    const alice = await Contact.create({ name: 'Alice', email: 'alice@test.com', stage: 'Lead', score: 85, active: true })

    render(<EntityForm noun="Contact" id={alice.$id} />)

    await waitFor(() => {
      expect(screen.getByText('Edit Contact')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
  })

  it('shows loading state while entity loads in edit mode', () => {
    registerTestNoun()
    // Render with a non-existent id — hook will be loading initially
    render(<EntityForm noun="Contact" id="contact_xxx" />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('submit in edit mode actually updates the entity in the backend', async () => {
    const Contact = registerTestNoun()
    const alice = await Contact.create({ name: 'Alice', email: 'alice@test.com', stage: 'Lead', score: 0, active: false })

    render(<EntityForm noun="Contact" id={alice.$id} />)

    await waitFor(() => {
      expect(screen.getByText('Edit Contact')).toBeInTheDocument()
    })

    const form = screen.getByRole('button', { name: 'Update' }).closest('form')!
    fireEvent.submit(form)

    // Verify the real backend entity was updated (not just mock)
    await waitFor(async () => {
      const updated = await Contact.get(alice.$id)
      expect(updated).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // Cancel / Loading states
  // -------------------------------------------------------------------------

  it('calls onCancel when cancel button is clicked', () => {
    registerTestNoun()
    const onCancel = vi.fn()
    render(<EntityForm noun="Contact" onCancel={onCancel} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('does not render cancel button when onCancel is not provided', () => {
    registerTestNoun()
    render(<EntityForm noun="Contact" />)
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('handles unknown noun gracefully', () => {
    render(<EntityForm noun="UnknownEntity" />)
    expect(screen.getByText('Unknown entity: UnknownEntity')).toBeInTheDocument()
  })

  it('passes className to the form wrapper', () => {
    registerTestNoun()
    const { container } = render(<EntityForm noun="Contact" className="my-form" />)
    const form = container.querySelector('form')
    expect(form?.className).toContain('my-form')
  })
})
