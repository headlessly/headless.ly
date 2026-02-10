/**
 * @headlessly/js - Browser SDK
 *
 * Unified analytics, errors, feature flags, event forwarding,
 * and real-time subscriptions for the browser.
 *
 * @example
 * ```typescript
 * import { headlessly } from '@headlessly/js'
 *
 * // Auto-detects endpoint on *.headless.ly
 * headlessly({ apiKey: 'hl_xxx' })
 *
 * // Or use the singleton API
 * import headless from '@headlessly/js'
 * headless.init({ apiKey: 'hl_xxx' })
 *
 * headless.page()
 * headless.track('signup_completed', { plan: 'pro' })
 * headless.identify('user_123', { email: 'user@example.com' })
 *
 * if (headless.isFeatureEnabled('new-checkout')) {
 *   // show new checkout
 * }
 *
 * // Real-time entity subscriptions
 * headless.subscribe('Contact', (msg) => console.log('Contact updated:', msg))
 *
 * // Event forwarding to GA, Segment, PostHog
 * headless.init({
 *   apiKey: 'hl_xxx',
 *   forwarders: [
 *     { type: 'google-analytics', measurementId: 'G-XXXXX' },
 *     { type: 'posthog', apiKey: 'phc_xxx' },
 *   ],
 * })
 * ```
 */

import { HeadlessClient } from './client.js'
import type { HeadlessConfig, User, Breadcrumb, WebVitals, FlagValue, FeatureFlag, Severity, ForwarderConfig } from './types.js'
import type { EventForwarder } from './forwarding.js'
import type { SubscriptionHandler, SubscriptionMessage, RealtimeState } from './realtime.js'

// Singleton instance
const headless = new HeadlessClient()

// =============================================================================
// headlessly() — Browser-specific initialization
// =============================================================================

export interface HeadlesslyBrowserOptions extends HeadlessConfig {
  /** Tenant context (e.g. 'acme') — sets $context for all events */
  tenant?: string
}

/**
 * headlessly() — Initialize the browser SDK
 *
 * Auto-detects endpoint from `window.location` when running on `*.headless.ly`.
 * Configures event capture, forwarding, and optional real-time subscriptions.
 *
 * @example
 * ```typescript
 * import { headlessly } from '@headlessly/js'
 *
 * // On *.headless.ly — auto-detects endpoint
 * headlessly({ apiKey: 'hl_xxx' })
 *
 * // Custom endpoint
 * headlessly({ apiKey: 'hl_xxx', endpoint: 'https://custom.example.com/e' })
 *
 * // With forwarding and auto-capture
 * headlessly({
 *   apiKey: 'hl_xxx',
 *   forwarders: [{ type: 'google-analytics', measurementId: 'G-XXXXX' }],
 *   autoCapture: { pageViews: true, clicks: true },
 * })
 * ```
 */
export function headlessly(options?: HeadlesslyBrowserOptions): HeadlessClient {
  const config: HeadlessConfig = { ...options } as HeadlessConfig

  // Auto-detect endpoint on *.headless.ly
  if (!config.endpoint) {
    const detected = detectBrowserEndpoint()
    if (detected) config.endpoint = detected
  }

  headless.init(config)
  return headless
}

/**
 * Auto-detect the event endpoint from the browser environment.
 *
 * When running on `*.headless.ly`, returns `https://headless.ly/e`.
 * Otherwise returns undefined (uses default).
 */
function detectBrowserEndpoint(): string | undefined {
  try {
    if (typeof window === 'undefined' || typeof window.location === 'undefined') {
      return undefined
    }

    const { hostname, protocol } = window.location

    if (hostname === 'headless.ly' || hostname.endsWith('.headless.ly')) {
      return `${protocol}//headless.ly/e`
    }
  } catch {}
  return undefined
}

// =============================================================================
// Re-export types
// =============================================================================

export type {
  HeadlessConfig,
  AnalyticsEvent,
  ErrorEvent,
  WebVitals,
  Breadcrumb,
  User,
  FlagValue,
  FeatureFlag,
  Severity,
  EventType,
  StackFrame,
  Survey,
  SurveyQuestion,
  SurveyResponse,
  ForwarderConfig,
} from './types.js'

export type { EventForwarder } from './forwarding.js'
export type { SubscriptionHandler, SubscriptionMessage, RealtimeState, RealtimeConfig } from './realtime.js'
export type { AutoCaptureConfig } from './autocapture.js'

// =============================================================================
// Re-export classes
// =============================================================================

