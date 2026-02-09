import { describe, it, expect, beforeEach } from 'vitest'
import { EventLog } from '../src/event-log'

function eventInput(entityType: string, entityId: string, verb: string, data: Record<string, unknown> = {}) {
  return {
    $type: `${entityType}.${verb}`,
    entityType,
    entityId,
    verb,
    conjugation: { action: verb, activity: `${verb}ing`, event: `${verb}ed` },
    data,
  }
}

describe('@headlessly/events — EventLog', () => {
  let log: EventLog

  beforeEach(() => {
    log = new EventLog()
  })

  describe('append', () => {
    it('appends an event and returns it with id and sequence', async () => {
      const event = await log.append(eventInput('Contact', 'contact_abc12345', 'created', { name: 'Alice' }))
      expect(event.$id).toBeDefined()
      expect(event.$id).toMatch(/^evt_/)
      expect(event.entityType).toBe('Contact')
      expect(event.entityId).toBe('contact_abc12345')
      expect(event.verb).toBe('created')
      expect(event.sequence).toBeDefined()
      expect(typeof event.sequence).toBe('number')
    })

    it('assigns incrementing sequence numbers per entity', async () => {
      const e1 = await log.append(eventInput('Contact', 'c1', 'created'))
      const e2 = await log.append(eventInput('Contact', 'c1', 'updated'))
      expect(e2.sequence).toBeGreaterThan(e1.sequence)
    })

    it('assigns timestamp', async () => {
      const event = await log.append(eventInput('Deal', 'd1', 'created'))
      expect(event.timestamp).toBeDefined()
    })
  })

  describe('query', () => {
    it('queries by entityType', async () => {
      await log.append(eventInput('Contact', 'c1', 'created'))
      await log.append(eventInput('Deal', 'd1', 'created'))
      await log.append(eventInput('Contact', 'c2', 'created'))

      const results = await log.query({ entityType: 'Contact' })
      expect(results.length).toBe(2)
    })

    it('queries by entityId', async () => {
      await log.append(eventInput('Contact', 'c1', 'created'))
      await log.append(eventInput('Contact', 'c1', 'updated', { name: 'Bob' }))
      await log.append(eventInput('Contact', 'c2', 'created'))

      const results = await log.query({ entityId: 'c1' })
      expect(results.length).toBe(2)
    })

    it('queries by verb', async () => {
      await log.append(eventInput('Contact', 'c1', 'created'))
      await log.append(eventInput('Contact', 'c1', 'updated'))
      await log.append(eventInput('Deal', 'd1', 'created'))

      const results = await log.query({ verb: 'created' })
      expect(results.length).toBe(2)
    })

    it('returns all events when no filters provided', async () => {
      await log.append(eventInput('Contact', 'c1', 'created'))
      await log.append(eventInput('Deal', 'd1', 'created'))

      const results = await log.query({})
      expect(results.length).toBe(2)
    })
  })

  describe('subscribe', () => {
    it('calls handler when matching event is appended', async () => {
      const events: unknown[] = []
      log.subscribe('Contact.*', (event) => events.push(event))

      await log.append(eventInput('Contact', 'c1', 'created'))
      expect(events.length).toBe(1)
    })

    it('does not call handler for non-matching events', async () => {
      const events: unknown[] = []
      log.subscribe('Contact.*', (event) => events.push(event))

      await log.append(eventInput('Deal', 'd1', 'created'))
      expect(events.length).toBe(0)
    })

    it('wildcard * matches all events', async () => {
      const events: unknown[] = []
      log.subscribe('*', (event) => events.push(event))

      await log.append(eventInput('Contact', 'c1', 'created'))
      await log.append(eventInput('Deal', 'd1', 'closed'))
      expect(events.length).toBe(2)
    })

    it('returns unsubscribe function', async () => {
      const events: unknown[] = []
      const unsub = log.subscribe('*', (event) => events.push(event))

      await log.append(eventInput('Contact', 'c1', 'created'))
      expect(events.length).toBe(1)

      unsub()
      await log.append(eventInput('Contact', 'c2', 'created'))
      expect(events.length).toBe(1)
    })
  })

  describe('getEntityHistory', () => {
    it('returns all events for a specific entity', async () => {
      await log.append(eventInput('Contact', 'c1', 'created', { name: 'Alice' }))
      await log.append(eventInput('Contact', 'c1', 'updated', { name: 'Alice Smith' }))
      await log.append(eventInput('Contact', 'c2', 'created', { name: 'Bob' }))

      const history = await log.getEntityHistory('Contact', 'c1')
      expect(history.length).toBe(2)
      expect(history[0].verb).toBe('created')
      expect(history[1].verb).toBe('updated')
    })
  })

  describe('size', () => {
    it('tracks total event count', async () => {
      expect(log.size).toBe(0)
      await log.append(eventInput('Contact', 'c1', 'created'))
      expect(log.size).toBe(1)
      await log.append(eventInput('Deal', 'd1', 'created'))
      expect(log.size).toBe(2)
    })
  })
})
