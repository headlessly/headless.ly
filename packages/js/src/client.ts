/// <reference lib="dom" />
/**
 * @headlessly/js - Browser Client
 *
 * Unified SDK for analytics, errors, and feature flags.
 * All events are sent to headless.ly, which handles:
 * - Forwarding to PostHog (analytics, feature flags)
 * - Forwarding to Sentry (errors)
 * - Storing in Iceberg datalake
 */

import type { HeadlessConfig, AnalyticsEvent, ErrorEvent, WebVitals, Breadcrumb, User, FlagValue, FeatureFlag, Severity } from './types.js'

const DEFAULT_ENDPOINT = 'https://headless.ly/e'

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
const eventId = () => {
  const hex = '0123456789abcdef'
  let id = ''
  for (let i = 0; i < 32; i++) id += hex[Math.floor(Math.random() * 16)]
  return id
}

const getOrCreateId = (key: string, storage: Storage): string => {
  try {
    let id = storage.getItem(key)
    if (!id) storage.setItem(key, (id = uid()))
    return id
  } catch {
    return uid()
  }
}

interface PendingBatch {
  events: (AnalyticsEvent | ErrorEvent)[]
  attempts: number
  nextRetry: number
}

export class HeadlessClient {
  private config!: HeadlessConfig
  private endpoint!: string
  private queue: (AnalyticsEvent | ErrorEvent)[] = []
  private retryQueue: PendingBatch[] = []
  private flushTimer?: number
  private retryTimer?: number

  private anonymousId!: string
  private userId?: string
  private sessionId!: string
  private user: User | null = null
  private tags: Record<string, string> = {}
  private extras: Record<string, unknown> = {}
  private breadcrumbs: Breadcrumb[] = []
  private featureFlags = new Map<string, FeatureFlag>()

  private optedOut = false
  private initialized = false

  // ===========================================================================
  // Initialization
  // ===========================================================================

  init(config: HeadlessConfig): void {
    if (this.initialized) {
      console.warn('@headlessly/js: Already initialized')
      return
    }

    this.config = {
      debug: false,
      sampleRate: 1,
      batchSize: 10,
      flushInterval: 5000,
      persistence: 'localStorage',
      captureErrors: true,
      captureWebVitals: true,
      ...config,
    }

    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT
    if (config.tags) this.tags = { ...config.tags }

    // Initialize IDs
    const storage = this.getStorage()
    this.anonymousId = getOrCreateId('hl_anon', storage)
    this.sessionId = getOrCreateId('hl_session', sessionStorage)

    // Check opt-out
    try {
      this.optedOut = storage.getItem('hl_opt_out') === 'true'
    } catch {}

    // Set up flush interval
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval) as unknown as number

