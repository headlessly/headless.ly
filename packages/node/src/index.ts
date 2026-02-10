/**
 * @headlessly/node - Node.js SDK
 *
 * Server-side analytics, errors, and feature flags for Node.js.
 *
 * @example
 * ```typescript
 * import { createClient } from '@headlessly/node'
 *
 * const headless = createClient({ apiKey: 'hl_xxx' })
 *
 * // Track server-side events
 * headless.track('api_called', { endpoint: '/users', method: 'GET' }, 'user_123')
 *
 * // Capture errors
 * try {
 *   await doSomething()
 * } catch (err) {
 *   headless.captureException(err, 'user_123')
 * }
 *
 * // Feature flags (server-side evaluation)
 * const enabled = await headless.isFeatureEnabled('new-api', 'user_123')
 *
 * // Middleware (Express/Hono)
 * app.use(headless.middleware())
 * ```
 */

const DEFAULT_ENDPOINT = 'https://headless.ly/e'
const DEFAULT_FLAG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// =============================================================================
// Types
// =============================================================================

export interface NodeConfig {
  apiKey: string
  endpoint?: string
  debug?: boolean
  release?: string
  environment?: string
  serverName?: string
  batchSize?: number
  flushInterval?: number
  maxRetries?: number
  timeout?: number
  maxQueueSize?: number
  flagCacheTTL?: number
  tags?: Record<string, string>
  onError?: (error: Error) => void
}

export type Severity = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

export interface User {
  id?: string
  email?: string
  username?: string
  [key: string]: unknown
}

export type FlagValue = boolean | string | number | Record<string, unknown>

interface Event {
  type: string
  ts: string
  [key: string]: unknown
}

// =============================================================================
// Client
// =============================================================================

export class HeadlessNodeClient {
  readonly apiKey: string
  readonly endpoint: string
  private config: NodeConfig
  private queue: Event[] = []
  private flushTimer?: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>
  private tags: Record<string, string> = {}
  private flagCache = new Map<string, { value: FlagValue; expires: number }>()
  private isShutdown = false

  constructor(config: NodeConfig) {
    this.config = {
      debug: false,
      batchSize: 20,
      flushInterval: 10000,
      maxRetries: 3,
      timeout: 30000,
      ...config,
    }

    this.apiKey = config.apiKey
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT
    if (config.tags) this.tags = { ...config.tags }

    this.debug('Initialized')
  }

  private startFlushTimer(): void {
    if (this.isShutdown) return
    this.flushTimer = setInterval(() => {
      void this.flush()
    }, this.config.flushInterval!)
  }

  private debug(msg: string, ctx?: Record<string, unknown>): void {
    if (this.config.debug) console.log(`[@headlessly/node] ${msg}`, ctx ?? '')
  }

  private uid(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  }

  private eventId(): string {
    const hex = '0123456789abcdef'
    let id = ''
    for (let i = 0; i < 32; i++) id += hex[Math.floor(Math.random() * 16)]
    return id
  }

  // ===========================================================================
  // Analytics
  // ===========================================================================

  track(event: string, properties?: Record<string, unknown>, distinctId?: string): void {
    this.enqueue({
      type: 'track',
      event,
      properties,
      distinctId: distinctId ?? this.uid(),
      ts: new Date().toISOString(),
    })
    this.debug('track', { event, distinctId })
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    this.enqueue({
      type: 'identify',
      userId,
      traits,
      ts: new Date().toISOString(),
    })
    this.debug('identify', { userId })
  }

  group(groupId: string, traits?: Record<string, unknown>, distinctId?: string): void {
    this.enqueue({
      type: 'group',
      groupId,
      groupTraits: traits,
      distinctId: distinctId ?? this.uid(),
      ts: new Date().toISOString(),
    })
    this.debug('group', { groupId })
  }

  // ===========================================================================
  // Errors
  // ===========================================================================

  captureException(error: Error, distinctId?: string, context?: { tags?: Record<string, string>; extra?: Record<string, unknown>; user?: User }): string {
    const id = this.eventId()

    this.enqueue({
      type: 'exception',
      eventId: id,
      ts: new Date().toISOString(),
      level: 'error',
      platform: 'node',
      serverName: this.config.serverName,
      release: this.config.release,
      environment: this.config.environment,
      exception: {
        type: error.name,
        value: error.message,
        stacktrace: error.stack ? this.parseStack(error.stack) : undefined,
      },
      distinctId,
      user: context?.user,
      tags: { ...this.tags, ...context?.tags },
      extra: context?.extra,
    })

    this.debug('captureException', { error: error.message, id })
    return id
  }

