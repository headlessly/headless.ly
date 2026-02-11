/**
 * E2E Tests for @headlessly/code — Sandboxed Code Execution Client
 *
 * Validates exports, constructors, and client API surface.
 * Includes a live endpoint check against code.headless.ly.
 */

import { describe, it, expect } from 'vitest'
import { createCodeClient, parseExecStream } from '../src/index.js'
import type { CodeClient, CodeClientConfig } from '../src/index.js'

// =============================================================================
// 1. Exports exist
// =============================================================================

describe('@headlessly/code exports', () => {
  it('exports createCodeClient as a function', () => {
    expect(createCodeClient).toBeDefined()
    expect(typeof createCodeClient).toBe('function')
  })

  it('exports parseExecStream as a function', () => {
    expect(parseExecStream).toBeDefined()
    expect(typeof parseExecStream).toBe('function')
  })
})

// =============================================================================
// 2. createCodeClient factory
// =============================================================================

describe('createCodeClient()', () => {
  it('returns a client object with no config', () => {
    const client = createCodeClient()
    expect(client).toBeDefined()
    expect(typeof client).toBe('object')
  })

  it('returns a client object with apiKey config', () => {
    const client = createCodeClient({ apiKey: 'hl_test_code_e2e' })
    expect(client).toBeDefined()
    expect(typeof client).toBe('object')
  })

  it('accepts custom endpoint', () => {
    const client = createCodeClient({ endpoint: 'https://custom-code.example.com' })
    expect(client.config.endpoint).toBe('https://custom-code.example.com')
  })

  it('accepts timeout option', () => {
    const client = createCodeClient({ timeout: 30000 })
    expect(client.config.timeout).toBe(30000)
  })

  it('stores config on the client object', () => {
    const config: CodeClientConfig = { apiKey: 'hl_cfg_test', endpoint: 'https://code.headless.ly', timeout: 5000 }
    const client = createCodeClient(config)
    expect(client.config).toBeDefined()
    expect(client.config.apiKey).toBe('hl_cfg_test')
    expect(client.config.endpoint).toBe('https://code.headless.ly')
    expect(client.config.timeout).toBe(5000)
  })
})

// =============================================================================
// 3. Client API surface
// =============================================================================

describe('CodeClient API surface', () => {
  let client: CodeClient

  client = createCodeClient({ apiKey: 'hl_test_surface' })

  it('has createSandbox method', () => {
    expect(typeof client.createSandbox).toBe('function')
  })

  it('has getSandbox method', () => {
    expect(typeof client.getSandbox).toBe('function')
  })

  it('has destroySandbox method', () => {
    expect(typeof client.destroySandbox).toBe('function')
  })

  it('has exec method', () => {
    expect(typeof client.exec).toBe('function')
  })

  it('has execStream method', () => {
    expect(typeof client.execStream).toBe('function')
  })

  it('has writeFile method', () => {
    expect(typeof client.writeFile).toBe('function')
  })

  it('has readFile method', () => {
    expect(typeof client.readFile).toBe('function')
  })

  it('has listFiles method', () => {
    expect(typeof client.listFiles).toBe('function')
  })

  it('has exists method', () => {
    expect(typeof client.exists).toBe('function')
  })

  it('has deleteFile method', () => {
    expect(typeof client.deleteFile).toBe('function')
  })

  it('has runCode method', () => {
    expect(typeof client.runCode).toBe('function')
  })

  it('exec rejects with empty command', async () => {
    await expect(client.exec('sandbox_abc', '')).rejects.toThrow('command must not be empty')
  })

  it('runCode rejects with empty sandboxId', async () => {
    await expect(client.runCode('', 'print(1)')).rejects.toThrow('sandboxId must not be empty')
  })
})

// =============================================================================
// 4. Live endpoint check
// =============================================================================

describe('code.headless.ly live endpoint', () => {
  it('responds with status < 500', async () => {
    const res = await fetch('https://code.headless.ly', {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    })
    expect(res.status).toBeLessThan(500)
  })
})
