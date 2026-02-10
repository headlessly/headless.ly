import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { sync } from '../src/sync.js'
import { NDJSONEventPersistence } from '../src/ndjson-events.js'
import type { SyncProvider } from '../src/sync.js'
import type { PersistedEvent } from '../src/ndjson-events.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

function createMockProvider(): SyncProvider & { _store: Map<string, Map<string, Record<string, unknown>>> } {
  const store = new Map<string, Map<string, Record<string, unknown>>>()

  function typeStore(type: string): Map<string, Record<string, unknown>> {
    if (!store.has(type)) store.set(type, new Map())
    return store.get(type)!
  }

  return {
    _store: store,

    async find(type: string, filter?: Record<string, unknown>) {
      const ts = typeStore(type)
      const all = Array.from(ts.values())
      if (!filter) return all
      return all.filter((item) => {
        for (const [key, value] of Object.entries(filter)) {
          if (item[key] !== value) return false
        }
        return true
      })
    },

    async get(type: string, id: string) {
      return typeStore(type).get(id) ?? null
    },

    async create(type: string, data: Record<string, unknown>) {
      const id = (data.$id as string) || `${type.toLowerCase()}_${Math.random().toString(36).slice(2, 8)}`
      const instance = { $id: id, $type: type, $version: 1, ...data }
      typeStore(type).set(id, instance)
      return instance
    },

    async update(type: string, id: string, data: Record<string, unknown>) {
      const existing = typeStore(type).get(id)
      if (!existing) throw new Error(`${type} not found: ${id}`)
      const updated = { ...existing, ...data, $version: ((existing.$version as number) ?? 0) + 1 }
      typeStore(type).set(id, updated)
      return updated
    },
  }
}

