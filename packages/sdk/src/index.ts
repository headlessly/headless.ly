import { Noun } from 'digital-objects'
import { setProvider, getProvider, MemoryNounProvider, setEntityRegistry, subscribeToEvents } from 'digital-objects'
import type { NounProvider, NounInstance, NounEntity, NounSchema, EntityEvent as DOEntityEvent } from 'digital-objects'
import { RPC } from 'rpc.do'
import type { RPCProxy, RPCOptions } from 'rpc.do'
import { LocalNounProvider, DONounProvider } from '@headlessly/objects'
import type { DONounProviderOptions } from '@headlessly/objects'

// =============================================================================
// Entity Event Types
// =============================================================================

/**
 * Entity event emitted for every mutation through the $ context.
 * Matches digital-objects' EntityEvent exactly so the SDK event bus
 * and the Noun proxy event bus are type-compatible.
 */
export interface EntityEvent {
  type: string
  action: 'created' | 'updated' | 'deleted' | 'performed' | 'rolled_back'
  verb?: string
  entityId: string
  data: NounInstance | null
  previousData: NounInstance | null
  timestamp: string
  version: number
}

/**
 * System status returned by $.status()
 */
export interface SystemStatus {
  provider: string
  initialized: boolean
  entities: Record<string, number>
  alerts: Array<{ level: 'info' | 'warn' | 'error'; message: string }>
}

// =============================================================================
// EventBus — bridges to digital-objects' global event bus
// =============================================================================

type EventFilter = { type?: string; action?: string }

const _activeUnsubscribes: Array<() => void> = []

function _subscribe(callbackOrOptions: ((event: EntityEvent) => void) | EventFilter, maybeCallback?: (event: EntityEvent) => void): () => void {
  let userCallback: (event: EntityEvent) => void
  let filter: EventFilter | undefined

  if (typeof callbackOrOptions === 'function') {
    userCallback = callbackOrOptions
  } else {
    if (!maybeCallback) throw new Error('subscribe() requires a callback')
    userCallback = maybeCallback
    filter = callbackOrOptions
  }

  // Bridge to digital-objects' subscribeToEvents with filtering
  const unsub = subscribeToEvents((event: DOEntityEvent) => {
    if (filter) {
      if (filter.type && filter.type !== event.type) return
      if (filter.action && filter.action !== event.action) return
    }
    try {
      userCallback(event as EntityEvent)
    } catch {
      // Subscriber errors are silently ignored
    }
  })

  _activeUnsubscribes.push(unsub)

  const wrappedUnsub = () => {
    unsub()
    const idx = _activeUnsubscribes.indexOf(unsub)
    if (idx >= 0) _activeUnsubscribes.splice(idx, 1)
  }
  return wrappedUnsub
}

const _eventsNamespace = {
  subscribe: _subscribe as {
    (callback: (event: EntityEvent) => void): () => void
    (options: { type?: string; action?: string }, callback: (event: EntityEvent) => void): () => void
  },
}

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
export { setProvider, getProvider, MemoryNounProvider, LocalNounProvider, DONounProvider }
export type { NounProvider, NounInstance, NounEntity, DONounProviderOptions }

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

// Register entity registry for after-hook $ context injection
setEntityRegistry(allEntities)

/**
 * Resolve an entity by type name from the registry.
 * Returns undefined if the type is not a registered entity.
 */
export function resolveEntity(type: string): NounEntity | undefined {
  return allEntities[type]
}

// =============================================================================
// $.status() implementation
// =============================================================================

