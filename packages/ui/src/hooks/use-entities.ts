/**
 * useEntities — Hook for fetching a paginated list of entities.
 *
 * @example
 * ```tsx
 * const { entities, loading, hasMore, loadMore, refetch } = useEntities('Contact', {
 *   filter: { stage: 'Lead' },
 *   sort: { $createdAt: -1 },
 *   limit: 20,
 * })
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useHeadlessUI } from '../provider.js'
import type { NounInstance, EntityQuery, PaginatedResult } from '../types.js'

export interface UseEntitiesOptions extends EntityQuery {
  /** Skip fetching */
  skip?: boolean
}

export interface UseEntitiesResult {
  entities: NounInstance[]
  loading: boolean
  error: Error | null
  total: number | undefined
  hasMore: boolean
  nextCursor: string | undefined
  loadMore: () => Promise<void>
  refetch: () => Promise<void>
}

export function useEntities(type: string, options: UseEntitiesOptions = {}): UseEntitiesResult {
  const { fetchEntities } = useHeadlessUI()
  const [entities, setEntities] = useState<NounInstance[]>([])
  const [loading, setLoading] = useState(!options.skip)
  const [error, setError] = useState<Error | null>(null)
  const [total, setTotal] = useState<number | undefined>(undefined)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const currentCursorRef = useRef<string | undefined>(undefined)

  const { skip, ...query } = options

  const refetch = useCallback(async () => {
    if (skip) return
    setLoading(true)
    setError(null)
    currentCursorRef.current = undefined
    try {
      const result: PaginatedResult<NounInstance> = await fetchEntities(type, query)
      setEntities(result.items)
      setTotal(result.total)
      setHasMore(result.hasMore)
      setNextCursor(result.nextCursor)
      currentCursorRef.current = result.nextCursor
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [type, skip, fetchEntities, JSON.stringify(query)])

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !currentCursorRef.current) return
    setLoading(true)
    try {
      const result: PaginatedResult<NounInstance> = await fetchEntities(type, {
        ...query,
        cursor: currentCursorRef.current,
      })
      setEntities((prev) => [...prev, ...result.items])
      setHasMore(result.hasMore)
      setNextCursor(result.nextCursor)
      currentCursorRef.current = result.nextCursor
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [type, hasMore, loading, fetchEntities, JSON.stringify(query)])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { entities, loading, error, total, hasMore, nextCursor, loadMore, refetch }
}
