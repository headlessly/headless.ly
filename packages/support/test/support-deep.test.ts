import { describe, it, expect, vi } from 'vitest'
import { Ticket } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/support deep tests', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Ticket Noun Schema (~7 tests)
  // ===========================================================================
  describe('Ticket Noun schema', () => {
    it('has correct entity name', () => {
      expect(Ticket.$name).toBe('Ticket')
      expect(Ticket.$schema.name).toBe('Ticket')
    })

    it('has correct linguistic derivations', () => {
      expect(Ticket.$schema.singular).toBe('ticket')
      expect(Ticket.$schema.plural).toBe('tickets')
      expect(Ticket.$schema.slug).toBe('ticket')
    })

    it('has subject as a required string field', () => {
      const subject = Ticket.$schema.fields.get('subject')
      expect(subject).toBeDefined()
      expect(subject!.kind).toBe('field')
      expect(subject!.type).toBe('string')
      expect(subject!.modifiers?.required).toBe(true)
    })

    it('has description as an optional string field', () => {
      const description = Ticket.$schema.fields.get('description')
      expect(description).toBeDefined()
      expect(description!.kind).toBe('field')
      expect(description!.type).toBe('string')
      expect(description!.modifiers?.required).toBe(false)
    })

    it('has status enum with correct values', () => {
      const status = Ticket.$schema.fields.get('status')
      expect(status).toBeDefined()
      expect(status!.kind).toBe('enum')
      expect(status!.enumValues).toEqual(['Open', 'Pending', 'InProgress', 'Resolved', 'Closed'])
    })

    it('has priority enum with correct values', () => {
      const priority = Ticket.$schema.fields.get('priority')
      expect(priority).toBeDefined()
      expect(priority!.kind).toBe('enum')
      expect(priority!.enumValues).toEqual(['Low', 'Medium', 'High', 'Urgent'])
    })

    it('has channel enum with correct values', () => {
      const channel = Ticket.$schema.fields.get('channel')
      expect(channel).toBeDefined()
      expect(channel!.kind).toBe('enum')
      expect(channel!.enumValues).toEqual(['Email', 'Chat', 'Phone', 'Web', 'API'])
    })

    it('has all expected data fields', () => {
      const fieldNames = [...Ticket.$schema.fields.keys()]
      expect(fieldNames).toContain('subject')
      expect(fieldNames).toContain('description')
      expect(fieldNames).toContain('status')
      expect(fieldNames).toContain('priority')
      expect(fieldNames).toContain('category')
      expect(fieldNames).toContain('channel')
      expect(fieldNames).toContain('tags')
      expect(fieldNames).toContain('firstResponseAt')
      expect(fieldNames).toContain('resolvedAt')
      expect(fieldNames).toContain('satisfaction')
    })

    it('has satisfaction as a number field', () => {
      const satisfaction = Ticket.$schema.fields.get('satisfaction')
      expect(satisfaction).toBeDefined()
      expect(satisfaction!.kind).toBe('field')
      expect(satisfaction!.type).toBe('number')
    })

    it('has datetime fields for timestamps', () => {
      const firstResponseAt = Ticket.$schema.fields.get('firstResponseAt')
      expect(firstResponseAt).toBeDefined()
      expect(firstResponseAt!.type).toBe('datetime')

      const resolvedAt = Ticket.$schema.fields.get('resolvedAt')
      expect(resolvedAt).toBeDefined()
      expect(resolvedAt!.type).toBe('datetime')
    })
  })

  // ===========================================================================
  // 2. Relationships (~4 tests)
  // ===========================================================================
  describe('Ticket relationships', () => {
    it('has assignee relationship to Contact', () => {
      const assignee = Ticket.$schema.relationships.get('assignee')
      expect(assignee).toBeDefined()
      expect(assignee!.kind).toBe('relationship')
      expect(assignee!.operator).toBe('->')
      expect(assignee!.targetType).toBe('Contact')
    })

    it('has requester relationship to Contact', () => {
      const requester = Ticket.$schema.relationships.get('requester')
      expect(requester).toBeDefined()
      expect(requester!.kind).toBe('relationship')
      expect(requester!.operator).toBe('->')
      expect(requester!.targetType).toBe('Contact')
    })

    it('has organization relationship to Organization', () => {
      const organization = Ticket.$schema.relationships.get('organization')
      expect(organization).toBeDefined()
      expect(organization!.kind).toBe('relationship')
      expect(organization!.operator).toBe('->')
      expect(organization!.targetType).toBe('Organization')
    })

    it('has exactly three relationships', () => {
      expect(Ticket.$schema.relationships.size).toBe(3)
    })
  })

  // ===========================================================================
  // 3. Ticket Verbs (~6 tests)
  // ===========================================================================
  describe('Ticket verbs', () => {
    it('has default CRUD verbs in the verb map', () => {
      const verbNames = [...Ticket.$schema.verbs.keys()]
      expect(verbNames).toContain('create')
      expect(verbNames).toContain('update')
      expect(verbNames).toContain('delete')
    })

    it('has custom verb: resolve', () => {
      const resolve = Ticket.$schema.verbs.get('resolve')
      expect(resolve).toBeDefined()
      expect(resolve!.action).toBe('resolve')
      expect(resolve!.activity).toBe('resolving')
      expect(resolve!.event).toBe('resolved')
    })

    it('has custom verb: escalate', () => {
      const escalate = Ticket.$schema.verbs.get('escalate')
      expect(escalate).toBeDefined()
      expect(escalate!.action).toBe('escalate')
      expect(escalate!.activity).toBe('escalating')
      expect(escalate!.event).toBe('escalated')
    })

    it('has custom verb: close', () => {
      const close = Ticket.$schema.verbs.get('close')
      expect(close).toBeDefined()
      expect(close!.action).toBe('close')
      expect(close!.activity).toBe('closing')
      expect(close!.event).toBe('closed')
    })

    it('has custom verb: reopen', () => {
      const reopen = Ticket.$schema.verbs.get('reopen')
      expect(reopen).toBeDefined()
      expect(reopen!.action).toBe('reopen')
      expect(reopen!.activity).toBe('reopening')
      expect(reopen!.event).toBe('reopened')
    })

    it('has exactly 7 verbs (3 CRUD + 4 custom)', () => {
      expect(Ticket.$schema.verbs.size).toBe(7)
    })
  })

  // ===========================================================================
  // 4. Ticket Lifecycle (~8 tests)
  // ===========================================================================
  describe('Ticket lifecycle', () => {
    it('creates a ticket with default status Open', async () => {
      const ticket = await Ticket.create({ subject: 'Login broken', status: 'Open', priority: 'High' })
      expect(ticket.$type).toBe('Ticket')
      expect(ticket.$id).toMatch(/^ticket_/)
      expect(ticket.subject).toBe('Login broken')
      expect(ticket.status).toBe('Open')
      expect(ticket.priority).toBe('High')
    })

    it('updates ticket status via update', async () => {
      const ticket = await Ticket.create({ subject: 'Bug report', status: 'Open' })
      const updated = await Ticket.update(ticket.$id, { status: 'InProgress' })
      expect(updated.status).toBe('InProgress')
      expect(updated.$version).toBe(2)
    })

    it('resolves a ticket via resolve verb', async () => {
      const ticket = await Ticket.create({ subject: 'Fix needed', status: 'Open' })
      const resolved = await Ticket.resolve(ticket.$id)
      expect(resolved.status).toBe('Resolved')
    })

    it('closes a ticket via close verb', async () => {
      const ticket = await Ticket.create({ subject: 'Old issue', status: 'Resolved' })
      const closed = await Ticket.close(ticket.$id)
      expect(closed.status).toBe('Closed')
    })

    it('reopens a closed ticket via reopen verb', async () => {
      const ticket = await Ticket.create({ subject: 'Recurring bug', status: 'Closed' })
      const reopened = await Ticket.reopen(ticket.$id)
      expect(reopened.status).toBe('Reopened')
    })

    it('escalates a ticket via escalate verb', async () => {
      // escalate maps to 'Escalated' - but no enum field contains 'Escalated'
      // so it may not change status. The verb still executes.
      const ticket = await Ticket.create({ subject: 'Urgent issue', status: 'Open', priority: 'Medium' })
      const escalated = await Ticket.escalate(ticket.$id)
      expect(escalated).toBeDefined()
      expect(escalated.$id).toBe(ticket.$id)
    })

    it('version increments on each update', async () => {
      const ticket = await Ticket.create({ subject: 'Version test', status: 'Open' })
      expect(ticket.$version).toBe(1)

      const v2 = await Ticket.update(ticket.$id, { status: 'Pending' })
      expect(v2.$version).toBe(2)

      const v3 = await Ticket.update(ticket.$id, { status: 'InProgress' })
      expect(v3.$version).toBe(3)
    })

    it('preserves other fields when updating status', async () => {
      const ticket = await Ticket.create({
        subject: 'Billing issue',
        description: 'Customer overcharged',
        status: 'Open',
        priority: 'High',
        category: 'billing',
      })

      const updated = await Ticket.update(ticket.$id, { status: 'InProgress' })
      expect(updated.subject).toBe('Billing issue')
      expect(updated.description).toBe('Customer overcharged')
      expect(updated.priority).toBe('High')
      expect(updated.category).toBe('billing')
      expect(updated.status).toBe('InProgress')
    })
  })

  // ===========================================================================
  // 5. Hook Registration (~4 tests)
  // ===========================================================================
  describe('Ticket hook registration', () => {
    it('registers a BEFORE hook on resolving', async () => {
      const spy = vi.fn()
      const unsub = Ticket.resolving(spy)
      expect(typeof unsub).toBe('function')

      const ticket = await Ticket.create({ subject: 'Hook test', status: 'Open' })
      await Ticket.resolve(ticket.$id)
      expect(spy).toHaveBeenCalled()

      unsub()
    })

    it('registers an AFTER hook on resolved', async () => {
      const spy = vi.fn()
      const unsub = Ticket.resolved(spy)
      expect(typeof unsub).toBe('function')

      const ticket = await Ticket.create({ subject: 'After hook test', status: 'Open' })
      await Ticket.resolve(ticket.$id)
      expect(spy).toHaveBeenCalled()

      unsub()
    })

    it('registers a BEFORE hook on creating', async () => {
      const spy = vi.fn()
      const unsub = Ticket.creating(spy)
      expect(typeof unsub).toBe('function')

      await Ticket.create({ subject: 'Create hook test' })
      expect(spy).toHaveBeenCalledTimes(1)

      unsub()
    })

    it('unsubscribe stops hook from firing', async () => {
      const spy = vi.fn()
      const unsub = Ticket.closing(spy)

      const ticket = await Ticket.create({ subject: 'Unsub test', status: 'Open' })
      unsub()

      await Ticket.close(ticket.$id)
      expect(spy).not.toHaveBeenCalled()
    })
  })

  // ===========================================================================
  // 6. Query and Find (~5 tests)
  // ===========================================================================
  describe('Ticket querying', () => {
    it('finds all tickets with no filter', async () => {
      await Ticket.create({ subject: 'Ticket A', status: 'Open' })
      await Ticket.create({ subject: 'Ticket B', status: 'Open' })
      await Ticket.create({ subject: 'Ticket C', status: 'Closed' })

      const all = await Ticket.find()
      expect(all.length).toBe(3)
    })

    it('finds tickets by status', async () => {
      await Ticket.create({ subject: 'Open 1', status: 'Open' })
      await Ticket.create({ subject: 'Open 2', status: 'Open' })
      await Ticket.create({ subject: 'Closed 1', status: 'Closed' })

      const open = await Ticket.find({ status: 'Open' })
      expect(open.length).toBe(2)
      expect(open.every((t: any) => t.status === 'Open')).toBe(true)
    })

    it('finds tickets by priority', async () => {
      await Ticket.create({ subject: 'Low priority', priority: 'Low' })
      await Ticket.create({ subject: 'High priority', priority: 'High' })
      await Ticket.create({ subject: 'High priority 2', priority: 'High' })

      const high = await Ticket.find({ priority: 'High' })
      expect(high.length).toBe(2)
    })

    it('finds tickets by category', async () => {
      await Ticket.create({ subject: 'Billing ticket', category: 'billing' })
      await Ticket.create({ subject: 'Tech ticket', category: 'technical' })

      const billing = await Ticket.find({ category: 'billing' })
      expect(billing.length).toBe(1)
      expect(billing[0].subject).toBe('Billing ticket')
    })

    it('finds tickets by channel', async () => {
      await Ticket.create({ subject: 'Email ticket', channel: 'Email' })
      await Ticket.create({ subject: 'Chat ticket', channel: 'Chat' })
      await Ticket.create({ subject: 'Email ticket 2', channel: 'Email' })

      const emailTickets = await Ticket.find({ channel: 'Email' })
      expect(emailTickets.length).toBe(2)
    })
  })

  // ===========================================================================
  // 7. Edge Cases (~5 tests)
  // ===========================================================================
  describe('Ticket edge cases', () => {
    it('creates a ticket with only the required subject field', async () => {
      const ticket = await Ticket.create({ subject: 'Minimal ticket' })
      expect(ticket.$id).toMatch(/^ticket_/)
      expect(ticket.subject).toBe('Minimal ticket')
      expect(ticket.$version).toBe(1)
    })

    it('creates a ticket with all possible fields', async () => {
      const ticket = await Ticket.create({
        subject: 'Full ticket',
        description: 'Detailed description of the problem',
        status: 'Open',
        priority: 'Urgent',
        category: 'technical',
        channel: 'Phone',
        tags: 'urgent,production',
        satisfaction: 5,
      })
      expect(ticket.subject).toBe('Full ticket')
      expect(ticket.description).toBe('Detailed description of the problem')
      expect(ticket.status).toBe('Open')
      expect(ticket.priority).toBe('Urgent')
      expect(ticket.category).toBe('technical')
      expect(ticket.channel).toBe('Phone')
      expect(ticket.tags).toBe('urgent,production')
      expect(ticket.satisfaction).toBe(5)
    })

    it('get returns null for non-existent ticket', async () => {
      const result = await Ticket.get('ticket_nonexist')
      expect(result).toBeNull()
    })

    it('delete returns false for non-existent ticket', async () => {
      const result = await Ticket.delete('ticket_nonexist')
      expect(result).toBe(false)
    })

    it('update throws for non-existent ticket', async () => {
      await expect(Ticket.update('ticket_nonexist', { subject: 'Nope' })).rejects.toThrow()
    })
  })
})
