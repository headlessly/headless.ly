# @headlessly/analytics

> Your analytics tool is a silo. Your agent deserves a graph.

```typescript
import { Event, Goal } from '@headlessly/analytics'

await Event.create({ name: 'signup', source: 'Browser', url: 'https://acme.co/signup' })

// A goal is achieved — CRM, billing, and marketing react instantly
Goal.achieved(async (goal, $) => {
  await $.Campaign.create({ name: `Celebrate ${goal.name}`, type: 'Email' })
  await $.Contact.find({ stage: 'Lead' }).map(c => $.Contact.qualify(c.$id))
  await $.Event.create({ name: 'goal.achieved', source: 'API', properties: { goal: goal.$id } })
})
```

No Mixpanel project. No Amplitude taxonomy. No PostHog pipeline. Events, metrics, funnels, and goals — in one typed system your agent can operate autonomously.

## The Problem

Mixpanel has a query language your agent can't write. Amplitude has a taxonomy builder designed for product managers clicking dropdowns. PostHog is open-source and developer-friendly, but it's still a separate analytics silo — events go in, dashboards come out, and nothing connects back.

None of them know about your CRM contacts, billing subscriptions, or support tickets.

You want to know which contacts from a specific campaign converted to paid subscriptions and then opened support tickets? That's three systems, three APIs, three data models, and a data warehouse to join them. Your agent needs a PhD in ETL to answer a simple business question.

```typescript
Event.creating(event => {
  if (!event.name) throw new Error('Events require a name')
  if (!event.source) throw new Error('Events require a source')
})
```

## One Typed Graph

When you track an event in Mixpanel, does your CRM know which contact triggered it? Does your billing system know which subscription was active? Does your support system see the user's journey before they filed a ticket?

Not without a data warehouse, dbt models, and an analytics engineer.

In headless.ly, an event already knows its contact, its subscription context, its deal — because they're all nodes in the same graph:

```typescript
import { Event, Funnel } from '@headlessly/analytics'

Event.created(async (event, $) => {
  if (event.name === 'trial_expired') {
    const contact = await $.Contact.get(event.userId)
    await $.Ticket.create({ subject: `Trial expired: ${contact.name}`, requester: contact.$id })
    await $.Campaign.create({ name: `Win-back: ${contact.name}`, type: 'Email' })
  }
})

Funnel.created(async (funnel, $) => {
  await $.Goal.create({
    name: `${funnel.name} conversion target`,
    target: 25,
    current: 0,
    unit: 'percent',
    period: 'Monthly',
    status: 'OnTrack',
  })
})
```

No ETL pipeline. No reverse ETL. No warehouse joins. One graph.

## Install

```bash
npm install @headlessly/analytics
```

## Entities

### Event

Immutable events — append-only, no updates, no deletes. Every user action, system event, and agent operation is a permanent record.

```typescript
import { Event } from '@headlessly/analytics'

await Event.create({
  name: 'page_view',
  source: 'Browser',
  url: 'https://acme.co/pricing',
  path: '/pricing',
  sessionId: 'sess_k7TmPvQx',
  properties: { referrer: 'google.com', utm_source: 'blog' },
})

await Event.create({
  name: 'deal.closed',
  source: 'API',
  properties: { dealId: 'deal_fX9bL5nRd', value: 50000 },
})
```

**Immutability**: `update: null`, `delete: null` — events are append-only. This is not a limitation; it's trust.

**Key fields**: name, type, data, source (`Browser | Node | API | Snippet`), sessionId, userId, anonymousId, timestamp, url, path, referrer, properties

**Relationships**: -> Organization

### Metric

Named measurements with typed aggregation — track counters, gauges, histograms, and summaries across your entire business.

```typescript
import { Metric } from '@headlessly/analytics'

await Metric.create({
  name: 'mrr',
  value: 24500,
  type: 'Gauge',
  unit: 'cents',
  dimensions: { plan: 'pro', segment: 'startup' },
})

await Metric.create({
  name: 'api_requests',
  value: 1,
  type: 'Counter',
  unit: 'requests',
})
```

**Key fields**: name, value, type (`Counter | Gauge | Histogram | Summary`), unit, dimensions, timestamp

**Relationships**: -> Organization

### Funnel

Multi-step conversion funnels that span your entire business — not just pageviews, but lead-to-qualified-to-customer-to-churned.

```typescript
import { Funnel } from '@headlessly/analytics'

await Funnel.create({
  name: 'Lead to Paid',
  description: 'Full lifecycle from first touch to first payment',
  steps: JSON.stringify([
    { name: 'First Visit', event: 'page_view' },
    { name: 'Signup', event: 'signup' },
    { name: 'Qualified', event: 'contact.qualified' },
    { name: 'Deal Created', event: 'deal.created' },
    { name: 'Payment', event: 'payment.succeeded' },
  ]),
})
```

**Key fields**: name, description, steps, conversionRate

**Relationships**: -> Organization

### Goal

Business objectives with targets, progress tracking, and time periods — tied directly to real metrics, not vanity dashboards.

```typescript
import { Goal } from '@headlessly/analytics'

const goal = await Goal.create({
  name: 'Q1 Revenue Target',
  target: 100000,
  current: 67500,
  unit: 'cents',
  period: 'Quarterly',
  status: 'OnTrack',
})

await Goal.achieve(goal.$id)

Goal.achieved(async (goal, $) => {
  await $.Event.create({ name: 'goal.achieved', source: 'API', properties: { goal: goal.$id } })
  await $.Campaign.create({ name: `We hit ${goal.name}!`, type: 'Email' })
})
```

**Verbs**: `achieve()` · `achieving()` · `achieved()` · `achievedBy`

**Key fields**: name, description, target, current, unit, period (`Daily | Weekly | Monthly | Quarterly | Yearly`), status (`OnTrack | AtRisk | Behind | Achieved`)

**Relationships**: -> Organization

## Agent-Native

Your agent connects to one MCP endpoint. It can query events, track metrics, and monitor goals:

```json title="analytics.headless.ly/mcp#search"
{ "type": "Event", "filter": { "name": "signup", "source": "Browser", "timestamp": { "$gte": "2026-01-01" } } }
```

```json title="analytics.headless.ly/mcp#fetch"
{ "type": "Goal", "id": "goal_mN8pZwKj", "include": ["organization"] }
```

```ts title="analytics.headless.ly/mcp#do"
const atRisk = await $.Goal.find({ status: 'AtRisk' })
for (const goal of atRisk) {
  await $.Ticket.create({
    subject: `Goal at risk: ${goal.name} (${goal.current}/${goal.target})`,
    priority: 'High',
  })
  await $.Campaign.create({
    name: `Push for ${goal.name}`,
    type: 'Email',
  })
}
```

Three tools. Not three hundred endpoints.

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const funnelGoals = await Funnel.find({ conversionRate: { $lt: 10 } })
  .map(f => f.goals)
  .filter(g => g.status === 'Behind')
```

## License

MIT
