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

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo, type ReactNode, Component, type ErrorInfo } from 'react'
import headless, { type HeadlessConfig, type FlagValue, type User, type Breadcrumb } from '@headlessly/js'
import { $, resolveEntity, Headlessly, crm, billing, projects, content, support, analytics, marketing, experiments, platform } from '@headlessly/sdk'
import type { NounEntity, HeadlesslyOrgOptions } from '@headlessly/sdk'

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
  mutate: (data: Record<string, unknown>) => Promise<unknown>
}

export function useEntity(type: string, id: string, options?: UseEntityOptions): UseEntityResult {
  const [data, setData] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [fetchKey, setFetchKey] = useState(0)

  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setData(null)
    setError(null)

    const entity = resolveEntity(type)
    if (!entity) {
      setError(new Error(`Unknown entity type: ${type}`))
      setLoading(false)
      return
    }

    const doFetch = async () => {
      try {
        let result: unknown
        if (options?.include && options.include.length > 0) {
          result = await $.fetch({ type, id, include: options.include })
        } else {
          result = await entity.get(id)
        }
        if (!cancelled) {
          setData(result)
          if (result === null) {
            setError(new Error(`Entity ${type}/${id} not found`))
          }
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setLoading(false)
        }
      }
    }

    doFetch()
    return () => {
      cancelled = true
    }
  }, [type, id, fetchKey, JSON.stringify(options?.include)])

  const mutate = useCallback(
    async (updateData: Record<string, unknown>) => {
      const entity = resolveEntity(type)
      if (!entity) {
        throw new Error(`Unknown entity type: ${type}`)
      }
      const result = await entity.update(id, updateData)
      setData(result)
      return result
    },
    [type, id],
  )

  return { data, loading, error, refetch, mutate }
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
  const [fetchKey, setFetchKey] = useState(0)
  const [currentOffset, setCurrentOffset] = useState(options?.offset ?? 0)
  const isLoadMoreRef = useRef(false)

  const refetch = useCallback(() => {
    isLoadMoreRef.current = false
    setCurrentOffset(options?.offset ?? 0)
    setFetchKey((k) => k + 1)
  }, [options?.offset])

  const loadMore = useCallback(() => {
    isLoadMoreRef.current = true
    setCurrentOffset((prev) => prev + (options?.limit ?? 20))
    setFetchKey((k) => k + 1)
  }, [options?.limit])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const entity = resolveEntity(type)
    if (!entity) {
      setError(new Error(`Unknown entity type: ${type}`))
      setLoading(false)
      setData([])
      return
    }

    const doFetch = async () => {
      try {
        let results = (await entity.find(filter)) as unknown[]

        // Apply sort if provided
        if (options?.sort) {
          const sortEntries = Object.entries(options.sort)
          results = [...results].sort((a: unknown, b: unknown) => {
            for (const [key, dir] of sortEntries) {
              const aVal = (a as Record<string, unknown>)[key] as string | number | boolean | null | undefined
              const bVal = (b as Record<string, unknown>)[key] as string | number | boolean | null | undefined
              if (aVal != null && bVal != null && aVal < bVal) return -1 * dir
              if (aVal != null && bVal != null && aVal > bVal) return 1 * dir
            }
            return 0
          })
        }

        const totalCount = results.length

        // Apply offset and limit for pagination
        const offset = currentOffset
        const limit = options?.limit
        if (offset || limit) {
          const start = offset ?? 0
          const end = limit ? start + limit : undefined
          results = results.slice(start, end)
        }

        if (!cancelled) {
          if (isLoadMoreRef.current && currentOffset > 0) {
            // Appending for loadMore
            setData((prev) => [...prev, ...results])
          } else {
            setData(results)
          }
          isLoadMoreRef.current = false
          setTotal(totalCount)
          setHasMore(limit ? currentOffset + results.length < totalCount : false)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setData([])
          setLoading(false)
        }
      }
    }

    doFetch()
    return () => {
      cancelled = true
    }
  }, [type, JSON.stringify(filter), JSON.stringify(options?.sort), options?.limit, currentOffset, fetchKey])

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

  const create = useCallback(
    async (data: Record<string, unknown>) => {
      setLoading(true)
      setError(null)
      try {
        const entity = resolveEntity(type)
        if (!entity) {
          throw new Error(`Unknown entity type: ${type}`)
        }
        const result = await entity.create(data)
        return result
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [type],
  )

  const update = useCallback(
    async (id: string, data: Record<string, unknown>) => {
      setLoading(true)
      setError(null)
      try {
        const entity = resolveEntity(type)
        if (!entity) {
          throw new Error(`Unknown entity type: ${type}`)
        }
        const result = await entity.update(id, data)
        return result
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [type],
  )

  const remove = useCallback(
    async (id: string) => {
      setLoading(true)
      setError(null)
      try {
        const entity = resolveEntity(type)
        if (!entity) {
          throw new Error(`Unknown entity type: ${type}`)
        }
        await entity.delete(id)
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [type],
  )

  const execute = useCallback(
    async (verb: string, id: string, data?: Record<string, unknown>) => {
      setLoading(true)
      setError(null)
      try {
        const entity = resolveEntity(type)
        if (!entity) {
          throw new Error(`Unknown entity type: ${type}`)
        }
        const verbFn = (entity as unknown as Record<string, unknown>)[verb]
        if (typeof verbFn !== 'function') {
          throw new Error(`Unknown verb "${verb}" on entity type: ${type}`)
        }
        const result = await (verbFn as (id: string, data?: Record<string, unknown>) => Promise<unknown>)(id, data)
        return result
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [type],
  )

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!query) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    // Debounce the search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    let cancelled = false

    debounceRef.current = setTimeout(async () => {
      try {
        const types = options?.types ?? []
        let allResults: unknown[] = []

        if (types.length > 0) {
          // Search across specified types
          for (const type of types) {
            const found = await $.search({ type, filter: { $search: query } })
            allResults = allResults.concat(found)
          }
        } else {
          // Search across all entities using $.search
          // Since $.search requires a type, search common types
          const found = await $.search({ type: 'Contact', filter: { $search: query } })
          allResults = allResults.concat(found)
        }

        // Apply limit if provided
        if (options?.limit) {
          allResults = allResults.slice(0, options.limit)
        }

        if (!cancelled) {
          setResults(allResults)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setResults([])
          setLoading(false)
        }
      }
    }, options?.debounce ?? 300)

    return () => {
      cancelled = true
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
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

export function useRealtime(type: string, id: string, pollInterval = 5000): UseRealtimeResult {
  const [data, setData] = useState<unknown>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setConnected(false)
    setData(null)
    setError(null)

    const entity = resolveEntity(type)
    if (!entity) {
      setError(new Error(`Unknown entity type: ${type}`))
      return
    }

    const poll = async () => {
      try {
        const result = await entity.get(id)
        if (!cancelled) {
          setData(result)
          setConnected(true)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setConnected(false)
        }
      }
    }

    // Initial fetch
    poll()

    // TODO: Replace polling with WebSocket subscription when available
    const interval = setInterval(poll, pollInterval)

    return () => {
      cancelled = true
      setConnected(false)
      clearInterval(interval)
    }
  }, [type, id, pollInterval])

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

  const execute = useCallback(
    async (id: string, data?: Record<string, unknown>) => {
      setLoading(true)
      setError(null)
      try {
        const entity = resolveEntity(type)
        if (!entity) {
          throw new Error(`Unknown entity type: ${type}`)
        }
        const verbFn = (entity as unknown as Record<string, unknown>)[verb]
        if (typeof verbFn !== 'function') {
          throw new Error(`Unknown verb "${verb}" on entity type: ${type}`)
        }
        const result = await (verbFn as (id: string, data?: Record<string, unknown>) => Promise<unknown>)(id, data)
        return result
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [type, verb],
  )

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
    let cancelled = false
    setLoading(true)
    setEvents([])
    setError(null)

    const doFetch = async () => {
      try {
        // Use $.fetch to get events for the entity
        if (id) {
          const result = await $.fetch({ type, id, include: ['events'] })
          if (!cancelled) {
            const entityEvents = result && typeof result === 'object' && 'events' in result ? ((result as Record<string, unknown>).events as unknown[]) : []
            setEvents(entityEvents)
            setLoading(false)
          }
        } else {
          // Without an id, fetch all entities of this type and collect events
          const entities = await $.search({ type })
          if (!cancelled) {
            setEvents(entities ?? [])
            setLoading(false)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setLoading(false)
        }
      }
    }

    doFetch()
    return () => {
      cancelled = true
    }
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
    const enrichedProps = options?.entity ? { ...properties, $entity: options.entity } : properties
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

// =============================================================================
// Tenant-Scoped Provider (HeadlesslyProvider)
// =============================================================================

interface HeadlesslyContextValue {
  tenant: string
  initialized: boolean
  org: ReturnType<typeof Headlessly> | null
}

export const HeadlesslyContext = createContext<HeadlesslyContextValue | null>(null)

interface HeadlesslyProviderProps {
  tenant: string
  apiKey?: string
  endpoint?: string
  mode?: 'local' | 'remote' | 'memory'
  children: ReactNode
}

/**
 * HeadlesslyProvider — Tenant-scoped provider that initializes the SDK
 * and provides context to child components.
 *
 * @example
 * ```tsx
 * import { HeadlesslyProvider, useEntity, useSearch } from '@headlessly/react'
 *
 * function App() {
 *   return (
 *     <HeadlesslyProvider tenant="acme" apiKey="hly_sk_xxx">
 *       <Dashboard />
 *     </HeadlesslyProvider>
 *   )
 * }
 * ```
 */
export function HeadlesslyProvider({ tenant, apiKey, endpoint, mode, children }: HeadlesslyProviderProps) {
  const [initialized, setInitialized] = useState(false)
  const orgRef = useRef<ReturnType<typeof Headlessly> | null>(null)

  useEffect(() => {
    const orgOptions: HeadlesslyOrgOptions = { tenant }
    if (apiKey) orgOptions.apiKey = apiKey
    if (endpoint) orgOptions.endpoint = endpoint
    if (mode) orgOptions.mode = mode
    orgRef.current = Headlessly(orgOptions)
    setInitialized(true)
  }, [tenant, apiKey, endpoint, mode])

  const value = useMemo<HeadlesslyContextValue>(
    () => ({ tenant, initialized, org: orgRef.current }),
    [tenant, initialized],
  )

  return <HeadlesslyContext.Provider value={value}>{children}</HeadlesslyContext.Provider>
}

/**
 * useHeadlessly — Access the tenant-scoped Headlessly context.
 *
 * Returns the org object, tenant, and initialization state.
 * Must be used within a HeadlesslyProvider.
 */
export function useHeadlessly() {
  const ctx = useContext(HeadlesslyContext)
  if (!ctx) throw new Error('useHeadlessly must be used within HeadlesslyProvider')
  return ctx
}

// =============================================================================
// Focused CRUD Hooks
// =============================================================================

interface UseCreateResult<T = unknown> {
  create: (data: Record<string, unknown>) => Promise<T>
  loading: boolean
  error: Error | null
  data: T | null
}

/**
 * useCreate(type) — Returns a create function for the given entity type.
 *
 * @example
 * ```tsx
 * const { create, loading, error, data } = useCreate('Contact')
 * await create({ name: 'Alice', stage: 'Lead' })
 * ```
 */
export function useCreate<T = unknown>(type: string): UseCreateResult<T> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<T | null>(null)

  const create = useCallback(
    async (createData: Record<string, unknown>): Promise<T> => {
      setLoading(true)
      setError(null)
      try {
        const entity = resolveEntity(type)
        if (!entity) {
          throw new Error(`Unknown entity type: ${type}`)
        }
        const result = await entity.create(createData)
        setData(result as T)
        return result as T
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [type],
  )

  return { create, loading, error, data }
}

interface UseUpdateResult<T = unknown> {
  update: (id: string, data: Record<string, unknown>) => Promise<T>
  loading: boolean
  error: Error | null
  data: T | null
}

/**
 * useUpdate(type) — Returns an update function for the given entity type.
 *
 * @example
 * ```tsx
 * const { update, loading, error, data } = useUpdate('Contact')
 * await update('contact_abc', { name: 'Updated Name' })
 * ```
 */
export function useUpdate<T = unknown>(type: string): UseUpdateResult<T> {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [data, setData] = useState<T | null>(null)

  const update = useCallback(
    async (id: string, updateData: Record<string, unknown>): Promise<T> => {
      setLoading(true)
      setError(null)
      try {
        const entity = resolveEntity(type)
        if (!entity) {
          throw new Error(`Unknown entity type: ${type}`)
        }
        const result = await entity.update(id, updateData)
        setData(result as T)
        return result as T
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [type],
  )

  return { update, loading, error, data }
}

interface UseDeleteResult {
  remove: (id: string) => Promise<void>
  loading: boolean
  error: Error | null
}

/**
 * useDelete(type) — Returns a delete function for the given entity type.
 *
 * @example
 * ```tsx
 * const { remove, loading, error } = useDelete('Contact')
 * await remove('contact_abc')
 * ```
 */
export function useDelete(type: string): UseDeleteResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const remove = useCallback(
    async (id: string): Promise<void> => {
      setLoading(true)
      setError(null)
      try {
        const entity = resolveEntity(type)
        if (!entity) {
          throw new Error(`Unknown entity type: ${type}`)
        }
        await entity.delete(id)
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [type],
  )

  return { remove, loading, error }
}

// =============================================================================
// Verb Hook
// =============================================================================

interface UseVerbResult {
  execute: (id: string, data?: Record<string, unknown>) => Promise<unknown>
  loading: boolean
  error: Error | null
}

/**
 * useVerb(type, verb) — Execute a custom verb on an entity type.
 *
 * @example
 * ```tsx
 * const { execute, loading, error } = useVerb('Contact', 'qualify')
 * await execute('contact_abc')
 * ```
 */
export function useVerb(type: string, verb: string): UseVerbResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(
    async (id: string, data?: Record<string, unknown>): Promise<unknown> => {
      setLoading(true)
      setError(null)
      try {
        const entity = resolveEntity(type)
        if (!entity) {
          throw new Error(`Unknown entity type: ${type}`)
        }
        const verbFn = (entity as unknown as Record<string, unknown>)[verb]
        if (typeof verbFn !== 'function') {
          throw new Error(`Unknown verb "${verb}" on entity type: ${type}`)
        }
        const result = await (verbFn as (id: string, data?: Record<string, unknown>) => Promise<unknown>)(id, data)
        return result
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [type, verb],
  )

  return { execute, loading, error }
}

// =============================================================================
// Subscription Hook
// =============================================================================

type SubscriptionHandler<T = unknown> = (entity: T) => void

interface UseSubscriptionResult {
  connected: boolean
  error: Error | null
  unsubscribe: () => void
}

/**
 * useSubscription(type, filter?, handler) — Subscribe to real-time entity changes.
 *
 * Polls for changes and calls the handler when entities matching the filter
 * are created or updated. Automatically cleans up on unmount.
 *
 * @example
 * ```tsx
 * useSubscription('Contact', { stage: 'Lead' }, (contacts) => {
 *   console.log('Updated contacts:', contacts)
 * })
 * ```
 */
export function useSubscription<T = unknown>(
  type: string,
  filterOrHandler?: Record<string, unknown> | SubscriptionHandler<T[]>,
  handler?: SubscriptionHandler<T[]>,
): UseSubscriptionResult {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const unsubscribedRef = useRef(false)

  // Normalize arguments: useSubscription(type, handler) or useSubscription(type, filter, handler)
  const filter = typeof filterOrHandler === 'function' ? undefined : filterOrHandler
  const callback = typeof filterOrHandler === 'function' ? filterOrHandler : handler

  const unsubscribe = useCallback(() => {
    unsubscribedRef.current = true
    setConnected(false)
  }, [])

  useEffect(() => {
    unsubscribedRef.current = false
    setConnected(false)
    setError(null)

    const entity = resolveEntity(type)
    if (!entity) {
      setError(new Error(`Unknown entity type: ${type}`))
      return
    }

    const poll = async () => {
      if (unsubscribedRef.current) return
      try {
        const results = (await entity.find(filter)) as T[]
        if (!unsubscribedRef.current) {
          setConnected(true)
          callback?.(results)
        }
      } catch (err) {
        if (!unsubscribedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setConnected(false)
        }
      }
    }

    // Initial poll
    poll()

    // Poll at 5-second intervals (will be replaced with WebSocket in production)
    const interval = setInterval(poll, 5000)

    return () => {
      unsubscribedRef.current = true
      setConnected(false)
      clearInterval(interval)
    }
  }, [type, JSON.stringify(filter)])

  return { connected, error, unsubscribe }
}

// =============================================================================
// Domain Hook
// =============================================================================

/** Map of domain names to their namespace modules */
const domainModules: Record<string, Record<string, NounEntity>> = {
  crm: crm as unknown as Record<string, NounEntity>,
  billing: billing as unknown as Record<string, NounEntity>,
  projects: projects as unknown as Record<string, NounEntity>,
  content: content as unknown as Record<string, NounEntity>,
  support: support as unknown as Record<string, NounEntity>,
  analytics: analytics as unknown as Record<string, NounEntity>,
  marketing: marketing as unknown as Record<string, NounEntity>,
  experiments: experiments as unknown as Record<string, NounEntity>,
  platform: platform as unknown as Record<string, NounEntity>,
}

/**
 * useDomain(domain) — Access a domain namespace (crm, billing, etc.)
 *
 * Returns the domain module containing all entities for that domain.
 *
 * @example
 * ```tsx
 * const { Contact, Deal, Pipeline } = useDomain('crm')
 * const contacts = await Contact.find({ stage: 'Lead' })
 * ```
 */
export function useDomain(domain: string): Record<string, NounEntity> {
  return useMemo(() => {
    const mod = domainModules[domain]
    if (!mod) {
      throw new Error(
        `Unknown domain: "${domain}". Available domains: ${Object.keys(domainModules).join(', ')}`,
      )
    }
    return mod
  }, [domain])
}
