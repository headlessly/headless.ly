/**
 * sync — Bidirectional sync between local and remote providers
 *
 * Pulls remote changes into local storage and pushes local events to remote.
 * Uses event timestamps for cursor-based sync resolution.
 */

import type { PersistedEvent, NDJSONEventPersistence } from './ndjson-events.js'

/**
 * A provider-like interface for sync operations
 */
export interface SyncProvider {
  find(type: string, filter?: Record<string, unknown>): Promise<Array<Record<string, unknown>>>
  get(type: string, id: string): Promise<Record<string, unknown> | null>
  create(type: string, data: Record<string, unknown>): Promise<Record<string, unknown>>
  update(type: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>
}

/**
 * Options for the sync operation
 */
export interface SyncOptions {
  /** Local provider to sync from/to */
  local: SyncProvider
  /** Remote provider to sync from/to */
  remote: SyncProvider
  /** Entity types to sync (if not specified, syncs all) */
  types?: string[]
  /** NDJSON event persistence for tracking changes */
  eventLog?: NDJSONEventPersistence
  /** Sync direction: 'push' (local->remote), 'pull' (remote->local), or 'both' (default) */
  direction?: 'push' | 'pull' | 'both'
  /** Conflict resolution strategy: 'remote-wins' (default) or 'local-wins' */
  conflictResolution?: 'remote-wins' | 'local-wins'
  /** Timestamp cursor — only sync events after this time */
  since?: string
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Number of entities pushed to remote */
  pushed: number
  /** Number of entities pulled from remote */
  pulled: number
  /** Number of conflicts resolved */
  conflicts: number
  /** Entity IDs that had conflicts */
  conflictIds: string[]
  /** Timestamp of the sync (use as cursor for next sync) */
  syncedAt: string
}

/**
 * Perform a bidirectional sync between local and remote providers
 *
 * The sync process:
 * 1. Read local events since the last sync cursor
 * 2. Push local changes to remote
 * 3. Pull remote changes to local
 * 4. Resolve conflicts using the configured strategy
 *
 * @example
 * ```typescript
 * import { headlessly, sync } from '@headlessly/node'
 *
 * const ctx = headlessly({ mode: 'local' })
 * const result = await sync({
 *   local: localProvider,
 *   remote: remoteProvider,
 *   types: ['Contact', 'Deal'],
 * })
 * console.log(`Pushed: ${result.pushed}, Pulled: ${result.pulled}`)
 * ```
 */
export async function sync(options: SyncOptions): Promise<SyncResult> {
  const { local, remote, eventLog, direction = 'both', conflictResolution = 'remote-wins', since } = options

  let pushed = 0
  let pulled = 0
  let conflicts = 0
  const conflictIds: string[] = []
  const syncedAt = new Date().toISOString()
  const types = options.types ?? []

  // Push: local events → remote
  if (direction === 'push' || direction === 'both') {
    if (eventLog) {
      const events = since ? await eventLog.readSince(since) : await eventLog.readAll()

      // Filter by types if specified
      const filtered = types.length > 0 ? events.filter((e) => types.includes(e.entityType)) : events

      for (const event of filtered) {
        try {
          if (event.verb === 'create' && event.after) {
            await remote.create(event.entityType, event.after)
            pushed++
          } else if (event.verb === 'update' && event.data) {
            try {
              await remote.update(event.entityType, event.entityId, event.data)
              pushed++
            } catch {
              // Entity may not exist on remote yet — try create with after state
              if (event.after) {
                await remote.create(event.entityType, event.after)
                pushed++
              }
            }
          }
        } catch {
          // Conflict or error — record it
          conflicts++
          conflictIds.push(event.entityId)
        }
      }
    }
  }

  // Pull: remote → local
  if (direction === 'pull' || direction === 'both') {
    for (const type of types) {
      try {
        const remoteEntities = await remote.find(type)
        for (const entity of remoteEntities) {
          const id = entity.$id as string
          if (!id) continue

          try {
            const localEntity = await local.get(type, id)

            if (!localEntity) {
              // New entity from remote — create locally
              await local.create(type, entity)
              pulled++
            } else {
              // Entity exists both locally and remotely
              const localVersion = (localEntity.$version as number) ?? 0
              const remoteVersion = (entity.$version as number) ?? 0

              if (remoteVersion > localVersion) {
                if (conflictResolution === 'remote-wins') {
                  await local.update(type, id, entity)
                  pulled++
                } else {
                  conflicts++
                  conflictIds.push(id)
                }
              } else if (remoteVersion < localVersion) {
                if (conflictResolution === 'local-wins') {
                  // Local wins — skip remote
                  conflicts++
                  conflictIds.push(id)
                } else {
                  // Remote wins — overwrite local
                  await local.update(type, id, entity)
                  pulled++
                }
              }
              // Equal versions — no action needed
            }
          } catch {
            conflicts++
            conflictIds.push(id)
          }
        }
      } catch {
        // Type-level error — skip this type
      }
    }
  }

  return {
    pushed,
    pulled,
    conflicts,
    conflictIds,
    syncedAt,
  }
}