async function _statusFn(): Promise<SystemStatus> {
  const alerts: SystemStatus['alerts'] = []

  if (!_initialized) {
    alerts.push({ level: 'warn', message: 'SDK not initialized — call headlessly() or access $ to auto-init' })
  }

  let providerType = 'unknown'
  try {
    const p = getProvider()
    if ('type' in p && typeof (p as Record<string, unknown>).type === 'string') {
      providerType = (p as Record<string, unknown>).type as string
    } else if (p instanceof MemoryNounProvider) {
      providerType = 'memory'
    }
  } catch {
    providerType = 'unknown'
  }

  if (providerType === 'memory') {
    alerts.push({ level: 'info', message: 'Using in-memory provider — data is ephemeral' })
  }

  const entities: Record<string, number> = {}
  const entries = Object.entries(allEntities)
  const counts = await Promise.all(
    entries.map(async ([, entity]) => {
      try {
        const items = await entity.find({})
        return items.length
      } catch {
        return 0
      }
    }),
  )
  for (let i = 0; i < entries.length; i++) {
    entities[entries[i][0]] = counts[i]
  }

  return {
    provider: providerType,
    initialized: _initialized,
    entities,
    alerts,
  }
}

/**
 * All 35 entity names, for typed iteration and validation
 */
export const entityNames = Object.keys(allEntities) as EntityName[]

/**
 * RemoteNounProvider — sends entity operations to db.headless.ly via rpc.do
 *
 * Uses capnweb protocol for promise pipelining, automatic batching,
 * and efficient RPC transport instead of raw HTTP fetch.
 */
export class RemoteNounProvider implements NounProvider {
  type = 'remote'
  endpoint: string
  apiKey: string
  private rpc: RPCProxy<Record<string, unknown>>

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint
    this.apiKey = apiKey

    const rpcOptions: RPCOptions = {}
    if (apiKey) {
      rpcOptions.auth = apiKey
    }
    this.rpc = RPC(endpoint, rpcOptions) as RPCProxy<Record<string, unknown>>
  }

  private collection(type: string): Record<string, (...args: unknown[]) => Promise<unknown>> {
    const name = toCollectionName(type)
    return this.rpc[name] as Record<string, (...args: unknown[]) => Promise<unknown>>
  }

  async create(type: string, data: Record<string, unknown>) {
    const result = await this.collection(type).create(data)
    return result as NounInstance
  }

  async find(type: string, filter?: Record<string, unknown>) {
    const result = await this.collection(type).find(filter ?? {})
    if (Array.isArray(result)) return result as NounInstance[]
    return []
  }

  async get(type: string, id: string) {
    try {
      const result = await this.collection(type).get(id)
      if (!result) return null
      return result as NounInstance
    } catch {
      return null
    }
  }

  async update(type: string, id: string, data: Record<string, unknown>) {
    const result = await this.collection(type).update(id, data)
    return result as NounInstance
  }

  async delete(type: string, id: string) {
    try {
      const result = await this.collection(type).delete(id)
      return result !== false
    } catch {
      return false
    }
  }

  async findOne(type: string, where?: Record<string, unknown>) {
    const results = await this.find(type, where)
    return results[0] ?? null
  }

  async rollback(type: string, id: string, toVersion: number) {
    const ns = this.collection(type)
    const result = await ns.rollback(id, toVersion)
    return result as NounInstance
  }

  async perform(type: string, verb: string, id: string, data?: Record<string, unknown>) {
    const ns = this.collection(type)
    const result = await ns[verb](id, data ?? {})
    return result as NounInstance
  }
}

/**
 * Convert PascalCase type to camelCase plural collection name for rpc.do routing.
 * e.g., Contact → contacts, Company → companies, FeatureFlag → featureFlags
 */
function toCollectionName(type: string): string {
  const camel = type.charAt(0).toLowerCase() + type.slice(1)
  if (camel.endsWith('y') && !['ay', 'ey', 'oy', 'uy'].some((s) => camel.endsWith(s))) {
    return camel.slice(0, -1) + 'ies'
  }
  if (camel.endsWith('s') || camel.endsWith('x') || camel.endsWith('ch') || camel.endsWith('sh')) {
    return camel + 'es'
  }
  return camel + 's'
}

