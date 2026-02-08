# @headlessly/node

Node.js SDK for headless.ly -- server-side analytics, error tracking, and feature flags.

## Install

```bash
npm install @headlessly/node
```

## Usage

```typescript
import { createClient } from '@headlessly/node'

const headless = createClient({
  apiKey: 'hl_xxx',
  environment: 'production',
  release: '1.2.0',
})

// Track server-side events
headless.track('api_called', { endpoint: '/users', method: 'GET' }, 'user_fX9bL5')
headless.identify('user_fX9bL5', { email: 'alice@acme.co', plan: 'pro' })
headless.group('org_k7TmPv', { name: 'Acme', tier: 'enterprise' }, 'user_fX9bL5')

// Capture errors
try {
  await processPayment()
} catch (err) {
  headless.captureException(err, 'user_fX9bL5', {
    tags: { service: 'billing' },
    extra: { amount: 9900 },
  })
}

headless.captureMessage('Queue depth exceeded threshold', 'warning')

// Feature flags (server-side evaluation)
const enabled = await headless.isFeatureEnabled('new-billing', 'user_fX9bL5')
const variant = await headless.getFeatureFlag('pricing-tier', 'user_fX9bL5')
```

### Express/Hono Middleware

Automatically tracks HTTP requests and captures unhandled errors.

```typescript
// Express
app.use(headless.middleware())

// Hono
app.use('*', headless.middleware())
```

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  await headless.shutdown()
  process.exit(0)
})
```

## API

### `createClient(config)`

Create a new Node.js client instance.

**Config:**

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | required | API key |
| `endpoint` | `string` | `'https://headless.ly/e'` | Event endpoint |
| `debug` | `boolean` | `false` | Enable debug logging |
| `release` | `string` | -- | Release/version identifier |
| `environment` | `string` | -- | Environment name |
| `serverName` | `string` | -- | Server hostname |
| `batchSize` | `number` | `20` | Events per batch |
| `flushInterval` | `number` | `10000` | Auto-flush interval in ms |
| `maxRetries` | `number` | `3` | Max retry attempts |
| `timeout` | `number` | `30000` | Request timeout in ms |
| `tags` | `Record<string, string>` | -- | Default tags for all events |
| `onError` | `(error: Error) => void` | -- | Error callback |

### Analytics

- **`track(event, properties?, distinctId?)`** -- track an event
- **`identify(userId, traits?)`** -- identify a user
- **`group(groupId, traits?, distinctId?)`** -- associate a user with a group

### Error Tracking

- **`captureException(error, distinctId?, context?)`** -- capture an error with stack trace parsing, returns event ID
- **`captureMessage(message, level?, distinctId?)`** -- capture a message at a severity level, returns event ID

### Feature Flags

- **`getFeatureFlag(key, distinctId)`** -- get a flag value with 5-minute caching
- **`isFeatureEnabled(key, distinctId)`** -- check if a flag is enabled

### Context

- **`setTag(key, value)`** -- set a global tag
- **`setTags(tags)`** -- set multiple global tags

### Middleware

- **`middleware()`** -- Express/Hono middleware for automatic request tracking and error capture

### Lifecycle

- **`flush()`** -- flush pending events immediately
- **`shutdown()`** -- stop the flush timer and flush remaining events

## License

MIT
