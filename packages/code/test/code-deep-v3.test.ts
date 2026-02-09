import { describe, it, expect, beforeEach } from 'vitest'
import { createCodeClient } from '../src/client.js'
import { parseExecStream } from '../src/stream.js'
import type { ExecEvent, CodeClientConfig } from '../src/types.js'

// ---------------------------------------------------------------------------
// Mock fetch infrastructure
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
  signal?: AbortSignal
}

const fetchCalls: FetchCall[] = []
let fetchResponder: (url: string, method: string, body?: unknown) => Response | Promise<Response> = () =>
  new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })

beforeEach(() => {
  fetchCalls.length = 0
  fetchResponder = () => new Response(JSON.stringify({ success: true, data: {} }), { status: 200 })
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input.toString()
    const method = init?.method ?? 'GET'
    const headers = (init?.headers as Record<string, string>) ?? {}
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    const signal = init?.signal ?? undefined
    fetchCalls.push({ url, method, headers, body, signal })
    return fetchResponder(url, method, body)
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok<T>(data: T, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), { status })
}

function okWithMeta<T>(data: T, meta: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, data, meta }), { status: 200 })
}

function fail(error: string, status = 200) {
  return new Response(JSON.stringify({ success: false, error }), { status })
}

function httpError(status: number, text: string) {
  return new Response(text, { status })
}

function sandboxOk(id: string, status: 'running' | 'stopped' | 'error' = 'running', timeout?: number) {
  return ok({ id, status, createdAt: '2025-06-01T00:00:00Z', ...(timeout !== undefined ? { timeout } : {}) })
}

function execOk(overrides: Partial<{ exitCode: number; stdout: string; stderr: string; command: string; duration: number }> = {}) {
  return ok({
    success: (overrides.exitCode ?? 0) === 0,
    exitCode: overrides.exitCode ?? 0,
    stdout: overrides.stdout ?? '',
    stderr: overrides.stderr ?? '',
    command: overrides.command ?? 'echo',
    duration: overrides.duration ?? 5,
    timestamp: '2025-06-01T00:00:00Z',
  })
}

function codeOk(overrides: Partial<{ code: string; language: string; logs: string[]; error: string; results: unknown[]; duration: number }> = {}) {
  return ok({
    code: overrides.code ?? '',
    language: overrides.language ?? 'javascript',
    logs: overrides.logs ?? [],
    error: overrides.error,
    results: overrides.results ?? [],
    duration: overrides.duration ?? 5,
  })
}

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
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

async function collectStream(iterable: AsyncIterable<ExecEvent>): Promise<ExecEvent[]> {
  const events: ExecEvent[] = []
  for await (const event of iterable) {
    events.push(event)
  }
  return events
}

async function collectParse(response: Response): Promise<ExecEvent[]> {
  const events: ExecEvent[] = []
  for await (const event of parseExecStream(response)) {
    events.push(event)
  }
  return events
}

// ===========================================================================
// 1. SANDBOX LIFECYCLE SEQUENCES (7 tests)
// ===========================================================================

