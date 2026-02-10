import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearRegistry, setProvider, MemoryNounProvider, Noun } from 'digital-objects'
import { MCPClient } from '../src/client'
import { MCPServer } from '../src/server'
import type { MCPTransport, JsonRpcRequest, JsonRpcResponse } from '../src/transport'
import { HttpTransport, SseTransport } from '../src/transport'

/**
 * Create a mock transport that routes requests directly to an MCPServer.
 * This simulates a network connection without actual HTTP.
 */
function createServerTransport(server: MCPServer): MCPTransport {
  return {
    async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
      const result = await server.handleRequest(request as unknown as Record<string, unknown>)
      return result as unknown as JsonRpcResponse
    },
    async close(): Promise<void> {},
  }
}

describe('@headlessly/mcp — MCPClient', () => {
  let provider: MemoryNounProvider
  let server: MCPServer

  beforeEach(() => {
    clearRegistry()
    provider = new MemoryNounProvider()
    setProvider(provider)

    Noun('Contact', {
      name: 'string!',
      email: 'string?#',
      stage: 'Lead | Qualified | Customer | Churned',
      company: '-> Company.contacts',
      qualify: 'Qualified',
    })

    Noun('Deal', {
      title: 'string!',
      value: 'number?',
      stage: 'Open | Won | Lost',
      contact: '-> Contact.deals',
      close: 'Won',
    })

    Noun('Company', {
      name: 'string!',
      industry: 'string?',
    })

    server = new MCPServer({ provider })
  })

  // ===========================================================================
  // 1. Connection Lifecycle
  // ===========================================================================

  describe('connection lifecycle', () => {
    it('connect performs initialize handshake', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const info = await client.connect()
      expect(info).toBeDefined()
      expect(info.protocolVersion).toBe('2024-11-05')
      expect(info.serverInfo.name).toBe('headless.ly')
      expect(info.serverInfo.version).toBe('0.0.1')
    })

    it('isConnected returns false before connect', () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })
      expect(client.isConnected).toBe(false)
    })

    it('isConnected returns true after connect', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })
      await client.connect()
      expect(client.isConnected).toBe(true)
    })

    it('close sets isConnected to false', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })
      await client.connect()
      await client.close()
      expect(client.isConnected).toBe(false)
    })

    it('getServerInfo returns null before connect', () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })
      expect(client.getServerInfo()).toBeNull()
    })

    it('getServerInfo returns server info after connect', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })
      await client.connect()
      const info = client.getServerInfo()
      expect(info).not.toBeNull()
      expect(info!.serverInfo.name).toBe('headless.ly')
    })

    it('close clears serverInfo', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })
      await client.connect()
      await client.close()
      expect(client.getServerInfo()).toBeNull()
    })

    it('connect with tenant context returns tenant in serverInfo', async () => {
      const tenantServer = new MCPServer({
        provider,
        context: { tenant: 'acme', subdomain: 'crm' },
      })
      const transport = createServerTransport(tenantServer)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const info = await client.connect()
      expect(info.serverInfo.tenant).toBe('acme')
      expect(info.serverInfo.subdomain).toBe('crm')
    })
  })

  // ===========================================================================
  // 2. Tool Discovery
  // ===========================================================================

  describe('tool discovery', () => {
    it('listTools returns 3 builtin tools', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const tools = await client.listTools()
      expect(tools).toHaveLength(3)
      const names = tools.map((t) => t.name)
      expect(names).toContain('search')
      expect(names).toContain('fetch')
      expect(names).toContain('do')
    })

    it('listTools caches results on second call', async () => {
      const transport = createServerTransport(server)
      const sendSpy = vi.spyOn(transport, 'send')
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const tools1 = await client.listTools()
      const tools2 = await client.listTools()

      expect(tools1).toBe(tools2) // Same reference (cached)
      // send called only once for tools/list (connect sends initialize + notifications/initialized)
      const toolsCalls = sendSpy.mock.calls.filter(
        (call) => (call[0] as JsonRpcRequest).method === 'tools/list',
      )
      expect(toolsCalls).toHaveLength(1)
    })

    it('close clears tool cache', async () => {
      const transport = createServerTransport(server)
      const sendSpy = vi.spyOn(transport, 'send')
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      await client.listTools()
      await client.close()
      // After close, listTools should re-fetch
      const tools = await client.listTools()
      const toolsCalls = sendSpy.mock.calls.filter(
        (call) => (call[0] as JsonRpcRequest).method === 'tools/list',
      )
      expect(toolsCalls).toHaveLength(2)
    })

    it('listTools includes custom tools registered on server', async () => {
      server.tool(
        'summarize',
        {
          type: 'object',
          properties: { text: { type: 'string', description: 'Text to summarize' } },
          required: ['text'],
        },
        async (args) => ({
          content: [{ type: 'text', text: `Summary: ${args.text}` }],
        }),
      )

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const tools = await client.listTools()
      expect(tools).toHaveLength(4) // 3 builtin + 1 custom
      expect(tools.map((t) => t.name)).toContain('summarize')
    })
  })

  // ===========================================================================
  // 3. Search
  // ===========================================================================

  describe('search', () => {
    it('searches entities by type', async () => {
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Qualified' })

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.search({ type: 'Contact' })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(2)
    })

    it('searches with filter', async () => {
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Qualified' })

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.search({ type: 'Contact', filter: { stage: 'Lead' } })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('Alice')
    })

    it('searches with text query', async () => {
      await provider.create('Contact', { name: 'Alice Smith', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob Jones', stage: 'Lead' })

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.search({ type: 'Contact', query: 'alice' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('Alice Smith')
    })

    it('searches with sort', async () => {
      await provider.create('Contact', { name: 'Charlie', stage: 'Lead' })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Lead' })

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.search({ type: 'Contact', sort: { name: 'asc' } })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed[0].name).toBe('Alice')
      expect(parsed[2].name).toBe('Charlie')
    })

    it('searches with limit', async () => {
      for (let i = 0; i < 10; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.search({ type: 'Contact', limit: 3 })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.items).toHaveLength(3)
      expect(parsed.total).toBe(10)
    })

    it('returns empty results when none match', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.search({ type: 'Contact', filter: { stage: 'Nonexistent' } })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toEqual([])
    })
  })

  // ===========================================================================
  // 4. Fetch
  // ===========================================================================

  describe('fetch', () => {
    it('fetches entity by type and id', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.fetch({ resource: 'entity', type: 'Contact', id: contact.$id })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.name).toBe('Alice')
      expect(parsed.$id).toBe(contact.$id)
    })

    it('fetches schema for a noun', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.fetch({ resource: 'schema', noun: 'Contact' })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.name).toBe('Contact')
      expect(parsed.fields).toBeInstanceOf(Array)
    })

    it('fetches all schemas', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.fetch({ resource: 'schema' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toBeInstanceOf(Array)
      const names = parsed.map((s: { name: string }) => s.name)
      expect(names).toContain('Contact')
      expect(names).toContain('Deal')
    })

    it('returns error for non-existent entity', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.fetch({ resource: 'entity', type: 'Contact', id: 'contact_nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not found')
    })

    it('fetches with relationship enrichment', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const deal = await provider.create('Deal', { title: 'Big Deal', stage: 'Open', contact: contact.$id })

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.fetch({ resource: 'entity', type: 'Contact', id: contact.$id })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.deals).toBeDefined()
      expect(parsed.deals[0].$id).toBe(deal.$id)
    })
  })

  // ===========================================================================
  // 5. Do
  // ===========================================================================

  describe('do', () => {
    it('creates an entity', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.do({ action: 'create', type: 'Contact', data: { name: 'Alice', stage: 'Lead' } })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.name).toBe('Alice')
      expect(parsed.$type).toBe('Contact')
    })

    it('updates an entity', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.do({
        action: 'update',
        type: 'Contact',
        id: contact.$id,
        data: { stage: 'Qualified' },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.stage).toBe('Qualified')
    })

    it('deletes an entity', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.do({ action: 'delete', type: 'Contact', id: contact.$id })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.deleted).toBe(true)
    })

    it('executes a custom verb', async () => {
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.do({
        action: 'qualify',
        type: 'Contact',
        id: contact.$id,
        data: { stage: 'Qualified' },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.stage).toBe('Qualified')
    })

    it('returns error for missing type', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.do({ action: 'create', data: { name: 'test' } })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('type required')
    })

    it('evaluates code when evaluator is provided', async () => {
      const evaluate = vi.fn().mockResolvedValue({ count: 42 })
      const serverWithEval = new MCPServer({ provider, evaluate })
      const transport = createServerTransport(serverWithEval)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.do({ action: 'eval', code: 'return { count: 42 }' })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.count).toBe(42)
    })
  })

  // ===========================================================================
  // 6. callTool (generic)
  // ===========================================================================

  describe('callTool', () => {
    it('calls a builtin tool by name', async () => {
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.callTool('search', { type: 'Contact' })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(1)
    })

    it('calls a custom tool by name', async () => {
      server.tool(
        'ping',
        {
          type: 'object',
          properties: { message: { type: 'string', description: 'Message' } },
        },
        async (args) => ({
          content: [{ type: 'text', text: `pong: ${args.message}` }],
        }),
      )

      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.callTool('ping', { message: 'hello' })
      expect(result.isError).toBeFalsy()
      expect(result.content[0].text).toBe('pong: hello')
    })

    it('returns error for unknown tool', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      const result = await client.callTool('nonexistent', {})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown tool')
    })
  })

  // ===========================================================================
  // 7. Request ID incrementing
  // ===========================================================================

  describe('request ID incrementing', () => {
    it('each request gets a unique incrementing id', async () => {
      const ids: number[] = []
      const transport: MCPTransport = {
        async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
          ids.push(request.id as number)
          const result = await server.handleRequest(request as unknown as Record<string, unknown>)
          return result as unknown as JsonRpcResponse
        },
        async close(): Promise<void> {},
      }

      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })
      await client.connect() // sends initialize + notifications/initialized = ids 1, 2
      await client.listTools() // id 3
      await client.search({}) // id 4

      expect(ids).toEqual([1, 2, 3, 4])
    })
  })

  // ===========================================================================
  // 8. Full Round-Trip Workflow
  // ===========================================================================

  describe('full round-trip workflow', () => {
    it('connect, create, search, fetch, qualify, close', async () => {
      const transport = createServerTransport(server)
      const client = new MCPClient('https://crm.headless.ly/mcp', { transport })

      // Connect
      await client.connect()
      expect(client.isConnected).toBe(true)

      // Create
      const createResult = await client.do({
        action: 'create',
        type: 'Contact',
        data: { name: 'Alice', email: 'alice@example.com', stage: 'Lead' },
      })
      const created = JSON.parse(createResult.content[0].text!)
      expect(created.name).toBe('Alice')

      // Search
      const searchResult = await client.search({ type: 'Contact', query: 'alice' })
      const searchParsed = JSON.parse(searchResult.content[0].text!)
      expect(searchParsed).toHaveLength(1)

      // Fetch
      const fetchResult = await client.fetch({
        resource: 'entity',
        type: 'Contact',
        id: created.$id,
      })
      const fetched = JSON.parse(fetchResult.content[0].text!)
      expect(fetched.name).toBe('Alice')

      // Qualify
      const qualifyResult = await client.do({
        action: 'qualify',
        type: 'Contact',
        id: created.$id,
        data: { stage: 'Qualified' },
      })
      const qualified = JSON.parse(qualifyResult.content[0].text!)
      expect(qualified.stage).toBe('Qualified')

      // Close
      await client.close()
      expect(client.isConnected).toBe(false)
    })
  })
})
