import { describe, it, expect } from 'vitest'
import {
  generateEventTypes,
  generateEventTypeStrings,
  isValidEventType,
} from '../src/discriminated-union'
import type {
  EntityEvent,
  ContactEvent,
  DealEvent,
  EventsFor,
  EventByType,
  EntityEventType,
  CreatedEvent,
  UpdatedEvent,
  DeletedEvent,
  CustomVerbEvent,
} from '../src/discriminated-union'

// =============================================================================
// Mock noun registry (matches the shape from digital-objects/noun-registry)
// =============================================================================

function createMockRegistry(): Map<string, { name: string; verbs: Map<string, { action: string; event: string }> }> {
  const registry = new Map<string, { name: string; verbs: Map<string, { action: string; event: string }> }>()

  // Contact: CRUD + qualify, capture, assign, merge, enrich
  const contactVerbs = new Map<string, { action: string; event: string }>([
    ['create', { action: 'create', event: 'created' }],
    ['update', { action: 'update', event: 'updated' }],
    ['delete', { action: 'delete', event: 'deleted' }],
    ['qualify', { action: 'qualify', event: 'qualified' }],
    ['capture', { action: 'capture', event: 'captured' }],
    ['assign', { action: 'assign', event: 'assigned' }],
    ['merge', { action: 'merge', event: 'merged' }],
    ['enrich', { action: 'enrich', event: 'enriched' }],
  ])
  registry.set('Contact', { name: 'Contact', verbs: contactVerbs })

  // Deal: CRUD + close, win, lose, advance, reopen
  const dealVerbs = new Map<string, { action: string; event: string }>([
    ['create', { action: 'create', event: 'created' }],
    ['update', { action: 'update', event: 'updated' }],
    ['delete', { action: 'delete', event: 'deleted' }],
    ['close', { action: 'close', event: 'closed' }],
    ['win', { action: 'win', event: 'won' }],
    ['lose', { action: 'lose', event: 'lost' }],
    ['advance', { action: 'advance', event: 'advanced' }],
    ['reopen', { action: 'reopen', event: 'reopened' }],
  ])
  registry.set('Deal', { name: 'Deal', verbs: dealVerbs })

  // Subscription: CRUD + pause, cancel, reactivate, upgrade, downgrade, activate, renew
  const subscriptionVerbs = new Map<string, { action: string; event: string }>([
    ['create', { action: 'create', event: 'created' }],
    ['update', { action: 'update', event: 'updated' }],
    ['delete', { action: 'delete', event: 'deleted' }],
    ['pause', { action: 'pause', event: 'paused' }],
    ['cancel', { action: 'cancel', event: 'cancelled' }],
  ])
  registry.set('Subscription', { name: 'Subscription', verbs: subscriptionVerbs })

  return registry
}

// =============================================================================
// Tests
// =============================================================================

