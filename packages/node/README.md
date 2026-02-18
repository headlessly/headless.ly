# @headlessly/node

> The same unified SDK, server-side. Analytics, errors, and feature flags in one client.

```typescript
import { createClient } from '@headlessly/node'

const headless = createClient({ apiKey: 'hl_xxx', environment: 'production' })

headless.track('order_placed', { total: 9900 }, 'user_fX9bL5nRd')
headless.captureException(err, 'user_fX9bL5nRd')
const enabled = await headless.isFeatureEnabled('new-billing', 'user_fX9bL5nRd')
```

## The Problem

Your backend has the same fragmentation problem as your frontend:

```typescript
// Three clients, three configs, three sets of credentials
import * as Segment from 'analytics-node'
import * as Sentry from '@sentry/node'
import { init as initLD } from '@launchdarkly/node-server-sdk'

const analytics = new Segment({ writeKey: 'seg_xxx' })
const sentry = Sentry.init({ dsn: 'https://xxx@sentry.io/123' })
const ld = initLD('ld_xxx')

// Three identity calls for the same user
analytics.identify({ userId: '123', traits: { plan: 'pro' } })
Sentry.setUser({ id: '123', email: 'alice@acme.co' })
const flags = await ld.variation('new-billing', { key: '123' }, false)
```

Three SDKs. Three initialization flows. Three places where user identity can drift out of sync.

## The Fix

```typescript
import { createClient } from '@headlessly/node'

const headless = createClient({
  apiKey: 'hl_xxx',
  environment: 'production',
  release: '2.1.0',
})
```

One client. One API key. Server-side analytics, error capture, and feature flag evaluation share the same identity graph. When you capture an exception for a user, you already know their feature flags and recent events.

## Install

```bash
npm install @headlessly/node
```

## Analytics

```typescript
// Track server-side events with user context
headless.track('api_called', { endpoint: '/users', method: 'GET' }, 'user_fX9bL5nRd')
headless.track('order_placed', { total: 9900, items: 3 }, 'user_fX9bL5nRd')

// Identify users with server-side traits
headless.identify('user_fX9bL5nRd', { email: 'alice@acme.co', plan: 'pro' })

// Group users into organizations
headless.group('org_k7TmPvQx', { name: 'Acme', tier: 'enterprise' }, 'user_fX9bL5nRd')
```

## Error Tracking

```typescript
try {
  await processPayment(order)
} catch (err) {
  headless.captureException(err, 'user_fX9bL5nRd', {
    tags: { service: 'billing', severity: 'critical' },
    extra: { orderId: 'order_e5JhLzXc', amount: 9900 },
  })
}

headless.captureMessage('Queue depth exceeded 10,000', 'warning')
```

Stack traces are parsed automatically. Because identity is shared, every error includes the user's current feature flags and experiment variants without additional instrumentation.

## Feature Flags

```typescript
// Server-side evaluation with user context
const enabled = await headless.isFeatureEnabled('new-billing', 'user_fX9bL5nRd')

// Typed variants
const variant = await headless.getFeatureFlag('pricing-tier', 'user_fX9bL5nRd')
// → 'control' | 'variant_a' | 'variant_b'
```

Flags are cached for 5 minutes by default. Evaluations are automatically tracked as events -- correlate flag rollouts with error rates and conversion metrics without manual instrumentation.

## Middleware

Automatically track HTTP requests and capture unhandled errors:

```typescript
import express from 'express'

const app = express()
app.use(headless.middleware())

// Every request is tracked: method, path, status, duration
// Unhandled errors are captured with full request context
app.get('/api/users', async (req, res) => {
  const users = await getUsers()
  res.json(users)
})
```

```typescript
import { Hono } from 'hono'

const app = new Hono()
app.use('*', headless.middleware())
```

The middleware adds request context to every event and error -- method, path, status code, response time -- without any manual instrumentation.

## Context & Tags

```typescript
// Global tags applied to every event and error
headless.setTag('region', 'us-east-1')
headless.setTags({ service: 'api', version: '2.1.0' })
```

## Batching & Reliability

Events are batched automatically and flushed on an interval. Retry logic handles transient failures. No events lost during deploys.

```typescript
// Manually flush when needed
await headless.flush()
```

## Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  await headless.shutdown() // Flushes all pending events, stops timers
  process.exit(0)
})
```

## Configuration

```typescript
const headless = createClient({
  apiKey: 'hl_xxx', // Required -- API key
  endpoint: 'https://headless.ly/e', // Event endpoint (default)
  environment: 'production', // Environment name
  release: '2.1.0', // Release/version identifier
  serverName: 'api-1', // Server hostname
  batchSize: 20, // Events per batch (default: 20)
  flushInterval: 10000, // Auto-flush interval in ms (default: 10s)
  maxRetries: 3, // Max retry attempts (default: 3)
  timeout: 30000, // Request timeout in ms (default: 30s)
  debug: false, // Enable debug logging
  tags: { service: 'api' }, // Default tags for all events
  onError: (err) => log(err), // Error callback
})
```

## API Reference

### Analytics

| Method                                   | Description                   |
| ---------------------------------------- | ----------------------------- |
| `track(event, properties?, distinctId?)` | Track a server-side event     |
| `identify(userId, traits?)`              | Identify a user               |
| `group(groupId, traits?, distinctId?)`   | Associate a user with a group |

### Errors

| Method                                           | Description                                             |
| ------------------------------------------------ | ------------------------------------------------------- |
| `captureException(error, distinctId?, context?)` | Capture an error with stack trace, returns event ID     |
| `captureMessage(message, level?, distinctId?)`   | Capture a message at a severity level, returns event ID |

### Feature Flags

| Method                              | Description                            |
| ----------------------------------- | -------------------------------------- |
| `getFeatureFlag(key, distinctId)`   | Get a flag value with 5-minute caching |
| `isFeatureEnabled(key, distinctId)` | Check if a flag is enabled             |

### Context

| Method               | Description              |
| -------------------- | ------------------------ |
| `setTag(key, value)` | Set a global tag         |
| `setTags(tags)`      | Set multiple global tags |

### Middleware

| Method         | Description                                                              |
| -------------- | ------------------------------------------------------------------------ |
| `middleware()` | Express/Hono middleware for automatic request tracking and error capture |

### Lifecycle

| Method       | Description                                     |
| ------------ | ----------------------------------------------- |
| `flush()`    | Flush pending events immediately                |
| `shutdown()` | Stop the flush timer and flush remaining events |

## License

MIT