    // Page lifecycle
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush(true)
      })
      window.addEventListener('pagehide', () => this.flush(true))

      // Auto error capture
      if (this.config.captureErrors) {
        window.addEventListener('error', (e) => this.captureException(e.error || new Error(e.message)))
        window.addEventListener('unhandledrejection', (e) => {
          this.captureException(e.reason instanceof Error ? e.reason : new Error(String(e.reason)))
        })
      }

      // Web vitals
      if (this.config.captureWebVitals) this.setupWebVitals()

      // Load feature flags
      this.loadFeatureFlags()
    }

    this.initialized = true
    this.debug('Initialized')
  }

  private getStorage(): Storage {
    if (this.config.persistence === 'sessionStorage') return sessionStorage
    if (this.config.persistence === 'memory') return sessionStorage // fallback
    return localStorage
  }

  private debug(msg: string, ctx?: Record<string, unknown>): void {
    if (this.config.debug) console.log(`[@headlessly/js] ${msg}`, ctx ?? '')
  }

  private shouldSample(): boolean {
    return Math.random() <= (this.config.sampleRate ?? 1)
  }

  // ===========================================================================
  // Analytics
  // ===========================================================================

  page(name?: string, properties?: Record<string, unknown>): void {
    if (this.optedOut || !this.shouldSample()) return

    const event: AnalyticsEvent = {
      type: 'page',
      event: name,
      properties,
      ...this.baseEvent(),
    }

    this.enqueue(event)
    this.addBreadcrumb({ category: 'navigation', message: name || location.pathname })
    this.debug('page', { name })
  }

  track(eventName: string, properties?: Record<string, unknown>): void {
    if (this.optedOut || !this.shouldSample()) return

    const event: AnalyticsEvent = {
      type: 'track',
      event: eventName,
      properties,
      ...this.baseEvent(),
    }

    this.enqueue(event)
    this.addBreadcrumb({ category: 'track', message: eventName, data: properties })
    this.debug('track', { event: eventName })
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    if (this.optedOut) return

    this.userId = userId
    if (traits) this.user = { id: userId, ...traits }

    const event: AnalyticsEvent = {
      type: 'identify',
      userId,
      traits,
      ...this.baseEvent(),
    }

    this.enqueue(event)
    this.debug('identify', { userId })
  }

  alias(userId: string, previousId?: string): void {
    if (this.optedOut) return

    const event: AnalyticsEvent = {
      type: 'alias',
      userId,
      properties: { previousId: previousId ?? this.anonymousId },
      ...this.baseEvent(),
    }

    this.enqueue(event)
    this.debug('alias', { userId, previousId })
  }

  group(groupId: string, traits?: Record<string, unknown>): void {
    if (this.optedOut) return

    const event: AnalyticsEvent = {
      type: 'group',
      groupId,
      groupTraits: traits,
      ...this.baseEvent(),
    }

    this.enqueue(event)
    this.debug('group', { groupId })
  }

  private baseEvent(): Omit<AnalyticsEvent, 'type'> {
    return {
      ts: new Date().toISOString(),
      anonymousId: this.anonymousId,
      userId: this.userId,
      sessionId: this.sessionId,
      url: location?.href,
      path: location?.pathname,
      referrer: document?.referrer,
      userAgent: navigator?.userAgent,
    }
  }

  // ===========================================================================
  // Errors
  // ===========================================================================

  captureException(error: Error, context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }): string {
    if (this.optedOut) return ''

    const id = eventId()
    const event: ErrorEvent = {
      type: 'exception',
      eventId: id,
      ts: new Date().toISOString(),
      level: 'error',
      exception: {
        type: error.name,
        value: error.message,
        stacktrace: error.stack ? this.parseStack(error.stack) : undefined,
      },
      user: this.user || undefined,
      tags: { ...this.tags, ...context?.tags },
      extra: { ...this.extras, ...context?.extra },
      breadcrumbs: [...this.breadcrumbs],
      release: this.config.release,
      environment: this.config.environment,
    }

    this.enqueue(event)
    this.debug('captureException', { error: error.message, id })
    return id
  }

  captureMessage(message: string, level: Severity = 'info'): string {
    if (this.optedOut) return ''

    const id = eventId()
    const event: ErrorEvent = {
      type: 'message',
      eventId: id,
      ts: new Date().toISOString(),
      level,
      message,
      user: this.user || undefined,
      tags: { ...this.tags },
      extra: { ...this.extras },
      breadcrumbs: [...this.breadcrumbs],
      release: this.config.release,
      environment: this.config.environment,
    }

    this.enqueue(event)
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
  // Context
  // ===========================================================================

  setUser(user: User | null): void {
    this.user = user
    if (user?.id) this.userId = user.id
  }

  setTag(key: string, value: string): void {
    this.tags[key] = value
  }

  setTags(tags: Record<string, string>): void {
    Object.assign(this.tags, tags)
  }

  setExtra(key: string, value: unknown): void {
    this.extras[key] = value
  }

  addBreadcrumb(crumb: Breadcrumb): void {
    this.breadcrumbs.push({ ...crumb, ts: crumb.ts || new Date().toISOString() })
    if (this.breadcrumbs.length > 100) this.breadcrumbs.shift()
  }

  // ===========================================================================
  // Feature Flags
  // ===========================================================================

  getFeatureFlag(key: string): FlagValue | undefined {
    const flag = this.featureFlags.get(key)
    if (flag) {
      this.track('$feature_flag_called', { $feature_flag: key, $feature_flag_response: flag.value })
    }
    return flag?.value
  }

  isFeatureEnabled(key: string): boolean {
    const v = this.getFeatureFlag(key)
    return v === true || v === 'true' || (typeof v === 'string' && v !== 'false' && v !== 'control')
  }

  getAllFlags(): Record<string, FeatureFlag> {
    const out: Record<string, FeatureFlag> = {}
    for (const [k, v] of this.featureFlags) out[k] = v
    return out
  }

  async reloadFeatureFlags(): Promise<void> {
    await this.loadFeatureFlags()
  }

  private async loadFeatureFlags(): Promise<void> {
    try {
      const res = await fetch(`${this.endpoint}/flags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({ distinctId: this.userId ?? this.anonymousId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.flags) {
          for (const [k, v] of Object.entries(data.flags)) {
            this.featureFlags.set(k, { key: k, value: v as FlagValue })
          }
        }
        this.debug('Flags loaded', { count: this.featureFlags.size })
      }
    } catch (e) {
      this.debug('Failed to load flags', { error: e })
    }
  }

  // ===========================================================================
  // Web Vitals
  // ===========================================================================

  captureWebVitals(metrics: Partial<WebVitals>): void {
    if (this.optedOut) return
    this.track('$web_vitals', metrics)
  }

  private setupWebVitals(): void {
    if (typeof PerformanceObserver === 'undefined') return

    try {
      // LCP
      new PerformanceObserver((list) => {
        const e = list.getEntries().pop()
        if (e) this.captureWebVitals({ lcp: e.startTime })
      }).observe({ type: 'largest-contentful-paint', buffered: true })

      // FID
      new PerformanceObserver((list) => {
        const e = list.getEntries()[0] as PerformanceEventTiming | undefined
        if (e) this.captureWebVitals({ fid: e.processingStart - e.startTime })
      }).observe({ type: 'first-input', buffered: true })

      // CLS
      let cls = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { hadRecentInput?: boolean; value?: number })[]) {
          if (!e.hadRecentInput) cls += e.value ?? 0
        }
      }).observe({ type: 'layout-shift', buffered: true })

      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && cls > 0) this.captureWebVitals({ cls })
      })
    } catch {}
  }

  // ===========================================================================
  // Opt Out / Reset
  // ===========================================================================

  optOut(): void {
    this.optedOut = true
    try {
      this.getStorage().setItem('hl_opt_out', 'true')
    } catch {}
  }

  optIn(): void {
    this.optedOut = false
    try {
      this.getStorage().removeItem('hl_opt_out')
    } catch {}
  }

  hasOptedOut(): boolean {
    return this.optedOut
  }

  reset(): void {
    this.userId = undefined
    this.user = null
    this.anonymousId = uid()
    this.sessionId = uid()
    this.featureFlags.clear()
    this.breadcrumbs = []
    try {
      this.getStorage().removeItem('hl_anon')
      sessionStorage.removeItem('hl_session')
    } catch {}
  }

  getDistinctId(): string {
    return this.userId ?? this.anonymousId
  }

  getSessionId(): string {
    return this.sessionId
  }

  // ===========================================================================
  // Queue & Flush
  // ===========================================================================

  private enqueue(event: AnalyticsEvent | ErrorEvent): void {
    this.queue.push(event)
    if (this.queue.length >= (this.config.batchSize ?? 10)) this.flush()
  }

  async flush(beacon = false): Promise<void> {
    if (!this.queue.length) return

    const events = this.queue.splice(0)

    if (beacon && navigator?.sendBeacon) {
      navigator.sendBeacon(this.endpoint, JSON.stringify({ events }))
      return
    }

    await this.send(events)
  }

  private async send(events: (AnalyticsEvent | ErrorEvent)[], attempt = 0): Promise<void> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({ events }),
        keepalive: true,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      this.debug('Sent', { count: events.length })
    } catch (err) {
      this.debug('Send failed', { error: err, attempt })

      if (attempt < 3) {
        this.retryQueue.push({ events, attempts: attempt + 1, nextRetry: Date.now() + 1000 * 2 ** attempt })
        this.scheduleRetry()
      } else {
        this.config.onError?.(err instanceof Error ? err : new Error(String(err)))
      }
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer || !this.retryQueue.length) return
    const next = this.retryQueue[0]
    this.retryTimer = setTimeout(
      () => {
        this.retryTimer = undefined
        this.processRetry()
      },
      Math.max(0, next.nextRetry - Date.now()),
    ) as unknown as number
  }

  private async processRetry(): Promise<void> {
    if (!this.retryQueue.length) return
    const batch = this.retryQueue.shift()!
    await this.send(batch.events, batch.attempts)
    if (this.retryQueue.length) this.scheduleRetry()
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    await this.flush()
    this.initialized = false
  }
}
