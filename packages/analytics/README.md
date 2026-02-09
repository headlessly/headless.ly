# @headlessly/analytics

Analytics entities for events, metrics, funnels, and goals — immutable event capture with typed dimensions and conversion tracking.

## Install

```bash
npm install @headlessly/analytics
```

## Entities

### Event

Immutable events captured from browser, Node, API, or edge snippets. Events cannot be updated or deleted — every event is permanent.

```typescript
import { Event } from '@headlessly/analytics'

await Event.create({
  name: 'page_view',
  type: 'track',
  source: 'Browser',
  timestamp: '2025-01-15T10:30:00Z',
  url: 'https://acme.co/pricing',
  path: '/pricing',
  sessionId: 'sess_k7TmPvQx',
})
```

**Fields**: `name`, `type`, `data`, `source`, `sessionId`, `userId`, `anonymousId`, `timestamp`, `url`, `path`, `referrer`, `properties`

**Relationships**:

- `organization` -> Organization

**Immutability**: `update: null`, `delete: null` — events are append-only

**Enums**:

- `source`: Browser | Node | API | Snippet

### Metric

Named metric values with typed aggregation — counters, gauges, histograms, summaries.

```typescript
import { Metric } from '@headlessly/analytics'

await Metric.create({
  name: 'mrr',
  value: 24500,
  type: 'Gauge',
  unit: 'cents',
  organization: 'organization_e5JhLzXc',
})
```

**Fields**: `name`, `value`, `type`, `unit`, `dimensions`, `timestamp`

**Relationships**:

- `organization` -> Organization

**Enums**:

- `type`: Counter | Gauge | Histogram | Summary

### Funnel

Multi-step conversion funnels with step definitions and aggregate conversion rate.

```typescript
import { Funnel } from '@headlessly/analytics'

await Funnel.create({
  name: 'Signup to Paid',
  description: 'Track conversion from signup through first payment',
  steps: JSON.stringify([
    { name: 'Signup', event: 'signup' },
    { name: 'Onboarding', event: 'onboarding_complete' },
    { name: 'Trial Start', event: 'trial_started' },
    { name: 'Payment', event: 'payment_succeeded' },
  ]),
  organization: 'organization_e5JhLzXc',
})
```

**Fields**: `name`, `description`, `steps`, `conversionRate`

**Relationships**:

- `organization` -> Organization

### Goal

Trackable business objectives with targets, progress, and time periods.

```typescript
import { Goal } from '@headlessly/analytics'

await Goal.create({
  name: 'Q1 MRR Target',
  target: 100000,
  current: 67500,
  unit: 'cents',
  period: 'Quarterly',
  status: 'OnTrack',
  organization: 'organization_e5JhLzXc',
})

await Goal.achieve('goal_mN8pZwKj')
```

**Fields**: `name`, `description`, `target`, `current`, `unit`, `period`, `status`

**Relationships**:

- `organization` -> Organization

**Verbs**: `achieve()` / `achieving()` / `achieved()` / `achievedBy`

**Enums**:

- `period`: Daily | Weekly | Monthly | Quarterly | Yearly
- `status`: OnTrack | AtRisk | Behind | Achieved

## Event-Driven Reactions

React to analytics events across the graph:

```typescript
import { Goal, Event } from '@headlessly/analytics'

Goal.achieved((goal) => {
  console.log(`Goal "${goal.name}" achieved: ${goal.current}/${goal.target}`)
})
```

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const active = await Goal.find({ status: 'OnTrack' }).filter((g) => g.period === 'Monthly')
```

## License

MIT