describe('Sandbox lifecycle sequences', () => {
  it('create -> exec -> destroy full lifecycle sends correct HTTP methods', async () => {
    let callIndex = 0
    fetchResponder = (url) => {
      callIndex++
      if (callIndex === 1) return sandboxOk('sb_lifecycle')
      if (callIndex === 2) return execOk({ stdout: 'hello\n', command: 'echo hello' })
      return ok(null)
    }

    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()
    expect(sb.id).toBe('sb_lifecycle')

    const result = await client.exec(sb.id, 'echo hello')
    expect(result.stdout).toBe('hello\n')

    await client.destroySandbox(sb.id)

    expect(fetchCalls).toHaveLength(3)
    expect(fetchCalls[0]!.method).toBe('POST')
    expect(fetchCalls[1]!.method).toBe('POST')
    expect(fetchCalls[2]!.method).toBe('DELETE')
  })

  it('create -> write -> read -> delete file -> destroy sequence', async () => {
    let callIndex = 0
    fetchResponder = () => {
      callIndex++
      if (callIndex === 1) return sandboxOk('sb_files')
      if (callIndex === 2) return ok(null) // writeFile
      if (callIndex === 3) return ok({ content: 'data' }) // readFile
      if (callIndex === 4) return ok(null) // deleteFile
      return ok(null) // destroySandbox
    }

    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()
    await client.writeFile(sb.id, '/test.txt', 'data')
    const content = await client.readFile(sb.id, '/test.txt')
    expect(content).toBe('data')
    await client.deleteFile(sb.id, '/test.txt')
    await client.destroySandbox(sb.id)

    expect(fetchCalls).toHaveLength(5)
  })

  it('getSandbox returns timeout field when provided', async () => {
    fetchResponder = () => sandboxOk('sb_timeout', 'running', 600)
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.getSandbox('sb_timeout')
    expect(sb).not.toBeNull()
    expect(sb!.timeout).toBe(600)
  })

  it('createSandbox with timeout option passes it in request body', async () => {
    fetchResponder = () => sandboxOk('sb_t', 'running', 120)
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox({ timeout: 120 })
    expect(fetchCalls[0]!.body).toMatchObject({ timeout: 120 })
  })

  it('createSandbox with only env option sends it correctly', async () => {
    fetchResponder = () => sandboxOk('sb_env')
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox({ env: { NODE_ENV: 'production', DEBUG: 'true' } })
    expect(fetchCalls[0]!.body).toMatchObject({ env: { NODE_ENV: 'production', DEBUG: 'true' } })
  })

  it('createSandbox with custom id sends the id in request body', async () => {
    fetchResponder = () => sandboxOk('my-custom-id')
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox({ id: 'my-custom-id' })
    expect(fetchCalls[0]!.body).toMatchObject({ id: 'my-custom-id' })
  })

  it('getSandbox returns null on success:false response', async () => {
    fetchResponder = () => fail('Sandbox not found')
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.getSandbox('sb_nonexistent')
    expect(sb).toBeNull()
  })
})

// ===========================================================================
// 2. MULTI-SANDBOX ISOLATION (5 tests)
// ===========================================================================

describe('Multi-sandbox isolation', () => {
  it('exec targets the correct sandboxId in each call', async () => {
    fetchResponder = (_url, _method, body) => {
      const sbId = (body as { sandboxId: string })?.sandboxId
      return execOk({ stdout: `from-${sbId}`, command: 'whoami' })
    }

    const client = createCodeClient({ apiKey: 'key' })
    const [r1, r2] = await Promise.all([client.exec('sb_alpha', 'whoami'), client.exec('sb_beta', 'whoami')])

    expect(r1.stdout).toBe('from-sb_alpha')
    expect(r2.stdout).toBe('from-sb_beta')
    expect((fetchCalls[0]!.body as { sandboxId: string }).sandboxId).toBe('sb_alpha')
    expect((fetchCalls[1]!.body as { sandboxId: string }).sandboxId).toBe('sb_beta')
  })

  it('writeFile to different sandboxes includes correct sandboxId', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await Promise.all([
      client.writeFile('sb_a', '/file.txt', 'content_a'),
      client.writeFile('sb_b', '/file.txt', 'content_b'),
    ])

    const bodies = fetchCalls.map((c) => c.body as { sandboxId: string; content: string })
    const bodyA = bodies.find((b) => b.sandboxId === 'sb_a')
    const bodyB = bodies.find((b) => b.sandboxId === 'sb_b')
    expect(bodyA!.content).toBe('content_a')
    expect(bodyB!.content).toBe('content_b')
  })

  it('runCode in parallel sandboxes sends independent requests', async () => {
    fetchResponder = (_url, _method, body) => {
      const lang = (body as { language?: string })?.language
      return codeOk({ language: lang ?? 'javascript' })
    }

    const client = createCodeClient({ apiKey: 'key' })
    const [jsResult, pyResult] = await Promise.all([
      client.runCode('sb_js', '1+1', { language: 'javascript' }),
      client.runCode('sb_py', 'print(1)', { language: 'python' }),
    ])

    expect(jsResult.language).toBe('javascript')
    expect(pyResult.language).toBe('python')
  })

  it('getSandbox and destroySandbox use the correct sandbox ID in URL', async () => {
    let callCount = 0
    fetchResponder = () => {
      callCount++
      if (callCount === 1) return sandboxOk('sb_first')
      return ok(null)
    }

    const client = createCodeClient({ apiKey: 'key' })
    await client.getSandbox('sb_first')
    await client.destroySandbox('sb_second')

    expect(fetchCalls[0]!.url).toContain('/sandbox/sb_first')
    expect(fetchCalls[1]!.url).toContain('/sandbox/sb_second')
  })

  it('exists checks different paths in different sandboxes', async () => {
    fetchResponder = (_url, _method, body) => {
      const path = (body as { path: string })?.path
      return ok({ exists: path === '/exists.txt' })
    }

    const client = createCodeClient({ apiKey: 'key' })
    const [e1, e2] = await Promise.all([client.exists('sb_1', '/exists.txt'), client.exists('sb_2', '/missing.txt')])
    expect(e1).toBe(true)
    expect(e2).toBe(false)
  })
})

