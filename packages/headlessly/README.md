# headless.ly

The Operating System for Agent-First Startups -- SDK entry point.

## Install

```bash
npm install headless.ly
```

## Usage

```typescript
import Headlessly from 'headless.ly'

// Memory mode (default -- testing and prototyping)
const org = Headlessly({ tenant: 'acme' })

// Create entities
await org.Contact.create({ name: 'Alice', stage: 'Lead' })
await org.Contact.qualify('contact_fX9bL5')

// React to events via verb conjugation
org.Contact.qualified((contact) => console.log('Qualified:', contact.name))

// Search, fetch, do -- MCP-like primitives
const leads = await org.search({ type: 'Contact', filter: { stage: 'Lead' } })
const deal = await org.fetch({ type: 'Deal', id: 'deal_k7TmPv' })

// Domain namespaces
await org.crm.Deal.create({ title: 'Enterprise', value: 50000 })
await org.billing.Subscription.create({ plan: 'pro' })
```

### Provider Modes

```typescript
// Local mode (in-process storage with event emission)
const org = Headlessly({ tenant: 'acme', mode: 'local' })

// Remote mode (rpc.do + capnweb promise pipelining)
const org = Headlessly({
  tenant: 'acme',
  apiKey: 'key_...',
  mode: 'remote',
})

// Real-time mode (WebSocket transport)
const org = Headlessly({
  tenant: 'acme',
  apiKey: 'key_...',
  mode: 'remote',
  transport: 'ws',
})
```

## API

### `Headlessly(options)` -- Factory Function

Creates a `HeadlesslyOrg` instance with access to all 32 entities.

**Options:**

| Option      | Type                               | Default                    | Description                        |
| ----------- | ---------------------------------- | -------------------------- | ---------------------------------- |
| `tenant`    | `string`                           | required                   | Tenant identifier (e.g., `'acme'`) |
| `apiKey`    | `string`                           | --                         | API key for remote mode            |
| `endpoint`  | `string`                           | `'https://db.headless.ly'` | Remote endpoint override           |
| `mode`      | `'memory' \| 'local' \| 'remote'`  | `'memory'`                 | Provider mode                      |
| `transport` | `'http' \| 'ws'`                   | `'http'`                   | Transport for remote mode          |
| `template`  | `'b2b' \| 'b2c' \| 'b2d' \| 'b2a'` | --                         | ICP template                       |

### `HeadlesslyOrg` Instance

- **`org.tenant`** -- tenant identifier
- **`org.context`** -- context URL (`https://headless.ly/~{tenant}`)
- **`org.Contact`**, **`org.Deal`**, etc. -- all 32 entities
- **`org.crm`**, **`org.billing`**, etc. -- domain namespaces
- **`org.search(query)`** -- search across entities
- **`org.fetch(query)`** -- fetch a specific entity
- **`org.do(fn)`** -- execute with full entity access

### Re-exports

- **`$`** from `@headlessly/sdk` -- universal context
- **`setProvider`**, **`getProvider`**, **`MemoryNounProvider`** from `digital-objects`
- **`LocalNounProvider`**, **`DONounProvider`** from `@headlessly/objects`
- All domain namespaces: `crm`, `billing`, `projects`, `content`, `support`, `analytics`, `marketing`, `experiments`, `platform`

## License

MIT
