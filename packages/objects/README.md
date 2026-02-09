# @headlessly/objects

> The bridge between your schema and the edge. Noun() to Durable Object in one line.

```typescript
import { DONounProvider } from '@headlessly/objects'
import { Contact, Deal } from 'digital-objects'
import { setProvider } from 'digital-objects'

const provider = new DONounProvider({
  endpoint: 'https://db.headless.ly/~acme',
  apiKey: 'key_...',
})
setProvider(provider)

// Now every Noun() just works — backed by Durable Objects at the edge
await Contact.create({ name: 'Alice', stage: 'Lead' })
await Deal.create({ name: 'Acme Enterprise', value: 50000, contact: 'contact_fX9bL5nRd' })
```

`digital-objects` defines pure schemas. This package makes them real — connecting `Noun()` definitions to Cloudflare Durable Objects via [rpc.do](https://rpc.do). One provider, and every entity in your graph is stored, versioned, and event-sourced at the edge.

## The Problem

Schema definitions are worthless without a runtime. You can define `Contact` and `Deal` as beautiful TypeScript types, but something needs to actually store them, generate IDs, emit events, and execute verbs.

Most ORMs solve this by coupling your schema to a specific database. Prisma locks you to PostgreSQL. Drizzle locks you to SQL. Mongoose locks you to MongoDB.

`@headlessly/objects` decouples schema from storage entirely. Same `Noun()` definitions work with Durable Objects in production, in-memory storage in development, and anything else you wire up.

## Two Providers

### DONounProvider — Production

Every entity operation routes through [rpc.do](https://rpc.do) to a Cloudflare Durable Object. capnweb promise pipelining means chained operations execute in a single round-trip. Data lives at the edge, isolated per tenant.

```typescript
import { DONounProvider } from '@headlessly/objects'
import { setProvider } from 'digital-objects'

const provider = new DONounProvider({
  endpoint: 'https://db.headless.ly/~acme',
  apiKey: 'key_...',
})
setProvider(provider)

// Operations route to Durable Objects via rpc.do
const contact = await Contact.create({ name: 'Alice', stage: 'Lead' })
const deals = await Deal.find({ contact: contact.$id })
```

### LocalNounProvider — Development

In-memory storage with full event emission. Same API, no network, instant feedback:

```typescript
import { LocalNounProvider } from '@headlessly/objects'
import { setProvider } from 'digital-objects'

const provider = new LocalNounProvider({
  context: 'https://headless.ly/~dev',
})
setProvider(provider)

// Same code, runs locally
await Contact.create({ name: 'Alice', stage: 'Lead' })
```

## Event Bridge

Every verb — create, update, delete, and custom verbs — emits events. Subscribe with glob patterns:

```typescript
import { createEventBridge } from '@headlessly/objects'

const events = createEventBridge()

events.on('Contact.created', (event) => {
  console.log('New contact:', event.after.name)
})

events.on('Deal.*', (event) => {
  console.log('Deal event:', event.verb)
})

events.on('*.qualified', (event) => {
  console.log(`${event.entityType} qualified:`, event.entityId)
})
```

## Verb Execution

Execute any verb — CRUD or custom — with full lifecycle hooks:

```typescript
import { executeVerb } from '@headlessly/objects'

const result = await executeVerb({
  type: 'Contact',
  id: 'contact_fX9bL5nRd',
  verb: 'qualify',
  data: { score: 85 },
})
// Fires: Contact.qualifying() → Contact.qualify() → Contact.qualified()
```

## Entity ID Generation

IDs use the format `{type}_{sqid}` — short, unique, URL-safe, with a built-in blocklist to prevent offensive strings via [sqids](https://sqids.org/):

```typescript
import { generateSqid, generateEntityId, generateEventId } from '@headlessly/objects'

const sqid = generateSqid()              // 'fX9bL5nRdKpQ'
const id = generateEntityId('Contact')   // 'contact_fX9bL5nRdKpQ'
const eid = generateEventId()            // 'evt_k7TmPvQxW3hN'
```

## Install

```bash
npm install @headlessly/objects
```

## API

### Providers

- **`DONounProvider`** -- NounProvider backed by Durable Objects via rpc.do. Uses capnweb promise pipelining for single-round-trip chains. Supports HTTP and WebSocket transports.
- **`LocalNounProvider`** -- in-process NounProvider with event emission for local development.

### `DONounProvider` Methods

Implements the full `NounProvider` interface:

- **`create(type, data)`** -- create an entity
- **`get(type, id)`** -- get an entity by ID
- **`find(type, where?)`** -- query entities with filters
- **`update(type, id, data)`** -- update an entity
- **`delete(type, id)`** -- delete an entity
- **`perform(type, verb, id, data?)`** -- execute a custom verb

### Utilities

- **`createEventBridge()`** -- in-memory event emitter for verb lifecycle events
- **`executeVerb(options)`** -- verb execution with lifecycle hooks (before/action/after)
- **`generateSqid(length?)`** -- generate a sqid string
- **`generateEntityId(type)`** -- generate a typed entity ID (`type_sqid`)
- **`generateEventId()`** -- generate an event ID (`evt_sqid`)

### Error Handling

- **`DOProviderError`** -- thrown when DO operations fail, includes HTTP status and detail

## License

MIT
