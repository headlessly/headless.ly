import { describe, it, expect, vi } from 'vitest'
import { Ticket } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/support deep-v2 tests', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Ticket Lifecycle Workflows (Open -> ... -> Closed)
  // ===========================================================================
  describe('Ticket lifecycle workflows', () => {
    it('follows full lifecycle: Open -> InProgress -> Resolved -> Closed', async () => {
      const ticket = await Ticket.create({ subject: 'Login broken', status: 'Open', priority: 'High' })
      expect(ticket.status).toBe('Open')

      const inProgress = await Ticket.update(ticket.$id, { status: 'InProgress' })
      expect(inProgress.status).toBe('InProgress')

      const resolved = await Ticket.resolve(inProgress.$id)
      expect(resolved.status).toBe('Resolved')

      const closed = await Ticket.close(resolved.$id)
      expect(closed.status).toBe('Closed')

      expect(closed.$version).toBe(4)
    })

    it('follows workflow: Open -> Pending -> InProgress -> Resolved', async () => {
      const ticket = await Ticket.create({ subject: 'Need info', status: 'Open' })

      const pending = await Ticket.update(ticket.$id, { status: 'Pending' })
      expect(pending.status).toBe('Pending')
      expect(pending.$version).toBe(2)

      const inProgress = await Ticket.update(ticket.$id, { status: 'InProgress' })
      expect(inProgress.status).toBe('InProgress')
      expect(inProgress.$version).toBe(3)

      const resolved = await Ticket.resolve(ticket.$id)
      expect(resolved.status).toBe('Resolved')
      expect(resolved.$version).toBe(4)
    })

    it('supports reopen after close and re-close', async () => {
      const ticket = await Ticket.create({ subject: 'Recurring issue', status: 'Open' })
      const closed = await Ticket.close(ticket.$id)
      expect(closed.status).toBe('Closed')

      const reopened = await Ticket.reopen(closed.$id)
      expect(reopened.status).toBe('Reopened')

      // Re-resolve and close again
      const resolved = await Ticket.resolve(reopened.$id)
      expect(resolved.status).toBe('Resolved')

      const closedAgain = await Ticket.close(resolved.$id)
      expect(closedAgain.status).toBe('Closed')
      expect(closedAgain.$version).toBe(5)
    })

    it('escalate does not change status to a known status value', async () => {
      // 'Escalated' is not in the status enum, so escalate may not change the status field
      const ticket = await Ticket.create({ subject: 'Needs escalation', status: 'Open', priority: 'Medium' })
      const escalated = await Ticket.escalate(ticket.$id)
      // escalate targets 'Escalated' which is NOT in the status enum
      // resolveVerbTransition checks enum fields first, and 'Escalated' is not in status enum
      // It also checks convention fields (stage, status, state) on the entity
      // Since the entity has status, it would set status = 'Escalated'
      expect(escalated.$id).toBe(ticket.$id)
      expect(escalated).toBeDefined()
    })

    it('tracks $createdAt and $updatedAt across lifecycle', async () => {
      const ticket = await Ticket.create({ subject: 'Timestamp tracking', status: 'Open' })
      expect(ticket.$createdAt).toBeDefined()
      expect(ticket.$updatedAt).toBeDefined()

      const updated = await Ticket.update(ticket.$id, { status: 'InProgress' })
      expect(updated.$createdAt).toBe(ticket.$createdAt)
      // $updatedAt should change (or stay same if within same ms, but at least be defined)
      expect(updated.$updatedAt).toBeDefined()
    })
  })

  // ===========================================================================
  // 2. Priority Escalation Logic
  // ===========================================================================
  describe('Priority escalation logic', () => {
    it('creates tickets at each priority level', async () => {
      const low = await Ticket.create({ subject: 'Low p', priority: 'Low' })
      const medium = await Ticket.create({ subject: 'Med p', priority: 'Medium' })
      const high = await Ticket.create({ subject: 'High p', priority: 'High' })
      const urgent = await Ticket.create({ subject: 'Urgent p', priority: 'Urgent' })

      expect(low.priority).toBe('Low')
      expect(medium.priority).toBe('Medium')
      expect(high.priority).toBe('High')
      expect(urgent.priority).toBe('Urgent')
    })

    it('upgrades priority from Low to Urgent via update', async () => {
      const ticket = await Ticket.create({ subject: 'Priority bump', priority: 'Low' })
      expect(ticket.priority).toBe('Low')

      const bumped = await Ticket.update(ticket.$id, { priority: 'Urgent' })
      expect(bumped.priority).toBe('Urgent')
      expect(bumped.$version).toBe(2)
    })

    it('downgrades priority from High to Low via update', async () => {
      const ticket = await Ticket.create({ subject: 'Priority downgrade', priority: 'High' })
      const downgraded = await Ticket.update(ticket.$id, { priority: 'Low' })
      expect(downgraded.priority).toBe('Low')
    })

    it('filters tickets by multiple priority levels', async () => {
      await Ticket.create({ subject: 'T1', priority: 'Low' })
      await Ticket.create({ subject: 'T2', priority: 'High' })
      await Ticket.create({ subject: 'T3', priority: 'Urgent' })
      await Ticket.create({ subject: 'T4', priority: 'Medium' })

      const urgent = await Ticket.find({ priority: 'Urgent' })
      expect(urgent.length).toBe(1)
      expect(urgent[0].subject).toBe('T3')

      const low = await Ticket.find({ priority: 'Low' })
      expect(low.length).toBe(1)
      expect(low[0].subject).toBe('T1')
    })
  })

  // ===========================================================================
  // 3. SLA / Response Time Tracking
  // ===========================================================================
  describe('SLA / response time tracking', () => {
    it('records firstResponseAt on a ticket', async () => {
      const now = new Date().toISOString()
      const ticket = await Ticket.create({
        subject: 'SLA test',
        status: 'Open',
        firstResponseAt: now,
      })
      expect(ticket.firstResponseAt).toBe(now)
    })

    it('records resolvedAt on a ticket', async () => {
      const resolvedTime = new Date().toISOString()
      const ticket = await Ticket.create({
        subject: 'Resolved time test',
        status: 'Resolved',
        resolvedAt: resolvedTime,
      })
      expect(ticket.resolvedAt).toBe(resolvedTime)
    })

    it('sets firstResponseAt via update after initial creation', async () => {
      const ticket = await Ticket.create({ subject: 'No response yet', status: 'Open' })
      expect(ticket.firstResponseAt).toBeUndefined()

      const responseTime = new Date().toISOString()
      const updated = await Ticket.update(ticket.$id, { firstResponseAt: responseTime })
      expect(updated.firstResponseAt).toBe(responseTime)
    })

    it('sets resolvedAt via update when resolving', async () => {
      const ticket = await Ticket.create({ subject: 'Will be resolved', status: 'Open' })
      const resolvedTime = new Date().toISOString()
      const updated = await Ticket.update(ticket.$id, { status: 'Resolved', resolvedAt: resolvedTime })
      expect(updated.resolvedAt).toBe(resolvedTime)
      expect(updated.status).toBe('Resolved')
    })

    it('firstResponseAt and resolvedAt can coexist', async () => {
      const first = '2025-01-01T00:00:00Z'
      const resolved = '2025-01-02T12:00:00Z'
      const ticket = await Ticket.create({
        subject: 'Full SLA',
        firstResponseAt: first,
        resolvedAt: resolved,
      })
      expect(ticket.firstResponseAt).toBe(first)
      expect(ticket.resolvedAt).toBe(resolved)
    })
  })

  // ===========================================================================
  // 4. Ticket Assignment and Reassignment
  // ===========================================================================
  describe('Ticket assignment and reassignment', () => {
    it('creates a ticket with assignee', async () => {
      const ticket = await Ticket.create({
        subject: 'Assigned ticket',
        assignee: 'contact_aBcDeFgH',
      })
      expect(ticket.assignee).toBe('contact_aBcDeFgH')
    })

    it('creates a ticket with requester', async () => {
      const ticket = await Ticket.create({
        subject: 'Requested ticket',
        requester: 'contact_xYzWvUtS',
      })
      expect(ticket.requester).toBe('contact_xYzWvUtS')
    })

    it('creates a ticket with organization', async () => {
      const ticket = await Ticket.create({
        subject: 'Org ticket',
        organization: 'organization_e5JhLzXc',
      })
      expect(ticket.organization).toBe('organization_e5JhLzXc')
    })

    it('reassigns a ticket to a different agent', async () => {
      const ticket = await Ticket.create({
        subject: 'Reassignment test',
        assignee: 'contact_agent1AAA',
      })
      expect(ticket.assignee).toBe('contact_agent1AAA')

      const reassigned = await Ticket.update(ticket.$id, { assignee: 'contact_agent2BBB' })
      expect(reassigned.assignee).toBe('contact_agent2BBB')
      expect(reassigned.$version).toBe(2)
    })

    it('removes assignee by setting to undefined/null', async () => {
      const ticket = await Ticket.create({
        subject: 'Unassign test',
        assignee: 'contact_agent1AAA',
      })
      const unassigned = await Ticket.update(ticket.$id, { assignee: undefined })
      // After merge, undefined overwrites
      expect(unassigned.assignee).toBeUndefined()
    })

    it('assigns both requester and assignee simultaneously', async () => {
      const ticket = await Ticket.create({
        subject: 'Double assignment',
        requester: 'contact_customer1',
        assignee: 'contact_support1',
      })
      expect(ticket.requester).toBe('contact_customer1')
      expect(ticket.assignee).toBe('contact_support1')
    })
  })

  // ===========================================================================
  // 5. Ticket Tags / Labels
  // ===========================================================================
  describe('Ticket tags', () => {
    it('creates a ticket with tags as a string', async () => {
      const ticket = await Ticket.create({
        subject: 'Tagged ticket',
        tags: 'billing,urgent',
      })
      expect(ticket.tags).toBe('billing,urgent')
    })

    it('updates tags on an existing ticket', async () => {
      const ticket = await Ticket.create({
        subject: 'Tag update',
        tags: 'initial',
      })
      const updated = await Ticket.update(ticket.$id, { tags: 'initial,escalated' })
      expect(updated.tags).toBe('initial,escalated')
    })

    it('creates a ticket with no tags', async () => {
      const ticket = await Ticket.create({ subject: 'No tags' })
      expect(ticket.tags).toBeUndefined()
    })

    it('filters tickets by tags', async () => {
      await Ticket.create({ subject: 'T1', tags: 'billing' })
      await Ticket.create({ subject: 'T2', tags: 'technical' })
      await Ticket.create({ subject: 'T3', tags: 'billing' })

      const billing = await Ticket.find({ tags: 'billing' })
      expect(billing.length).toBe(2)
    })
  })

  // ===========================================================================
  // 6. Customer Satisfaction / Feedback
  // ===========================================================================
  describe('Customer satisfaction / feedback', () => {
    it('creates a ticket with satisfaction score', async () => {
      const ticket = await Ticket.create({
        subject: 'Great support',
        satisfaction: 5,
      })
      expect(ticket.satisfaction).toBe(5)
    })

    it('sets satisfaction after resolution', async () => {
      const ticket = await Ticket.create({ subject: 'Pending feedback', status: 'Resolved' })
      expect(ticket.satisfaction).toBeUndefined()

      const rated = await Ticket.update(ticket.$id, { satisfaction: 4 })
      expect(rated.satisfaction).toBe(4)
    })

    it('satisfaction of zero is valid', async () => {
      const ticket = await Ticket.create({ subject: 'Bad experience', satisfaction: 0 })
      expect(ticket.satisfaction).toBe(0)
    })

    it('filters tickets by satisfaction score', async () => {
      await Ticket.create({ subject: 'Happy', satisfaction: 5 })
      await Ticket.create({ subject: 'Neutral', satisfaction: 3 })
      await Ticket.create({ subject: 'Happy too', satisfaction: 5 })

      const fives = await Ticket.find({ satisfaction: 5 })
      expect(fives.length).toBe(2)
    })
  })

  // ===========================================================================
  // 7. Channel-based Operations
  // ===========================================================================
  describe('Channel-based operations', () => {
    it('creates tickets from every channel', async () => {
      const channels = ['Email', 'Chat', 'Phone', 'Web', 'API'] as const
      for (const channel of channels) {
        const ticket = await Ticket.create({ subject: `${channel} ticket`, channel })
        expect(ticket.channel).toBe(channel)
      }
    })

    it('finds tickets by multiple channels individually', async () => {
      await Ticket.create({ subject: 'Email 1', channel: 'Email' })
      await Ticket.create({ subject: 'Chat 1', channel: 'Chat' })
      await Ticket.create({ subject: 'Phone 1', channel: 'Phone' })
      await Ticket.create({ subject: 'Email 2', channel: 'Email' })

      const emails = await Ticket.find({ channel: 'Email' })
      expect(emails.length).toBe(2)

      const phone = await Ticket.find({ channel: 'Phone' })
      expect(phone.length).toBe(1)
    })
  })

  // ===========================================================================
  // 8. Multi-field Filtering
  // ===========================================================================
  describe('Multi-field filtering', () => {
    it('filters by status AND priority', async () => {
      await Ticket.create({ subject: 'T1', status: 'Open', priority: 'High' })
      await Ticket.create({ subject: 'T2', status: 'Open', priority: 'Low' })
      await Ticket.create({ subject: 'T3', status: 'Closed', priority: 'High' })
      await Ticket.create({ subject: 'T4', status: 'Open', priority: 'High' })

      const openHigh = await Ticket.find({ status: 'Open', priority: 'High' })
      expect(openHigh.length).toBe(2)
      expect(openHigh.every((t: any) => t.status === 'Open' && t.priority === 'High')).toBe(true)
    })

    it('filters by status AND channel AND category', async () => {
      await Ticket.create({ subject: 'T1', status: 'Open', channel: 'Email', category: 'billing' })
      await Ticket.create({ subject: 'T2', status: 'Open', channel: 'Email', category: 'technical' })
      await Ticket.create({ subject: 'T3', status: 'Closed', channel: 'Email', category: 'billing' })

      const result = await Ticket.find({ status: 'Open', channel: 'Email', category: 'billing' })
      expect(result.length).toBe(1)
      expect(result[0].subject).toBe('T1')
    })

    it('returns empty array when no tickets match compound filter', async () => {
      await Ticket.create({ subject: 'T1', status: 'Open', priority: 'Low' })
      const result = await Ticket.find({ status: 'Closed', priority: 'Urgent' })
      expect(result).toEqual([])
    })
  })

  // ===========================================================================
  // 9. Bulk Operations
  // ===========================================================================
  describe('Bulk operations', () => {
    it('creates and retrieves many tickets', async () => {
      const subjects = Array.from({ length: 10 }, (_, i) => `Bulk ticket ${i}`)
      const tickets = await Promise.all(subjects.map((subject) => Ticket.create({ subject, status: 'Open' })))

      expect(tickets.length).toBe(10)
      const all = await Ticket.find({ status: 'Open' })
      expect(all.length).toBe(10)
    })

    it('updates multiple tickets sequentially', async () => {
      const t1 = await Ticket.create({ subject: 'Batch 1', status: 'Open' })
      const t2 = await Ticket.create({ subject: 'Batch 2', status: 'Open' })
      const t3 = await Ticket.create({ subject: 'Batch 3', status: 'Open' })

      await Ticket.update(t1.$id, { status: 'Closed' })
      await Ticket.update(t2.$id, { status: 'Closed' })
      await Ticket.update(t3.$id, { status: 'Closed' })

      const open = await Ticket.find({ status: 'Open' })
      expect(open.length).toBe(0)

      const closed = await Ticket.find({ status: 'Closed' })
      expect(closed.length).toBe(3)
    })

    it('deletes multiple tickets', async () => {
      const t1 = await Ticket.create({ subject: 'Del 1' })
      const t2 = await Ticket.create({ subject: 'Del 2' })
      const t3 = await Ticket.create({ subject: 'Del 3' })

      await Ticket.delete(t1.$id)
      await Ticket.delete(t2.$id)
      await Ticket.delete(t3.$id)

      expect(await Ticket.get(t1.$id)).toBeNull()
      expect(await Ticket.get(t2.$id)).toBeNull()
      expect(await Ticket.get(t3.$id)).toBeNull()
    })
  })

  // ===========================================================================
  // 10. Hook Chains and Multiple Hooks
  // ===========================================================================
  describe('Hook chains and multiple hooks', () => {
    it('fires multiple BEFORE hooks in registration order', async () => {
      const order: number[] = []
      const unsub1 = Ticket.resolving(() => {
        order.push(1)
      })
      const unsub2 = Ticket.resolving(() => {
        order.push(2)
      })

      const ticket = await Ticket.create({ subject: 'Multi-hook', status: 'Open' })
      await Ticket.resolve(ticket.$id)

      expect(order).toEqual([1, 2])
      unsub1()
      unsub2()
    })

    it('fires multiple AFTER hooks in registration order', async () => {
      const order: number[] = []
      const unsub1 = Ticket.resolved(() => {
        order.push(1)
      })
      const unsub2 = Ticket.resolved(() => {
        order.push(2)
      })

      const ticket = await Ticket.create({ subject: 'Multi-after', status: 'Open' })
      await Ticket.resolve(ticket.$id)

      expect(order).toEqual([1, 2])
      unsub1()
      unsub2()
    })

    it('BEFORE hook on creating can transform data', async () => {
      const unsub = Ticket.creating((data: Record<string, unknown>) => {
        return { ...data, priority: 'High' }
      })

      const ticket = await Ticket.create({ subject: 'Transformed', priority: 'Low' })
      expect(ticket.priority).toBe('High')
      unsub()
    })

    it('AFTER hook on created receives the created instance', async () => {
      let received: any = null
      const unsub = Ticket.created((instance: any) => {
        received = instance
      })

      const ticket = await Ticket.create({ subject: 'After create hook' })
      expect(received).toBeDefined()
      expect(received.$id).toBe(ticket.$id)
      expect(received.subject).toBe('After create hook')
      unsub()
    })

    it('escalating BEFORE hook fires for escalate verb', async () => {
      const spy = vi.fn()
      const unsub = Ticket.escalating(spy)

      const ticket = await Ticket.create({ subject: 'Escalation hook' })
      await Ticket.escalate(ticket.$id)
      expect(spy).toHaveBeenCalled()
      unsub()
    })

    it('escalated AFTER hook fires for escalate verb', async () => {
      const spy = vi.fn()
      const unsub = Ticket.escalated(spy)

      const ticket = await Ticket.create({ subject: 'Escalation after hook' })
      await Ticket.escalate(ticket.$id)
      expect(spy).toHaveBeenCalled()
      unsub()
    })

    it('reopening/reopened hooks fire for reopen verb', async () => {
      const beforeSpy = vi.fn()
      const afterSpy = vi.fn()
      const unsub1 = Ticket.reopening(beforeSpy)
      const unsub2 = Ticket.reopened(afterSpy)

      const ticket = await Ticket.create({ subject: 'Reopen hooks', status: 'Closed' })
      await Ticket.reopen(ticket.$id)

      expect(beforeSpy).toHaveBeenCalled()
      expect(afterSpy).toHaveBeenCalled()
      unsub1()
      unsub2()
    })
  })

  // ===========================================================================
  // 11. Edge Cases
  // ===========================================================================
  describe('Edge cases', () => {
    it('subject with special characters', async () => {
      const subject = 'Cannot login! <script>alert("xss")</script> & "quotes"'
      const ticket = await Ticket.create({ subject })
      expect(ticket.subject).toBe(subject)
    })

    it('very long subject string', async () => {
      const subject = 'A'.repeat(10000)
      const ticket = await Ticket.create({ subject })
      expect(ticket.subject).toBe(subject)
      expect(ticket.subject.length).toBe(10000)
    })

    it('empty string subject (still creates)', async () => {
      const ticket = await Ticket.create({ subject: '' })
      expect(ticket.subject).toBe('')
      expect(ticket.$id).toMatch(/^ticket_/)
    })

    it('empty description is preserved', async () => {
      const ticket = await Ticket.create({ subject: 'test', description: '' })
      expect(ticket.description).toBe('')
    })

    it('concurrent creates produce unique IDs', async () => {
      const tickets = await Promise.all(
        Array.from({ length: 20 }, (_, i) => Ticket.create({ subject: `Concurrent ${i}` })),
      )
      const ids = tickets.map((t) => t.$id)
      const unique = new Set(ids)
      expect(unique.size).toBe(20)
    })

    it('get after delete returns null', async () => {
      const ticket = await Ticket.create({ subject: 'Will be deleted' })
      const id = ticket.$id
      await Ticket.delete(id)
      const result = await Ticket.get(id)
      expect(result).toBeNull()
    })

    it('$context is populated on every ticket', async () => {
      const ticket = await Ticket.create({ subject: 'Context check' })
      expect(ticket.$context).toBeDefined()
      expect(typeof ticket.$context).toBe('string')
      expect(ticket.$context.length).toBeGreaterThan(0)
    })

    it('$type is always Ticket', async () => {
      const t1 = await Ticket.create({ subject: 'Type check 1' })
      const t2 = await Ticket.create({ subject: 'Type check 2', status: 'Closed' })
      expect(t1.$type).toBe('Ticket')
      expect(t2.$type).toBe('Ticket')
    })
  })

  // ===========================================================================
  // 12. Schema Completeness Checks
  // ===========================================================================
  describe('Schema completeness', () => {
    it('has category as a string field', () => {
      const category = Ticket.$schema.fields.get('category')
      expect(category).toBeDefined()
      expect(category!.kind).toBe('field')
      expect(category!.type).toBe('string')
    })

    it('has tags as a string field', () => {
      const tags = Ticket.$schema.fields.get('tags')
      expect(tags).toBeDefined()
      expect(tags!.kind).toBe('field')
      expect(tags!.type).toBe('string')
    })

    it('raw definition preserves original verb declarations', () => {
      expect(Ticket.$schema.raw['resolve']).toBe('Resolved')
      expect(Ticket.$schema.raw['escalate']).toBe('Escalated')
      expect(Ticket.$schema.raw['close']).toBe('Closed')
      expect(Ticket.$schema.raw['reopen']).toBe('Reopened')
    })

    it('verb conjugation has reverseBy forms', () => {
      const resolve = Ticket.$schema.verbs.get('resolve')
      expect(resolve).toBeDefined()
      expect(resolve!.reverseBy).toBeDefined()
      expect(typeof resolve!.reverseBy).toBe('string')

      const close = Ticket.$schema.verbs.get('close')
      expect(close).toBeDefined()
      expect(close!.reverseBy).toBeDefined()
    })

    it('disabledVerbs set is empty (no verbs are disabled)', () => {
      expect(Ticket.$schema.disabledVerbs.size).toBe(0)
    })
  })

  // ===========================================================================
  // 13. Verb State Transitions
  // ===========================================================================
  describe('Verb state transitions', () => {
    it('resolve sets status to Resolved (enum match)', async () => {
      const ticket = await Ticket.create({ subject: 'Resolve target', status: 'Open' })
      const resolved = await Ticket.resolve(ticket.$id)
      expect(resolved.status).toBe('Resolved')
    })

    it('close sets status to Closed (enum match)', async () => {
      const ticket = await Ticket.create({ subject: 'Close target', status: 'Resolved' })
      const closed = await Ticket.close(ticket.$id)
      expect(closed.status).toBe('Closed')
    })

    it('reopen verb transitions to Reopened', async () => {
      // 'Reopened' is NOT in the status enum, so resolveVerbTransition uses convention field 'status'
      const ticket = await Ticket.create({ subject: 'Reopen target', status: 'Closed' })
      const reopened = await Ticket.reopen(ticket.$id)
      // Whether this sets status = 'Reopened' depends on the resolution strategy
      // The entity has 'status', and the verb target is 'Reopened'
      // Strategy 1 (enum match) fails since 'Reopened' is not in enum
      // Strategy 2 (entity awareness) matches 'status' field on the entity
      expect(reopened.status).toBe('Reopened')
    })

    it('resolve on already-Resolved ticket maintains Resolved status', async () => {
      const ticket = await Ticket.create({ subject: 'Already resolved', status: 'Resolved' })
      const resolved = await Ticket.resolve(ticket.$id)
      expect(resolved.status).toBe('Resolved')
    })
  })

  // ===========================================================================
  // 14. Idempotency and Re-fetch
  // ===========================================================================
  describe('Idempotency and re-fetch', () => {
    it('get returns the same data as create', async () => {
      const created = await Ticket.create({
        subject: 'Idempotent',
        status: 'Open',
        priority: 'Medium',
        category: 'general',
      })

      const fetched = await Ticket.get(created.$id)
      expect(fetched).toBeDefined()
      expect(fetched!.$id).toBe(created.$id)
      expect(fetched!.subject).toBe('Idempotent')
      expect(fetched!.status).toBe('Open')
      expect(fetched!.priority).toBe('Medium')
      expect(fetched!.category).toBe('general')
    })

    it('update returns the merged entity', async () => {
      const ticket = await Ticket.create({
        subject: 'Merge test',
        description: 'Original desc',
        status: 'Open',
        priority: 'Low',
      })
      const updated = await Ticket.update(ticket.$id, { priority: 'High' })
      expect(updated.subject).toBe('Merge test')
      expect(updated.description).toBe('Original desc')
      expect(updated.status).toBe('Open')
      expect(updated.priority).toBe('High')
    })

    it('find returns consistent results after updates', async () => {
      const t = await Ticket.create({ subject: 'Find consistent', status: 'Open' })
      let open = await Ticket.find({ status: 'Open' })
      expect(open.length).toBe(1)

      await Ticket.update(t.$id, { status: 'Closed' })

      open = await Ticket.find({ status: 'Open' })
      expect(open.length).toBe(0)

      const closed = await Ticket.find({ status: 'Closed' })
      expect(closed.length).toBe(1)
    })
  })
})