function makeEvent(overrides: Partial<PersistedEvent> = {}): PersistedEvent {
  return {
    $id: `evt_${Math.random().toString(36).slice(2, 10)}`,
    $type: 'Contact.create',
    entityType: 'Contact',
    entityId: `contact_${Math.random().toString(36).slice(2, 10)}`,
    verb: 'create',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sync — bidirectional sync', () => {
  let tempDir: string
  let eventLog: NDJSONEventPersistence
  let local: ReturnType<typeof createMockProvider>
  let remote: ReturnType<typeof createMockProvider>

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'headlessly-sync-'))
    eventLog = new NDJSONEventPersistence({ path: join(tempDir, 'events.ndjson') })
    local = createMockProvider()
    remote = createMockProvider()
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // =========================================================================
  // Push: local → remote
  // =========================================================================

  describe('push direction', () => {
    it('pushes create events from local event log to remote', async () => {
      const afterState = { $id: 'contact_abc', $type: 'Contact', name: 'Alice', stage: 'Lead' }
      await eventLog.append(
        makeEvent({
          entityType: 'Contact',
          entityId: 'contact_abc',
          verb: 'create',
          after: afterState,
        }),
      )

      const result = await sync({
        local,
        remote,
        eventLog,
        types: ['Contact'],
        direction: 'push',
      })

      expect(result.pushed).toBe(1)
      const remoteContact = await remote.get('Contact', 'contact_abc')
      expect(remoteContact).not.toBeNull()
      expect((remoteContact as Record<string, unknown>).name).toBe('Alice')
    })

    it('pushes update events to remote', async () => {
      // First, create the entity on remote
      await remote.create('Contact', { $id: 'contact_abc', name: 'Alice', stage: 'Lead' })

      await eventLog.append(
        makeEvent({
          entityType: 'Contact',
          entityId: 'contact_abc',
          verb: 'update',
          data: { stage: 'Customer' },
        }),
      )

      const result = await sync({
        local,
        remote,
        eventLog,
        types: ['Contact'],
        direction: 'push',
      })

      expect(result.pushed).toBe(1)
      const remoteContact = await remote.get('Contact', 'contact_abc')
      expect((remoteContact as Record<string, unknown>).stage).toBe('Customer')
    })

    it('uses since cursor to only push recent events', async () => {
      await eventLog.append(
        makeEvent({
          entityType: 'Contact',
          entityId: 'contact_old',
          verb: 'create',
          timestamp: '2024-01-01T00:00:00.000Z',
          after: { $id: 'contact_old', name: 'Old' },
        }),
      )
      await eventLog.append(
        makeEvent({
          entityType: 'Contact',
          entityId: 'contact_new',
          verb: 'create',
          timestamp: '2024-06-01T00:00:00.000Z',
          after: { $id: 'contact_new', name: 'New' },
        }),
      )

      const result = await sync({
        local,
        remote,
        eventLog,
        types: ['Contact'],
        direction: 'push',
        since: '2024-03-01T00:00:00.000Z',
      })

      expect(result.pushed).toBe(1)
      const remoteNew = await remote.get('Contact', 'contact_new')
      expect(remoteNew).not.toBeNull()
      const remoteOld = await remote.get('Contact', 'contact_old')
      expect(remoteOld).toBeNull()
    })
  })

  // =========================================================================
  // Pull: remote → local
  // =========================================================================

  describe('pull direction', () => {
    it('pulls entities from remote to local', async () => {
      await remote.create('Contact', { $id: 'contact_remote', name: 'Bob', stage: 'Customer' })

      const result = await sync({
        local,
        remote,
        types: ['Contact'],
        direction: 'pull',
      })

      expect(result.pulled).toBe(1)
      const localContact = await local.get('Contact', 'contact_remote')
      expect(localContact).not.toBeNull()
      expect((localContact as Record<string, unknown>).name).toBe('Bob')
    })

    it('updates local entity when remote has higher version', async () => {
      await local.create('Contact', { $id: 'contact_shared', name: 'Alice', $version: 1 })
      await remote.create('Contact', { $id: 'contact_shared', name: 'Alice Updated', $version: 3 })

      const result = await sync({
        local,
        remote,
        types: ['Contact'],
        direction: 'pull',
        conflictResolution: 'remote-wins',
      })

      expect(result.pulled).toBe(1)
      const localContact = await local.get('Contact', 'contact_shared')
      expect((localContact as Record<string, unknown>).name).toBe('Alice Updated')
    })

    it('records conflict when local-wins and remote has higher version', async () => {
      await local.create('Contact', { $id: 'contact_shared', name: 'Local Alice', $version: 1 })
      await remote.create('Contact', { $id: 'contact_shared', name: 'Remote Alice', $version: 3 })

      const result = await sync({
        local,
        remote,
        types: ['Contact'],
        direction: 'pull',
        conflictResolution: 'local-wins',
      })

      expect(result.conflicts).toBe(1)
      expect(result.conflictIds).toContain('contact_shared')
      // Local entity should not be overwritten
      const localContact = await local.get('Contact', 'contact_shared')
      expect((localContact as Record<string, unknown>).name).toBe('Local Alice')
    })

    it('does not update when versions are equal', async () => {
      await local.create('Contact', { $id: 'contact_same', name: 'Same', $version: 2 })
      await remote.create('Contact', { $id: 'contact_same', name: 'Same Remote', $version: 2 })

      const result = await sync({
        local,
        remote,
        types: ['Contact'],
        direction: 'pull',
      })

      expect(result.pulled).toBe(0)
      expect(result.conflicts).toBe(0)
    })
  })

  // =========================================================================
  // Both directions
  // =========================================================================

  describe('both directions', () => {
    it('pushes and pulls in a single sync', async () => {
      // Local has an event to push
      await eventLog.append(
        makeEvent({
          entityType: 'Contact',
          entityId: 'contact_local',
          verb: 'create',
          after: { $id: 'contact_local', name: 'Local Alice' },
        }),
      )

      // Remote has an entity to pull
      await remote.create('Deal', { $id: 'deal_remote', title: 'Remote Deal' })

      const result = await sync({
        local,
        remote,
        eventLog,
        types: ['Contact', 'Deal'],
        direction: 'both',
      })

      expect(result.pushed).toBe(1)
      // pulled >= 1 because the Deal is pulled, and the pushed Contact may also be pulled
      expect(result.pulled).toBeGreaterThanOrEqual(1)

      const remoteContact = await remote.get('Contact', 'contact_local')
      expect(remoteContact).not.toBeNull()

      const localDeal = await local.get('Deal', 'deal_remote')
      expect(localDeal).not.toBeNull()
    })
  })

  // =========================================================================
  // SyncResult shape
  // =========================================================================

  describe('SyncResult', () => {
    it('includes syncedAt timestamp', async () => {
      const result = await sync({
        local,
        remote,
        types: ['Contact'],
      })

      expect(result.syncedAt).toBeDefined()
      expect(result.syncedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('returns zero counts when nothing to sync', async () => {
      const result = await sync({
        local,
        remote,
        types: ['Contact'],
      })

      expect(result.pushed).toBe(0)
      expect(result.pulled).toBe(0)
      expect(result.conflicts).toBe(0)
      expect(result.conflictIds).toEqual([])
    })

    it('pushed count is 0 when pull-only', async () => {
      await remote.create('Contact', { $id: 'contact_pull', name: 'Pull' })

      const result = await sync({
        local,
        remote,
        types: ['Contact'],
        direction: 'pull',
      })

      expect(result.pushed).toBe(0)
      expect(result.pulled).toBe(1)
    })

    it('pulled count is 0 when push-only', async () => {
      await eventLog.append(
        makeEvent({
          verb: 'create',
          after: { $id: 'contact_push', name: 'Push' },
        }),
      )

      const result = await sync({
        local,
        remote,
        eventLog,
        types: ['Contact'],
        direction: 'push',
      })

      expect(result.pushed).toBe(1)
      expect(result.pulled).toBe(0)
    })
  })

  // =========================================================================
  // Type filtering
  // =========================================================================

  describe('type filtering', () => {
    it('only syncs specified types', async () => {
      await remote.create('Contact', { $id: 'contact_r', name: 'Remote Contact' })
      await remote.create('Deal', { $id: 'deal_r', name: 'Remote Deal' })

      const result = await sync({
        local,
        remote,
        types: ['Contact'], // Only sync Contact, not Deal
        direction: 'pull',
      })

      expect(result.pulled).toBe(1)
      const localDeal = await local.get('Deal', 'deal_r')
      expect(localDeal).toBeNull()
    })

    it('filters push events by type', async () => {
      await eventLog.append(
        makeEvent({
          entityType: 'Contact',
          verb: 'create',
          after: { $id: 'contact_push', name: 'Push Contact' },
        }),
      )
      await eventLog.append(
        makeEvent({
          entityType: 'Deal',
          verb: 'create',
          after: { $id: 'deal_push', name: 'Push Deal' },
        }),
      )

      const result = await sync({
        local,
        remote,
        eventLog,
        types: ['Contact'], // Only push Contact events
        direction: 'push',
      })

      expect(result.pushed).toBe(1)
      const remoteDeal = await remote.get('Deal', 'deal_push')
      expect(remoteDeal).toBeNull()
    })
  })

  // =========================================================================
  // Default options
  // =========================================================================

  describe('default options', () => {
    it('defaults direction to both', async () => {
      await remote.create('Contact', { $id: 'contact_pull', name: 'Pull Me' })
      await eventLog.append(
        makeEvent({
          entityType: 'Contact',
          entityId: 'contact_push',
          verb: 'create',
          after: { $id: 'contact_push', name: 'Push Me' },
        }),
      )

      const result = await sync({
        local,
        remote,
        eventLog,
        types: ['Contact'],
      })

      // Both push and pull should have happened
      expect(result.pushed).toBeGreaterThanOrEqual(1)
      expect(result.pulled).toBeGreaterThanOrEqual(1)
    })

    it('defaults conflictResolution to remote-wins', async () => {
      await local.create('Contact', { $id: 'contact_conflict', name: 'Local', $version: 1 })
      await remote.create('Contact', { $id: 'contact_conflict', name: 'Remote', $version: 5 })

      const result = await sync({
        local,
        remote,
        types: ['Contact'],
        direction: 'pull',
        // No conflictResolution specified — should default to remote-wins
      })

      expect(result.pulled).toBe(1)
      const localContact = await local.get('Contact', 'contact_conflict')
      expect((localContact as Record<string, unknown>).name).toBe('Remote')
    })
  })
})
