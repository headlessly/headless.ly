# headless.ly

> Create an org. Get everything. The operating system for agent-first startups.

```typescript
import Headlessly from 'headless.ly'

const org = Headlessly({ tenant: 'acme' })

await org.Contact.create({ name: 'Alice', stage: 'Lead' })
await org.Deal.create({ title: 'Enterprise', value: 50000, contact: 'contact_fX9bL5nRd' })
await org.Contact.qualify('contact_fX9bL5nRd')

org.Contact.qualified((contact) => {
  org.billing.Subscription.create({ plan: 'pro', contact: contact.$id })
})
```

## What This Is

This is the entry point. `Headlessly()` configures your connection -- tenant, API key, transport -- and gives you back the entire 32-entity graph. CRM, billing, projects, content, support, analytics, marketing, experiments, platform, communication. All of it. One function call.

No module selection. No schema design. No configuration wizard. You create an org and everything works.

## Install

```bash
npm install headless.ly
```

## Modes

### Memory -- Testing and Prototyping

```typescript
const org = Headlessly({ tenant: 'acme' })

// In-memory storage, no network calls, full entity graph
await org.Contact.create({ name: 'Alice', stage: 'Lead' })
const leads = await org.search({ type: 'Contact', filter: { stage: 'Lead' } })
```

Default mode. Everything runs in-process with in-memory storage. Perfect for tests, prototypes, and local development. Full verb conjugation and event emission -- just no persistence.

### Local -- Development

```typescript
const org = Headlessly({ tenant: 'acme', mode: 'local' })

// In-process storage with persistence and event emission
await org.Contact.create({ name: 'Alice', stage: 'Lead' })
```

Same in-process execution but with persistent local storage. Events fire locally. Use this for development when you want data to survive restarts.

### Remote -- Production

```typescript
const org = Headlessly({
  tenant: 'acme',
  apiKey: 'key_fX9bL5nRd',
  mode: 'remote',
})

// RPC via rpc.do with capnweb promise pipelining
await org.Contact.create({ name: 'Alice', stage: 'Lead' })
```

Connects to your tenant's Durable Object via [rpc.do](https://rpc.do) with capnweb promise pipelining. Chained operations execute in a single round-trip. Real-time events via WebSocket.

### Real-Time -- WebSocket Transport

```typescript
const org = Headlessly({
  tenant: 'acme',
  apiKey: 'key_fX9bL5nRd',
  mode: 'remote',
  transport: 'ws',
})

// Live updates pushed via WebSocket
org.Deal.updated((deal) => console.log('Deal changed:', deal.title))
```

## The Full Graph

Every org gets all 32 entities. Access them directly or through domain namespaces:

```typescript
const org = Headlessly({ tenant: 'acme', apiKey: 'key_fX9bL5nRd', mode: 'remote' })

// Direct entity access
await org.Contact.create({ name: 'Alice', stage: 'Lead' })
await org.Deal.create({ title: 'Enterprise', value: 50000 })
await org.Subscription.create({ plan: 'pro', contact: 'contact_fX9bL5nRd' })
await org.Issue.create({ title: 'Fix checkout bug', project: 'project_k7TmPvQx' })

// Domain namespaces -- same entities, grouped by product domain
await org.crm.Contact.create({ name: 'Bob', stage: 'Qualified' })
await org.billing.Invoice.create({ amount: 9900, customer: 'customer_e5JhLzXc' })
await org.projects.Issue.create({ title: 'Ship v2', priority: 'High' })
await org.content.Content.create({ title: 'Launch Post', type: 'blog' })
await org.support.Ticket.create({ subject: 'Cannot login', priority: 'Urgent' })
await org.analytics.Event.create({ name: 'page_view', properties: { path: '/' } })
await org.marketing.Campaign.create({ name: 'Product Hunt Launch' })
await org.experiments.Experiment.create({ name: 'Pricing Test', variants: ['A', 'B'] })
await org.platform.Workflow.create({ name: 'Lead Qualification', trigger: 'contact.created' })
```

## Search, Fetch, Do

The same three primitives that power MCP, available programmatically:

```typescript
// Search across the graph
const leads = await org.search({ type: 'Contact', filter: { stage: 'Lead' } })
const openDeals = await org.search({ type: 'Deal', filter: { stage: 'Open' }, sort: '-value' })

// Fetch a specific entity with relationships
const deal = await org.fetch({ type: 'Deal', id: 'deal_k7TmPvQx', include: ['contact'] })

// Execute operations
await org.do(async ($) => {
  const leads = await $.Contact.find({ stage: 'Lead' })
  for (const lead of leads) {
    await $.Contact.qualify(lead.$id)
  }
})
```

## Verb Conjugation

Every verb has a full lifecycle. React to events across the entire graph:

```typescript
const org = Headlessly({ tenant: 'acme' })

// BEFORE hooks -- validate, enrich, or block
org.Deal.closing((deal) => {
  if (!deal.contact) throw new Error('Deal must have a contact')
})

// AFTER hooks -- react to completed actions
org.Contact.qualified((contact) => {
  org.Deal.create({ title: `${contact.name} - Initial`, contact: contact.$id })
})

org.Deal.closed((deal, $) => {
  $.billing.Subscription.create({ plan: 'pro', contact: deal.contact })
  $.analytics.Event.create({ name: 'deal_closed', properties: { value: deal.value } })
})

// Reverse lookups
const qualifier = deal.qualifiedBy  // Who qualified this deal?
```

## ICP Templates

Start with a template that pre-configures your entity graph for your business model:

```typescript
// B2B SaaS -- emphasizes CRM, billing, enterprise features
const org = Headlessly({ tenant: 'acme', template: 'b2b' })

// B2C -- emphasizes marketing, experiments, analytics
const org = Headlessly({ tenant: 'acme', template: 'b2c' })

// B2D (developer tools) -- emphasizes projects, content, platform
const org = Headlessly({ tenant: 'acme', template: 'b2d' })

// B2A (agent-first) -- emphasizes platform, workflows, integrations
const org = Headlessly({ tenant: 'acme', template: 'b2a' })
```

All 32 entities are always available. Templates just shift the defaults and priorities.

## Configuration

```typescript
Headlessly({
  tenant: 'acme',                    // Required -- tenant identifier
  apiKey: 'key_fX9bL5nRd',          // API key for remote mode
  endpoint: 'https://db.headless.ly', // Remote endpoint (default)
  mode: 'memory',                    // 'memory' | 'local' | 'remote' (default: 'memory')
  transport: 'http',                 // 'http' | 'ws' (default: 'http')
  template: 'b2b',                   // 'b2b' | 'b2c' | 'b2d' | 'b2a'
})
```

## Re-exports

```typescript
import Headlessly, {
  $,                    // Universal context from @headlessly/sdk
  crm,                  // Domain namespaces
  billing,
  projects,
  content,
  support,
  analytics,
  marketing,
  experiments,
  platform,
  setProvider,          // Provider management from digital-objects
  getProvider,
  MemoryNounProvider,
  LocalNounProvider,    // From @headlessly/objects
  DONounProvider,
} from 'headless.ly'
```

## License

MIT
