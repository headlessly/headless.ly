/**
 * LocalNounProvider — NounProvider backed by in-process storage
 *
 * Wraps a simple Map-based store for local development and testing
 * without requiring a running Durable Object worker. Generates proper
 * {type}_{sqid} IDs, manages $version/$createdAt/$updatedAt meta-fields,
 * and emits events to an optional listener.
 *
 * Supports two event emission modes:
 * - Lightweight: via EventEmitter (event-bridge) for simple in-memory use
 * - Full: via @headlessly/events EventLog for event-sourced operations
 *   with conjugation, before/after state, sequence tracking, and time travel
 */

import type { NounProvider, NounInstance } from 'digital-objects'
import type { EventEmitter, NounEvent } from './event-bridge.js'
import { generateEntityId, generateEventId } from './id.js'
import { conjugateVerb } from './conjugation.js'

// Conditionally import EventLog type — avoid hard coupling
import type { EventLog, NounEventInput } from '@headlessly/events'

// =============================================================================
// MongoDB-style filter matching
// =============================================================================

/**
 * Check if an operator object contains MongoDB-style query operators.
 * Operator keys start with '$' (e.g. $gt, $gte, $lt, $lte, $in, $nin, $exists, $regex).
 */
function isOperatorObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).some((k) => k.startsWith('$'))
}

/**
 * Match a single field value against a filter value.
 * Supports both exact equality and MongoDB-style operators:
 * $gt, $gte, $lt, $lte, $in, $nin, $exists, $regex, $eq, $ne
 */
function matchFilterValue(fieldValue: unknown, filterValue: unknown): boolean {
  if (isOperatorObject(filterValue)) {
    for (const [op, opVal] of Object.entries(filterValue)) {
      switch (op) {
        case '$eq':
          if (fieldValue !== opVal) return false
          break
        case '$ne':
          if (fieldValue === opVal) return false
          break
        case '$gt':
          if (typeof fieldValue !== 'number' || typeof opVal !== 'number' || fieldValue <= opVal) return false
          break
        case '$gte':
          if (typeof fieldValue !== 'number' || typeof opVal !== 'number' || fieldValue < opVal) return false
          break
        case '$lt':
          if (typeof fieldValue !== 'number' || typeof opVal !== 'number' || fieldValue >= opVal) return false
          break
        case '$lte':
          if (typeof fieldValue !== 'number' || typeof opVal !== 'number' || fieldValue > opVal) return false
          break
        case '$in':
          if (!Array.isArray(opVal) || !opVal.includes(fieldValue)) return false
          break
        case '$nin':
          if (!Array.isArray(opVal) || opVal.includes(fieldValue)) return false
          break
        case '$exists':
          if (opVal && fieldValue === undefined) return false
          if (!opVal && fieldValue !== undefined) return false
          break
        case '$regex': {
          const re = opVal instanceof RegExp ? opVal : new RegExp(opVal as string)
          if (typeof fieldValue !== 'string' || !re.test(fieldValue)) return false
          break
        }
        default:
          return false
      }
    }
    return true
  }
  return fieldValue === filterValue
}

// =============================================================================
// Tenant Context
// =============================================================================

function getDefaultContext(): string {
  const tenant = (typeof process !== 'undefined' && process.env?.['HEADLESSLY_TENANT']) || 'default'
  return `https://headless.ly/~${tenant}`
}

// =============================================================================
// Options
// =============================================================================

/**
 * Options for creating a LocalNounProvider
 */
export interface LocalNounProviderOptions {
  /** Tenant context URL (defaults to 'https://headless.ly/~{HEADLESSLY_TENANT || default}') */
  context?: string
  /** Optional event emitter for verb lifecycle events (lightweight mode) */
  events?: EventEmitter
  /** Optional EventLog for full event-sourced operations with time travel */
  eventLog?: EventLog
}

// =============================================================================
// LocalNounProvider
// =============================================================================

/**
 * LocalNounProvider — in-process NounProvider with event emission
 *
 * This provider stores entities in a Map (like MemoryNounProvider) but
 * additionally supports event emission and verb execution with state transitions.
 * Useful for local development, testing, and environments where a DO worker is
 * not available.
 *
 * When an EventLog is provided, full NounEvents with conjugation, before/after
 * state, and sequence tracking are emitted — enabling time travel and CDC.
 */
export class LocalNounProvider implements NounProvider {
  private store = new Map<string, NounInstance>()
  private context: string
  private events?: EventEmitter
  private eventLog?: EventLog

  constructor(options: LocalNounProviderOptions = {}) {
    this.context = options.context ?? getDefaultContext()
    this.events = options.events
    this.eventLog = options.eventLog
  }

  async create(type: string, data: Record<string, unknown>): Promise<NounInstance> {
    const now = new Date().toISOString()
    const instance: NounInstance = {
      $id: generateEntityId(type),
      $type: type,
      $context: this.context,
      $version: 1,
      $createdAt: now,
      $updatedAt: now,
      ...data,
    }
    this.store.set(instance.$id, instance)

    await this.emitEvent(type, 'create', instance.$id, data, null, { ...instance })

    return instance
  }

