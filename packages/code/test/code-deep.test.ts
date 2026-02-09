import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createCodeClient } from '../src/client.js'
import { parseExecStream } from '../src/stream.js'

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

function sandboxResponse(id: string, status: 'running' | 'stopped' | 'error' = 'running') {
  return new Response(
    JSON.stringify({ success: true, data: { id, status, createdAt: '2025-01-01T00:00:00Z' } }),
    { status: 200 },
  )
}

function execResponse(opts: Partial<{ exitCode: number; stdout: string; stderr: string; command: string; duration: number }> = {}) {
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        success: (opts.exitCode ?? 0) === 0,
        exitCode: opts.exitCode ?? 0,
        stdout: opts.stdout ?? '',
        stderr: opts.stderr ?? '',
        command: opts.command ?? 'echo',
        duration: opts.duration ?? 5,
        timestamp: new Date().toISOString(),
      },
    }),
    { status: 200 },
  )
}

function codeResponse(opts: Partial<{ code: string; language: string; logs: string[]; error: string; results: unknown[]; duration: number }> = {}) {
  return new Response(
    JSON.stringify({
      success: true,
      data: {
        code: opts.code ?? '',
        language: opts.language ?? 'javascript',
        logs: opts.logs ?? [],
        error: opts.error,
        results: opts.results ?? [],
        duration: opts.duration ?? 5,
      },
    }),
    { status: 200 },
  )
}

// ---------------------------------------------------------------------------
// 1. Client Configuration (~5 tests)
// ---------------------------------------------------------------------------

describe('Client Configuration', () => {
  it('sends requests to the default endpoint when none specified', async () => {
    const client = createCodeClient()
    await client.createSandbox()
    expect(fetchCalls[0]!.url).toBe('https://code.headless.ly/sandbox')
  })

  it('sends requests to a custom endpoint when provided', async () => {
    const client = createCodeClient({ endpoint: 'http://localhost:9999' })
    await client.createSandbox()
    expect(fetchCalls[0]!.url).toBe('http://localhost:9999/sandbox')
  })

  it('includes API key as Bearer token in Authorization header', async () => {
    const client = createCodeClient({ apiKey: 'sk_test_deep' })
    await client.createSandbox()
    expect(fetchCalls[0]!.headers['Authorization']).toBe('Bearer sk_test_deep')
  })

  it('uses config.timeout as AbortController signal on fetch requests', async () => {
    // RED: The client accepts config.timeout but never creates an AbortController
    // or passes a signal to fetch. This test expects the signal to be present.
    const client = createCodeClient({ apiKey: 'key', timeout: 5000 })
    await client.createSandbox()
    expect(fetchCalls[0]!.signal).toBeDefined()
  })

  it('works without any config (no API key, no endpoint)', async () => {
    const client = createCodeClient()
    await client.createSandbox()
    expect(fetchCalls[0]!.headers['Authorization']).toBeUndefined()
    expect(fetchCalls[0]!.headers['Content-Type']).toBe('application/json')
  })
})

// ---------------------------------------------------------------------------
// 2. Code Execution (~8 tests)
// ---------------------------------------------------------------------------

