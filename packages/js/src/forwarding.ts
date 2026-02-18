/**
 * @headlessly/js - Event Forwarding
 *
 * Forward events to external analytics services:
 * - Google Analytics (GA4)
 * - Segment
 * - PostHog
 *
 * Events are always stored in the headless.ly event log first,
 * then optionally forwarded to configured services.
 */

import type { AnalyticsEvent, ErrorEvent } from './types.js'

// =============================================================================
// Helpers
// =============================================================================

/** Type guard: true for AnalyticsEvent (page/track/identify/alias/group) */
function isAnalyticsEvent(event: AnalyticsEvent | ErrorEvent): event is AnalyticsEvent {
  return event.type !== 'exception' && event.type !== 'message'
}

/** Type guard: true for ErrorEvent (exception/message) */
function isErrorEvent(event: AnalyticsEvent | ErrorEvent): event is ErrorEvent {
  return event.type === 'exception' || event.type === 'message'
}

// =============================================================================
// Forwarder Interface
// =============================================================================

export interface EventForwarder {
  name: string
  forward(event: AnalyticsEvent | ErrorEvent): void
  flush?(): void
  shutdown?(): void
}

// =============================================================================
// Google Analytics (GA4) Forwarder
// =============================================================================

export interface GoogleAnalyticsConfig {
  measurementId: string
}

export class GoogleAnalyticsForwarder implements EventForwarder {
  name = 'google-analytics'
  private measurementId: string

  constructor(config: GoogleAnalyticsConfig) {
    this.measurementId = config.measurementId
  }

  forward(event: AnalyticsEvent | ErrorEvent): void {
    if (typeof window === 'undefined') return

    const gtag = (window as unknown as Record<string, unknown>).gtag as ((...args: unknown[]) => void) | undefined

    if (!gtag) return

    if (isAnalyticsEvent(event) && event.type === 'page') {
      gtag('event', 'page_view', {
        page_title: event.title,
        page_location: event.url,
        page_path: event.path,
        send_to: this.measurementId,
      })
    } else if (isAnalyticsEvent(event) && event.type === 'track' && event.event) {
      gtag('event', event.event, {
        ...event.properties,
        send_to: this.measurementId,
      })
    } else if (isErrorEvent(event) && event.type === 'exception') {
      gtag('event', 'exception', {
        description: event.exception?.value,
        fatal: event.level === 'fatal',
        send_to: this.measurementId,
      })
    }
  }
}

// =============================================================================
// Segment Forwarder
// =============================================================================

export interface SegmentConfig {
  writeKey: string
}

interface SegmentAnalytics {
  track: (event: string, properties?: Record<string, unknown>) => void
  page: (name?: string, properties?: Record<string, unknown>) => void
  identify: (userId: string, traits?: Record<string, unknown>) => void
  alias: (userId: string, previousId?: string) => void
  group: (groupId: string, traits?: Record<string, unknown>) => void
  flush?: () => void
}

export class SegmentForwarder implements EventForwarder {
  name = 'segment'
  private writeKey: string

  constructor(config: SegmentConfig) {
    this.writeKey = config.writeKey
  }

  private getSegment(): SegmentAnalytics | undefined {
    if (typeof window === 'undefined') return undefined
    return (window as unknown as Record<string, unknown>).analytics as SegmentAnalytics | undefined
  }

  forward(event: AnalyticsEvent | ErrorEvent): void {
    const segment = this.getSegment()
    if (!segment) return

    if (isAnalyticsEvent(event)) {
      switch (event.type) {
        case 'page':
          segment.page(event.event, event.properties)
          break
        case 'track':
          if (event.event) {
            segment.track(event.event, event.properties)
          }
          break
        case 'identify':
          if (event.userId) {
            segment.identify(event.userId, event.traits)
          }
          break
        case 'alias':
          if (event.userId) {
            segment.alias(event.userId, (event.properties?.previousId as string) ?? undefined)
          }
          break
        case 'group':
          if (event.groupId) {
            segment.group(event.groupId, event.groupTraits)
          }
          break
      }
    } else if (isErrorEvent(event)) {
      segment.track('Exception', {
        type: event.exception?.type,
        value: event.exception?.value,
        level: event.level,
      })
    }
  }

  flush(): void {
    const segment = this.getSegment()
    if (segment?.flush) segment.flush()
  }
}

// =============================================================================
// PostHog Forwarder
// =============================================================================

export interface PostHogConfig {
  apiKey: string
  host?: string
}

interface PostHogClient {
  capture: (event: string, properties?: Record<string, unknown>) => void
  identify: (userId: string, traits?: Record<string, unknown>) => void
  alias: (alias: string, original?: string) => void
  group: (type: string, key: string, properties?: Record<string, unknown>) => void
  flush?: () => void
  shutdown?: () => void
}

export class PostHogForwarder implements EventForwarder {
  name = 'posthog'
  private apiKey: string

  constructor(config: PostHogConfig) {
    this.apiKey = config.apiKey
  }

  private getPostHog(): PostHogClient | undefined {
    if (typeof window === 'undefined') return undefined
    return (window as unknown as Record<string, unknown>).posthog as PostHogClient | undefined
  }

  forward(event: AnalyticsEvent | ErrorEvent): void {
    const posthog = this.getPostHog()
    if (!posthog) return

    if (isAnalyticsEvent(event)) {
      switch (event.type) {
        case 'page':
          posthog.capture('$pageview', {
            $current_url: event.url,
            $pathname: event.path,
            $title: event.title,
            $referrer: event.referrer,
            ...event.properties,
          })
          break
        case 'track':
          if (event.event) {
            posthog.capture(event.event, event.properties)
          }
          break
        case 'identify':
          if (event.userId) {
            posthog.identify(event.userId, event.traits)
          }
          break
        case 'alias':
          if (event.userId) {
            posthog.alias(event.userId, (event.properties?.previousId as string) ?? undefined)
          }
          break
        case 'group':
          if (event.groupId) {
            posthog.group('company', event.groupId, event.groupTraits)
          }
          break
      }
    } else if (isErrorEvent(event)) {
      posthog.capture('$exception', {
        $exception_type: event.exception?.type,
        $exception_message: event.exception?.value,
        $exception_level: event.level,
      })
    }
  }

  flush(): void {
    const posthog = this.getPostHog()
    if (posthog?.flush) posthog.flush()
  }

  shutdown(): void {
    const posthog = this.getPostHog()
    if (posthog?.shutdown) posthog.shutdown()
  }
}

// =============================================================================
// Forwarding Manager
// =============================================================================

export class ForwardingManager {
  private forwarders: EventForwarder[] = []

  add(forwarder: EventForwarder): void {
    this.forwarders.push(forwarder)
  }

  remove(name: string): void {
    this.forwarders = this.forwarders.filter((f) => f.name !== name)
  }

  getForwarders(): EventForwarder[] {
    return [...this.forwarders]
  }

  forward(event: AnalyticsEvent | ErrorEvent): void {
    for (const forwarder of this.forwarders) {
      try {
        forwarder.forward(event)
      } catch {
        // Silently swallow forwarding errors — never block primary event flow
      }
    }
  }

  flush(): void {
    for (const forwarder of this.forwarders) {
      try {
        forwarder.flush?.()
      } catch {}
    }
  }

  shutdown(): void {
    for (const forwarder of this.forwarders) {
      try {
        forwarder.shutdown?.()
      } catch {}
    }
  }

  clear(): void {
    this.forwarders = []
  }
}
