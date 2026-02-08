# @headlessly/react

React SDK for headless.ly -- hooks, providers, error boundaries, and feature flag components.

## Install

```bash
npm install @headlessly/react
```

Requires `react >= 18.0.0` as a peer dependency.

## Usage

```tsx
import {
  HeadlessProvider,
  useTrack,
  useFeatureFlag,
  ErrorBoundary,
  Feature,
} from '@headlessly/react'

function App() {
  return (
    <HeadlessProvider apiKey='hl_xxx'>
      <ErrorBoundary fallback={<ErrorPage />}>
        <MyApp />
      </ErrorBoundary>
    </HeadlessProvider>
  )
}

function MyComponent() {
  const track = useTrack()
  const showNewUI = useFeatureFlag('new-ui')

  return (
    <button onClick={() => track('button_clicked', { page: 'home' })}>
      {showNewUI ? 'New Button' : 'Old Button'}
    </button>
  )
}
```

### Feature Flags

```tsx
import { Feature, Experiment } from '@headlessly/react'

// Conditional rendering based on a flag
<Feature flag='new-checkout' fallback={<OldCheckout />}>
  <NewCheckout />
</Feature>

// A/B experiment with multiple variants
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

### Error Boundary

```tsx
import { ErrorBoundary } from '@headlessly/react'

// With render function for reset
<ErrorBoundary
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

### Page View Tracking

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

## API

### `<HeadlessProvider>`

Initializes the headless.ly client and provides context to child components. Accepts all `HeadlessConfig` props (apiKey, endpoint, debug, etc.).

### Hooks

- **`useTrack()`** -- returns a `track(event, properties?)` function
- **`usePage()`** -- returns a `page(name?, properties?)` function
- **`useIdentify()`** -- returns an `identify(userId, traits?)` function
- **`useFeatureFlag(key)`** -- returns the flag value (`boolean | string | number | object | undefined`)
- **`useFeatureEnabled(key)`** -- returns `true` if the flag is enabled
- **`useCaptureException()`** -- returns a `captureException(error, context?)` function
- **`useUser()`** -- returns `{ setUser }` for setting the current user
- **`useBreadcrumb()`** -- returns an `addBreadcrumb(crumb)` function
- **`useHeadless()`** -- returns the raw context (`{ initialized, distinctId, sessionId }`)

### Components

- **`<Feature flag children fallback?>`** -- conditional rendering based on a feature flag
- **`<Experiment flag variants fallback?>`** -- render a variant based on a flag value
- **`<PageView name? properties?>`** -- track a page view on mount
- **`<ErrorBoundary fallback onError?>`** -- catch errors, report to headless.ly, and render a fallback

### Re-exports

Everything from `@headlessly/js` is re-exported, so you can use the React package as a complete replacement for the browser SDK.

## License

MIT
