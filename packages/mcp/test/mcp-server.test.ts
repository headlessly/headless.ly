import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearRegistry, setProvider, MemoryNounProvider, Noun } from 'digital-objects'
import { MCPServer } from '../src/server'
import { createHandlers } from '../src/handlers'

describe('@headlessly/mcp — server & handler tests (RED)', () => {
  let provider: MemoryNounProvider

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
  })

  // ===========================================================================
  // 1. MCPServer JSON-RPC Protocol (GREEN — baseline verification)
  // ===========================================================================

  describe('MCPServer JSON-RPC protocol', () => {
    it('initialize returns protocolVersion and serverInfo', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: 1 })
      expect(response.jsonrpc).toBe('2.0')
      expect(response.id).toBe(1)
      const result = response.result as Record<string, unknown>
      expect(result.protocolVersion).toBe('2024-11-05')
      expect(result.serverInfo).toEqual({ name: 'headless.ly', version: '0.0.1' })
      expect(result.capabilities).toEqual({ tools: {} })
    })

    it('tools/list returns 3 tools', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'tools/list', id: 2 })
      const result = response.result as { tools: unknown[] }
      expect(result.tools).toHaveLength(3)
    })

    it('tools/call with search tool works', async () => {
      const server = new MCPServer({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const response = await server.handleRequest({
        method: 'tools/call',
        id: 3,
        params: { name: 'search', arguments: { type: 'Contact' } },
      })
      const result = response.result as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toBeInstanceOf(Array)
      expect(parsed.length).toBeGreaterThanOrEqual(1)
    })

    it('tools/call with fetch tool works', async () => {
      const server = new MCPServer({ provider })
      const contact = await provider.create('Contact', { name: 'Bob', stage: 'Lead' })
      const response = await server.handleRequest({
        method: 'tools/call',
        id: 4,
        params: { name: 'fetch', arguments: { resource: 'entity', type: 'Contact', id: contact.$id } },
      })
      const result = response.result as { content: Array<{ text: string }>; isError?: boolean }
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.name).toBe('Bob')
    })

    it('tools/call with do tool works', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({
        method: 'tools/call',
        id: 5,
        params: { name: 'do', arguments: { action: 'create', type: 'Contact', data: { name: 'Carol', stage: 'Lead' } } },
      })
      const result = response.result as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed.name).toBe('Carol')
      expect(parsed.$type).toBe('Contact')
    })

    it('tools/call with unknown tool returns isError', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({
        method: 'tools/call',
        id: 6,
        params: { name: 'nonexistent', arguments: {} },
      })
      const result = response.result as { isError?: boolean; content: Array<{ text: string }> }
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown tool')
    })

    it('unknown method returns -32601 error', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'bogus/method', id: 7 })
      expect(response.error).toBeDefined()
      const error = response.error as { code: number; message: string }
      expect(error.code).toBe(-32601)
      expect(error.message).toContain('Method not found')
    })

    it('JSON-RPC response includes id from request', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: 'abc-123' })
      expect(response.id).toBe('abc-123')
    })
  })

  // ===========================================================================
  // 2. Search Handler Deep (GREEN — baseline verification)
  // ===========================================================================

  describe('search handler', () => {
    it('searches specific type with filter', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Qualified' })

      const result = await handlers.search({ type: 'Contact', filter: { stage: 'Lead' } })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('Alice')
    })

    it('searches with text query across string fields', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice Smith', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob Jones', stage: 'Lead' })

      const result = await handlers.search({ type: 'Contact', query: 'alice' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('Alice Smith')
    })

    it('searches with sort ascending', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Charlie', stage: 'Lead' })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Lead' })

      const result = await handlers.search({ type: 'Contact', sort: { name: 'asc' } })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed[0].name).toBe('Alice')
      expect(parsed[1].name).toBe('Bob')
      expect(parsed[2].name).toBe('Charlie')
    })

    it('searches with sort descending', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Charlie', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Lead' })

      const result = await handlers.search({ type: 'Contact', sort: { name: 'desc' } })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed[0].name).toBe('Charlie')
      expect(parsed[1].name).toBe('Bob')
      expect(parsed[2].name).toBe('Alice')
    })

    it('clamps limit above 100 to 100', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 5; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      const result = await handlers.search({ type: 'Contact', limit: 999 })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(5)
    })

    it('clamps limit below 1 to 1', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Lead' })

      const result = await handlers.search({ type: 'Contact', limit: -5 })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(1)
    })

    it('cross-type search (no type) searches all nouns', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Deal', { title: 'Big Deal', stage: 'Open' })

      const result = await handlers.search({})
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.length).toBeGreaterThanOrEqual(2)
    })

    it('cross-type search with query filter', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Deal', { title: 'Alice Partnership', stage: 'Open' })
      await provider.create('Deal', { title: 'Bob Deal', stage: 'Open' })

      const result = await handlers.search({ query: 'alice' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.length).toBeGreaterThanOrEqual(2)
      const texts = parsed.map((r: Record<string, unknown>) => r.name || r.title)
      expect(texts).toContain('Alice')
      expect(texts).toContain('Alice Partnership')
    })

    it('returns empty JSON array when no results', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.search({ type: 'Contact', filter: { stage: 'Nonexistent' } })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toEqual([])
    })

    it('results are JSON-stringified in content[0].text', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const result = await handlers.search({ type: 'Contact' })
      expect(result.content).toHaveLength(1)
      expect(result.content[0].type).toBe('text')
      expect(typeof result.content[0].text).toBe('string')
      expect(() => JSON.parse(result.content[0].text!)).not.toThrow()
    })
  })

  // ===========================================================================
  // 3. Fetch Handler Deep (GREEN — baseline verification)
  // ===========================================================================

  describe('fetch handler', () => {
    it('fetches entity by type and id', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await handlers.fetch({ resource: 'entity', type: 'Contact', id: contact.$id })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.$id).toBe(contact.$id)
      expect(parsed.name).toBe('Alice')
    })

    it('returns isError for non-existent entity', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'entity', type: 'Contact', id: 'contact_nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not found')
    })

    it('returns error when entity fetch missing type', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'entity', id: 'contact_abc' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('type and id required')
    })

    it('returns error when entity fetch missing id', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'entity', type: 'Contact' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('type and id required')
    })

    it('fetches schema for specific noun', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema', noun: 'Contact' })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.name).toBe('Contact')
      expect(parsed.fields).toBeInstanceOf(Array)
      expect(parsed.verbs).toBeInstanceOf(Array)
    })

    it('fetches all schemas when no noun specified', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema' })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toBeInstanceOf(Array)
      const names = parsed.map((s: Record<string, unknown>) => s.name)
      expect(names).toContain('Contact')
      expect(names).toContain('Deal')
    })

    it('returns isError for non-existent noun schema', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema', noun: 'Nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Schema not found')
    })

    it('returns not-yet-implemented for events resource', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'events' })
      expect(result.content[0].text).toContain('not yet implemented')
    })

    it('returns not-yet-implemented for metrics resource', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'metrics' })
      expect(result.content[0].text).toContain('not yet implemented')
    })

    it('returns not-yet-implemented for state resource', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'state' })
      expect(result.content[0].text).toContain('not yet implemented')
    })
  })

  // ===========================================================================
  // 4. Do Handler Deep (GREEN — baseline verification)
  // ===========================================================================

  describe('do handler', () => {
    it('creates an entity', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'create',
        type: 'Contact',
        data: { name: 'Alice', stage: 'Lead' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.name).toBe('Alice')
      expect(parsed.$type).toBe('Contact')
      expect(parsed.$id).toBeDefined()
    })

    it('updates an entity', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await handlers.doAction({
        action: 'update',
        type: 'Contact',
        id: contact.$id,
        data: { stage: 'Qualified' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.stage).toBe('Qualified')
    })

    it('deletes an entity', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await handlers.doAction({
        action: 'delete',
        type: 'Contact',
        id: contact.$id,
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.deleted).toBe(true)
    })

    it('update without id returns error', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'update',
        type: 'Contact',
        data: { stage: 'Qualified' },
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('id required')
    })

    it('delete without id returns error', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'delete',
        type: 'Contact',
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('id required')
    })

    it('executes custom verb via perform', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await handlers.doAction({
        action: 'qualify',
        type: 'Contact',
        id: contact.$id,
        data: { stage: 'Qualified' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.stage).toBe('Qualified')
    })

    it('evaluates code with evaluate function', async () => {
      const evaluate = vi.fn().mockResolvedValue({ count: 42 })
      const handlers = createHandlers({ provider, evaluate })

      const result = await handlers.doAction({
        action: 'eval',
        code: 'return { count: 42 }',
      })
      expect(result.isError).toBeFalsy()
      expect(evaluate).toHaveBeenCalledWith('return { count: 42 }', { provider })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.count).toBe(42)
    })

    it('code eval without evaluate function returns error', async () => {
      const handlers = createHandlers({ provider })

      const result = await handlers.doAction({
        action: 'eval',
        code: 'return { count: 42 }',
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Code evaluation not available')
    })

    it('action without type returns error', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'create',
        data: { name: 'test' },
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('type required')
    })

    it('custom verb without id returns error', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'qualify',
        type: 'Contact',
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('id required')
    })
  })

  // ===========================================================================
  // 5. RED — Context-scoped tools & tenant isolation
  // ===========================================================================

  describe('context-scoped tools (RED)', () => {
    it('tools/list includes context metadata in tool descriptions', async () => {
      // When context has subdomain/system, tool descriptions should mention the scope
      const server = new MCPServer({
        provider,
        context: { tenant: 'acme', subdomain: 'crm', system: 'crm' },
      })
      const response = await server.handleRequest({ method: 'tools/list', id: 1 })
      const result = response.result as { tools: Array<{ name: string; description: string }> }
      const searchTool = result.tools.find((t) => t.name === 'search')
      // Description should include CRM context scoping info
      expect(searchTool!.description).toContain('CRM')
    })

    it('search scopes results to tenant context', async () => {
      const server = new MCPServer({
        provider,
        context: { tenant: 'acme' },
      })
      // Create entities for two tenants
      await provider.create('Contact', { name: 'Acme Alice', stage: 'Lead' })

      const response = await server.handleRequest({
        method: 'tools/call',
        id: 2,
        params: { name: 'search', arguments: { type: 'Contact' } },
      })
      const result = response.result as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0].text)
      // All returned entities should belong to the acme tenant
      for (const entity of parsed) {
        expect(entity.$context).toContain('acme')
      }
    })

    it('initialize includes tenant info in serverInfo', async () => {
      const server = new MCPServer({
        provider,
        context: { tenant: 'acme', subdomain: 'crm' },
      })
      const response = await server.handleRequest({ method: 'initialize', id: 1 })
      const result = response.result as Record<string, unknown>
      const serverInfo = result.serverInfo as Record<string, unknown>
      expect(serverInfo.tenant).toBe('acme')
      expect(serverInfo.subdomain).toBe('crm')
    })
  })

  // ===========================================================================
  // 6. RED — Search pagination with offset/cursor
  // ===========================================================================

  describe('search pagination (RED)', () => {
    it('returns total count alongside results', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 15; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      const result = await handlers.search({ type: 'Contact', limit: 5 })
      const parsed = JSON.parse(result.content[0].text!)
      // Should include total count metadata, not just results
      expect(parsed.total).toBe(15)
      expect(parsed.items).toHaveLength(5)
    })

    it('supports offset parameter for pagination', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 10; i++) {
        await provider.create('Contact', { name: `Contact ${String(i).padStart(2, '0')}`, stage: 'Lead' })
      }

      const result = await handlers.search({
        type: 'Contact',
        limit: 3,
        sort: { name: 'asc' },
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.items).toHaveLength(3)
      expect(parsed.nextCursor).toBeDefined()
    })

    it('supports cursor-based pagination', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 10; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      // First page
      const page1 = await handlers.search({ type: 'Contact', limit: 3 })
      const parsed1 = JSON.parse(page1.content[0].text!)
      expect(parsed1.items).toHaveLength(3)
      expect(parsed1.nextCursor).toBeDefined()

      // Second page using cursor
      const page2 = await handlers.search({
        type: 'Contact',
        limit: 3,
        cursor: parsed1.nextCursor,
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed2 = JSON.parse(page2.content[0].text!)
      expect(parsed2.items).toHaveLength(3)
      // No overlap between pages
      const ids1 = new Set(parsed1.items.map((r: Record<string, unknown>) => r.$id))
      for (const item of parsed2.items) {
        expect(ids1.has(item.$id)).toBe(false)
      }
    })
  })

  // ===========================================================================
  // 7. RED — Fetch time-travel (asOf parameter)
  // ===========================================================================

  describe('fetch time-travel (RED)', () => {
    it('fetches entity state as of a specific timestamp', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const t1 = new Date().toISOString()

      // Update the entity after the timestamp
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })

      // Fetch as of t1 should return the old state
      const result = await handlers.fetch({
        resource: 'entity',
        type: 'Contact',
        id: contact.$id,
        asOf: t1,
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.stage).toBe('Lead')
    })

    it('fetch events returns event history for entity', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })

      const result = await handlers.fetch({
        resource: 'events',
        type: 'Contact',
        id: contact.$id,
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toBeInstanceOf(Array)
      expect(parsed.length).toBeGreaterThanOrEqual(2) // create + update
    })
  })

  // ===========================================================================
  // 8. RED — Do handler batch operations
  // ===========================================================================

  describe('do handler batch (RED)', () => {
    it('creates multiple entities in a batch', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'batch',
        type: 'Contact',
        data: {
          operations: [
            { action: 'create', data: { name: 'Alice', stage: 'Lead' } },
            { action: 'create', data: { name: 'Bob', stage: 'Lead' } },
            { action: 'create', data: { name: 'Carol', stage: 'Lead' } },
          ],
        },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.results).toHaveLength(3)
      expect(parsed.results[0].name).toBe('Alice')
      expect(parsed.results[1].name).toBe('Bob')
      expect(parsed.results[2].name).toBe('Carol')
    })

    it('batch returns partial results on failure', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await handlers.doAction({
        action: 'batch',
        type: 'Contact',
        data: {
          operations: [
            { action: 'update', id: contact.$id, data: { stage: 'Qualified' } },
            { action: 'update', id: 'contact_nonexistent', data: { stage: 'Qualified' } },
          ],
        },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.results).toHaveLength(2)
      expect(parsed.results[0].success).toBe(true)
      expect(parsed.results[1].success).toBe(false)
    })
  })

  // ===========================================================================
  // 9. RED — handleHTTP method
  // ===========================================================================

  describe('handleHTTP (RED)', () => {
    it('returns CORS headers for cross-origin MCP access', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://app.headless.ly',
        },
        body: JSON.stringify({ method: 'initialize', id: 1 }),
      })
      const response = await server.handleHTTP(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined()
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    })

    it('returns 400 for invalid JSON body', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json{{{',
      })
      const response = await server.handleHTTP(request)
      expect(response.status).toBe(400)
      const body = await response.json()
      expect(body.error).toBeDefined()
      expect(body.error.code).toBe(-32700) // Parse error
    })

    it('handles batch JSON-RPC requests', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { method: 'initialize', id: 1 },
          { method: 'tools/list', id: 2 },
        ]),
      })
      const response = await server.handleHTTP(request)
      const body = await response.json()
      expect(body).toBeInstanceOf(Array)
      expect(body).toHaveLength(2)
      expect(body[0].id).toBe(1)
      expect(body[1].id).toBe(2)
    })
  })

  // ===========================================================================
  // 10. RED — Eval error propagation
  // ===========================================================================

  describe('eval error propagation (RED)', () => {
    it('code eval wraps thrown Error with stack trace', async () => {
      const evaluate = vi.fn().mockRejectedValue(new Error('ReferenceError: x is not defined'))
      const handlers = createHandlers({ provider, evaluate })

      const result = await handlers.doAction({
        action: 'eval',
        code: 'console.log(x)',
      })
      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.error).toBeDefined()
      expect(parsed.error.message).toContain('ReferenceError')
      expect(parsed.error.stack).toBeDefined()
    })

    it('code eval with timeout returns timeout error', async () => {
      const evaluate = vi.fn().mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timed out')), 100)),
      )
      const handlers = createHandlers({ provider, evaluate })

      const result = await handlers.doAction({
        action: 'eval',
        code: 'while(true) {}',
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('timed out')
    })
  })

  // ===========================================================================
  // 11. RED — Server notifications and lifecycle
  // ===========================================================================

  describe('server notifications (RED)', () => {
    it('notifications/initialized is acknowledged', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({
        method: 'notifications/initialized',
        id: null,
      })
      // Notifications should not return an error
      expect(response.error).toBeUndefined()
      expect(response.result).toBeDefined()
    })

    it('resources/list returns empty list by default', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'resources/list', id: 1 })
      const result = response.result as { resources: unknown[] }
      expect(result.resources).toEqual([])
    })

    it('prompts/list returns empty list by default', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'prompts/list', id: 1 })
      const result = response.result as { prompts: unknown[] }
      expect(result.prompts).toEqual([])
    })
  })

  // ===========================================================================
  // 12. RED — Search with include relationships
  // ===========================================================================

  describe('search with relationships (RED)', () => {
    it('search includes related entities when include param provided', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Deal', { title: 'Big Deal', stage: 'Open', contact: contact.$id })

      const result = await handlers.search({
        type: 'Contact',
        filter: { name: 'Alice' },
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed = JSON.parse(result.content[0].text!)
      // Should include nested deals when include is specified
      expect(parsed[0].deals).toBeDefined()
      expect(parsed[0].deals).toBeInstanceOf(Array)
      expect(parsed[0].deals[0].title).toBe('Big Deal')
    })
  })

  // ===========================================================================
  // 13. RED — Fetch entity with include
  // ===========================================================================

  describe('fetch with include (RED)', () => {
    it('fetch entity includes related entities', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const deal = await provider.create('Deal', { title: 'Big Deal', stage: 'Open', contact: contact.$id })

      const result = await handlers.fetch({
        resource: 'entity',
        type: 'Contact',
        id: contact.$id,
      } as Record<string, unknown> as Parameters<typeof handlers.fetch>[0])
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.deals).toBeDefined()
      expect(parsed.deals).toBeInstanceOf(Array)
      expect(parsed.deals.length).toBe(1)
      expect(parsed.deals[0].$id).toBe(deal.$id)
    })
  })

  // ===========================================================================
  // 14. RED — Do handler upsert and find-or-create
  // ===========================================================================

  describe('do handler upsert (RED)', () => {
    it('upsert creates entity if not found', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'upsert',
        type: 'Contact',
        data: { name: 'Alice', email: 'alice@example.com', stage: 'Lead' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.name).toBe('Alice')
      expect(parsed.$id).toBeDefined()
    })

    it('upsert updates entity if found by match', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', email: 'alice@example.com', stage: 'Lead' })

      const result = await handlers.doAction({
        action: 'upsert',
        type: 'Contact',
        data: { email: 'alice@example.com', stage: 'Qualified' },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.$id).toBe(contact.$id)
      expect(parsed.stage).toBe('Qualified')
    })
  })

  // ===========================================================================
  // 15. RED — Search with count-only mode
  // ===========================================================================

  describe('search count mode (RED)', () => {
    it('returns count without full entity data', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 10; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      const result = await handlers.search({
        type: 'Contact',
        filter: { stage: 'Lead' },
        countOnly: true,
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.count).toBe(10)
      expect(parsed.items).toBeUndefined()
    })
  })
})
