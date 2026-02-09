# @headlessly/rpc

> One round-trip where others need fifteen. capnweb promise pipelining for the headless.ly graph.

```typescript
import { headlessly } from '@headlessly/rpc'

const $ = headlessly({ tenant: 'acme', apiKey: 'key_...' })

// Fetch contacts, their deals, each deal's subscription — one round-trip
const revenue = await $.Contact.find({ stage: 'Customer' })
  .map(c => c.deals)
  .filter(d => d.stage === 'ClosedWon')
  .map(d => d.subscription)
  .map(s => s.plan.price)
```

That entire chain — contacts to deals to subscriptions to plan prices — executes in a **single HTTP request**. Not five. Not fifteen. One.

## The Problem

Traditional API clients make N+1 requests. Fetch a contact, then their deals, then each deal's subscription, then each subscription's plan. That's a waterfall:

```
GET /contacts?stage=Customer        → 200ms
GET /deals?contact=contact_fX9bL5nRd  → 200ms
GET /deals?contact=contact_k7TmPvQx   → 200ms
GET /subscriptions/sub_mN8pZwKj       → 200ms
GET /plans/plan_e5JhLzXc              → 200ms
...
```

Fifteen round-trips. Three seconds. And that's just one query.

SDK wrappers around REST APIs don't fix the problem — they just hide it behind async/await. GraphQL helps with the response shape but doesn't pipeline mutations or chain operations.

## capnweb Promise Pipelining

[capnweb](https://github.com/nicolo-ribaudo/tc39-proposal-promise-pipelining) brings Cap'n Proto's promise pipelining to the web. When you chain `.find().map().filter()`, those operations aren't executed locally — they're recorded and sent to the server as a single batched pipeline.

```typescript
const $ = headlessly({ tenant: 'acme', apiKey: 'key_...' })

// Promise pipelining — one round-trip, not three
const qualified = await $.Contact.find({ stage: 'Qualified' })
const deals = await $.Deal.find({ contact: qualified[0].$id })
const sub = await $.Subscription.get(deals[0].subscription)
```

Every promise in the chain is a lightweight reference. The server resolves the entire graph traversal in one pass.

## Magic `.map()`

The `.map()` on an RPC result is not `Array.prototype.map`. It uses **record-replay**: your callback runs once locally in recording mode, capturing which properties you access. Then it replays on the server for each item in the result set.

```typescript
// Server-side map — the callback records property access, replays on server
const dealValues = await $.Deal.find({ stage: 'Open' }).map(d => d.value)

// Chain maps for deep traversal
const customerEmails = await $.Contact.find({ stage: 'Customer' })
  .map(c => c.email)

// Map across relationships
const activeCustomerPlans = await $.Contact.find({ stage: 'Customer' })
  .map(c => c.deals)
  .filter(d => d.stage === 'ClosedWon')
  .map(d => d.subscription.plan.name)
```

No serialized code strings. No `eval()`. No security risk. Just capnweb.

## Automatic Batching

Concurrent operations are automatically batched into a single request:

```typescript
// One request, not four
const [contacts, deals, subs, tickets] = await Promise.all([
  $.Contact.find({ stage: 'Lead' }),
  $.Deal.find({ stage: 'Open' }),
  $.Subscription.find({ status: 'Active' }),
  $.Ticket.find({ priority: 'High' }),
])
```

## Install

```bash
npm install @headlessly/rpc
```

## Usage

### Client Factory

```typescript
import { headlessly, createHeadlesslyClient } from '@headlessly/rpc'

// Short form
const $ = headlessly({ tenant: 'acme', apiKey: 'key_...' })

// Equivalent long form
const client = createHeadlesslyClient({
  tenant: 'acme',
  apiKey: 'key_...',
  endpoint: 'https://db.headless.ly',
  transport: 'http',
})
```

### WebSocket Transport

For long-lived connections — real-time subscriptions, high-frequency operations:

```typescript
const $ = headlessly({
  tenant: 'acme',
  apiKey: 'key_...',
  transport: 'ws',
})

// Same API, persistent connection
const contact = await $.Contact.create({ name: 'Alice', stage: 'Lead' })
```

### CRUD Operations

```typescript
const contact = await $.Contact.create({ name: 'Alice', stage: 'Lead' })
const deal = await $.Deal.get('deal_k7TmPvQx')
const leads = await $.Contact.find({ stage: 'Lead' })
await $.Contact.update('contact_fX9bL5nRd', { stage: 'Qualified' })
await $.Contact.delete('contact_fX9bL5nRd')
```

## API

### `headlessly(options)` / `createHeadlesslyClient(options)`

Create a preconfigured rpc.do client for a headless.ly tenant.

| Option      | Type             | Default                    | Description                |
| ----------- | ---------------- | -------------------------- | -------------------------- |
| `tenant`    | `string`         | required                   | Tenant identifier          |
| `apiKey`    | `string`         | --                         | API key for authentication |
| `endpoint`  | `string`         | `'https://db.headless.ly'` | Endpoint override          |
| `transport` | `'http' \| 'ws'` | `'http'`                   | Transport protocol         |

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

- `RpcProxy`, `RpcPromise`, `RpcPipelined`, `RpcArrayMethods`, `MagicMap`, `Transport`, `DOClient`, `Filter`, `QueryOptions`

## License

MIT
