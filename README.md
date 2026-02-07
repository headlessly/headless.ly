# headless.ly

The operating system for agent-first startups.

Create an org. Get everything. CRM, project management, billing, analytics, content, support — as a single unified system that AI agents can operate autonomously.

```typescript
import Headlessly from 'headless.ly'

const org = Headlessly({ tenant: 'my-startup' })

// Everything exists. One line.
await org.Contact.create({ name: 'Alice', email: 'alice@vc.com', stage: 'Lead' })
await org.Deal.create({ title: 'Seed Round', contact: 'contact_1', value: 500_000 })
await org.Task.create({ title: 'Build MVP', project: 'project_1', status: 'InProgress' })
```

## Install

```bash
npm install headless.ly
```

## Why headless.ly?

**You're building a startup, not configuring software.**

Most business tools make you choose modules, design schemas, wire integrations, and learn 15 different APIs. headless.ly gives you one typed graph of everything — contacts, deals, tasks, content, tickets, billing — connected and ready for agents to operate from day zero.

- **One graph, not 15 SaaS tools** — every entity lives in the same system
- **Agent-first** — TypeScript SDK is the primary contract, not a bolted-on API
- **Immutable event log** — nothing is ever deleted, every state is reconstructable
- **Zero configuration** — create an org and everything works

## Digital Objects

Entities are defined using the `Noun()` function from `digital-objects` — zero dependencies, zero codegen, full TypeScript inference:

```typescript
import { Noun } from 'digital-objects'

export const Contact = Noun('Contact', {
  name: 'string!',
  email: 'string?#',
  phone: 'string?',
  title: 'string?',
  stage: 'Lead | Qualified | Customer | Churned | Partner',
  source: 'string?',
  company: '-> Company.contacts',
  deals: '<- Deal.contact[]',
  activities: '<- Activity.contact[]',

  // Custom verbs (CRUD is automatic)
  qualify:  'Qualified',
  capture:  'Captured',
  assign:   'Assigned',
  merge:    'Merged',
  enrich:   'Enriched',
})
```

Every property value tells the parser what it is:

| Value Pattern | Meaning | Example |
|--------------|---------|---------|
| Type string | Data property | `'string!'`, `'number?'`, `'datetime!'` |
| Arrow syntax | Relationship | `'-> Company.contacts'`, `'<- Deal.contact[]'` |
| Pipe-separated PascalCase | Enum | `'Lead \| Qualified \| Customer'` |
| Single PascalCase word | Verb → Event | `'Qualified'`, `'Captured'` |
| `null` | Opt out of inherited verb | `update: null` (makes entity immutable) |

## Verbs & Event Handlers

Every verb has a full conjugation that maps to the execution lifecycle:

```
qualify
  ├── qualify()      → execute the action
  ├── qualifying()   → BEFORE hook (validate, transform, reject)
  ├── qualified()    → AFTER hook (react, trigger side effects)
  └── qualifiedBy    → who performed this action
```

Register handlers directly on the entity:

```typescript
// BEFORE hook — validate or reject
org.Contact.qualifying(contact => {
  if (!contact.email) throw new Error('Cannot qualify without email')
  return contact
})

// AFTER hook — react to what happened
org.Contact.qualified(contact => {
  org.Activity.create({
    type: 'Task',
    subject: `Follow up with ${contact.name}`,
    contact: contact.$id,
  })
})

// Execute
await org.Contact.qualify('contact_123')
// → runs .qualifying() → sets stage → persists event → runs .qualified()
```

Handlers are serialized via `fn.toString()`, stored in the tenant's database, and executed inside the Durable Object via `ai-evaluate`. No separate infrastructure needed.

## Promise Pipelining

The SDK uses `rpc.do` with capnweb promise pipelining — chain dependent calls without awaiting, and the system batches them into a single round trip:

```typescript
// One round trip, not three
const deals = await org.Contact
  .find({ stage: 'Qualified' })
  .map(contact => contact.deals)
  .filter(deal => deal.status === 'Open')
```

The `.map()` callback executes in "recording mode" locally, captures all RPC invocations, then replays them server-side on the actual data. Results return in a single round trip.

## Time Travel

Every mutation is an event appended to an immutable log. Any point in time can be reconstructed:

```typescript
// Query as of a specific time
const contacts = await org.Contact.find(
  { stage: 'Lead' },
  { asOf: '2026-01-15T10:00:00Z' }
)

// Rollback an action
await org.Contact.rollback('contact_123', { asOf: '2026-02-06T15:00:00Z' })
```

This gives founders confidence to let agents operate freely — anything can be undone.

## Integrations Activate, Not Configure

Every system is always present. They light up with real data when you connect external tools:

| Connect... | ...and this lights up |
|------------|----------------------|
| **GitHub** | Repos, issues, PRs → Project Management |
| **Stripe** | Products, subscriptions, invoices → Billing |
| **Google Apps** | Email → Activities, Calendar → Scheduling |
| **Slack/Discord** | Messages → Activities, Channels → Segments |

## ICP Templates

At org creation, select an ICP template that configures defaults without changing the schema:

