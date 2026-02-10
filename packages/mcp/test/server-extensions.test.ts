import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearRegistry, setProvider, MemoryNounProvider, Noun } from 'digital-objects'
import { MCPServer } from '../src/server'
import type { MCPToolResult, MCPTool } from '../src/types'

describe('@headlessly/mcp — Server Extensions', () => {
  let provider: MemoryNounProvider

  beforeEach(() => {
    clearRegistry()
    provider = new MemoryNounProvider()
    setProvider(provider)

    Noun('Contact', {
      name: 'string!',
      email: 'string?#',
      stage: 'Lead | Qualified | Customer | Churned',
      qualify: 'Qualified',
    })

    Noun('Deal', {
      title: 'string!',
      value: 'number?',
      stage: 'Open | Won | Lost',
      contact: '-> Contact.deals',
      close: 'Won',
    })
  })

  // ===========================================================================
  // 1. tool() — Custom Tool Registration
  // ===========================================================================

  describe('tool() registration', () => {
    it('registers a custom tool', async () => {
      const server = new MCPServer({ provider })

      server.tool(
        'ping',
        {
          type: 'object',
          properties: {
            message: { type: 'string', description: 'Message to echo' },
          },
        },
        async (args) => ({
          content: [{ type: 'text', text: `pong: ${args.message}` }],
        }),
      )

      const response = await server.handleRequest({ method: 'tools/list', id: 1 })
      const result = response.result as { tools: MCPTool[] }
      const ping = result.tools.find((t) => t.name === 'ping')
      expect(ping).toBeDefined()
      expect(ping!.inputSchema.properties.message.type).toBe('string')
    })

    it('custom tool appears alongside builtin tools', async () => {
      const server = new MCPServer({ provider })

      server.tool(
        'custom',
        { type: 'object', properties: {} },
        async () => ({ content: [{ type: 'text', text: 'ok' }] }),
      )

      const response = await server.handleRequest({ method: 'tools/list', id: 1 })
      const result = response.result as { tools: MCPTool[] }
      expect(result.tools).toHaveLength(4) // 3 builtin + 1 custom
      const names = result.tools.map((t) => t.name)
      expect(names).toContain('search')
      expect(names).toContain('fetch')
      expect(names).toContain('do')
      expect(names).toContain('custom')
    })

    it('custom tool can be called via tools/call', async () => {
      const server = new MCPServer({ provider })

      server.tool(
        'greet',
        {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name to greet' },
          },
          required: ['name'],
        },
        async (args) => ({
          content: [{ type: 'text', text: `Hello, ${args.name}!` }],
        }),
      )

      const response = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: { name: 'greet', arguments: { name: 'World' } },
      })
      const result = response.result as MCPToolResult
      expect(result.isError).toBeFalsy()
      expect(result.content[0].text).toBe('Hello, World!')
    })

    it('registering multiple custom tools works', async () => {
      const server = new MCPServer({ provider })

      server.tool(
        'tool-a',
        { type: 'object', properties: {} },
        async () => ({ content: [{ type: 'text', text: 'a' }] }),
      )
      server.tool(
        'tool-b',
        { type: 'object', properties: {} },
        async () => ({ content: [{ type: 'text', text: 'b' }] }),
      )
      server.tool(
        'tool-c',
        { type: 'object', properties: {} },
        async () => ({ content: [{ type: 'text', text: 'c' }] }),
      )

      const response = await server.handleRequest({ method: 'tools/list', id: 1 })
      const result = response.result as { tools: MCPTool[] }
      expect(result.tools).toHaveLength(6) // 3 builtin + 3 custom
    })

    it('custom tool overrides builtin tool with same name', async () => {
      const server = new MCPServer({ provider })

      // Register a custom 'search' tool that overrides the builtin
      server.tool(
        'search',
        { type: 'object', properties: {} },
        async () => ({
          content: [{ type: 'text', text: 'custom search' }],
        }),
      )

      const response = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: { name: 'search', arguments: {} },
      })
      const result = response.result as MCPToolResult
      expect(result.content[0].text).toBe('custom search')
    })

    it('tool() returns this for chaining', () => {
      const server = new MCPServer({ provider })

      const returned = server
        .tool('a', { type: 'object', properties: {} }, async () => ({ content: [{ type: 'text', text: 'a' }] }))
        .tool('b', { type: 'object', properties: {} }, async () => ({ content: [{ type: 'text', text: 'b' }] }))

      expect(returned).toBe(server)
    })

    it('custom tool handler receives correct arguments', async () => {
      const handler = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
      })

      const server = new MCPServer({ provider })
      server.tool(
        'test-args',
        {
          type: 'object',
          properties: {
            a: { type: 'string', description: 'First arg' },
            b: { type: 'number', description: 'Second arg' },
          },
        },
        handler,
      )

      await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: { name: 'test-args', arguments: { a: 'hello', b: 42 } },
      })

      expect(handler).toHaveBeenCalledWith({ a: 'hello', b: 42 })
    })

    it('custom tool can return isError', async () => {
      const server = new MCPServer({ provider })
      server.tool(
        'fail',
        { type: 'object', properties: {} },
        async () => ({
          content: [{ type: 'text', text: 'Something went wrong' }],
          isError: true,
        }),
      )

      const response = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: { name: 'fail', arguments: {} },
      })
      const result = response.result as MCPToolResult
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toBe('Something went wrong')
    })
  })

  // ===========================================================================
  // 2. handle() — Alias for handleRequest
  // ===========================================================================

  describe('handle() alias', () => {
    it('handle() returns same result as handleRequest()', async () => {
      const server = new MCPServer({ provider })

      const result1 = await server.handle({ method: 'initialize', id: 1 })
      const result2 = await server.handleRequest({ method: 'initialize', id: 2 })

      expect((result1.result as Record<string, unknown>).protocolVersion).toBe(
        (result2.result as Record<string, unknown>).protocolVersion,
      )
    })

    it('handle() processes tools/list', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handle({ method: 'tools/list', id: 1 })
      const result = response.result as { tools: MCPTool[] }
      expect(result.tools).toHaveLength(3)
    })

    it('handle() processes tools/call', async () => {
      const server = new MCPServer({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const response = await server.handle({
        method: 'tools/call',
        id: 1,
        params: { name: 'search', arguments: { type: 'Contact' } },
      })
      const result = response.result as MCPToolResult
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(1)
    })

    it('handle() returns error for unknown method', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handle({ method: 'unknown/method', id: 1 })
      expect(response.error).toBeDefined()
      const error = response.error as { code: number }
      expect(error.code).toBe(-32601)
    })
  })

  // ===========================================================================
  // 3. toFetchHandler() — Cloudflare Workers Compatible
  // ===========================================================================

  describe('toFetchHandler()', () => {
    it('returns a function', () => {
      const server = new MCPServer({ provider })
      const handler = server.toFetchHandler()
      expect(typeof handler).toBe('function')
    })

    it('handler processes a POST request', async () => {
      const server = new MCPServer({ provider })
      const handler = server.toFetchHandler()

      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'initialize', id: 1 }),
      })

      const response = await handler(request)
      expect(response.status).toBe(200)
      const body = (await response.json()) as Record<string, unknown>
      expect(body.jsonrpc).toBe('2.0')
      expect(body.id).toBe(1)
    })

    it('handler handles CORS preflight', async () => {
      const server = new MCPServer({ provider })
      const handler = server.toFetchHandler()

      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'OPTIONS',
      })

      const response = await handler(request)
      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })

    it('handler returns 400 for invalid JSON', async () => {
      const server = new MCPServer({ provider })
      const handler = server.toFetchHandler()

      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{{invalid}}',
      })

      const response = await handler(request)
      expect(response.status).toBe(400)
    })

    it('handler processes batch requests', async () => {
      const server = new MCPServer({ provider })
      const handler = server.toFetchHandler()

      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { method: 'initialize', id: 1 },
          { method: 'tools/list', id: 2 },
        ]),
      })

      const response = await handler(request)
      const body = (await response.json()) as Array<Record<string, unknown>>
      expect(body).toHaveLength(2)
      expect(body[0].id).toBe(1)
      expect(body[1].id).toBe(2)
    })

    it('handler works with tools/call for all three tools', async () => {
      const server = new MCPServer({ provider })
      const handler = server.toFetchHandler()
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      // Search
      let request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'tools/call',
          id: 1,
          params: { name: 'search', arguments: { type: 'Contact' } },
        }),
      })
      let response = await handler(request)
      let body = (await response.json()) as Record<string, unknown>
      let result = body.result as MCPToolResult
      expect(JSON.parse(result.content[0].text!)).toHaveLength(1)

      // Fetch
      request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'tools/call',
          id: 2,
          params: { name: 'fetch', arguments: { resource: 'schema' } },
        }),
      })
      response = await handler(request)
      body = (await response.json()) as Record<string, unknown>
      result = body.result as MCPToolResult
      expect(result.isError).toBeFalsy()

      // Do
      request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'tools/call',
          id: 3,
          params: {
            name: 'do',
            arguments: { action: 'create', type: 'Deal', data: { title: 'New Deal', stage: 'Open' } },
          },
        }),
      })
      response = await handler(request)
      body = (await response.json()) as Record<string, unknown>
      result = body.result as MCPToolResult
      expect(JSON.parse(result.content[0].text!).$type).toBe('Deal')
    })

    it('handler includes custom tools', async () => {
      const server = new MCPServer({ provider })
      server.tool(
        'health',
        { type: 'object', properties: {} },
        async () => ({
          content: [{ type: 'text', text: JSON.stringify({ status: 'ok' }) }],
        }),
      )

      const handler = server.toFetchHandler()

      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'tools/call',
          id: 1,
          params: { name: 'health', arguments: {} },
        }),
      })

      const response = await handler(request)
      const body = (await response.json()) as Record<string, unknown>
      const result = body.result as MCPToolResult
      expect(JSON.parse(result.content[0].text!).status).toBe('ok')
    })

    it('can be used as a Cloudflare Worker export', async () => {
      const server = new MCPServer({ provider })
      const worker = { fetch: server.toFetchHandler() }

      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'initialize', id: 1 }),
      })

      const response = await worker.fetch(request)
      expect(response.status).toBe(200)
    })
  })

  // ===========================================================================
  // 4. Custom Tool + Builtin Integration
  // ===========================================================================

  describe('custom tool and builtin integration', () => {
    it('custom tool can use provider data from search results', async () => {
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Qualified' })

      const server = new MCPServer({ provider })
      server.tool(
        'count-leads',
        { type: 'object', properties: {} },
        async () => {
          const leads = await provider.find('Contact', { stage: 'Lead' })
          return {
            content: [{ type: 'text', text: JSON.stringify({ count: leads.length }) }],
          }
        },
      )

      const response = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: { name: 'count-leads', arguments: {} },
      })
      const result = response.result as MCPToolResult
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.count).toBe(1)
    })

    it('builtin tools still work after registering custom tools', async () => {
      const server = new MCPServer({ provider })
      server.tool(
        'custom',
        { type: 'object', properties: {} },
        async () => ({ content: [{ type: 'text', text: 'custom' }] }),
      )

      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      // Builtin search should still work
      const searchResponse = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: { name: 'search', arguments: { type: 'Contact' } },
      })
      const searchResult = searchResponse.result as MCPToolResult
      const parsed = JSON.parse(searchResult.content[0].text!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('Alice')

      // Builtin fetch should still work
      const fetchResponse = await server.handleRequest({
        method: 'tools/call',
        id: 2,
        params: { name: 'fetch', arguments: { resource: 'schema', noun: 'Contact' } },
      })
      const fetchResult = fetchResponse.result as MCPToolResult
      expect(fetchResult.isError).toBeFalsy()
    })
  })
})
