/**
 * Core event types for the headless.ly event system
 *
 * Events are immutable records of verb executions on Digital Objects.
 * Every create, update, delete, qualify, close, etc. produces a NounEvent.
 */

/**
 * Base event shape shared across the event system.
 *
 * @headlessly/objects uses this base for its lightweight in-memory bridge.
 * @headlessly/events extends it with conjugation and sequence for the full event log.
 */
export interface NounEventBase {
  /** Unique event ID (format: evt_{sqid}) */
  $id: string
  /** Event type (format: {EntityType}.{verb}, e.g., 'Contact.qualified') */
  $type: string
  /** Entity type that emitted the event */
  entityType: string
  /** Entity ID that the event applies to */
  entityId: string
  /** The verb that was executed */
  verb: string
  /** Data payload (verb-specific data) */
  data?: Record<string, unknown>
  /** ISO timestamp */
  timestamp: string
  /** Actor who triggered the event */
  actor?: string
}

/** Immutable event emitted by verb execution (full event-sourced form) */
export interface NounEvent extends NounEventBase {
  /** Verb conjugation forms */
  conjugation: {
    action: string // 'qualify'
    activity: string // 'qualifying'
    event: string // 'qualified'
  }
  /** Entity state BEFORE the verb execution */
  before?: Record<string, unknown>
  /** Entity state AFTER the verb execution */
  after?: Record<string, unknown>
  /** Tenant context */
  context?: string
  /** Sequence number (monotonic within entity) */
  sequence: number
}

/** Input for appending an event (ID, timestamp, and sequence are auto-generated) */
export type NounEventInput = Omit<NounEvent, '$id' | 'timestamp' | 'sequence'>

/** Subscription handler */
export type EventHandler = (event: NounEvent) => void | Promise<void>

/** Subscription mode */
export type SubscriptionMode = 'code' | 'websocket' | 'webhook'

/** Subscription definition */
export interface Subscription {
  id: string
  pattern: string // e.g., 'Contact.*', '*.created', 'Deal.closed'
  mode: SubscriptionMode
  handler?: EventHandler // for 'code' mode
  endpoint?: string // for 'websocket' or 'webhook' mode
  secret?: string // for webhook HMAC signing
  active: boolean
  createdAt: string
}

/** Time travel query options */
export interface TimeQuery {
  /** Get state as of this timestamp */
  asOf?: string | Date
  /** Get state at this version number */
  atVersion?: number
  /** Get all events between two timestamps */
  between?: { start: string | Date; end: string | Date }
}

/** CDC (Change Data Capture) stream options */
export interface CDCOptions {
  /** Start from this event ID (exclusive) */
  after?: string
  /** Start from this timestamp */
  since?: string | Date
  /** Filter by entity types */
  types?: string[]
  /** Filter by verbs */
  verbs?: string[]
  /** Maximum events per batch */
  batchSize?: number
}
