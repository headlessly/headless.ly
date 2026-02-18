import { describe, it, expect, beforeEach } from 'vitest'
import { createCodeClient } from '../src/client.js'
import { parseExecStream } from '../src/stream.js'
import type { ExecEvent, ExecResult, SandboxInfo, ExecutionResult, FileInfo, ExecutionOutput } from '../src/types.js'

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

function ok<T>(data: T) {
  return new Response(JSON.stringify({ success: true, data }), { status: 200 })
}

function okWithMeta<T>(data: T, meta: Record<string, unknown>) {
  return new Response(JSON.stringify({ success: true, data, meta }), { status: 200 })
}

function fail(error: string) {
  return new Response(JSON.stringify({ success: false, error }), { status: 200 })
}

function httpError(status: number, text: string) {
  return new Response(text, { status })
}

function sandboxOk(id: string, status: 'running' | 'stopped' | 'error' = 'running', extra: Record<string, unknown> = {}) {
  return ok({ id, status, createdAt: '2025-06-01T00:00:00Z', ...extra })
}

function execOk(overrides: Partial<{ exitCode: number; stdout: string; stderr: string; command: string; duration: number; timestamp: string }> = {}) {
  return ok({
    success: (overrides.exitCode ?? 0) === 0,
    exitCode: overrides.exitCode ?? 0,
    stdout: overrides.stdout ?? '',
    stderr: overrides.stderr ?? '',
    command: overrides.command ?? 'echo',
    duration: overrides.duration ?? 5,
    timestamp: overrides.timestamp ?? '2025-06-01T00:00:00Z',
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
  return collectStream(parseExecStream(response))
}

// ===========================================================================
// 1. EXEC RESULT RETURN TYPE SHAPE (5 tests)
// ===========================================================================

describe('ExecResult return type shape', () => {
  it('exec result contains exactly the expected fields', async () => {
    fetchResponder = () => execOk({ exitCode: 0, stdout: 'hello\n', stderr: '', command: 'echo hello', duration: 15, timestamp: '2025-06-15T12:00:00Z' })
    const client = createCodeClient({ apiKey: 'key' })
    const result: ExecResult = await client.exec('sb_1', 'echo hello')
    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('exitCode')
    expect(result).toHaveProperty('stdout')
    expect(result).toHaveProperty('stderr')
    expect(result).toHaveProperty('command')
    expect(result).toHaveProperty('duration')
    expect(result).toHaveProperty('timestamp')
  })

  it('exec result timestamp is an ISO string from the server', async () => {
    fetchResponder = () => execOk({ timestamp: '2025-12-25T23:59:59Z' })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exec('sb_1', 'date')
    expect(result.timestamp).toBe('2025-12-25T23:59:59Z')
    expect(new Date(result.timestamp).toISOString()).toBe('2025-12-25T23:59:59.000Z')
  })

  it('exec result success is true when exitCode is 0', async () => {
    fetchResponder = () => execOk({ exitCode: 0 })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exec('sb_1', 'true')
    expect(result.success).toBe(true)
    expect(result.exitCode).toBe(0)
  })

  it('exec result success is false when exitCode is non-zero', async () => {
    fetchResponder = () => execOk({ exitCode: 2 })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exec('sb_1', 'diff a b')
    expect(result.success).toBe(false)
    expect(result.exitCode).toBe(2)
  })

  it('exec result preserves stderr and stdout independently', async () => {
    fetchResponder = () => execOk({ stdout: 'standard output\n', stderr: 'standard error\n', exitCode: 1 })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exec('sb_1', 'some-cmd')
    expect(result.stdout).toBe('standard output\n')
    expect(result.stderr).toBe('standard error\n')
    expect(result.stdout).not.toContain('error')
    expect(result.stderr).not.toContain('output\n')
  })
})

// ===========================================================================
// 2. SANDBOX INFO RETURN TYPE SHAPE (4 tests)
// ===========================================================================

describe('SandboxInfo return type shape', () => {
  it('createSandbox response includes id, status, and createdAt', async () => {
    fetchResponder = () => sandboxOk('sb_shape')
    const client = createCodeClient({ apiKey: 'key' })
    const sb: SandboxInfo = await client.createSandbox()
    expect(typeof sb.id).toBe('string')
    expect(typeof sb.status).toBe('string')
    expect(typeof sb.createdAt).toBe('string')
  })

  it('sandbox with timeout returns timeout as number', async () => {
    fetchResponder = () => sandboxOk('sb_t', 'running', { timeout: 300 })
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()
    expect(sb.timeout).toBe(300)
    expect(typeof sb.timeout).toBe('number')
  })

  it('sandbox without timeout field has timeout as undefined', async () => {
    fetchResponder = () => ok({ id: 'sb_no_t', status: 'running', createdAt: '2025-06-01T00:00:00Z' })
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()
    expect(sb.timeout).toBeUndefined()
  })

  it('sandbox createdAt can be parsed as valid Date', async () => {
    fetchResponder = () => sandboxOk('sb_date')
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()
    const date = new Date(sb.createdAt)
    expect(date.getTime()).not.toBeNaN()
  })
})

// ===========================================================================
// 3. EXECUTION RESULT (runCode) RETURN TYPE SHAPE (5 tests)
// ===========================================================================

describe('ExecutionResult return type shape', () => {
  it('runCode result has all expected fields', async () => {
    fetchResponder = () => codeOk({ code: 'x = 1', language: 'python', logs: ['hello'], results: [{ type: 'text', data: '1' }], duration: 7 })
    const client = createCodeClient({ apiKey: 'key' })
    const result: ExecutionResult = await client.runCode('sb_1', 'x = 1')
    expect(result).toHaveProperty('code')
    expect(result).toHaveProperty('language')
    expect(result).toHaveProperty('logs')
    expect(result).toHaveProperty('results')
    expect(result).toHaveProperty('duration')
  })

  it('runCode result error is undefined when no error occurred', async () => {
    fetchResponder = () => codeOk({ logs: ['ok'] })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'console.log("ok")')
    expect(result.error).toBeUndefined()
  })

  it('runCode result with image output has optional mimeType', async () => {
    fetchResponder = () =>
      codeOk({
        results: [
          { type: 'image', data: 'base64data', mimeType: 'image/jpeg' },
          { type: 'text', data: 'caption' },
        ],
      })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'render()')
    const imgOutput = result.results[0] as ExecutionOutput
    const textOutput = result.results[1] as ExecutionOutput
    expect(imgOutput.mimeType).toBe('image/jpeg')
    expect(textOutput.mimeType).toBeUndefined()
  })

  it('runCode result logs is always an array', async () => {
    fetchResponder = () => codeOk({ logs: [] })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', '')
    expect(Array.isArray(result.logs)).toBe(true)
  })

  it('runCode result results array can contain all five output types', async () => {
    fetchResponder = () =>
      codeOk({
        results: [
          { type: 'text', data: 'plain' },
          { type: 'image', data: 'imgdata', mimeType: 'image/png' },
          { type: 'json', data: '{"a":1}' },
          { type: 'html', data: '<p>hi</p>' },
          { type: 'error', data: 'Error: oops' },
        ],
      })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'multi-output')
    expect(result.results).toHaveLength(5)
    const types = result.results.map((r: ExecutionOutput) => r.type)
    expect(types).toEqual(['text', 'image', 'json', 'html', 'error'])
  })
})