```typescript
const org = Headlessly({
  tenant: 'my-startup',
  template: 'b2b-saas',
})
```

| Template | Pipeline Stages | Key Metrics |
|----------|----------------|-------------|
| **B2B SaaS** | Lead → Demo → Trial → Closed → Active → Churned | MRR, CAC, LTV |
| **B2C / Consumer** | Signup → Activated → Engaged → Monetized → Churned | DAU/MAU, ARPU |
| **B2D / Developer Tools** | Discovered → Integrated → Active → Scaled | Time-to-first-call, API usage |
| **B2A / Agent Services** | Connected → Configured → Autonomous → Scaled | Tool invocations, success rate |

Same entities. Same schema. Different default labels and metric calculations.

## MCP: Search, Fetch, Do

Three primitives for AI agents — not hundreds of tools:

```typescript
// search — find entities across the graph
search({ type: 'Contact', filter: { stage: 'Lead' } })

// fetch — get specific entities or schemas
fetch({ type: 'Contact', id: 'abc123' })

// do — execute any action or code
do({ method: 'Contact.qualify', args: ['abc123'] })
```

The `do` tool executes typed actions from the Digital Objects schema and runs arbitrary TypeScript via `ai-evaluate` for custom logic.

## Multi-Tenancy

Each tenant gets their own Cloudflare Durable Object — complete data isolation and proximity to the user:

```
POST   headless.ly/~my-startup/Contact          → create
GET    headless.ly/~my-startup/Contact?stage=Lead → find
GET    headless.ly/~my-startup/Contact/abc123    → get
```

## Core Entities

~20 entities across six domains, all connected in one graph:

| Domain | Entities |
|--------|----------|
| **People** | Contact, Company, Activity |
| **Work** | Project, Task, Milestone, Comment |
| **Content** | Page, Post, Asset, Collection |
| **Support** | Ticket, Thread, Reply, Article |
| **Team** | Member, Invitation, Department |
| **Meta** | Note, Tag (polymorphic, attachable to anything) |

## The Startup Journey

### Day 0 — "I have an idea"

```typescript
import Headlessly from 'headless.ly'
const org = Headlessly({ tenant: 'my-startup' })
// Everything exists. CRM, PM, Content, Analytics, Support — all ready.
```

### Day 1-30 — "I'm building"

```typescript
await org.Contact.create({ name: 'Alice', email: 'alice@vc.com', stage: 'Lead' })
await org.Task.create({ title: 'Build MVP', project: 'project_1', status: 'InProgress' })

// Everything is connected in one graph
const alice = await org.Contact.get('contact_1', { populate: ['deals', 'activities'] })
```

### Day 30-90 — "I have users"

```typescript
// Connect Stripe → billing lights up
// Connect GitHub → project management lights up
// Agents start operating autonomously

org.Contact.qualified(contact => {
  org.Activity.create({ type: 'Task', subject: `Demo with ${contact.name}` })
})

org.Deal.closed(deal => {
  org.Contact.update(deal.contact, { stage: 'Customer' })
})
```

### Day 90+ — "I'm scaling"

The same system scales from 1 founder to a seed-stage team. No migration. No new tools. The graph grows, agents get smarter, and the immutable event log means nothing is ever lost.

## Architecture

headless.ly is intentionally minimalistic — the thinnest possible composition layer. All heavy lifting is pushed into lower-level primitives:

```
┌─────────────────────────────────────────────────┐
│                  headless.ly                     │
│     Tenant management, ICP templates, SDK       │
│       RPC client with capnweb pipelining        │
├─────────────────────────────────────────────────┤
│                  objects.do                      │
│          Managed Digital Object service          │
│    Verb conjugation, event subscriptions        │
├──────────────────┬──────────────────────────────┤
│  digital-objects  │       .do services           │
│  (zero-dep schemas)│  payments.do  (Stripe)      │
│                   │  oauth.do     (auth)         │
│  Noun() definitions│  events.do    (CDC)         │
│  ~20 core entities │  database.do  (ParqueDB)    │
│  Type inference    │  functions.do (execution)   │
├──────────────────┴──────────────────────────────┤
│                   @dotdo/do                      │
│     THE Durable Object for Digital Objects       │
│   StorageHandler · EventsStore · WebSocket      │
├─────────────────────────────────────────────────┤
│              @dotdo/db (ParqueDB)                │
│     Hybrid Relational-Document-Graph DB          │
│   Parquet · Iceberg · time travel · inference   │
├─────────────────────────────────────────────────┤
│          Cloudflare Infrastructure               │
│   Workers · Durable Objects · R2 · KV · AI      │
└─────────────────────────────────────────────────┘
```

## Package Ecosystem

| Package | What it adds |
|---------|-------------|
| `digital-objects` | Pure schemas, zero deps |
| `business-as-code` | + business definition primitives |
| `business.org.ai` | + ontology data (NAICS, O*NET, APQC) |
| `startups.org.ai` | + ICP templates, startup metrics |
| `headless.ly` | + tenant composition, RPC client, managed service |

## License

MIT
