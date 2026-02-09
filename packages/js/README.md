# @headlessly/js

> One script tag. Not three. Analytics, errors, and feature flags -- unified.

```typescript
import headless from '@headlessly/js'

headless.init({ apiKey: 'hl_xxx' })

// One SDK does what three used to
headless.track('signup_completed', { plan: 'pro' })
headless.captureException(new Error('Payment failed'))
if (headless.isFeatureEnabled('new-checkout')) showNewCheckout()
```

## The Problem

Today your frontend loads three SDKs:

```
Mixpanel    → analytics     → 36KB gzipped
Sentry      → error tracking → 28KB gzipped
LaunchDarkly → feature flags  → 22KB gzipped
─────────────────────────────────────────────
3 SDKs, 3 init calls, 3 identity systems, 86KB
```

Each one maintains its own user identity. Each one sends its own network requests. When a user hits an error, you can't see what experiment variant they were in. When you roll out a feature flag, you can't correlate it with error rates. The data lives in three separate silos.

## The Fix

```typescript
import headless from '@headlessly/js'

headless.init({ apiKey: 'hl_xxx' })
headless.identify('user_fX9bL5nRd', { email: 'alice@acme.co', plan: 'pro' })
```

One identity. One SDK. Analytics events, error captures, and feature flag evaluations are all entities in the same graph. When a feature flag is enabled for a user, their analytics events already carry that context. When an error is captured, you already know what experiment variant they were in.

## Install

```bash
npm install @headlessly/js
```

## Analytics

```typescript
// Page views
headless.page('/pricing')
headless.page('/checkout', { source: 'banner' })

// Custom events
headless.track('signup_completed', { plan: 'pro' })
headless.track('feature_used', { feature: 'export', format: 'csv' })

// Identity
headless.identify('user_fX9bL5nRd', { email: 'alice@acme.co' })
headless.alias('user_fX9bL5nRd', 'anon_k7TmPvQx')
headless.group('org_e5JhLzXc', { name: 'Acme', tier: 'enterprise' })
```

## Error Tracking

```typescript
try {
  await processPayment()
} catch (err) {
  headless.captureException(err, {
    tags: { component: 'checkout' },
    extra: { cartItems: 3, total: 9900 },
  })
}

headless.captureMessage('Payment retry succeeded', 'warning')

// Breadcrumbs for error context
headless.addBreadcrumb({ category: 'ui', message: 'Clicked checkout button' })
```

Because identity is shared, every error capture automatically includes the user's current feature flags, experiment variants, and recent analytics events. No manual correlation required.

## Feature Flags

```typescript
// Boolean check
if (headless.isFeatureEnabled('new-checkout')) {
  showNewCheckout()
}

// Typed variants
const variant = headless.getFeatureFlag('pricing-experiment')
// → 'control' | 'variant_a' | 'variant_b'

// All flags at once
const flags = headless.getAllFlags()

// Refresh from server
await headless.reloadFeatureFlags()
```

When a feature flag is evaluated, a `$featureFlagEvaluated` event is automatically tracked -- so your analytics already know which variant each user saw without additional instrumentation.

## Web Vitals

```typescript
headless.captureWebVitals({ LCP: 1200, FID: 50, CLS: 0.05 })
```

Web vitals are entities in the same graph. Correlate performance regressions with feature flag rollouts and error spikes -- all in one query.

## Context & Tags

```typescript
headless.setUser({ id: 'user_fX9bL5nRd', email: 'alice@acme.co' })
headless.setTag('environment', 'production')
headless.setTags({ release: '2.1.0', region: 'us-east' })
headless.setExtra('cartContents', { items: 3, total: 9900 })
```

Tags and context are shared across analytics, errors, and feature flags. Set it once, every subsystem sees it.

## Privacy Controls

```typescript
headless.optOut()          // Stop all tracking immediately
headless.optIn()           // Resume tracking
headless.hasOptedOut()     // Check opt-out status
headless.reset()           // Clear all local state and identity
```

One opt-out controls everything. Not three separate consent flows.

## Lifecycle

```typescript
headless.flush()           // Send all pending events now
headless.shutdown()        // Flush and clean up
```

## Session

```typescript
headless.getDistinctId()   // Current distinct ID
headless.getSessionId()    // Current session ID
```

## Advanced

```typescript
import { HeadlessClient } from '@headlessly/js'

// Multiple instances for different tenants
const prod = new HeadlessClient({ apiKey: 'hl_prod_xxx' })
const staging = new HeadlessClient({ apiKey: 'hl_staging_xxx' })
```

## API Reference

### Init & Identity

| Method | Description |
|---|---|
| `init(config)` | Initialize with API key and options |
| `identify(userId, traits?)` | Identify a user |
| `alias(userId, previousId?)` | Alias two user IDs |
| `group(groupId, traits?)` | Associate user with a group |
| `setUser(user)` | Set or clear the current user |

### Analytics

| Method | Description |
|---|---|
| `page(name?, properties?)` | Track a page view |
| `track(event, properties?)` | Track a custom event |
| `captureWebVitals(metrics)` | Capture LCP, FID, CLS |

### Errors

| Method | Description |
|---|---|
| `captureException(error, context?)` | Capture an error with tags and extra data |
| `captureMessage(message, level?)` | Capture a message at a severity level |
| `addBreadcrumb(crumb)` | Add a breadcrumb for error context |

### Feature Flags

| Method | Description |
|---|---|
| `getFeatureFlag(key)` | Get a flag value (boolean, string, number, or object) |
| `isFeatureEnabled(key)` | Check if a flag is enabled |
| `getAllFlags()` | Get all feature flags |
| `reloadFeatureFlags()` | Refresh flags from the server |

### Context

| Method | Description |
|---|---|
| `setTag(key, value)` | Set a context tag |
| `setTags(tags)` | Set multiple tags |
| `setExtra(key, value)` | Set extra context data |

### Lifecycle

| Method | Description |
|---|---|
| `flush()` | Flush pending events immediately |
| `shutdown()` | Flush and clean up |
| `optOut()` | Stop all tracking |
| `optIn()` | Resume tracking |
| `hasOptedOut()` | Check opt-out status |
| `reset()` | Clear all state |
| `getDistinctId()` | Get the current distinct ID |
| `getSessionId()` | Get the current session ID |
| `getInstance()` | Get the underlying HeadlessClient instance |

## License

MIT