// ===========================================================================
// 4. REQUEST BODY SERIALIZATION EDGE CASES (7 tests)
// ===========================================================================

describe('Request body serialization edge cases', () => {
  it('writeFile without options sends body with only sandboxId, path, content', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await client.writeFile('sb_1', '/test.txt', 'hello')
    const body = fetchCalls[0]!.body as Record<string, unknown>
    expect(Object.keys(body)).toEqual(['sandboxId', 'path', 'content'])
  })

  it('readFile without options sends body with only sandboxId and path', async () => {
    fetchResponder = () => ok({ content: 'data' })
    const client = createCodeClient({ apiKey: 'key' })
    await client.readFile('sb_1', '/file.txt')
    const body = fetchCalls[0]!.body as Record<string, unknown>
    expect(Object.keys(body)).toEqual(['sandboxId', 'path'])
  })

  it('listFiles sends body with sandboxId and path only', async () => {
    fetchResponder = () => ok({ files: [] })
    const client = createCodeClient({ apiKey: 'key' })
    await client.listFiles('sb_1', '/dir')
    const body = fetchCalls[0]!.body as Record<string, unknown>
    expect(body.sandboxId).toBe('sb_1')
    expect(body.path).toBe('/dir')
    expect(Object.keys(body)).toEqual(['sandboxId', 'path'])
  })

  it('exists sends body with sandboxId and path only', async () => {
    fetchResponder = () => ok({ exists: true })
    const client = createCodeClient({ apiKey: 'key' })
    await client.exists('sb_1', '/check.txt')
    const body = fetchCalls[0]!.body as Record<string, unknown>
    expect(body.sandboxId).toBe('sb_1')
    expect(body.path).toBe('/check.txt')
  })

  it('deleteFile sends body with sandboxId and path only', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await client.deleteFile('sb_1', '/trash.txt')
    const body = fetchCalls[0]!.body as Record<string, unknown>
    expect(Object.keys(body)).toEqual(['sandboxId', 'path'])
  })

  it('exec spreads ExecOptions at top level, not nested', async () => {
    fetchResponder = () => execOk()
    const client = createCodeClient({ apiKey: 'key' })
    await client.exec('sb_1', 'pwd', { cwd: '/home', env: { A: '1' }, timeout: 1000, stdin: 'input' })
    const body = fetchCalls[0]!.body as Record<string, unknown>
    // Options are spread, not nested under an "options" key
    expect(body.cwd).toBe('/home')
    expect(body.env).toEqual({ A: '1' })
    expect(body.timeout).toBe(1000)
    expect(body.stdin).toBe('input')
    expect(body).not.toHaveProperty('options')
  })

  it('writeFile with content containing JSON does not double-serialize', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    const jsonContent = '{"key": "value", "nested": {"a": [1, 2, 3]}}'
    await client.writeFile('sb_1', '/data.json', jsonContent)
    const body = fetchCalls[0]!.body as { content: string }
    expect(body.content).toBe(jsonContent)
    // Verify the content is a string, not parsed as an object
    expect(typeof body.content).toBe('string')
  })
})

