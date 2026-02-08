/**
 * HeadlessUIProvider — Context provider for @headlessly/ui components.
 *
 * Provides data-fetching functions to all child components.
 * Components call these functions rather than making HTTP requests directly,
 * allowing consumers to supply their own fetch implementation.
 *
 * @example
 * ```tsx
 * import { HeadlessUIProvider } from '@headlessly/ui'
 *
 * function App() {
 *   return (
 *     <HeadlessUIProvider config={{ baseUrl: 'https://db.headless.ly' }}>
 *       <EntityTable noun='Contact' />
 *     </HeadlessUIProvider>
 *   )
 * }
 * ```
 */

import React, { createContext, useContext, useMemo } from 'react'
import type { HeadlessUIConfig, NounInstance, PaginatedResult, EntityQuery, EntityEvent } from './types.js'
import type { SearchResult } from './hooks/use-search.js'

export interface HeadlessUIContextValue {
  config: HeadlessUIConfig
  fetchEntity: (type: string, id: string) => Promise<NounInstance | null>
  fetchEntities: (type: string, query?: EntityQuery) => Promise<PaginatedResult<NounInstance>>
  createEntity: (type: string, data: Record<string, unknown>) => Promise<NounInstance>
  updateEntity: (type: string, id: string, data: Record<string, unknown>) => Promise<NounInstance>
  deleteEntity: (type: string, id: string) => Promise<void>
  performVerb: (type: string, id: string, verb: string, data?: Record<string, unknown>) => Promise<NounInstance>
  searchEntities: (query: string, options?: { types?: string[]; limit?: number }) => Promise<SearchResult[]>
  fetchEvents: (entityId: string) => Promise<EntityEvent[]>
}

const HeadlessUIContext = createContext<HeadlessUIContextValue | null>(null)

export function useHeadlessUI(): HeadlessUIContextValue {
  const ctx = useContext(HeadlessUIContext)
  if (!ctx) {
    throw new Error('useHeadlessUI must be used within a HeadlessUIProvider')
  }
  return ctx
}

export interface HeadlessUIProviderProps {
  config: HeadlessUIConfig
  children: React.ReactNode
  /** Override the default fetch functions */
  overrides?: Partial<Omit<HeadlessUIContextValue, 'config'>>
}

/**
 * Default HTTP-based implementation of the data-fetching functions.
 */
function createDefaultFetchers(config: HeadlessUIConfig) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }
  if (config.context) {
    headers['X-Context'] = config.context
  }

  const base = config.baseUrl.replace(/\/$/, '')

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${body || res.statusText}`)
    }
    return res.json() as Promise<T>
  }

  const fetchEntity = async (type: string, id: string): Promise<NounInstance | null> => {
    try {
      return await request<NounInstance>(`/entity/${type}/${id}`)
    } catch {
      return null
    }
  }

  const fetchEntities = async (type: string, query?: EntityQuery): Promise<PaginatedResult<NounInstance>> => {
    const params = new URLSearchParams()
    if (query?.limit) params.set('limit', String(query.limit))
    if (query?.offset) params.set('offset', String(query.offset))
    if (query?.cursor) params.set('cursor', query.cursor)
    if (query?.sort) params.set('sort', JSON.stringify(query.sort))
    if (query?.filter) params.set('filter', JSON.stringify(query.filter))
    const qs = params.toString()
    return request<PaginatedResult<NounInstance>>(`/query/${type}${qs ? '?' + qs : ''}`)
  }

  const createEntity = async (type: string, data: Record<string, unknown>): Promise<NounInstance> => {
    return request<NounInstance>(`/entity/${type}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  const updateEntity = async (type: string, id: string, data: Record<string, unknown>): Promise<NounInstance> => {
    return request<NounInstance>(`/entity/${type}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  const deleteEntity = async (type: string, id: string): Promise<void> => {
    await request<void>(`/entity/${type}/${id}`, { method: 'DELETE' })
  }

  const performVerb = async (type: string, id: string, verb: string, data?: Record<string, unknown>): Promise<NounInstance> => {
    return request<NounInstance>(`/entity/${type}/${id}/${verb}`, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  const searchEntities = async (q: string, options?: { types?: string[]; limit?: number }): Promise<SearchResult[]> => {
    const params = new URLSearchParams({ q })
    if (options?.types) params.set('types', options.types.join(','))
    if (options?.limit) params.set('limit', String(options.limit))
    return request<SearchResult[]>(`/search?${params.toString()}`)
  }

  const fetchEvents = async (entityId: string): Promise<EntityEvent[]> => {
    return request<EntityEvent[]>(`/events?entityId=${encodeURIComponent(entityId)}`)
  }

  return { fetchEntity, fetchEntities, createEntity, updateEntity, deleteEntity, performVerb, searchEntities, fetchEvents }
}

export function HeadlessUIProvider({ config, children, overrides }: HeadlessUIProviderProps) {
  const value = useMemo<HeadlessUIContextValue>(() => {
    const defaults = createDefaultFetchers(config)
    return {
      config,
      fetchEntity: overrides?.fetchEntity ?? defaults.fetchEntity,
      fetchEntities: overrides?.fetchEntities ?? defaults.fetchEntities,
      createEntity: overrides?.createEntity ?? defaults.createEntity,
      updateEntity: overrides?.updateEntity ?? defaults.updateEntity,
      deleteEntity: overrides?.deleteEntity ?? defaults.deleteEntity,
      performVerb: overrides?.performVerb ?? defaults.performVerb,
      searchEntities: overrides?.searchEntities ?? defaults.searchEntities,
      fetchEvents: overrides?.fetchEvents ?? defaults.fetchEvents,
    }
  }, [config, overrides])

  return <HeadlessUIContext.Provider value={value}>{children}</HeadlessUIContext.Provider>
}
