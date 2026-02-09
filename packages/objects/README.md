# @headlessly/objects

DO-backed NounProvider for digital-objects -- bridges `Noun()` to Durable Object storage via rpc.do.

## Install

```bash
npm install @headlessly/objects
```

## Usage

```typescript
import { DONounProvider, LocalNounProvider } from '@headlessly/objects'
import { setProvider } from 'digital-objects'

// Remote mode: rpc.do + capnweb promise pipelining
const provider = new DONounProvider({
  endpoint: 'https://db.headless.ly/~acme',
  apiKey: 'key_...',
})
setProvider(provider)

// Local mode: in-process storage with event emission
const local = new LocalNounProvider({
  context: 'https://headless.ly/~acme',
})
setProvider(local)
```

### Event Bridge

```typescript
import { createEventBridge } from '@headlessly/objects'

const events = createEventBridge()

events.on('Contact.created', (event) => {
  console.log('New contact:', event.after.name)
})

events.on('Deal.*', (event) => {
  console.log('Deal event:', event.verb)
})
```

### Verb Execution

```typescript
import { executeVerb } from '@headlessly/objects'

const result = await executeVerb({
  type: 'Contact',
  id: 'contact_fX9bL5',
  verb: 'qualify',
  data: { score: 85 },
})
```

### ID Generation

```typescript
import { generateSqid, generateEntityId, generateEventId } from '@headlessly/objects'

const sqid = generateSqid() // 'fX9bL5nRdKpQ'
const id = generateEntityId('Contact') // 'contact_fX9bL5nRdKpQ'
const eid = generateEventId() // 'evt_k7TmPvQxW3hN'
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
- **`executeVerb(options)`** -- verb execution with event emission
- **`generateSqid(length?)`** -- generate a sqid string
- **`generateEntityId(type)`** -- generate a typed entity ID
- **`generateEventId()`** -- generate an event ID

### Error Handling

- **`DOProviderError`** -- thrown when DO operations fail, includes HTTP status and detail

## License

MIT
