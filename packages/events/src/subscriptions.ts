/**
 * SubscriptionManager — manages event subscriptions across three modes
 *
 * Three subscription modes with different latency characteristics:
 * - code: In-process handler execution (~0ms)
 * - websocket: Push to WebSocket connection (~10ms)
 * - webhook: POST to HTTP endpoint with HMAC signing (~100ms)
 */

import type { Subscription, SubscriptionMode, EventHandler, NounEvent } from './types.js'
import { matchesPattern, EventLog } from './event-log.js'

// =============================================================================
// ID Generation
// =============================================================================

const SQID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateSqid(length = 12): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += SQID_CHARS[Math.floor(Math.random() * SQID_CHARS.length)]
  }
  return result
}

function generateSubscriptionId(): string {
  return `sub_${generateSqid()}`
}

// =============================================================================
// HMAC Signing (for webhook mode)
// =============================================================================

/**
 * Create an HMAC-SHA256 signature for a webhook payload.
 * Uses the Web Crypto API (available in both Node.js 18+ and Cloudflare Workers).
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// =============================================================================
// SubscriptionManager
// =============================================================================

export class SubscriptionManager {
  private subscriptions = new Map<string, Subscription>()
  private codeHandlers = new Map<string, EventHandler>()
  private attachedLog: EventLog | null = null
  private detachFn: (() => void) | null = null

  /**
   * Register a code-as-data subscription (~0ms latency).
   * Handler is executed in-process.
   */
  registerCode(pattern: string, handler: EventHandler): string {
    const id = generateSubscriptionId()
    const subscription: Subscription = {
      id,
      pattern,
      mode: 'code',
      handler,
      active: true,
      createdAt: new Date().toISOString(),
    }
    this.subscriptions.set(id, subscription)
    this.codeHandlers.set(id, handler)
    return id
  }

  /**
   * Register a WebSocket subscription (~10ms latency).
   * Events are pushed to the WebSocket connection.
   */
  registerWebSocket(pattern: string, endpoint: string): string {
    const id = generateSubscriptionId()
    const subscription: Subscription = {
      id,
      pattern,
      mode: 'websocket',
      endpoint,
      active: true,
      createdAt: new Date().toISOString(),
    }
    this.subscriptions.set(id, subscription)
    return id
  }

  /**
   * Register a webhook subscription (~100ms latency).
   * Events are POSTed to the endpoint with optional HMAC signature.
   */
  registerWebhook(pattern: string, endpoint: string, secret?: string): string {
    const id = generateSubscriptionId()
    const subscription: Subscription = {
      id,
      pattern,
      mode: 'webhook',
      endpoint,
      secret,
      active: true,
      createdAt: new Date().toISOString(),
    }
    this.subscriptions.set(id, subscription)
    return id
  }

  /** Remove a subscription */
  unsubscribe(id: string): boolean {
    const existed = this.subscriptions.delete(id)
    this.codeHandlers.delete(id)
    return existed
  }

  /** Deactivate a subscription without removing it */
  deactivate(id: string): boolean {
    const sub = this.subscriptions.get(id)
    if (!sub) return false
    sub.active = false
    return true
  }

  /** Activate a previously deactivated subscription */
  activate(id: string): boolean {
    const sub = this.subscriptions.get(id)
    if (!sub) return false
    sub.active = true
    return true
  }

  /** Total number of subscriptions */
  get count(): number {
    return this.subscriptions.size
  }

  /** Remove all subscriptions */
  clear(): void {
    this.subscriptions.clear()
    this.codeHandlers.clear()
  }

  /** List all subscriptions */
  list(options?: { pattern?: string; mode?: SubscriptionMode; active?: boolean }): Subscription[] {
    let results = Array.from(this.subscriptions.values())

    if (options?.pattern) {
      results = results.filter((s) => s.pattern === options.pattern)
    }
    if (options?.mode) {
      results = results.filter((s) => s.mode === options.mode)
    }
    if (options?.active !== undefined) {
      results = results.filter((s) => s.active === options.active)
    }

    return results
  }

  /** Get a subscription by ID */
  get(id: string): Subscription | undefined {
    return this.subscriptions.get(id)
  }

  /** Attach to an EventLog for auto-dispatching on append */
  attach(eventLog: EventLog): void {
    this.detach()
    this.attachedLog = eventLog
    const unsub = eventLog.subscribe('*', (event) => {
      this.dispatch(event)
    })
    this.detachFn = unsub
  }

  /** Detach from the attached EventLog */
  detach(): void {
    if (this.detachFn) {
      this.detachFn()
      this.detachFn = null
    }
    this.attachedLog = null
  }

  /** Dispatch an event to all matching subscriptions */
  async dispatch(event: NounEvent): Promise<{ delivered: number; failed: number }> {
    let delivered = 0
    let failed = 0
    const promises: Promise<void>[] = []

    for (const [id, subscription] of this.subscriptions) {
      if (!subscription.active) continue
      if (!matchesPattern(subscription.pattern, event.$type)) continue

      switch (subscription.mode) {
        case 'code': {
          const handler = this.codeHandlers.get(id)
          if (handler) {
            promises.push(
              Promise.resolve()
                .then(() => handler(event))
                .then(() => { delivered++ })
                .catch(() => {
                  failed++
                }),
            )
          }
          break
        }

        case 'websocket': {
          promises.push(
            this.dispatchWebSocket(subscription, event)
              .then(() => { delivered++ })
              .catch(() => { failed++ }),
          )
          break
        }

        case 'webhook': {
          promises.push(
            this.dispatchWebhook(subscription, event)
              .then(() => { delivered++ })
              .catch(() => { failed++ }),
          )
          break
        }
      }
    }

    await Promise.all(promises)
    return { delivered, failed }
  }

  /** Dispatch to WebSocket (placeholder for runtime integration) */
  private async dispatchWebSocket(_subscription: Subscription, _event: NounEvent): Promise<void> {
    // In Cloudflare Workers / Durable Objects, this would send via DO WebSocket.
    // In Node.js, this would use a ws connection pool.
    // For now, this is a no-op. Runtime adapters implement the actual transport.
  }

  /** Dispatch to webhook endpoint with HMAC signing */
  private async dispatchWebhook(subscription: Subscription, event: NounEvent): Promise<void> {
    if (!subscription.endpoint) return

    try {
      const payload = JSON.stringify(event)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Headlessly-Event': event.$type,
        'X-Headlessly-Delivery': event.$id,
      }

      if (subscription.secret) {
        const signature = await signPayload(payload, subscription.secret)
        headers['X-Headlessly-Signature'] = `sha256=${signature}`
      }

      await fetch(subscription.endpoint, {
        method: 'POST',
        headers,
        body: payload,
      })
    } catch {
      // Swallow fetch errors — don't break dispatch
      // In production, this would go to a DLQ via the EventsStore
    }
  }
}
