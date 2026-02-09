import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { createCodeClient } from '../src/index'

describe('@headlessly/code — client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createCodeClient', () => {
    it('returns a CodeClient object', () => {
      const client = createCodeClient({ endpoint: 'https://code.headless.ly', apiKey: 'test_key' })
      expect(client).toBeDefined()
    })

    it('has createSandbox method', () => {
      const client = createCodeClient({ endpoint: 'https://code.headless.ly', apiKey: 'test_key' })
      expect(typeof client.createSandbox).toBe('function')
    })

    it('has exec method', () => {
      const client = createCodeClient({ endpoint: 'https://code.headless.ly', apiKey: 'test_key' })
      expect(typeof client.exec).toBe('function')
    })

    it('has execStream method', () => {
      const client = createCodeClient({ endpoint: 'https://code.headless.ly', apiKey: 'test_key' })
      expect(typeof client.execStream).toBe('function')
    })

    it('has file operation methods', () => {
      const client = createCodeClient({ endpoint: 'https://code.headless.ly', apiKey: 'test_key' })
      expect(typeof client.writeFile).toBe('function')
      expect(typeof client.readFile).toBe('function')
      expect(typeof client.listFiles).toBe('function')
      expect(typeof client.exists).toBe('function')
      expect(typeof client.deleteFile).toBe('function')
    })

    it('has runCode method', () => {
      const client = createCodeClient({ endpoint: 'https://code.headless.ly', apiKey: 'test_key' })
      expect(typeof client.runCode).toBe('function')
    })

    it('has destroySandbox method', () => {
      const client = createCodeClient({ endpoint: 'https://code.headless.ly', apiKey: 'test_key' })
      expect(typeof client.destroySandbox).toBe('function')
    })

    it('has getSandbox method', () => {
      const client = createCodeClient({ endpoint: 'https://code.headless.ly', apiKey: 'test_key' })
      expect(typeof client.getSandbox).toBe('function')
    })
  })

  describe('sandbox CRUD with mock fetch', () => {
    it('createSandbox calls fetch with POST', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { id: 'sb_123' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const client = createCodeClient({ endpoint: 'https://code.headless.ly', apiKey: 'test_key' })
      const sandbox = await client.createSandbox()
      expect(mockFetch).toHaveBeenCalled()
      const callUrl = mockFetch.mock.calls[0][0]
      expect(String(callUrl)).toContain('sandbox')
    })

    it('exec calls fetch with POST /exec', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { exitCode: 0, stdout: 'hello' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const client = createCodeClient({ endpoint: 'https://code.headless.ly', apiKey: 'test_key' })
      const result = await client.exec('sb_123', 'echo hello')
      expect(mockFetch).toHaveBeenCalled()
    })
  })
})
