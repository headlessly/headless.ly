import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { $, crm, billing } from '../src/index'

/**
 * Concurrent SDK tests using MemoryNounProvider.
 *
 * Exercises actual Promise.all() concurrent execution for:
 * - Mixed CRUD operations
 * - Concurrent verb execution
 * - Event listener consistency during concurrent ops
 * - Provider data integrity after concurrent mutations
 */

describe('Concurrent SDK operations', () => {
  beforeEach(() => {
    clearRegistry()
    setProvider(new MemoryNounProvider())
  })

  // ===========================================================================
  // Concurrent CRUD via MemoryNounProvider
  // ===========================================================================

  describe('concurrent CRUD via MemoryNounProvider', () => {
    it('10 concurrent creates all succeed with unique IDs', async () => {
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) => $.Contact.create({ name: `User ${i}`, stage: 'Lead' })),
      )

      expect(results.length).toBe(10)

      const ids = results.map((r) => r.$id)
      expect(new Set(ids).size).toBe(10)

      for (const result of results) {
        expect(result.$type).toBe('Contact')
        expect(result.$version).toBe(1)
      }
    })

    it('concurrent creates across different entity types', async () => {
      const [contact, deal, ticket, project, invoice] = await Promise.all([
        $.Contact.create({ name: 'Alice', stage: 'Lead' }),
        $.Deal.create({ name: 'Big Deal', value: 50000 }),
        $.Ticket.create({ subject: 'Help needed' }),
        $.Project.create({ name: 'Alpha' }),
        $.Invoice.create({ amount: 1000 }),
      ])

      expect(contact.$type).toBe('Contact')
      expect(deal.$type).toBe('Deal')
      expect(ticket.$type).toBe('Ticket')
      expect(project.$type).toBe('Project')
      expect(invoice.$type).toBe('Invoice')
    })

    it('concurrent create + find on the same type', async () => {
      // Seed some data first
      await $.Contact.create({ name: 'Seed', stage: 'Lead' })

      // Concurrently create more and find existing
      const [newContact, found] = await Promise.all([
        $.Contact.create({ name: 'New', stage: 'Lead' }),
        $.Contact.find(),
      ])

      expect(newContact.$type).toBe('Contact')
      // found should have at least the seeded contact
      expect(found.length).toBeGreaterThanOrEqual(1)
    })

    it('concurrent get calls on the same entity return consistent data', async () => {
      const created = await $.Contact.create({ name: 'Alice', email: 'alice@test.com' })

      const results = await Promise.all(
        Array.from({ length: 10 }, () => $.Contact.get(created.$id)),
      )

      for (const result of results) {
        expect(result).toBeDefined()
        expect(result!.$id).toBe(created.$id)
        expect(result!.name).toBe('Alice')
      }
    })

    it('create then immediately update in parallel for different entities', async () => {
      // Create 5 entities first
      const entities = await Promise.all(
        Array.from({ length: 5 }, (_, i) => $.Contact.create({ name: `User ${i}`, stage: 'Lead' })),
      )

      // Update all 5 concurrently
      const updated = await Promise.all(
        entities.map((e) => $.Contact.update(e.$id, { stage: 'Qualified' })),
      )

      for (const u of updated) {
        expect(u.stage).toBe('Qualified')
        expect(u.$version).toBe(2)
      }
    })

    it('concurrent deletes of different entities all succeed', async () => {
      const entities = await Promise.all(
        Array.from({ length: 5 }, (_, i) => $.Contact.create({ name: `Deletable ${i}` })),
      )

      const results = await Promise.all(
        entities.map((e) => $.Contact.delete(e.$id)),
      )

      for (const r of results) {
        expect(r).toBe(true)
      }

      // Verify all are gone
      const remaining = await $.Contact.find()
      expect(remaining.length).toBe(0)
    })

    it('mixed create/read/update/delete in a single Promise.all', async () => {
      // Seed entities
      const a = await $.Contact.create({ name: 'Alice', stage: 'Lead' })
      const b = await $.Contact.create({ name: 'Bob', stage: 'Lead' })

      const [created, fetched, updated, deleted] = await Promise.all([
        $.Contact.create({ name: 'Charlie', stage: 'Lead' }),
        $.Contact.get(a.$id),
        $.Contact.update(b.$id, { stage: 'Qualified' }),
        $.Contact.delete(a.$id),
      ])

      expect(created.$type).toBe('Contact')
      expect(created.name).toBe('Charlie')
      // fetched may be Alice or null depending on delete timing
      // The important thing is no crash
      expect(updated.stage).toBe('Qualified')
      expect(deleted).toBe(true)
    })
  })

  // ===========================================================================
  // Concurrent verb execution
  // ===========================================================================

  describe('concurrent verb execution', () => {
    it('concurrent custom verbs on different entities', async () => {
      // Create contacts with 'Lead' stage
      const contacts = await Promise.all(
        Array.from({ length: 5 }, (_, i) => $.Contact.create({ name: `Lead ${i}`, stage: 'Lead' })),
      )

      // Qualify all concurrently (custom verb defined on Contact)
      const qualified = await Promise.all(
        contacts.map((c) => $.Contact.qualify(c.$id)),
      )

      for (const q of qualified) {
        expect(q.stage).toBe('Qualified')
      }
    })

    it('concurrent verbs across different entity types', async () => {
      const user = await $.User.create({ name: 'Alice', email: 'alice@test.com', status: 'Active' })
      const ticket = await $.Ticket.create({ subject: 'Help', status: 'Open' })
      const message = await $.Message.create({ body: 'Hello', channel: 'Email', status: 'Draft' })

      const [suspended, resolved, sent] = await Promise.all([
        $.User.suspend(user.$id),
        $.Ticket.resolve(ticket.$id),
        $.Message.send(message.$id),
      ])

      expect(suspended.status).toBe('Suspended')
      expect(resolved.status).toBe('Resolved')
      expect(sent.status).toBe('Sent')
    })

    it('CRUD and verb calls mixed in Promise.all', async () => {
      const contact = await $.Contact.create({ name: 'Alice', stage: 'Lead' })

      const [qualified, newDeal, found] = await Promise.all([
        $.Contact.qualify(contact.$id),
        $.Deal.create({ name: 'Deal from qualified', value: 10000 }),
        $.Contact.find(),
      ])

      expect(qualified.stage).toBe('Qualified')
      expect(newDeal.$type).toBe('Deal')
      expect(found.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ===========================================================================
  // Event listeners during concurrent operations
  // ===========================================================================

  describe('event listeners during concurrent operations', () => {
    it('created events fire for all concurrent creates', async () => {
      const events: unknown[] = []

      // Subscribe to created events
      $.Contact.created((entity: any) => {
        events.push(entity)
      })

      // Fire 5 concurrent creates
      await Promise.all(
        Array.from({ length: 5 }, (_, i) => $.Contact.create({ name: `User ${i}`, stage: 'Lead' })),
      )

      // All 5 create events should have been captured
      expect(events.length).toBe(5)
    })

    it('updated events fire for all concurrent updates', async () => {
      const events: unknown[] = []

      // Create entities first
      const entities = await Promise.all(
        Array.from({ length: 3 }, (_, i) => $.Contact.create({ name: `User ${i}`, stage: 'Lead' })),
      )

      // Subscribe to updated events
      $.Contact.updated((entity: any) => {
        events.push(entity)
      })

      // Update all concurrently
      await Promise.all(
        entities.map((e) => $.Contact.update(e.$id, { stage: 'Qualified' })),
      )

      expect(events.length).toBe(3)
    })

    it('deleted events fire for all concurrent deletes', async () => {
      const events: unknown[] = []

      const entities = await Promise.all(
        Array.from({ length: 4 }, (_, i) => $.Contact.create({ name: `User ${i}` })),
      )

      $.Contact.deleted((entity: any) => {
        events.push(entity)
      })

      await Promise.all(
        entities.map((e) => $.Contact.delete(e.$id)),
      )

      expect(events.length).toBe(4)
    })

    it('mixed event types during concurrent mixed operations', async () => {
      const existing = await $.Deal.create({ name: 'Existing', value: 1000 })

      const createEvents: unknown[] = []
      const updateEvents: unknown[] = []

      $.Deal.created((e: any) => createEvents.push(e))
      $.Deal.updated((e: any) => updateEvents.push(e))

      await Promise.all([
        $.Deal.create({ name: 'New A', value: 2000 }),
        $.Deal.create({ name: 'New B', value: 3000 }),
        $.Deal.update(existing.$id, { value: 5000 }),
      ])

      // 2 creates from the Promise.all (subscribed after setup create)
      expect(createEvents.length).toBe(2)
      expect(updateEvents.length).toBe(1)
    })
  })

  // ===========================================================================
  // Provider consistency after concurrent operations
  // ===========================================================================

  describe('provider consistency', () => {
    it('no lost writes: all concurrent creates are findable', async () => {
      const created = await Promise.all(
        Array.from({ length: 20 }, (_, i) => $.Contact.create({ name: `User ${i}`, stage: 'Lead' })),
      )

      const all = await $.Contact.find()
      expect(all.length).toBe(20)

      // Verify each created entity is findable by ID
      const fetchResults = await Promise.all(
        created.map((c) => $.Contact.get(c.$id)),
      )

      for (let i = 0; i < fetchResults.length; i++) {
        expect(fetchResults[i]).toBeDefined()
        expect(fetchResults[i]!.$id).toBe(created[i].$id)
      }
    })

    it('no phantom reads: deleted entities stay deleted', async () => {
      const entities = await Promise.all(
        Array.from({ length: 10 }, (_, i) => $.Contact.create({ name: `User ${i}` })),
      )

      // Delete all concurrently
      await Promise.all(
        entities.map((e) => $.Contact.delete(e.$id)),
      )

      // Verify all are gone with concurrent reads
      const reads = await Promise.all(
        entities.map((e) => $.Contact.get(e.$id)),
      )

      for (const r of reads) {
        expect(r).toBeNull()
      }

      // Find should return empty
      const all = await $.Contact.find()
      expect(all.length).toBe(0)
    })

    it('version increments are correct after concurrent updates', async () => {
      const contact = await $.Contact.create({ name: 'Alice', stage: 'Lead' })
      expect(contact.$version).toBe(1)

      // Sequential updates to same entity — each should increment version
      const v2 = await $.Contact.update(contact.$id, { name: 'Alice Updated 1' })
      expect(v2.$version).toBe(2)

      const v3 = await $.Contact.update(contact.$id, { name: 'Alice Updated 2' })
      expect(v3.$version).toBe(3)

      // Verify final state
      const final = await $.Contact.get(contact.$id)
      expect(final!.$version).toBe(3)
      expect(final!.name).toBe('Alice Updated 2')
    })

    it('cross-entity-type consistency after concurrent mixed operations', async () => {
      // Create across multiple types concurrently
      const [contacts, deals, tickets] = await Promise.all([
        Promise.all(Array.from({ length: 5 }, (_, i) => $.Contact.create({ name: `Contact ${i}` }))),
        Promise.all(Array.from({ length: 3 }, (_, i) => $.Deal.create({ name: `Deal ${i}`, value: i * 1000 }))),
        Promise.all(Array.from({ length: 4 }, (_, i) => $.Ticket.create({ subject: `Ticket ${i}` }))),
      ])

      // Verify counts
      const [contactList, dealList, ticketList] = await Promise.all([
        $.Contact.find(),
        $.Deal.find(),
        $.Ticket.find(),
      ])

      expect(contactList.length).toBe(5)
      expect(dealList.length).toBe(3)
      expect(ticketList.length).toBe(4)

      // Delete some concurrently across types
      await Promise.all([
        $.Contact.delete(contacts[0].$id),
        $.Deal.delete(deals[0].$id),
        $.Ticket.delete(tickets[0].$id),
      ])

      // Verify updated counts
      const [contactList2, dealList2, ticketList2] = await Promise.all([
        $.Contact.find(),
        $.Deal.find(),
        $.Ticket.find(),
      ])

      expect(contactList2.length).toBe(4)
      expect(dealList2.length).toBe(2)
      expect(ticketList2.length).toBe(3)
    })

    it('$.search returns consistent results after concurrent mutations', async () => {
      // Create entities concurrently
      await Promise.all(
        Array.from({ length: 8 }, (_, i) => $.Contact.create({ name: `Searchable ${i}`, stage: 'Lead' })),
      )

      // Concurrent searches should all return the same count
      const searches = await Promise.all(
        Array.from({ length: 5 }, () => $.search({ type: 'Contact' })),
      )

      for (const result of searches) {
        expect(result.length).toBe(8)
      }
    })

    it('$.do context has all entities during concurrent execution', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          $.do(async (ctx) => {
            const contact = await ctx.Contact.create({ name: `DoUser ${i}` })
            return contact.$id
          }),
        ),
      )

      expect(results.length).toBe(5)
      expect(new Set(results).size).toBe(5)
    })

    it('$.fetch returns correct entity during concurrent fetches', async () => {
      const entities = await Promise.all(
        Array.from({ length: 10 }, (_, i) => $.Contact.create({ name: `Fetch ${i}` })),
      )

      const fetched = await Promise.all(
        entities.map((e) => $.fetch({ type: 'Contact', id: e.$id })),
      )

      for (let i = 0; i < fetched.length; i++) {
        expect(fetched[i]).toBeDefined()
        expect(fetched[i]!.$id).toBe(entities[i].$id)
        expect(fetched[i]!.name).toBe(`Fetch ${i}`)
      }
    })
  })
})
