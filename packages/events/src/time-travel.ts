/**
 * TimeTraveler — state reconstruction from the event log
 *
 * Replays events to reconstruct entity state at any point in time.
 * Supports asOf (timestamp), atVersion (sequence), and between queries.
 * Rollback creates a NEW event — immutability is never violated.
 */

import type { NounEvent, TimeQuery } from './types.js'
import type { EventLog } from './event-log.js'

/** Reconstructed entity state (mirrors NounInstance shape) */
export interface ReconstructedState {
  $id: string
  $type: string
  $version: number
  [key: string]: unknown
}

/** Diff result between two points in time */
export interface DiffResult {
  before: ReconstructedState | null
  after: ReconstructedState | null
  events: NounEvent[]
  changes: Array<{ field: string; from: unknown; to: unknown }>
}

/** Rollback result */
export interface RollbackResult {
  rollbackEvent: NounEvent
  restoredState: ReconstructedState
}

export class TimeTraveler {
  constructor(private eventLog: EventLog) {}

  /**
   * Reconstruct entity state at a specific point in time.
   * Replays events from the beginning up to the target time/version.
   */
  async asOf(entityType: string, entityId: string, query: TimeQuery): Promise<ReconstructedState | null> {
    const allEvents = await this.eventLog.getEntityHistory(entityType, entityId)
    if (allEvents.length === 0) return null

    const filtered = this.filterEventsByQuery(allEvents, query)
    return this.replayEvents(filtered)
  }

  /**
   * Get the diff between two points in time for an entity.
   */
  async diff(entityType: string, entityId: string, from: TimeQuery, to: TimeQuery): Promise<DiffResult> {
    const allEvents = await this.eventLog.getEntityHistory(entityType, entityId)

    const fromEvents = this.filterEventsByQuery(allEvents, from)
    const toEvents = this.filterEventsByQuery(allEvents, to)

    const beforeState = this.replayEvents(fromEvents)
    const afterState = this.replayEvents(toEvents)

    // Events that happened between the two points
    const fromMaxSeq = fromEvents.length > 0 ? fromEvents[fromEvents.length - 1].sequence : 0
    const toMaxSeq = toEvents.length > 0 ? toEvents[toEvents.length - 1].sequence : 0
    const betweenEvents = allEvents.filter((e) => e.sequence > fromMaxSeq && e.sequence <= toMaxSeq)

    // Compute field-level changes
    const changes = this.computeChanges(beforeState, afterState)

    return {
      before: beforeState,
      after: afterState,
      events: betweenEvents,
      changes,
    }
  }

  /**
   * Rollback: create a new event that reverses the effect of changes since a target point.
   * Does NOT delete the original events (immutability preserved).
   */
  async rollback(entityType: string, entityId: string, toQuery: TimeQuery): Promise<RollbackResult> {
    // Reconstruct the target state
    const targetState = await this.asOf(entityType, entityId, toQuery)
    if (!targetState) {
      throw new Error(`Cannot rollback: no state found for ${entityType}/${entityId}`)
    }

    // Create a rollback event that sets state back to the target
    const rollbackEvent = await this.eventLog.append({
      $type: `${entityType}.rolledBack`,
      entityType,
      entityId,
      verb: 'rollback',
      conjugation: {
        action: 'rollback',
        activity: 'rollingBack',
        event: 'rolledBack',
      },
      after: { ...targetState },
    })

    return {
      rollbackEvent,
      restoredState: targetState,
    }
  }

  /**
   * Filter events based on a TimeQuery (asOf, atVersion, or between).
   */
  private filterEventsByQuery(events: NounEvent[], query: TimeQuery): NounEvent[] {
    if (query.atVersion !== undefined) {
      return events.filter((e) => e.sequence <= query.atVersion!)
    }

    if (query.asOf) {
      const asOfTs = typeof query.asOf === 'string' ? query.asOf : query.asOf.toISOString()
      return events.filter((e) => e.timestamp <= asOfTs)
    }

    if (query.between) {
      const startTs = typeof query.between.start === 'string' ? query.between.start : query.between.start.toISOString()
      const endTs = typeof query.between.end === 'string' ? query.between.end : query.between.end.toISOString()
      return events.filter((e) => e.timestamp >= startTs && e.timestamp <= endTs)
    }

    // No filter — return all events
    return events
  }

  /**
   * Replay events in order to reconstruct entity state.
   *
   * For each event:
   * - 'created' / 'create' → set initial state from event.after
   * - 'updated' / 'update' → merge changes from event.after
   * - 'deleted' / 'delete' → mark as deleted
   * - 'rolledBack' → replace state with event.after
   * - custom verbs → apply state changes from event.after
   */
  private replayEvents(events: NounEvent[]): ReconstructedState | null {
    if (events.length === 0) return null

    let state: ReconstructedState | null = null

    for (const event of events) {
      const verbEvent = event.conjugation.event

      if (verbEvent === 'deleted') {
        // Mark as deleted but keep state for history
        if (state) {
          state = Object.assign({}, state, { $deleted: true, $version: event.sequence })
        }
        continue
      }

      if (event.after) {
        if (!state) {
          // First event — initialize state
          state = {
            $id: event.entityId,
            $type: event.entityType,
            $version: event.sequence,
            ...event.after,
          }
        } else {
          // Subsequent event — merge after state
          state = {
            ...state,
            ...event.after,
            $id: event.entityId,
            $type: event.entityType,
            $version: event.sequence,
          }
        }
      } else if (!state) {
        // Event without after data — initialize minimal state
        state = {
          $id: event.entityId,
          $type: event.entityType,
          $version: event.sequence,
        }
      } else {
        state.$version = event.sequence
      }
    }

    return state
  }

  /**
   * Compute field-level changes between two states.
   */
  private computeChanges(
    before: ReconstructedState | null,
    after: ReconstructedState | null,
  ): Array<{ field: string; from: unknown; to: unknown }> {
    const changes: Array<{ field: string; from: unknown; to: unknown }> = []

    if (!before && !after) return changes

    // Collect all field names from both states
    const allFields = new Set<string>()
    if (before) {
      for (const key of Object.keys(before)) {
        if (!key.startsWith('$')) allFields.add(key)
      }
    }
    if (after) {
      for (const key of Object.keys(after)) {
        if (!key.startsWith('$')) allFields.add(key)
      }
    }

    for (const field of allFields) {
      const fromVal = before?.[field]
      const toVal = after?.[field]

      // Deep comparison via JSON serialization (simple but effective for plain data)
      if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
        changes.push({ field, from: fromVal, to: toVal })
      }
    }

    return changes
  }
}