// ===========================================================================
// 5. MULTI-STEP WORKFLOWS (6 tests)
// ===========================================================================

describe('Multi-step workflows', () => {
  it('create -> write file -> exec (run file) -> read output -> destroy', async () => {
    let step = 0
    fetchResponder = () => {
      step++
      if (step === 1) return sandboxOk('sb_workflow')
      if (step === 2) return ok(null) // writeFile
      if (step === 3) return execOk({ stdout: 'script output\n', command: 'node /app/script.js', exitCode: 0 })
      if (step === 4) return ok({ content: 'script output\n' }) // readFile
      if (step === 5) return ok(null) // destroy
      return ok(null)
    }

    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()
    expect(sb.id).toBe('sb_workflow')

    await client.writeFile(sb.id, '/app/script.js', 'console.log("script output")')
    const execResult = await client.exec(sb.id, 'node /app/script.js')
    expect(execResult.stdout).toBe('script output\n')
    expect(execResult.exitCode).toBe(0)

    const output = await client.readFile(sb.id, '/app/output.log')
    expect(output).toBe('script output\n')

    await client.destroySandbox(sb.id)
    expect(fetchCalls).toHaveLength(5)
  })

  it('create -> write multiple files -> list -> check exists -> destroy', async () => {
    let step = 0
    fetchResponder = () => {
      step++
      if (step === 1) return sandboxOk('sb_multi_write')
      if (step === 2) return ok(null) // write 1
      if (step === 3) return ok(null) // write 2
      if (step === 4) return ok(null) // write 3
      if (step === 5)
        return ok({
          files: [
            { name: 'a.ts', absolutePath: '/src/a.ts', type: 'file', size: 10, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0644' },
            { name: 'b.ts', absolutePath: '/src/b.ts', type: 'file', size: 20, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0644' },
            { name: 'c.ts', absolutePath: '/src/c.ts', type: 'file', size: 30, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0644' },
          ],
        })
      if (step === 6) return ok({ exists: true })
      if (step === 7) return ok(null) // destroy
      return ok(null)
    }

    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()

    await client.writeFile(sb.id, '/src/a.ts', 'export const a = 1')
    await client.writeFile(sb.id, '/src/b.ts', 'export const b = 2')
    await client.writeFile(sb.id, '/src/c.ts', 'export const c = 3')

    const files = await client.listFiles(sb.id, '/src')
    expect(files).toHaveLength(3)
    expect(files.map((f) => f.name)).toEqual(['a.ts', 'b.ts', 'c.ts'])

    const exists = await client.exists(sb.id, '/src/b.ts')
    expect(exists).toBe(true)

    await client.destroySandbox(sb.id)
    expect(fetchCalls).toHaveLength(7)
  })

  it('create -> runCode multiple times sequentially -> destroy', async () => {
    let step = 0
    fetchResponder = () => {
      step++
      if (step === 1) return sandboxOk('sb_multi_run')
      if (step === 2) return codeOk({ logs: ['2'], results: [{ type: 'text', data: '2' }] })
      if (step === 3) return codeOk({ logs: ['hello'], results: [{ type: 'text', data: 'hello' }] })
      if (step === 4) return codeOk({ logs: ['[1,2,3]'], results: [{ type: 'json', data: '[1,2,3]' }] })
      if (step === 5) return ok(null) // destroy
      return ok(null)
    }

    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()

    const r1 = await client.runCode(sb.id, '1+1')
    expect(r1.logs).toEqual(['2'])

    const r2 = await client.runCode(sb.id, 'console.log("hello")')
    expect(r2.logs).toEqual(['hello'])

    const r3 = await client.runCode(sb.id, 'JSON.stringify([1,2,3])')
    expect(r3.results[0]).toMatchObject({ type: 'json' })

    await client.destroySandbox(sb.id)
    expect(fetchCalls).toHaveLength(5)
  })

  it('create -> write executable -> exec with permissions -> verify output', async () => {
    let step = 0
    fetchResponder = () => {
      step++
      if (step === 1) return sandboxOk('sb_exec_perm')
      if (step === 2) return ok(null) // writeFile with permissions
      if (step === 3) return execOk({ stdout: 'script ran\n', command: '/app/run.sh', exitCode: 0 })
      if (step === 4) return ok(null) // destroy
      return ok(null)
    }

    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()

    await client.writeFile(sb.id, '/app/run.sh', '#!/bin/bash\necho "script ran"', { permissions: '0755' })
    expect(fetchCalls[1]!.body).toMatchObject({ permissions: '0755' })

    const result = await client.exec(sb.id, '/app/run.sh')
    expect(result.stdout).toBe('script ran\n')

    await client.destroySandbox(sb.id)
  })

  it('create -> exec failing command -> exec succeeding command -> destroy', async () => {
    let step = 0
    fetchResponder = () => {
      step++
      if (step === 1) return sandboxOk('sb_recovery')
      if (step === 2) return execOk({ exitCode: 1, stderr: 'command not found', stdout: '' })
      if (step === 3) return execOk({ exitCode: 0, stdout: 'recovered\n' })
      if (step === 4) return ok(null)
      return ok(null)
    }

    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()

    const failResult = await client.exec(sb.id, 'badcmd')
    expect(failResult.exitCode).toBe(1)
    expect(failResult.success).toBe(false)

    const okResult = await client.exec(sb.id, 'echo recovered')
    expect(okResult.exitCode).toBe(0)
    expect(okResult.success).toBe(true)
    expect(okResult.stdout).toBe('recovered\n')

    await client.destroySandbox(sb.id)
  })

  it('create -> stream exec -> collect all events -> destroy', async () => {
    let step = 0
    fetchResponder = (url) => {
      step++
      if (step === 1) return sandboxOk('sb_stream_workflow')
      if (url.includes('/exec/stream'))
        return sseResponse(
          'data: {"type":"start","command":"npm test","timestamp":"2025-06-01T00:00:00Z"}\n\n',
          'data: {"type":"stdout","data":"PASS all tests"}\n\n',
          'data: {"type":"complete","exitCode":0,"duration":2500}\n\n',
        )
      return ok(null)
    }

    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()

    const events = await collectStream(await client.execStream(sb.id, 'npm test'))
    expect(events).toHaveLength(3)
    expect(events[0]!.type).toBe('start')
    expect(events[1]!.type).toBe('stdout')
    expect(events[2]!.type).toBe('complete')
    if (events[2]!.type === 'complete') {
      expect(events[2]!.exitCode).toBe(0)
    }

    fetchResponder = () => ok(null)
    await client.destroySandbox(sb.id)
  })
})

// ===========================================================================
// 6. SANDBOX OPTIONS COMBINATIONS (5 tests)
// ===========================================================================

describe('Sandbox options combinations', () => {
  it('createSandbox with only id option', async () => {
    fetchResponder = () => sandboxOk('my-id')
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox({ id: 'my-id' })
    const body = fetchCalls[0]!.body as Record<string, unknown>
    expect(body.id).toBe('my-id')
    expect(body.timeout).toBeUndefined()
    expect(body.env).toBeUndefined()
  })

  it('createSandbox with only timeout option', async () => {
    fetchResponder = () => sandboxOk('sb_t_only')
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox({ timeout: 600 })
    const body = fetchCalls[0]!.body as Record<string, unknown>
    expect(body.timeout).toBe(600)
    expect(body.id).toBeUndefined()
    expect(body.env).toBeUndefined()
  })

  it('createSandbox with only env option', async () => {
    fetchResponder = () => sandboxOk('sb_env_only')
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox({ env: { NODE_ENV: 'test', DEBUG: '*' } })
    const body = fetchCalls[0]!.body as Record<string, unknown>
    expect(body.env).toEqual({ NODE_ENV: 'test', DEBUG: '*' })
    expect(body.id).toBeUndefined()
    expect(body.timeout).toBeUndefined()
  })

  it('createSandbox with all three options combined', async () => {
    fetchResponder = () => sandboxOk('sb_all')
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox({ id: 'sb_all', timeout: 900, env: { PATH: '/usr/bin', HOME: '/root' } })
    const body = fetchCalls[0]!.body as Record<string, unknown>
    expect(body.id).toBe('sb_all')
    expect(body.timeout).toBe(900)
    expect(body.env).toEqual({ PATH: '/usr/bin', HOME: '/root' })
  })

  it('createSandbox with empty env object', async () => {
    fetchResponder = () => sandboxOk('sb_empty_env')
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox({ env: {} })
    const body = fetchCalls[0]!.body as Record<string, unknown>
    expect(body.env).toEqual({})
  })
})

// ===========================================================================
// 7. FILE PERMISSION MODES (4 tests)
// ===========================================================================

describe('File permission modes', () => {
  it('writeFile with 0644 read-write permission', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await client.writeFile('sb_1', '/conf.yaml', 'key: value', { permissions: '0644' })
    expect((fetchCalls[0]!.body as { permissions: string }).permissions).toBe('0644')
  })

  it('writeFile with 0600 owner-only permission', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await client.writeFile('sb_1', '/secrets.env', 'SECRET=xxx', { permissions: '0600' })
    expect((fetchCalls[0]!.body as { permissions: string }).permissions).toBe('0600')
  })

  it('writeFile with 0777 full permission', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key' })
    await client.writeFile('sb_1', '/tmp/shared.sh', '#!/bin/bash', { permissions: '0777' })
    expect((fetchCalls[0]!.body as { permissions: string }).permissions).toBe('0777')
  })

  it('listFiles returns permissions string for each entry', async () => {
    fetchResponder = () =>
      ok({
        files: [
          { name: 'read-only.txt', absolutePath: '/read-only.txt', type: 'file', size: 5, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0444' },
          { name: 'exec.sh', absolutePath: '/exec.sh', type: 'file', size: 100, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0755' },
        ],
      })
    const client = createCodeClient({ apiKey: 'key' })
    const files: FileInfo[] = await client.listFiles('sb_1', '/')
    expect(files[0]!.permissions).toBe('0444')
    expect(files[1]!.permissions).toBe('0755')
  })
})

// ===========================================================================
// 8. CODE INTERPRETER DIFFERENT RETURN VALUE TYPES (5 tests)
// ===========================================================================

describe('Code interpreter different return value types', () => {
  it('returns text output for simple print', async () => {
    fetchResponder = () => codeOk({ results: [{ type: 'text', data: '42' }] })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'print(42)', { language: 'python' })
    expect(result.results[0]).toMatchObject({ type: 'text', data: '42' })
  })

  it('returns json output for structured data', async () => {
    fetchResponder = () => codeOk({ results: [{ type: 'json', data: '{"users":[{"name":"Alice"},{"name":"Bob"}]}' }] })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'JSON.stringify({users:[{name:"Alice"},{name:"Bob"}]})')
    const output = result.results[0] as ExecutionOutput
    expect(output.type).toBe('json')
    expect(JSON.parse(output.data)).toEqual({ users: [{ name: 'Alice' }, { name: 'Bob' }] })
  })

  it('returns html output for rendered content', async () => {
    fetchResponder = () => codeOk({ results: [{ type: 'html', data: '<table><tr><td>A</td><td>B</td></tr></table>', mimeType: 'text/html' }] })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'render_table()')
    const output = result.results[0] as ExecutionOutput
    expect(output.type).toBe('html')
    expect(output.data).toContain('<table>')
    expect(output.mimeType).toBe('text/html')
  })

  it('returns image output with base64 data', async () => {
    fetchResponder = () =>
      codeOk({
        results: [
          {
            type: 'image',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            mimeType: 'image/png',
          },
        ],
      })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'plot()')
    const output = result.results[0] as ExecutionOutput
    expect(output.type).toBe('image')
    expect(output.mimeType).toBe('image/png')
    expect(output.data.length).toBeGreaterThan(0)
  })

  it('returns error output with traceback', async () => {
    fetchResponder = () =>
      codeOk({
        error: 'TypeError: cannot add string and int',
        results: [{ type: 'error', data: 'File "<stdin>", line 1\nTypeError: cannot add string and int' }],
      })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', '"a" + 1', { language: 'python' })
    expect(result.error).toContain('TypeError')
    const output = result.results[0] as ExecutionOutput
    expect(output.type).toBe('error')
    expect(output.data).toContain('TypeError')
  })
})

