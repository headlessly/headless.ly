import { describe, it, expect, beforeEach } from 'vitest'
import { createCodeClient } from '../src/client.js'
import { parseExecStream } from '../src/stream.js'
import type { ExecEvent, FileInfo } from '../src/types.js'

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

function fail(error: string, status = 200) {
  return new Response(JSON.stringify({ success: false, error }), { status })
}

function httpError(status: number, text: string) {
  return new Response(text, { status })
}

function sandboxOk(id: string, status: 'running' | 'stopped' | 'error' = 'running') {
  return ok({ id, status, createdAt: '2025-06-01T00:00:00Z' })
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

// ===========================================================================
// 1. CLIENT CONSTRUCTION & CONFIGURATION (8 tests)
// ===========================================================================

describe('Client construction & configuration', () => {
  it('creates client with no arguments at all', () => {
    const client = createCodeClient()
    expect(client).toBeDefined()
    expect(client.config).toEqual({})
  })

  it('exposes all interface methods', () => {
    const client = createCodeClient()
    expect(typeof client.createSandbox).toBe('function')
    expect(typeof client.getSandbox).toBe('function')
    expect(typeof client.destroySandbox).toBe('function')
    expect(typeof client.exec).toBe('function')
    expect(typeof client.execStream).toBe('function')
    expect(typeof client.writeFile).toBe('function')
    expect(typeof client.readFile).toBe('function')
    expect(typeof client.listFiles).toBe('function')
    expect(typeof client.exists).toBe('function')
    expect(typeof client.deleteFile).toBe('function')
    expect(typeof client.runCode).toBe('function')
  })

  it('strips no trailing slash from endpoint — URL is used as-is', async () => {
    const client = createCodeClient({ endpoint: 'http://localhost:8787' })
    await client.createSandbox()
    expect(fetchCalls[0]!.url).toBe('http://localhost:8787/sandbox')
  })

  it('preserves endpoint with trailing slash in URL construction', async () => {
    // If the user passes a trailing slash, paths will double up — client uses as-is
    const client = createCodeClient({ endpoint: 'http://localhost:8787/' })
    await client.createSandbox()
    expect(fetchCalls[0]!.url).toBe('http://localhost:8787//sandbox')
  })

  it('always sends Content-Type: application/json header', async () => {
    const client = createCodeClient()
    await client.createSandbox()
    expect(fetchCalls[0]!.headers['Content-Type']).toBe('application/json')
  })

  it('does not set AbortSignal when no timeout is configured', async () => {
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox()
    expect(fetchCalls[0]!.signal).toBeUndefined()
  })

  it('config object is the same reference passed in', () => {
    const cfg = { apiKey: 'test_key', endpoint: 'http://localhost:3000', timeout: 10000 }
    const client = createCodeClient(cfg)
    expect(client.config).toBe(cfg)
  })

  it('multiple clients with different configs are independent', async () => {
    const clientA = createCodeClient({ apiKey: 'key_a', endpoint: 'http://a.local' })
    const clientB = createCodeClient({ apiKey: 'key_b', endpoint: 'http://b.local' })

    await clientA.createSandbox()
    await clientB.createSandbox()

    expect(fetchCalls[0]!.url).toContain('http://a.local')
    expect(fetchCalls[0]!.headers['Authorization']).toBe('Bearer key_a')
    expect(fetchCalls[1]!.url).toContain('http://b.local')
    expect(fetchCalls[1]!.headers['Authorization']).toBe('Bearer key_b')
  })
})

// ===========================================================================
// 2. SANDBOX CRUD (6 tests)
// ===========================================================================

describe('Sandbox CRUD', () => {
  it('createSandbox without options sends empty/undefined body', async () => {
    fetchResponder = () => sandboxOk('sb_new')
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox()
    // body is undefined when no options passed
    expect(fetchCalls[0]!.body).toBeUndefined()
  })

  it('getSandbox with a stopped sandbox returns status stopped', async () => {
    fetchResponder = () => sandboxOk('sb_stopped', 'stopped')
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.getSandbox('sb_stopped')
    expect(sb).not.toBeNull()
    expect(sb!.status).toBe('stopped')
  })

  it('getSandbox with an errored sandbox returns status error', async () => {
    fetchResponder = () => sandboxOk('sb_err', 'error')
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.getSandbox('sb_err')
    expect(sb).not.toBeNull()
    expect(sb!.status).toBe('error')
  })

  it('getSandbox returns null on HTTP 404', async () => {
    fetchResponder = () => httpError(404, 'Not Found')
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.getSandbox('sb_missing')
    expect(sb).toBeNull()
  })

  it('getSandbox returns null on network failure', async () => {
    fetchResponder = () => {
      throw new TypeError('fetch failed')
    }
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.getSandbox('sb_unreachable')
    expect(sb).toBeNull()
  })

  it('destroySandbox resolves void on success', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.destroySandbox('sb_del')
    expect(result).toBeUndefined()
  })
})

