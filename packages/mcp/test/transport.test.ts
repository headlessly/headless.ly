import { describe, it, expect, vi } from 'vitest'
import { HttpTransport, SseTransport } from '../src/transport'
import type { JsonRpcRequest, JsonRpcResponse } from '../src/transport'

describe('@headlessly/mcp — Transport', () => {
  // ===========================================================================
  // 1. HttpTransport
  // ===========================================================================

  describe('HttpTransport', () => {
    it('sends POST request with JSON-RPC body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: { protocolVersion: '2024-11-05' },
        }),
      })

      const transport = new HttpTransport('https://crm.headless.ly/mcp', { fetch: mockFetch })
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {},
        id: 1,
      }

      const response = await transport.send(request)
      expect(response.result).toEqual({ protocolVersion: '2024-11-05' })

      expect(mockFetch).toHaveBeenCalledWith('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
    })

    it('includes custom headers', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 1, result: {} }),
      })

      const transport = new HttpTransport('https://crm.headless.ly/mcp', {
        headers: { Authorization: 'Bearer token123' },
        fetch: mockFetch,
      })

      await transport.send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })

      const calledHeaders = mockFetch.mock.calls[0][1].headers
      expect(calledHeaders['Authorization']).toBe('Bearer token123')
      expect(calledHeaders['Content-Type']).toBe('application/json')
    })

    it('throws on HTTP error status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const transport = new HttpTransport('https://crm.headless.ly/mcp', { fetch: mockFetch })

      await expect(transport.send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })).rejects.toThrow('MCP HTTP error: 500 Internal Server Error')
    })

    it('close is a no-op for HTTP transport', async () => {
      const transport = new HttpTransport('https://crm.headless.ly/mcp')
      // Should not throw
      await transport.close()
    })

    it('parses JSON-RPC error response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32601, message: 'Method not found' },
        }),
      })

      const transport = new HttpTransport('https://crm.headless.ly/mcp', { fetch: mockFetch })
      const response = await transport.send({
        jsonrpc: '2.0',
        method: 'nonexistent',
        params: {},
        id: 1,
      })

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(-32601)
    })

    it('preserves request id in response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ jsonrpc: '2.0', id: 42, result: {} }),
      })

      const transport = new HttpTransport('https://crm.headless.ly/mcp', { fetch: mockFetch })
      const response = await transport.send({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {},
        id: 42,
      })

      expect(response.id).toBe(42)
    })
  })

  // ===========================================================================
  // 2. SseTransport
  // ===========================================================================

  describe('SseTransport', () => {
    it('falls back to JSON response when Content-Type is application/json', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: { tools: [] },
        }),
      })

      const transport = new SseTransport('https://crm.headless.ly/mcp', { fetch: mockFetch })
      const response = await transport.send({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1,
      })

      expect(response.result).toEqual({ tools: [] })
    })

    it('sends Accept: text/event-stream header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ jsonrpc: '2.0', id: 1, result: {} }),
      })

      const transport = new SseTransport('https://crm.headless.ly/mcp', { fetch: mockFetch })
      await transport.send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })

      const calledHeaders = mockFetch.mock.calls[0][1].headers
      expect(calledHeaders['Accept']).toBe('text/event-stream')
    })

    it('includes custom headers alongside defaults', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ jsonrpc: '2.0', id: 1, result: {} }),
      })

      const transport = new SseTransport('https://crm.headless.ly/mcp', {
        headers: { Authorization: 'Bearer sse-token' },
        fetch: mockFetch,
      })

      await transport.send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })

      const calledHeaders = mockFetch.mock.calls[0][1].headers
      expect(calledHeaders['Authorization']).toBe('Bearer sse-token')
      expect(calledHeaders['Accept']).toBe('text/event-stream')
    })

    it('throws on HTTP error status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })

      const transport = new SseTransport('https://crm.headless.ly/mcp', { fetch: mockFetch })

      await expect(transport.send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })).rejects.toThrow('MCP SSE error: 503 Service Unavailable')
    })

    it('throws when no response body for SSE', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        body: null,
      })

      const transport = new SseTransport('https://crm.headless.ly/mcp', { fetch: mockFetch })

      await expect(transport.send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })).rejects.toThrow('MCP SSE error: no response body')
    })

    it('parses SSE stream with JSON-RPC response', async () => {
      const jsonRpcResponse = { jsonrpc: '2.0', id: 1, result: { tools: ['search', 'fetch', 'do'] } }
      const sseData = `data:${JSON.stringify(jsonRpcResponse)}\n\n`

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData))
          controller.close()
        },
      })

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        body: stream,
      })

      const transport = new SseTransport('https://crm.headless.ly/mcp', { fetch: mockFetch })
      const response = await transport.send({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1,
      })

      expect(response.result).toEqual({ tools: ['search', 'fetch', 'do'] })
    })

    it('calls onEvent callback for each SSE event', async () => {
      const jsonRpcResponse = { jsonrpc: '2.0', id: 1, result: {} }
      const sseData = `event:message\ndata:${JSON.stringify(jsonRpcResponse)}\n\n`

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData))
          controller.close()
        },
      })

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        body: stream,
      })

      const onEvent = vi.fn()
      const transport = new SseTransport('https://crm.headless.ly/mcp', { fetch: mockFetch, onEvent })

      await transport.send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })

      expect(onEvent).toHaveBeenCalledTimes(1)
      expect(onEvent.mock.calls[0][0].event).toBe('message')
      expect(onEvent.mock.calls[0][0].data).toBe(JSON.stringify(jsonRpcResponse))
    })

    it('parses multiple SSE events and returns last JSON-RPC response', async () => {
      const first = { jsonrpc: '2.0', id: 1, result: { partial: true } }
      const second = { jsonrpc: '2.0', id: 1, result: { partial: false, final: true } }
      const sseData = `data:${JSON.stringify(first)}\n\ndata:${JSON.stringify(second)}\n\n`

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData))
          controller.close()
        },
      })

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        body: stream,
      })

      const transport = new SseTransport('https://crm.headless.ly/mcp', { fetch: mockFetch })
      const response = await transport.send({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1,
      })

      expect(response.result).toEqual({ partial: false, final: true })
    })

    it('throws when SSE stream has no valid JSON-RPC response', async () => {
      const sseData = 'data:not valid json\n\n'

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(sseData))
          controller.close()
        },
      })

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
        body: stream,
      })

      const transport = new SseTransport('https://crm.headless.ly/mcp', { fetch: mockFetch })

      await expect(transport.send({ jsonrpc: '2.0', method: 'initialize', params: {}, id: 1 })).rejects.toThrow('no JSON-RPC response received')
    })

    it('close aborts any pending request', async () => {
      const transport = new SseTransport('https://crm.headless.ly/mcp')
      // Should not throw
      await transport.close()
    })
  })
})