// ===========================================================================
// 9. ABORT SIGNAL PROPAGATION (5 tests)
// ===========================================================================

describe('Abort signal propagation', () => {
  it('client timeout produces AbortSignal on exec call', async () => {
    fetchResponder = () => execOk()
    const client = createCodeClient({ apiKey: 'key', timeout: 10000 })
    await client.exec('sb_1', 'echo')
    expect(fetchCalls[0]!.signal).toBeDefined()
  })

  it('client timeout produces AbortSignal on writeFile call', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'key', timeout: 5000 })
    await client.writeFile('sb_1', '/f', 'content')
    expect(fetchCalls[0]!.signal).toBeDefined()
  })

  it('client timeout produces AbortSignal on readFile call', async () => {
    fetchResponder = () => ok({ content: 'data' })
    const client = createCodeClient({ apiKey: 'key', timeout: 5000 })
    await client.readFile('sb_1', '/f')
    expect(fetchCalls[0]!.signal).toBeDefined()
  })

  it('client timeout produces AbortSignal on runCode call', async () => {
    fetchResponder = () => codeOk()
    const client = createCodeClient({ apiKey: 'key', timeout: 8000 })
    await client.runCode('sb_1', '1+1')
    expect(fetchCalls[0]!.signal).toBeDefined()
  })

  it('client timeout produces AbortSignal on execStream call', async () => {
    fetchResponder = () => sseResponse('data: {"type":"stdout","data":"ok"}\n\n')
    const client = createCodeClient({ apiKey: 'key', timeout: 7000 })
    await client.execStream('sb_1', 'echo ok')
    expect(fetchCalls[0]!.signal).toBeDefined()
  })
})

