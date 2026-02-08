/**
 * useEntity — Hook for fetching a single entity by type and ID.
 *
 * @example
 * ```tsx
 * const { entity, loading, error, refetch } = useEntity('Contact', 'contact_1')
 * ```
 */

import { useState, useEffect, useCallback } from 'react'
import { useHeadlessUI } from '../provider.js'
import type { NounInstance } from '../types.js'

export interface UseEntityOptions {
  /** Skip fetching (useful for conditional queries) */
  skip?: boolean
}

export interface UseEntityResult {
  entity: NounInstance | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useEntity(type: string, id: string, options: UseEntityOptions = {}): UseEntityResult {
  const { fetchEntity } = useHeadlessUI()
  const [entity, setEntity] = useState<NounInstance | null>(null)
  const [loading, setLoading] = useState(!options.skip)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    if (options.skip) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchEntity(type, id)
      setEntity(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setLoading(false)
    }
  }, [type, id, options.skip, fetchEntity])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { entity, loading, error, refetch }
}