export { HeadlessClient } from './client.js'
export { ForwardingManager, GoogleAnalyticsForwarder, SegmentForwarder, PostHogForwarder } from './forwarding.js'
export { RealtimeManager } from './realtime.js'
export { AutoCaptureManager } from './autocapture.js'

// =============================================================================
// Factory function
// =============================================================================

/** Create an independent HeadlessClient instance (not the singleton) */
export const createClient = (config: HeadlessConfig): HeadlessClient => {
  const client = new HeadlessClient()
  client.init(config)
  return client
}

// =============================================================================
// Singleton API — Analytics
// =============================================================================

export const init = (config: HeadlessConfig) => headless.init(config)
export const page = (name?: string, properties?: Record<string, unknown>) => headless.page(name, properties)
export const track = (event: string, properties?: Record<string, unknown>) => headless.track(event, properties)
export const identify = (userId: string, traits?: Record<string, unknown>) => headless.identify(userId, traits)
export const alias = (userId: string, previousId?: string) => headless.alias(userId, previousId)
export const group = (groupId: string, traits?: Record<string, unknown>) => headless.group(groupId, traits)

// =============================================================================
// Singleton API — Errors
// =============================================================================

export const captureException = (error: unknown, context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }) =>
  headless.captureException(error, context)
export const captureMessage = (message: string, level?: Severity) => headless.captureMessage(message, level)

// =============================================================================
// Singleton API — Context
// =============================================================================

export const setUser = (user: User | null) => headless.setUser(user)
export const setTag = (key: string, value: string) => headless.setTag(key, value)
export const setTags = (tags: Record<string, string>) => headless.setTags(tags)
export const setExtra = (key: string, value: unknown) => headless.setExtra(key, value)
export const addBreadcrumb = (crumb: Breadcrumb) => headless.addBreadcrumb(crumb)

// =============================================================================
// Singleton API — Feature Flags
// =============================================================================

export const getFeatureFlag = (key: string) => headless.getFeatureFlag(key)
export const isFeatureEnabled = (key: string) => headless.isFeatureEnabled(key)
export const getAllFlags = () => headless.getAllFlags()
export const reloadFeatureFlags = () => headless.reloadFeatureFlags()
export const onFlagChange = (key: string, callback: (value: FlagValue) => void) => headless.onFlagChange(key, callback)

// =============================================================================
// Singleton API — Web Vitals
// =============================================================================

export const captureWebVitals = (metrics: Partial<WebVitals>) => headless.captureWebVitals(metrics)

// =============================================================================
// Singleton API — Privacy & Lifecycle
// =============================================================================

export const optOut = () => headless.optOut()
export const optIn = () => headless.optIn()
export const hasOptedOut = () => headless.hasOptedOut()
export const reset = () => headless.reset()
export const getDistinctId = () => headless.getDistinctId()
export const getSessionId = () => headless.getSessionId()

export const flush = () => headless.flush()
export const shutdown = () => headless.shutdown()

export const getInstance = () => headless

// =============================================================================
// Singleton API — Event Forwarding
// =============================================================================

export const addForwarder = (forwarder: EventForwarder) => headless.addForwarder(forwarder)
export const removeForwarder = (name: string) => headless.removeForwarder(name)
export const getForwarders = () => headless.getForwarders()

// =============================================================================
// Singleton API — Real-time Subscriptions
// =============================================================================

export const subscribe = (entityType: string, handler: SubscriptionHandler) => headless.subscribe(entityType, handler)
export const connectRealtime = () => headless.connectRealtime()
export const disconnectRealtime = () => headless.disconnectRealtime()

// =============================================================================
// Default export — full singleton API
// =============================================================================

export default {
  // Initialization
  init,
  headlessly,
  createClient,
  getInstance,

  // Analytics
  page,
  track,
  identify,
  alias,
  group,

  // Errors
  captureException,
  captureMessage,

  // Context
  setUser,
  setTag,
  setTags,
  setExtra,
  addBreadcrumb,

  // Feature Flags
  getFeatureFlag,
  isFeatureEnabled,
  getAllFlags,
  reloadFeatureFlags,
  onFlagChange,

  // Web Vitals
  captureWebVitals,

  // Privacy & Lifecycle
  optOut,
  optIn,
  hasOptedOut,
  reset,
  getDistinctId,
  getSessionId,
  flush,
  shutdown,

  // Event Forwarding
  addForwarder,
  removeForwarder,
  getForwarders,

  // Real-time Subscriptions
  subscribe,
  connectRealtime,
  disconnectRealtime,
}