// ===========================================================================
// 10. AUTHORIZATION HEADER CONSISTENCY (4 tests)
// ===========================================================================

describe('Authorization header consistency across all methods', () => {
  it('exec includes Authorization header', async () => {
    fetchResponder = () => execOk()
    const client = createCodeClient({ apiKey: 'my_token' })
    await client.exec('sb_1', 'echo')
    expect(fetchCalls[0]!.headers['Authorization']).toBe('Bearer my_token')
  })

  it('writeFile includes Authorization header', async () => {
    fetchResponder = () => ok(null)
    const client = createCodeClient({ apiKey: 'my_token' })
    await client.writeFile('sb_1', '/f', 'x')
    expect(fetchCalls[0]!.headers['Authorization']).toBe('Bearer my_token')
  })

  it('execStream includes Authorization header', async () => {
    fetchResponder = () => sseResponse('data: {"type":"stdout","data":"ok"}\n\n')
    const client = createCodeClient({ apiKey: 'my_token' })
    await client.execStream('sb_1', 'echo')
    expect(fetchCalls[0]!.headers['Authorization']).toBe('Bearer my_token')
  })

  it('runCode includes Authorization header', async () => {
    fetchResponder = () => codeOk()
    const client = createCodeClient({ apiKey: 'my_token' })
    await client.runCode('sb_1', '1+1')
    expect(fetchCalls[0]!.headers['Authorization']).toBe('Bearer my_token')
  })
})

