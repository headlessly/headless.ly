/**
 * @headlessly/events — Event system with time travel for Digital Objects
 *
 * Five primitives:
 * - EventLog: Immutable append-only event log (storage + sequencing)
 * - EventBus: Ergonomic pub/sub wrapper (emit, on, once, off, replay)
 * - TimeTraveler: State reconstruction via event replay
 * - SubscriptionManager: Three-mode event subscriptions (code, websocket, webhook)
 * - CDCStream: Change Data Capture for external consumers
 *
 * @packageDocumentation
 */

// Types
export type {
  NounEventBase,
  NounEvent,
  NounEventInput,
  EventHandler,
  SubscriptionMode,
  Subscription,
  TimeQuery,
  CDCOptions,
  CrudVerb,
  CrudEvent,
} from './types.js'
export { EventPatterns, crudEvent, verbEvent } from './types.js'

// Event log
export { EventLog, matchesPattern } from './event-log.js'
export type { EventLogOptions } from './event-log.js'

// Event bus
export { EventBus } from './event-bus.js'
export type { EventBusHandler } from './event-bus.js'

// Time travel
export { TimeTraveler } from './time-travel.js'
export type { ReconstructedState, DiffResult, RollbackResult } from './time-travel.js'

// Subscriptions
export { SubscriptionManager } from './subscriptions.js'

// CDC
export { CDCStream } from './cdc.js'

// SQLite adapter
export { SQLiteEventLog } from './sqlite-adapter.js'
export type { SqlStorage, SqlStorageResult, SQLiteEventLogOptions } from './sqlite-adapter.js'
