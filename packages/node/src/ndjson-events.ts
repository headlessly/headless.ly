/**
 * NDJSONEventPersistence — File-based event persistence
 *
 * Appends NounEvents to an NDJSON (newline-delimited JSON) file.
 * Each line is a complete JSON object representing one event.
 * Supports reading events back for replay or sync.
 */

import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Lightweight event record for NDJSON persistence
 */
export interface PersistedEvent {
  $id: string
  $type: string
  entityType: string
  entityId: string
  verb: string
  data?: Record<string, unknown>
  timestamp: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  context?: string
}

/**
 * Options for creating an NDJSONEventPersistence
 */
export interface NDJSONEventPersistenceOptions {
  /** Path to the NDJSON file (default: .headlessly/events.ndjson) */
  path?: string
}

/**
 * NDJSONEventPersistence — Append-only file-based event log
 *
 * Events are written as newline-delimited JSON. This enables:
 * - Simple event sourcing for local development
 * - Replay events for state reconstruction
 * - Export events for sync with remote
 */
export class NDJSONEventPersistence {
  readonly path: string
  private _initialized = false

  constructor(options: NDJSONEventPersistenceOptions = {}) {
    this.path = options.path ?? '.headlessly/events.ndjson'
  }

  /**
   * Ensure the directory and file exist
   */
  private ensureDir(): void {
    if (this._initialized) return
    const dir = dirname(this.path)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    if (!existsSync(this.path)) {
      // Create empty file synchronously on first access
      const { writeFileSync } = require('node:fs') as typeof import('node:fs')
      writeFileSync(this.path, '', 'utf-8')
    }
    this._initialized = true
  }

  /**
   * Append a single event to the NDJSON file
   */
  async append(event: PersistedEvent): Promise<void> {
    this.ensureDir()
    const line = JSON.stringify(event) + '\n'
    await appendFile(this.path, line, 'utf-8')
  }

  /**
   * Append multiple events to the NDJSON file
   */
  async appendBatch(events: PersistedEvent[]): Promise<void> {
    if (events.length === 0) return
    this.ensureDir()
    const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n'
    await appendFile(this.path, lines, 'utf-8')
  }

  /**
   * Read all events from the NDJSON file
   */
  async readAll(): Promise<PersistedEvent[]> {
    if (!existsSync(this.path)) return []
    const content = await readFile(this.path, 'utf-8')
    const events: PersistedEvent[] = []
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        events.push(JSON.parse(trimmed) as PersistedEvent)
      } catch {
        // Skip malformed lines
      }
    }
    return events
  }

  /**
   * Read events since a given timestamp
   */
  async readSince(since: string): Promise<PersistedEvent[]> {
    const all = await this.readAll()
    return all.filter((e) => e.timestamp > since)
  }

  /**
   * Read events for a specific entity
   */
  async readForEntity(entityType: string, entityId: string): Promise<PersistedEvent[]> {
    const all = await this.readAll()
    return all.filter((e) => e.entityType === entityType && e.entityId === entityId)
  }

  /**
   * Get the count of persisted events
   */
  async count(): Promise<number> {
    const all = await this.readAll()
    return all.length
  }

  /**
   * Clear all events (truncate the file)
   */
  async clear(): Promise<void> {
    this.ensureDir()
    await writeFile(this.path, '', 'utf-8')
  }

  /**
   * Get the timestamp of the last persisted event, or undefined if empty
   */
  async lastTimestamp(): Promise<string | undefined> {
    const all = await this.readAll()
    if (all.length === 0) return undefined
    return all[all.length - 1].timestamp
  }
}
