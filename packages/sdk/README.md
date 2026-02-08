# @headlessly/sdk

The unified headless.ly SDK -- all 32 entities, domain namespaces, and the `$` universal context.

## Install

```bash
npm install @headlessly/sdk
```

## Usage

```typescript
import { $, crm, billing } from '@headlessly/sdk'

// Access any entity via $ universal context
await $.Contact.create({ name: 'Alice', stage: 'Lead' })
await $.Deal.create({ title: 'Acme Enterprise', value: 50000 })

// Search across the graph
const leads = await $.search({ type: 'Contact', filter: { stage: 'Lead' } })

// Fetch a specific entity
const contact = await $.fetch({ type: 'Contact', id: 'contact_fX9bL5' })

// Execute arbitrary logic with full entity access
await $.do(async ($) => {
  const deals = await $.Deal.find({ stage: 'Open' })
  for (const deal of deals) {
    await $.Deal.close(deal.$id)
  }
})

// Use domain namespaces for scoped access
await crm.Contact.create({ name: 'Bob', stage: 'Qualified' })
await billing.Subscription.create({ plan: 'pro', contact: 'contact_fX9bL5' })
```

## API

### `$` -- Universal Context

A proxy that provides access to all 32 entities plus MCP-like operations:

- **`$.Contact`**, **`$.Deal`**, **`$.Subscription`**, etc. -- direct entity access with CRUD and custom verbs
- **`$.search(query)`** -- search entities across the graph with filters
- **`$.fetch(query)`** -- fetch a specific entity by type and ID
- **`$.do(fn)`** -- execute a function with all entities injected

### Domain Namespaces

- **`crm`** -- Contact, Company, Deal
- **`billing`** -- Customer, Product, Price, Subscription, Invoice, Payment
- **`projects`** -- Project, Issue, Comment
- **`content`** -- Content, Asset, Site
- **`support`** -- Ticket
- **`analytics`** -- Event, Metric, Funnel, Goal
- **`marketing`** -- Campaign, Segment, Form
- **`experiments`** -- Experiment, FeatureFlag
- **`platform`** -- Workflow, Integration, Agent

### Identity Entities

- **`User`** -- with invite, suspend, activate verbs
- **`ApiKey`** -- with revoke verb
- **`Message`** -- with send, deliver, read verbs

### Provider Utilities

- **`setProvider(provider)`** -- set the global NounProvider
- **`getProvider()`** -- get the current NounProvider
- **`MemoryNounProvider`** -- in-memory provider for testing

## License

MIT
