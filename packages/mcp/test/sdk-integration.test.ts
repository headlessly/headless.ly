import { describe, it, expect, afterEach } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'

/**
 * Real stdio integration tests.
 *
 * Spawns a child process that runs an MCP server over stdin/stdout,
 * then sends JSON-RPC messages through actual pipes and reads responses.
 * This tests the full StdioServerTransport path end-to-end.
 */

const SERVER_SCRIPT = resolve(import.meta.dirname, 'fixtures/stdio-server.ts')

/** Send a JSON-RPC message to a child process and read the response */
function rpc(child: ChildProcess, method: string, params?: unknown, id = 1): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for response to ${method}`)), 10_000)

    const onData = (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)
          if (parsed.id === id || (method.startsWith('notifications/') && parsed.id === undefined)) {
            clearTimeout(timeout)
            child.stdout!.off('data', onData)
            resolve(parsed)
            return
          }
        } catch {
          // not JSON, skip
        }
      }
    }

    child.stdout!.on('data', onData)
    child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
}

describe('@headlessly/mcp — stdio integration (real child process)', () => {
  let child: ChildProcess | null = null

  afterEach(() => {
    if (child && !child.killed) {
      child.kill('SIGTERM')
      child = null
    }
  })

  function spawnServer(): Promise<ChildProcess> {
    return new Promise((resolve, reject) => {
      const proc = spawn('npx', ['tsx', SERVER_SCRIPT], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      })

      child = proc

      const timeout = setTimeout(() => reject(new Error('Server did not start in time')), 10_000)

      // Wait for the "ready" signal on stderr
      proc.stderr!.on('data', (chunk: Buffer) => {
        if (chunk.toString().includes('ready')) {
          clearTimeout(timeout)
          resolve(proc)
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })

      proc.on('exit', (code) => {
        clearTimeout(timeout)
        if (code !== 0 && code !== null) {
          reject(new Error(`Server exited with code ${code}`))
        }
      })
    })
  }

  it('initialize handshake over real stdio', async () => {
    const proc = await spawnServer()

    const response = await rpc(proc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0.1' },
    })

    expect(response.result).toBeDefined()
    const result = response.result as Record<string, unknown>
    expect(result.protocolVersion).toBe('2024-11-05')
    const serverInfo = result.serverInfo as Record<string, unknown>
    expect(serverInfo.name).toBe('headless.ly')
  })

  it('lists all three builtin tools over stdio', async () => {
    const proc = await spawnServer()

    // Must initialize first
    await rpc(proc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0.1' },
    }, 1)

    // Send initialized notification (SDK requires this)
    proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')

    const response = await rpc(proc, 'tools/list', {}, 2)
    const result = response.result as { tools: Array<{ name: string }> }
    const toolNames = result.tools.map((t) => t.name)
    expect(toolNames).toContain('search')
    expect(toolNames).toContain('fetch')
    expect(toolNames).toContain('do')
  })

  it('calls search tool and gets results over stdio', async () => {
    const proc = await spawnServer()

    await rpc(proc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0.1' },
    }, 1)

    proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')

    // Create a contact first via do tool
    await rpc(proc, 'tools/call', {
      name: 'do',
      arguments: { action: 'create', type: 'Contact', data: { name: 'Alice', stage: 'Lead' } },
    }, 2)

    // Now search for it
    const response = await rpc(proc, 'tools/call', {
      name: 'search',
      arguments: { type: 'Contact' },
    }, 3)

    const result = response.result as { content: Array<{ type: string; text: string }> }
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')

    const entities = JSON.parse(result.content[0].text)
    expect(Array.isArray(entities)).toBe(true)
    expect(entities[0].name).toBe('Alice')
  })

  it('calls fetch tool for schema over stdio', async () => {
    const proc = await spawnServer()

    await rpc(proc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0.1' },
    }, 1)

    proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')

    const response = await rpc(proc, 'tools/call', {
      name: 'fetch',
      arguments: { resource: 'schema' },
    }, 2)

    const result = response.result as { content: Array<{ type: string; text: string }> }
    const schemas = JSON.parse(result.content[0].text)
    const names = schemas.map((s: { name: string }) => s.name)
    expect(names).toContain('Contact')
    expect(names).toContain('Deal')
  })

  it('handles multiple sequential requests over stdio', async () => {
    const proc = await spawnServer()

    await rpc(proc, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test', version: '0.1' },
    }, 1)

    proc.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')

    // Create two contacts
    await rpc(proc, 'tools/call', {
      name: 'do',
      arguments: { action: 'create', type: 'Contact', data: { name: 'Bob', stage: 'Lead' } },
    }, 2)

    await rpc(proc, 'tools/call', {
      name: 'do',
      arguments: { action: 'create', type: 'Deal', data: { title: 'Big Deal', value: 50000, stage: 'Open' } },
    }, 3)

    // Search contacts
    const contactRes = await rpc(proc, 'tools/call', {
      name: 'search',
      arguments: { type: 'Contact' },
    }, 4)
    const contacts = JSON.parse((contactRes.result as { content: Array<{ text: string }> }).content[0].text)
    expect(contacts).toHaveLength(1)
    expect(contacts[0].name).toBe('Bob')

    // Search deals
    const dealRes = await rpc(proc, 'tools/call', {
      name: 'search',
      arguments: { type: 'Deal' },
    }, 5)
    const deals = JSON.parse((dealRes.result as { content: Array<{ text: string }> }).content[0].text)
    expect(deals).toHaveLength(1)
    expect(deals[0].title).toBe('Big Deal')
  })
})
