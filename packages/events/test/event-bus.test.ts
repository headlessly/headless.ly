import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventBus } from '../src/event-bus'
import { EventLog } from '../src/event-log'
import { EventPatterns, crudEvent, verbEvent } from '../src/types'
import type { NounEvent, NounEventInput } from '../src/types'

// =============================================================================
// Helpers
// =============================================================================

function eventInput(
  entityType: string,
  entityId: string,
  verb: string,
  after?: Record<string, unknown>,
): NounEventInput {
  const eventForm = verb.endsWith('e') ? `${verb}d` : `${verb}ed`
  return {
    $type: `${entityType}.${eventForm}`,
    entityType,
    entityId,
    verb,
    conjugation: { action: verb, activity: `${verb}ing`, event: eventForm },
    after,
  }
}

// =============================================================================
// EventBus Tests
// =============================================================================

describe('EventBus', () => {
  let bus: EventBus

  beforeEach(() => {
    bus = new EventBus()
  })

  describe('emit', () => {
    it('emits an event and returns it with generated fields', async () => {
      const event = await bus.emit(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      expect(event.$id).toMatch(/^evt_/)
      expect(event.entityType).toBe('Contact')
      expect(event.entityId).toBe('c1')
      expect(event.sequence).toBe(1)
      expect(event.timestamp).toBeDefined()
    })

    it('increments size after emitting', async () => {
      expect(bus.size).toBe(0)
      await bus.emit(eventInput('Contact', 'c1', 'create'))
      expect(bus.size).toBe(1)
      await bus.emit(eventInput('Deal', 'd1', 'create'))
      expect(bus.size).toBe(2)
    })
  })

  describe('on', () => {
    it('calls handler when matching event is emitted', async () => {
      const handler = vi.fn()
      bus.on('Contact.*', handler)

      await bus.emit(eventInput('Contact', 'c1', 'create'))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('does not call handler for non-matching events', async () => {
      const handler = vi.fn()
      bus.on('Contact.*', handler)

      await bus.emit(eventInput('Deal', 'd1', 'create'))
      expect(handler).not.toHaveBeenCalled()
    })

    it('wildcard * matches all events', async () => {
      const handler = vi.fn()
      bus.on('*', handler)

      await bus.emit(eventInput('Contact', 'c1', 'create'))
      await bus.emit(eventInput('Deal', 'd1', 'close'))
      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('returns an unsubscribe function', async () => {
      const handler = vi.fn()
      const unsub = bus.on('*', handler)

      await bus.emit(eventInput('Contact', 'c1', 'create'))
      expect(handler).toHaveBeenCalledOnce()

      unsub()
      await bus.emit(eventInput('Contact', 'c2', 'create'))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('multiple handlers on same pattern all receive events', async () => {
      const h1 = vi.fn()
      const h2 = vi.fn()
      bus.on('Contact.*', h1)
      bus.on('Contact.*', h2)

      await bus.emit(eventInput('Contact', 'c1', 'create'))
      expect(h1).toHaveBeenCalledOnce()
      expect(h2).toHaveBeenCalledOnce()
    })
  })

  describe('once', () => {
    it('fires handler only for the first matching event', async () => {
      const handler = vi.fn()
      bus.once('Contact.*', handler)

      await bus.emit(eventInput('Contact', 'c1', 'create'))
      await bus.emit(eventInput('Contact', 'c2', 'create'))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('does not fire for non-matching events, waits for matching one', async () => {
      const handler = vi.fn()
      bus.once('Deal.*', handler)

      await bus.emit(eventInput('Contact', 'c1', 'create'))
      expect(handler).not.toHaveBeenCalled()

      await bus.emit(eventInput('Deal', 'd1', 'create'))
      expect(handler).toHaveBeenCalledOnce()

      // Should not fire again
      await bus.emit(eventInput('Deal', 'd2', 'create'))
      expect(handler).toHaveBeenCalledOnce()
    })

    it('returns an unsubscribe function that cancels before firing', async () => {
      const handler = vi.fn()
      const unsub = bus.once('Contact.*', handler)

      unsub() // cancel before any event
      await bus.emit(eventInput('Contact', 'c1', 'create'))
      expect(handler).not.toHaveBeenCalled()
    })

    it('once handler receives the correct event data', async () => {
      let received: NounEvent | undefined
      bus.once('Contact.*', (event) => {
        received = event
      })

      await bus.emit(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      expect(received).toBeDefined()
      expect(received!.entityId).toBe('c1')
      expect(received!.after).toEqual({ name: 'Alice' })
    })
  })

  describe('off', () => {
    it('removes a handler from a specific pattern', async () => {
      const handler = vi.fn()
      bus.on('Contact.*', handler)

      bus.off('Contact.*', handler)
      await bus.emit(eventInput('Contact', 'c1', 'create'))
      expect(handler).not.toHaveBeenCalled()
    })

    it('removes handler from all patterns when pattern is undefined', async () => {
      const handler = vi.fn()
      bus.on('Contact.*', handler)
      bus.on('Deal.*', handler)

      bus.off(undefined, handler)
      await bus.emit(eventInput('Contact', 'c1', 'create'))
      await bus.emit(eventInput('Deal', 'd1', 'create'))
      expect(handler).not.toHaveBeenCalled()
    })

    it('off for non-registered handler is a no-op', async () => {
      const handler = vi.fn()
      // Should not throw
      bus.off('Contact.*', handler)
    })

    it('off only removes matching pattern, keeps others', async () => {
      const handler = vi.fn()
      bus.on('Contact.*', handler)
      bus.on('Deal.*', handler)

      bus.off('Contact.*', handler)
      await bus.emit(eventInput('Contact', 'c1', 'create'))
      expect(handler).not.toHaveBeenCalled()

      await bus.emit(eventInput('Deal', 'd1', 'create'))
      expect(handler).toHaveBeenCalledOnce()
    })
  })

  describe('replay', () => {
    it('replays past events to a handler', async () => {
      await bus.emit(eventInput('Contact', 'c1', 'create', { name: 'Alice' }))
      await bus.emit(eventInput('Contact', 'c2', 'create', { name: 'Bob' }))
      await bus.emit(eventInput('Deal', 'd1', 'create', { title: 'Big Deal' }))

      const events: NounEvent[] = []
      const count = await bus.replay({}, (event) => {
        events.push(event)
      })

      expect(count).toBe(3)
      expect(events.length).toBe(3)
    })

    it('replays with pattern filter', async () => {
      await bus.emit(eventInput('Contact', 'c1', 'create'))
      await bus.emit(eventInput('Deal', 'd1', 'create'))
      await bus.emit(eventInput('Contact', 'c2', 'update'))

      const events: NounEvent[] = []
      const count = await bus.replay({ pattern: 'Contact.*' }, (event) => {
        events.push(event)
      })

      expect(count).toBe(2)
      expect(events.every((e) => e.entityType === 'Contact')).toBe(true)
    })

    it('replays with entityType filter', async () => {
      await bus.emit(eventInput('Contact', 'c1', 'create'))
      await bus.emit(eventInput('Deal', 'd1', 'create'))

      const events: NounEvent[] = []
      await bus.replay({ entityType: 'Contact' }, (event) => {
        events.push(event)
      })

      expect(events.length).toBe(1)
      expect(events[0].entityType).toBe('Contact')
    })

    it('replays with limit', async () => {
      for (let i = 0; i < 10; i++) {
        await bus.emit(eventInput('Contact', `c${i}`, 'create'))
      }

      const events: NounEvent[] = []
      const count = await bus.replay({ limit: 3 }, (event) => {
        events.push(event)
      })

      expect(count).toBe(3)
      expect(events.length).toBe(3)
    })

    it('replays with verb filter', async () => {
      await bus.emit(eventInput('Contact', 'c1', 'create'))
      await bus.emit(eventInput('Contact', 'c1', 'update'))
      await bus.emit(eventInput('Contact', 'c2', 'create'))

      const events: NounEvent[] = []
      await bus.replay({ verb: 'update' }, (event) => {
        events.push(event)
      })

      expect(events.length).toBe(1)
      expect(events[0].verb).toBe('update')
    })

    it('replay on empty log returns 0', async () => {
      const handler = vi.fn()
      const count = await bus.replay({}, handler)
      expect(count).toBe(0)
      expect(handler).not.toHaveBeenCalled()
    })

    it('replay with combined pattern and entityType filter', async () => {
      await bus.emit(eventInput('Contact', 'c1', 'create'))
      await bus.emit(eventInput('Contact', 'c1', 'update'))
      await bus.emit(eventInput('Deal', 'd1', 'create'))

      const events: NounEvent[] = []
      await bus.replay({ pattern: '*.created', entityType: 'Contact' }, (event) => {
        events.push(event)
      })

      // entityType filter limits to Contact, then pattern filter limits to *.created
      expect(events.length).toBe(1)
      expect(events[0].entityType).toBe('Contact')
      expect(events[0].$type).toBe('Contact.created')
    })
  })

  describe('removeAllListeners', () => {
    it('removes all handlers', async () => {
      const h1 = vi.fn()
      const h2 = vi.fn()
      bus.on('Contact.*', h1)
      bus.on('Deal.*', h2)

      bus.removeAllListeners()

      await bus.emit(eventInput('Contact', 'c1', 'create'))
      await bus.emit(eventInput('Deal', 'd1', 'create'))
      expect(h1).not.toHaveBeenCalled()
      expect(h2).not.toHaveBeenCalled()
    })
  })

  describe('eventLog access', () => {
    it('provides access to the underlying EventLog', () => {
      expect(bus.eventLog).toBeInstanceOf(EventLog)
    })

    it('can use a shared EventLog', async () => {
      const log = new EventLog()
      const bus1 = new EventBus(log)
      const bus2 = new EventBus(log)

      const handler = vi.fn()
      bus2.on('Contact.*', handler)

      // Emitting via bus1 should notify bus2's handler (same underlying log)
      await bus1.emit(eventInput('Contact', 'c1', 'create'))
      expect(handler).toHaveBeenCalledOnce()
    })
  })
})

// =============================================================================
// EventPatterns Tests
// =============================================================================

describe('EventPatterns', () => {
  it('ALL matches everything', () => {
    expect(EventPatterns.ALL).toBe('*')
  })

  it('ALL_CREATED matches *.created', () => {
    expect(EventPatterns.ALL_CREATED).toBe('*.created')
  })

  it('ALL_UPDATED matches *.updated', () => {
    expect(EventPatterns.ALL_UPDATED).toBe('*.updated')
  })

  it('ALL_DELETED matches *.deleted', () => {
    expect(EventPatterns.ALL_DELETED).toBe('*.deleted')
  })

  it('entity() builds entity wildcard pattern', () => {
    expect(EventPatterns.entity('Contact')).toBe('Contact.*')
    expect(EventPatterns.entity('Deal')).toBe('Deal.*')
  })

  it('exact() builds exact pattern', () => {
    expect(EventPatterns.exact('Contact', 'qualified')).toBe('Contact.qualified')
    expect(EventPatterns.exact('Deal', 'closed')).toBe('Deal.closed')
  })

  it('verb() builds verb wildcard pattern', () => {
    expect(EventPatterns.verb('created')).toBe('*.created')
    expect(EventPatterns.verb('qualified')).toBe('*.qualified')
  })
})

// =============================================================================
// crudEvent Helper Tests
// =============================================================================

describe('crudEvent', () => {
  it('creates a create event input', () => {
    const input = crudEvent('create', 'Contact', 'c1', { after: { name: 'Alice' } })
    expect(input.$type).toBe('Contact.created')
    expect(input.verb).toBe('create')
    expect(input.conjugation.action).toBe('create')
    expect(input.conjugation.activity).toBe('creating')
    expect(input.conjugation.event).toBe('created')
    expect(input.after).toEqual({ name: 'Alice' })
  })

  it('creates an update event input', () => {
    const input = crudEvent('update', 'Contact', 'c1', {
      before: { stage: 'Lead' },
      after: { stage: 'Qualified' },
    })
    expect(input.$type).toBe('Contact.updated')
    expect(input.verb).toBe('update')
    expect(input.conjugation.activity).toBe('updating')
    expect(input.conjugation.event).toBe('updated')
    expect(input.before).toEqual({ stage: 'Lead' })
    expect(input.after).toEqual({ stage: 'Qualified' })
  })

  it('creates a delete event input', () => {
    const input = crudEvent('delete', 'Contact', 'c1')
    expect(input.$type).toBe('Contact.deleted')
    expect(input.verb).toBe('delete')
    expect(input.conjugation.activity).toBe('deleting')
    expect(input.conjugation.event).toBe('deleted')
  })

  it('includes actor and context when provided', () => {
    const input = crudEvent('create', 'Contact', 'c1', {
      after: { name: 'Alice' },
      actor: 'user_abc',
      context: 'https://headless.ly/~acme',
    })
    expect(input.actor).toBe('user_abc')
    expect(input.context).toBe('https://headless.ly/~acme')
  })

  it('includes data payload when provided', () => {
    const input = crudEvent('create', 'Contact', 'c1', {
      data: { source: 'import', batch: 42 },
    })
    expect(input.data).toEqual({ source: 'import', batch: 42 })
  })

  it('works with EventBus.emit', async () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('Contact.created', handler)

    const event = await bus.emit(crudEvent('create', 'Contact', 'c1', { after: { name: 'Alice' } }))
    expect(event.$id).toMatch(/^evt_/)
    expect(handler).toHaveBeenCalledOnce()
  })
})

// =============================================================================
// verbEvent Helper Tests
// =============================================================================

describe('verbEvent', () => {
  it('creates a custom verb event input', () => {
    const input = verbEvent('qualify', 'Contact', 'c1', { action: 'qualify', activity: 'qualifying', event: 'qualified' }, { after: { stage: 'Qualified' } })
    expect(input.$type).toBe('Contact.qualified')
    expect(input.verb).toBe('qualify')
    expect(input.conjugation.action).toBe('qualify')
    expect(input.conjugation.activity).toBe('qualifying')
    expect(input.conjugation.event).toBe('qualified')
    expect(input.after).toEqual({ stage: 'Qualified' })
  })

  it('creates a close verb event input', () => {
    const input = verbEvent('close', 'Deal', 'd1', { action: 'close', activity: 'closing', event: 'closed' }, { after: { status: 'won' }, data: { reason: 'Champion signed' } })
    expect(input.$type).toBe('Deal.closed')
    expect(input.verb).toBe('close')
    expect(input.data).toEqual({ reason: 'Champion signed' })
  })

  it('includes before state for verb lifecycle', () => {
    const input = verbEvent(
      'qualify',
      'Contact',
      'c1',
      { action: 'qualify', activity: 'qualifying', event: 'qualified' },
      {
        before: { stage: 'Lead' },
        after: { stage: 'Qualified' },
      },
    )
    expect(input.before).toEqual({ stage: 'Lead' })
    expect(input.after).toEqual({ stage: 'Qualified' })
  })

  it('works with EventBus.emit', async () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('Contact.qualified', handler)

    await bus.emit(verbEvent('qualify', 'Contact', 'c1', { action: 'qualify', activity: 'qualifying', event: 'qualified' }, { after: { stage: 'Qualified' } }))
    expect(handler).toHaveBeenCalledOnce()
  })
})

// =============================================================================
// EventBus + TimeTraveler Integration
// =============================================================================

describe('EventBus + TimeTraveler integration', () => {
  it('events emitted via EventBus are reconstructable via TimeTraveler', async () => {
    const { TimeTraveler } = await import('../src/time-travel')
    const bus = new EventBus()
    const traveler = new TimeTraveler(bus.eventLog)

    await bus.emit(crudEvent('create', 'Contact', 'c1', { after: { name: 'Alice', stage: 'Lead' } }))
    await bus.emit(crudEvent('update', 'Contact', 'c1', { after: { stage: 'Qualified' } }))

    const state = await traveler.asOf('Contact', 'c1', { atVersion: 1 })
    expect(state!.stage).toBe('Lead')
    expect(state!.name).toBe('Alice')

    const latest = await traveler.asOf('Contact', 'c1', {})
    expect(latest!.stage).toBe('Qualified')
  })

  it('replay can feed events into a new subscriber for catch-up', async () => {
    const bus = new EventBus()

    await bus.emit(crudEvent('create', 'Contact', 'c1', { after: { name: 'Alice' } }))
    await bus.emit(crudEvent('create', 'Contact', 'c2', { after: { name: 'Bob' } }))

    // Late subscriber catches up via replay
    const events: NounEvent[] = []
    const count = await bus.replay({ entityType: 'Contact' }, (event) => {
      events.push(event)
    })

    expect(count).toBe(2)
    expect(events[0].after!.name).toBe('Alice')
    expect(events[1].after!.name).toBe('Bob')

    // Then subscribe for future events
    const handler = vi.fn()
    bus.on('Contact.*', handler)

    await bus.emit(crudEvent('create', 'Contact', 'c3', { after: { name: 'Charlie' } }))
    expect(handler).toHaveBeenCalledOnce()
  })
})