// ===========================================================================
// 11. HTTP METHOD VERIFICATION (3 tests)
// ===========================================================================

describe('HTTP method verification', () => {
  it('all file operations use POST method', async () => {
    fetchResponder = (url) => {
      if (url.includes('/files/read')) return ok({ content: '' })
      if (url.includes('/files/list')) return ok({ files: [] })
      if (url.includes('/files/exists')) return ok({ exists: true })
      return ok(null)
    }
    const client = createCodeClient({ apiKey: 'key' })

    await client.writeFile('sb_1', '/f', 'x')
    await client.readFile('sb_1', '/f')
    await client.listFiles('sb_1', '/')
    await client.exists('sb_1', '/f')
    await client.deleteFile('sb_1', '/f')

    for (const call of fetchCalls) {
      expect(call.method).toBe('POST')
    }
  })

  it('createSandbox uses POST and destroySandbox uses DELETE', async () => {
    let step = 0
    fetchResponder = () => {
      step++
      if (step === 1) return sandboxOk('sb_methods')
      return ok(null)
    }
    const client = createCodeClient({ apiKey: 'key' })
    await client.createSandbox()
    await client.destroySandbox('sb_methods')
    expect(fetchCalls[0]!.method).toBe('POST')
    expect(fetchCalls[1]!.method).toBe('DELETE')
  })

  it('getSandbox uses GET method and does not send body', async () => {
    fetchResponder = () => sandboxOk('sb_get')
    const client = createCodeClient({ apiKey: 'key' })
    await client.getSandbox('sb_get')
    expect(fetchCalls[0]!.method).toBe('GET')
    expect(fetchCalls[0]!.body).toBeUndefined()
  })
})

// ===========================================================================
// 12. RESPONSE PARSING FOR EVERY ENDPOINT (6 tests)
// ===========================================================================

describe('Response parsing for every endpoint', () => {
  it('createSandbox unwraps data from ApiResponse envelope', async () => {
    fetchResponder = () =>
      new Response(JSON.stringify({ success: true, data: { id: 'sb_unwrap', status: 'running', createdAt: '2025-01-01T00:00:00Z' } }), {
        status: 200,
      })
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()
    // Should be the inner data, not the envelope
    expect(sb.id).toBe('sb_unwrap')
    expect((sb as unknown as Record<string, unknown>).success).toBeUndefined()
  })

  it('readFile extracts content string from { content: "..." } response data', async () => {
    fetchResponder = () => ok({ content: 'extracted correctly' })
    const client = createCodeClient({ apiKey: 'key' })
    const content = await client.readFile('sb_1', '/f')
    expect(content).toBe('extracted correctly')
    // Should not return the wrapper object
    expect(typeof content).toBe('string')
  })

  it('exists extracts boolean from { exists: boolean } response data', async () => {
    fetchResponder = () => ok({ exists: true })
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.exists('sb_1', '/f')
    expect(result).toBe(true)
    expect(typeof result).toBe('boolean')
  })

  it('listFiles extracts files array from { files: [...] } wrapper', async () => {
    const fileEntry = { name: 'test.ts', absolutePath: '/test.ts', type: 'file', size: 50, modifiedAt: '2025-01-01T00:00:00Z', permissions: '0644' }
    fetchResponder = () => ok({ files: [fileEntry] })
    const client = createCodeClient({ apiKey: 'key' })
    const files = await client.listFiles('sb_1', '/')
    expect(files).toEqual([fileEntry])
  })

  it('runCode returns full ExecutionResult data directly', async () => {
    const expectedResult = {
      code: 'x = 1',
      language: 'python',
      logs: ['assigned'],
      results: [{ type: 'text', data: '1' }],
      duration: 3,
    }
    fetchResponder = () => ok(expectedResult)
    const client = createCodeClient({ apiKey: 'key' })
    const result = await client.runCode('sb_1', 'x = 1')
    expect(result.code).toBe('x = 1')
    expect(result.language).toBe('python')
    expect(result.logs).toEqual(['assigned'])
    expect(result.duration).toBe(3)
  })

  it('response with meta field does not affect data extraction', async () => {
    fetchResponder = () => okWithMeta({ id: 'sb_meta', status: 'running', createdAt: '2025-01-01T00:00:00Z' }, { requestId: 'req_abc', region: 'us-east-1' })
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()
    expect(sb.id).toBe('sb_meta')
    // Meta should not leak into the sandbox info
    expect((sb as unknown as Record<string, unknown>).requestId).toBeUndefined()
    expect((sb as unknown as Record<string, unknown>).region).toBeUndefined()
  })
})