describe('Code Execution — runCode', () => {
  it('runs JavaScript code and returns result', async () => {
    fetchResponder = () => codeResponse({ code: 'console.log("hi")', language: 'javascript', logs: ['hi'], results: [{ type: 'text', data: 'hi' }] })

    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'console.log("hi")', { language: 'javascript' })
    expect(result.language).toBe('javascript')
    expect(result.logs).toContain('hi')
    expect(result.results).toHaveLength(1)
  })

  it('runs TypeScript code with language option', async () => {
    fetchResponder = () => codeResponse({ language: 'typescript', logs: ['1'] })

    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'const x: number = 1; console.log(x)', { language: 'typescript' })
    expect(fetchCalls[0]!.body).toEqual(expect.objectContaining({ sandboxId: 'sb_1', language: 'typescript' }))
    expect(result.language).toBe('typescript')
  })

  it('runs Python code', async () => {
    fetchResponder = () => codeResponse({ language: 'python', logs: ['4'] })

    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'print(2 + 2)', { language: 'python' })
    expect(fetchCalls[0]!.body).toEqual(expect.objectContaining({ language: 'python' }))
    expect(result.language).toBe('python')
  })

  it('runs Ruby code', async () => {
    fetchResponder = () => codeResponse({ language: 'ruby', logs: ['hello'] })

    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'puts "hello"', { language: 'ruby' })
    expect(fetchCalls[0]!.body).toEqual(expect.objectContaining({ language: 'ruby' }))
    expect(result.language).toBe('ruby')
  })

  it('runs Bash scripts via exec', async () => {
    fetchResponder = () => execResponse({ stdout: 'hello from bash\n', exitCode: 0 })

    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exec('sb_1', 'echo "hello from bash"')
    expect(result.stdout).toBe('hello from bash\n')
    expect(result.exitCode).toBe(0)
  })

  it('returns error info when code has a syntax error', async () => {
    fetchResponder = () =>
      codeResponse({ error: 'SyntaxError: Unexpected end of input', results: [{ type: 'error', data: 'SyntaxError: Unexpected end of input' }] })

    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'const x = {', { language: 'javascript' })
    expect(result.error).toBeDefined()
    expect(result.error).toContain('SyntaxError')
  })

  it('throws when sandboxId is empty string', async () => {
    // RED: The client does not validate inputs. Empty sandboxId should throw
    // immediately rather than sending a request with an empty id.
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.runCode('', 'console.log(1)')).rejects.toThrow()
  })

  it('throws on HTTP error from runCode', async () => {
    fetchResponder = () => new Response('Internal Server Error', { status: 500 })

    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.runCode('sb_1', 'console.log(1)')).rejects.toThrow('500')
  })
})

// ---------------------------------------------------------------------------
// 3. Sandbox Lifecycle (~5 tests)
// ---------------------------------------------------------------------------