// ===========================================================================
// 3. EXEC — COMMAND EXECUTION (6 tests)
// ===========================================================================

describe('Exec — command execution', () => {
  it('throws synchronously when command is empty', async () => {
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.exec('sb_1', '')).rejects.toThrow('command must not be empty')
  })

  it('merges ExecOptions cwd into request body', async () => {
    fetchResponder = () => execOk()
    const client = createCodeClient({ apiKey: 'key' })
    await client.exec('sb_1', 'ls', { cwd: '/workspace' })
    expect(fetchCalls[0]!.body).toMatchObject({ sandboxId: 'sb_1', command: 'ls', cwd: '/workspace' })
  })

  it('merges ExecOptions env into request body', async () => {
    fetchResponder = () => execOk()
    const client = createCodeClient({ apiKey: 'key' })
    await client.exec('sb_1', 'env', { env: { PATH: '/usr/bin', HOME: '/root' } })
    expect(fetchCalls[0]!.body).toMatchObject({ env: { PATH: '/usr/bin', HOME: '/root' } })
  })

  it('merges ExecOptions stdin into request body', async () => {
    fetchResponder = () => execOk({ stdout: 'hello' })
    const client = createCodeClient({ apiKey: 'key' })
    await client.exec('sb_1', 'cat', { stdin: 'hello' })
    expect(fetchCalls[0]!.body).toMatchObject({ stdin: 'hello' })
  })

  it('returns full ExecResult with all fields', async () => {
    fetchResponder = () => execOk({ exitCode: 0, stdout: 'output\n', stderr: 'warning\n', command: 'mycommand', duration: 42 })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exec('sb_1', 'mycommand')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('output\n')
    expect(result.stderr).toBe('warning\n')
    expect(result.command).toBe('mycommand')
    expect(result.duration).toBe(42)
    expect(result.success).toBe(true)
  })

  it('returns non-zero exit code without throwing', async () => {
    fetchResponder = () => execOk({ exitCode: 127, stdout: '', stderr: 'command not found', command: 'nosuchcmd' })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exec('sb_1', 'nosuchcmd')
    expect(result.exitCode).toBe(127)
    expect(result.success).toBe(false)
    expect(result.stderr).toContain('command not found')
  })
})

// ===========================================================================
// 4. FILE OPERATIONS (8 tests)
// ===========================================================================

