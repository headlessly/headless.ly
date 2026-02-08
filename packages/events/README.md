# @headlessly/events

Immutable event system with time travel and change data capture for headless.ly Digital Objects.

## Install

```bash
npm install @headlessly/events
```

## Usage

```typescript
import { EventLog, TimeTraveler, CDCStream } from '@headlessly/events'

const log = new EventLog()

// Append events (immutable -- events are never modified or deleted)
const event = await log.append({
  $type: 'Contact.created',
  entityType: 'Contact',
  entityId: 'contact_fX9bL5',
  verb: 'create',
  conjugation: { action: 'create', activity: 'creating', event: 'created' },
  after: { name: 'Alice', stage: 'Lead' },
})

// Subscribe to events with glob patterns
const unsub = log.subscribe('Contact.*', (event) => {
  console.log('Contact event:', event.verb)
})

log.subscribe('*.created', (event) => {
  console.log('New entity:', event.entityType)
})

// Query events with filters
const events = await log.query({
  entityType: 'Contact',
  verb: 'create',
  since: '2025-01-01T00:00:00Z',
  limit: 50,
})
```

### Time Travel

```typescript
const traveler = new TimeTraveler(log)

// Reconstruct state at a point in time
const pastState = await traveler.asOf('Contact', 'contact_fX9bL5', {
  asOf: '2025-06-01T00:00:00Z',
})

// Reconstruct state at a specific version
const v3 = await traveler.asOf('Contact', 'contact_fX9bL5', {
  atVersion: 3,
})

// Diff between two points in time
const diff = await traveler.diff(
  'Contact', 'contact_fX9bL5',
  { asOf: '2025-01-01T00:00:00Z' },
  { asOf: '2025-06-01T00:00:00Z' },
)
console.log(diff.changes) // [{ field: 'stage', from: 'Lead', to: 'Customer' }]

// Rollback (creates a NEW event -- immutability preserved)
const { rollbackEvent, restoredState } = await traveler.rollback(
  'Contact', 'contact_fX9bL5',
  { atVersion: 2 },
)
```

### Change Data Capture

```typescript
const cdc = new CDCStream(log)

// Poll for changes (cursor-based)
const { events, cursor, hasMore } = await cdc.poll({
  after: 'evt_lastSeen',
  types: ['Contact', 'Deal'],
  batchSize: 100,
})

// SSE stream for real-time consumption
const stream = cdc.createSSEStream({
  types: ['Contact'],
  verbs: ['create', 'qualify'],
})
// Use stream as HTTP response body
```

## API

### `EventLog`

Immutable append-only event log.

- **`append(input)`** -- append an event, returns the complete event with ID, timestamp, and sequence
- **`get(id)`** -- get a single event by ID
- **`query(options)`** -- query events with filters (entityType, entityId, verb, since, until, limit, offset)
- **`subscribe(pattern, handler)`** -- subscribe to events matching a glob pattern (`'*'`, `'Contact.*'`, `'*.created'`). Returns unsubscribe function.
- **`cdc(options)`** -- get events since a cursor for CDC consumers
- **`getEntityHistory(type, id)`** -- get all events for an entity
- **`size`** -- total number of events

### `TimeTraveler`

State reconstruction via event replay.

- **`asOf(type, id, query)`** -- reconstruct entity state at a point in time or version
- **`diff(type, id, from, to)`** -- compute field-level diff between two points
- **`rollback(type, id, toQuery)`** -- rollback by creating a compensating event

### `CDCStream`

Change data capture for external consumers.

- **`poll(options)`** -- cursor-based polling, returns events + new cursor + hasMore flag
- **`createSSEStream(options)`** -- Server-Sent Events stream with heartbeat

### `SQLiteEventLog`

Persistent event log backed by SQLite (for Durable Objects).

### `matchesPattern(pattern, eventType)`

Glob-style pattern matching for event types.

## License

MIT
