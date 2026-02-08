# @headlessly/experiments

Experimentation entities for A/B tests, multivariate experiments, and feature flags — typed Digital Objects with rollout and targeting controls.

## Install

```bash
npm install @headlessly/experiments
```

## Entities

### Experiment

A/B tests, multivariate tests, and ML/prompt experiments with variant tracking and statistical results.

```typescript
import { Experiment } from '@headlessly/experiments'

await Experiment.create({
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
  organization: 'organization_e5JhLzXc',
})

await Experiment.start('experiment_fX9bL5nRd')
await Experiment.pause('experiment_fX9bL5nRd')
await Experiment.conclude('experiment_fX9bL5nRd')
```

**Fields**: `name`, `slug`, `description`, `hypothesis`, `type`, `status`, `startAt`, `endAt`, `targetAudience`, `trafficAllocation`, `variants`, `metrics`, `primaryMetric`, `results`, `winner`, `confidence`, `sampleSize`, `conversions`, `tags`

**Relationships**:
- `organization` -> Organization
- `owner` -> Contact

**Verbs**: `start()` / `starting()` / `started()` / `startedBy`, `conclude()` / `concluding()` / `concluded()` / `concludedBy`, `pause()` / `pausing()` / `paused()` / `pausedBy`

**Enums**:
- `type`: ABTest | Multivariate | FeatureFlag | MLExperiment | PromptExperiment
- `status`: Draft | Running | Paused | Completed | Archived

### FeatureFlag

Feature flags with targeting rules, gradual rollout, and evaluation tracking.

```typescript
import { FeatureFlag } from '@headlessly/experiments'

await FeatureFlag.create({
  key: 'new-dashboard',
  name: 'New Dashboard',
  description: 'Redesigned analytics dashboard',
  type: 'Boolean',
  defaultValue: 'false',
  rolloutPercentage: 25,
  status: 'Active',
  organization: 'organization_e5JhLzXc',
})

await FeatureFlag.rollout('featureflag_k7TmPvQx')
await FeatureFlag.enable('featureflag_k7TmPvQx')
await FeatureFlag.disable('featureflag_k7TmPvQx')
```

**Fields**: `key`, `name`, `description`, `type`, `defaultValue`, `variants`, `targetingRules`, `status`, `rolloutPercentage`, `evaluations`, `lastEvaluatedAt`

**Relationships**:
- `organization` -> Organization
- `experiment` -> Experiment

**Verbs**: `rollout()` / `rollingOut()` / `rolledOut()` / `rolledOutBy`, `enable()` / `enabling()` / `enabled()` / `enabledBy`, `disable()` / `disabling()` / `disabled()` / `disabledBy`

**Enums**:
- `type`: Boolean | String | Number | JSON
- `status`: Draft | Active | Paused | Archived

## Event-Driven Reactions

React to experimentation lifecycle events:

```typescript
import { Experiment, FeatureFlag } from '@headlessly/experiments'

Experiment.concluded((experiment) => {
  console.log(`Experiment "${experiment.name}" concluded — winner: ${experiment.winner}`)
})

FeatureFlag.rolledOut((flag) => {
  console.log(`Flag "${flag.key}" rolled out to ${flag.rolloutPercentage}%`)
})

FeatureFlag.disabled((flag) => {
  console.log(`Flag "${flag.key}" disabled`)
})
```

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const running = await Experiment.find({ status: 'Running' })
  .filter(e => e.confidence >= 95)
```

## License

MIT
