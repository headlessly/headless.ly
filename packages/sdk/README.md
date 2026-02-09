# @headlessly/sdk

> One SDK. 32 entities. Every tool your agent needs to run a business.

```typescript
import { $ } from '@headlessly/sdk'

// A deal closes — CRM, billing, marketing, and analytics react as one system
$.Deal.closed(async (deal, $) => {
  await $.Subscription.create({ plan: 'pro', customer: deal.contact })
  await $.Campaign.create({ name: `Onboard ${deal.name}`, type: 'Email' })
  await $.Event.create({ type: 'deal.closed', value: deal.value })
})

// A subscription cancels — support and CRM know instantly
$.Subscription.cancelled(async (sub, $) => {
  await $.Ticket.create({ subject: 'Cancellation follow-up', requester: sub.customer })
  await $.Contact.update(sub.customer, { stage: 'Churned' })
})
```

That's CRM, billing, marketing, analytics, and support — in twelve lines. No webhooks. No API mappings. No integration middleware. One typed graph.

## The Problem

Every business runs on the same 32 entities — contacts, deals, subscriptions, invoices, tickets, campaigns, projects, events. Today, each one lives in a different SaaS product with a different API, different auth, different data model, and different webhook format.

Your agent needs 15 API keys, 15 webhook endpoints, and hundreds of lines of glue code before it can do anything useful.

```
                   One Typed Graph
                         |
    Human-First -------- + -------- Agent-Native
                         |
                   Integration Hell
```

**Bottom-right** is where most startups live today: great APIs (Stripe, GitHub, Twilio) that don't talk to each other. **Top-left** is the enterprise suite (Salesforce, HubSpot) — unified but built for humans clicking buttons.

**Top-right** is headless.ly: agent-native architecture on one typed graph. 32 entities, three MCP tools, full verb conjugation. The architecture IS the product.

## Install

```bash
npm install @headlessly/sdk
```

## The `$` Universal Context

`$` gives your agent access to every entity in the graph:

```typescript
import { $ } from '@headlessly/sdk'

await $.Contact.create({ name: 'Alice Chen', email: 'alice@acme.co', stage: 'Lead' })
await $.Contact.qualify('contact_fX9bL5nRd')
await $.Deal.create({ name: 'Acme Enterprise', value: 50000, stage: 'Qualification' })
await $.Subscription.create({ plan: 'pro', customer: 'customer_k7TmPvQx' })
await $.Event.create({ type: 'onboarding.started', contact: 'contact_fX9bL5nRd' })
```

Five lines. Five domains. One import. That's what agent-native means.

## Domain Namespaces

Import by domain when you want scoped access:

```typescript
import { crm, billing, projects } from '@headlessly/sdk'

await crm.Contact.create({ name: 'Alice', stage: 'Lead' })
await billing.Subscription.create({ plan: 'pro', contact: 'contact_fX9bL5nRd' })
await projects.Issue.create({ title: 'Onboard Alice', project: 'project_e5JhLzXc' })
```

Or import entities directly from domain packages:

```typescript
import { Contact, Deal } from '@headlessly/crm'
import { Subscription } from '@headlessly/billing'
import { Issue } from '@headlessly/projects'
```

## Nine Domains, One Graph

| Domain | Package | Entities | Replaces |
|--------|---------|----------|----------|
| **CRM** | `@headlessly/crm` | Contact, Company, Deal | HubSpot, Salesforce, Pipedrive |
| **Billing** | `@headlessly/billing` | Customer, Product, Price, Subscription, Invoice, Payment | Stripe Dashboard + billing logic |
| **Projects** | `@headlessly/projects` | Project, Issue, Comment | Jira, Linear, Asana |
| **Content** | `@headlessly/content` | Content, Asset, Site | Contentful, Sanity, WordPress |
| **Support** | `@headlessly/support` | Ticket | Zendesk, Intercom, Freshdesk |
| **Analytics** | `@headlessly/analytics` | Event, Metric, Funnel, Goal | Mixpanel, Amplitude, PostHog |
| **Marketing** | `@headlessly/marketing` | Campaign, Segment, Form | Mailchimp, ActiveCampaign |
| **Experiments** | `@headlessly/experiments` | Experiment, FeatureFlag | LaunchDarkly, Optimizely |
| **Platform** | `@headlessly/platform` | Workflow, Integration, Agent | Zapier, Make, n8n |

Plus **Identity** (User, Organization, ApiKey) and **Communication** (Message) in the core SDK.

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

An AI agent connects to one MCP server and can operate your entire business. Search across every entity. Fetch anything with its relationships. Execute any operation. That's it.

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

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain dependent operations in a single round-trip:

```typescript
// One round-trip, not three
const openDeals = await $.Contact
  .find({ stage: 'Qualified' })
  .map(contact => contact.deals)
  .filter(deal => deal.stage === 'Open')
```

```typescript
// Automatic batching — concurrent calls become one request
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

## Domain Packages

| Package | Description |
|---------|-------------|
| [`@headlessly/crm`](packages/crm) | Contacts, companies, deals — your agent's CRM |
| [`@headlessly/billing`](packages/billing) | Subscriptions, invoices, payments — Stripe as truth source |
| [`@headlessly/projects`](packages/projects) | Issues, projects, comments — GitHub-synced |
| [`@headlessly/content`](packages/content) | Pages, assets, sites — headless CMS |
| [`@headlessly/support`](packages/support) | Tickets — headless help desk |
| [`@headlessly/analytics`](packages/analytics) | Events, metrics, funnels, goals |
| [`@headlessly/marketing`](packages/marketing) | Campaigns, segments, forms |
| [`@headlessly/experiments`](packages/experiments) | A/B tests, feature flags |
| [`@headlessly/platform`](packages/platform) | Workflows, integrations, agents |

### Infrastructure

| Package | Description |
|---------|-------------|
| [`@headlessly/rpc`](packages/rpc) | capnweb promise pipelining via [rpc.do](https://rpc.do) |
| [`@headlessly/objects`](packages/objects) | Durable Object-backed NounProvider |
| [`@headlessly/events`](packages/events) | Immutable event log with time travel |
| [`@headlessly/mcp`](packages/mcp) | MCP server — search, fetch, do |
| [`@headlessly/code`](packages/code) | Sandboxed code execution |

### Client SDKs

| Package | Description |
|---------|-------------|
| [`@headlessly/js`](packages/js) | Browser — analytics, errors, feature flags |
| [`@headlessly/node`](packages/node) | Node.js — server-side SDK |
| [`@headlessly/react`](packages/react) | React hooks and providers |
| [`@headlessly/ui`](packages/ui) | Schema-driven CRUD components |

## License

MIT