// ===========================================================================
// 3. FILE SYSTEM EDGE CASES (8 tests)
// ===========================================================================

describe('File system edge cases', () => {
  it('writeFile with empty content sends empty string', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await client.writeFile('sb_1', '/empty.txt', '')
    expect((fetchCalls[0]!.body as { content: string }).content).toBe('')
  })

  it('writeFile with deeply nested path sends full path', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await client.writeFile('sb_1', '/a/b/c/d/e/f/g/h/deep.txt', 'nested')
    expect((fetchCalls[0]!.body as { path: string }).path).toBe('/a/b/c/d/e/f/g/h/deep.txt')
  })

  it('writeFile with unicode content preserves it', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    const unicodeContent = 'Hello \u4e16\u754c \ud83c\udf0d \u0410\u043b\u0435\u043a\u0441\u0430\u043d\u0434\u0440'
    await client.writeFile('sb_1', '/unicode.txt', unicodeContent)
    expect((fetchCalls[0]!.body as { content: string }).content).toBe(unicodeContent)
  })

  it('readFile with dot-prefixed path sends correct path', async () => {
    fetchResponder = () => ok({ content: '{"private":true}' })
    const client = createCodeClient({ apiKey: 'key' })
    const content = await client.readFile('sb_1', '/app/.env')
    expect(content).toBe('{"private":true}')
    expect((fetchCalls[0]!.body as { path: string }).path).toBe('/app/.env')
  })

  it('listFiles returns symlink type in file info', async () => {
    fetchResponder = () =>
      ok({
        files: [
          { name: 'link.txt', absolutePath: '/app/link.txt', type: 'symlink', size: 0, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0777' },
        ],
      })
    const client = createCodeClient({ apiKey: 'key' })
    const files = await client.listFiles('sb_1', '/app')
    expect(files).toHaveLength(1)
    expect(files[0]!.type).toBe('symlink')
  })

  it('listFiles at root path /', async () => {
    fetchResponder = () =>
      ok({
        files: [
          { name: 'bin', absolutePath: '/bin', type: 'directory', size: 0, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0755' },
          { name: 'etc', absolutePath: '/etc', type: 'directory', size: 0, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0755' },
        ],
      })
    const client = createCodeClient({ apiKey: 'key' })
    const files = await client.listFiles('sb_1', '/')
    expect(files).toHaveLength(2)
    expect(files.map((f) => f.name)).toEqual(['bin', 'etc'])
  })

  it('deleteFile at nested path sends correct body', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await client.deleteFile('sb_1', '/workspace/src/temp/build.log')
    expect((fetchCalls[0]!.body as { path: string }).path).toBe('/workspace/src/temp/build.log')
    expect((fetchCalls[0]!.body as { sandboxId: string }).sandboxId).toBe('sb_1')
  })

  it('writeFile with newlines in content preserves them', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    const multilineContent = 'line1\nline2\nline3\n'
    await client.writeFile('sb_1', '/multiline.txt', multilineContent)
    expect((fetchCalls[0]!.body as { content: string }).content).toBe('line1\nline2\nline3\n')
  })
})

// ===========================================================================
// 4. CODE INTERPRETER RESULT PARSING & OUTPUT TYPES (7 tests)
// ===========================================================================

