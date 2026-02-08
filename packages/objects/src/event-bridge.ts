/**
 * Event bridge — connects Noun verb lifecycle to the event system
 *
 * Provides a lightweight event emitter for NounProvider implementations.
 * Events follow the pattern: {EntityType}.{verb} (e.g., 'Contact.qualify').
 *
 * Uses NounEventBase from @headlessly/events as the shared event shape.
 * For full event-sourced events with conjugation and sequence, use @headlessly/events EventLog.
 */

import type { NounEventBase } from '@headlessly/events'

/**
 * Re-export NounEventBase as NounEvent for backward compatibility.
 * This is the lightweight event shape used by the in-memory bridge.
 */
export type NounEvent = NounEventBase

/**
 * Event handler function
 */
export type EventHandler = (event: NounEvent) => void | Promise<void>

/**
 * Minimal event emitter interface
 */
export interface EventEmitter {
  /** Emit an event to all matching subscribers */
  emit(event: NounEvent): Promise<void>
  /** Subscribe to events matching a pattern. Returns an unsubscribe function. */
  subscribe(pattern: string, handler: EventHandler): () => void
  /** Query past events */
  query(options: EventQueryOptions): Promise<NounEvent[]>
}

/**
 * Options for querying events
 */
export interface EventQueryOptions {
  entityType?: string
  entityId?: string
  verb?: string
  since?: string
}

/**
 * Match an event type against a glob-style pattern.
 *
 * Supported patterns:
 * - '*' — matches all events
 * - 'Contact.*' — matches all Contact events
 * - '*.create' — matches all create events
 * - 'Deal.closed' — exact match
 */
function matchesPattern(pattern: string, eventType: string): boolean {
  if (pattern === '*') return true

  const [patternEntity, patternVerb] = pattern.split('.')
  const [eventEntity, eventVerb] = eventType.split('.')

  if (patternEntity === '*') return patternVerb === eventVerb
  if (patternVerb === '*') return patternEntity === eventEntity

  return pattern === eventType
}

/**
 * Create an in-memory event bridge for local use
 *
 * Stores events in memory and dispatches to subscribers.
 * Pattern matching supports:
 * - '*' — matches all events
 * - 'Contact.*' — matches all Contact events
 * - 'Contact.qualified' — matches specific event
 * - '*.create' — matches all create events
 */
export function createEventBridge(): EventEmitter {
  const subscribers = new Map<string, Set<EventHandler>>()
  const events: NounEvent[] = []

  return {
    async emit(event: NounEvent): Promise<void> {
      events.push(event)

      for (const [pattern, handlers] of subscribers) {
        if (matchesPattern(pattern, event.$type)) {
          for (const handler of handlers) {
            try {
              await handler(event)
            } catch {
              // Swallow subscriber errors — don't break the emit chain
            }
          }
        }
      }
    },

    subscribe(pattern: string, handler: EventHandler): () => void {
      if (!subscribers.has(pattern)) {
        subscribers.set(pattern, new Set())
      }
      subscribers.get(pattern)!.add(handler)

      return () => {
        const set = subscribers.get(pattern)
        if (set) {
          set.delete(handler)
          if (set.size === 0) subscribers.delete(pattern)
        }
      }
    },

    async query(options: EventQueryOptions): Promise<NounEvent[]> {
      return events.filter((event) => {
        if (options.entityType && event.entityType !== options.entityType) return false
        if (options.entityId && event.entityId !== options.entityId) return false
        if (options.verb && event.verb !== options.verb) return false
        if (options.since && event.timestamp < options.since) return false
        return true
      })
    },
  }
}
