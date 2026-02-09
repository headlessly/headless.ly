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

export const HeadlessContext = createContext<HeadlessContextValue | null>(null)

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

// =============================================================================
// Entity Client Hook
// =============================================================================

export function useClient() {
  const ctx = useContext(HeadlessContext)
  if (!ctx) throw new Error('useClient must be used within HeadlessProvider')
  return ctx
}

// =============================================================================
// Entity Data Fetching Hooks
// =============================================================================

interface UseEntityOptions {
  include?: string[]
}

interface UseEntityResult<T = unknown> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function useEntity(type: string, id: string, options?: UseEntityOptions): UseEntityResult {
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
  }, [])

  useEffect(() => {
    setLoading(true)
    setData(null)
    setError(null)
  }, [type, id])

  return { data, loading, error, refetch }
}

// =============================================================================
// Entity Collection Hook
// =============================================================================

interface UseEntitiesOptions {
  limit?: number
  offset?: number
  sort?: Record<string, 1 | -1>
}

interface UseEntitiesResult<T = unknown> {
  data: T[]
  loading: boolean
  error: Error | null
  total: number
  hasMore: boolean
  refetch: () => void
  loadMore: () => void
}

export function useEntities(type: string, filter?: Record<string, unknown>, options?: UseEntitiesOptions): UseEntitiesResult {
  const [data, setData] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
  }, [])

  const loadMore = useCallback(() => {
    // Load next page
  }, [])

  useEffect(() => {
    setLoading(true)
    setData([])
    setError(null)
  }, [type, JSON.stringify(filter)])

  return { data, loading, error, total, hasMore, refetch, loadMore }
}

// =============================================================================
// Mutation Hook
// =============================================================================

interface UseMutationResult {
  create: (data: Record<string, unknown>) => Promise<unknown>
  update: (id: string, data: Record<string, unknown>) => Promise<unknown>
  remove: (id: string) => Promise<void>
  loading: boolean
  error: Error | null
  execute: (verb: string, id: string, data?: Record<string, unknown>) => Promise<unknown>
}

export function useMutation(type: string): UseMutationResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const create = useCallback(async (data: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    try {
      return data
    } finally {
      setLoading(false)
    }
  }, [type])

  const update = useCallback(async (id: string, data: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    try {
      return { ...data, $id: id }
    } finally {
      setLoading(false)
    }
  }, [type])

  const remove = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      // delete entity
    } finally {
      setLoading(false)
    }
  }, [type])

  const execute = useCallback(async (verb: string, id: string, data?: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    try {
      return { $id: id, ...data }
    } finally {
      setLoading(false)
    }
  }, [type])

  return { create, update, remove, loading, error, execute }
}

// =============================================================================
// Search Hook
// =============================================================================

interface UseSearchOptions {
  types?: string[]
  limit?: number
  debounce?: number
}

interface UseSearchResult {
  results: unknown[]
  loading: boolean
  error: Error | null
}

export function useSearch(query: string, options?: UseSearchOptions): UseSearchResult {
  const [results, setResults] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!query) {
      setResults([])
      return
    }
    setLoading(true)
    setError(null)
  }, [query, JSON.stringify(options)])

  return { results, loading, error }
}

// =============================================================================
// Realtime Subscription Hook
// =============================================================================

interface UseRealtimeResult<T = unknown> {
  data: T | null
  connected: boolean
  error: Error | null
}

export function useRealtime(type: string, id: string): UseRealtimeResult {
  const [data, setData] = useState<unknown>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setConnected(false)
    setData(null)
    setError(null)
    // WebSocket subscription would go here
    return () => {
      setConnected(false)
    }
  }, [type, id])

  return { data, connected, error }
}

// =============================================================================
// Action Hook
// =============================================================================

interface UseActionResult {
  execute: (id: string, data?: Record<string, unknown>) => Promise<unknown>
  loading: boolean
  error: Error | null
}

export function useAction(type: string, verb: string): UseActionResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async (id: string, data?: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    try {
      return { $id: id, ...data }
    } finally {
      setLoading(false)
    }
  }, [type, verb])

  return { execute, loading, error }
}

// =============================================================================
// Events Hook
// =============================================================================

interface UseEventsResult {
  events: unknown[]
  loading: boolean
  error: Error | null
}

export function useEvents(type: string, id?: string): UseEventsResult {
  const [events, setEvents] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setLoading(true)
    setEvents([])
    setError(null)
  }, [type, id])

  return { events, loading, error }
}

// =============================================================================
// Entity-Aware Tracking Hook
// =============================================================================

interface EntityContext {
  type: string
  id: string
}

interface TrackEntityOptions {
  entity?: EntityContext
}

export function useTrackEntity() {
  return useCallback((event: string, properties?: Record<string, unknown>, options?: TrackEntityOptions) => {
    const enrichedProps = options?.entity
      ? { ...properties, $entity: options.entity }
      : properties
    headless.track(event, enrichedProps)
  }, [])
}

// =============================================================================
// Feature Flag Change Subscription
// =============================================================================

type FlagChangeCallback = (flags: Record<string, unknown>) => void

export function onFlagChange(callback: FlagChangeCallback): () => void {
  // Subscribe to flag changes — returns unsubscribe function
  return () => {}
}

// =============================================================================
// Render-Prop Components
// =============================================================================

interface EntityListProps {
  type: string
  filter?: Record<string, unknown>
  children: (result: UseEntitiesResult) => ReactNode
}

export function EntityList({ type, filter, children }: EntityListProps) {
  const result = useEntities(type, filter)
  return <>{children(result)}</>
}

interface EntityDetailProps {
  type: string
  id: string
  children: (result: UseEntityResult) => ReactNode
}

export function EntityDetail({ type, id, children }: EntityDetailProps) {
  const result = useEntity(type, id)
  return <>{children(result)}</>
}