describe('File operations', () => {
  it('writeFile with encoding option includes it in body', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await client.writeFile('sb_1', '/data.bin', 'AQID', { encoding: 'base64' })
    expect(fetchCalls[0]!.body).toMatchObject({ sandboxId: 'sb_1', path: '/data.bin', content: 'AQID', encoding: 'base64' })
  })

  it('writeFile with permissions and encoding together', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await client.writeFile('sb_1', '/run.sh', '#!/bin/bash', { permissions: '0755', encoding: 'utf-8' })
    expect(fetchCalls[0]!.body).toMatchObject({ permissions: '0755', encoding: 'utf-8' })
  })

  it('readFile sends POST to /files/read', async () => {
    fetchResponder = () => ok({ content: 'the contents' })
    const client = createCodeClient({ apiKey: 'key' })
    await client.readFile('sb_1', '/app/index.js')
    expect(fetchCalls[0]!.method).toBe('POST')
    expect(fetchCalls[0]!.url).toContain('/files/read')
  })

  it('listFiles returns empty array when server returns { files: [] }', async () => {
    fetchResponder = () => ok({ files: [] })
    const client = createCodeClient({ apiKey: 'key' })
    const files = await client.listFiles('sb_1', '/empty-dir')
    expect(files).toEqual([])
  })

  it('listFiles handles missing files key gracefully (returns [])', async () => {
    fetchResponder = () => ok({})
    const client = createCodeClient({ apiKey: 'key' })
    const files = await client.listFiles('sb_1', '/dir')
    // Not an array and no files key => (result as { files }).files ?? [] => []
    expect(files).toEqual([])
  })

  it('exists returns true when server confirms file exists', async () => {
    fetchResponder = () => ok({ exists: true })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exists('sb_1', '/app/package.json')
    expect(result).toBe(true)
  })

  it('exists returns false when server says exists: false', async () => {
    fetchResponder = () => ok({ exists: false })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exists('sb_1', '/no-such-file')
    expect(result).toBe(false)
  })

  it('exists returns false on network error', async () => {
    fetchResponder = () => {
      throw new TypeError('fetch failed')
    }
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exists('sb_1', '/offline')
    expect(result).toBe(false)
  })
})

// ===========================================================================
// 5. CODE INTERPRETER — runCode (5 tests)
// ===========================================================================

describe('Code interpreter — runCode', () => {
  it('throws when sandboxId is empty', async () => {
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.runCode('', 'print(1)')).rejects.toThrow('sandboxId must not be empty')
  })

  it('sends timeout option in request body', async () => {
    fetchResponder = () => codeOk()
    const client = createCodeClient({ apiKey: 'key' })
    await client.runCode('sb_1', 'sleep(1)', { timeout: 5000 })
    expect(fetchCalls[0]!.body).toMatchObject({ timeout: 5000 })
  })

  it('returns execution result with logs, results, and duration', async () => {
    fetchResponder = () =>
      codeOk({
        code: 'console.log("a"); console.log("b")',
        language: 'javascript',
        logs: ['a', 'b'],
        results: [{ type: 'text', data: 'b' }],
        duration: 12,
      })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'console.log("a"); console.log("b")')
    expect(result.logs).toEqual(['a', 'b'])
    expect(result.results).toHaveLength(1)
    expect(result.duration).toBe(12)
    expect(result.code).toBe('console.log("a"); console.log("b")')
  })

  it('returns error field when execution fails', async () => {
    fetchResponder = () => codeOk({ error: 'NameError: name "x" is not defined', language: 'python' })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'print(x)', { language: 'python' })
    expect(result.error).toContain('NameError')
  })

  it('sends to POST /code/run path', async () => {
    fetchResponder = () => codeOk()
    const client = createCodeClient({ apiKey: 'key' })
    await client.runCode('sb_1', '1 + 1')
    expect(fetchCalls[0]!.url).toContain('/code/run')
    expect(fetchCalls[0]!.method).toBe('POST')
  })
})

// ===========================================================================
// 6. STREAMING EXECUTION (6 tests)
// ===========================================================================

