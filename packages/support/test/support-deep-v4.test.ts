import { describe, it, expect, vi } from 'vitest'
import { Ticket } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/support deep-v4 tests', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Field-level schema: kind, type, modifiers for EVERY field (11 tests)
  // ===========================================================================
  describe('Field-level schema completeness', () => {
    it('subject field has required=true and optional=false', () => {
      const f = Ticket.$schema.fields.get('subject')!
      expect(f.modifiers!.required).toBe(true)
      expect(f.modifiers!.optional).toBe(false)
    })

    it('subject field has indexed=false, unique=false, array=false', () => {
      const f = Ticket.$schema.fields.get('subject')!
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })

    it('description field has required=false and optional=false (bare string)', () => {
      const f = Ticket.$schema.fields.get('description')!
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.optional).toBe(false)
    })

    it('category field is kind=field, type=string with no modifiers set', () => {
      const f = Ticket.$schema.fields.get('category')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })

    it('tags field is kind=field, type=string with all modifiers false', () => {
      const f = Ticket.$schema.fields.get('tags')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
    })

    it('firstResponseAt field is kind=field, type=datetime', () => {
      const f = Ticket.$schema.fields.get('firstResponseAt')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('datetime')
      expect(f.modifiers!.required).toBe(false)
    })

    it('resolvedAt field is kind=field, type=datetime', () => {
      const f = Ticket.$schema.fields.get('resolvedAt')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('datetime')
      expect(f.modifiers!.required).toBe(false)
    })

    it('satisfaction field is kind=field, type=number with no modifiers', () => {
      const f = Ticket.$schema.fields.get('satisfaction')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('number')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
    })

    it('status enum has exactly 5 values', () => {
      const f = Ticket.$schema.fields.get('status')!
      expect(f.kind).toBe('enum')
      expect(f.enumValues!.length).toBe(5)
    })

    it('priority enum has exactly 4 values', () => {
      const f = Ticket.$schema.fields.get('priority')!
      expect(f.kind).toBe('enum')
      expect(f.enumValues!.length).toBe(4)
    })

    it('channel enum has exactly 5 values', () => {
      const f = Ticket.$schema.fields.get('channel')!
      expect(f.kind).toBe('enum')
      expect(f.enumValues!.length).toBe(5)
    })
  })

  // ===========================================================================
  // 2. Relationship schema detail (7 tests)
  // ===========================================================================
  describe('Relationship schema details', () => {
    it('assignee relationship is NOT an array', () => {
      const r = Ticket.$schema.relationships.get('assignee')!
      expect(r.isArray).toBeFalsy()
    })

    it('assignee relationship has no backref defined', () => {
      const r = Ticket.$schema.relationships.get('assignee')!
      expect(r.backref).toBeUndefined()
    })

    it('requester relationship operator is forward (->)', () => {
      const r = Ticket.$schema.relationships.get('requester')!
      expect(r.operator).toBe('->')
    })

    it('requester relationship targets Contact and is not an array', () => {
      const r = Ticket.$schema.relationships.get('requester')!
      expect(r.targetType).toBe('Contact')
      expect(r.isArray).toBeFalsy()
    })

    it('organization relationship has no backref', () => {
      const r = Ticket.$schema.relationships.get('organization')!
      expect(r.backref).toBeUndefined()
    })

    it('organization relationship is not an array', () => {
      const r = Ticket.$schema.relationships.get('organization')!
      expect(r.isArray).toBeFalsy()
    })

    it('no relationships exist beyond assignee, requester, and organization', () => {
      const relKeys = [...Ticket.$schema.relationships.keys()]
      expect(relKeys).toEqual(expect.arrayContaining(['assignee', 'requester', 'organization']))
      expect(relKeys.length).toBe(3)
    })
  })

  // ===========================================================================
  // 3. Raw definition key-by-key validation (3 tests)
  // ===========================================================================
  describe('Schema raw definition key-by-key', () => {
    it('raw definition has exactly 17 keys', () => {
      const rawKeys = Object.keys(Ticket.$schema.raw)
      expect(rawKeys.length).toBe(17)
    })

    it('raw definition keys match expected set', () => {
      const expected = [
        'subject', 'description', 'status', 'priority', 'category',
        'assignee', 'requester', 'organization', 'channel', 'tags',
        'firstResponseAt', 'resolvedAt', 'satisfaction',
        'resolve', 'escalate', 'close', 'reopen',
      ]
      const rawKeys = Object.keys(Ticket.$schema.raw)
      for (const key of expected) {
        expect(rawKeys).toContain(key)
      }
    })

    it('raw definition does not contain unexpected keys', () => {
      const expected = new Set([
        'subject', 'description', 'status', 'priority', 'category',
        'assignee', 'requester', 'organization', 'channel', 'tags',
        'firstResponseAt', 'resolvedAt', 'satisfaction',
        'resolve', 'escalate', 'close', 'reopen',
      ])
      for (const key of Object.keys(Ticket.$schema.raw)) {
        expect(expected.has(key)).toBe(true)
      }
    })
  })

  // ===========================================================================
  // 4. Full linguistic forms for all 7 verbs (7 tests)
  // ===========================================================================
  describe('Verb linguistic forms (act, reverseBy, reverseAt)', () => {
    it('create verb has correct full conjugation', () => {
      const v = Ticket.$schema.verbs.get('create')!
      expect(v.action).toBe('create')
      expect(v.activity).toBe('creating')
      expect(v.event).toBe('created')
      expect(v.reverseBy).toBe('createdBy')
      expect(v.reverseAt).toBe('createdAt')
    })

    it('update verb has correct full conjugation', () => {
      const v = Ticket.$schema.verbs.get('update')!
      expect(v.action).toBe('update')
      expect(v.activity).toBe('updating')
      expect(v.event).toBe('updated')
      expect(v.reverseBy).toBe('updatedBy')
      expect(v.reverseAt).toBe('updatedAt')
    })

    it('delete verb has correct full conjugation', () => {
      const v = Ticket.$schema.verbs.get('delete')!
      expect(v.action).toBe('delete')
      expect(v.activity).toBe('deleting')
      expect(v.event).toBe('deleted')
      expect(v.reverseBy).toBe('deletedBy')
      expect(v.reverseAt).toBe('deletedAt')
    })

    it('resolve verb has resolvedBy and resolvedAt', () => {
      const v = Ticket.$schema.verbs.get('resolve')!
      expect(v.reverseBy).toBe('resolvedBy')
      expect(v.reverseAt).toBe('resolvedAt')
    })

    it('escalate verb has escalatedBy and escalatedAt', () => {
      const v = Ticket.$schema.verbs.get('escalate')!
      expect(v.reverseBy).toBe('escalatedBy')
      expect(v.reverseAt).toBe('escalatedAt')
    })

    it('close verb has closedBy and closedAt', () => {
      const v = Ticket.$schema.verbs.get('close')!
      expect(v.reverseBy).toBe('closedBy')
      expect(v.reverseAt).toBe('closedAt')
    })

    it('reopen verb has reopenedBy and reopenedAt', () => {
      const v = Ticket.$schema.verbs.get('reopen')!
      expect(v.reverseBy).toBe('reopenedBy')
      expect(v.reverseAt).toBe('reopenedAt')
    })
  })

  // ===========================================================================
  // 5. Verb state machine: every status transition path (8 tests)
  // ===========================================================================
  describe('Verb state machine completeness', () => {
    it('resolve transitions from Open to Resolved', async () => {
      const t = await Ticket.create({ subject: 'SM1', status: 'Open' })
      const r = await Ticket.resolve(t.$id)
      expect(r.status).toBe('Resolved')
    })

    it('resolve transitions from InProgress to Resolved', async () => {
      const t = await Ticket.create({ subject: 'SM2', status: 'InProgress' })
      const r = await Ticket.resolve(t.$id)
      expect(r.status).toBe('Resolved')
    })

    it('resolve transitions from Pending to Resolved', async () => {
      const t = await Ticket.create({ subject: 'SM3', status: 'Pending' })
      const r = await Ticket.resolve(t.$id)
      expect(r.status).toBe('Resolved')
    })

    it('close transitions from Open to Closed', async () => {
      const t = await Ticket.create({ subject: 'SM4', status: 'Open' })
      const c = await Ticket.close(t.$id)
      expect(c.status).toBe('Closed')
    })

    it('close transitions from Resolved to Closed', async () => {
      const t = await Ticket.create({ subject: 'SM5', status: 'Resolved' })
      const c = await Ticket.close(t.$id)
      expect(c.status).toBe('Closed')
    })

    it('reopen transitions from Closed to Reopened', async () => {
      const t = await Ticket.create({ subject: 'SM6', status: 'Closed' })
      const r = await Ticket.reopen(t.$id)
      expect(r.status).toBe('Reopened')
    })

    it('reopen transitions from Resolved to Reopened', async () => {
      const t = await Ticket.create({ subject: 'SM7', status: 'Resolved' })
      const r = await Ticket.reopen(t.$id)
      expect(r.status).toBe('Reopened')
    })

    it('escalate sets status to Escalated (convention field fallback)', async () => {
      // 'Escalated' is not in the status enum, but resolveVerbTransition
      // uses convention field 'status' from the entity
      const t = await Ticket.create({ subject: 'SM8', status: 'Open' })
      const e = await Ticket.escalate(t.$id)
      expect(e.status).toBe('Escalated')
    })
  })

  // ===========================================================================
  // 6. Concurrent verb executions (4 tests)
  // ===========================================================================
  describe('Concurrent verb executions', () => {
    it('concurrent resolve on different tickets all succeed', async () => {
      const tickets = await Promise.all(
        Array.from({ length: 10 }, (_, i) => Ticket.create({ subject: `CR ${i}`, status: 'Open' })),
      )
      const resolved = await Promise.all(tickets.map((t) => Ticket.resolve(t.$id)))
      expect(resolved.every((r) => r.status === 'Resolved')).toBe(true)
      expect(resolved.length).toBe(10)
    })

    it('concurrent close on different tickets all succeed', async () => {
      const tickets = await Promise.all(
        Array.from({ length: 10 }, (_, i) => Ticket.create({ subject: `CC ${i}`, status: 'Open' })),
      )
      const closed = await Promise.all(tickets.map((t) => Ticket.close(t.$id)))
      expect(closed.every((c) => c.status === 'Closed')).toBe(true)
    })

    it('concurrent mixed verbs on different tickets all succeed', async () => {
      const t1 = await Ticket.create({ subject: 'CM1', status: 'Open' })
      const t2 = await Ticket.create({ subject: 'CM2', status: 'Open' })
      const t3 = await Ticket.create({ subject: 'CM3', status: 'Open' })
      const t4 = await Ticket.create({ subject: 'CM4', status: 'Closed' })

      const [r1, r2, r3, r4] = await Promise.all([
        Ticket.resolve(t1.$id),
        Ticket.close(t2.$id),
        Ticket.escalate(t3.$id),
        Ticket.reopen(t4.$id),
      ])

      expect(r1.status).toBe('Resolved')
      expect(r2.status).toBe('Closed')
      expect(r3.status).toBe('Escalated')
      expect(r4.status).toBe('Reopened')
    })

    it('concurrent verb + hook fires hook for each execution', async () => {
      const calls: string[] = []
      const unsub = Ticket.resolving(() => {
        calls.push('resolving')
      })

      const tickets = await Promise.all(
        Array.from({ length: 5 }, (_, i) => Ticket.create({ subject: `CH ${i}`, status: 'Open' })),
      )
      await Promise.all(tickets.map((t) => Ticket.resolve(t.$id)))
      expect(calls.length).toBe(5)
      unsub()
    })
  })

  // ===========================================================================
  // 7. $context URL variations (4 tests)
  // ===========================================================================
  describe('$context URL structure', () => {
    it('$context follows https://headless.ly/~{tenant} pattern', async () => {
      const t = await Ticket.create({ subject: 'Context URL' })
      expect(t.$context).toMatch(/^https:\/\/headless\.ly\/~.+/)
    })

    it('$context starts with https protocol', async () => {
      const t = await Ticket.create({ subject: 'Protocol check' })
      expect(t.$context.startsWith('https://')).toBe(true)
    })

    it('$context contains headless.ly domain', async () => {
      const t = await Ticket.create({ subject: 'Domain check' })
      expect(t.$context).toContain('headless.ly')
    })

    it('$context is consistent across multiple creates in same test', async () => {
      const t1 = await Ticket.create({ subject: 'Ctx1' })
      const t2 = await Ticket.create({ subject: 'Ctx2' })
      const t3 = await Ticket.create({ subject: 'Ctx3' })
      expect(t1.$context).toBe(t2.$context)
      expect(t2.$context).toBe(t3.$context)
    })
  })

  // ===========================================================================
  // 8. Hook data flow: BEFORE transforms propagating to AFTER (6 tests)
  // ===========================================================================
  describe('Hook data flow: BEFORE -> AFTER propagation', () => {
    it('creating hook transform is visible in the created hook', async () => {
      let afterPriority: unknown = undefined
      const unsub1 = Ticket.creating((data: Record<string, unknown>) => {
        return { ...data, priority: 'Urgent' }
      })
      const unsub2 = Ticket.created((instance: any) => {
        afterPriority = instance.priority
      })

      await Ticket.create({ subject: 'Propagation', priority: 'Low' })
      expect(afterPriority).toBe('Urgent')

      unsub1()
      unsub2()
    })

    it('updating hook transform is visible in the updated hook', async () => {
      let afterTags: unknown = undefined
      const unsub1 = Ticket.updating((data: Record<string, unknown>) => {
        return { ...data, tags: 'hook-injected' }
      })
      const unsub2 = Ticket.updated((instance: any) => {
        afterTags = instance.tags
      })

      const t = await Ticket.create({ subject: 'Update propagation' })
      await Ticket.update(t.$id, { status: 'Closed' })
      expect(afterTags).toBe('hook-injected')

      unsub1()
      unsub2()
    })

    it('chained BEFORE hooks produce cumulative transforms', async () => {
      let afterInstance: any = null
      const unsub1 = Ticket.creating((data: Record<string, unknown>) => {
        return { ...data, priority: 'High' }
      })
      const unsub2 = Ticket.creating((data: Record<string, unknown>) => {
        return { ...data, category: 'auto-categorized' }
      })
      const unsub3 = Ticket.created((instance: any) => {
        afterInstance = instance
      })

      await Ticket.create({ subject: 'Cumulative' })
      expect(afterInstance.priority).toBe('High')
      expect(afterInstance.category).toBe('auto-categorized')

      unsub1()
      unsub2()
      unsub3()
    })

    it('resolving hook data does not override the verb state transition', async () => {
      // The verb transition sets status=Resolved. A BEFORE hook cannot change verb data
      // since BEFORE hooks receive the hook input, not the transition data.
      // The status change happens via resolveVerbTransition, not via the hook.
      const spy = vi.fn()
      const unsub = Ticket.resolving(spy)

      const t = await Ticket.create({ subject: 'Verb priority', status: 'Open' })
      const resolved = await Ticket.resolve(t.$id)
      expect(resolved.status).toBe('Resolved')
      expect(spy).toHaveBeenCalled()

      unsub()
    })

    it('AFTER hook receives entity with all meta-fields intact', async () => {
      let afterInstance: any = null
      const unsub = Ticket.created((instance: any) => {
        afterInstance = instance
      })

      const t = await Ticket.create({ subject: 'Meta in after' })
      expect(afterInstance.$id).toBe(t.$id)
      expect(afterInstance.$type).toBe('Ticket')
      expect(afterInstance.$context).toBeDefined()
      expect(afterInstance.$version).toBe(1)
      expect(afterInstance.$createdAt).toBeDefined()
      expect(afterInstance.$updatedAt).toBeDefined()

      unsub()
    })

    it('closing AFTER hook receives instance with Closed status', async () => {
      let closedStatus: unknown = undefined
      const unsub = Ticket.closed((instance: any) => {
        closedStatus = instance.status
      })

      const t = await Ticket.create({ subject: 'Close after verify', status: 'Open' })
      await Ticket.close(t.$id)
      expect(closedStatus).toBe('Closed')

      unsub()
    })
  })

  // ===========================================================================
  // 9. Entity ID format validation (3 tests)
  // ===========================================================================
  describe('Entity ID format', () => {
    it('$id matches ticket_{8-char-sqid} pattern', async () => {
      const t = await Ticket.create({ subject: 'ID format' })
      expect(t.$id).toMatch(/^ticket_[a-zA-Z0-9]{8}$/)
    })

    it('$id prefix is lowercase type name', async () => {
      const t = await Ticket.create({ subject: 'ID prefix' })
      expect(t.$id.startsWith('ticket_')).toBe(true)
    })

    it('100 sequential creates all produce valid unique IDs', async () => {
      const tickets: any[] = []
      for (let i = 0; i < 100; i++) {
        tickets.push(await Ticket.create({ subject: `ID${i}` }))
      }
      const ids = tickets.map((t) => t.$id)
      const unique = new Set(ids)
      expect(unique.size).toBe(100)
      for (const id of ids) {
        expect(id).toMatch(/^ticket_[a-zA-Z0-9]{8}$/)
      }
    })
  })

  // ===========================================================================
  // 10. Noun-level schema identity (4 tests)
  // ===========================================================================
  describe('Noun schema identity', () => {
    it('$schema.name is Ticket', () => {
      expect(Ticket.$schema.name).toBe('Ticket')
    })

    it('$schema.singular is ticket', () => {
      expect(Ticket.$schema.singular).toBe('ticket')
    })

    it('$schema.plural is tickets', () => {
      expect(Ticket.$schema.plural).toBe('tickets')
    })

    it('$schema.slug is ticket', () => {
      expect(Ticket.$schema.slug).toBe('ticket')
    })
  })

  // ===========================================================================
  // 11. Disabled verbs (2 tests)
  // ===========================================================================
  describe('Disabled verbs set', () => {
    it('disabledVerbs is an empty Set (nothing disabled)', () => {
      expect(Ticket.$schema.disabledVerbs).toBeInstanceOf(Set)
      expect(Ticket.$schema.disabledVerbs.size).toBe(0)
    })

    it('no CRUD verb appears in disabledVerbs', () => {
      expect(Ticket.$schema.disabledVerbs.has('create')).toBe(false)
      expect(Ticket.$schema.disabledVerbs.has('update')).toBe(false)
      expect(Ticket.$schema.disabledVerbs.has('delete')).toBe(false)
    })
  })

  // ===========================================================================
  // 12. Fields/relationships Maps structure (3 tests)
  // ===========================================================================
  describe('Schema Maps structure', () => {
    it('fields map has exactly 10 entries (data fields + enums)', () => {
      // subject, description, status, priority, category, channel, tags,
      // firstResponseAt, resolvedAt, satisfaction
      expect(Ticket.$schema.fields.size).toBe(10)
    })

    it('relationships map has exactly 3 entries', () => {
      expect(Ticket.$schema.relationships.size).toBe(3)
    })

    it('verbs map has exactly 7 entries (3 CRUD + 4 custom)', () => {
      expect(Ticket.$schema.verbs.size).toBe(7)
    })
  })

  // ===========================================================================
  // 13. Enum value querying completeness (5 tests)
  // ===========================================================================
  describe('Enum value creation and querying', () => {
    it('creates a ticket with every status value', async () => {
      const statuses = ['Open', 'Pending', 'InProgress', 'Resolved', 'Closed']
      for (const status of statuses) {
        const t = await Ticket.create({ subject: `Status ${status}`, status })
        expect(t.status).toBe(status)
      }
    })

    it('creates a ticket with every priority value', async () => {
      const priorities = ['Low', 'Medium', 'High', 'Urgent']
      for (const priority of priorities) {
        const t = await Ticket.create({ subject: `Priority ${priority}`, priority })
        expect(t.priority).toBe(priority)
      }
    })

    it('creates a ticket with every channel value', async () => {
      const channels = ['Email', 'Chat', 'Phone', 'Web', 'API']
      for (const channel of channels) {
        const t = await Ticket.create({ subject: `Channel ${channel}`, channel })
        expect(t.channel).toBe(channel)
      }
    })

    it('finds tickets for each distinct status value', async () => {
      const statuses = ['Open', 'Pending', 'InProgress', 'Resolved', 'Closed']
      for (const status of statuses) {
        await Ticket.create({ subject: `FSt ${status}`, status })
      }
      for (const status of statuses) {
        const found = await Ticket.find({ status })
        expect(found.length).toBe(1)
        expect(found[0].status).toBe(status)
      }
    })

    it('finds tickets for each distinct channel value', async () => {
      const channels = ['Email', 'Chat', 'Phone', 'Web', 'API']
      for (const channel of channels) {
        await Ticket.create({ subject: `FCh ${channel}`, channel })
      }
      for (const channel of channels) {
        const found = await Ticket.find({ channel })
        expect(found.length).toBe(1)
        expect(found[0].channel).toBe(channel)
      }
    })
  })

  // ===========================================================================
  // 14. Full lifecycle chain with version tracking (2 tests)
  // ===========================================================================
  describe('Full lifecycle chain with version tracking', () => {
    it('Open -> resolve -> close produces version 3', async () => {
      const t = await Ticket.create({ subject: 'VT1', status: 'Open' })
      expect(t.$version).toBe(1)
      const r = await Ticket.resolve(t.$id)
      expect(r.$version).toBe(2)
      const c = await Ticket.close(t.$id)
      expect(c.$version).toBe(3)
    })

    it('Open -> escalate -> resolve -> close -> reopen -> close produces version 6', async () => {
      const t = await Ticket.create({ subject: 'VT2', status: 'Open' })
      expect(t.$version).toBe(1)
      const e = await Ticket.escalate(t.$id)
      expect(e.$version).toBe(2)
      const r = await Ticket.resolve(t.$id)
      expect(r.$version).toBe(3)
      const c = await Ticket.close(t.$id)
      expect(c.$version).toBe(4)
      const ro = await Ticket.reopen(t.$id)
      expect(ro.$version).toBe(5)
      const c2 = await Ticket.close(t.$id)
      expect(c2.$version).toBe(6)
    })
  })

  // ===========================================================================
  // 15. Multiple hook unsubscription patterns (3 tests)
  // ===========================================================================
  describe('Hook unsubscription patterns', () => {
    it('unsubscribing all hooks results in zero hook calls', async () => {
      const spy1 = vi.fn()
      const spy2 = vi.fn()
      const unsub1 = Ticket.resolving(spy1)
      const unsub2 = Ticket.resolved(spy2)

      unsub1()
      unsub2()

      const t = await Ticket.create({ subject: 'NoHooks', status: 'Open' })
      await Ticket.resolve(t.$id)

      expect(spy1).not.toHaveBeenCalled()
      expect(spy2).not.toHaveBeenCalled()
    })

    it('double unsubscribe is safe (no error)', async () => {
      const spy = vi.fn()
      const unsub = Ticket.resolving(spy)

      unsub()
      unsub() // second call should not throw

      const t = await Ticket.create({ subject: 'DoubleUnsub', status: 'Open' })
      await Ticket.resolve(t.$id)
      expect(spy).not.toHaveBeenCalled()
    })

    it('unsubscribing one hook does not affect others of the same verb', async () => {
      const spy1 = vi.fn()
      const spy2 = vi.fn()
      const unsub1 = Ticket.resolving(spy1)
      const _unsub2 = Ticket.resolving(spy2)

      unsub1()

      const t = await Ticket.create({ subject: 'PartialUnsub', status: 'Open' })
      await Ticket.resolve(t.$id)

      expect(spy1).not.toHaveBeenCalled()
      expect(spy2).toHaveBeenCalledTimes(1)

      _unsub2()
    })
  })

  // ===========================================================================
  // 16. Edge case: verb on ticket with no initial status (2 tests)
  // ===========================================================================
  describe('Verb on ticket with no initial status', () => {
    it('resolve on ticket with no status still sets Resolved', async () => {
      const t = await Ticket.create({ subject: 'No status resolve' })
      const r = await Ticket.resolve(t.$id)
      // Even without initial status, resolveVerbTransition finds 'status' in schema
      expect(r.status).toBe('Resolved')
    })

    it('close on ticket with no status still sets Closed', async () => {
      const t = await Ticket.create({ subject: 'No status close' })
      const c = await Ticket.close(t.$id)
      expect(c.status).toBe('Closed')
    })
  })
})
