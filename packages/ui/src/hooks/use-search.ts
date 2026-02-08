/**
 * useSearch — Hook for searching across entities.
 *
 * Provides a debounced search interface that queries across
 * one or more entity types using the MCP search primitive.
 *
 * @example
 * ```tsx
 * const { results, loading, search } = useSearch({ types: ['Contact', 'Deal'] })
 * // later...
 * search('alice')
 * ```
 */

import { useState, useCallback, useRef } from 'react'
import { useHeadlessUI } from '../provider.js'
import type { NounInstance } from '../types.js'

export interface UseSearchOptions {
  /** Entity types to search across. If omitted, searches all types. */
  types?: string[]
  /** Debounce delay in ms (default: 300) */
  debounce?: number
  /** Maximum results to return (default: 20) */
  limit?: number
}

export interface SearchResult {
  type: string
  entity: NounInstance
  score?: number
}

export interface UseSearchResult {
  results: SearchResult[]
  loading: boolean
  error: Error | null
  query: string
  search: (query: string) => void
  clear: () => void
}

export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const { searchEntities } = useHeadlessUI()
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [query, setQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debounce = options.debounce ?? 300
  const limit = options.limit ?? 20

  const search = useCallback(
    (q: string) => {
      setQuery(q)

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      if (!q.trim()) {
        setResults([])
        setLoading(false)
        return
      }

      setLoading(true)

      timerRef.current = setTimeout(async () => {
        try {
          const res = await searchEntities(q, { types: options.types, limit })
          setResults(res)
          setError(null)
        } catch (err) {
          setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
          setLoading(false)
        }
      }, debounce)
    },
    [searchEntities, debounce, limit, options.types],
  )

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
  }, [])

  return { results, loading, error, query, search, clear }
}
