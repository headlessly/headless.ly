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
  private config: NodeConfig
  private endpoint: string
  private queue: Event[] = []
  private flushTimer?: ReturnType<typeof setInterval>
  private tags: Record<string, string> = {}
  private flagCache = new Map<string, { value: FlagValue; expires: number }>()

  constructor(config: NodeConfig) {
    this.config = {
      debug: false,
      batchSize: 20,
      flushInterval: 10000,
      maxRetries: 3,
      timeout: 30000,
      ...config,
    }

    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT
    if (config.tags) this.tags = { ...config.tags }

    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval)
    this.debug('Initialized')
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

  async getFeatureFlag(key: string, distinctId: string): Promise<FlagValue | undefined> {
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
          // Cache for 5 minutes
          this.flagCache.set(`${key}:${distinctId}`, { value, expires: Date.now() + 5 * 60 * 1000 })
          this.track('$feature_flag_called', { $feature_flag: key, $feature_flag_response: value }, distinctId)
        }
        return value
      }
    } catch (err) {
      this.debug('Failed to get flag', { key, error: err })
    }

    return undefined
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

  private enqueue(event: Event): void {
    this.queue.push(event)
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

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
    if (this.flushTimer) clearInterval(this.flushTimer)
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

export default { createClient, HeadlessNodeClient }