/**
 * Runtime environment detection
 */
export type RuntimeEnvironment = 'node' | 'browser' | 'cloudflare-worker' | 'unknown'

/**
 * Detect the current runtime environment
 *
 * Returns one of: 'node', 'browser', 'cloudflare-worker', 'unknown'
 */
export function detectEnvironment(): RuntimeEnvironment {
  // Cloudflare Workers: has caches global and no window/process.versions.node
  if (typeof globalThis !== 'undefined' && 'caches' in globalThis && typeof (globalThis as Record<string, unknown>).Response === 'function') {
    // Distinguish from browser: Workers have no window.document
    if (
      typeof document === 'undefined' &&
      (typeof navigator === 'undefined' || (navigator as unknown as Record<string, unknown>).userAgent === 'Cloudflare-Workers')
    ) {
      return 'cloudflare-worker'
    }
  }

  // Browser: has window and document
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser'
  }

  // Node.js: has process.versions.node
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node'
  }

  return 'unknown'
}

/**
 * Auto-detect endpoint from the browser environment
 *
 * When running in a browser on *.headless.ly, infers the db endpoint.
 * Returns undefined if not in a browser or not on a headless.ly domain.
 */
export function detectEndpoint(): string | undefined {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return undefined
  }

  const { hostname, protocol } = window.location

  // On any *.headless.ly subdomain, use db.headless.ly as the endpoint
  if (hostname === 'headless.ly' || hostname.endsWith('.headless.ly')) {
    return `${protocol}//db.headless.ly`
  }

  return undefined
}

/**
 * Read an environment variable safely across runtimes
 */
function readEnv(name: string): string | undefined {
  // Node.js / Cloudflare Workers (via wrangler.jsonc vars)
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name] || undefined
  }
  return undefined
}

/**
 * Options for headlessly() initialization
 */
export interface HeadlesslyOptions {
  /** Remote API endpoint URL (e.g. https://db.headless.ly) */
  endpoint?: string
  /** API key for authentication (e.g. hly_sk_...) */
  apiKey?: string
  /**
   * Enable lazy initialization: auto-init with MemoryNounProvider on first $ access.
   * When true, headlessly() does not need to be called explicitly.
   * @default false
   */
  lazy?: boolean
}

// Singleton state
let _initialized = false
let _lazyEnabled = false

/**
 * Validate that a string is a valid URL with helpful error messages
 */
function validateEndpoint(endpoint: string): void {
  if (!endpoint) {
    throw new Error('Invalid endpoint: endpoint must not be empty. Expected a URL like "https://db.headless.ly" or "http://localhost:8787".')
  }
  try {
    const url = new URL(endpoint)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`Invalid endpoint URL protocol "${url.protocol}" in "${endpoint}". Use https:// for production or http:// for local development.`)
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('protocol')) throw e
    throw new Error(`Invalid endpoint URL: "${endpoint}". Expected a valid URL like "https://db.headless.ly" or "http://localhost:8787".`)
  }
}

/**
 * Perform lazy auto-initialization with MemoryNounProvider.
 * Called on first $ property access when lazy mode is enabled or
 * when headlessly() has never been called.
 */
function _autoInit(): void {
  if (_initialized) return
  setProvider(new MemoryNounProvider())
  _initialized = true
}

/**
 * Enable lazy initialization so $ can be used without calling headlessly() first.
 * On first property access, auto-initializes with MemoryNounProvider.
 */
export function enableLazy(): void {
  _lazyEnabled = true
}

