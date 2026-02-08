/**
 * @headlessly/react - React SDK
 *
 * React hooks, providers, and error boundaries for headless.ly.
 *
 * @example
 * ```tsx
 * import { HeadlessProvider, useTrack, useFeatureFlag, ErrorBoundary } from '@headlessly/react'
 *
 * function App() {
 *   return (
 *     <HeadlessProvider apiKey="hl_xxx">
 *       <ErrorBoundary fallback={<ErrorPage />}>
 *         <MyApp />
 *       </ErrorBoundary>
 *     </HeadlessProvider>
 *   )
 * }
 *
 * function MyComponent() {
 *   const track = useTrack()
 *   const showNewUI = useFeatureFlag('new-ui')
 *
 *   return (
 *     <button onClick={() => track('button_clicked')}>
 *       {showNewUI ? 'New Button' : 'Old Button'}
 *     </button>
 *   )
 * }
 * ```
 */

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode, Component, type ErrorInfo } from 'react'
import headless, { type HeadlessConfig, type FlagValue, type User, type Breadcrumb } from '@headlessly/js'

// Re-export everything from @headlessly/js
export * from '@headlessly/js'

// =============================================================================
// Context
// =============================================================================

interface HeadlessContextValue {
  initialized: boolean
  distinctId: string
  sessionId: string
}

const HeadlessContext = createContext<HeadlessContextValue | null>(null)

// =============================================================================
// Provider
// =============================================================================

interface HeadlessProviderProps extends HeadlessConfig {
  children: ReactNode
}

export function HeadlessProvider({ children, ...config }: HeadlessProviderProps) {
  const [initialized, setInitialized] = useState(false)
  const [distinctId, setDistinctId] = useState('')
  const [sessionId, setSessionId] = useState('')

  useEffect(() => {
    headless.init(config)
    setInitialized(true)
    setDistinctId(headless.getDistinctId())
    setSessionId(headless.getSessionId())

    return () => {
      headless.shutdown()
    }
  }, [config.apiKey])

  return <HeadlessContext.Provider value={{ initialized, distinctId, sessionId }}>{children}</HeadlessContext.Provider>
}

// =============================================================================
// Hooks
// =============================================================================

export function useHeadless() {
  const ctx = useContext(HeadlessContext)
  if (!ctx) throw new Error('useHeadless must be used within HeadlessProvider')
  return ctx
}

export function useTrack() {
  return useCallback((event: string, properties?: Record<string, unknown>) => {
    headless.track(event, properties)
  }, [])
}

export function usePage() {
  return useCallback((name?: string, properties?: Record<string, unknown>) => {
    headless.page(name, properties)
  }, [])
}

export function useIdentify() {
  return useCallback((userId: string, traits?: Record<string, unknown>) => {
    headless.identify(userId, traits)
  }, [])
}

export function useFeatureFlag(key: string): FlagValue | undefined {
  const [value, setValue] = useState<FlagValue | undefined>(() => headless.getFeatureFlag(key))

  useEffect(() => {
    setValue(headless.getFeatureFlag(key))
  }, [key])

  return value
}

export function useFeatureEnabled(key: string): boolean {
  const value = useFeatureFlag(key)
  return value === true || value === 'true' || (typeof value === 'string' && value !== 'false' && value !== 'control')
}

export function useCaptureException() {
  return useCallback((error: Error, context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }) => {
    return headless.captureException(error, context)
  }, [])
}

export function useUser() {
  const setUser = useCallback((user: User | null) => {
    headless.setUser(user)
  }, [])

  return { setUser }
}

export function useBreadcrumb() {
  return useCallback((crumb: Breadcrumb) => {
    headless.addBreadcrumb(crumb)
  }, [])
}

// =============================================================================
// Page View Tracker
// =============================================================================

interface PageViewProps {
  name?: string
  properties?: Record<string, unknown>
}

export function PageView({ name, properties }: PageViewProps) {
  useEffect(() => {
    headless.page(name, properties)
  }, [name])

  return null
}

// =============================================================================
// Error Boundary
// =============================================================================

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    headless.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    })
    this.props.onError?.(error, errorInfo)
  }

  reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      const { fallback } = this.props
      if (typeof fallback === 'function') {
        return fallback(this.state.error, this.reset)
      }
      return fallback
    }

    return this.props.children
  }
}

// =============================================================================
// Feature Flag Component
// =============================================================================

interface FeatureProps {
  flag: string
  children: ReactNode
  fallback?: ReactNode
}

export function Feature({ flag, children, fallback = null }: FeatureProps) {
  const enabled = useFeatureEnabled(flag)
  return <>{enabled ? children : fallback}</>
}

// =============================================================================
// Experiment Component
// =============================================================================

interface ExperimentProps {
  flag: string
  variants: Record<string, ReactNode>
  fallback?: ReactNode
}

export function Experiment({ flag, variants, fallback = null }: ExperimentProps) {
  const value = useFeatureFlag(flag)

  if (value === undefined) return <>{fallback}</>

  const variantKey = String(value)
  return <>{variants[variantKey] ?? fallback}</>
}