describe('@headlessly/events — Discriminated Union', () => {
  describe('generateEventTypes()', () => {
    it('should generate event type descriptors from noun registry', () => {
      const registry = createMockRegistry()
      const descriptors = generateEventTypes(registry)

      expect(descriptors.length).toBeGreaterThan(0)

      // Should include Contact CRUD events
      const contactCreated = descriptors.find((d) => d.type === 'Contact.created')
      expect(contactCreated).toBeDefined()
      expect(contactCreated!.entityType).toBe('Contact')
      expect(contactCreated!.verb).toBe('create')
      expect(contactCreated!.verbEvent).toBe('created')
      expect(contactCreated!.isCrud).toBe(true)

      // Should include Contact custom verb events
      const contactQualified = descriptors.find((d) => d.type === 'Contact.qualified')
      expect(contactQualified).toBeDefined()
      expect(contactQualified!.entityType).toBe('Contact')
      expect(contactQualified!.verb).toBe('qualify')
      expect(contactQualified!.verbEvent).toBe('qualified')
      expect(contactQualified!.isCrud).toBe(false)

      // Should include Deal events
      const dealClosed = descriptors.find((d) => d.type === 'Deal.closed')
      expect(dealClosed).toBeDefined()
      expect(dealClosed!.entityType).toBe('Deal')
      expect(dealClosed!.verb).toBe('close')
      expect(dealClosed!.isCrud).toBe(false)

      // Should include Deal.won (irregular verb)
      const dealWon = descriptors.find((d) => d.type === 'Deal.won')
      expect(dealWon).toBeDefined()
      expect(dealWon!.verb).toBe('win')
    })

    it('should generate descriptors for all verbs including custom', () => {
      const registry = createMockRegistry()
      const descriptors = generateEventTypes(registry)

      // Count Contact events: 3 CRUD + 5 custom = 8
      const contactEvents = descriptors.filter((d) => d.entityType === 'Contact')
      expect(contactEvents.length).toBe(8)

      // Count CRUD events for Contact
      const contactCrud = contactEvents.filter((d) => d.isCrud)
      expect(contactCrud.length).toBe(3)

      // Count custom events for Contact
      const contactCustom = contactEvents.filter((d) => !d.isCrud)
      expect(contactCustom.length).toBe(5)
    })
  })

  describe('generateEventTypeStrings()', () => {
    it('should return all event type strings', () => {
      const registry = createMockRegistry()
      const types = generateEventTypeStrings(registry)

      expect(types).toContain('Contact.created')
      expect(types).toContain('Contact.updated')
      expect(types).toContain('Contact.deleted')
      expect(types).toContain('Contact.qualified')
      expect(types).toContain('Deal.closed')
      expect(types).toContain('Deal.won')
      expect(types).toContain('Deal.lost')
      expect(types).toContain('Subscription.paused')
      expect(types).toContain('Subscription.cancelled')
    })
  })

  describe('isValidEventType()', () => {
    const registry = createMockRegistry()

    it('should validate known event types', () => {
      expect(isValidEventType('Contact.created', registry)).toBe(true)
      expect(isValidEventType('Contact.qualified', registry)).toBe(true)
      expect(isValidEventType('Deal.closed', registry)).toBe(true)
      expect(isValidEventType('Deal.won', registry)).toBe(true)
      expect(isValidEventType('Subscription.cancelled', registry)).toBe(true)
    })

    it('should reject unknown event types', () => {
      expect(isValidEventType('Contact.nonexistent', registry)).toBe(false)
      expect(isValidEventType('UnknownEntity.created', registry)).toBe(false)
      expect(isValidEventType('invalid', registry)).toBe(false)
      expect(isValidEventType('', registry)).toBe(false)
    })
  })

  describe('Type-level discriminated union', () => {
    it('should narrow ContactEvent by $type', () => {
      // This test verifies compile-time type narrowing works
      const event: ContactEvent = {
        $id: 'evt_123',
        $type: 'Contact.qualified',
        entityType: 'Contact',
        verb: 'qualify',
        data: { name: 'Alice', stage: 'Qualified' },
        timestamp: new Date().toISOString(),
        version: 2,
      }

      expect(event.$type).toBe('Contact.qualified')
      expect(event.entityType).toBe('Contact')
      expect(event.verb).toBe('qualify')
    })

    it('should narrow DealEvent by $type', () => {
      const event: DealEvent = {
        $id: 'evt_456',
        $type: 'Deal.closed',
        entityType: 'Deal',
        verb: 'close',
        data: { name: 'Big Deal', stage: 'Closed' },
        timestamp: new Date().toISOString(),
        version: 3,
      }

      expect(event.$type).toBe('Deal.closed')
      expect(event.entityType).toBe('Deal')
    })

    it('should create proper CreatedEvent', () => {
      const event: CreatedEvent<'Contact'> = {
        $id: 'evt_789',
        $type: 'Contact.created',
        entityType: 'Contact',
        verb: 'create',
        data: { name: 'Bob', stage: 'Lead' },
        timestamp: new Date().toISOString(),
        version: 1,
      }

      expect(event.$type).toBe('Contact.created')
      expect(event.verb).toBe('create')
    })

    it('should create proper UpdatedEvent', () => {
      const event: UpdatedEvent<'Contact'> = {
        $id: 'evt_abc',
        $type: 'Contact.updated',
        entityType: 'Contact',
        verb: 'update',
        data: { name: 'Bob Updated' },
        previousData: { name: 'Bob' },
        timestamp: new Date().toISOString(),
        version: 2,
      }

      expect(event.$type).toBe('Contact.updated')
      expect(event.verb).toBe('update')
      expect(event.previousData).toBeDefined()
    })

    it('should create proper DeletedEvent', () => {
      const event: DeletedEvent<'Contact'> = {
        $id: 'evt_def',
        $type: 'Contact.deleted',
        entityType: 'Contact',
        verb: 'delete',
        entityId: 'contact_123',
        timestamp: new Date().toISOString(),
        version: 3,
      }

      expect(event.$type).toBe('Contact.deleted')
      expect(event.verb).toBe('delete')
      expect(event.entityId).toBe('contact_123')
    })

    it('should narrow EntityEvent union by $type', () => {
      // Test that the full union narrows properly
      function handleEvent(event: EntityEvent): string {
        if (event.$type === 'Contact.qualified') {
          // TypeScript narrows to CustomVerbEvent<'Contact', 'qualified', 'qualify'>
          return `${event.entityType} was qualified`
        }
        if (event.$type === 'Deal.closed') {
          return `${event.entityType} was closed`
        }
        return 'unknown event'
      }

      const qualifiedEvent: EntityEvent = {
        $id: 'evt_test',
        $type: 'Contact.qualified',
        entityType: 'Contact',
        verb: 'qualify',
        data: {},
        timestamp: new Date().toISOString(),
        version: 1,
      }

      expect(handleEvent(qualifiedEvent)).toBe('Contact was qualified')
    })

    it('EventsFor extracts entity-specific events', () => {
      // Compile-time test: EventsFor<'Contact'> should only contain Contact events
      const contactEvent: EventsFor<'Contact'> = {
        $id: 'evt_1',
        $type: 'Contact.created',
        entityType: 'Contact',
        verb: 'create',
        data: {},
        timestamp: new Date().toISOString(),
        version: 1,
      }
      expect(contactEvent.entityType).toBe('Contact')
    })

    it('EventByType extracts by exact $type', () => {
      // Compile-time test: EventByType<'Contact.qualified'> narrows to the exact event
      const event: EventByType<'Contact.qualified'> = {
        $id: 'evt_2',
        $type: 'Contact.qualified',
        entityType: 'Contact',
        verb: 'qualify',
        data: {},
        timestamp: new Date().toISOString(),
        version: 1,
      }
      expect(event.$type).toBe('Contact.qualified')
    })
  })
})