  captureMessage(message: string, level: Severity = 'info', distinctId?: string): string {
    const id = this.eventId()

    this.enqueue({
      type: 'message',
      eventId: id,
      ts: new Date().toISOString(),
      level,
      message,
      platform: 'node',
      serverName: this.config.serverName,
      release: this.config.release,
      environment: this.config.environment,
      distinctId,
      tags: { ...this.tags },
    })

    this.debug('captureMessage', { message, level })
    return id
  }

  private parseStack(stack: string): { filename?: string; function?: string; lineno?: number; colno?: number }[] {
    const frames: { filename?: string; function?: string; lineno?: number; colno?: number }[] = []
    for (const line of stack.split('\n')) {
      const m = line.match(/at (\S+) \((.+):(\d+):(\d+)\)/) || line.match(/at (.+):(\d+):(\d+)/)
      if (m) {
        frames.push(m.length === 5 ? { function: m[1], filename: m[2], lineno: +m[3], colno: +m[4] } : { filename: m[1], lineno: +m[2], colno: +m[3] })
      }
    }
    return frames.reverse()
  }

  // ===========================================================================
  // Feature Flags
  // ===========================================================================

  async getFeatureFlag(key: string, distinctId: string, options?: { defaultValue?: FlagValue }): Promise<FlagValue | undefined> {
    // Check cache
    const cached = this.flagCache.get(`${key}:${distinctId}`)
    if (cached && cached.expires > Date.now()) {
      return cached.value
    }

    try {
      const res = await fetch(`${this.endpoint}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({ distinctId, keys: [key] }),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      })

      if (res.ok) {
        const data = await res.json()
        const value = data.flags?.[key]
        if (value !== undefined) {
          const ttl = this.config.flagCacheTTL ?? DEFAULT_FLAG_CACHE_TTL
          this.flagCache.set(`${key}:${distinctId}`, { value, expires: Date.now() + ttl })
          this.track('$feature_flag_called', { $feature_flag: key, $feature_flag_response: value }, distinctId)
          return value
        }
        return options?.defaultValue
      }
    } catch (err) {
      this.debug('Failed to get flag', { key, error: err })
    }

    return options?.defaultValue !== undefined ? options.defaultValue : undefined
  }

  async getAllFlags(distinctId: string): Promise<Record<string, FlagValue>> {
    try {
      const res = await fetch(`${this.endpoint}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({ distinctId }),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      })

      if (res.ok) {
        const data = await res.json()
        return data.flags ?? {}
      }
    } catch (err) {
      this.debug('Failed to get all flags', { error: err })
    }

