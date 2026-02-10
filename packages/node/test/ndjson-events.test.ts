import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NDJSONEventPersistence } from '../src/ndjson-events.js'
import type { PersistedEvent } from '../src/ndjson-events.js'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFile } from 'node:fs/promises'

describe('NDJSONEventPersistence', () => {
  let tempDir: string
  let persistence: NDJSONEventPersistence

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'headlessly-test-'))
    persistence = new NDJSONEventPersistence({
      path: join(tempDir, 'events.ndjson'),
    })
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

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

  // =========================================================================
  // append
  // =========================================================================

  describe('append', () => {
    it('creates the file and directory if they do not exist', async () => {
      const nestedPath = join(tempDir, 'sub', 'dir', 'events.ndjson')
      const p = new NDJSONEventPersistence({ path: nestedPath })
      await p.append(makeEvent())

      expect(existsSync(nestedPath)).toBe(true)
    })

    it('appends a single event as one line of JSON', async () => {
      const event = makeEvent({ $id: 'evt_test1' })
      await persistence.append(event)

      const content = await readFile(persistence.path, 'utf-8')
      const lines = content.trim().split('\n')
      expect(lines).toHaveLength(1)
      expect(JSON.parse(lines[0]).$id).toBe('evt_test1')
    })

    it('appends multiple events as separate lines', async () => {
      await persistence.append(makeEvent({ $id: 'evt_a' }))
      await persistence.append(makeEvent({ $id: 'evt_b' }))
      await persistence.append(makeEvent({ $id: 'evt_c' }))

      const content = await readFile(persistence.path, 'utf-8')
      const lines = content.trim().split('\n')
      expect(lines).toHaveLength(3)
    })

    it('preserves all event fields', async () => {
      const event = makeEvent({
        $id: 'evt_full',
        $type: 'Deal.close',
        entityType: 'Deal',
        entityId: 'deal_k7TmPvQx',
        verb: 'close',
        data: { reason: 'Won' },
        before: { stage: 'Open' },
        after: { stage: 'Closed' },
        context: 'https://headless.ly/~acme',
      })
      await persistence.append(event)

      const events = await persistence.readAll()
      expect(events).toHaveLength(1)
      expect(events[0].$id).toBe('evt_full')
      expect(events[0].entityType).toBe('Deal')
      expect(events[0].verb).toBe('close')
      expect(events[0].data).toEqual({ reason: 'Won' })
      expect(events[0].before).toEqual({ stage: 'Open' })
      expect(events[0].after).toEqual({ stage: 'Closed' })
      expect(events[0].context).toBe('https://headless.ly/~acme')
    })
  })

  // =========================================================================
  // appendBatch
  // =========================================================================

  describe('appendBatch', () => {
    it('appends multiple events in one call', async () => {
      const events = [makeEvent({ $id: 'evt_1' }), makeEvent({ $id: 'evt_2' }), makeEvent({ $id: 'evt_3' })]
      await persistence.appendBatch(events)

      const all = await persistence.readAll()
      expect(all).toHaveLength(3)
      expect(all.map((e) => e.$id)).toEqual(['evt_1', 'evt_2', 'evt_3'])
    })

    it('does nothing for empty array', async () => {
      await persistence.appendBatch([])
      const all = await persistence.readAll()
      expect(all).toHaveLength(0)
    })

    it('works after individual appends', async () => {
      await persistence.append(makeEvent({ $id: 'evt_solo' }))
      await persistence.appendBatch([makeEvent({ $id: 'evt_batch1' }), makeEvent({ $id: 'evt_batch2' })])

      const all = await persistence.readAll()
      expect(all).toHaveLength(3)
      expect(all[0].$id).toBe('evt_solo')
    })
  })

  // =========================================================================
  // readAll
  // =========================================================================

  describe('readAll', () => {
    it('returns empty array for non-existent file', async () => {
      const p = new NDJSONEventPersistence({ path: join(tempDir, 'nonexistent.ndjson') })
      const events = await p.readAll()
      expect(events).toEqual([])
    })

    it('returns empty array for empty file', async () => {
      await persistence.clear() // creates empty file
      const events = await persistence.readAll()
      expect(events).toEqual([])
    })

    it('skips malformed lines', async () => {
      const { appendFile } = await import('node:fs/promises')
      // Write valid event, then malformed line, then valid event
      await persistence.append(makeEvent({ $id: 'evt_valid1' }))
      await appendFile(persistence.path, 'this is not json\n', 'utf-8')
      await persistence.append(makeEvent({ $id: 'evt_valid2' }))

      const events = await persistence.readAll()
      expect(events).toHaveLength(2)
      expect(events[0].$id).toBe('evt_valid1')
      expect(events[1].$id).toBe('evt_valid2')
    })

    it('reads events in order they were written', async () => {
      for (let i = 0; i < 10; i++) {
        await persistence.append(makeEvent({ $id: `evt_${i}` }))
      }

      const events = await persistence.readAll()
      expect(events).toHaveLength(10)
      for (let i = 0; i < 10; i++) {
        expect(events[i].$id).toBe(`evt_${i}`)
      }
    })
  })

  // =========================================================================
  // readSince
  // =========================================================================

  describe('readSince', () => {
    it('returns events with timestamp after the given time', async () => {
      const t1 = '2024-01-01T00:00:00.000Z'
      const t2 = '2024-06-01T00:00:00.000Z'
      const t3 = '2024-12-01T00:00:00.000Z'

      await persistence.append(makeEvent({ $id: 'evt_jan', timestamp: t1 }))
      await persistence.append(makeEvent({ $id: 'evt_jun', timestamp: t2 }))
      await persistence.append(makeEvent({ $id: 'evt_dec', timestamp: t3 }))

      const since = await persistence.readSince('2024-03-01T00:00:00.000Z')
      expect(since).toHaveLength(2)
      expect(since[0].$id).toBe('evt_jun')
      expect(since[1].$id).toBe('evt_dec')
    })

    it('returns empty array when all events are before the cursor', async () => {
      await persistence.append(makeEvent({ timestamp: '2024-01-01T00:00:00.000Z' }))
      await persistence.append(makeEvent({ timestamp: '2024-02-01T00:00:00.000Z' }))

      const since = await persistence.readSince('2025-01-01T00:00:00.000Z')
      expect(since).toEqual([])
    })

    it('returns all events when cursor is before all of them', async () => {
      await persistence.append(makeEvent({ timestamp: '2024-06-01T00:00:00.000Z' }))
      await persistence.append(makeEvent({ timestamp: '2024-07-01T00:00:00.000Z' }))

      const since = await persistence.readSince('2024-01-01T00:00:00.000Z')
      expect(since).toHaveLength(2)
    })
  })

  // =========================================================================
  // readForEntity
  // =========================================================================

  describe('readForEntity', () => {
    it('returns events for a specific entity type and ID', async () => {
      await persistence.append(makeEvent({ entityType: 'Contact', entityId: 'contact_a' }))
      await persistence.append(makeEvent({ entityType: 'Deal', entityId: 'deal_b' }))
      await persistence.append(makeEvent({ entityType: 'Contact', entityId: 'contact_a', verb: 'update' }))
      await persistence.append(makeEvent({ entityType: 'Contact', entityId: 'contact_c' }))

      const events = await persistence.readForEntity('Contact', 'contact_a')
      expect(events).toHaveLength(2)
      expect(events.every((e) => e.entityId === 'contact_a')).toBe(true)
    })

    it('returns empty array when no events match', async () => {
      await persistence.append(makeEvent({ entityType: 'Contact', entityId: 'contact_a' }))
      const events = await persistence.readForEntity('Deal', 'deal_nonexistent')
      expect(events).toEqual([])
    })
  })

  // =========================================================================
  // count
  // =========================================================================

  describe('count', () => {
    it('returns 0 for empty log', async () => {
      expect(await persistence.count()).toBe(0)
    })

    it('returns correct count after appends', async () => {
      await persistence.append(makeEvent())
      await persistence.append(makeEvent())
      await persistence.append(makeEvent())
      expect(await persistence.count()).toBe(3)
    })

    it('returns correct count after batch append', async () => {
      await persistence.appendBatch([makeEvent(), makeEvent(), makeEvent(), makeEvent(), makeEvent()])
      expect(await persistence.count()).toBe(5)
    })
  })

  // =========================================================================
  // clear
  // =========================================================================

  describe('clear', () => {
    it('removes all events', async () => {
      await persistence.append(makeEvent())
      await persistence.append(makeEvent())
      expect(await persistence.count()).toBe(2)

      await persistence.clear()
      expect(await persistence.count()).toBe(0)
    })

    it('creates the file if it does not exist', async () => {
      const p = new NDJSONEventPersistence({ path: join(tempDir, 'new-clear.ndjson') })
      await p.clear()
      expect(existsSync(join(tempDir, 'new-clear.ndjson'))).toBe(true)
    })

    it('allows appending after clear', async () => {
      await persistence.append(makeEvent({ $id: 'evt_before' }))
      await persistence.clear()
      await persistence.append(makeEvent({ $id: 'evt_after' }))

      const all = await persistence.readAll()
      expect(all).toHaveLength(1)
      expect(all[0].$id).toBe('evt_after')
    })
  })

  // =========================================================================
  // lastTimestamp
  // =========================================================================

  describe('lastTimestamp', () => {
    it('returns undefined for empty log', async () => {
      expect(await persistence.lastTimestamp()).toBeUndefined()
    })

    it('returns timestamp of the last event', async () => {
      await persistence.append(makeEvent({ timestamp: '2024-01-01T00:00:00.000Z' }))
      await persistence.append(makeEvent({ timestamp: '2024-06-15T12:00:00.000Z' }))
      await persistence.append(makeEvent({ timestamp: '2024-12-31T23:59:59.000Z' }))

      expect(await persistence.lastTimestamp()).toBe('2024-12-31T23:59:59.000Z')
    })
  })

  // =========================================================================
  // Default path
  // =========================================================================

  describe('default path', () => {
    it('defaults to .headlessly/events.ndjson', () => {
      const p = new NDJSONEventPersistence()
      expect(p.path).toBe('.headlessly/events.ndjson')
    })

    it('accepts custom path', () => {
      const p = new NDJSONEventPersistence({ path: '/tmp/custom.ndjson' })
      expect(p.path).toBe('/tmp/custom.ndjson')
    })
  })
})
