/**
 * EventBus — ergonomic pub/sub wrapper around EventLog
 *
 * Provides the classic event bus API (emit, on, once, off, replay)
 * while delegating all storage and sequencing to the underlying EventLog.
 *
 * This is the primary entry point for code-mode event handling:
 *
 * ```typescript
 * const bus = new EventBus()
 *
 * // Subscribe
 * bus.on('Contact.qualified', (event) => { ... })
 * bus.once('Deal.closed', (event) => { ... })
 *
 * // Emit
 * await bus.emit({ entityType: 'Contact', entityId: 'c1', verb: 'qualify', ... })
 *
 * // Replay past events to a new handler
 * bus.replay('Contact.*', (event) => { ... })
 * ```
 */

import type { NounEvent, NounEventInput } from './types.js'
import { EventLog, matchesPattern } from './event-log.js'

export type EventBusHandler = (event: NounEvent) => void | Promise<void>

export class EventBus {
  private log: EventLog
  private handlerMap = new Map<EventBusHandler, Array<{ pattern: string; unsub: () => void }>>()

  constructor(eventLog?: EventLog) {
    this.log = eventLog ?? new EventLog()
  }

  /** Access the underlying EventLog for advanced queries */
  get eventLog(): EventLog {
    return this.log
  }

  /**
   * Emit an event (appends to the log and notifies all subscribers).
   * Returns the full NounEvent with generated $id, timestamp, and sequence.
   */
  async emit(input: NounEventInput): Promise<NounEvent> {
    return this.log.append(input)
  }

  /**
   * Subscribe to events matching a pattern.
   * Returns an unsubscribe function.
   *
   * Patterns:
   * - '*' matches all events
   * - 'Contact.*' matches all Contact events
   * - '*.created' matches all created events
   * - 'Contact.qualified' exact match
   * - 'Contact.*,Deal.*' comma-separated OR
   * - '!Deal.*' negation
   */
  on(pattern: string, handler: EventBusHandler): () => void {
    const unsub = this.log.subscribe(pattern, handler)

    // Track the handler -> pattern+unsub mapping for off()
    if (!this.handlerMap.has(handler)) {
      this.handlerMap.set(handler, [])
    }
    this.handlerMap.get(handler)!.push({ pattern, unsub })

    return unsub
  }

  /**
   * Subscribe to the next matching event only.
   * Automatically unsubscribes after the first match.
   * Returns an unsubscribe function (to cancel before firing).
   */
  once(pattern: string, handler: EventBusHandler): () => void {
    let fired = false
    const wrappedHandler: EventBusHandler = (event) => {
      if (fired) return
      fired = true
      unsub()
      return handler(event)
    }

    const unsub = this.log.subscribe(pattern, wrappedHandler)

    // Track the original handler for off()
    if (!this.handlerMap.has(handler)) {
      this.handlerMap.set(handler, [])
    }
    this.handlerMap.get(handler)!.push({ pattern, unsub })

    return unsub
  }

  /**
   * Unsubscribe a handler from a specific pattern.
   * If pattern is omitted, removes the handler from all patterns.
   */
  off(pattern: string | undefined, handler: EventBusHandler): void {
    const entries = this.handlerMap.get(handler)
    if (!entries) return

    if (pattern) {
      // Remove entries matching this specific pattern
      const remaining: Array<{ pattern: string; unsub: () => void }> = []
      for (const entry of entries) {
        if (entry.pattern === pattern) {
          entry.unsub()
        } else {
          remaining.push(entry)
        }
      }
      if (remaining.length === 0) {
        this.handlerMap.delete(handler)
      } else {
        this.handlerMap.set(handler, remaining)
      }
    } else {
      // Remove all entries for this handler
      for (const entry of entries) {
        entry.unsub()
      }
      this.handlerMap.delete(handler)
    }
  }

  /**
   * Replay past events matching a filter to a handler.
   * Events are delivered in chronological order.
   *
   * Options:
   * - pattern: glob pattern to match event $type
   * - entityType: filter by entity type
   * - entityId: filter by entity id
   * - verb: filter by verb
   * - since: only events after this timestamp
   * - until: only events before this timestamp
   * - limit: max events to replay
   */
  async replay(
    filter: {
      pattern?: string
      entityType?: string
      entityId?: string
      verb?: string
      since?: string | Date
      until?: string | Date
      limit?: number
    },
    handler: EventBusHandler,
  ): Promise<number> {
    const events = await this.log.query({
      entityType: filter.entityType,
      entityId: filter.entityId,
      verb: filter.verb,
      since: filter.since,
      until: filter.until,
      limit: filter.limit,
    })

    let replayed = 0
    for (const event of events) {
      if (filter.pattern && !matchesPattern(filter.pattern, event.$type)) {
        continue
      }
      await handler(event)
      replayed++
    }

    return replayed
  }

  /** Total number of events in the log */
  get size(): number {
    return this.log.size
  }

  /** Remove all handlers */
  removeAllListeners(): void {
    for (const entries of this.handlerMap.values()) {
      for (const entry of entries) {
        entry.unsub()
      }
    }
    this.handlerMap.clear()
  }
}
