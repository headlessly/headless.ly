/**
 * SQLiteEventLog — adapter that bridges SQLite storage to the EventLog interface
 *
 * Provides persistent event storage using Cloudflare Durable Object SQLite (SqlStorage).
 * Implements the same query/append/cdc/getEntityHistory contract as the in-memory EventLog
 * but backed by SQLite tables.
 *
 * The events table schema matches ObjectsDO's existing `events` table with additional
 * columns for the full NounEvent shape (sequence, conjugation, before/after state).
 */

import type { NounEvent, NounEventInput, CDCOptions } from './types.js'
import { matchesPattern } from './event-log.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Minimal SqlStorage interface matching Cloudflare Durable Object SQLite.
 * This avoids a hard dependency on @cloudflare/workers-types.
 */
export interface SqlStorage {
  exec(query: string, ...bindings: unknown[]): SqlStorageResult
}

export interface SqlStorageResult {
  toArray(): Record<string, unknown>[]
}

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
// SQLiteEventLog
// =============================================================================

export interface SQLiteEventLogOptions {
  /** Table name for events (defaults to 'event_log') */
  tableName?: string
}

export class SQLiteEventLog {
  private sql: SqlStorage
  private tableName: string
  private subscribers = new Map<string, Set<(event: NounEvent) => void>>()

  constructor(sql: SqlStorage, options?: SQLiteEventLogOptions) {
    this.sql = sql
    this.tableName = options?.tableName ?? 'event_log'
    this.initSchema()
  }

