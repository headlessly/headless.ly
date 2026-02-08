# headless.ly

The operating system for agent-first startups.

Create an org. Get everything. CRM, project management, billing, analytics, content, support, marketing, experimentation — as a single unified system that AI agents can operate autonomously.

## Install

```bash
npm install @headlessly/sdk
```

## Three Ways to Import

**1. Universal context (`$`)** — full access to every entity:

```typescript
import { $ } from '@headlessly/sdk'

await $.Contact.create({ name: 'Alice', stage: 'Lead' })
await $.Deal.close('deal_fX9bL5nRd')
```

**2. Direct entity imports** — domain-specific packages:

```typescript
import { Contact, Deal } from '@headlessly/crm'
import { Subscription } from '@headlessly/billing'

await Contact.create({ name: 'Alice', stage: 'Lead' })
await Deal.close('deal_fX9bL5nRd')
```

**3. Domain namespace imports** — grouping by product domain:

```typescript
import { crm, billing } from '@headlessly/sdk'

await crm.Contact.create({ name: 'Alice', stage: 'Lead' })
await billing.Subscription.create({ plan: 'pro', contact: 'contact_k7TmPvQx' })
```

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + [capnweb](https://github.com/cloudflare/capnweb) — chain dependent operations and they execute in a single round-trip:

```typescript
// One round-trip, not three
const deals = await $.Contact
  .find({ stage: 'Qualified' })
  .map(contact => contact.deals)
  .filter(deal => deal.stage === 'Open')
```

The magic `.map()` uses record-replay: your callback runs once in recording mode, capturing which RPC calls it makes. That recording replays on the server for each item in the list. No serialized code strings. No `eval()`. Just capnweb.

```typescript
// Automatic batching — concurrent calls become a single request
const [contacts, deals, metrics] = await Promise.all([
  $.Contact.find({ stage: 'Lead' }),
  $.Deal.find({ stage: 'Open' }),
  $.Metric.get('mrr'),
])
```

## 32 Core Entities

Every entity exists because headless.ly needs it to run itself as an autonomous business.

| Domain | Package | Entities |
|--------|---------|----------|
| **Identity** | `@headlessly/sdk` | User, Organization, ApiKey |
| **CRM** | `@headlessly/crm` | Contact, Company, Deal |
| **Projects** | `@headlessly/projects` | Project, Issue, Comment |
| **Content** | `@headlessly/content` | Content, Asset, Site |
| **Billing** | `@headlessly/billing` | Customer, Product, Price, Subscription, Invoice, Payment |
| **Support** | `@headlessly/support` | Ticket |
| **Analytics** | `@headlessly/analytics` | Event, Metric, Funnel, Goal |
| **Marketing** | `@headlessly/marketing` | Campaign, Segment, Form |
| **Experiments** | `@headlessly/experiments` | Experiment, FeatureFlag |
| **Platform** | `@headlessly/platform` | Workflow, Integration, Agent |
| **Communication** | `@headlessly/sdk` | Message |

## Digital Objects

Entities are defined using the `Noun()` function from `digital-objects` — zero dependencies, zero codegen, full TypeScript inference:

```typescript
import { Noun } from 'digital-objects'

export const Contact = Noun('Contact', {
  name: 'string!',
  email: 'string?#',
  stage: 'Lead | Qualified | Customer | Churned | Partner',
  company: '-> Company.contacts',
  deals: '<- Deal.contact[]',
  qualify:  'Qualified',
  capture:  'Captured',
  assign:   'Assigned',
})
```

## Verb Conjugation

Every verb has a full lifecycle:

```
qualify
  ├── qualify()      → execute the action
  ├── qualifying()   → BEFORE hook (validate, transform, reject)
  ├── qualified()    → AFTER hook (react, trigger side effects)
  └── qualifiedBy    → who performed this action
```

```typescript
// BEFORE hook — validate or reject
Contact.qualifying(contact => {
  if (!contact.email) throw new Error('Cannot qualify without email')
  return contact
})

// AFTER hook — react to what happened
Contact.qualified(contact => {
  Activity.create({
    type: 'Task',
    subject: `Follow up with ${contact.name}`,
    contact: contact.$id,
  })
})

// Execute
await Contact.qualify('contact_fX9bL5nRd')
```

## Time Travel

Every mutation is an event appended to an immutable log. Any point in time can be reconstructed:

```typescript
const contacts = await $.Contact.find(
  { stage: 'Lead' },
  { asOf: '2026-01-15T10:00:00Z' }
)

await $.Contact.rollback('contact_fX9bL5nRd', { asOf: '2026-02-06T15:00:00Z' })
```

## MCP: Search, Fetch, Do

Three primitives for AI agents — not hundreds of tools:

```json title="headless.ly/mcp#search"
{ "type": "Contact", "filter": { "stage": "Lead" } }
```

```json title="headless.ly/mcp#fetch"
{ "type": "Contact", "id": "contact_fX9bL5nRd", "include": ["deals"] }
```

```ts title="headless.ly/mcp#do"
const leads = await $.Contact.find({ stage: 'Lead' })
for (const lead of leads) {
  await $.Contact.qualify(lead.$id)
}
```

## Packages

### SDK & Entry Points

| Package | Description |
|---------|-------------|
| [`@headlessly/sdk`](packages/sdk) | Unified 32-entity SDK with `$` context |
| [`headless.ly`](packages/headlessly) | Main entry point with `Headlessly()` factory |
| [`@headlessly/cli`](packages/cli) | Developer and agent CLI |

### Domain Packages

| Package | Entities |
|---------|----------|
| [`@headlessly/crm`](packages/crm) | Contact, Company, Deal |
| [`@headlessly/billing`](packages/billing) | Customer, Product, Price, Subscription, Invoice, Payment |
| [`@headlessly/projects`](packages/projects) | Project, Issue, Comment |
| [`@headlessly/content`](packages/content) | Content, Asset, Site |
| [`@headlessly/support`](packages/support) | Ticket |
| [`@headlessly/analytics`](packages/analytics) | Event, Metric, Funnel, Goal |
| [`@headlessly/marketing`](packages/marketing) | Campaign, Segment, Form |
| [`@headlessly/experiments`](packages/experiments) | Experiment, FeatureFlag |
| [`@headlessly/platform`](packages/platform) | Workflow, Integration, Agent |

### Infrastructure

| Package | Description |
|---------|-------------|
| [`@headlessly/rpc`](packages/rpc) | Preconfigured [rpc.do](https://rpc.do) client with capnweb promise pipelining |
| [`@headlessly/objects`](packages/objects) | DO-backed NounProvider for digital-objects |
| [`@headlessly/events`](packages/events) | Event system with time travel |
| [`@headlessly/mcp`](packages/mcp) | MCP protocol client (search, fetch, do) |
| [`@headlessly/code`](packages/code) | Sandboxed code execution client |

### Client SDKs

| Package | Description |
|---------|-------------|
| [`@headlessly/js`](packages/js) | Browser SDK (analytics, errors, feature flags) |
| [`@headlessly/node`](packages/node) | Node.js SDK |
| [`@headlessly/react`](packages/react) | React hooks and providers |
| [`@headlessly/ui`](packages/ui) | Schema-driven React CRUD components |

## Architecture

```
headless.ly                     SDK entry point, tenant factory
  └── @headlessly/sdk           32 entities, $ context, domain namespaces
       └── @headlessly/crm      Noun() definitions (Contact, Company, Deal)
       └── @headlessly/billing  Noun() definitions (Customer, Subscription, ...)
       └── ...                  9 domain packages total
  └── @headlessly/objects       NounProvider → rpc.do → Durable Object
       └── rpc.do               capnweb promise pipelining, magic .map()
            └── @dotdo/capnweb  Cap'n Proto for the web
  └── @headlessly/events        Immutable event log, time travel
```

## License

MIT