    return {}
  }

  async isFeatureEnabled(key: string, distinctId: string): Promise<boolean> {
    const v = await this.getFeatureFlag(key, distinctId)
    return v === true || v === 'true' || (typeof v === 'string' && v !== 'false' && v !== 'control')
  }

  // ===========================================================================
  // Context
  // ===========================================================================

  setTag(key: string, value: string): void {
    this.tags[key] = value
  }

  setTags(tags: Record<string, string>): void {
    Object.assign(this.tags, tags)
  }

  // ===========================================================================
  // Middleware
  // ===========================================================================

  /**
   * Express/Hono middleware for automatic request tracking and error capture
   */
  middleware() {
    return async (
      req: { method: string; url: string; path?: string; headers?: Record<string, string> },
      res: { statusCode?: number },
      next: () => Promise<void> | void,
    ) => {
      const start = Date.now()

      try {
        await next()
      } catch (err) {
        if (err instanceof Error) {
          this.captureException(err)
        }
        throw err
      } finally {
        const duration = Date.now() - start
        this.track('http_request', {
          method: req.method,
          path: req.path ?? req.url,
          status: res.statusCode,
          duration,
        })
      }
    }
  }

  // ===========================================================================
  // Queue & Flush
  // ===========================================================================

  get queueSize(): number {
    return this.queue.length
  }

  private enqueue(event: Event): void {
    const maxQueueSize = this.config.maxQueueSize
    if (maxQueueSize !== undefined && this.queue.length >= maxQueueSize) {
      // Drop oldest event to make room
      this.queue.shift()
    }
    this.queue.push(event)
    if (!this.flushTimer && !this.isShutdown) {
      this.startFlushTimer()
    }
    if (this.queue.length >= (this.config.batchSize ?? 20)) {
      this.flush()
    }
  }

  async flush(): Promise<void> {
    if (!this.queue.length) return

    const events = this.queue.splice(0)
    await this.send(events)
  }

  private async send(events: Event[], attempt = 0): Promise<void> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(this.config.timeout ?? 30000),
      })

      if (!res.ok) {
        const status = res.status
        // Don't retry on 4xx client errors
        if (status >= 400 && status < 500) {
          this.config.onError?.(new Error(`HTTP ${status}`))
          return
        }
        throw new Error(`HTTP ${status}`)
      }
      this.debug('Sent', { count: events.length })
    } catch (err) {
      this.debug('Send failed', { error: err, attempt })

      if (attempt < (this.config.maxRetries ?? 3)) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
        await this.send(events, attempt + 1)
      } else {
        this.config.onError?.(err instanceof Error ? err : new Error(String(err)))
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.isShutdown) return
    this.isShutdown = true
    if (this.flushTimer) clearInterval(this.flushTimer)
    this.flushTimer = undefined
    await this.flush()
    this.debug('Shutdown')
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createClient(config: NodeConfig): HeadlessNodeClient {
  return new HeadlessNodeClient(config)
}

// =============================================================================
// Singleton (Headlessly.init)
// =============================================================================

let _singleton: HeadlessNodeClient | undefined

export const Headlessly = {
  init(config: NodeConfig): HeadlessNodeClient {
    if (!config.apiKey) {
      throw new Error('apiKey is required')
    }
    if (_singleton) return _singleton

    _singleton = new HeadlessNodeClient(config)

    process.once('SIGTERM', () => {
      void _singleton?.shutdown().then(() => process.exit(0))
    })
    process.once('SIGINT', () => {
      void _singleton?.shutdown().then(() => process.exit(0))
    })

    return _singleton
  },

  async reset(): Promise<void> {
    if (_singleton) {
      await _singleton.shutdown()
    }
    _singleton = undefined
  },
}

// =============================================================================
// Express middleware
// =============================================================================

export function expressMiddleware(client: HeadlessNodeClient) {
  return function expressMw(
    req: { method: string; url: string; path?: string; headers: Record<string, string> },
    res: { statusCode: number; on: (event: string, cb: () => void) => void },
    next: () => void,
  ): void {
    const start = Date.now()

    res.on('finish', () => {
      const duration = Date.now() - start
      client.track('http_request', {
        method: req.method,
        path: req.path ?? req.url,
        status: res.statusCode,
        duration,
        userAgent: req.headers['user-agent'],
      })
    })

    try {
      next()
    } catch (err) {
      if (err instanceof Error) {
        client.captureException(err)
      }
      throw err
    }
  }
}

// =============================================================================
// Hono middleware
// =============================================================================

export function honoMiddleware(client: HeadlessNodeClient) {
  return async function honoMw(
    c: {
      req: {
        method: string
        path: string
        url: string
        header: (name: string) => string | undefined
      }
      res: { status: number }
    },
    next: () => Promise<void>,
  ): Promise<void> {
    const start = Date.now()

    try {
      await next()
    } catch (err) {
      if (err instanceof Error) {
        client.captureException(err)
      }
      throw err
    } finally {
      const duration = Date.now() - start
      client.track('http_request', {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration,
        userAgent: c.req.header('user-agent'),
      })
    }
  }
}

// =============================================================================
// Node-specific SDK features
// =============================================================================

export { headlessly } from './headlessly.js'
export type { HeadlesslyNodeOptions, HeadlesslyNodeResult } from './headlessly.js'

export { NDJSONEventPersistence } from './ndjson-events.js'
export type { PersistedEvent, NDJSONEventPersistenceOptions } from './ndjson-events.js'

export { createServer } from './server.js'
export type { CreateServerOptions, ServerEntity } from './server.js'

export { sync } from './sync.js'
export type { SyncOptions, SyncResult, SyncProvider } from './sync.js'

export default { createClient, HeadlessNodeClient, Headlessly, expressMiddleware, honoMiddleware }
