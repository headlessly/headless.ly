# @headlessly/js

Browser SDK for headless.ly -- unified analytics, error tracking, and feature flags.

## Install

```bash
npm install @headlessly/js
```

## Usage

```typescript
import headless from '@headlessly/js'

headless.init({ apiKey: 'hl_xxx' })

// Analytics
headless.page('/pricing')
headless.track('signup_completed', { plan: 'pro' })
headless.identify('user_fX9bL5', { email: 'alice@acme.co' })
headless.group('org_k7TmPv', { name: 'Acme' })

// Error tracking
try {
  doSomething()
} catch (err) {
  headless.captureException(err, {
    tags: { component: 'checkout' },
    extra: { cartItems: 3 },
  })
}
headless.captureMessage('Payment retry succeeded', 'warning')

// Feature flags
if (headless.isFeatureEnabled('new-checkout')) {
  showNewCheckout()
}
const variant = headless.getFeatureFlag('pricing-experiment')

// Web vitals
headless.captureWebVitals({ LCP: 1200, FID: 50, CLS: 0.05 })
```

### Privacy Controls

```typescript
headless.optOut() // Stop all tracking
headless.optIn() // Resume tracking
headless.hasOptedOut() // Check opt-out status
headless.reset() // Clear all state
```

### Lifecycle

```typescript
headless.flush() // Flush pending events immediately
headless.shutdown() // Flush and clean up
```

## API

### Analytics

- **`init(config)`** -- initialize with API key and options
- **`page(name?, properties?)`** -- track a page view
- **`track(event, properties?)`** -- track a custom event
- **`identify(userId, traits?)`** -- identify a user
- **`alias(userId, previousId?)`** -- alias two user IDs
- **`group(groupId, traits?)`** -- associate user with a group

### Error Tracking

- **`captureException(error, context?)`** -- capture an error with optional tags and extra data
- **`captureMessage(message, level?)`** -- capture a message at a severity level

### Feature Flags

- **`getFeatureFlag(key)`** -- get a flag value (boolean, string, number, or object)
- **`isFeatureEnabled(key)`** -- check if a flag is enabled
- **`getAllFlags()`** -- get all feature flags
- **`reloadFeatureFlags()`** -- refresh flags from the server

### Context

- **`setUser(user)`** -- set or clear the current user
- **`setTag(key, value)`** -- set a context tag
- **`setTags(tags)`** -- set multiple tags
- **`setExtra(key, value)`** -- set extra context data
- **`addBreadcrumb(crumb)`** -- add a breadcrumb for error context

### Web Vitals

- **`captureWebVitals(metrics)`** -- capture LCP, FID, CLS, and other web vitals

### Session

- **`getDistinctId()`** -- get the current distinct ID
- **`getSessionId()`** -- get the current session ID

### Advanced

- **`getInstance()`** -- get the underlying `HeadlessClient` instance
- **`HeadlessClient`** -- class export for creating multiple instances

## License

MIT