describe('Streaming execution', () => {
  it('execStream sends POST to /exec/stream', async () => {
    fetchResponder = () => sseResponse('data: {"type":"stdout","data":"ok"}\n\n')
    const client = createCodeClient({ apiKey: 'key' })
    await client.execStream('sb_1', 'echo ok')
    expect(fetchCalls[0]!.method).toBe('POST')
    expect(fetchCalls[0]!.url).toContain('/exec/stream')
  })

  it('execStream sends sandboxId and command in body', async () => {
    fetchResponder = () => sseResponse('data: {"type":"stdout","data":"hi"}\n\n')
    const client = createCodeClient({ apiKey: 'key' })
    await client.execStream('sb_42', 'echo hi')
    expect(fetchCalls[0]!.body).toMatchObject({ sandboxId: 'sb_42', command: 'echo hi' })
  })

  it('execStream includes ExecOptions in body', async () => {
    fetchResponder = () => sseResponse('data: {"type":"stdout","data":"/"}\n\n')
    const client = createCodeClient({ apiKey: 'key' })
    await client.execStream('sb_1', 'pwd', { cwd: '/', env: { FOO: 'bar' } })
    expect(fetchCalls[0]!.body).toMatchObject({ cwd: '/', env: { FOO: 'bar' } })
  })

  it('execStream collects interleaved stdout and stderr', async () => {
    fetchResponder = () =>
      sseResponse(
        'data: {"type":"stdout","data":"out1"}\n\n',
        'data: {"type":"stderr","data":"err1"}\n\n',
        'data: {"type":"stdout","data":"out2"}\n\n',
        'data: {"type":"stderr","data":"err2"}\n\n',
      )
    const client = createCodeClient({ apiKey: 'key' })
    const events = await collectStream(await client.execStream('sb_1', 'mixed'))
    expect(events.map((e) => e.type)).toEqual(['stdout', 'stderr', 'stdout', 'stderr'])
  })

  it('execStream throws on HTTP 500', async () => {
    fetchResponder = () => httpError(500, 'Internal Server Error')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.execStream('sb_1', 'fail')).rejects.toThrow('500')
  })

  it('execStream throws on HTTP 403 Forbidden', async () => {
    fetchResponder = () => httpError(403, 'Forbidden')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.execStream('sb_1', 'restricted')).rejects.toThrow('403')
  })
})

// ===========================================================================
// 7. ERROR HANDLING & HTTP STATUS CODES (7 tests)
// ===========================================================================

describe('Error handling & HTTP status codes', () => {
  it('throws on HTTP 403 with status in message', async () => {
    fetchResponder = () => httpError(403, 'Forbidden')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.createSandbox()).rejects.toThrow('403')
  })

  it('throws on HTTP 429 rate limit', async () => {
    fetchResponder = () => httpError(429, 'Too Many Requests')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.exec('sb_1', 'echo hi')).rejects.toThrow('429')
  })

  it('throws on HTTP 502 bad gateway', async () => {
    fetchResponder = () => httpError(502, 'Bad Gateway')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.writeFile('sb_1', '/f', 'x')).rejects.toThrow('502')
  })

  it('throws on HTTP 503 service unavailable', async () => {
    fetchResponder = () => httpError(503, 'Service Unavailable')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.readFile('sb_1', '/f')).rejects.toThrow('503')
  })

  it('throws with error message from success:false response body', async () => {
    fetchResponder = () => fail('Quota exceeded: maximum 5 sandboxes')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.createSandbox()).rejects.toThrow('Quota exceeded: maximum 5 sandboxes')
  })

  it('error message includes HTTP method and path', async () => {
    fetchResponder = () => httpError(404, 'Not Found')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.destroySandbox('sb_x')).rejects.toThrow('DELETE')
  })

  it('deleteFile throws on server error', async () => {
    fetchResponder = () => httpError(500, 'disk full')
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.deleteFile('sb_1', '/important')).rejects.toThrow('500')
  })
})

// ===========================================================================
// 8. NETWORK FAILURES (3 tests)
// ===========================================================================

describe('Network failures', () => {
  it('createSandbox rejects when fetch itself throws (network error)', async () => {
    fetchResponder = () => {
      throw new TypeError('Failed to fetch')
    }
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.createSandbox()).rejects.toThrow('Failed to fetch')
  })

  it('exec rejects when fetch throws', async () => {
    fetchResponder = () => {
      throw new TypeError('net::ERR_CONNECTION_REFUSED')
    }
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.exec('sb_1', 'echo')).rejects.toThrow()
  })

  it('destroySandbox rejects when fetch throws', async () => {
    fetchResponder = () => {
      throw new Error('DNS resolution failed')
    }
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.destroySandbox('sb_1')).rejects.toThrow('DNS resolution failed')
  })
})

// ===========================================================================
// 9. PARSEEXECSTREAM — ADVANCED SSE PARSING (7 tests)
// ===========================================================================