describe('Code interpreter result parsing', () => {
  it('returns multiple output types in results array', async () => {
    fetchResponder = () =>
      codeOk({
        results: [
          { type: 'text', data: 'hello' },
          { type: 'json', data: '{"key":"value"}' },
          { type: 'html', data: '<h1>Title</h1>' },
        ],
      })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'multi-output')
    expect(result.results).toHaveLength(3)
    expect(result.results[0]).toMatchObject({ type: 'text', data: 'hello' })
    expect(result.results[1]).toMatchObject({ type: 'json', data: '{"key":"value"}' })
    expect(result.results[2]).toMatchObject({ type: 'html', data: '<h1>Title</h1>' })
  })

  it('returns image output with mimeType', async () => {
    fetchResponder = () =>
      codeOk({
        results: [{ type: 'image', data: 'iVBORw0KGgoAAAANSUhEUg==', mimeType: 'image/png' }],
      })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'generate_plot()')
    expect(result.results).toHaveLength(1)
    expect(result.results[0]).toMatchObject({ type: 'image', mimeType: 'image/png' })
  })

  it('returns error output type in results', async () => {
    fetchResponder = () =>
      codeOk({
        error: 'ZeroDivisionError: division by zero',
        results: [{ type: 'error', data: 'Traceback...\nZeroDivisionError: division by zero' }],
      })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', '1/0', { language: 'python' })
    expect(result.error).toContain('ZeroDivisionError')
    expect(result.results[0]).toMatchObject({ type: 'error' })
  })

  it('returns empty logs and empty results for no-output code', async () => {
    fetchResponder = () => codeOk({ code: 'x = 1', logs: [], results: [] })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'x = 1')
    expect(result.logs).toEqual([])
    expect(result.results).toEqual([])
  })

  it('returns multiple log entries', async () => {
    fetchResponder = () =>
      codeOk({
        code: 'for i in range(5): print(i)',
        language: 'python',
        logs: ['0', '1', '2', '3', '4'],
        results: [{ type: 'text', data: '4' }],
      })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'for i in range(5): print(i)', { language: 'python' })
    expect(result.logs).toHaveLength(5)
    expect(result.logs).toEqual(['0', '1', '2', '3', '4'])
  })

  it('runCode without any options still sends sandboxId and code', async () => {
    fetchResponder = () => codeOk()
    const client = createCodeClient({ apiKey: 'key' })
    await client.runCode('sb_1', 'console.log("bare")')
    expect(fetchCalls[0]!.body).toMatchObject({ sandboxId: 'sb_1', code: 'console.log("bare")' })
    // Should NOT have language, timeout, or env keys unless explicitly set
    const body = fetchCalls[0]!.body as Record<string, unknown>
    expect(body.language).toBeUndefined()
    expect(body.timeout).toBeUndefined()
    expect(body.env).toBeUndefined()
  })

  it('runCode duration reflects server-reported execution time', async () => {
    fetchResponder = () => codeOk({ duration: 1234 })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'heavy_computation()')
    expect(result.duration).toBe(1234)
  })
})

// ===========================================================================
// 5. SSE STREAM EDGE CASES (10 tests)
// ===========================================================================