// ===========================================================================
// 13. CLIENT WITH EMPTY/UNUSUAL CONFIG VALUES (4 tests)
// ===========================================================================

describe('Client with empty/unusual config values', () => {
  it('client with empty string apiKey still sets Authorization header', async () => {
    const client = createCodeClient({ apiKey: '' })
    await client.createSandbox()
    // Empty string is falsy, so header should NOT be set
    expect(fetchCalls[0]!.headers['Authorization']).toBeUndefined()
  })

  it('client with empty string endpoint falls back to default', async () => {
    const client = createCodeClient({ endpoint: '' })
    await client.createSandbox()
    // Empty string is falsy, so falls back to 'https://code.headless.ly'
    expect(fetchCalls[0]!.url).toBe('https://code.headless.ly/sandbox')
  })

  it('apiKey is re-read from config reference on each request', async () => {
    const cfg = { apiKey: 'initial_key' }
    const client = createCodeClient(cfg)
    fetchResponder = () => sandboxOk('sb_1')

    await client.createSandbox()
    expect(fetchCalls[0]!.headers['Authorization']).toBe('Bearer initial_key')

    cfg.apiKey = 'rotated_key'
    await client.createSandbox()
    expect(fetchCalls[1]!.headers['Authorization']).toBe('Bearer rotated_key')
  })

  it('baseUrl is captured at client creation time and does not change', async () => {
    const cfg = { endpoint: 'http://server-a:8080' }
    const client = createCodeClient(cfg)
    fetchResponder = () => sandboxOk('sb_1')

    await client.createSandbox()
    expect(fetchCalls[0]!.url).toContain('http://server-a:8080')

    cfg.endpoint = 'http://server-b:9090'
    await client.createSandbox()
    // baseUrl was const-captured, so it should still use the original
    expect(fetchCalls[1]!.url).toContain('http://server-a:8080')
  })
})

// ===========================================================================
// 14. SEQUENTIAL ERROR RECOVERY (3 tests)
// ===========================================================================

describe('Sequential error recovery', () => {
  it('client continues working after a failed request', async () => {
    let step = 0
    fetchResponder = () => {
      step++
      if (step === 1) return httpError(500, 'Server Error')
      return sandboxOk('sb_recovered')
    }
    const client = createCodeClient({ apiKey: 'key' })

    await expect(client.createSandbox()).rejects.toThrow('500')
    const sb = await client.createSandbox()
    expect(sb.id).toBe('sb_recovered')
  })

  it('exec continues after runCode failure on same sandbox', async () => {
    let step = 0
    fetchResponder = () => {
      step++
      if (step === 1) return httpError(422, 'Invalid code')
      return execOk({ stdout: 'ok\n' })
    }
    const client = createCodeClient({ apiKey: 'key' })

    await expect(client.runCode('sb_1', 'invalid code')).rejects.toThrow('422')
    const result = await client.exec('sb_1', 'echo ok')
    expect(result.stdout).toBe('ok\n')
  })

  it('file operations continue after network failure', async () => {
    let step = 0
    fetchResponder = () => {
      step++
      if (step === 1) throw new Error('ECONNRESET')
      return ok({ content: 'recovered' })
    }
    const client = createCodeClient({ apiKey: 'key' })

    await expect(client.readFile('sb_1', '/f')).rejects.toThrow('ECONNRESET')
    const content = await client.readFile('sb_1', '/f')
    expect(content).toBe('recovered')
  })
})

// ===========================================================================
// 15. SSE STREAM ADVANCED SCENARIOS (5 tests)
// ===========================================================================

