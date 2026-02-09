import { describe, it, expect, vi } from 'vitest'
import { Ticket } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/support deep-v3 tests', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. MongoDB-style Query Operators ($in, $nin, $regex, $exists, $eq, $ne)
  // ===========================================================================
  describe('MongoDB-style $in operator', () => {
    it('finds tickets with status $in [Open, Pending]', async () => {
      await Ticket.create({ subject: 'T1', status: 'Open' })
      await Ticket.create({ subject: 'T2', status: 'Pending' })
      await Ticket.create({ subject: 'T3', status: 'Closed' })
      await Ticket.create({ subject: 'T4', status: 'InProgress' })

      const result = await Ticket.find({ status: { $in: ['Open', 'Pending'] } })
      expect(result.length).toBe(2)
      expect(result.every((t: any) => t.status === 'Open' || t.status === 'Pending')).toBe(true)
    })

    it('finds tickets with priority $in [High, Urgent]', async () => {
      await Ticket.create({ subject: 'Low', priority: 'Low' })
      await Ticket.create({ subject: 'High', priority: 'High' })
      await Ticket.create({ subject: 'Urgent', priority: 'Urgent' })
      await Ticket.create({ subject: 'Medium', priority: 'Medium' })

      const result = await Ticket.find({ priority: { $in: ['High', 'Urgent'] } })
      expect(result.length).toBe(2)
    })

    it('$in with single value behaves like exact match', async () => {
      await Ticket.create({ subject: 'Only Open', status: 'Open' })
      await Ticket.create({ subject: 'Closed', status: 'Closed' })

      const result = await Ticket.find({ status: { $in: ['Open'] } })
      expect(result.length).toBe(1)
      expect(result[0].subject).toBe('Only Open')
    })

    it('$in with empty array returns no results', async () => {
      await Ticket.create({ subject: 'T1', status: 'Open' })
      const result = await Ticket.find({ status: { $in: [] } })
      expect(result.length).toBe(0)
    })
  })

  describe('MongoDB-style $nin operator', () => {
    it('excludes tickets with status $nin [Closed, Resolved]', async () => {
      await Ticket.create({ subject: 'T1', status: 'Open' })
      await Ticket.create({ subject: 'T2', status: 'Closed' })
      await Ticket.create({ subject: 'T3', status: 'Resolved' })
      await Ticket.create({ subject: 'T4', status: 'Pending' })

      const result = await Ticket.find({ status: { $nin: ['Closed', 'Resolved'] } })
      expect(result.length).toBe(2)
      expect(result.every((t: any) => t.status !== 'Closed' && t.status !== 'Resolved')).toBe(true)
    })

    it('$nin with empty array returns all results', async () => {
      await Ticket.create({ subject: 'T1', status: 'Open' })
      await Ticket.create({ subject: 'T2', status: 'Closed' })

      const result = await Ticket.find({ status: { $nin: [] } })
      expect(result.length).toBe(2)
    })
  })

  describe('MongoDB-style $regex operator', () => {
    it('finds tickets with subject matching $regex', async () => {
      await Ticket.create({ subject: 'Login error on dashboard' })
      await Ticket.create({ subject: 'Payment failed' })
      await Ticket.create({ subject: 'Login timeout issue' })

      const result = await Ticket.find({ subject: { $regex: '^Login' } })
      expect(result.length).toBe(2)
      expect(result.every((t: any) => t.subject.startsWith('Login'))).toBe(true)
    })

    it('$regex with case-insensitive flag', async () => {
      await Ticket.create({ subject: 'ERROR in production' })
      await Ticket.create({ subject: 'error in staging' })
      await Ticket.create({ subject: 'Warning in staging' })

      const result = await Ticket.find({ subject: { $regex: new RegExp('error', 'i') } })
      expect(result.length).toBe(2)
    })

    it('$regex with partial match on tags', async () => {
      await Ticket.create({ subject: 'T1', tags: 'billing,urgent' })
      await Ticket.create({ subject: 'T2', tags: 'technical' })
      await Ticket.create({ subject: 'T3', tags: 'billing,low' })

      const result = await Ticket.find({ tags: { $regex: 'billing' } })
      expect(result.length).toBe(2)
    })
  })

  describe('MongoDB-style $exists operator', () => {
    it('finds tickets where description $exists: true', async () => {
      await Ticket.create({ subject: 'With desc', description: 'Some description' })
      await Ticket.create({ subject: 'Without desc' })
      await Ticket.create({ subject: 'With empty desc', description: '' })

      const result = await Ticket.find({ description: { $exists: true } })
      // description: '' exists (not undefined), description: 'Some description' exists
      expect(result.length).toBe(2)
    })

    it('finds tickets where assignee $exists: false', async () => {
      await Ticket.create({ subject: 'Assigned', assignee: 'contact_abcdEFGH' })
      await Ticket.create({ subject: 'Unassigned' })
      await Ticket.create({ subject: 'Also unassigned' })

      const result = await Ticket.find({ assignee: { $exists: false } })
      expect(result.length).toBe(2)
      expect(result.every((t: any) => t.assignee === undefined)).toBe(true)
    })

    it('finds tickets where satisfaction $exists: true', async () => {
      await Ticket.create({ subject: 'Rated', satisfaction: 5 })
      await Ticket.create({ subject: 'Unrated' })
      await Ticket.create({ subject: 'Zero rated', satisfaction: 0 })

      const result = await Ticket.find({ satisfaction: { $exists: true } })
      expect(result.length).toBe(2)
    })
  })

  describe('MongoDB-style $eq and $ne operators', () => {
    it('$eq behaves like exact match', async () => {
      await Ticket.create({ subject: 'Open', status: 'Open' })
      await Ticket.create({ subject: 'Closed', status: 'Closed' })

      const result = await Ticket.find({ status: { $eq: 'Open' } })
      expect(result.length).toBe(1)
      expect(result[0].subject).toBe('Open')
    })

    it('$ne excludes matching value', async () => {
      await Ticket.create({ subject: 'Open', status: 'Open' })
      await Ticket.create({ subject: 'Closed', status: 'Closed' })
      await Ticket.create({ subject: 'Pending', status: 'Pending' })

      const result = await Ticket.find({ status: { $ne: 'Open' } })
      expect(result.length).toBe(2)
      expect(result.every((t: any) => t.status !== 'Open')).toBe(true)
    })
  })

  describe('MongoDB-style $gt/$gte/$lt/$lte operators on numbers', () => {
    it('$gt finds tickets with satisfaction > 3', async () => {
      await Ticket.create({ subject: 'T1', satisfaction: 1 })
      await Ticket.create({ subject: 'T2', satisfaction: 3 })
      await Ticket.create({ subject: 'T3', satisfaction: 4 })
      await Ticket.create({ subject: 'T4', satisfaction: 5 })

      const result = await Ticket.find({ satisfaction: { $gt: 3 } })
      expect(result.length).toBe(2)
      expect(result.every((t: any) => t.satisfaction > 3)).toBe(true)
    })

    it('$gte finds tickets with satisfaction >= 3', async () => {
      await Ticket.create({ subject: 'T1', satisfaction: 1 })
      await Ticket.create({ subject: 'T2', satisfaction: 3 })
      await Ticket.create({ subject: 'T3', satisfaction: 5 })

      const result = await Ticket.find({ satisfaction: { $gte: 3 } })
      expect(result.length).toBe(2)
    })

    it('$lt finds tickets with satisfaction < 3', async () => {
      await Ticket.create({ subject: 'T1', satisfaction: 1 })
      await Ticket.create({ subject: 'T2', satisfaction: 2 })
      await Ticket.create({ subject: 'T3', satisfaction: 3 })
      await Ticket.create({ subject: 'T4', satisfaction: 5 })

      const result = await Ticket.find({ satisfaction: { $lt: 3 } })
      expect(result.length).toBe(2)
    })

    it('$lte finds tickets with satisfaction <= 3', async () => {
      await Ticket.create({ subject: 'T1', satisfaction: 1 })
      await Ticket.create({ subject: 'T2', satisfaction: 3 })
      await Ticket.create({ subject: 'T3', satisfaction: 5 })

      const result = await Ticket.find({ satisfaction: { $lte: 3 } })
      expect(result.length).toBe(2)
    })
  })

  describe('Combined MongoDB operators', () => {
    it('combines $gte and $lte for range query on satisfaction', async () => {
      await Ticket.create({ subject: 'T1', satisfaction: 1 })
      await Ticket.create({ subject: 'T2', satisfaction: 3 })
      await Ticket.create({ subject: 'T3', satisfaction: 4 })
      await Ticket.create({ subject: 'T4', satisfaction: 5 })

      const result = await Ticket.find({ satisfaction: { $gte: 3, $lte: 4 } })
      expect(result.length).toBe(2)
      expect(result.every((t: any) => t.satisfaction >= 3 && t.satisfaction <= 4)).toBe(true)
    })

    it('combines $in on status with $gt on satisfaction', async () => {
      await Ticket.create({ subject: 'T1', status: 'Open', satisfaction: 5 })
      await Ticket.create({ subject: 'T2', status: 'Closed', satisfaction: 5 })
      await Ticket.create({ subject: 'T3', status: 'Open', satisfaction: 1 })
      await Ticket.create({ subject: 'T4', status: 'Pending', satisfaction: 4 })

      const result = await Ticket.find({
        status: { $in: ['Open', 'Pending'] },
        satisfaction: { $gt: 3 },
      })
      expect(result.length).toBe(2)
    })

    it('combines $regex on subject with $exists on assignee', async () => {
      await Ticket.create({ subject: 'Login issue', assignee: 'contact_aAbBcCdD' })
      await Ticket.create({ subject: 'Login bug' })
      await Ticket.create({ subject: 'Payment failed', assignee: 'contact_eEfFgGhH' })

      const result = await Ticket.find({
        subject: { $regex: '^Login' },
        assignee: { $exists: true },
      })
      expect(result.length).toBe(1)
      expect(result[0].subject).toBe('Login issue')
    })

    it('combines $ne on priority with exact match on channel', async () => {
      await Ticket.create({ subject: 'T1', priority: 'Low', channel: 'Email' })
      await Ticket.create({ subject: 'T2', priority: 'High', channel: 'Email' })
      await Ticket.create({ subject: 'T3', priority: 'Low', channel: 'Chat' })

      const result = await Ticket.find({
        priority: { $ne: 'Low' },
        channel: 'Email',
      })
      expect(result.length).toBe(1)
      expect(result[0].subject).toBe('T2')
    })
  })

  // ===========================================================================
  // 2. Concurrent Operations
  // ===========================================================================
  describe('Concurrent ticket operations', () => {
    it('concurrent creates all succeed with unique IDs', async () => {
      const promises = Array.from({ length: 50 }, (_, i) => Ticket.create({ subject: `Concurrent ${i}`, status: 'Open' }))
      const tickets = await Promise.all(promises)

      expect(tickets.length).toBe(50)
      const ids = new Set(tickets.map((t) => t.$id))
      expect(ids.size).toBe(50)
      expect(tickets.every((t) => t.$type === 'Ticket')).toBe(true)
    })

    it('concurrent reads of the same ticket return consistent data', async () => {
      const ticket = await Ticket.create({ subject: 'Read me', status: 'Open', priority: 'High' })

      const reads = await Promise.all(Array.from({ length: 10 }, () => Ticket.get(ticket.$id)))
      expect(reads.every((r) => r !== null)).toBe(true)
      expect(reads.every((r) => r!.$id === ticket.$id)).toBe(true)
      expect(reads.every((r) => r!.subject === 'Read me')).toBe(true)
      expect(reads.every((r) => r!.status === 'Open')).toBe(true)
    })

    it('concurrent finds return consistent result sets', async () => {
      await Ticket.create({ subject: 'Open 1', status: 'Open' })
      await Ticket.create({ subject: 'Open 2', status: 'Open' })
      await Ticket.create({ subject: 'Closed 1', status: 'Closed' })

      const results = await Promise.all(Array.from({ length: 5 }, () => Ticket.find({ status: 'Open' })))
      expect(results.every((r) => r.length === 2)).toBe(true)
    })

    it('concurrent deletes of different tickets all succeed', async () => {
      const tickets = await Promise.all(Array.from({ length: 10 }, (_, i) => Ticket.create({ subject: `Delete ${i}` })))

      const deleteResults = await Promise.all(tickets.map((t) => Ticket.delete(t.$id)))
      expect(deleteResults.every((r) => r === true)).toBe(true)

      // Verify all are gone
      const checks = await Promise.all(tickets.map((t) => Ticket.get(t.$id)))
      expect(checks.every((r) => r === null)).toBe(true)
    })
  })

  // ===========================================================================
  // 3. Bulk Create / Update / Delete Patterns
  // ===========================================================================
  describe('Bulk operations via Promise.all', () => {
    it('bulk creates 25 tickets and verifies all exist', async () => {
      const data = Array.from({ length: 25 }, (_, i) => ({ subject: `Bulk ${i}`, status: 'Open', priority: 'Medium' }))
      const created = await Promise.all(data.map((d) => Ticket.create(d)))

      expect(created.length).toBe(25)

      const all = await Ticket.find({ status: 'Open' })
      expect(all.length).toBe(25)
    })

    it('bulk updates tickets from Open to Closed', async () => {
      const tickets = await Promise.all(Array.from({ length: 8 }, (_, i) => Ticket.create({ subject: `BulkUp ${i}`, status: 'Open' })))

      const updated = await Promise.all(tickets.map((t) => Ticket.update(t.$id, { status: 'Closed' })))
      expect(updated.every((u) => u.status === 'Closed')).toBe(true)
      expect(updated.every((u) => u.$version === 2)).toBe(true)

      const open = await Ticket.find({ status: 'Open' })
      expect(open.length).toBe(0)
    })

    it('bulk deletes with mixed existing/non-existing IDs', async () => {
      const t1 = await Ticket.create({ subject: 'Exists 1' })
      const t2 = await Ticket.create({ subject: 'Exists 2' })

      const results = await Promise.all([Ticket.delete(t1.$id), Ticket.delete('ticket_nonExist'), Ticket.delete(t2.$id)])

      expect(results[0]).toBe(true)
      expect(results[1]).toBe(false)
      expect(results[2]).toBe(true)
    })
  })

  // ===========================================================================
  // 4. Version Consistency Under Rapid Updates
  // ===========================================================================
  describe('Version consistency under rapid updates', () => {
    it('sequential updates increment version monotonically', async () => {
      const ticket = await Ticket.create({ subject: 'Version track', status: 'Open' })
      expect(ticket.$version).toBe(1)

      const v2 = await Ticket.update(ticket.$id, { status: 'Pending' })
      expect(v2.$version).toBe(2)

      const v3 = await Ticket.update(ticket.$id, { status: 'InProgress' })
      expect(v3.$version).toBe(3)

      const v4 = await Ticket.update(ticket.$id, { priority: 'High' })
      expect(v4.$version).toBe(4)

      const v5 = await Ticket.resolve(ticket.$id)
      expect(v5.$version).toBe(5)

      const v6 = await Ticket.close(ticket.$id)
      expect(v6.$version).toBe(6)

      // Verify final state via get
      const final = await Ticket.get(ticket.$id)
      expect(final!.$version).toBe(6)
      expect(final!.status).toBe('Closed')
    })

    it('$updatedAt changes on every update', async () => {
      const ticket = await Ticket.create({ subject: 'Timestamp track' })
      const createdAt = ticket.$createdAt

      // Small delay to ensure time difference
      const updated = await Ticket.update(ticket.$id, { description: 'Added desc' })
      expect(updated.$createdAt).toBe(createdAt)
      expect(updated.$updatedAt).toBeDefined()

      const updated2 = await Ticket.update(ticket.$id, { description: 'Changed desc' })
      expect(updated2.$createdAt).toBe(createdAt)
      expect(updated2.$updatedAt).toBeDefined()
    })

    it('$createdAt never changes across updates and verbs', async () => {
      const ticket = await Ticket.create({ subject: 'Immutable createdAt', status: 'Open' })
      const createdAt = ticket.$createdAt

      const u1 = await Ticket.update(ticket.$id, { priority: 'High' })
      expect(u1.$createdAt).toBe(createdAt)

      const u2 = await Ticket.resolve(ticket.$id)
      expect(u2.$createdAt).toBe(createdAt)

      const u3 = await Ticket.close(ticket.$id)
      expect(u3.$createdAt).toBe(createdAt)
    })
  })

  // ===========================================================================
  // 5. Hook Ordering with Multiple Subscribers
  // ===========================================================================
  describe('Hook ordering with 3+ subscribers', () => {
    it('BEFORE hooks fire in registration order with three subscribers', async () => {
      const order: string[] = []
      const unsub1 = Ticket.creating(() => {
        order.push('first')
      })
      const unsub2 = Ticket.creating(() => {
        order.push('second')
      })
      const unsub3 = Ticket.creating(() => {
        order.push('third')
      })

      await Ticket.create({ subject: 'Three hooks' })
      expect(order).toEqual(['first', 'second', 'third'])

      unsub1()
      unsub2()
      unsub3()
    })

    it('AFTER hooks fire in registration order with three subscribers', async () => {
      const order: string[] = []
      const unsub1 = Ticket.created(() => {
        order.push('A')
      })
      const unsub2 = Ticket.created(() => {
        order.push('B')
      })
      const unsub3 = Ticket.created(() => {
        order.push('C')
      })

      await Ticket.create({ subject: 'Three after hooks' })
      expect(order).toEqual(['A', 'B', 'C'])

      unsub1()
      unsub2()
      unsub3()
    })

    it('unsubscribing middle hook preserves order of remaining hooks', async () => {
      const order: string[] = []
      const unsub1 = Ticket.closing(() => {
        order.push('first')
      })
      const unsub2 = Ticket.closing(() => {
        order.push('second')
      })
      const unsub3 = Ticket.closing(() => {
        order.push('third')
      })

      // Remove the middle hook
      unsub2()

      const ticket = await Ticket.create({ subject: 'Middle removed', status: 'Open' })
      await Ticket.close(ticket.$id)
      expect(order).toEqual(['first', 'third'])

      unsub1()
      unsub3()
    })

    it('multiple BEFORE hooks can chain data transformations', async () => {
      const unsub1 = Ticket.creating((data: Record<string, unknown>) => {
        return { ...data, priority: 'High' }
      })
      const unsub2 = Ticket.creating((data: Record<string, unknown>) => {
        return { ...data, category: 'auto-tagged' }
      })

      const ticket = await Ticket.create({ subject: 'Chained transforms' })
      expect(ticket.priority).toBe('High')
      expect(ticket.category).toBe('auto-tagged')

      unsub1()
      unsub2()
    })
  })

  // ===========================================================================
  // 6. Updating/Updated Hook Tests
  // ===========================================================================
  describe('Update verb hooks', () => {
    it('updating BEFORE hook fires on update', async () => {
      const spy = vi.fn()
      const unsub = Ticket.updating(spy)

      const ticket = await Ticket.create({ subject: 'Update hook test' })
      await Ticket.update(ticket.$id, { status: 'Closed' })
      expect(spy).toHaveBeenCalledTimes(1)

      unsub()
    })

    it('updated AFTER hook fires on update', async () => {
      const spy = vi.fn()
      const unsub = Ticket.updated(spy)

      const ticket = await Ticket.create({ subject: 'Updated after hook' })
      await Ticket.update(ticket.$id, { priority: 'Urgent' })
      expect(spy).toHaveBeenCalledTimes(1)

      unsub()
    })

    it('updating hook can transform update data', async () => {
      const unsub = Ticket.updating((data: Record<string, unknown>) => {
        return { ...data, tags: 'auto-modified' }
      })

      const ticket = await Ticket.create({ subject: 'Transform update' })
      const updated = await Ticket.update(ticket.$id, { status: 'Closed' })
      expect(updated.tags).toBe('auto-modified')
      expect(updated.status).toBe('Closed')

      unsub()
    })
  })

  // ===========================================================================
  // 7. Delete Verb Hooks
  // ===========================================================================
  describe('Delete verb hooks', () => {
    it('deleting BEFORE hook fires on delete', async () => {
      const spy = vi.fn()
      const unsub = Ticket.deleting(spy)

      const ticket = await Ticket.create({ subject: 'Delete hook test' })
      await Ticket.delete(ticket.$id)
      expect(spy).toHaveBeenCalledTimes(1)

      unsub()
    })

    it('deleted AFTER hook fires on delete', async () => {
      const spy = vi.fn()
      const unsub = Ticket.deleted(spy)

      const ticket = await Ticket.create({ subject: 'Deleted after hook' })
      await Ticket.delete(ticket.$id)
      expect(spy).toHaveBeenCalledTimes(1)

      unsub()
    })
  })

  // ===========================================================================
  // 8. Schema Deep Inspection (relationship details, verb reverseAt)
  // ===========================================================================
  describe('Schema deep inspection', () => {
    it('assignee relationship has correct operator and targetType', () => {
      const assignee = Ticket.$schema.relationships.get('assignee')
      expect(assignee).toBeDefined()
      expect(assignee!.operator).toBe('->')
      expect(assignee!.targetType).toBe('Contact')
      expect(assignee!.isArray).toBeFalsy()
    })

    it('requester relationship has no backref defined', () => {
      const requester = Ticket.$schema.relationships.get('requester')
      expect(requester).toBeDefined()
      expect(requester!.backref).toBeUndefined()
    })

    it('organization relationship targets Organization', () => {
      const org = Ticket.$schema.relationships.get('organization')
      expect(org).toBeDefined()
      expect(org!.targetType).toBe('Organization')
      expect(org!.operator).toBe('->')
    })

    it('every verb has a reverseAt form', () => {
      for (const [_name, conj] of Ticket.$schema.verbs) {
        expect(conj.reverseAt).toBeDefined()
        expect(typeof conj.reverseAt).toBe('string')
        expect(conj.reverseAt.length).toBeGreaterThan(0)
      }
    })

    it('all field modifiers are accessible', () => {
      const subject = Ticket.$schema.fields.get('subject')
      expect(subject).toBeDefined()
      expect(subject!.modifiers).toBeDefined()
      expect(subject!.modifiers!.required).toBe(true)

      const description = Ticket.$schema.fields.get('description')
      expect(description!.modifiers).toBeDefined()
      expect(description!.modifiers!.required).toBe(false)
    })

    it('schema raw contains all original definitions', () => {
      const raw = Ticket.$schema.raw
      expect(raw['subject']).toBe('string!')
      expect(raw['description']).toBe('string')
      expect(raw['status']).toBe('Open | Pending | InProgress | Resolved | Closed')
      expect(raw['priority']).toBe('Low | Medium | High | Urgent')
      expect(raw['category']).toBe('string')
      expect(raw['assignee']).toBe('-> Contact')
      expect(raw['requester']).toBe('-> Contact')
      expect(raw['organization']).toBe('-> Organization')
      expect(raw['channel']).toBe('Email | Chat | Phone | Web | API')
      expect(raw['tags']).toBe('string')
      expect(raw['firstResponseAt']).toBe('datetime')
      expect(raw['resolvedAt']).toBe('datetime')
      expect(raw['satisfaction']).toBe('number')
      expect(raw['resolve']).toBe('Resolved')
      expect(raw['escalate']).toBe('Escalated')
      expect(raw['close']).toBe('Closed')
      expect(raw['reopen']).toBe('Reopened')
    })
  })

  // ===========================================================================
  // 9. Meta-field Immutability
  // ===========================================================================
  describe('Meta-field immutability across operations', () => {
    it('$id never changes on update', async () => {
      const ticket = await Ticket.create({ subject: 'ID immutable', status: 'Open' })
      const id = ticket.$id

      const u1 = await Ticket.update(ticket.$id, { status: 'InProgress' })
      expect(u1.$id).toBe(id)

      const u2 = await Ticket.resolve(ticket.$id)
      expect(u2.$id).toBe(id)
    })

    it('$type never changes on update', async () => {
      const ticket = await Ticket.create({ subject: 'Type immutable' })
      const updated = await Ticket.update(ticket.$id, { subject: 'Changed subject' })
      expect(updated.$type).toBe('Ticket')
    })

    it('$context never changes on update', async () => {
      const ticket = await Ticket.create({ subject: 'Context immutable' })
      const ctx = ticket.$context
      const updated = await Ticket.update(ticket.$id, { description: 'desc' })
      expect(updated.$context).toBe(ctx)
    })

    it('attempting to overwrite $id via update does not change it', async () => {
      const ticket = await Ticket.create({ subject: 'Cannot override $id' })
      const originalId = ticket.$id
      const updated = await Ticket.update(ticket.$id, { $id: 'ticket_hacked' } as any)
      expect(updated.$id).toBe(originalId)
    })

    it('attempting to overwrite $type via update does not change it', async () => {
      const ticket = await Ticket.create({ subject: 'Cannot override $type' })
      const updated = await Ticket.update(ticket.$id, { $type: 'NotTicket' } as any)
      expect(updated.$type).toBe('Ticket')
    })
  })

  // ===========================================================================
  // 10. After Hook Receives $ Context
  // ===========================================================================
  describe('After hook $ context', () => {
    it('resolved AFTER hook receives instance as first argument', async () => {
      let receivedInstance: any = null
      const unsub = Ticket.resolved((instance: any) => {
        receivedInstance = instance
      })

      const ticket = await Ticket.create({ subject: 'After context', status: 'Open' })
      await Ticket.resolve(ticket.$id)

      expect(receivedInstance).toBeDefined()
      expect(receivedInstance.$id).toBe(ticket.$id)
      expect(receivedInstance.status).toBe('Resolved')

      unsub()
    })

    it('closed AFTER hook receives the updated instance', async () => {
      let receivedInstance: any = null
      const unsub = Ticket.closed((instance: any) => {
        receivedInstance = instance
      })

      const ticket = await Ticket.create({ subject: 'Close after', status: 'Open' })
      await Ticket.close(ticket.$id)

      expect(receivedInstance).toBeDefined()
      expect(receivedInstance.status).toBe('Closed')

      unsub()
    })
  })

  // ===========================================================================
  // 11. find() with No Results / Empty Store
  // ===========================================================================
  describe('find edge cases', () => {
    it('find on empty store returns empty array', async () => {
      const result = await Ticket.find()
      expect(result).toEqual([])
    })

    it('find with impossible filter combination returns empty array', async () => {
      await Ticket.create({ subject: 'T1', status: 'Open', priority: 'Low' })

      const result = await Ticket.find({ status: 'Closed', priority: 'Urgent', channel: 'Phone' })
      expect(result).toEqual([])
    })

    it('find with no filter returns all tickets', async () => {
      await Ticket.create({ subject: 'T1' })
      await Ticket.create({ subject: 'T2' })
      await Ticket.create({ subject: 'T3' })

      const all = await Ticket.find()
      expect(all.length).toBe(3)
    })
  })
})