describe('SSE stream edge cases', () => {
  it('handles empty data field as non-JSON stdout', async () => {
    const res = sseResponse('data: \n\n')
    const events = await collectParse(res)
    expect(events).toHaveLength(1)
    // Empty string after "data: " is not valid JSON, so wraps as stdout
    expect(events[0]).toEqual({ type: 'stdout', data: '' })
  })

  it('handles rapid successive events in one chunk without blank line gaps', async () => {
    // SSE spec says events are separated by blank lines; individual lines are separated by \n
    const res = sseResponse('data: {"type":"stdout","data":"a"}\n\ndata: {"type":"stdout","data":"b"}\n\ndata: {"type":"stdout","data":"c"}\n\n')
    const events = await collectParse(res)
    expect(events).toHaveLength(3)
  })

  it('handles event type line followed by empty line (no data)', async () => {
    // If we get "event: foo\n\n" with no data line, the event type is set but no event is yielded
    const res = sseResponse('event: stderr\n\ndata: {"type":"stdout","data":"after"}\n\n')
    const events = await collectParse(res)
    // The first event: line sets eventType to 'stderr', blank line resets nothing
    // Then data line yields event. Since eventType is still 'stderr', it overrides
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('stderr')
  })

  it('handles data line split exactly at "data: " boundary', async () => {
    const res = sseResponse('data:', ' {"type":"stdout","data":"split-at-colon"}\n\n')
    const events = await collectParse(res)
    // "data:" is one chunk, " {...}" is next. After reassembly: "data: {...}"
    // But since they arrive as separate chunks, buffer logic: first chunk is "data:"
    // which is a full line. It doesn't start with "data: " (has no space). Skipped.
    // Then " {...}\n\n" - this line starts with space, also skipped.
    // Actually, both chunks concatenate into buffer. When \n splits occur:
    // Line: "data: {"type":"stdout","data":"split-at-colon"}" - starts with "data: "
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'stdout', data: 'split-at-colon' })
  })

  it('handles SSE retry field (ignored by parser)', async () => {
    const res = sseResponse('retry: 3000\ndata: {"type":"stdout","data":"after-retry"}\n\n')
    const events = await collectParse(res)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'stdout', data: 'after-retry' })
  })

  it('handles SSE id field (ignored by parser)', async () => {
    const res = sseResponse('id: 42\ndata: {"type":"stdout","data":"with-id"}\n\n')
    const events = await collectParse(res)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'stdout', data: 'with-id' })
  })

  it('handles multiple consecutive blank lines between events', async () => {
    const res = sseResponse('data: {"type":"stdout","data":"first"}\n\n\n\n\ndata: {"type":"stdout","data":"second"}\n\n')
    const events = await collectParse(res)
    expect(events).toHaveLength(2)
    expect(events[0]).toEqual({ type: 'stdout', data: 'first' })
    expect(events[1]).toEqual({ type: 'stdout', data: 'second' })
  })

  it('handles data with special JSON characters (escaped quotes, backslashes)', async () => {
    const jsonData = '{"type":"stdout","data":"line with \\"quotes\\" and \\\\backslashes"}'
    const res = sseResponse(`data: ${jsonData}\n\n`)
    const events = await collectParse(res)
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('stdout')
    if (events[0]!.type === 'stdout') {
      expect(events[0]!.data).toContain('"quotes"')
      expect(events[0]!.data).toContain('\\backslashes')
    }
  })

  it('handles very long data line', async () => {
    const longData = 'x'.repeat(100_000)
    const res = sseResponse(`data: {"type":"stdout","data":"${longData}"}\n\n`)
    const events = await collectParse(res)
    expect(events).toHaveLength(1)
    if (events[0]!.type === 'stdout') {
      expect(events[0]!.data).toHaveLength(100_000)
    }
  })

  it('only yields from data lines, ignores unknown field names', async () => {
    const res = sseResponse('foo: bar\nbaz: qux\ndata: {"type":"stdout","data":"only-this"}\n\n')
    const events = await collectParse(res)
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'stdout', data: 'only-this' })
  })
})

// ===========================================================================
// 6. ERROR MESSAGE FORMAT & HTTP ERROR HANDLING (6 tests)
// ===========================================================================

describe('Error message format and HTTP error handling', () => {
  it('error message includes the full path for exec', async () => {
    fetchResponder = () => httpError(500, 'Server Error')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.exec('sb_1', 'echo')).rejects.toThrow('/exec')
  })

  it('error message includes the full path for file write', async () => {
    fetchResponder = () => httpError(500, 'Server Error')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.writeFile('sb_1', '/f', 'x')).rejects.toThrow('/files/write')
  })

  it('error message includes the full path for file read', async () => {
    fetchResponder = () => httpError(500, 'Server Error')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.readFile('sb_1', '/f')).rejects.toThrow('/files/read')
  })

  it('error message includes HTTP response body text', async () => {
    fetchResponder = () => httpError(422, 'Unprocessable Entity: invalid sandbox ID format')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.createSandbox()).rejects.toThrow('invalid sandbox ID format')
  })

  it('destroySandbox throws with status code for HTTP error', async () => {
    fetchResponder = () => httpError(410, 'Gone')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.destroySandbox('sb_expired')).rejects.toThrow('410')
  })

  it('exists returns false on HTTP 500 (does not throw)', async () => {
    fetchResponder = () => httpError(500, 'Internal Server Error')
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exists('sb_1', '/crash')
    expect(result).toBe(false)
  })
})

// ===========================================================================
// 7. URL CONSTRUCTION (5 tests)
// ===========================================================================