  async get(type: string, id: string): Promise<NounInstance | null> {
    const instance = this.store.get(id)
    if (!instance || instance.$type !== type) return null
    return instance
  }

  async find(type: string, where?: Record<string, unknown>): Promise<NounInstance[]> {
    const results: NounInstance[] = []
    for (const instance of this.store.values()) {
      if (instance.$type !== type) continue
      if (instance.$context !== this.context) continue
      if (where) {
        let match = true
        for (const [key, value] of Object.entries(where)) {
          if (!matchFilterValue(instance[key], value)) {
            match = false
            break
          }
        }
        if (!match) continue
      }
      results.push(instance)
    }
    return results
  }

  async update(type: string, id: string, data: Record<string, unknown>): Promise<NounInstance> {
    const existing = this.store.get(id)
    if (!existing || existing.$type !== type) {
      throw new Error(`${type} not found: ${id}`)
    }

    const before = { ...existing }

    const updated: NounInstance = {
      ...existing,
      ...data,
      $id: existing.$id,
      $type: existing.$type,
      $context: existing.$context,
      $version: existing.$version + 1,
      $createdAt: existing.$createdAt,
      $updatedAt: new Date().toISOString(),
    }
    this.store.set(id, updated)

    await this.emitEvent(type, 'update', id, data, before, { ...updated })

    return updated
  }

  async delete(type: string, id: string): Promise<boolean> {
    const existing = this.store.get(id)
    if (!existing || existing.$type !== type) return false

    const before = { ...existing }
    const deleted = this.store.delete(id)
    if (deleted) {
      await this.emitEvent(type, 'delete', id, undefined, before, null)
    }
    return deleted
  }

  async perform(type: string, verb: string, id: string, data?: Record<string, unknown>): Promise<NounInstance> {
    const existing = this.store.get(id)
    if (!existing || existing.$type !== type) {
      throw new Error(`${type} not found: ${id}`)
    }

    const before = { ...existing }

    // Apply data changes if provided
    let updated: NounInstance
    if (data) {
      updated = {
        ...existing,
        ...data,
        $id: existing.$id,
        $type: existing.$type,
        $context: existing.$context,
        $version: existing.$version + 1,
        $createdAt: existing.$createdAt,
        $updatedAt: new Date().toISOString(),
      }
      this.store.set(id, updated)
    } else {
      updated = existing
    }

    await this.emitEvent(type, verb, id, data, before, { ...updated })

    return updated
  }

  /**
   * Count entities of a given type
   */
  async count(type: string): Promise<number> {
    let count = 0
    for (const instance of this.store.values()) {
      if (instance.$type === type && instance.$context === this.context) {
        count++
      }
    }
    return count
  }

  /**
   * Find the first entity matching the filter, or null if none match
   */
  async findOne(type: string, where?: Record<string, unknown>): Promise<NounInstance | null> {
    for (const instance of this.store.values()) {
      if (instance.$type !== type) continue
      if (instance.$context !== this.context) continue
      if (where) {
        let match = true
        for (const [key, value] of Object.entries(where)) {
          if (!matchFilterValue(instance[key], value)) {
            match = false
            break
          }
        }
        if (!match) continue
      }
      return instance
    }
    return null
  }

  async rollback(type: string, id: string, toVersion: number): Promise<NounInstance> {
    // LocalNounProvider doesn't maintain event history, so rollback is not supported
    // in lightweight mode. If an EventLog is attached, delegate to it.
    throw new Error(`rollback not supported in LocalNounProvider without event history. Entity: ${type}/${id}, target version: ${toVersion}`)
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.store.clear()
  }

  /**
   * Get the total number of stored entities (for testing/debugging)
   */
  get size(): number {
    return this.store.size
  }

  // =========================================================================
  // Internal
  // =========================================================================

  private async emitEvent(
    entityType: string,
    verb: string,
    entityId: string,
    data?: Record<string, unknown>,
    beforeState?: Record<string, unknown> | null,
    afterState?: Record<string, unknown> | null,
  ): Promise<void> {
    // Emit to EventLog if provided (full NounEvent with conjugation + sequence)
    if (this.eventLog) {
      const conj = conjugateVerb(verb)
      const input: NounEventInput = {
        $type: `${entityType}.${verb}`,
        entityType,
        entityId,
        verb,
        conjugation: conj,
        data,
        before: beforeState ?? undefined,
        after: afterState ?? undefined,
        context: this.context,
      }
      await this.eventLog.append(input)
    }

    // Also emit to lightweight event bridge if provided
    if (this.events) {
      const event: NounEvent = {
        $id: generateEventId(),
        $type: `${entityType}.${verb}`,
        entityType,
        entityId,
        verb,
        data,
        timestamp: new Date().toISOString(),
      }
      await this.events.emit(event)
    }
  }
}