/**
 * headlessly() — Initialize the SDK
 *
 * Configures the NounProvider based on options:
 * - No args or no endpoint/apiKey: MemoryNounProvider (local in-memory)
 * - With endpoint + apiKey: RemoteNounProvider (calls db.headless.ly)
 * - Reads HEADLESSLY_ENDPOINT and HEADLESSLY_API_KEY env vars as fallbacks
 * - In browsers on *.headless.ly, auto-detects endpoint
 *
 * Returns the $ universal context.
 *
 * @example
 * ```ts
 * import { headlessly, $ } from '@headlessly/sdk'
 *
 * // Local memory mode (auto-detected)
 * headlessly()
 * await $.Contact.create({ name: 'Alice', stage: 'Lead' })
 *
 * // Remote mode
 * headlessly({ endpoint: 'https://db.headless.ly', apiKey: 'hly_sk_...' })
 *
 * // Lazy mode — no init call needed
 * headlessly({ lazy: true })
 * await $.Contact.create({ name: 'Alice', stage: 'Lead' }) // auto-inits on access
 *
 * // Zero-config — just use $ (auto-inits with memory provider)
 * import { $ } from '@headlessly/sdk'
 * await $.Contact.create({ name: 'Alice', stage: 'Lead' })
 * ```
 */