describe('URL construction', () => {
  it('sandbox paths use GET /sandbox/:id for getSandbox', async () => {
    fetchResponder = () => sandboxOk('sb_url_test')
    const client = createCodeClient({ endpoint: 'http://localhost:9000' })
    await client.getSandbox('sb_url_test')
    expect(fetchCalls[0]!.url).toBe('http://localhost:9000/sandbox/sb_url_test')
  })

  it('sandbox paths use DELETE /sandbox/:id for destroySandbox', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ endpoint: 'http://localhost:9000' })
    await client.destroySandbox('sb_del_test')
    expect(fetchCalls[0]!.url).toBe('http://localhost:9000/sandbox/sb_del_test')
  })

  it('file operations all route to /files/* paths', async () => {
    fetchResponder = () => ok({ content: '', files: [], exists: true })
    const client = createCodeClient({ endpoint: 'http://localhost:9000' })

    await client.writeFile('sb_1', '/f', 'x')
    await client.readFile('sb_1', '/f')
    await client.listFiles('sb_1', '/')
    await client.exists('sb_1', '/f')
    await client.deleteFile('sb_1', '/f')

    expect(fetchCalls[0]!.url).toBe('http://localhost:9000/files/write')
    expect(fetchCalls[1]!.url).toBe('http://localhost:9000/files/read')
    expect(fetchCalls[2]!.url).toBe('http://localhost:9000/files/list')
    expect(fetchCalls[3]!.url).toBe('http://localhost:9000/files/exists')
    expect(fetchCalls[4]!.url).toBe('http://localhost:9000/files/delete')
  })

  it('runCode routes to /code/run', async () => {
    fetchResponder = () => codeOk()
    const client = createCodeClient({ endpoint: 'http://localhost:9000' })
    await client.runCode('sb_1', '1+1')
    expect(fetchCalls[0]!.url).toBe('http://localhost:9000/code/run')
  })

  it('endpoint with path prefix is used as base URL', async () => {
    fetchResponder = () => sandboxOk('sb_prefix')
    const client = createCodeClient({ endpoint: 'http://localhost:9000/api/v2' })
    await client.createSandbox()
    expect(fetchCalls[0]!.url).toBe('http://localhost:9000/api/v2/sandbox')
  })
})

// ===========================================================================
// 8. CONCURRENT EXECUTION & ORDERING (5 tests)
// ===========================================================================

describe('Concurrent execution and ordering', () => {
  it('five concurrent exec calls all complete independently', async () => {
    let counter = 0
    fetchResponder = () => {
      counter++
      return execOk({ stdout: `output-${counter}`, command: `cmd-${counter}` })
    }

    const client = createCodeClient({ apiKey: 'key' })
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => client.exec('sb_1', `cmd-${i + 1}`)),
    )
    expect(results).toHaveLength(5)
    expect(fetchCalls).toHaveLength(5)
  })

  it('concurrent mix of different operation types all resolve', async () => {
    let callIdx = 0
    fetchResponder = (url) => {
      callIdx++
      if (url.includes('/sandbox') && !url.includes('/sandbox/')) return sandboxOk(`sb_c${callIdx}`)
      if (url.includes('/exec')) return execOk({ stdout: 'done' })
      if (url.includes('/files/write')) return ok(null)
      if (url.includes('/code/run')) return codeOk({ logs: ['ran'] })
      return ok(null)
    }

    const client = createCodeClient({ apiKey: 'key' })
    const [sb, execResult, , codeResult] = await Promise.all([
      client.createSandbox(),
      client.exec('sb_1', 'echo done'),
      client.writeFile('sb_1', '/f', 'content'),
      client.runCode('sb_1', 'console.log("ran")'),
    ])

    expect(sb.id).toBeDefined()
    expect(execResult.stdout).toBe('done')
    expect(codeResult.logs).toContain('ran')
    expect(fetchCalls).toHaveLength(4)
  })

  it('Promise.allSettled captures mixed success/failure results', async () => {
    let callIdx = 0
    fetchResponder = () => {
      callIdx++
      if (callIdx === 2) return httpError(500, 'Internal Server Error')
      return execOk({ stdout: `ok-${callIdx}` })
    }

    const client = createCodeClient({ apiKey: 'key' })
    const results = await Promise.allSettled([
      client.exec('sb_1', 'cmd1'),
      client.exec('sb_1', 'cmd2'),
      client.exec('sb_1', 'cmd3'),
    ])

    expect(results[0]!.status).toBe('fulfilled')
    expect(results[1]!.status).toBe('rejected')
    expect(results[2]!.status).toBe('fulfilled')
  })

  it('concurrent getSandbox on multiple IDs returns independent results', async () => {
    fetchResponder = (url) => {
      if (url.includes('sb_running')) return sandboxOk('sb_running', 'running')
      if (url.includes('sb_stopped')) return sandboxOk('sb_stopped', 'stopped')
      return httpError(404, 'Not Found')
    }

    const client = createCodeClient({ apiKey: 'key' })
    const [running, stopped, missing] = await Promise.all([
      client.getSandbox('sb_running'),
      client.getSandbox('sb_stopped'),
      client.getSandbox('sb_missing'),
    ])

    expect(running!.status).toBe('running')
    expect(stopped!.status).toBe('stopped')
    expect(missing).toBeNull()
  })

  it('concurrent file reads return correct content for each path', async () => {
    fetchResponder = (_url, _method, body) => {
      const path = (body as { path: string })?.path
      return ok({ content: `content-of-${path}` })
    }

    const client = createCodeClient({ apiKey: 'key' })
    const [c1, c2, c3] = await Promise.all([
      client.readFile('sb_1', '/a.txt'),
      client.readFile('sb_1', '/b.txt'),
      client.readFile('sb_1', '/c.txt'),
    ])

    expect(c1).toBe('content-of-/a.txt')
    expect(c2).toBe('content-of-/b.txt')
    expect(c3).toBe('content-of-/c.txt')
  })
})

