/**
 * Direct REST API client for the headless.ly API.
 *
 * Bypasses capnweb RPC and hits the REST endpoints directly.
 * Used for events, search, and fetch when connected to a remote instance.
 */

import { loadConfig } from './config.js'

export interface ApiClientConfig {
  endpoint: string
  apiKey?: string
}

let _config: ApiClientConfig | null = null

export async function getApiConfig(): Promise<ApiClientConfig | null> {
  if (_config) return _config

  const config = await loadConfig()
  if (!config.endpoint) return null

  _config = {
    endpoint: config.endpoint.replace(/\/+$/, ''),
    apiKey: config.apiKey,
  }
  return _config
}

function authHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  return headers
}

/**
 * Fetch events from the ClickHouse-backed /api/events endpoint.
 */
export async function fetchEvents(options?: {
  type?: string
  event?: string
  source?: string
  actor?: string
  since?: string
  limit?: number
  includeTotal?: boolean
}): Promise<{ data: Record<string, unknown>[]; hasMore: boolean; total?: number; limit: number } | null> {
  const config = await getApiConfig()
  if (!config) return null

  const params = new URLSearchParams()
  if (options?.type) params.set('type', options.type)
  if (options?.event) params.set('event', options.event)
  if (options?.source) params.set('source', options.source)
  if (options?.actor) params.set('actor', options.actor)
  if (options?.since) params.set('since', options.since)
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.includeTotal) params.set('includeTotal', '1')

  const qs = params.toString()
  const url = `${config.endpoint}/api/events${qs ? `?${qs}` : ''}`

  const resp = await fetch(url, { headers: authHeaders(config.apiKey) })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Events API error (${resp.status}): ${body}`)
  }

  return resp.json() as Promise<{ data: Record<string, unknown>[]; hasMore: boolean; total?: number; limit: number }>
}

/**
 * Search entities via the REST API (bypasses capnweb RPC).
 */
export async function restFind(
  type: string,
  options?: {
    limit?: number
    where?: Record<string, unknown>
  },
): Promise<{ data: Record<string, unknown>[]; total?: number }> {
  const config = await getApiConfig()
  if (!config) throw new Error('No remote endpoint configured')

  // Convention: plural lowercase slug
  const slug = type.toLowerCase() + (type.toLowerCase().endsWith('s') ? '' : 's')

  const params = new URLSearchParams()
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.where) {
    for (const [k, v] of Object.entries(options.where)) {
      if (typeof v === 'object' && v !== null) {
        // MongoDB-style operators → pass as JSON
        params.set(`where[${k}]`, JSON.stringify(v))
      } else {
        params.set(`where[${k}][equals]`, String(v))
      }
    }
  }

  const qs = params.toString()
  const url = `${config.endpoint}/api/${slug}${qs ? `?${qs}` : ''}`

  const resp = await fetch(url, { headers: authHeaders(config.apiKey) })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`API error (${resp.status}): ${body}`)
  }

  const result = (await resp.json()) as Record<string, unknown>
  const data = (result.data ?? result.docs ?? []) as Record<string, unknown>[]
  const total = (result.total ?? result.totalDocs) as number | undefined

  return { data, total }
}

/**
 * Get a single entity via the REST API.
 */
export async function restGet(type: string, id: string): Promise<Record<string, unknown> | null> {
  const config = await getApiConfig()
  if (!config) throw new Error('No remote endpoint configured')

  const slug = type.toLowerCase() + (type.toLowerCase().endsWith('s') ? '' : 's')
  const url = `${config.endpoint}/api/${slug}/${id}`

  const resp = await fetch(url, { headers: authHeaders(config.apiKey) })
  if (resp.status === 404) return null
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`API error (${resp.status}): ${body}`)
  }

  const result = (await resp.json()) as Record<string, unknown>
  // REST API wraps in { data: ... } — unwrap whether array or object
  if (result.data && Array.isArray(result.data) && result.data.length > 0) {
    return result.data[0] as Record<string, unknown>
  }
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data as Record<string, unknown>
  }
  return result
}

/**
 * Create an entity via the REST API.
 */
export async function restCreate(type: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const config = await getApiConfig()
  if (!config) throw new Error('No remote endpoint configured')

  const slug = type.toLowerCase() + (type.toLowerCase().endsWith('s') ? '' : 's')
  const url = `${config.endpoint}/api/${slug}`

  const resp = await fetch(url, { method: 'POST', headers: authHeaders(config.apiKey), body: JSON.stringify(data) })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`API error (${resp.status}): ${body}`)
  }

  const result = (await resp.json()) as Record<string, unknown>
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data as Record<string, unknown>
  }
  return result
}

/**
 * Update an entity via the REST API.
 */
export async function restUpdate(type: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const config = await getApiConfig()
  if (!config) throw new Error('No remote endpoint configured')

  const slug = type.toLowerCase() + (type.toLowerCase().endsWith('s') ? '' : 's')
  const url = `${config.endpoint}/api/${slug}/${id}`

  const resp = await fetch(url, { method: 'PATCH', headers: authHeaders(config.apiKey), body: JSON.stringify(data) })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`API error (${resp.status}): ${body}`)
  }

  const result = (await resp.json()) as Record<string, unknown>
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    return result.data as Record<string, unknown>
  }
  return result
}

/**
 * Delete an entity via the REST API.
 */
export async function restDelete(type: string, id: string): Promise<void> {
  const config = await getApiConfig()
  if (!config) throw new Error('No remote endpoint configured')

  const slug = type.toLowerCase() + (type.toLowerCase().endsWith('s') ? '' : 's')
  const url = `${config.endpoint}/api/${slug}/${id}`

  const resp = await fetch(url, { method: 'DELETE', headers: authHeaders(config.apiKey) })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`API error (${resp.status}): ${body}`)
  }
}
