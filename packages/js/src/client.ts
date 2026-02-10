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

import type { HeadlessConfig, AnalyticsEvent, ErrorEvent, WebVitals, Breadcrumb, User, FlagValue, FeatureFlag, Severity, ForwarderConfig } from './types.js'
import { ForwardingManager, GoogleAnalyticsForwarder, SegmentForwarder, PostHogForwarder } from './forwarding.js'
import type { EventForwarder } from './forwarding.js'
import { RealtimeManager } from './realtime.js'
import type { SubscriptionHandler, SubscriptionMessage, RealtimeState } from './realtime.js'
import { AutoCaptureManager } from './autocapture.js'

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
  private flushTimer?: ReturnType<typeof setInterval>
  private retryTimer?: ReturnType<typeof setTimeout>

  private anonymousId!: string
  private userId?: string
  private sessionId!: string
  user: User | null = null
  private tags: Record<string, string> = {}
  private extras: Record<string, unknown> = {}
  private breadcrumbs: Breadcrumb[] = []
  private featureFlags = new Map<string, FeatureFlag>()
  private flagChangeListeners = new Map<string, Set<(value: FlagValue) => void>>()
  private flagsFetchedAt = 0

  private optedOut = false
  private initialized = false
  private _preflushed = false
  private _trackingFlag = false

  // Forwarding, realtime, and auto-capture
  private forwarding = new ForwardingManager()
  private realtime: RealtimeManager | null = null
  private autoCapture: AutoCaptureManager | null = null

  // Stored listener references for cleanup
  private _visibilityListener: (() => void) | null = null
  private _pagehideListener: (() => void) | null = null
  private _errorListener: ((e: ErrorEvent | { error?: Error; message?: string }) => void) | null = null
  private _rejectionListener: ((e: { reason?: unknown }) => void) | null = null
  private _vitalsVisibilityListener: (() => void) | null = null

  // ===========================================================================
  // Initialization
  // ===========================================================================

  init(config: HeadlessConfig): void {
    if (this.initialized) {
      console.warn('@headlessly/js: Already initialized')
      // Re-apply config for re-initialization
      this.config = { ...this.config, ...config }
      this.endpoint = config.endpoint ?? this.endpoint
      return
    }

    if (!config?.apiKey) {
      throw new Error('@headlessly/js: apiKey is required')
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
    if (storage) {
      this.anonymousId = getOrCreateId('hl_anon', storage)
    } else {
      this.anonymousId = this.anonymousId || uid()
    }
    try {
      this.sessionId = getOrCreateId('hl_session', sessionStorage)
    } catch {
      this.sessionId = this.sessionId || uid()
    }

    // Check opt-out
    try {
      if (storage) this.optedOut = storage.getItem('hl_opt_out') === 'true'
    } catch {}

    // Respect Do Not Track
    if (this.config.respectDoNotTrack) {
      try {
        if (typeof navigator !== 'undefined' && navigator?.doNotTrack === '1') {
          this.optedOut = true
        }
      } catch {}
    }

    // Set up flush interval
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval)

    // Page lifecycle
    if (typeof window !== 'undefined' && window) {
      try {
        this._visibilityListener = () => {
          if (typeof document !== 'undefined' && document?.visibilityState === 'hidden') this.flush(true)
        }
        this._pagehideListener = () => this.flush(true)
        window.addEventListener('visibilitychange', this._visibilityListener)
        window.addEventListener('pagehide', this._pagehideListener)
      } catch {}

      // Auto error capture
      if (this.config.captureErrors) {
        try {
          this._errorListener = (e: ErrorEvent | { error?: Error; message?: string }) => {
            const err = (e as { error?: Error }).error || new Error((e as { message?: string }).message || 'Unknown error')
            this.captureException(err)
          }
          this._rejectionListener = (e: { reason?: unknown }) => {
            this.captureException(e.reason instanceof Error ? e.reason : new Error(String(e.reason)))
          }
          window.addEventListener('error', this._errorListener as EventListener)
          window.addEventListener('unhandledrejection', this._rejectionListener as EventListener)
        } catch {}
      }

      // Web vitals
      if (this.config.captureWebVitals) this.setupWebVitals()
    }

    // Load feature flags
    this.loadFeatureFlags()

    // Set up event forwarders
    if (this.config.forwarders) {
      this.setupForwarders(this.config.forwarders)
    }

    // Set up auto-capture
    if (this.config.autoCapture) {
      this.autoCapture = new AutoCaptureManager(this.config.autoCapture, {
        track: (event, properties) => this.track(event, properties),
        page: (name, properties) => this.page(name, properties),
      })
      this.autoCapture.start()
    }

    this.initialized = true
    this.debug('Initialized')
  }

  private setupForwarders(configs: ForwarderConfig[]): void {
    for (const config of configs) {
      switch (config.type) {
        case 'google-analytics':
          this.forwarding.add(new GoogleAnalyticsForwarder({ measurementId: config.measurementId }))
          break
        case 'segment':
          this.forwarding.add(new SegmentForwarder({ writeKey: config.writeKey }))
          break
        case 'posthog':
          this.forwarding.add(new PostHogForwarder({ apiKey: config.apiKey, host: config.host }))
          break
      }
    }
  }

  private getStorage(): Storage | null {
    try {
      if (this.config.persistence === 'memory') return null
      if (this.config.persistence === 'sessionStorage') return sessionStorage
      return localStorage
    } catch {
      return null
    }
  }

  private debug(msg: string, ctx?: Record<string, unknown>): void {
    if (this.config?.debug) console.log(`[@headlessly/js] ${msg}`, ctx ?? '')
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
    try {
      this.addBreadcrumb({ category: 'navigation', message: name || (typeof location !== 'undefined' ? location.pathname : '') })
    } catch {}
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
    if (traits) {
      this.user = { ...this.user, id: userId, ...traits }
    } else if (!this.user) {
      this.user = { id: userId }
    } else {
      this.user = { ...this.user, id: userId }
    }

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
    let url: string | undefined
    let path: string | undefined
    let referrer: string | undefined
    let title: string | undefined
    let userAgent: string | undefined

    try {
      if (typeof location !== 'undefined' && location) {
        url = location.href
        path = location.pathname
      }
    } catch {}

    try {
      if (typeof document !== 'undefined' && document) {
        referrer = document.referrer
        title = document.title
      }
    } catch {}

    try {
      if (typeof navigator !== 'undefined' && navigator) {
        userAgent = navigator.userAgent
      }
    } catch {}

    return {
      ts: new Date().toISOString(),
      anonymousId: this.anonymousId,
      userId: this.userId,
      sessionId: this.sessionId,
      url,
      path,
      referrer,
      title,
      userAgent,
    }
  }

  // ===========================================================================
  // Errors
  // ===========================================================================

  captureException(error: unknown, context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }): string {
    if (this.optedOut) return ''

    let err: Error
    if (error instanceof Error) {
      err = error
    } else {
      err = new Error(String(error))
    }

    const id = eventId()
    const event: ErrorEvent = {
      type: 'exception',
      eventId: id,
      ts: new Date().toISOString(),
      level: 'error',
      exception: {
        type: err.name,
        value: err.message,
        stacktrace: err.stack ? this.parseStack(err.stack) : undefined,
      },
      user: this.user || undefined,
      tags: { ...this.tags, ...context?.tags },
      extra: { ...this.extras, ...context?.extra },
      breadcrumbs: [...this.breadcrumbs],
      release: this.config?.release,
      environment: this.config?.environment,
    }

    this.enqueue(event)
    this.debug('captureException', { error: err.message, id })
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
      release: this.config?.release,
      environment: this.config?.environment,
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
    // Check if TTL has expired
    if (this.config?.flagsTTL && this.flagsFetchedAt > 0) {
      const age = Date.now() - this.flagsFetchedAt
      if (age > this.config.flagsTTL) {
        this.loadFeatureFlags()
      }
    }

    const flag = this.featureFlags.get(key)
    if (flag && !this._trackingFlag) {
      this._trackingFlag = true
      try {
        this.track('$feature_flag_called', { $feature_flag: key, $feature_flag_response: flag.value })
      } finally {
        this._trackingFlag = false
      }
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

  onFlagChange(key: string, callback: (value: FlagValue) => void): void {
    if (!this.flagChangeListeners.has(key)) {
      this.flagChangeListeners.set(key, new Set())
    }
    this.flagChangeListeners.get(key)!.add(callback)
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
            const oldFlag = this.featureFlags.get(k)
            const oldValue = oldFlag?.value
            this.featureFlags.set(k, { key: k, value: v as FlagValue })
            // Notify change listeners
            if (oldValue !== undefined && oldValue !== v) {
              const listeners = this.flagChangeListeners.get(k)
              if (listeners) {
                for (const cb of listeners) cb(v as FlagValue)
              }
            } else if (oldValue === undefined && this.flagChangeListeners.has(k)) {
              // First load but listener was registered — notify with initial value
              const listeners = this.flagChangeListeners.get(k)
              if (listeners) {
                for (const cb of listeners) cb(v as FlagValue)
              }
            }
          }
        }
        this.flagsFetchedAt = Date.now()
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

      if (typeof window !== 'undefined' && window) {
        this._vitalsVisibilityListener = () => {
          if (typeof document !== 'undefined' && document?.visibilityState === 'hidden' && cls > 0) this.captureWebVitals({ cls })
        }
        window.addEventListener('visibilitychange', this._vitalsVisibilityListener)
      }
    } catch {}
  }

  // ===========================================================================
  // Consent
  // ===========================================================================

  consentGranted(): void {
    this.optedOut = false
  }

  consentRevoked(): void {
    this.optedOut = true
  }

  // ===========================================================================
  // Opt Out / Reset
  // ===========================================================================

  optOut(): void {
    this.optedOut = true
    try {
      const storage = this.getStorage()
      if (storage) storage.setItem('hl_opt_out', 'true')
    } catch {}
  }

  optIn(): void {
    this.optedOut = false
    try {
      const storage = this.getStorage()
      if (storage) storage.removeItem('hl_opt_out')
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
    this.flagChangeListeners.clear()
    this.flagsFetchedAt = 0
    this.breadcrumbs = []
    this.queue = []
    this.retryQueue = []
    this.optedOut = false
    this.tags = {}
    this.extras = {}
    this.initialized = false
    this._preflushed = false
    if (this.flushTimer) clearInterval(this.flushTimer)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.flushTimer = undefined
    this.retryTimer = undefined
    // Clean up forwarding, auto-capture, and realtime
    this.autoCapture?.stop()
    this.autoCapture = null
    this.forwarding.clear()
    this.realtime?.shutdown()
    this.realtime = null
    try {
      const storage = this.getStorage()
      if (storage) storage.removeItem('hl_anon')
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
    // Forward to external services in real-time
    this.forwarding.forward(event)
    if (this.queue.length >= (this.config?.batchSize ?? 10)) this.flush()
  }

  async flush(beacon = false): Promise<void> {
    if (!this.queue.length) return

    const events = this.queue.splice(0)

    if (beacon) {
      try {
        if (typeof navigator !== 'undefined' && navigator?.sendBeacon) {
          navigator.sendBeacon(this.endpoint, JSON.stringify({ events }))
          return
        }
      } catch {}
    }

    // Refresh flags before first network send (fire-and-forget so send is not delayed)
    if (!this._preflushed) {
      this._preflushed = true
      this.loadFeatureFlags()
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

      if (!res.ok) {
        // Do not retry on 4xx client errors
        if (res.status >= 400 && res.status < 500) {
          this.debug('Client error, not retrying', { status: res.status })
          this.config.onError?.(new Error(`HTTP ${res.status}`))
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
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
    )
  }

  private async processRetry(): Promise<void> {
    if (!this.retryQueue.length) return
    const batch = this.retryQueue.shift()!
    await this.send(batch.events, batch.attempts)
    if (this.retryQueue.length) this.scheduleRetry()
  }

  // ===========================================================================
  // Event Forwarding
  // ===========================================================================

  addForwarder(forwarder: EventForwarder): void {
    this.forwarding.add(forwarder)
  }

  removeForwarder(name: string): void {
    this.forwarding.remove(name)
  }

  getForwarders(): EventForwarder[] {
    return this.forwarding.getForwarders()
  }

  // ===========================================================================
  // Real-time Subscriptions
  // ===========================================================================

  subscribe(entityType: string, handler: SubscriptionHandler): () => void {
    if (!this.realtime) {
      this.realtime = new RealtimeManager({
        endpoint: this.config?.wsEndpoint,
        apiKey: this.config?.apiKey,
      })
    }
    return this.realtime.subscribe(entityType, handler)
  }

  connectRealtime(): void {
    if (!this.realtime) {
      this.realtime = new RealtimeManager({
        endpoint: this.config?.wsEndpoint,
        apiKey: this.config?.apiKey,
      })
    }
    this.realtime.connect()
  }

  disconnectRealtime(): void {
    if (this.realtime) {
      this.realtime.disconnect()
    }
  }

  get realtimeState(): RealtimeState {
    return this.realtime?.state ?? 'disconnected'
  }

  onRealtimeStateChange(listener: (state: RealtimeState) => void): () => void {
    if (!this.realtime) {
      this.realtime = new RealtimeManager({
        endpoint: this.config?.wsEndpoint,
        apiKey: this.config?.apiKey,
      })
    }
    return this.realtime.onStateChange(listener)
  }

  // ===========================================================================
  // Shutdown
  // ===========================================================================

  async shutdown(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer)
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.autoCapture?.stop()
    this.autoCapture = null
    this.forwarding.flush()
    this.forwarding.shutdown()
    this.realtime?.shutdown()
    this.realtime = null

    // Remove window event listeners
    if (typeof window !== 'undefined' && window) {
      try {
        if (this._visibilityListener) window.removeEventListener('visibilitychange', this._visibilityListener)
        if (this._pagehideListener) window.removeEventListener('pagehide', this._pagehideListener)
        if (this._errorListener) window.removeEventListener('error', this._errorListener as EventListener)
        if (this._rejectionListener) window.removeEventListener('unhandledrejection', this._rejectionListener as EventListener)
        if (this._vitalsVisibilityListener) window.removeEventListener('visibilitychange', this._vitalsVisibilityListener)
      } catch {}
    }
    this._visibilityListener = null
    this._pagehideListener = null
    this._errorListener = null
    this._rejectionListener = null
    this._vitalsVisibilityListener = null

    await this.flush()
    this.initialized = false
  }
}
