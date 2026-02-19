# @headlessly/react

> `useContact()`, not `useHubSpot()` + `useStripe()` + `useZendesk()`. One provider for the entire graph.

```tsx
import { HeadlessProvider, useTrack, useFeatureFlag, Feature, ErrorBoundary } from '@headlessly/react'

function App() {
  return (
    <HeadlessProvider apiKey='hl_xxx'>
      <ErrorBoundary fallback={<CrashPage />}>
        <Feature flag='new-dashboard' fallback={<OldDashboard />}>
          <NewDashboard />
        </Feature>
      </ErrorBoundary>
    </HeadlessProvider>
  )
}
```

## The Problem

A typical React app wraps the root in a tower of providers:

```tsx
// Five providers from five different SaaS SDKs
<AnalyticsProvider writeKey='seg_xxx'>
  <ErrorBoundaryProvider dsn='sentry_xxx'>
    <FeatureFlagProvider clientId='ld_xxx'>
      <AuthProvider domain='auth0_xxx'>
        <PaymentProvider publishableKey='stripe_xxx'>
          <App />
        </PaymentProvider>
      </AuthProvider>
    </FeatureFlagProvider>
  </ErrorBoundaryProvider>
</AnalyticsProvider>
```

Five providers. Five sets of hooks. Five npm packages. Five bundles. And they don't talk to each other -- your error boundary doesn't know which feature flag variant the user was in when it crashed.

## The Fix

```tsx
<HeadlessProvider apiKey='hl_xxx'>
  <App />
</HeadlessProvider>
```

One provider. Analytics, errors, feature flags, experiments -- all from the same context. When a component crashes inside a `<Feature>` block, the error boundary already knows the flag, the variant, and the user's recent events.

## Install

```bash
npm install @headlessly/react
```

Requires `react >= 18.0.0` as a peer dependency.

## Tracking

```tsx
import { useTrack, usePage } from '@headlessly/react'

function PricingPage() {
  const track = useTrack()
  const page = usePage()

  useEffect(() => {
    page('pricing', { source: 'nav' })
  }, [])

  return <button onClick={() => track('plan_selected', { plan: 'pro' })}>Choose Pro</button>
}
```

Or use the declarative `<PageView>` component:

```tsx
import { PageView } from '@headlessly/react'

function PricingPage() {
  return (
    <>
      <PageView name='pricing' properties={{ source: 'nav' }} />
      <h1>Pricing</h1>
    </>
  )
}
```

## Feature Flags

Feature flags are components, not if-statements:

```tsx
import { Feature, Experiment } from '@headlessly/react'

// Conditional rendering
<Feature flag='new-checkout' fallback={<OldCheckout />}>
  <NewCheckout />
</Feature>

// A/B experiments with typed variants
<Experiment
  flag='pricing-page'
  variants={{
    control: <PricingA />,
    variant_a: <PricingB />,
    variant_b: <PricingC />,
  }}
  fallback={<PricingA />}
/>
```

Or use hooks when you need the value in logic:

```tsx
import { useFeatureFlag, useFeatureEnabled } from '@headlessly/react'

function Dashboard() {
  const variant = useFeatureFlag('dashboard-layout')
  const showBeta = useFeatureEnabled('beta-features')

  return <div className={variant === 'compact' ? 'compact' : 'full'}>{showBeta && <BetaBanner />}</div>
}
```

Flag evaluations are automatically tracked as analytics events. No manual `track('experiment_viewed')` calls needed.

## Error Boundary

```tsx
import { ErrorBoundary } from '@headlessly/react'
;<ErrorBoundary
  fallback={(error, reset) => (
    <div>
      <p>Something went wrong: {error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )}
  onError={(error, errorInfo) => console.error(error)}
>
  <MyApp />
</ErrorBoundary>
```

The error boundary automatically captures exceptions to headless.ly with full context: the user's identity, active feature flags, experiment variants, recent analytics events, and breadcrumbs. All in one capture -- not three separate error reports to three separate services.

## Identity

```tsx
import { useIdentify, useUser } from '@headlessly/react'

function LoginHandler() {
  const identify = useIdentify()
  const { setUser } = useUser()

  const handleLogin = async (credentials) => {
    const user = await login(credentials)
    identify(user.id, { email: user.email, plan: user.plan })
    setUser({ id: user.id, email: user.email })
  }

  return <LoginForm onSubmit={handleLogin} />
}
```

One identity call. Analytics, errors, and feature flags all see the same user instantly.

## Breadcrumbs

```tsx
import { useBreadcrumb } from '@headlessly/react'

function CheckoutFlow() {
  const addBreadcrumb = useBreadcrumb()

  const handleStep = (step) => {
    addBreadcrumb({ category: 'checkout', message: `Reached step: ${step}` })
    goToStep(step)
  }

  return <StepWizard onStep={handleStep} />
}
```

## Error Capture

```tsx
import { useCaptureException } from '@headlessly/react'

function PaymentForm() {
  const captureException = useCaptureException()

  const handlePayment = async () => {
    try {
      await processPayment()
    } catch (err) {
      captureException(err, {
        tags: { component: 'payment-form' },
        extra: { amount: total },
      })
      showErrorToast()
    }
  }

  return <form onSubmit={handlePayment}>...</form>
}
```

## API Reference

### Provider

**`<HeadlessProvider>`** -- Initializes the headless.ly client and provides context to all child components. Accepts all `HeadlessConfig` props (`apiKey`, `endpoint`, `debug`, etc.).

### Hooks

| Hook                     | Returns                                              | Description                        |
| ------------------------ | ---------------------------------------------------- | ---------------------------------- |
| `useTrack()`             | `track(event, properties?)`                          | Track a custom event               |
| `usePage()`              | `page(name?, properties?)`                           | Track a page view                  |
| `useIdentify()`          | `identify(userId, traits?)`                          | Identify a user                    |
| `useFeatureFlag(key)`    | `boolean \| string \| number \| object \| undefined` | Get a flag value                   |
| `useFeatureEnabled(key)` | `boolean`                                            | Check if a flag is enabled         |
| `useCaptureException()`  | `captureException(error, context?)`                  | Capture an error                   |
| `useUser()`              | `{ setUser }`                                        | Set the current user               |
| `useBreadcrumb()`        | `addBreadcrumb(crumb)`                               | Add a breadcrumb for error context |
| `useHeadless()`          | `{ initialized, distinctId, sessionId }`             | Access raw context                 |

### Components

| Component         | Props                           | Description                                          |
| ----------------- | ------------------------------- | ---------------------------------------------------- |
| `<Feature>`       | `flag`, `children`, `fallback?` | Conditional rendering based on a feature flag        |
| `<Experiment>`    | `flag`, `variants`, `fallback?` | Render a variant based on a flag value               |
| `<PageView>`      | `name?`, `properties?`          | Track a page view on mount                           |
| `<ErrorBoundary>` | `fallback`, `onError?`          | Catch errors, report to headless.ly, render fallback |

### Re-exports

Everything from `@headlessly/js` is re-exported. You can use `@headlessly/react` as a complete replacement for the browser SDK -- no need to install both.

## License

MIT
