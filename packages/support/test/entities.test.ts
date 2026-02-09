import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Ticket } from '../src/index.ts'
import { setupTestProvider, expectMetaFields, expectCrudVerbs, expectVerbConjugation, testCrudLifecycle } from '../../test-utils'

describe('@headlessly/support', () => {
  setupTestProvider()

  describe('exports', () => {
    it('exports Ticket', () => {
      expect(Ticket).toBeDefined()
      expect(Ticket.$name).toBe('Ticket')
    })
  })

  describe('CRUD verbs', () => {
    it('Ticket has standard CRUD verbs', () => {
      expectCrudVerbs(Ticket)
    })
  })

  describe('verb conjugation', () => {
    it('Ticket has resolve verb conjugation', () => {
      expectVerbConjugation(Ticket, 'resolve', 'resolving', 'resolved')
    })

    it('Ticket has escalate verb conjugation', () => {
      expectVerbConjugation(Ticket, 'escalate', 'escalating', 'escalated')
    })

    it('Ticket has close verb conjugation', () => {
      expectVerbConjugation(Ticket, 'close', 'closing', 'closed')
    })

    it('Ticket has reopen verb conjugation', () => {
      expectVerbConjugation(Ticket, 'reopen', 'reopenning', 'reopenned')
    })
  })

  describe('create with meta-fields', () => {
    it('Ticket has correct meta-fields on create', async () => {
      const ticket = await Ticket.create({ subject: 'Cannot login to dashboard' })
      expectMetaFields(ticket, 'Ticket')
      expect(ticket.subject).toBe('Cannot login to dashboard')
    })
  })

  describe('full CRUD lifecycle', () => {
    it('Ticket supports full CRUD lifecycle', async () => {
      await testCrudLifecycle(Ticket, 'Ticket', { subject: 'Cannot login to dashboard' }, { subject: 'Login issue resolved' })
    })
  })
})
