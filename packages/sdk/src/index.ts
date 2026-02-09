import { Noun } from 'digital-objects'
import { setProvider, getProvider, MemoryNounProvider } from 'digital-objects'
import type { NounProvider, NounInstance, NounEntity } from 'digital-objects'

// Import all domain packages (side effect: registers nouns)
import * as crm from '@headlessly/crm'
import * as billing from '@headlessly/billing'
import * as projects from '@headlessly/projects'
import * as content from '@headlessly/content'
import * as support from '@headlessly/support'
import * as analytics from '@headlessly/analytics'
import * as marketing from '@headlessly/marketing'
import * as experiments from '@headlessly/experiments'
import * as platform from '@headlessly/platform'

// Identity entities (not in a domain package)
// Organization is defined in @headlessly/crm (matches HeadlesslySchema)
const User = Noun('User', {
  name: 'string!',
  email: 'string!##',
  avatar: 'string',
  role: 'Admin | Member | Viewer',
  status: 'Active | Suspended | Invited',
  invite: 'Invited',
  suspend: 'Suspended',
  activate: 'Activated',
})

const ApiKey = Noun('ApiKey', {
  name: 'string!',
  keyPrefix: 'string!##',
  scopes: 'string',
  status: 'Active | Revoked | Expired',
  revoke: 'Revoked',
})

// Communication entity
const Message = Noun('Message', {
  body: 'string!',
  channel: 'Email | SMS | Chat | Push',
  status: 'Draft | Sent | Delivered | Read | Failed',
  sender: 'string',
  recipient: 'string',
  send: 'Sent',
  deliver: 'Delivered',
  read: 'Read',
})

// Re-export domain namespaces
export { crm, billing, projects, content, support, analytics, marketing, experiments, platform }

// Re-export provider utilities
export { setProvider, getProvider, MemoryNounProvider }
export type { NounProvider, NounInstance, NounEntity }

// All entities flat map (for $ proxy)
const allEntities: Record<string, NounEntity> = {
  // Identity
  User,
  ApiKey,
  // CRM (includes Organization)
  ...crm,
  // Billing
  ...billing,
  // Projects
  ...projects,
  // Content
  ...content,
  // Support
  ...support,
  // Analytics
  ...analytics,
  // Marketing
  ...marketing,
  // Experiments
  ...experiments,
  // Platform
  ...platform,
  // Communication
  Message,
}

/**
 * RemoteNounProvider — sends entity operations to a remote headless.ly endpoint
 */