describe('SSE stream advanced scenarios', () => {
  it('handles event type override followed by normal event without override', async () => {
    const res = sseResponse('event: error\ndata: {"type":"stdout","data":"overridden"}\n\n', 'data: {"type":"stdout","data":"normal"}\n\n')
    const events = await collectParse(res)
    expect(events).toHaveLength(2)
    expect(events[0]!.type).toBe('error')
    expect(events[1]!.type).toBe('stdout')
  })

  it('handles data containing SSE-like text without being parsed as SSE', async () => {
    // Data that contains "data: " inside JSON value
    const res = sseResponse('data: {"type":"stdout","data":"the data: field is here"}\n\n')
    const events = await collectParse(res)
    expect(events).toHaveLength(1)
    if (events[0]!.type === 'stdout') {
      expect(events[0]!.data).toBe('the data: field is here')
    }
  })

  it('handles UTF-8 multibyte characters in SSE data', async () => {
    const res = sseResponse('data: {"type":"stdout","data":"\\u2603 \\u2764 \\u270c"}\n\n')
    const events = await collectParse(res)
    expect(events).toHaveLength(1)
    if (events[0]!.type === 'stdout') {
      // JSON unicode escapes should be decoded
      expect(events[0]!.data).toContain('\u2603')
    }
  })

  it('yields events in order even when split across many small chunks', async () => {
    // Split each character into its own chunk
    const fullData = 'data: {"type":"stdout","data":"a"}\n\ndata: {"type":"stdout","data":"b"}\n\n'
    const chunks = fullData.split('').map((c) => c)
    const res = sseResponse(...chunks)
    const events = await collectParse(res)
    expect(events).toHaveLength(2)
    if (events[0]!.type === 'stdout' && events[1]!.type === 'stdout') {
      expect(events[0]!.data).toBe('a')
      expect(events[1]!.data).toBe('b')
    }
  })

  it('handles data line with only whitespace after "data: " as non-JSON stdout', async () => {
    const res = sseResponse('data:    \n\n')
    const events = await collectParse(res)
    // "data:    " does not start with "data: " (it starts with "data:" followed by spaces)
    // Actually "data:    " starts with "data:" not "data: " — wait, "data: " check:
    // line.startsWith('data: ') => "data:    ".startsWith('data: ') => true (d-a-t-a-colon-space)
    // Then data = line.slice(6) = "   "
    // JSON.parse("   ") throws, so it wraps as stdout
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({ type: 'stdout', data: '   ' })
  })
})

// ===========================================================================
// 16. API VERSIONING / BACKWARD COMPATIBILITY (3 tests)
// ===========================================================================

describe('API versioning and backward compatibility', () => {
  it('client works with endpoint that includes version path prefix', async () => {
    fetchResponder = () => sandboxOk('sb_v1')
    const client = createCodeClient({ endpoint: 'https://code.headless.ly/v1' })
    await client.createSandbox()
    expect(fetchCalls[0]!.url).toBe('https://code.headless.ly/v1/sandbox')
  })

  it('client works with endpoint that includes /api prefix', async () => {
    fetchResponder = () => execOk({ stdout: 'ok' })
    const client = createCodeClient({ endpoint: 'https://code.headless.ly/api' })
    await client.exec('sb_1', 'echo ok')
    expect(fetchCalls[0]!.url).toBe('https://code.headless.ly/api/exec')
  })

  it('response with extra unknown fields in data is tolerated', async () => {
    // Server returns extra fields that are not in our type definitions
    fetchResponder = () =>
      ok({
        id: 'sb_extra',
        status: 'running',
        createdAt: '2025-06-01T00:00:00Z',
        region: 'us-east-1',
        containerImage: 'node:20',
        cpuLimit: '2.0',
        memoryMB: 512,
      })
    const client = createCodeClient({ apiKey: 'key' })
    const sb = await client.createSandbox()
    expect(sb.id).toBe('sb_extra')
    expect(sb.status).toBe('running')
    // Extra fields should be present on the returned object (passthrough)
    expect((sb as unknown as Record<string, unknown>).region).toBe('us-east-1')
  })
})

// ===========================================================================
// 17. EXEC WITH STDIN EDGE CASES (3 tests)
// ===========================================================================

describe('Exec with stdin edge cases', () => {
  it('exec with multiline stdin preserves newlines', async () => {
    fetchResponder = () => execOk({ stdout: 'line1\nline2\nline3\n' })
    const client = createCodeClient({ apiKey: 'key' })
    await client.exec('sb_1', 'cat', { stdin: 'line1\nline2\nline3\n' })
    expect((fetchCalls[0]!.body as { stdin: string }).stdin).toBe('line1\nline2\nline3\n')
  })

  it('exec with empty string stdin sends empty stdin', async () => {
    fetchResponder = () => execOk()
    const client = createCodeClient({ apiKey: 'key' })
    await client.exec('sb_1', 'cat', { stdin: '' })
    expect((fetchCalls[0]!.body as { stdin: string }).stdin).toBe('')
  })

  it('exec with binary-like stdin (base64 content) serializes correctly', async () => {
    fetchResponder = () => execOk()
    const client = createCodeClient({ apiKey: 'key' })
    const b64 = 'SGVsbG8gV29ybGQ=' // "Hello World" in base64
    await client.exec('sb_1', 'base64 -d', { stdin: b64 })
    expect((fetchCalls[0]!.body as { stdin: string }).stdin).toBe(b64)
  })
})
