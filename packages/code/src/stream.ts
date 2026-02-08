/**
 * SSE stream parser for exec streaming responses
 *
 * Parses `text/event-stream` responses into typed ExecEvent objects.
 */

import type { ExecEvent } from './types.js'

/**
 * Parse an SSE response from /exec/stream into an async generator of ExecEvents.
 *
 * @example
 * ```typescript
 * const response = await fetch('https://code.headless.ly/exec/stream', { ... })
 * for await (const event of parseExecStream(response)) {
 *   if (event.type === 'stdout') console.log(event.data)
 * }
 * ```
 */
export async function* parseExecStream(response: Response): AsyncGenerator<ExecEvent> {
  if (!response.body) {
    throw new Error('Response body is null')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventType = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6)
          try {
            const parsed = JSON.parse(data) as ExecEvent
            // If the SSE event type is set and differs, use it
            if (eventType && parsed.type !== eventType) {
              ;(parsed as Record<string, unknown>).type = eventType
            }
            yield parsed
          } catch {
            // Non-JSON data line — wrap as stdout
            yield { type: 'stdout', data }
          }
          eventType = ''
        }
        // Skip empty lines and comments (lines starting with :)
      }
    }

    // Flush any remaining buffer
    if (buffer.trim()) {
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6)
        try {
          yield JSON.parse(data) as ExecEvent
        } catch {
          yield { type: 'stdout', data }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
