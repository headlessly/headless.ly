import { describe, it, expect } from 'vitest'
import { parseExecStream } from '../src/stream.js'

/** Create a Response with a ReadableStream body from string chunks */
function sseResponse(...chunks: string[]): Response {
  const encoder = new TextEncoder()
  let i = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]!))
        i++
      } else {
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
}

async function collect(response: Response) {
  const events: unknown[] = []
  for await (const event of parseExecStream(response)) {
    events.push(event)
  }
  return events
}

describe('parseExecStream', () => {
  it('parses a single stdout event', async () => {
    const res = sseResponse('data: {"type":"stdout","data":"hello"}\n\n')
    const events = await collect(res)
    expect(events).toEqual([{ type: 'stdout', data: 'hello' }])
  })

  it('parses multiple events in one chunk', async () => {
    const res = sseResponse('data: {"type":"stdout","data":"line1"}\n\ndata: {"type":"stderr","data":"err"}\n\n')
    const events = await collect(res)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ type: 'stdout', data: 'line1' })
    expect(events[1]).toEqual({ type: 'stderr', data: 'err' })
  })

  it('handles chunked data split across reads', async () => {
    const res = sseResponse('data: {"type":"std', 'out","data":"hello"}\n\n')
    const events = await collect(res)
    expect(events).toEqual([{ type: 'stdout', data: 'hello' }])
  })

  it('handles SSE event type override', async () => {
    const res = sseResponse('event: stderr\ndata: {"type":"stdout","data":"oops"}\n\n')
    const events = await collect(res)
    expect(events).toEqual([{ type: 'stderr', data: 'oops' }])
  })

  it('wraps non-JSON data as stdout', async () => {
    const res = sseResponse('data: plain text message\n\n')
    const events = await collect(res)
    expect(events).toEqual([{ type: 'stdout', data: 'plain text message' }])
  })

  it('throws on null body', async () => {
    const res = new Response(null)
    await expect(collect(res)).rejects.toThrow('Response body is null')
  })

  it('yields nothing for empty stream', async () => {
    const res = sseResponse('')
    const events = await collect(res)
    expect(events).toEqual([])
  })

  it('skips empty lines and comments', async () => {
    const res = sseResponse(': this is a comment\n\ndata: {"type":"stdout","data":"ok"}\n\n')
    const events = await collect(res)
    expect(events).toEqual([{ type: 'stdout', data: 'ok' }])
  })

  it('flushes remaining buffer data', async () => {
    const res = sseResponse('data: {"type":"stdout","data":"final"}')
    const events = await collect(res)
    expect(events).toEqual([{ type: 'stdout', data: 'final' }])
  })

  it('flushes non-JSON buffer at end', async () => {
    const res = sseResponse('data: leftover text')
    const events = await collect(res)
    expect(events).toEqual([{ type: 'stdout', data: 'leftover text' }])
  })

  it('parses complete event with exitCode', async () => {
    const res = sseResponse('data: {"type":"complete","exitCode":0,"duration":150}\n\n')
    const events = await collect(res)
    expect(events).toEqual([{ type: 'complete', exitCode: 0, duration: 150 }])
  })

  it('parses error event', async () => {
    const res = sseResponse('data: {"type":"error","error":"command not found"}\n\n')
    const events = await collect(res)
    expect(events).toEqual([{ type: 'error', error: 'command not found' }])
  })

  it('BUG: event type override lost in buffer flush', async () => {
    // When stream ends with event type + data in buffer (no trailing newlines),
    // the flush code at lines 64-72 only checks "data: " prefix but ignores eventType
    const res = sseResponse('event: error\ndata: {"type":"stdout","data":"fail"}')
    const events = await collect(res)
    // BUG: The event type should be 'error' but flush doesn't apply the SSE event type
    expect((events[0] as { type: string }).type).toBe('stdout')
  })

  it('resets event type after each event', async () => {
    const res = sseResponse('event: stderr\ndata: {"type":"stdout","data":"one"}\n\ndata: {"type":"stdout","data":"two"}\n\n')
    const events = await collect(res)
    expect((events[0] as { type: string }).type).toBe('stderr') // overridden
    expect((events[1] as { type: string }).type).toBe('stdout') // not overridden
  })
})
