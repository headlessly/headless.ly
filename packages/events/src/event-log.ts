/**
 * EventLog — the immutable append-only event log
 *
 * Events are never modified or deleted. The log is the source of truth
 * for all state reconstruction and time travel queries.
 */

import type { NounEvent, NounEventInput, CDCOptions } from './types.js'

// =============================================================================
// ID Generation
// =============================================================================

const SQID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateSqid(length = 12): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += SQID_CHARS[Math.floor(Math.random() * SQID_CHARS.length)]
  }
  return result
}

function generateEventId(): string {
  return `evt_${generateSqid()}`
}

// =============================================================================
// Pattern Matching
// =============================================================================

/**
 * Match an event type against a glob-style pattern.
 *
 * Supported patterns:
 * - '*' — matches all events
 * - 'Contact.*' — matches all Contact events
 * - '*.created' — matches all created events
 * - 'Deal.closed' — exact match
 */
export function matchesPattern(pattern: string, eventType: string): boolean {
  if (pattern === '*') return true

  const [patternEntity, patternVerb] = pattern.split('.')
  const [eventEntity, eventVerb] = eventType.split('.')

  if (patternEntity === '*') return patternVerb === eventVerb
  if (patternVerb === '*') return patternEntity === eventEntity

  return pattern === eventType
}

// =============================================================================
// EventLog
// =============================================================================

export interface EventLogOptions {
  /** Maximum events to keep in memory before flushing */
  maxBuffered?: number
}

export class EventLog {
  private events: NounEvent[] = []
  private entitySequences = new Map<string, number>()
  private subscribers = new Map<string, Set<(event: NounEvent) => void>>()

  /** Append an event (immutable — events are never modified) */
  async append(input: NounEventInput): Promise<NounEvent> {
    const entityKey = `${input.entityType}:${input.entityId}`
    const currentSeq = this.entitySequences.get(entityKey) ?? 0
    const nextSeq = currentSeq + 1

    const event: NounEvent = {
      ...input,
      $id: generateEventId(),
      timestamp: new Date().toISOString(),
      sequence: nextSeq,
    }

    this.entitySequences.set(entityKey, nextSeq)
    this.events.push(event)

    // Notify matching subscribers
    for (const [pattern, handlers] of this.subscribers) {
      if (matchesPattern(pattern, event.$type)) {
        for (const handler of handlers) {
          try {
            handler(event)
          } catch {
            // Swallow sync errors — don't break the append chain
          }
        }
      }
    }

    return event
  }

  /** Get a single event by ID */
  async get(id: string): Promise<NounEvent | null> {
    return this.events.find((e) => e.$id === id) ?? null
  }

  /** Query events with filters */
  async query(options: {
    entityType?: string
    entityId?: string
    verb?: string
    since?: string | Date
    until?: string | Date
    limit?: number
    offset?: number
  }): Promise<NounEvent[]> {
    let filtered = this.events.filter((event) => {
      if (options.entityType && event.entityType !== options.entityType) return false
      if (options.entityId && event.entityId !== options.entityId) return false
      if (options.verb && event.verb !== options.verb) return false
      if (options.since) {
        const sinceTs = typeof options.since === 'string' ? options.since : options.since.toISOString()
        if (event.timestamp < sinceTs) return false
      }
      if (options.until) {
        const untilTs = typeof options.until === 'string' ? options.until : options.until.toISOString()
        if (event.timestamp > untilTs) return false
      }
      return true
    })

    const offset = options.offset ?? 0
    const limit = options.limit ?? filtered.length
    filtered = filtered.slice(offset, offset + limit)

    return filtered
  }

  /** Subscribe to events matching a pattern. Returns unsubscribe function. */
  subscribe(pattern: string, handler: (event: NounEvent) => void): () => void {
    if (!this.subscribers.has(pattern)) {
      this.subscribers.set(pattern, new Set())
    }
    this.subscribers.get(pattern)!.add(handler)

    return () => {
      const set = this.subscribers.get(pattern)
      if (set) {
        set.delete(handler)
        if (set.size === 0) this.subscribers.delete(pattern)
      }
    }
  }

  /** CDC stream — get events since a cursor */
  async cdc(options: CDCOptions): Promise<{ events: NounEvent[]; cursor: string; hasMore: boolean }> {
    let startIndex = 0

    // Find the start position based on cursor (event ID)
    if (options.after) {
      const cursorIndex = this.events.findIndex((e) => e.$id === options.after)
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1
      }
    }

    // Find the start position based on timestamp
    if (options.since) {
      const sinceTs = typeof options.since === 'string' ? options.since : options.since.toISOString()
      const sinceIndex = this.events.findIndex((e) => e.timestamp >= sinceTs)
      if (sinceIndex >= 0) {
        startIndex = Math.max(startIndex, sinceIndex)
      }
    }

    // Apply filters
    let candidates = this.events.slice(startIndex)

    if (options.types?.length) {
      candidates = candidates.filter((e) => options.types!.includes(e.entityType))
    }

    if (options.verbs?.length) {
      candidates = candidates.filter((e) => options.verbs!.includes(e.verb))
    }

    // Apply batch size
    const batchSize = options.batchSize ?? candidates.length
    const batch = candidates.slice(0, batchSize)
    const hasMore = candidates.length > batchSize

    // The cursor is the last event ID in the batch
    const cursor = batch.length > 0 ? batch[batch.length - 1].$id : options.after ?? ''

    return { events: batch, cursor, hasMore }
  }

  /** Get all events for an entity (for state reconstruction) */
  async getEntityHistory(entityType: string, entityId: string): Promise<NounEvent[]> {
    return this.events.filter((e) => e.entityType === entityType && e.entityId === entityId)
  }

  /** Total number of events in the log */
  get size(): number {
    return this.events.length
  }
}
