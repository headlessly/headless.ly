/**
 * CDCStream — Change Data Capture for external consumers
 *
 * Provides cursor-based polling and SSE streaming for consuming
 * the event log from external systems.
 */

import type { NounEvent, CDCOptions } from './types.js'
import type { EventLog } from './event-log.js'

export class CDCStream {
  constructor(private eventLog: EventLog) {}

  /**
   * Get a batch of events since a cursor (for external consumers).
   * Returns events + a new cursor for the next batch.
   */
  async poll(options: CDCOptions): Promise<{
    events: NounEvent[]
    cursor: string
    hasMore: boolean
  }> {
    return this.eventLog.cdc(options)
  }

  /**
   * Create a Server-Sent Events (SSE) stream.
   * Returns a ReadableStream suitable for HTTP response body.
   *
   * The stream:
   * 1. Emits buffered events since cursor
   * 2. Keeps connection alive with heartbeat comments
   * 3. Emits new events as they arrive via subscription
   */
  createSSEStream(options: CDCOptions): ReadableStream<Uint8Array> {
    const eventLog = this.eventLog
    const encoder = new TextEncoder()
    let unsubscribe: (() => void) | null = null
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        // 1. Emit buffered events since cursor
        const { events, cursor } = await eventLog.cdc(options)
        for (const event of events) {
          const sseData = formatSSE(event)
          controller.enqueue(encoder.encode(sseData))
        }

        // 2. Subscribe for new events
        const typeFilter = options.types
        const verbFilter = options.verbs

        unsubscribe = eventLog.subscribe('*', (event) => {
          // Apply type and verb filters
          if (typeFilter?.length && !typeFilter.includes(event.entityType)) return
          if (verbFilter?.length && !verbFilter.includes(event.verb)) return

          try {
            const sseData = formatSSE(event)
            controller.enqueue(encoder.encode(sseData))
          } catch {
            // Stream may have been closed
          }
        })

        // 3. Heartbeat every 30 seconds to keep connection alive
        heartbeatTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': heartbeat\n\n'))
          } catch {
            // Stream may have been closed
            if (heartbeatTimer) clearInterval(heartbeatTimer)
          }
        }, 30_000)
      },

      cancel() {
        if (unsubscribe) unsubscribe()
        if (heartbeatTimer) clearInterval(heartbeatTimer)
      },
    })
  }
}

/**
 * Format an event as an SSE message.
 *
 * SSE format:
 * ```
 * id: evt_abc123
 * event: Contact.qualified
 * data: {"$id":"evt_abc123",...}
 *
 * ```
 */
function formatSSE(event: NounEvent): string {
  const lines: string[] = []
  lines.push(`id: ${event.$id}`)
  lines.push(`event: ${event.$type}`)
  lines.push(`data: ${JSON.stringify(event)}`)
  lines.push('')
  lines.push('')
  return lines.join('\n')
}