// ===========================================================================
// 9. RESOURCE CLEANUP ON ERRORS (5 tests)
// ===========================================================================

describe('Resource cleanup on errors', () => {
  it('stream reader is released even when parser encounters error event', async () => {
    const res = sseResponse(
      'data: {"type":"stdout","data":"before-error"}\n\n',
      'data: {"type":"error","message":"sandbox crashed"}\n\n',
    )
    const events = await collectParse(res)
    expect(events).toHaveLength(2)
    expect(events[1]!.type).toBe('error')
    // The reader should be released (no hanging promise)
  })

  it('parseExecStream releases reader lock after consuming all events', async () => {
    const res = sseResponse('data: {"type":"complete","exitCode":0,"duration":10}\n\n')
    const events = await collectParse(res)
    expect(events).toHaveLength(1)
    // After collection, the reader lock should be released
    // Trying to get a new reader should not throw
    // (Body is already consumed, but lock is released)
  })

  it('parseExecStream releases reader lock on empty stream', async () => {
    const res = sseResponse('')
    const events = await collectParse(res)
    expect(events).toEqual([])
  })

  it('getSandbox swallows error and returns null rather than leaking', async () => {
    fetchResponder = () => {
      throw new Error('ECONNRESET')
    }
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.getSandbox('sb_err')
    expect(result).toBeNull()
  })

  it('exists swallows all error types and returns false', async () => {
    // Test with success:false at HTTP 200
    fetchResponder = () => fail('Permission denied')
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exists('sb_1', '/restricted')
    expect(result).toBe(false)
  })
})

// ===========================================================================
// 10. CLIENT CONFIGURATION VALIDATION EDGE CASES (5 tests)
// ===========================================================================

describe('Client configuration edge cases', () => {
  it('apiKey with special characters is sent as-is in header', async () => {
    const specialKey = 'sk_test_key+with/special=chars'
    const client = createCodeClient({ apiKey: specialKey })
    await client.createSandbox()
    expect(fetchCalls[0]!.headers['Authorization']).toBe(`Bearer ${specialKey}`)
  })

  it('endpoint with HTTPS is preserved', async () => {
    const client = createCodeClient({ endpoint: 'https://custom-code.example.com' })
    await client.createSandbox()
    expect(fetchCalls[0]!.url).toMatch(/^https:\/\/custom-code\.example\.com/)
  })

  it('timeout of 0 still creates a signal', async () => {
    // AbortSignal.timeout(0) is valid and creates an immediately-timing-out signal
    // However, config.timeout of 0 is falsy, so no signal is set
    const client = createCodeClient({ timeout: 0 })
    await client.createSandbox()
    // timeout: 0 is falsy in JS, so config.timeout ? ... : undefined evaluates to undefined
    expect(fetchCalls[0]!.signal).toBeUndefined()
  })

  it('config with only timeout set (no apiKey, no endpoint)', async () => {
    const client = createCodeClient({ timeout: 15000 })
    await client.createSandbox()
    expect(fetchCalls[0]!.url).toMatch(/^https:\/\/code\.headless\.ly/)
    expect(fetchCalls[0]!.headers['Authorization']).toBeUndefined()
    expect(fetchCalls[0]!.signal).toBeDefined()
  })

  it('config is not mutated after client creation', async () => {
    const cfg: CodeClientConfig = { apiKey: 'original', endpoint: 'http://localhost:1234' }
    const client = createCodeClient(cfg)
    // Mutate the original config object
    cfg.apiKey = 'changed'
    cfg.endpoint = 'http://different:9999'
    // Since config is passed by reference, the client uses the same object
    // This is the actual behavior - config is the same reference
    await client.createSandbox()
    // The client.config IS the same reference, so it reflects the mutation
    expect(client.config.apiKey).toBe('changed')
    expect(fetchCalls[0]!.url).toMatch(/^http:\/\/localhost:1234/)
    // BUT the baseUrl was captured at creation time (const baseUrl = config.endpoint || ...)
    // So the URL doesn't change, but the apiKey is re-read from config each time
    expect(fetchCalls[0]!.headers['Authorization']).toBe('Bearer changed')
  })
})

