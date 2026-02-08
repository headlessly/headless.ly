/**
 * headless.ly — The Operating System for Agent-First Startups
 *
 * SDK entry point. Initialize an organization and get access to all 32 entities
 * with CRUD, custom verbs, verb conjugation, and MCP-like search/fetch/do.
 *
 * Built on rpc.do + capnweb for promise pipelining — chain dependent
 * operations and they execute in a single round-trip.
 *
 * @example
 * ```typescript
 * import Headlessly from 'headless.ly'
 *
 * const org = Headlessly({ tenant: 'acme' })
 * await org.Contact.create({ name: 'Alice', stage: 'Lead' })
 * await org.Contact.qualify('contact_abc')
 * org.Contact.qualified(contact => console.log('Qualified:', contact.name))
 *
 * // Promise pipelining — one round-trip
 * const deals = await org.Contact
 *   .find({ stage: 'Qualified' })
 *   .map(contact => contact.deals)
 *   .filter(deal => deal.status === 'Open')
 * ```
 *
 * @packageDocumentation
 */

import { setProvider, getProvider, MemoryNounProvider } from 'digital-objects'
import type { NounProvider, NounInstance } from 'digital-objects'
import { LocalNounProvider, DONounProvider } from '@headlessly/objects'
import type { DONounProviderOptions } from '@headlessly/objects'
import {
  $,
  crm,
  billing,
  projects,
  content,
  support,
  analytics,
  marketing,
  experiments,
  platform,
} from '@headlessly/sdk'

// =============================================================================
// Types
// =============================================================================

/**
 * Options for initializing a headless.ly organization
 */
export interface HeadlesslyOptions {
  /** Tenant identifier (e.g., 'acme') */
  tenant: string
  /** API key for remote mode (format: 'key_...') */
  apiKey?: string
  /** Endpoint override for remote mode (default: https://db.headless.ly) */
  endpoint?: string
  /** ICP template to apply — controls default entity visibility and workflows */
  template?: 'b2b' | 'b2c' | 'b2d' | 'b2a'
  /** Provider mode: 'memory' (default/testing), 'local' (file-based), 'remote' (rpc.do + capnweb) */
  mode?: 'local' | 'remote' | 'memory'
  /** Transport for remote mode: 'http' (default) or 'ws' for real-time with WebSocket */
  transport?: 'http' | 'ws'
}

/**
 * A headless.ly organization instance
 *
 * Provides access to all 32 entities via property access (org.Contact, org.Deal, etc.)
 * plus MCP-like primitives: search, fetch, do.
 *
 * Domain namespaces are also available: org.crm, org.billing, org.projects, etc.
 */
export interface HeadlesslyOrg {
  /** Tenant identifier */
  readonly tenant: string
  /** Context URL (https://headless.ly/~{tenant}) */
  readonly context: string
  /** Search across entities */
  search: (query: { type?: string; filter?: Record<string, unknown> }) => Promise<unknown[]>
  /** Fetch a specific entity */
  fetch: (query: { type: string; id: string; include?: string[] }) => Promise<unknown>
  /** Execute any action */
  do: (fn: (ctx: Record<string, unknown>) => Promise<unknown>) => Promise<unknown>
  /** Entity and namespace access via index signature */
  [key: string]: unknown
}

// =============================================================================
// Domain Namespaces
// =============================================================================

const domainNamespaces: Record<string, Record<string, unknown>> = {
  crm: crm as unknown as Record<string, unknown>,
  billing: billing as unknown as Record<string, unknown>,
  projects: projects as unknown as Record<string, unknown>,
  content: content as unknown as Record<string, unknown>,
  support: support as unknown as Record<string, unknown>,
  analytics: analytics as unknown as Record<string, unknown>,
  marketing: marketing as unknown as Record<string, unknown>,
  experiments: experiments as unknown as Record<string, unknown>,
  platform: platform as unknown as Record<string, unknown>,
}

// =============================================================================
// Provider Configuration
// =============================================================================

