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
