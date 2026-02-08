/**
 * useRealtime — Hook for WebSocket subscription to live entity updates.
 *
 * Subscribes to entity change events and provides a stream of updates.
 * Automatically reconnects on disconnect.
 *
 * @example
 * ```tsx
 * const { connected, lastEvent } = useRealtime({
 *   types: ['Contact', 'Deal'],
 *   onEvent: (event) => console.log('Entity changed:', event),
 * })
 * ```
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useHeadlessUI } from '../provider.js'
import type { EntityEvent } from '../types.js'

export interface UseRealtimeOptions {
  /** Entity types to subscribe to. If omitted, subscribes to all. */
  types?: string[]
  /** Entity IDs to subscribe to. If omitted, subscribes to all of the given types. */
  entityIds?: string[]
  /** Callback fired on each event */
  onEvent?: (event: EntityEvent) => void
  /** Whether to skip connecting */
  skip?: boolean
  /** Reconnect delay in ms (default: 3000) */
  reconnectDelay?: number
}

export interface UseRealtimeResult {
  connected: boolean
  lastEvent: EntityEvent | null
  error: Error | null
}

export function useRealtime(options: UseRealtimeOptions = {}): UseRealtimeResult {
  const { config } = useHeadlessUI()
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<EntityEvent | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const reconnectDelay = options.reconnectDelay ?? 3000

  const connect = useCallback(() => {
    if (options.skip || !config.wsUrl) return

    try {
      const ws = new WebSocket(config.wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) return
        setConnected(true)
        setError(null)

        // Send subscription message
        const sub: Record<string, unknown> = { type: 'subscribe' }
        if (options.types) sub.entityTypes = options.types
        if (options.entityIds) sub.entityIds = options.entityIds
        ws.send(JSON.stringify(sub))
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return
        try {
          const parsed = JSON.parse(event.data as string) as EntityEvent
          setLastEvent(parsed)
          options.onEvent?.(parsed)
        } catch {
          // Ignore non-JSON messages
        }
      }

      ws.onerror = () => {
        if (!mountedRef.current) return
        setError(new Error('WebSocket connection error'))
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setConnected(false)
        wsRef.current = null

        // Auto-reconnect
        if (!options.skip) {
          reconnectTimerRef.current = setTimeout(connect, reconnectDelay)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [config.wsUrl, options.skip, options.types, options.entityIds, options.onEvent, reconnectDelay])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
    }
  }, [connect])

  return { connected, lastEvent, error }
}