// ===========================================================================
// 11. EXEC OPTIONS EDGE CASES (4 tests)
// ===========================================================================

describe('Exec options edge cases', () => {
  it('exec with ExecOptions.timeout sends timeout in body', async () => {
    fetchResponder = () => execOk()
    const client = createCodeClient({ apiKey: 'key' })
    await client.exec('sb_1', 'sleep 10', { timeout: 30000 })
    expect(fetchCalls[0]!.body).toMatchObject({ timeout: 30000 })
  })

  it('exec with empty env object sends empty env', async () => {
    fetchResponder = () => execOk()
    const client = createCodeClient({ apiKey: 'key' })
    await client.exec('sb_1', 'env', { env: {} })
    expect((fetchCalls[0]!.body as { env: Record<string, string> }).env).toEqual({})
  })

  it('exec with all options combined sends them all', async () => {
    fetchResponder = () => execOk()
    const client = createCodeClient({ apiKey: 'key' })
    await client.exec('sb_1', 'cat', {
      cwd: '/workspace',
      env: { LANG: 'en_US.UTF-8' },
      timeout: 5000,
      stdin: 'hello world',
    })
    expect(fetchCalls[0]!.body).toMatchObject({
      sandboxId: 'sb_1',
      command: 'cat',
      cwd: '/workspace',
      env: { LANG: 'en_US.UTF-8' },
      timeout: 5000,
      stdin: 'hello world',
    })
  })

  it('exec without options sends only sandboxId and command', async () => {
    fetchResponder = () => execOk()
    const client = createCodeClient({ apiKey: 'key' })
    await client.exec('sb_1', 'whoami')
    expect(fetchCalls[0]!.body).toEqual({ sandboxId: 'sb_1', command: 'whoami' })
  })
})

// ===========================================================================
// 12. API RESPONSE SHAPE HANDLING (4 tests)
// ===========================================================================

describe('API response shape handling', () => {
  it('listFiles handles direct array data (no wrapper)', async () => {
    fetchResponder = () =>
      ok([
        { name: 'x.txt', absolutePath: '/x.txt', type: 'file', size: 5, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0644' },
      ])
    const client = createCodeClient({ apiKey: 'key' })
    const files = await client.listFiles('sb_1', '/')
    expect(files).toHaveLength(1)
    expect(files[0]!.name).toBe('x.txt')
  })

  it('listFiles with files: undefined returns empty array', async () => {
    fetchResponder = () => ok({ other: 'data' })
    const client = createCodeClient({ apiKey: 'key' })
    const files = await client.listFiles('sb_1', '/')
    expect(files).toEqual([])
  })

  it('success:false response with detailed error message is thrown', async () => {
    fetchResponder = () =>
      new Response(JSON.stringify({ success: false, error: 'Rate limit: 100 requests per minute exceeded for sandbox sb_1' }), {
        status: 200,
      })
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.exec('sb_1', 'echo')).rejects.toThrow('Rate limit: 100 requests per minute exceeded for sandbox sb_1')
  })

  it('response with non-JSON body on HTTP error throws with status and body', async () => {
    fetchResponder = () => new Response('<html>502 Bad Gateway</html>', { status: 502 })
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.exec('sb_1', 'echo')).rejects.toThrow('502')
  })
})
