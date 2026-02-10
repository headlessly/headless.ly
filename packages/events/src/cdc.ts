/**
 * CDCStream — Change Data Capture for external consumers
 *
 * Provides cursor-based polling and SSE streaming for consuming
 * the event log from external systems.
 */

import type { NounEvent, CDCOptions } from './types.js'
import type { EventLog } from './event-log.js'

/** Named consumer with auto-tracking cursor */
export interface CDCConsumer {
  poll(options?: Omit<CDCOptions, 'after'>): Promise<{ events: NounEvent[]; cursor: string; hasMore: boolean }>
  checkpoint(): Promise<void>
}

export class CDCStream {
  private cursors = new Map<string, string>()
  private acknowledged = new Map<string, Set<string>>()

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

  /** Persist a consumer cursor position */
  async checkpoint(consumerId: string, cursor: string): Promise<void> {
    this.cursors.set(consumerId, cursor)
  }

  /** Retrieve a consumer's saved cursor */
  async getCursor(consumerId: string): Promise<string | undefined> {
    return this.cursors.get(consumerId)
  }

  /** Mark specific events as processed by a consumer */
  async acknowledge(consumerId: string, eventIds: string[]): Promise<void> {
    if (!this.acknowledged.has(consumerId)) {
      this.acknowledged.set(consumerId, new Set())
    }
    const acked = this.acknowledged.get(consumerId)!
    for (const id of eventIds) {
      acked.add(id)
    }
  }

  /** Get pending (unacknowledged) events for a consumer */
  async pending(consumerId: string): Promise<{ events: NounEvent[] }> {
    const acked = this.acknowledged.get(consumerId) ?? new Set<string>()
    const all = await this.eventLog.cdc({})
    const events = all.events.filter((e) => !acked.has(e.$id))
    return { events }
  }

  /** Create a named consumer with auto-tracking cursor */
  createConsumer(name: string): CDCConsumer {
    let lastCursor: string | undefined = this.cursors.get(name)

    return {
      poll: async (options?: Omit<CDCOptions, 'after'>) => {
        const result = await this.eventLog.cdc({ ...options, after: lastCursor })
        if (result.events.length > 0) {
          lastCursor = result.cursor
        }
        return result
      },
      checkpoint: async () => {
        if (lastCursor) {
          this.cursors.set(name, lastCursor)
        }
      },
    }
  }

  /** Get the number of unconsumed events for a consumer */
  async lag(consumerId: string): Promise<number> {
    let cursor = this.cursors.get(consumerId)
    let total = 0
    let hasMore = true
    while (hasMore) {
      const result = await this.eventLog.cdc({ after: cursor, batchSize: 1000 })
      total += result.events.length
      hasMore = result.hasMore
      if (result.events.length > 0) {
        cursor = result.cursor
      }
    }
    return total
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