function configureProvider(options: HeadlesslyOptions): NounProvider {
  const { tenant, mode = 'memory', apiKey, endpoint, transport } = options
  const context = `https://headless.ly/~${tenant}`

  switch (mode) {
    case 'local': {
      const provider = new LocalNounProvider({ context })
      setProvider(provider)
      return provider
    }

    case 'remote': {
      const baseUrl = endpoint ?? 'https://db.headless.ly'
      // Use rpc.do + capnweb for promise pipelining
      const provider = new DONounProvider({
        endpoint: `${baseUrl}/~${tenant}`,
        apiKey,
        transport,
        context,
      })
      setProvider(provider)
      return provider
    }

    case 'memory':
    default: {
      // Check if a provider is already set (e.g., by a test's beforeAll)
      // If so, reuse it. Otherwise, create a fresh MemoryNounProvider.
      let provider: NounProvider
      try {
        provider = getProvider()
      } catch {
        provider = new MemoryNounProvider()
        setProvider(provider)
      }
      return provider
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Initialize a headless.ly organization
 *
 * @param options - Configuration for the org
 * @returns A HeadlesslyOrg proxy with access to all 32 entities + search/fetch/do
 *
 * @example
 * ```typescript
 * // Memory mode (default — for testing and prototyping)
 * const org = Headlessly({ tenant: 'test' })
 *
 * // Local mode (in-process with event emission)
 * const org = Headlessly({ tenant: 'acme', mode: 'local' })
 *
 * // Remote mode (rpc.do + capnweb promise pipelining)
 * const org = Headlessly({ tenant: 'acme', apiKey: 'key_...', mode: 'remote' })
 *
 * // Real-time mode (WebSocket transport)
 * const org = Headlessly({ tenant: 'acme', apiKey: 'key_...', mode: 'remote', transport: 'ws' })
 * ```
 */
export default function Headlessly(options: HeadlesslyOptions): HeadlesslyOrg {
  const { tenant } = options
  const context = `https://headless.ly/~${tenant}`

  // Configure the provider (side effect: sets global provider)
  configureProvider(options)

  // Build the org proxy
  return new Proxy({} as HeadlesslyOrg, {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined

      // Prevent thenable detection (avoids auto-await issues)
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined

      // Static properties
      if (prop === 'tenant') return tenant
      if (prop === 'context') return context

      // MCP-like primitives from $
      if (prop === 'search') return $['search']
      if (prop === 'fetch') return $['fetch']
      if (prop === 'do') return $['do']

      // Domain namespaces (org.crm, org.billing, etc.)
      if (prop in domainNamespaces) return domainNamespaces[prop]

      // Entity access via $ (org.Contact, org.Deal, org.Subscription, etc.)
      const entity = $[prop]
      if (entity !== undefined) return entity

      return undefined
    },

    has(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return false
      if (prop === 'tenant' || prop === 'context') return true
      if (prop === 'search' || prop === 'fetch' || prop === 'do') return true
      if (prop in domainNamespaces) return true
      return $[prop] !== undefined
    },

    ownKeys() {
      return ['tenant', 'context', 'search', 'fetch', 'do', ...Object.keys(domainNamespaces)]
    },

    getOwnPropertyDescriptor(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined
      const keys = ['tenant', 'context', 'search', 'fetch', 'do', ...Object.keys(domainNamespaces)]
      if (keys.includes(prop)) {
        return { configurable: true, enumerable: true, writable: false }
      }
      return undefined
    },
  })
}

// Named export
export { Headlessly }

// Re-export provider utilities for advanced use
export { setProvider, getProvider, MemoryNounProvider } from 'digital-objects'
export type { NounProvider, NounInstance } from 'digital-objects'
export { LocalNounProvider, DONounProvider } from '@headlessly/objects'

// Re-export $ for direct access
export { $ } from '@headlessly/sdk'

// Re-export domain namespaces
export { crm, billing, projects, content, support, analytics, marketing, experiments, platform } from '@headlessly/sdk'