  /**
   * Initialize the event_log table with full NounEvent schema.
   * Safe to call multiple times (CREATE IF NOT EXISTS).
   */
  private initSchema(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        verb TEXT NOT NULL,
        conjugation_action TEXT NOT NULL,
        conjugation_activity TEXT NOT NULL,
        conjugation_event TEXT NOT NULL,
        data TEXT,
        before_state TEXT,
        after_state TEXT,
        context TEXT,
        actor TEXT,
        sequence INTEGER NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_entity ON ${this.tableName}(entity_type, entity_id)`)
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_timestamp ON ${this.tableName}(timestamp)`)
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_verb ON ${this.tableName}(verb)`)
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_type ON ${this.tableName}(type)`)
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_${this.tableName}_sequence ON ${this.tableName}(entity_type, entity_id, sequence)`)
  }

  /**
   * Append an event to the log. Auto-generates $id, timestamp, and sequence.
   * Returns the full NounEvent with generated fields.
   */
  append(input: NounEventInput): NounEvent {
    const id = generateEventId()
    const now = new Date().toISOString()

    // Compute next sequence for this entity
    const entityKey = `${input.entityType}:${input.entityId}`
    const seqRow = this.sql
      .exec(`SELECT MAX(sequence) as max_seq FROM ${this.tableName} WHERE entity_type = ? AND entity_id = ?`, input.entityType, input.entityId)
      .toArray()[0]
    const currentSeq = (seqRow?.max_seq as number) ?? 0
    const nextSeq = currentSeq + 1

    const event: NounEvent = {
      ...input,
      $id: id,
      timestamp: now,
      sequence: nextSeq,
    }

    this.sql.exec(
      `INSERT INTO ${this.tableName} (id, type, entity_type, entity_id, verb, conjugation_action, conjugation_activity, conjugation_event, data, before_state, after_state, context, actor, sequence, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      event.$type,
      event.entityType,
      event.entityId,
      event.verb,
      event.conjugation.action,
      event.conjugation.activity,
      event.conjugation.event,
      event.data ? JSON.stringify(event.data) : null,
      event.before ? JSON.stringify(event.before) : null,
      event.after ? JSON.stringify(event.after) : null,
      event.context ?? null,
      event.actor ?? null,
      nextSeq,
      now,
    )

    // Notify matching subscribers
    this.notifySubscribers(event)

    return event
  }

  /**
   * Get a single event by ID.
   */
  get(id: string): NounEvent | null {
    const rows = this.sql.exec(`SELECT * FROM ${this.tableName} WHERE id = ?`, id).toArray()
    if (rows.length === 0) return null
    return this.rowToEvent(rows[0])
  }

  /**
   * Query events with filters.
   */
  query(options: {
    entityType?: string
    entityId?: string
    verb?: string
    since?: string | Date
    until?: string | Date
    limit?: number
    offset?: number
  }): NounEvent[] {
    let sql = `SELECT * FROM ${this.tableName}`
    const conditions: string[] = []
    const values: (string | number)[] = []

    if (options.entityType) {
      conditions.push('entity_type = ?')
      values.push(options.entityType)
    }
    if (options.entityId) {
      conditions.push('entity_id = ?')
      values.push(options.entityId)
    }
    if (options.verb) {
      conditions.push('verb = ?')
      values.push(options.verb)
    }
    if (options.since) {
      const sinceTs = typeof options.since === 'string' ? options.since : options.since.toISOString()
      conditions.push('timestamp >= ?')
      values.push(sinceTs)
    }
    if (options.until) {
      const untilTs = typeof options.until === 'string' ? options.until : options.until.toISOString()
      conditions.push('timestamp <= ?')
      values.push(untilTs)
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' ORDER BY timestamp ASC, sequence ASC'

    const offset = options.offset ?? 0
    const limit = options.limit ?? 1000
    sql += ` LIMIT ? OFFSET ?`
    values.push(limit, offset)

    const rows = this.sql.exec(sql, ...values).toArray()
    return rows.map((r) => this.rowToEvent(r))
  }

  /**
   * Get all events for a specific entity, ordered by sequence.
   * Used by TimeTraveler for state reconstruction.
   */
  getEntityHistory(entityType: string, entityId: string): NounEvent[] {
    const rows = this.sql
      .exec(`SELECT * FROM ${this.tableName} WHERE entity_type = ? AND entity_id = ? ORDER BY sequence ASC`, entityType, entityId)
      .toArray()
    return rows.map((r) => this.rowToEvent(r))
  }

  /**
   * CDC stream — get events since a cursor (event ID) with optional filters.
   * Returns events + new cursor + hasMore flag for polling consumers.
   */
  cdc(options: CDCOptions): { events: NounEvent[]; cursor: string; hasMore: boolean } {
    let sql = `SELECT * FROM ${this.tableName}`
    const conditions: string[] = []
    const values: (string | number)[] = []

    // Position cursor after the given event
    if (options.after) {
      const cursorRow = this.sql.exec(`SELECT timestamp, sequence FROM ${this.tableName} WHERE id = ?`, options.after).toArray()[0]
      if (cursorRow) {
        conditions.push('(timestamp > ? OR (timestamp = ? AND id > ?))')
        values.push(cursorRow.timestamp as string, cursorRow.timestamp as string, options.after)
      }
    }

    // Position from timestamp
    if (options.since) {
      const sinceTs = typeof options.since === 'string' ? options.since : options.since.toISOString()
      conditions.push('timestamp >= ?')
      values.push(sinceTs)
    }

    // Type filter
    if (options.types?.length) {
      const placeholders = options.types.map(() => '?').join(', ')
      conditions.push(`entity_type IN (${placeholders})`)
      values.push(...options.types)
    }

    // Verb filter
    if (options.verbs?.length) {
      const placeholders = options.verbs.map(() => '?').join(', ')
      conditions.push(`verb IN (${placeholders})`)
      values.push(...options.verbs)
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' ORDER BY timestamp ASC, id ASC'

    const batchSize = options.batchSize ?? 100
    // Fetch one extra to determine hasMore
    sql += ` LIMIT ?`
    values.push(batchSize + 1)

    const rows = this.sql.exec(sql, ...values).toArray()
    const hasMore = rows.length > batchSize
    const batch = hasMore ? rows.slice(0, batchSize) : rows
    const events = batch.map((r) => this.rowToEvent(r))

    const cursor = events.length > 0 ? events[events.length - 1].$id : options.after ?? ''

    return { events, cursor, hasMore }
  }

  /**
   * Subscribe to events matching a pattern. Returns unsubscribe function.
   * Subscriptions are notified synchronously on append.
   */
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

  /**
   * Total number of events in the log.
   */
  get size(): number {
    const row = this.sql.exec(`SELECT COUNT(*) as cnt FROM ${this.tableName}`).toArray()[0]
    return (row?.cnt as number) ?? 0
  }

  // ===========================================================================
  // Internal
  // ===========================================================================

  private rowToEvent(row: Record<string, unknown>): NounEvent {
    return {
      $id: row.id as string,
      $type: row.type as string,
      entityType: row.entity_type as string,
      entityId: row.entity_id as string,
      verb: row.verb as string,
      conjugation: {
        action: row.conjugation_action as string,
        activity: row.conjugation_activity as string,
        event: row.conjugation_event as string,
      },
      data: row.data ? JSON.parse(row.data as string) : undefined,
      before: row.before_state ? JSON.parse(row.before_state as string) : undefined,
      after: row.after_state ? JSON.parse(row.after_state as string) : undefined,
      context: (row.context as string) ?? undefined,
      actor: (row.actor as string) ?? undefined,
      sequence: row.sequence as number,
      timestamp: row.timestamp as string,
    }
  }

  private notifySubscribers(event: NounEvent): void {
    for (const [pattern, handlers] of this.subscribers) {
      if (matchesPattern(pattern, event.$type)) {
        for (const handler of handlers) {
          try {
            handler(event)
          } catch {
            // Swallow sync errors
          }
        }
      }
    }
  }
}