function _headlessly(options?: HeadlesslyOptions): HeadlessContext {
  if (_initialized) {
    throw new Error('headlessly() already initialized. Call headlessly.reset() before re-initializing, or use headlessly.reconfigure() to update options.')
  }

  // Handle lazy mode
  if (options?.lazy) {
    _lazyEnabled = true
    return $
  }

  // Resolve endpoint: explicit option > env var > browser auto-detect
  const endpoint = options?.endpoint || readEnv('HEADLESSLY_ENDPOINT') || detectEndpoint() || ''
  const apiKey = options?.apiKey || readEnv('HEADLESSLY_API_KEY') || ''

  // Validate endpoint if provided
  if (endpoint) {
    validateEndpoint(endpoint)
  }

  // If explicit endpoint option was empty string, that's an error when apiKey is given
  if (options?.endpoint === '') {
    throw new Error('Invalid endpoint: endpoint must not be empty. Expected a URL like "https://db.headless.ly" or "http://localhost:8787".')
  }

  // Configure provider
  if (endpoint && apiKey) {
    setProvider(new RemoteNounProvider(endpoint, apiKey))
  } else if (endpoint && !apiKey) {
    // Endpoint without apiKey — warn the developer
    console.warn(
      `[headlessly] Endpoint "${endpoint}" provided without an API key. Falling back to MemoryNounProvider. ` +
        'Set apiKey in options or HEADLESSLY_API_KEY env var for remote access.',
    )
    setProvider(new MemoryNounProvider())
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
  _lazyEnabled = false
  // Clean up event subscriptions
  for (const unsub of _activeUnsubscribes) {
    unsub()
  }
  _activeUnsubscribes.length = 0
  setProvider(null as unknown as NounProvider)
}

/**
 * Reconfigure the SDK without resetting — useful for switching providers mid-session
 */
_headlessly.reconfigure = function reconfigure(options: HeadlesslyOptions): HeadlessContext {
  _headlessly.reset()
  return _headlessly(options)
}

/**
 * Check if the SDK has been initialized
 */
_headlessly.isInitialized = function isInitialized(): boolean {
  return _initialized
}

export const headlessly = _headlessly

// Default export for ESM convenience: import headlessly from '@headlessly/sdk'
export default headlessly

/**
 * Entity name union type — all 35 entity names
 */
export type EntityName =
  | 'User'
  | 'ApiKey'
  | 'Organization'
  | 'Contact'
  | 'Lead'
  | 'Deal'
  | 'Activity'
  | 'Pipeline'
  | 'Customer'
  | 'Product'
  | 'Plan'
  | 'Price'
  | 'Subscription'
  | 'Invoice'
  | 'Payment'
  | 'Project'
  | 'Issue'
  | 'Comment'
  | 'Content'
  | 'Asset'
  | 'Site'
  | 'Ticket'
  | 'Event'
  | 'Metric'
  | 'Funnel'
  | 'Goal'
  | 'Campaign'
  | 'Segment'
  | 'Form'
  | 'Experiment'
  | 'FeatureFlag'
  | 'Workflow'
  | 'Integration'
  | 'Agent'
  | 'Message'

/**
 * Typed interface for the $ universal context
 *
 * Provides typed access to all 35 entities plus search/fetch/do operations.
 */
export interface HeadlessContext {
  // --- MCP-like operations ---

  /** Search entities across the graph */
  search(query: { type: EntityName | string; filter?: Record<string, unknown> }): Promise<NounInstance[]>
  /** Fetch a specific entity */
  fetch(query: { type: EntityName | string; id: string; include?: string[] }): Promise<NounInstance | null>
  /** Execute arbitrary code with full entity access */
  do(fn: (ctx: Record<EntityName | string, NounEntity>) => Promise<unknown>): Promise<unknown>

  // --- Events ---

  /** Subscribe to entity mutation events */
  events: {
    subscribe: {
      (callback: (event: EntityEvent) => void): () => void
      (options: { type?: string; action?: string }, callback: (event: EntityEvent) => void): () => void
    }
  }

  // --- Status ---

  /** Get system status including provider info, entity counts, and alerts */
  status: () => Promise<SystemStatus>

  // --- Identity ---
  User: NounEntity
  ApiKey: NounEntity

  // --- CRM ---
  Organization: NounEntity
  Contact: NounEntity
  Lead: NounEntity
  Deal: NounEntity
  Activity: NounEntity
  Pipeline: NounEntity

  // --- Billing ---
  Customer: NounEntity
  Product: NounEntity
  Plan: NounEntity
  Price: NounEntity
  Subscription: NounEntity
  Invoice: NounEntity
  Payment: NounEntity

  // --- Projects ---
  Project: NounEntity
  Issue: NounEntity
  Comment: NounEntity

  // --- Content ---
  Content: NounEntity
  Asset: NounEntity
  Site: NounEntity

  // --- Support ---
  Ticket: NounEntity

  // --- Analytics ---
  Event: NounEntity
  Metric: NounEntity
  Funnel: NounEntity
  Goal: NounEntity

  // --- Marketing ---
  Campaign: NounEntity
  Segment: NounEntity
  Form: NounEntity

  // --- Experiments ---
  Experiment: NounEntity
  FeatureFlag: NounEntity

  // --- Platform ---
  Workflow: NounEntity
  Integration: NounEntity
  Agent: NounEntity

  // --- Communication ---
  Message: NounEntity

  /** Access any entity by name (fallback index) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: NounEntity | ((...args: any[]) => any) | HeadlessContext['events'] | HeadlessContext['status']
}

/**
 * $ — The universal context
 *
 * Access all 35 entities and MCP-like operations:
 *   $.Contact.create({ name: 'Alice', stage: 'Lead' })
 *   $.search({ type: 'Contact', filter: { stage: 'Lead' } })
 *   $.fetch({ type: 'Contact', id: 'contact_abc123' })
 *   $.do(async ($) => { ... })
 *
 * Auto-initializes with MemoryNounProvider on first access if headlessly()
 * has not been called. This means you can skip the init call entirely
 * for quick prototyping:
 *
 *   import { $ } from '@headlessly/sdk'
 *   await $.Contact.create({ name: 'Alice', stage: 'Lead' })
 */
export const $: HeadlessContext = new Proxy({} as HeadlessContext, {
  get(_target, prop) {
    if (typeof prop === 'symbol') return undefined

    // Lazy auto-init: if $ is accessed before headlessly() was called, auto-init
    if (!_initialized && (prop in allEntities || prop === 'search' || prop === 'fetch' || prop === 'do' || prop === 'events' || prop === 'status')) {
      _autoInit()
    }

    // Events namespace
    if (prop === 'events') {
      return _eventsNamespace
    }

    // Status function
    if (prop === 'status') {
      return _statusFn
    }

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
        const instance = await entity.get(query.id)
        if (!instance || !query.include || query.include.length === 0) return instance

        // Resolve include back-references by inspecting the NounSchema
        // Use entity.$schema (always available on the proxy) rather than
        // getNounSchema() which may return undefined after clearRegistry()
        const schema = entity.$schema as NounSchema | undefined
        if (!schema) return instance

        const result = { ...instance } as Record<string, unknown>

        for (const includeName of query.include) {
          const rel = schema.relationships.get(includeName)
          if (rel && rel.operator === '<-' && rel.targetType) {
            // Back-reference: e.g. invoices: '<- Invoice.customer[]'
            // rel.targetType = 'Invoice', rel.backref = 'customer'
            const targetEntity = allEntities[rel.targetType]
            if (targetEntity && rel.backref) {
              const related = await targetEntity.find({ [rel.backref]: instance.$id })
              result[includeName] = related
            }
          } else if (!rel) {
            // Try to infer: look across all schemas for a forward ref pointing to this type
            // e.g. include 'contacts' on Organization — Contact has organization: '-> Organization.contacts'
            // Search all entities for one whose lowercase plural matches includeName
            const singularTarget = includeName.endsWith('s') ? includeName.slice(0, -1) : includeName
            const targetTypeName = Object.keys(allEntities).find(
              (name) => name.toLowerCase() === singularTarget.toLowerCase() || name.toLowerCase() + 's' === includeName.toLowerCase(),
            )
            if (targetTypeName) {
              const targetEntity = allEntities[targetTypeName]
              if (targetEntity) {
                // Find which field in the target type points to query.type
                const targetSchema = targetEntity.$schema as NounSchema | undefined
                if (targetSchema) {
                  for (const [fieldName, fieldRel] of targetSchema.relationships) {
                    if (fieldRel.operator === '->' && fieldRel.targetType === query.type) {
                      const related = await targetEntity.find({ [fieldName]: instance.$id })
                      result[includeName] = related
                      break
                    }
                  }
                }
              }
            }
          }
        }

        return result as NounInstance
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

// =============================================================================
// Headlessly() — Tenant-scoped org factory
// =============================================================================

/**
 * A headless.ly organization instance (tenant-scoped proxy)
 *
 * Provides access to all 35 entities via property access (org.Contact, org.Deal, etc.)
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

/**
 * Options for the Headlessly() tenant-scoped factory
 */
export interface HeadlesslyOrgOptions {
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

/** Domain namespace map for the org proxy */
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

/**
 * Configure a provider based on mode selection
 */
function configureOrgProvider(options: HeadlesslyOrgOptions): NounProvider {
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

/**
 * Headlessly() — Create a tenant-scoped organization instance
 *
 * Returns a HeadlesslyOrg proxy with access to all 35 entities + search/fetch/do,
 * scoped to a specific tenant.
 *
 * @example
 * ```typescript
 * import { Headlessly } from '@headlessly/sdk'
 *
 * // Memory mode (default — for testing and prototyping)
 * const org = Headlessly({ tenant: 'test' })
 * await org.Contact.create({ name: 'Alice', stage: 'Lead' })
 *
 * // Remote mode (rpc.do + capnweb promise pipelining)
 * const org = Headlessly({ tenant: 'acme', apiKey: 'key_...', mode: 'remote' })
 * ```
 */
export function Headlessly(options: HeadlesslyOrgOptions): HeadlesslyOrg {
  const { tenant } = options
  const context = `https://headless.ly/~${tenant}`

  configureOrgProvider(options)

  return new Proxy({} as HeadlesslyOrg, {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined
      if (prop === 'tenant') return tenant
      if (prop === 'context') return context
      if (prop === 'search') return $['search']
      if (prop === 'fetch') return $['fetch']
      if (prop === 'do') return $['do']
      if (prop in domainNamespaces) return domainNamespaces[prop]
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
