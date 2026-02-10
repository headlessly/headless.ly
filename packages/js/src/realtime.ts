/**
 * @headlessly/js - Real-time Subscriptions
 *
 * WebSocket-based live entity update subscriptions
 * with auto-reconnect and exponential backoff.
 */

// =============================================================================
// Types
// =============================================================================

export interface SubscriptionMessage {
  type: string
  entity: string
  id: string
  data: Record<string, unknown>
  ts: string
}

export type SubscriptionHandler = (message: SubscriptionMessage) => void

export interface RealtimeConfig {
  /** WebSocket endpoint (default: wss://db.headless.ly/ws) */
  endpoint?: string
  /** API key for authentication */
  apiKey?: string
  /** Maximum reconnect attempts (default: 10) */
  maxReconnectAttempts?: number
  /** Initial reconnect delay in ms (default: 1000) */
  reconnectDelay?: number
  /** Maximum reconnect delay in ms (default: 30000) */
  maxReconnectDelay?: number
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number
}

export type RealtimeState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

// =============================================================================
// Realtime Manager
// =============================================================================

export class RealtimeManager {
  private config: RealtimeConfig
  private ws: WebSocket | null = null
  private subscriptions = new Map<string, Set<SubscriptionHandler>>()
  private wildcardSubscriptions = new Set<SubscriptionHandler>()
  private reconnectAttempts = 0
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private heartbeatTimer?: ReturnType<typeof setInterval>
  private _state: RealtimeState = 'disconnected'
  private stateListeners = new Set<(state: RealtimeState) => void>()
  private pendingSubscriptions: string[] = []

  constructor(config: RealtimeConfig = {}) {
    this.config = {
      maxReconnectAttempts: 10,
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      heartbeatInterval: 30000,
      ...config,
    }
  }

  // ===========================================================================
  // State
  // ===========================================================================

  get state(): RealtimeState {
    return this._state
  }

  private setState(state: RealtimeState): void {
    this._state = state
    for (const listener of this.stateListeners) {
      try {
        listener(state)
      } catch {}
    }
  }

  onStateChange(listener: (state: RealtimeState) => void): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  // ===========================================================================
  // Connection
  // ===========================================================================

  connect(): void {
    if (typeof WebSocket === 'undefined') return
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return

    const endpoint = this.config.endpoint ?? 'wss://db.headless.ly/ws'
    const url = this.config.apiKey ? `${endpoint}?token=${encodeURIComponent(this.config.apiKey)}` : endpoint

    this.setState('connecting')

    try {
      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        this.setState('connected')
        this.reconnectAttempts = 0
        this.startHeartbeat()

        // Re-subscribe to all active subscriptions
        for (const entityType of this.subscriptions.keys()) {
          this.sendSubscribe(entityType)
        }

        // Send pending subscriptions
        for (const entityType of this.pendingSubscriptions) {
          this.sendSubscribe(entityType)
        }
        this.pendingSubscriptions = []
      }

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data as string)
          if (data.type === 'pong') return
          this.handleMessage(data as SubscriptionMessage)
        } catch {}
      }

      this.ws.onclose = () => {
        this.stopHeartbeat()
        if (this._state !== 'disconnected') {
          this.scheduleReconnect()
        }
      }

      this.ws.onerror = () => {
        // Error will trigger onclose
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  disconnect(): void {
    this.setState('disconnected')
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.onopen = null
      this.ws.close()
      this.ws = null
    }
    this.reconnectAttempts = 0
  }

  // ===========================================================================
  // Subscriptions
  // ===========================================================================

  subscribe(entityType: string, handler: SubscriptionHandler): () => void {
    if (entityType === '*') {
      this.wildcardSubscriptions.add(handler)
      return () => this.wildcardSubscriptions.delete(handler)
    }

    if (!this.subscriptions.has(entityType)) {
      this.subscriptions.set(entityType, new Set())
    }
    this.subscriptions.get(entityType)!.add(handler)

    // Send subscribe message if connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribe(entityType)
    } else {
      this.pendingSubscriptions.push(entityType)
      // Auto-connect if not connected
      if (this._state === 'disconnected') {
        this.connect()
      }
    }

    return () => {
      const handlers = this.subscriptions.get(entityType)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          this.subscriptions.delete(entityType)
          this.sendUnsubscribe(entityType)
        }
      }
    }
  }

  private sendSubscribe(entityType: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'subscribe', entity: entityType }))
    }
  }

  private sendUnsubscribe(entityType: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'unsubscribe', entity: entityType }))
    }
  }

  private handleMessage(message: SubscriptionMessage): void {
    // Notify entity-specific handlers
    const handlers = this.subscriptions.get(message.entity)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message)
        } catch {}
      }
    }

    // Notify wildcard handlers
    for (const handler of this.wildcardSubscriptions) {
      try {
        handler(message)
      } catch {}
    }
  }

  // ===========================================================================
  // Reconnection
  // ===========================================================================

  private scheduleReconnect(): void {
    const maxAttempts = this.config.maxReconnectAttempts ?? 10
    if (this.reconnectAttempts >= maxAttempts) {
      this.setState('disconnected')
      return
    }

    this.setState('reconnecting')
    this.reconnectAttempts++

    const baseDelay = this.config.reconnectDelay ?? 1000
    const maxDelay = this.config.maxReconnectDelay ?? 30000
    const delay = Math.min(baseDelay * 2 ** (this.reconnectAttempts - 1), maxDelay)

    // Add jitter (up to 10%)
    const jitter = delay * 0.1 * Math.random()
    const finalDelay = delay + jitter

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      this.connect()
    }, finalDelay)
  }

  // ===========================================================================
  // Heartbeat
  // ===========================================================================

  private startHeartbeat(): void {
    this.stopHeartbeat()
    const interval = this.config.heartbeatInterval ?? 30000
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, interval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  shutdown(): void {
    this.disconnect()
    this.subscriptions.clear()
    this.wildcardSubscriptions.clear()
    this.stateListeners.clear()
    this.pendingSubscriptions = []
  }

  get subscribedEntities(): string[] {
    return [...this.subscriptions.keys()]
  }

  get isConnected(): boolean {
    return this._state === 'connected'
  }
}
