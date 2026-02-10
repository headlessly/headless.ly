# headless.ly

> The operating system for agent-first startups.

```typescript
import { $ } from '@headlessly/sdk'

// Your agent runs the entire business — CRM, billing, support, marketing — as one system
$.Deal.closed(async (deal, $) => {
  await $.Subscription.create({ plan: 'pro', customer: deal.contact })
  await $.Campaign.create({ name: `Onboard ${deal.name}`, type: 'Email' })
  await $.Ticket.create({ subject: `Welcome ${deal.name}`, requester: deal.contact })
  await $.Event.create({ type: 'deal.closed', value: deal.value })
})
```

Create an org. Get everything. CRM, billing, projects, analytics, content, support, marketing, experimentation — as 35 typed entities in one graph that AI agents can operate autonomously.

## The Problem

```
                   One Typed Graph
                         |
    Human-First -------- + -------- Agent-Native
                         |
                   Integration Hell
```

**Bottom-right** is where most startups live: great APIs (Stripe, GitHub, Twilio) that don't talk to each other. Your agent needs 15 API keys, 15 webhook endpoints, and hundreds of lines of glue code.

**Top-left** is the enterprise suite (Salesforce, HubSpot) — unified but designed for humans clicking buttons. Your agents can't operate them.

**Top-right** is headless.ly: agent-native architecture on one typed graph. 35 entities, three MCP tools, full verb conjugation. The architecture IS the product.

## Install

```bash
npm install @headlessly/sdk
```

## Three Ways In

**`$` universal context** — every entity, one import:

```typescript
import { $ } from '@headlessly/sdk'

await $.Contact.create({ name: 'Alice Chen', email: 'alice@acme.co', stage: 'Lead' })
await $.Contact.qualify('contact_fX9bL5nRd')
await $.Deal.create({ name: 'Acme Enterprise', value: 50000 })
await $.Subscription.create({ plan: 'pro', customer: 'customer_k7TmPvQx' })
```

**Domain packages** — import what you need:

```typescript
import { Contact, Deal } from '@headlessly/crm'
import { Subscription } from '@headlessly/billing'
import { Issue } from '@headlessly/projects'
```

**Domain namespaces** — scoped access:

```typescript
import { crm, billing, projects } from '@headlessly/sdk'

await crm.Contact.create({ name: 'Alice', stage: 'Lead' })
await billing.Subscription.create({ plan: 'pro', contact: 'contact_fX9bL5nRd' })
await projects.Issue.create({ title: 'Onboard Alice', project: 'project_e5JhLzXc' })
```

## Nine Domains, One Graph

| Domain | Package | Entities | Replaces |
|--------|---------|----------|----------|
| **CRM** | [`@headlessly/crm`](packages/crm) | Organization, Contact, Lead, Deal, Activity, Pipeline | HubSpot, Salesforce, Pipedrive |
| **Billing** | [`@headlessly/billing`](packages/billing) | Customer, Product, Plan, Price, Subscription, Invoice, Payment | Stripe Dashboard + billing logic |
| **Projects** | [`@headlessly/projects`](packages/projects) | Project, Issue, Comment | Jira, Linear, Asana |
| **Content** | [`@headlessly/content`](packages/content) | Content, Asset, Site | Contentful, Sanity, WordPress |
| **Support** | [`@headlessly/support`](packages/support) | Ticket | Zendesk, Intercom, Freshdesk |
| **Analytics** | [`@headlessly/analytics`](packages/analytics) | Event, Metric, Funnel, Goal | Mixpanel, Amplitude, PostHog |
| **Marketing** | [`@headlessly/marketing`](packages/marketing) | Campaign, Segment, Form | Mailchimp, ActiveCampaign |
| **Experiments** | [`@headlessly/experiments`](packages/experiments) | Experiment, FeatureFlag | LaunchDarkly, Optimizely |
| **Platform** | [`@headlessly/platform`](packages/platform) | Workflow, Integration, Agent | Zapier, Make, n8n |

Plus **Identity** (User, ApiKey) and **Communication** (Message) in the core SDK.

Every entity exists because headless.ly needs it to run itself as an autonomous business. If we don't need it, it doesn't ship.

## Agent-Native: Three MCP Tools

Not three hundred API endpoints. Three tools:

```json title="headless.ly/mcp#search"
{ "type": "Contact", "filter": { "stage": "Lead" } }
```

```json title="headless.ly/mcp#fetch"
{ "type": "Deal", "id": "deal_fX9bL5nRd", "include": ["contact", "subscription"] }
```

```ts title="headless.ly/mcp#do"
const leads = await $.Contact.find({ stage: 'Lead' })
for (const lead of leads) {
  await $.Contact.qualify(lead.$id)
}
```

