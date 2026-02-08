# @headlessly/rpc

Preconfigured rpc.do client for headless.ly -- capnweb promise pipelining, magic `.map()`, and automatic batching.

## Install

```bash
npm install @headlessly/rpc
```

## Usage

```typescript
import { headlessly } from '@headlessly/rpc'

const $ = headlessly({ tenant: 'acme', apiKey: 'key_...' })

// CRUD operations
const contact = await $.contacts.create({ name: 'Alice', stage: 'Lead' })
const deal = await $.deals.get('deal_k7TmPv')
const leads = await $.contacts.find({ stage: 'Lead' })
```

### Promise Pipelining

Chain dependent operations and they execute in a single round-trip. No waterfall of HTTP requests -- capnweb batches everything automatically.

```typescript
// One round-trip, not three
const qualified = await $.contacts.find({ stage: 'Qualified' })
const deals = await $.deals.find({ stage: 'Open' })
```

### Magic `.map()`

Transform results server-side without pulling data to the client first.

```typescript
// Server-side map -- the callback runs on the server
const dealValues = await $.deals.find({ stage: 'Open' }).map(d => d.value)

// Chain maps
const names = await $.contacts
  .find({ stage: 'Customer' })
  .map(c => c.name)
```

### Automatic Batching

Concurrent operations are batched into a single request.

```typescript
// One request, not two
const [contacts, deals] = await Promise.all([
  $.contacts.find({ stage: 'Lead' }),
  $.deals.find({ stage: 'Open' }),
])
```

### WebSocket Transport

```typescript
const $ = headlessly({
  tenant: 'acme',
  apiKey: 'key_...',
  transport: 'ws',
})
```

## API

### `headlessly(options)` / `createHeadlesslyClient(options)`

Create a preconfigured rpc.do client for a headless.ly tenant.

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `tenant` | `string` | required | Tenant identifier |
| `apiKey` | `string` | -- | API key for authentication |
| `endpoint` | `string` | `'https://db.headless.ly'` | Endpoint override |
| `transport` | `'http' \| 'ws'` | `'http'` | Transport protocol |

### Re-exports from rpc.do

**Core:**

- **`RPC(url, options)`** -- create a raw RPC client
- **`createRPCClient(url, options)`** -- alias for RPC
- **`$`** -- default RPC proxy

**Transports:**

- **`http`** -- HTTP transport
- **`capnweb`** -- capnweb transport with promise pipelining
- **`binding`** -- Cloudflare service binding transport
- **`composite`** -- combine multiple transports

**Durable Object Client:**

- **`createDOClient`** -- create a DO-specific client
- **`connectDO`** -- connect to a Durable Object

**Types:**

- `RpcProxy`, `RpcPromise`, `RpcPipelined`, `RpcArrayMethods`, `MagicMap`, `Transport`, `DOClient`, `Filter`, `QueryOptions`, and more

## License

MIT
