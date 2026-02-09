import { describe, it, expect, beforeEach } from 'vitest'
import { EventLog } from '../src/event-log'
import { TimeTraveler } from '../src/time-travel'

function eventInput(entityType: string, entityId: string, verb: string, after?: Record<string, unknown>) {
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

describe('@headlessly/events — TimeTraveler', () => {
  let log: EventLog
  let traveler: TimeTraveler

  beforeEach(() => {
    log = new EventLog()
    traveler = new TimeTraveler(log)
  })

  describe('asOf', () => {
    it('reconstructs state at a given version', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))

      const stateV1 = await traveler.asOf('Contact', 'c1', { atVersion: 1 })
      expect(stateV1).toBeDefined()
      expect(stateV1?.stage).toBe('Lead')
    })

    it('returns latest state when no version specified', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))

      const latest = await traveler.asOf('Contact', 'c1', {})
      expect(latest?.stage).toBe('Customer')
    })
  })

  describe('diff', () => {
    it('computes field-level changes between versions', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Qualified' }))

      const changes = await traveler.diff('Contact', 'c1', { atVersion: 1 }, { atVersion: 2 })
      expect(changes).toBeDefined()
      expect(changes.before?.stage).toBe('Lead')
      expect(changes.after?.stage).toBe('Qualified')
      expect(changes.changes.length).toBeGreaterThan(0)
    })
  })

  describe('rollback', () => {
    it('creates a rollback event to restore previous state', async () => {
      await log.append(eventInput('Contact', 'c1', 'create', { name: 'Alice', stage: 'Lead' }))
      await log.append(eventInput('Contact', 'c1', 'update', { stage: 'Customer' }))

      const result = await traveler.rollback('Contact', 'c1', { atVersion: 1 })
      expect(result.restoredState.stage).toBe('Lead')
      expect(result.rollbackEvent.verb).toBe('rollback')
    })
  })
})