describe('parseExecStream — advanced SSE parsing', () => {
  it('handles start event with command and timestamp', async () => {
    const res = sseResponse('data: {"type":"start","command":"ls -la","timestamp":"2025-06-01T00:00:00Z"}\n\n')
    const events = await collectStream(parseExecStream(res))
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('start')
    if (events[0]!.type === 'start') {
      expect(events[0]!.command).toBe('ls -la')
      expect(events[0]!.timestamp).toBe('2025-06-01T00:00:00Z')
    }
  })

  it('handles error event with message', async () => {
    const res = sseResponse('data: {"type":"error","message":"timeout exceeded"}\n\n')
    const events = await collectStream(parseExecStream(res))
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('error')
    if (events[0]!.type === 'error') {
      expect(events[0]!.message).toBe('timeout exceeded')
    }
  })

  it('handles data split across three chunks', async () => {
    const res = sseResponse('data: {"ty', 'pe":"stdout"', ',"data":"split"}\n\n')
    const events = await collectStream(parseExecStream(res))
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'stdout', data: 'split' })
  })

  it('handles multiple events in a single chunk with blank line separators', async () => {
    const chunk = 'data: {"type":"stdout","data":"a"}\n\ndata: {"type":"stdout","data":"b"}\n\ndata: {"type":"stdout","data":"c"}\n\n'
    const res = sseResponse(chunk)
    const events = await collectStream(parseExecStream(res))
    expect(events).toHaveLength(3)
    expect(events.map((e) => (e as { data: string }).data)).toEqual(['a', 'b', 'c'])
  })

  it('skips SSE comment lines (starting with colon)', async () => {
    const res = sseResponse(': keepalive\n\n: another comment\ndata: {"type":"stdout","data":"after comments"}\n\n')
    const events = await collectStream(parseExecStream(res))
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'stdout', data: 'after comments' })
  })

  it('handles complete event with non-zero exit code', async () => {
    const res = sseResponse('data: {"type":"complete","exitCode":2,"duration":300}\n\n')
    const events = await collectStream(parseExecStream(res))
    expect(events).toHaveLength(1)
    if (events[0]!.type === 'complete') {
      expect(events[0]!.exitCode).toBe(2)
      expect(events[0]!.duration).toBe(300)
    }
  })

  it('full lifecycle: start -> stdout -> stderr -> complete', async () => {
    const res = sseResponse(
      'data: {"type":"start","command":"npm test","timestamp":"2025-06-01T00:00:00Z"}\n\n',
      'data: {"type":"stdout","data":"PASS"}\n\n',
      'data: {"type":"stderr","data":"warning: deprecated"}\n\n',
      'data: {"type":"complete","exitCode":0,"duration":1500}\n\n',
    )
    const events = await collectStream(parseExecStream(res))
    expect(events).toHaveLength(4)
    expect(events[0]!.type).toBe('start')
    expect(events[1]!.type).toBe('stdout')
    expect(events[2]!.type).toBe('stderr')
    expect(events[3]!.type).toBe('complete')
  })
})

// ===========================================================================
// 10. CONCURRENT & SEQUENTIAL OPERATIONS (4 tests)
// ===========================================================================

describe('Concurrent & sequential operations', () => {
  it('concurrent createSandbox calls produce separate fetch calls', async () => {
    let callNum = 0
    fetchResponder = () => {
      callNum++
      return sandboxOk(`sb_${callNum}`)
    }
    const client = createCodeClient({ apiKey: 'key' })
    const [sb1, sb2, sb3] = await Promise.all([client.createSandbox(), client.createSandbox(), client.createSandbox()])
    expect(fetchCalls).toHaveLength(3)
    // All should resolve to different sandbox IDs
    const ids = [sb1.id, sb2.id, sb3.id]
    expect(new Set(ids).size).toBe(3)
  })

  it('concurrent exec calls on same sandbox are all dispatched', async () => {
    fetchResponder = (_url, _method, body) => {
      const cmd = (body as { command: string })?.command ?? ''
      return execOk({ stdout: cmd, command: cmd })
    }
    const client = createCodeClient({ apiKey: 'key' })
    const results = await Promise.all([client.exec('sb_1', 'cmd1'), client.exec('sb_1', 'cmd2'), client.exec('sb_1', 'cmd3')])
    expect(fetchCalls).toHaveLength(3)
    expect(results[0]!.stdout).toBe('cmd1')
    expect(results[1]!.stdout).toBe('cmd2')
    expect(results[2]!.stdout).toBe('cmd3')
  })

  it('sequential operations reuse the same client instance', async () => {
    fetchResponder = () => sandboxOk('sb_seq')
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox()

    fetchResponder = () => execOk({ stdout: 'done' })
    await client.exec('sb_seq', 'echo done')

    fetchResponder = () => ok(null)
    await client.destroySandbox('sb_seq')

    expect(fetchCalls).toHaveLength(3)
    expect(fetchCalls[0]!.url).toContain('/sandbox')
    expect(fetchCalls[1]!.url).toContain('/exec')
    expect(fetchCalls[2]!.url).toContain('/sandbox/sb_seq')
  })

  it('concurrent file operations on different paths all succeed', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await Promise.all([client.writeFile('sb_1', '/a.txt', 'aaa'), client.writeFile('sb_1', '/b.txt', 'bbb'), client.writeFile('sb_1', '/c.txt', 'ccc')])
    expect(fetchCalls).toHaveLength(3)
    const paths = fetchCalls.map((c) => (c.body as { path: string }).path)
    expect(paths).toContain('/a.txt')
    expect(paths).toContain('/b.txt')
    expect(paths).toContain('/c.txt')
  })
})

