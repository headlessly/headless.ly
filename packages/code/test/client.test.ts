import { describe, it, expect, beforeEach } from 'vitest'
import { createCodeClient } from '../src/client.js'

// ---------------------------------------------------------------------------
// Recording fetch
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string
  method: string
  headers: Record<string, string>
  body?: unknown
}

const fetchCalls: FetchCall[] = []
let fetchResponder: (url: string, method: string) => Response = () =>
  new Response(JSON.stringify({ success: true, data: { id: 'sb_test', status: 'running', createdAt: new Date().toISOString() } }), { status: 200 })

beforeEach(() => {
  fetchCalls.length = 0
  fetchResponder = () =>
    new Response(JSON.stringify({ success: true, data: { id: 'sb_test', status: 'running', createdAt: new Date().toISOString() } }), { status: 200 })
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input.toString()
    const method = init?.method ?? 'GET'
    const headers = (init?.headers as Record<string, string>) ?? {}
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    fetchCalls.push({ url, method, headers, body })
    return fetchResponder(url, method)
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createCodeClient', () => {
  it('uses default endpoint https://code.headless.ly', async () => {
    const client = createCodeClient({})
    await client.createSandbox()
    expect(fetchCalls[0]!.url).toContain('https://code.headless.ly')
  })

  it('uses custom endpoint', async () => {
    const client = createCodeClient({ endpoint: 'http://localhost:8787' })
    await client.createSandbox()
    expect(fetchCalls[0]!.url).toContain('http://localhost:8787')
  })

  it('includes Authorization header when apiKey provided', async () => {
    const client = createCodeClient({ apiKey: 'key_test' })
    await client.createSandbox()
    expect(fetchCalls[0]!.headers.Authorization).toBe('Bearer key_test')
  })

  it('omits Authorization header when no apiKey', async () => {
    const client = createCodeClient({})
    await client.createSandbox()
    expect(fetchCalls[0]!.headers.Authorization).toBeUndefined()
  })

  it('exposes config property', () => {
    const config = { apiKey: 'key_test', endpoint: 'http://localhost:8787' }
    const client = createCodeClient(config)
    expect(client.config).toEqual(config)
  })
})

describe('createSandbox', () => {
  it('calls POST /sandbox', async () => {
    const client = createCodeClient({ apiKey: 'key_test' })
    await client.createSandbox()
    expect(fetchCalls[0]!.method).toBe('POST')
    expect(fetchCalls[0]!.url).toContain('/sandbox')
  })

  it('returns parsed sandbox info', async () => {
    const client = createCodeClient({ apiKey: 'key_test' })
    const sandbox = await client.createSandbox()
    expect(sandbox.id).toBe('sb_test')
    expect(sandbox.status).toBe('running')
  })
})

describe('exec', () => {
  it('calls POST /exec with sandboxId and command', async () => {
    fetchResponder = () =>
      new Response(JSON.stringify({ success: true, data: { exitCode: 0, stdout: 'hello', stderr: '', command: 'echo hello', success: true, duration: 10, timestamp: new Date().toISOString() } }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key_test' })
    const result = await client.exec('sb_123', 'echo hello')

    expect(fetchCalls[0]!.method).toBe('POST')
    expect(fetchCalls[0]!.url).toContain('/exec')
    expect(fetchCalls[0]!.body).toEqual(expect.objectContaining({ sandboxId: 'sb_123', command: 'echo hello' }))
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('hello')
  })
})

describe('getSandbox error recovery', () => {
  it('returns null when fetch throws', async () => {
    fetchResponder = () => {
      throw new Error('network error')
    }

    const client = createCodeClient({ apiKey: 'key_test' })
    const result = await client.getSandbox('sb_missing')
    expect(result).toBeNull()
  })
})

describe('listFiles normalization', () => {
  it('handles { files: [...] } wrapped format', async () => {
    fetchResponder = () =>
      new Response(JSON.stringify({ success: true, data: { files: [{ name: 'a.txt', absolutePath: '/a.txt', type: 'file', size: 10, modifiedAt: '', permissions: '' }] } }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key_test' })
    const files = await client.listFiles('sb_123', '/')
    expect(Array.isArray(files)).toBe(true)
    expect(files[0]!.name).toBe('a.txt')
  })

  it('handles direct array format', async () => {
    fetchResponder = () =>
      new Response(JSON.stringify({ success: true, data: [{ name: 'b.txt', absolutePath: '/b.txt', type: 'file', size: 20, modifiedAt: '', permissions: '' }] }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key_test' })
    const files = await client.listFiles('sb_123', '/')
    expect(Array.isArray(files)).toBe(true)
    expect(files[0]!.name).toBe('b.txt')
  })
})

describe('Request body structure', () => {
  it('writeFile sends correct body', async () => {
    fetchResponder = () => new Response(JSON.stringify({ success: true, data: null }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key_test' })
    await client.writeFile('sb_123', '/hello.txt', 'world')
    expect(fetchCalls[0]!.body).toEqual(expect.objectContaining({ sandboxId: 'sb_123', path: '/hello.txt', content: 'world' }))
  })

  it('readFile sends correct body', async () => {
    fetchResponder = () => new Response(JSON.stringify({ success: true, data: { content: 'hello' } }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key_test' })
    const content = await client.readFile('sb_123', '/hello.txt')
    expect(content).toBe('hello')
    expect(fetchCalls[0]!.body).toEqual(expect.objectContaining({ sandboxId: 'sb_123', path: '/hello.txt' }))
  })

  it('runCode sends correct body', async () => {
    fetchResponder = () =>
      new Response(JSON.stringify({ success: true, data: { code: 'console.log(1)', language: 'javascript', logs: ['1'], results: [], duration: 5 } }), { status: 200 })

    const client = createCodeClient({ apiKey: 'key_test' })
    const result = await client.runCode('sb_123', 'console.log(1)', { language: 'javascript' })
    expect(fetchCalls[0]!.body).toEqual(expect.objectContaining({ sandboxId: 'sb_123', code: 'console.log(1)', language: 'javascript' }))
    expect(result.language).toBe('javascript')
  })
})
