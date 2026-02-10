/**
 * @headlessly/js - Type definitions
 */

// =============================================================================
// Configuration
// =============================================================================

export interface HeadlessConfig {
  /** headless.ly API key */
  apiKey: string
  /** Enable debug logging (default: false) */
  debug?: boolean
  /** Custom endpoint (default: https://headless.ly/e) */
  endpoint?: string
  /** Sample rate for all events (0-1, default: 1) */
  sampleRate?: number
  /** Batch size before flush (default: 10) */
  batchSize?: number
  /** Flush interval in ms (default: 5000) */
  flushInterval?: number
  /** Release version for error tracking */
  release?: string
  /** Environment (production, staging, etc.) */
  environment?: string
  /** Default tags for all events */
  tags?: Record<string, string>
  /** Persistence mode for identity */
  persistence?: 'localStorage' | 'sessionStorage' | 'memory'
  /** Enable automatic error capture (default: true) */
  captureErrors?: boolean
  /** Enable web vitals capture (default: true) */
  captureWebVitals?: boolean
  /** Error callback */
  onError?: (error: Error) => void
  /** Respect navigator.doNotTrack (default: false) */
  respectDoNotTrack?: boolean
  /** TTL for cached feature flags in ms */
  flagsTTL?: number

  // ===========================================================================
  // Auto-capture (opt-in)
  // ===========================================================================

  /** Auto-capture configuration (all disabled by default) */
  autoCapture?: {
    /** Auto-capture page views on route change (default: false) */
    pageViews?: boolean
    /** Auto-capture click events (default: false) */
    clicks?: boolean
    /** Auto-capture form submissions (default: false) */
    formSubmissions?: boolean
    /** CSS selector to filter click capture */
    clickSelector?: string
    /** Element attributes to capture */
    captureAttributes?: string[]
  }

  // ===========================================================================
  // Event Forwarding
  // ===========================================================================

  /** Event forwarding to external services */
  forwarders?: ForwarderConfig[]

  // ===========================================================================
  // Real-time Subscriptions
  // ===========================================================================

  /** WebSocket endpoint for real-time subscriptions */
  wsEndpoint?: string
}

// =============================================================================
// Forwarder Config
// =============================================================================

export type ForwarderConfig =
  | { type: 'google-analytics'; measurementId: string }
  | { type: 'segment'; writeKey: string }
  | { type: 'posthog'; apiKey: string; host?: string }

// =============================================================================
// Analytics Types
// =============================================================================

export type EventType = 'page' | 'track' | 'identify' | 'alias' | 'group' | '$pageview' | '$pageleave' | '$feature_flag_called' | '$web_vitals' | '$error'

export interface AnalyticsEvent {
  type: EventType
  event?: string
  userId?: string
  anonymousId: string
  sessionId: string
  ts: string
  properties?: Record<string, unknown>
  traits?: Record<string, unknown>
  groupId?: string
  groupTraits?: Record<string, unknown>
  url?: string
  path?: string
  referrer?: string
  title?: string
  userAgent?: string
}

export interface WebVitals {
  lcp?: number
  fid?: number
  cls?: number
  ttfb?: number
  fcp?: number
  inp?: number
}

// =============================================================================
// Error Types
// =============================================================================

export type Severity = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

export interface ErrorEvent {
  type: 'exception' | 'message'
  eventId: string
  ts: string
  level: Severity
  message?: string
  exception?: {
    type: string
    value: string
    stacktrace?: StackFrame[]
  }
  user?: User
  tags?: Record<string, string>
  extra?: Record<string, unknown>
  breadcrumbs?: Breadcrumb[]
  release?: string
  environment?: string
}

export interface StackFrame {
  filename?: string
  function?: string
  lineno?: number
  colno?: number
}

export interface Breadcrumb {
  type?: string
  category?: string
  message?: string
  data?: Record<string, unknown>
  level?: Severity
  ts?: string
}

export interface User {
  id?: string
  email?: string
  username?: string
  [key: string]: unknown
}

// =============================================================================
// Feature Flags
// =============================================================================

export type FlagValue = boolean | string | number | Record<string, unknown>

export interface FeatureFlag {
  key: string
  value: FlagValue
  variant?: string
}

// =============================================================================
// Surveys
// =============================================================================

export interface Survey {
  id: string
  name: string
  type: 'nps' | 'csat' | 'ces' | 'custom'
  questions: SurveyQuestion[]
}

export interface SurveyQuestion {
  id: string
  type: 'open' | 'multiple_choice' | 'rating' | 'nps'
  question: string
  choices?: string[]
  required?: boolean
}

export interface SurveyResponse {
  surveyId: string
  answers: Record<string, unknown>
  score?: number
  feedback?: string
}