export class RemoteNounProvider {
  type = 'remote'
  endpoint: string
  apiKey: string

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint
    this.apiKey = apiKey
  }

  async create(type: string, data: Record<string, unknown>) {
    const url = `${this.endpoint}/entity/${type.toLowerCase()}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(data),
    })
    return res.json()
  }

  async find(type: string, filter?: Record<string, unknown>) {
    const params = filter ? `?filter=${encodeURIComponent(JSON.stringify(filter))}` : ''
    const url = `${this.endpoint}/query/${type.toLowerCase()}${params}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    return res.json()
  }

  async get(type: string, id: string) {
    const url = `${this.endpoint}/entity/${type.toLowerCase()}/${id}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    if (!res.ok) return null
    return res.json()
  }
}

/**
 * Options for headlessly() initialization
 */
export interface HeadlesslyOptions {
  /** Remote API endpoint URL (e.g. https://db.headless.ly) */
  endpoint?: string
  /** API key for authentication (e.g. hly_sk_...) */
  apiKey?: string
}

// Singleton state
let _initialized = false

/**
 * Validate that a string is a valid URL
 */
function validateEndpoint(endpoint: string): void {
  if (!endpoint) {
    throw new Error('Invalid endpoint: endpoint must not be empty')
  }
  try {
    new URL(endpoint)
  } catch {
    throw new Error(`Invalid endpoint URL: ${endpoint}`)
  }
}

/**
 * headlessly() — Initialize the SDK
 *
 * Configures the NounProvider based on options:
 * - No args or no endpoint/apiKey: MemoryNounProvider (local in-memory)
 * - With endpoint + apiKey: RemoteNounProvider (calls db.headless.ly)
 * - Reads HEADLESSLY_ENDPOINT and HEADLESSLY_API_KEY env vars as fallbacks
 *
 * Returns the $ universal context.
 *
 * @example
 * ```ts
 * import { headlessly, $ } from '@headlessly/sdk'
 *
 * // Local memory mode
 * headlessly()
 * await $.Contact.create({ name: 'Alice', stage: 'Lead' })
 *
 * // Remote mode
 * headlessly({ endpoint: 'https://db.headless.ly', apiKey: 'hly_sk_...' })
 * ```
 */
function _headlessly(options?: HeadlesslyOptions): HeadlessContext {
  if (_initialized) {
    throw new Error('headlessly() already initialized. Use headlessly.reset() to re-initialize.')
  }

  // Resolve endpoint and apiKey from options or env vars
  const endpoint = options?.endpoint || (typeof process !== 'undefined' ? process.env.HEADLESSLY_ENDPOINT : undefined) || ''
  const apiKey = options?.apiKey || (typeof process !== 'undefined' ? process.env.HEADLESSLY_API_KEY : undefined) || ''

  // Validate endpoint if provided
  if (endpoint) {
    validateEndpoint(endpoint)
  }

  // If explicit endpoint option was empty string, that's an error when apiKey is given
  if (options?.endpoint === '') {
    throw new Error('Invalid endpoint: endpoint must not be empty')
  }

  // Configure provider
  if (endpoint && apiKey) {
    setProvider(new RemoteNounProvider(endpoint, apiKey))
  } else {
    setProvider(new MemoryNounProvider())
  }

  _initialized = true
  return $
}

/**
 * Reset singleton state — allows re-initialization
 */
_headlessly.reset = function reset(): void {
  _initialized = false
  setProvider(null as unknown as typeof MemoryNounProvider)
}

export const headlessly = _headlessly

/**
 * Typed interface for the $ universal context
 */
export interface HeadlessContext {
  /** Search entities across the graph */
  search(query: { type: string; filter?: Record<string, unknown> }): Promise<NounInstance[]>
  /** Fetch a specific entity */
  fetch(query: { type: string; id: string; include?: string[] }): Promise<NounInstance | null>
  /** Execute arbitrary code with full entity access */
  do(fn: (ctx: Record<string, NounEntity>) => Promise<unknown>): Promise<unknown>
  /** Access any entity by name */
  [key: string]: NounEntity | ((...args: unknown[]) => unknown)
}

/**
 * $ — The universal context
 *
 * Access all 32 entities and MCP-like operations:
 *   $.Contact.create({ name: 'Alice', stage: 'Lead' })
 *   $.search({ type: 'Contact', filter: { stage: 'Lead' } })
 *   $.fetch({ type: 'Contact', id: 'contact_abc123' })
 *   $.do(async ($) => { ... })
 */
export const $: HeadlessContext = new Proxy({} as HeadlessContext, {
  get(_target, prop) {
    if (typeof prop === 'symbol') return undefined

    // MCP-like operations
    if (prop === 'search') {
      return async (query: { type: string; filter?: Record<string, unknown> }) => {
        const entity = allEntities[query.type]
        if (!entity) return []
        return entity.find(query.filter)
      }
    }

    if (prop === 'fetch') {
      return async (query: { type: string; id: string; include?: string[] }) => {
        const entity = allEntities[query.type]
        if (!entity) return null
        return entity.get(query.id)
      }
    }

    if (prop === 'do') {
      return async (fn: (ctx: Record<string, NounEntity>) => Promise<unknown>) => {
        return fn(allEntities)
      }
    }

    // Entity access
    return allEntities[prop as string]
  },
})