// ===========================================================================
// 11. EDGE CASES & LARGE PAYLOADS (3 tests)
// ===========================================================================

describe('Edge cases & large payloads', () => {
  it('handles large file content in writeFile', async () => {
    fetchResponder = () => ok(null)
    const largeContent = 'x'.repeat(1_000_000) // 1MB
    const client = createCodeClient({ apiKey: 'key' })
    await client.writeFile('sb_1', '/large.bin', largeContent)
    expect((fetchCalls[0]!.body as { content: string }).content).toHaveLength(1_000_000)
  })

  it('handles long command strings in exec', async () => {
    fetchResponder = () => execOk({ stdout: 'ok' })
    const longCmd = 'echo ' + 'a'.repeat(100_000)
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exec('sb_1', longCmd)
    expect((fetchCalls[0]!.body as { command: string }).command).toHaveLength(longCmd.length)
    expect(result.stdout).toBe('ok')
  })

  it('handles special characters in file paths', async () => {
    fetchResponder = () => ok({ content: 'data' })
    const client = createCodeClient({ apiKey: 'key' })
    const content = await client.readFile('sb_1', '/path/with spaces/and-special_chars/file (1).txt')
    expect(content).toBe('data')
    expect((fetchCalls[0]!.body as { path: string }).path).toBe('/path/with spaces/and-special_chars/file (1).txt')
  })
})

// ===========================================================================
// 12. LANGUAGE SUPPORT IN runCode (5 tests)
// ===========================================================================

describe('Language support in runCode', () => {
  it('defaults to javascript when no language is specified', async () => {
    fetchResponder = () => codeOk({ language: 'javascript' })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'console.log(1)')
    expect(result.language).toBe('javascript')
  })

  it('sends language: typescript', async () => {
    fetchResponder = () => codeOk({ language: 'typescript' })
    const client = createCodeClient({ apiKey: 'key' })
    await client.runCode('sb_1', 'const x: number = 1', { language: 'typescript' })
    expect(fetchCalls[0]!.body).toMatchObject({ language: 'typescript' })
  })

  it('sends language: python', async () => {
    fetchResponder = () => codeOk({ language: 'python' })
    const client = createCodeClient({ apiKey: 'key' })
    await client.runCode('sb_1', 'print(42)', { language: 'python' })
    expect(fetchCalls[0]!.body).toMatchObject({ language: 'python' })
  })

  it('sends language: ruby', async () => {
    fetchResponder = () => codeOk({ language: 'ruby' })
    const client = createCodeClient({ apiKey: 'key' })
    await client.runCode('sb_1', 'puts 42', { language: 'ruby' })
    expect(fetchCalls[0]!.body).toMatchObject({ language: 'ruby' })
  })

  it('sends language: bash', async () => {
    fetchResponder = () => codeOk({ language: 'bash' })
    const client = createCodeClient({ apiKey: 'key' })
    await client.runCode('sb_1', 'echo 42', { language: 'bash' })
    expect(fetchCalls[0]!.body).toMatchObject({ language: 'bash' })
  })
})