One MCP server. Your agent can operate CRM, billing, support, projects, marketing, analytics, experiments, and workflows.

## Every Verb Has a Lifecycle

```typescript
// BEFORE — validate, transform, or reject
Contact.qualifying(contact => {
  if (!contact.email) throw new Error('Cannot qualify without email')
})

// EXECUTE
await Contact.qualify('contact_fX9bL5nRd')

// AFTER — react across the entire graph
Contact.qualified((contact, $) => {
  $.Deal.create({ name: `${contact.name} opportunity`, contact: contact.$id })
  $.Campaign.create({ name: `Nurture ${contact.name}`, type: 'Email' })
})
```

`qualify()`, `qualifying()`, `qualified()`, `qualifiedBy`. Every custom verb. Every CRUD operation. Full lifecycle, zero configuration.

## Batch Operations

Cross-domain operations with `$.do()` — execute a sequence of operations as a unit:

```typescript
await $.do(async ($) => {
  const qualified = await $.Contact.find({ stage: 'Qualified' })
  for (const contact of qualified) {
    await $.Deal.create({ title: `${contact.name} Opportunity`, contact: contact.$id })
  }
})
```

```typescript
// Concurrent reads — parallel queries in one call
const [leads, deals, mrr] = await Promise.all([
  $.Contact.find({ stage: 'Lead' }),
  $.Deal.find({ stage: 'Open' }),
  $.Metric.get('mrr'),
])
```

## Time Travel

Every mutation is an immutable event. Any point in time is reconstructable:

```typescript
const januaryLeads = await $.Contact.find(
  { stage: 'Lead' },
  { asOf: '2026-01-15T10:00:00Z' }
)

await $.Contact.rollback('contact_fX9bL5nRd', { to: '2026-02-06T15:00:00Z' })
```

## Digital Objects

Entities are defined using `Noun()` from `digital-objects` — zero dependencies, zero codegen, full TypeScript inference:

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

## Packages

### SDK & Entry Points

| Package | Description |
|---------|-------------|
| [`@headlessly/sdk`](packages/sdk) | All 35 entities, `$` context, domain namespaces |
| [`@headlessly/cli`](packages/cli) | search, fetch, do — from your terminal |

### Domain Packages

| Package | Description |
|---------|-------------|
| [`@headlessly/crm`](packages/crm) | Contacts, companies, deals — your agent's CRM |
| [`@headlessly/billing`](packages/billing) | Subscriptions, invoices, payments — Stripe as truth source |
| [`@headlessly/projects`](packages/projects) | Issues, projects, comments — GitHub-synced |
| [`@headlessly/content`](packages/content) | Pages, assets, sites — headless CMS |
| [`@headlessly/support`](packages/support) | Tickets — your agent IS the support team |
| [`@headlessly/analytics`](packages/analytics) | Events, metrics, funnels, goals |
| [`@headlessly/marketing`](packages/marketing) | Campaigns, segments, forms |
| [`@headlessly/experiments`](packages/experiments) | A/B tests and feature flags |
| [`@headlessly/platform`](packages/platform) | Workflows, integrations, agents |

### Infrastructure

| Package | Description |
|---------|-------------|
| [`@headlessly/rpc`](packages/rpc) | capnweb promise pipelining via [rpc.do](https://rpc.do) |
| [`@headlessly/objects`](packages/objects) | Noun() to Durable Object in one line |
| [`@headlessly/events`](packages/events) | Immutable event log with time travel |
| [`@headlessly/mcp`](packages/mcp) | Three tools. Not three hundred. |
| [`@headlessly/code`](packages/code) | Sandboxed code execution for agents |

### Client SDKs

| Package | Description |
|---------|-------------|
| [`@headlessly/js`](packages/js) | Browser — analytics, errors, feature flags. One script, not three. |
| [`@headlessly/node`](packages/node) | Node.js — the same unified SDK, server-side |
| [`@headlessly/react`](packages/react) | React hooks — one provider for the entire graph |
| [`@headlessly/ui`](packages/ui) | Schema-driven CRUD — your Noun() IS your UI |

## Architecture

```
headless.ly                     Create an org, get everything
  └── @headlessly/sdk           35 entities, $ context, domain namespaces
       └── @headlessly/crm      Organization, Contact, Lead, Deal, Activity, Pipeline (replaces HubSpot)
       └── @headlessly/billing  Customer, Product, Plan, Price, Subscription, Invoice, Payment (replaces Stripe Dashboard)
       └── ...                  9 domain packages total
  └── @headlessly/objects       NounProvider → rpc.do → Durable Object
       └── rpc.do               capnweb promise pipelining, magic .map()
            └── @dotdo/capnweb  Cap'n Proto for the web
  └── @headlessly/events        Immutable event log, time travel, CDC
```

## License

MIT
