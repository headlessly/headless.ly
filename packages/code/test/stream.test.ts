import { describe, it, expect } from 'vitest'
import { parseExecStream } from '../src/stream'

function createSSEResponse(lines: string[]): Response {
  const body = lines.join('\n')
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('@headlessly/code — parseExecStream', () => {
  it('is a function', () => {
    expect(typeof parseExecStream).toBe('function')
  })

  it('parses SSE events from response body', async () => {
    const response = createSSEResponse(['event: stdout', 'data: {"text":"hello world"}', '', 'event: exit', 'data: {"code":0}', ''])

    const events: any[] = []
    for await (const event of parseExecStream(response)) {
      events.push(event)
    }

    expect(events.length).toBeGreaterThanOrEqual(1)
  })

  it('handles empty response', async () => {
    const response = new Response('', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })

    const events: any[] = []
    for await (const event of parseExecStream(response)) {
      events.push(event)
    }

    expect(events.length).toBe(0)
  })
})
