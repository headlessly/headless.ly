# @headlessly/experiments

> LaunchDarkly manages feature flags. Optimizely runs A/B tests. Neither knows what your customers are paying or why they churn.

```typescript
import { Experiment, FeatureFlag } from '@headlessly/experiments'

await Experiment.create({
  name: 'Pricing Page CTA',
  type: 'ABTest',
  hypothesis: 'Changing CTA to "Get Started" increases conversions by 15%',
  primaryMetric: 'signup_conversion',
  trafficAllocation: 100,
})
await Experiment.start('experiment_fX9bL5nRd')

// An experiment concludes — billing, CRM, and marketing react instantly
Experiment.concluded(async (experiment, $) => {
  await $.FeatureFlag.enable(experiment.winner)
  await $.Campaign.create({ name: `Roll out ${experiment.name}`, type: 'Email' })
  await $.Event.create({ type: 'experiment.concluded', value: experiment.winner })
})
```

No LaunchDarkly SDK. No Optimizely webhook relay. No Split analytics pipeline. Experiments, feature flags, and the entire business graph — in one typed system your agent can operate autonomously.

## The Problem

LaunchDarkly charges per seat for feature flags that live in complete isolation from your business data. Optimizely runs A/B tests that require custom analytics instrumentation to measure anything meaningful. Split gives you both but needs three integrations to connect flags to metrics to users.

None of them were built for an AI agent to operate.

Your agent doesn't need a flag management dashboard. It needs `FeatureFlag.enable()`. It doesn't need an experiment results page with confidence interval charts. It needs `Experiment.conclude()`. It doesn't need a "targeting builder" GUI with drag-and-drop rules. It needs a BEFORE hook:

```typescript
Experiment.starting(experiment => {
  if (!experiment.hypothesis) throw new Error('No experiment without a hypothesis')
})
```

And none of them connect to the rest of your business. When an experiment concludes in Optimizely, does your CRM know which contacts saw which variant? Does your billing system know if the winning variant increased conversion to paid? Does your marketing team know it's time to announce the change?

Not without custom instrumentation, webhook handlers, and a prayer.

## One Typed Graph

When an experiment concludes in headless.ly, your analytics already know. Your CRM already knows. Your billing already knows. Because they're the same system:

```typescript
import { Experiment, FeatureFlag } from '@headlessly/experiments'

Experiment.concluded(async (experiment, $) => {
  await $.FeatureFlag.enable(experiment.winner)
  await $.Contact.find({ segment: experiment.targetAudience })
    .map(c => $.Event.create({ type: 'variant.won', contact: c.$id, value: experiment.winner }))
  await $.Campaign.create({ name: `${experiment.name} winner`, type: 'Announcement' })
})

FeatureFlag.enabled(async (flag, $) => {
  await $.Event.create({ type: 'flag.enabled', value: flag.key })
  await $.Metric.create({ name: `${flag.key}_rollout`, value: flag.rolloutPercentage, type: 'Gauge' })
})

FeatureFlag.disabled(async (flag, $) => {
  await $.Ticket.create({ subject: `Flag "${flag.key}" killed — investigate regressions`, priority: 'High' })
})
```

Experiments measure conversion using the same analytics events, against the same CRM contacts, tied to the same billing subscriptions. Feature flags control behavior for real customer segments — not just user IDs in a separate system. When an experiment concludes, the winning variant can trigger campaigns, update products, or adjust pricing — all in the same graph.

No webhooks. No Zapier. No analytics pipeline glue. One graph.

## Install

```bash
npm install @headlessly/experiments
```

## Entities

### Experiment

A/B tests, multivariate tests, and ML/prompt experiments with hypothesis tracking, variant definitions, and statistical results.

```typescript
import { Experiment } from '@headlessly/experiments'

const experiment = await Experiment.create({
  name: 'Pricing Page CTA',
  slug: 'pricing-page-cta',
  type: 'ABTest',
  hypothesis: 'Changing the CTA from "Start Free" to "Get Started" increases conversions by 15%',
  variants: JSON.stringify([
    { key: 'control', name: 'Start Free', weight: 50 },
    { key: 'treatment', name: 'Get Started', weight: 50 },
  ]),
  primaryMetric: 'signup_conversion',
  trafficAllocation: 100,
})

await Experiment.start(experiment.$id)
await Experiment.pause(experiment.$id)
await Experiment.conclude(experiment.$id)

Experiment.concluded((experiment, $) => {
  $.FeatureFlag.enable(experiment.winner)
})
```

**Verbs**: `start()` · `starting()` · `started()` · `startedBy` · `conclude()` · `concluding()` · `concluded()` · `concludedBy` · `pause()` · `pausing()` · `paused()` · `pausedBy`

**Key fields**: name, slug, hypothesis, type (`ABTest | Multivariate | FeatureFlag | MLExperiment | PromptExperiment`), status (`Draft | Running | Paused | Completed | Archived`), trafficAllocation, variants, primaryMetric, winner, confidence, sampleSize

**Relationships**: → Organization, → Owner (Contact), ← FeatureFlags[]

### FeatureFlag

Feature flags with targeting rules, gradual rollout, and evaluation tracking.

```typescript
import { FeatureFlag } from '@headlessly/experiments'

const flag = await FeatureFlag.create({
  key: 'new-dashboard',
  name: 'New Dashboard',
  description: 'Redesigned analytics dashboard',
  type: 'Boolean',
  defaultValue: 'false',
  rolloutPercentage: 25,
  status: 'Active',
})

await FeatureFlag.rollout(flag.$id)
await FeatureFlag.enable(flag.$id)
await FeatureFlag.disable(flag.$id)

FeatureFlag.rolledOut((flag) => {
  console.log(`"${flag.key}" rolled out to ${flag.rolloutPercentage}%`)
})
```

**Verbs**: `rollout()` · `rollingOut()` · `rolledOut()` · `rolledOutBy` · `enable()` · `enabling()` · `enabled()` · `enabledBy` · `disable()` · `disabling()` · `disabled()` · `disabledBy`

**Key fields**: key, name, type (`Boolean | String | Number | JSON`), status (`Draft | Active | Paused | Archived`), defaultValue, rolloutPercentage, targetingRules, evaluations, lastEvaluatedAt

**Relationships**: → Organization, → Experiment

## Agent-Native

Your agent connects to one MCP endpoint. It can run your entire experimentation stack:

```json title="experiments.headless.ly/mcp#search"
{ "type": "Experiment", "filter": { "status": "Running", "confidence": { "$gte": 95 } } }
```

```json title="experiments.headless.ly/mcp#fetch"
{ "type": "Experiment", "id": "experiment_fX9bL5nRd", "include": ["owner", "organization"] }
```

```ts title="experiments.headless.ly/mcp#do"
const mature = await $.Experiment.find({ status: 'Running', confidence: { '$gte': 95 } })
for (const experiment of mature) {
  await $.Experiment.conclude(experiment.$id)
  await $.FeatureFlag.enable(experiment.winner)
  await $.Campaign.create({
    name: `Ship ${experiment.name}`,
    type: 'Announcement',
  })
}
```

Three tools. Not three SDKs.

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const winningFlags = await Experiment.find({ status: 'Completed' })
  .filter(e => e.confidence >= 95)
  .map(e => e.winner)
```

## License

MIT