describe('Sandbox Lifecycle', () => {
  it('createSandbox returns a sandbox with id and status', async () => {
    fetchResponder = () => sandboxResponse('sb_abc123')

    const client = createCodeClient({ apiKey: 'key' })
    const sandbox = await client.createSandbox()
    expect(sandbox.id).toBe('sb_abc123')
    expect(sandbox.status).toBe('running')
    expect(sandbox.createdAt).toBeDefined()
  })

  it('getSandbox returns sandbox info for a valid id', async () => {
    fetchResponder = () => sandboxResponse('sb_xyz')

    const client = createCodeClient({ apiKey: 'key' })
    const sandbox = await client.getSandbox('sb_xyz')
    expect(sandbox).not.toBeNull()
    expect(sandbox!.id).toBe('sb_xyz')
    expect(fetchCalls[0]!.method).toBe('GET')
    expect(fetchCalls[0]!.url).toContain('/sandbox/sb_xyz')
  })

  it('destroySandbox calls DELETE on the correct path', async () => {
    fetchResponder = () => new Response(JSON.stringify({ success: true, data: null }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key' })
    await client.destroySandbox('sb_xyz')
    expect(fetchCalls[0]!.method).toBe('DELETE')
    expect(fetchCalls[0]!.url).toContain('/sandbox/sb_xyz')
  })

  it('operations on a destroyed sandbox throw an error', async () => {
    let callCount = 0
    fetchResponder = () => {
      callCount++
      if (callCount === 1) return new Response(JSON.stringify({ success: true, data: null }), { status: 200 })
      return new Response(JSON.stringify({ success: false, error: 'Sandbox not found' }), { status: 404 })
    }

    const client = createCodeClient({ apiKey: 'key' })
    await client.destroySandbox('sb_gone')
    await expect(client.exec('sb_gone', 'echo hi')).rejects.toThrow()
  })

  it('createSandbox passes custom options (id, timeout, env)', async () => {
    fetchResponder = () => sandboxResponse('sb_custom')

    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox({ id: 'sb_custom', timeout: 300, env: { NODE_ENV: 'test' } })
    expect(fetchCalls[0]!.body).toEqual(
      expect.objectContaining({ id: 'sb_custom', timeout: 300, env: { NODE_ENV: 'test' } }),
    )
  })
})

// ---------------------------------------------------------------------------
// 4. File Operations (~4 tests)
// ---------------------------------------------------------------------------

describe('File Operations', () => {
  it('writeFile sends POST /files/write with sandboxId, path, and content', async () => {
    fetchResponder = () => new Response(JSON.stringify({ success: true, data: null }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key' })
    await client.writeFile('sb_1', '/app/main.ts', 'export default 42')
    expect(fetchCalls[0]!.method).toBe('POST')
    expect(fetchCalls[0]!.url).toContain('/files/write')
    expect(fetchCalls[0]!.body).toEqual(
      expect.objectContaining({ sandboxId: 'sb_1', path: '/app/main.ts', content: 'export default 42' }),
    )
  })

  it('readFile sends POST /files/read and returns content string', async () => {
    fetchResponder = () =>
      new Response(JSON.stringify({ success: true, data: { content: 'file contents here' } }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key' })
    const content = await client.readFile('sb_1', '/app/main.ts')
    expect(content).toBe('file contents here')
  })

  it('listFiles returns array of FileInfo with correct types', async () => {
    fetchResponder = () =>
      new Response(
        JSON.stringify({
          success: true,
          data: {
            files: [
              { name: 'index.ts', absolutePath: '/app/index.ts', type: 'file', size: 128, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0644' },
              { name: 'lib', absolutePath: '/app/lib', type: 'directory', size: 0, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0755' },
            ],
          },
        }),
        { status: 200 },
      )

    const client = createCodeClient({ apiKey: 'key' })
    const files = await client.listFiles('sb_1', '/app')
    expect(files).toHaveLength(2)
    expect(files[0]!.type).toBe('file')
    expect(files[1]!.type).toBe('directory')
  })

  it('deleteFile sends POST /files/delete with sandboxId and path', async () => {
    fetchResponder = () => new Response(JSON.stringify({ success: true, data: null }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key' })
    await client.deleteFile('sb_1', '/app/temp.txt')
    expect(fetchCalls[0]!.method).toBe('POST')
    expect(fetchCalls[0]!.url).toContain('/files/delete')
    expect(fetchCalls[0]!.body).toEqual(expect.objectContaining({ sandboxId: 'sb_1', path: '/app/temp.txt' }))
  })
})

// ---------------------------------------------------------------------------
// 5. Streaming (~3 tests)
// ---------------------------------------------------------------------------

describe('Streaming Execution', () => {
  it('execStream returns an async iterable of ExecEvents', async () => {
    fetchResponder = () =>
      sseResponse(
        'data: {"type":"start","command":"ls","timestamp":"2025-01-01T00:00:00Z"}\n\n',
        'data: {"type":"stdout","data":"file.txt"}\n\n',
        'data: {"type":"complete","exitCode":0,"duration":10}\n\n',
      )

    const client = createCodeClient({ apiKey: 'key' })
    const events: unknown[] = []
    for await (const event of await client.execStream('sb_1', 'ls')) {
      events.push(event)
    }

    expect(events).toHaveLength(3)
    expect(events[0]).toEqual(expect.objectContaining({ type: 'start' }))
    expect(events[1]).toEqual(expect.objectContaining({ type: 'stdout', data: 'file.txt' }))
    expect(events[2]).toEqual(expect.objectContaining({ type: 'complete', exitCode: 0 }))
  })

  it('stream includes stdout chunks in order', async () => {
    fetchResponder = () =>
      sseResponse(
        'data: {"type":"stdout","data":"line1"}\n\n',
        'data: {"type":"stdout","data":"line2"}\n\n',
        'data: {"type":"stdout","data":"line3"}\n\n',
      )

    const client = createCodeClient({ apiKey: 'key' })
    const stdoutChunks: string[] = []
    for await (const event of await client.execStream('sb_1', 'cat file.txt')) {
      if (event.type === 'stdout') stdoutChunks.push(event.data)
    }
    expect(stdoutChunks).toEqual(['line1', 'line2', 'line3'])
  })

  it('stream includes exit code in complete event', async () => {
    fetchResponder = () =>
      sseResponse(
        'data: {"type":"stdout","data":"output"}\n\n',
        'data: {"type":"complete","exitCode":1,"duration":50}\n\n',
      )

    const client = createCodeClient({ apiKey: 'key' })
    let exitCode: number | undefined
    for await (const event of await client.execStream('sb_1', 'false')) {
      if (event.type === 'complete') exitCode = event.exitCode
    }
    expect(exitCode).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 6. Error Handling & Input Validation (~7 RED tests)
// ---------------------------------------------------------------------------

describe('Error Handling', () => {
  it('throws when API returns success: false', async () => {
    fetchResponder = () =>
      new Response(JSON.stringify({ success: false, error: 'Sandbox limit exceeded' }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.createSandbox()).rejects.toThrow('Sandbox limit exceeded')
  })

  it('exec passes ExecOptions (cwd, env, stdin) in request body', async () => {
    fetchResponder = () => execResponse({})

    const client = createCodeClient({ apiKey: 'key' })
    await client.exec('sb_1', 'pwd', { cwd: '/app', env: { FOO: 'bar' }, stdin: 'input data' })
    expect(fetchCalls[0]!.body).toEqual(
      expect.objectContaining({ sandboxId: 'sb_1', command: 'pwd', cwd: '/app', env: { FOO: 'bar' }, stdin: 'input data' }),
    )
  })

  it('throws when exec command is empty string', async () => {
    // RED: The client does not validate that command is non-empty.
    const client = createCodeClient({ apiKey: 'key' })
    await expect(client.exec('sb_1', '')).rejects.toThrow()
  })

  it('writeFile includes permissions option in request body', async () => {
    fetchResponder = () => new Response(JSON.stringify({ success: true, data: null }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key' })
    await client.writeFile('sb_1', '/app/run.sh', '#!/bin/bash', { permissions: '0755' })
    expect(fetchCalls[0]!.body).toEqual(
      expect.objectContaining({ permissions: '0755' }),
    )
  })

  it('readFile includes encoding option in request body', async () => {
    fetchResponder = () =>
      new Response(JSON.stringify({ success: true, data: { content: 'binary' } }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key' })
    await client.readFile('sb_1', '/app/data.bin', { encoding: 'base64' })
    expect(fetchCalls[0]!.body).toEqual(expect.objectContaining({ encoding: 'base64' }))
  })

  it('runCode with env variables includes them in the request body', async () => {
    fetchResponder = () => codeResponse({})

    const client = createCodeClient({ apiKey: 'key' })
    await client.runCode('sb_1', 'console.log(process.env.SECRET)', { env: { SECRET: '42' } })
    expect(fetchCalls[0]!.body).toEqual(expect.objectContaining({ env: { SECRET: '42' } }))
  })

  it('execStream throws when response is not ok', async () => {
    fetchResponder = () => new Response('Unauthorized', { status: 401 })

    const client = createCodeClient({ apiKey: 'bad_key' })
    await expect(client.execStream('sb_1', 'ls')).rejects.toThrow('401')
  })

  it('uses AbortSignal for timeout on streaming requests', async () => {
    // RED: execStream does not pass AbortController signal from config.timeout
    fetchResponder = () => sseResponse('data: {"type":"stdout","data":"ok"}\n\n')

    const client = createCodeClient({ apiKey: 'key', timeout: 3000 })
    await client.execStream('sb_1', 'long-running-cmd')
    expect(fetchCalls[0]!.signal).toBeDefined()
  })

  it('exists returns false when server returns success:false', async () => {
    fetchResponder = () =>
      new Response(JSON.stringify({ success: false, error: 'not found' }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exists('sb_1', '/nonexistent')
    expect(result).toBe(false)
  })
})
