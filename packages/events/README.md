# @headlessly/events

> Nothing is ever deleted. Every mutation is an event. Every state is reconstructable.

```typescript
import { EventLog, TimeTraveler } from '@headlessly/events'

const log = new EventLog()

// Every operation appends an immutable event
await log.append({
  $type: 'Contact.created',
  entityType: 'Contact',
  entityId: 'contact_fX9bL5nRd',
  verb: 'create',
  after: { name: 'Alice', stage: 'Lead' },
})

// Time travel: what did this contact look like three months ago?
const traveler = new TimeTraveler(log)
const pastState = await traveler.asOf('Contact', 'contact_fX9bL5nRd', {
  asOf: '2025-06-01T00:00:00Z',
})
```

This is the trust layer. No soft deletes. No `updated_at` columns. Every create, update, delete, and custom verb appends an immutable event with a full before/after snapshot. You can reconstruct any entity at any point in time, diff any two versions, and stream changes to external systems in real time.

## The Problem

Traditional databases overwrite state. When you update a contact's stage from "Lead" to "Customer", the old value is gone. When you delete a record, it's gone. You lose the "why" and the "when" and the "who."

Audit logs bolted onto mutable databases are afterthoughts — incomplete, inconsistent, and impossible to query. "What did this deal look like before the sales rep changed the value from $50k to $500k?" Good luck answering that with a `WHERE updated_at > ?` query.

Event sourcing solves this at the architecture level. The event log IS the database. Current state is just a projection.

## Immutable Event Log

Events are append-only. They're never modified, never deleted. Every event carries the full context:

```typescript
import { EventLog } from '@headlessly/events'

const log = new EventLog()

const event = await log.append({
  $type: 'Contact.qualified',
  entityType: 'Contact',
  entityId: 'contact_fX9bL5nRd',
  verb: 'qualify',
  conjugation: { action: 'qualify', activity: 'qualifying', event: 'qualified' },
  before: { name: 'Alice', stage: 'Lead', leadScore: 45 },
  after: { name: 'Alice', stage: 'Qualified', leadScore: 85 },
})
// event.$id = 'evt_k7TmPvQxW3hN', event.$version = 2, event.timestamp = ...
```

### Subscribe with Glob Patterns

React to events in real time — match by entity type, verb, or both:

```typescript
log.subscribe('Contact.*', (event) => {
  console.log('Contact event:', event.verb)
})

log.subscribe('*.created', (event) => {
  console.log('New entity:', event.entityType, event.entityId)
})

log.subscribe('Deal.closed', (event) => {
  console.log('Deal closed:', event.after.value)
})
```

### Query Events

```typescript
const events = await log.query({
  entityType: 'Contact',
  verb: 'qualify',
  since: '2025-01-01T00:00:00Z',
  until: '2025-12-31T23:59:59Z',
  limit: 50,
})

const history = await log.getEntityHistory('Contact', 'contact_fX9bL5nRd')
// Every event that ever touched this contact, in order
```

## Time Travel

Reconstruct any entity at any point in time — by timestamp or by version number:

```typescript
import { TimeTraveler } from '@headlessly/events'

const traveler = new TimeTraveler(log)

// What did this contact look like on June 1st?
const pastState = await traveler.asOf('Contact', 'contact_fX9bL5nRd', {
  asOf: '2025-06-01T00:00:00Z',
})

// What did version 3 look like?
const v3 = await traveler.asOf('Contact', 'contact_fX9bL5nRd', {
  atVersion: 3,
})
```

### Field-Level Diffs

See exactly what changed between any two points:

```typescript
const diff = await traveler.diff(
  'Contact',
  'contact_fX9bL5nRd',
  { asOf: '2025-01-01T00:00:00Z' },
  { asOf: '2025-06-01T00:00:00Z' },
)
console.log(diff.changes)
// [{ field: 'stage', from: 'Lead', to: 'Customer' },
//  { field: 'leadScore', from: 45, to: 92 }]
```

### Rollback (Immutably)

Rollback doesn't rewrite history — it creates a new event that restores a previous state:

```typescript
const { rollbackEvent, restoredState } = await traveler.rollback(
  'Contact',
  'contact_fX9bL5nRd',
  { atVersion: 2 },
)
// rollbackEvent.$type = 'Contact.rolledBack'
// The event log now has v1, v2, v3, v4 (rollback to v2 state)
```

## Change Data Capture

Stream changes to external systems — data warehouses, analytics pipelines, search indices:

```typescript
import { CDCStream } from '@headlessly/events'

const cdc = new CDCStream(log)

// Cursor-based polling
const { events, cursor, hasMore } = await cdc.poll({
  after: 'evt_lastSeen',
  types: ['Contact', 'Deal'],
  batchSize: 100,
})

// Process events, store new cursor, poll again
```

### Server-Sent Events

Real-time streaming for consumers that need instant notification:

```typescript
const stream = cdc.createSSEStream({
  types: ['Contact'],
  verbs: ['create', 'qualify'],
})
// Use as HTTP response body for real-time CDC consumers
```

## Install

```bash
npm install @headlessly/events
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
- **`rollback(type, id, toQuery)`** -- rollback by creating a compensating event (immutability preserved)

### `CDCStream`

Change data capture for external consumers.

- **`poll(options)`** -- cursor-based polling, returns events + new cursor + hasMore flag
- **`createSSEStream(options)`** -- Server-Sent Events stream with heartbeat

### `SQLiteEventLog`

Persistent event log backed by SQLite (for Durable Objects). Same interface as `EventLog`, durable storage.

### `matchesPattern(pattern, eventType)`

Glob-style pattern matching for event types. Supports `*` wildcard for either segment: `'Contact.*'`, `'*.created'`, `'*'`.

## License

MIT
