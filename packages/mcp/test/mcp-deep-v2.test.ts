import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearRegistry, setProvider, MemoryNounProvider, Noun } from 'digital-objects'
import { MCPServer } from '../src/server'
import { getTools } from '../src/tools'
import { createHandlers } from '../src/handlers'
import type { MCPTool, MCPToolResult, MCPContext } from '../src/types'

describe('@headlessly/mcp — deep v2 tests', () => {
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

    Noun('Company', {
      name: 'string!',
      industry: 'string?',
    })
  })

  // ===========================================================================
  // 1. Tool Schema Validation (getTools)
  // ===========================================================================

  describe('tool schema structure', () => {
    it('each tool has name, description, and inputSchema with type object', () => {
      const tools = getTools()
      for (const tool of tools) {
        expect(tool.name).toBeDefined()
        expect(typeof tool.name).toBe('string')
        expect(tool.description).toBeDefined()
        expect(typeof tool.description).toBe('string')
        expect(tool.inputSchema.type).toBe('object')
        expect(tool.inputSchema.properties).toBeDefined()
      }
    })

    it('search tool has query, filter, limit, sort, type properties', () => {
      const tools = getTools()
      const search = tools.find((t) => t.name === 'search')!
      const props = Object.keys(search.inputSchema.properties)
      expect(props).toContain('type')
      expect(props).toContain('query')
      expect(props).toContain('filter')
      expect(props).toContain('limit')
      expect(props).toContain('sort')
    })

    it('search tool type property has enum of registered nouns', () => {
      const tools = getTools()
      const search = tools.find((t) => t.name === 'search')!
      const typeProp = search.inputSchema.properties.type
      expect(typeProp.enum).toBeDefined()
      expect(typeProp.enum).toContain('Contact')
      expect(typeProp.enum).toContain('Deal')
      expect(typeProp.enum).toContain('Company')
    })

    it('fetch tool requires resource field', () => {
      const tools = getTools()
      const fetchTool = tools.find((t) => t.name === 'fetch')!
      expect(fetchTool.inputSchema.required).toContain('resource')
    })

    it('fetch tool resource enum includes all resource types', () => {
      const tools = getTools()
      const fetchTool = tools.find((t) => t.name === 'fetch')!
      const resourceProp = fetchTool.inputSchema.properties.resource
      expect(resourceProp.enum).toEqual(['entity', 'schema', 'events', 'metrics', 'state'])
    })

    it('do tool requires action field', () => {
      const tools = getTools()
      const doTool = tools.find((t) => t.name === 'do')!
      expect(doTool.inputSchema.required).toContain('action')
    })

    it('do tool has code property for eval', () => {
      const tools = getTools()
      const doTool = tools.find((t) => t.name === 'do')!
      expect(doTool.inputSchema.properties.code).toBeDefined()
      expect(doTool.inputSchema.properties.code.type).toBe('string')
    })

    it('tool descriptions reference headless.ly', () => {
      const tools = getTools()
      for (const tool of tools) {
        expect(tool.description.toLowerCase()).toContain('headless.ly')
      }
    })
  })

  // ===========================================================================
  // 2. Context Scoping in Tool Descriptions
  // ===========================================================================

  describe('context-scoped tool descriptions', () => {
    it('tools without context have no system scoping text', () => {
      const tools = getTools()
      const search = tools.find((t) => t.name === 'search')!
      expect(search.description).not.toContain('Scoped to')
    })

    it('system context adds uppercase system label', () => {
      const tools = getTools({ system: 'crm' })
      const search = tools.find((t) => t.name === 'search')!
      expect(search.description).toContain('Scoped to CRM context')
    })

    it('all three tools get context suffix when system is set', () => {
      const tools = getTools({ system: 'billing' })
      for (const tool of tools) {
        expect(tool.description).toContain('Scoped to BILLING context')
      }
    })

    it('context with subdomain but no system does not add scoping text', () => {
      const tools = getTools({ subdomain: 'crm' })
      const search = tools.find((t) => t.name === 'search')!
      expect(search.description).not.toContain('Scoped to')
    })
  })

  // ===========================================================================
  // 3. JSON-RPC Protocol Details
  // ===========================================================================

  describe('JSON-RPC protocol edge cases', () => {
    it('response always has jsonrpc 2.0 field', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: 1 })
      expect(response.jsonrpc).toBe('2.0')
    })

    it('preserves null id in response', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: null })
      expect(response.id).toBeNull()
    })

    it('preserves string id in response', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: 'request-uuid-42' })
      expect(response.id).toBe('request-uuid-42')
    })

    it('preserves numeric zero id', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: 0 })
      expect(response.id).toBe(0)
    })

    it('error response includes jsonrpc and id', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'nonexistent/method', id: 999 })
      expect(response.jsonrpc).toBe('2.0')
      expect(response.id).toBe(999)
      expect(response.error).toBeDefined()
    })

    it('error message includes the unrecognized method name', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'custom/unknown', id: 1 })
      const error = response.error as { code: number; message: string }
      expect(error.message).toContain('custom/unknown')
    })

    it('tools/call with missing params still works (empty args)', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: { name: 'search' },
      })
      // Should not throw — uses empty args
      const result = response.result as MCPToolResult
      expect(result.content).toBeDefined()
    })
  })

  // ===========================================================================
  // 4. HTTP Handler Deep
  // ===========================================================================

  describe('HTTP handler deep', () => {
    it('OPTIONS preflight returns 204 with CORS headers', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'OPTIONS',
      })
      const response = await server.handleHTTP(request)
      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type')
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization')
    })

    it('POST response includes Content-Type application/json', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'initialize', id: 1 }),
      })
      const response = await server.handleHTTP(request)
      expect(response.headers.get('Content-Type')).toBe('application/json')
    })

    it('POST response includes CORS headers', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'initialize', id: 1 }),
      })
      const response = await server.handleHTTP(request)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })

    it('invalid JSON returns parse error with CORS headers', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{broken json',
      })
      const response = await server.handleHTTP(request)
      expect(response.status).toBe(400)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
      const body = (await response.json()) as Record<string, unknown>
      expect(body.jsonrpc).toBe('2.0')
      expect(body.id).toBeNull()
    })

    it('batch HTTP request processes each request independently', async () => {
      const server = new MCPServer({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { method: 'tools/list', id: 1 },
          { method: 'tools/call', id: 2, params: { name: 'search', arguments: { type: 'Contact' } } },
          { method: 'nonexistent', id: 3 },
        ]),
      })
      const response = await server.handleHTTP(request)
      const body = (await response.json()) as Array<Record<string, unknown>>
      expect(body).toHaveLength(3)
      // First: tools/list succeeds
      expect(body[0].result).toBeDefined()
      // Second: tools/call succeeds
      expect(body[1].result).toBeDefined()
      // Third: unknown method errors
      expect(body[2].error).toBeDefined()
    })
  })

  // ===========================================================================
  // 5. Search Pagination Deep
  // ===========================================================================

  describe('search pagination deep', () => {
    it('no pagination metadata when all results fit within default limit', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Lead' })

      const result = await handlers.search({ type: 'Contact' })
      const parsed = JSON.parse(result.content[0].text!)
      // When no explicit limit or all results fit, returns plain array
      expect(Array.isArray(parsed)).toBe(true)
    })

    it('last page has no nextCursor', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 5; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      // Request with limit larger than total
      const result = await handlers.search({ type: 'Contact', limit: 10 })
      const parsed = JSON.parse(result.content[0].text!)
      // 5 items fit in 10 limit, no pagination needed — should be plain array
      expect(Array.isArray(parsed)).toBe(true)
    })

    it('invalid cursor starts from beginning', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 5; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      const result = await handlers.search({
        type: 'Contact',
        limit: 3,
        cursor: 'not-valid-base64!!!',
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.items).toHaveLength(3)
      expect(parsed.total).toBe(5)
    })

    it('walking all pages covers all entities', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 8; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      const allIds: string[] = []
      let cursor: string | undefined = undefined

      // Walk pages of 3
      for (let page = 0; page < 5; page++) {
        const args: Record<string, unknown> = { type: 'Contact', limit: 3 }
        if (cursor) args.cursor = cursor
        const result = await handlers.search(args as Parameters<typeof handlers.search>[0])
        const parsed = JSON.parse(result.content[0].text!)

        if (parsed.items) {
          allIds.push(...parsed.items.map((r: Record<string, unknown>) => r.$id))
          cursor = parsed.nextCursor
          if (!cursor) break
        } else {
          // Plain array (last page or all fit)
          allIds.push(...parsed.map((r: Record<string, unknown>) => r.$id))
          break
        }
      }

      expect(allIds).toHaveLength(8)
      // All IDs are unique
      expect(new Set(allIds).size).toBe(8)
    })

    it('offset-based pagination skips results', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 10; i++) {
        await provider.create('Contact', { name: `C${String(i).padStart(2, '0')}`, stage: 'Lead' })
      }

      const result = await handlers.search({
        type: 'Contact',
        limit: 3,
        offset: 5,
        sort: { name: 'asc' },
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.items).toHaveLength(3)
      // Should start from 5th item (C05, C06, C07)
      expect(parsed.items[0].name).toBe('C05')
    })

    it('count-only mode returns only count, no items array', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 7; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      const result = await handlers.search({
        type: 'Contact',
        countOnly: true,
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.count).toBe(7)
      expect(parsed.items).toBeUndefined()
    })

    it('count-only with filter counts only matching', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Qualified' })
      await provider.create('Contact', { name: 'Carol', stage: 'Lead' })

      const result = await handlers.search({
        type: 'Contact',
        filter: { stage: 'Lead' },
        countOnly: true,
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.count).toBe(2)
    })
  })

  // ===========================================================================
  // 6. Search Combined Filters
  // ===========================================================================

  describe('search combined filters', () => {
    it('filter + query applies both', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice Smith', stage: 'Lead' })
      await provider.create('Contact', { name: 'Alice Jones', stage: 'Qualified' })
      await provider.create('Contact', { name: 'Bob Smith', stage: 'Lead' })

      const result = await handlers.search({
        type: 'Contact',
        filter: { stage: 'Lead' },
        query: 'alice',
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('Alice Smith')
    })

    it('filter + sort + limit', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Zara', stage: 'Lead' })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Qualified' })
      await provider.create('Contact', { name: 'Carol', stage: 'Lead' })

      const result = await handlers.search({
        type: 'Contact',
        filter: { stage: 'Lead' },
        sort: { name: 'asc' },
        limit: 2,
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.items).toHaveLength(2)
      expect(parsed.items[0].name).toBe('Alice')
      expect(parsed.items[1].name).toBe('Carol')
    })

    it('query is case-insensitive', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice Smith', stage: 'Lead' })

      const result = await handlers.search({ type: 'Contact', query: 'ALICE' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('Alice Smith')
    })

    it('query matches any string field', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Bob', email: 'alice@example.com', stage: 'Lead' })

      const result = await handlers.search({ type: 'Contact', query: 'alice' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].name).toBe('Bob') // matched on email, not name
    })

    it('empty filter returns all entities', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Qualified' })

      const result = await handlers.search({ type: 'Contact', filter: {} })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(2)
    })
  })

  // ===========================================================================
  // 7. Fetch Schema Detail Validation
  // ===========================================================================

  describe('fetch schema detail validation', () => {
    it('single noun schema includes singular and plural', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema', noun: 'Contact' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.singular).toBeDefined()
      expect(parsed.plural).toBeDefined()
    })

    it('single noun schema fields have key property', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema', noun: 'Contact' })
      const parsed = JSON.parse(result.content[0].text!)
      const fieldKeys = parsed.fields.map((f: { key: string }) => f.key)
      expect(fieldKeys).toContain('name')
      expect(fieldKeys).toContain('email')
      expect(fieldKeys).toContain('stage')
    })

    it('single noun schema includes relationships', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema', noun: 'Contact' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.relationships).toBeInstanceOf(Array)
      const relKeys = parsed.relationships.map((r: { key: string }) => r.key)
      expect(relKeys).toContain('company')
    })

    it('single noun schema includes verbs', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema', noun: 'Contact' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.verbs).toBeInstanceOf(Array)
      expect(parsed.verbs.length).toBeGreaterThan(0)
    })

    it('single noun schema includes disabledVerbs array', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema', noun: 'Contact' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.disabledVerbs).toBeInstanceOf(Array)
    })

    it('all-schemas response includes field/rel/verb counts per noun', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema' })
      const parsed = JSON.parse(result.content[0].text!)
      for (const schema of parsed) {
        expect(typeof schema.name).toBe('string')
        expect(typeof schema.fields).toBe('number')
        expect(typeof schema.relationships).toBe('number')
        expect(typeof schema.verbs).toBe('number')
      }
    })

    it('all-schemas lists all registered nouns', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema' })
      const parsed = JSON.parse(result.content[0].text!)
      const names = parsed.map((s: { name: string }) => s.name)
      expect(names).toContain('Contact')
      expect(names).toContain('Deal')
      expect(names).toContain('Company')
    })
  })

  // ===========================================================================
  // 8. Fetch Unknown Resource Type
  // ===========================================================================

  describe('fetch unknown resource', () => {
    it('returns isError for unknown resource type', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'nonexistent' as 'entity' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unknown resource')
    })
  })

  // ===========================================================================
  // 9. Time-Travel / Event Log Deep
  // ===========================================================================

  describe('time-travel and event log', () => {
    it('event log records create events', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await handlers.fetch({ resource: 'events', type: 'Contact', id: contact.$id })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].action).toBe('create')
    })

    it('event log records update events after create', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })

      const result = await handlers.fetch({ resource: 'events', type: 'Contact', id: contact.$id })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].action).toBe('create')
      expect(parsed[1].action).toBe('update')
    })

    it('event log records delete events', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.delete('Contact', contact.$id)

      const result = await handlers.fetch({ resource: 'events', type: 'Contact', id: contact.$id })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(2)
      expect(parsed[1].action).toBe('delete')
    })

    it('event log records perform/verb events', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.perform('Contact', 'qualify', contact.$id, { stage: 'Qualified' })

      const result = await handlers.fetch({ resource: 'events', type: 'Contact', id: contact.$id })
      const parsed = JSON.parse(result.content[0].text!)
      // create + qualify = 2 events (perform logs verb action, no separate update)
      expect(parsed).toHaveLength(2)
      const actions = parsed.map((e: { action: string }) => e.action)
      expect(actions).toContain('qualify')
    })

    it('events include timestamps', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await handlers.fetch({ resource: 'events', type: 'Contact', id: contact.$id })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed[0].timestamp).toBeDefined()
      // Timestamp should be a valid ISO string
      expect(new Date(parsed[0].timestamp).toISOString()).toBe(parsed[0].timestamp)
    })

    it('events without type and id returns not-implemented message', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'events' })
      expect(result.content[0].text).toContain('not yet implemented')
    })

    it('time-travel with asOf before entity exists returns error', async () => {
      const pastTime = new Date(Date.now() - 100000).toISOString()
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await handlers.fetch({
        resource: 'entity',
        type: 'Contact',
        id: contact.$id,
        asOf: pastTime,
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not found')
    })

    it('events for non-existent entity returns empty array', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'events', type: 'Contact', id: 'contact_nonexistent' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toEqual([])
    })
  })

  // ===========================================================================
  // 10. Do Handler Edge Cases
  // ===========================================================================

  describe('do handler edge cases', () => {
    it('create with no data still creates entity with meta fields', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({ action: 'create', type: 'Contact' })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.$id).toBeDefined()
      expect(parsed.$type).toBe('Contact')
    })

    it('batch without operations array returns error', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'batch',
        type: 'Contact',
        data: { notOperations: [] },
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('operations')
    })

    it('batch with empty operations array succeeds with empty results', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'batch',
        type: 'Contact',
        data: { operations: [] },
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.results).toEqual([])
    })

    it('batch with mixed create/update/delete', async () => {
      const handlers = createHandlers({ provider })
      const existing = await provider.create('Contact', { name: 'Existing', stage: 'Lead' })

      const result = await handlers.doAction({
        action: 'batch',
        type: 'Contact',
        data: {
          operations: [
            { action: 'create', data: { name: 'New', stage: 'Lead' } },
            { action: 'update', id: existing.$id, data: { stage: 'Qualified' } },
            { action: 'delete', id: existing.$id },
          ],
        },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.results).toHaveLength(3)
      expect(parsed.results[0].success).toBe(true)
      expect(parsed.results[0].name).toBe('New')
      expect(parsed.results[1].success).toBe(true)
      expect(parsed.results[1].stage).toBe('Qualified')
      expect(parsed.results[2].success).toBe(true)
      expect(parsed.results[2].deleted).toBe(true)
    })

    it('batch with unknown sub-action returns per-op error', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'batch',
        type: 'Contact',
        data: {
          operations: [{ action: 'frobnicate' }],
        },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.results[0].success).toBe(false)
      expect(parsed.results[0].error).toContain('Unknown batch action')
    })

    it('batch update without op.id reports error for that op', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'batch',
        type: 'Contact',
        data: {
          operations: [{ action: 'update', data: { stage: 'Qualified' } }],
        },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.results[0].success).toBe(false)
      expect(parsed.results[0].error).toContain('id required')
    })
  })

  // ===========================================================================
  // 11. Eval Handler Deep
  // ===========================================================================

  describe('eval handler deep', () => {
    it('eval passes provider in context to evaluate function', async () => {
      const evaluate = vi.fn().mockResolvedValue('ok')
      const handlers = createHandlers({ provider, evaluate })

      await handlers.doAction({ action: 'eval', code: 'test' })
      expect(evaluate).toHaveBeenCalledWith('test', { provider })
    })

    it('eval with non-Error thrown returns string representation', async () => {
      const evaluate = vi.fn().mockRejectedValue('plain string error')
      const handlers = createHandlers({ provider, evaluate })

      const result = await handlers.doAction({ action: 'eval', code: 'throw "oops"' })
      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.error.message).toBe('plain string error')
    })

    it('eval with null return value succeeds', async () => {
      const evaluate = vi.fn().mockResolvedValue(null)
      const handlers = createHandlers({ provider, evaluate })

      const result = await handlers.doAction({ action: 'eval', code: 'return null' })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toBeNull()
    })

    it('eval action without code falls through to CRUD (needs type)', async () => {
      const handlers = createHandlers({ provider })
      // eval with no code and no type should require type
      const result = await handlers.doAction({ action: 'eval' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('type required')
    })
  })

  // ===========================================================================
  // 12. Server Initialize Context
  // ===========================================================================

  describe('server initialize context variants', () => {
    it('initialize without context omits tenant/subdomain in serverInfo', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: 1 })
      const result = response.result as Record<string, unknown>
      const serverInfo = result.serverInfo as Record<string, unknown>
      expect(serverInfo.tenant).toBeUndefined()
      expect(serverInfo.subdomain).toBeUndefined()
    })

    it('initialize with only tenant includes tenant in serverInfo', async () => {
      const server = new MCPServer({ provider, context: { tenant: 'acme' } })
      const response = await server.handleRequest({ method: 'initialize', id: 1 })
      const result = response.result as Record<string, unknown>
      const serverInfo = result.serverInfo as Record<string, unknown>
      expect(serverInfo.tenant).toBe('acme')
      expect(serverInfo.subdomain).toBeUndefined()
    })

    it('initialize with journey context', async () => {
      const server = new MCPServer({ provider, context: { journey: 'build', subdomain: 'build' } })
      const response = await server.handleRequest({ method: 'initialize', id: 1 })
      const result = response.result as Record<string, unknown>
      const serverInfo = result.serverInfo as Record<string, unknown>
      expect(serverInfo.subdomain).toBe('build')
    })

    it('capabilities always include tools', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: 1 })
      const result = response.result as Record<string, unknown>
      expect(result.capabilities).toEqual({ tools: {} })
    })
  })

  // ===========================================================================
  // 13. Tenant Scoping in Search
  // ===========================================================================

  describe('tenant scoping in search', () => {
    it('search without tenant context does not add $context', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await handlers.search({ type: 'Contact' })
      const parsed = JSON.parse(result.content[0].text!)
      // Should have original $context, not a tenant-scoped one
      expect(parsed[0].$context).toBeDefined()
    })

    it('search with tenant stamps $context on entities missing it', async () => {
      const handlers = createHandlers({ provider, context: { tenant: 'acme' } })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await handlers.search({ type: 'Contact' })
      const parsed = JSON.parse(result.content[0].text!)
      // Should have acme-scoped context
      expect(parsed[0].$context).toContain('acme')
    })
  })

  // ===========================================================================
  // 14. Upsert Deep
  // ===========================================================================

  describe('upsert deep', () => {
    it('upsert with no existing entities creates new', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'upsert',
        type: 'Contact',
        data: { name: 'Alice', stage: 'Lead' },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.$type).toBe('Contact')
      expect(parsed.name).toBe('Alice')

      // Verify it was created
      const all = await provider.find('Contact', {})
      expect(all).toHaveLength(1)
    })

    it('upsert matched by indexed field (email#) updates existing', async () => {
      const handlers = createHandlers({ provider })
      const original = await provider.create('Contact', { name: 'Alice', email: 'alice@test.com', stage: 'Lead' })

      const result = await handlers.doAction({
        action: 'upsert',
        type: 'Contact',
        data: { email: 'alice@test.com', stage: 'Qualified' },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.$id).toBe(original.$id)
      expect(parsed.stage).toBe('Qualified')

      // Should not create a second entity
      const all = await provider.find('Contact', {})
      expect(all).toHaveLength(1)
    })

    it('upsert with no indexed field matches on data field values', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      // name is not indexed but matches existing entity
      const result = await handlers.doAction({
        action: 'upsert',
        type: 'Contact',
        data: { name: 'Alice', stage: 'Customer' },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.stage).toBe('Customer')
    })
  })

  // ===========================================================================
  // 15. Relationship Loading
  // ===========================================================================

  describe('relationship loading', () => {
    it('search enriches entities with reverse relationships', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Deal', { title: 'Big Deal', stage: 'Open', contact: contact.$id })

      const result = await handlers.search({ type: 'Contact', filter: { name: 'Alice' } })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed[0].deals).toBeDefined()
      expect(parsed[0].deals).toHaveLength(1)
      expect(parsed[0].deals[0].title).toBe('Big Deal')
    })

    it('fetch entity enriches with reverse relationships', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Deal', { title: 'Deal A', stage: 'Open', contact: contact.$id })
      await provider.create('Deal', { title: 'Deal B', stage: 'Open', contact: contact.$id })

      const result = await handlers.fetch({ resource: 'entity', type: 'Contact', id: contact.$id })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.deals).toBeDefined()
      expect(parsed.deals).toHaveLength(2)
    })

    it('entity with no reverse relationships returns clean object', async () => {
      const handlers = createHandlers({ provider })
      const company = await provider.create('Company', { name: 'Acme Inc', industry: 'Tech' })

      const result = await handlers.fetch({ resource: 'entity', type: 'Company', id: company.$id })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.name).toBe('Acme Inc')
      // No extra relationship keys injected
      expect(parsed.contacts).toBeUndefined()
    })
  })

  // ===========================================================================
  // 16. Cross-Type Search Edge Cases
  // ===========================================================================

  describe('cross-type search edge cases', () => {
    it('cross-type search respects limit across all types', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 5; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }
      for (let i = 0; i < 5; i++) {
        await provider.create('Deal', { title: `Deal ${i}`, stage: 'Open' })
      }

      const result = await handlers.search({ limit: 3 })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(3)
    })

    it('cross-type search with query searches across all types', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Unique Name', stage: 'Lead' })
      await provider.create('Deal', { title: 'Unique Deal', stage: 'Open' })
      await provider.create('Company', { name: 'Unique Corp' })

      const result = await handlers.search({ query: 'unique' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.length).toBeGreaterThanOrEqual(3)
    })
  })

  // ===========================================================================
  // 17. MCPServer executeTool Unknown Tool
  // ===========================================================================

  describe('MCPServer unknown tool via tools/call', () => {
    it('returns descriptive error with tool name', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: { name: 'execute', arguments: {} },
      })
      const result = response.result as MCPToolResult
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('execute')
    })

    it('returns descriptive error for empty tool name', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: { name: '', arguments: {} },
      })
      const result = response.result as MCPToolResult
      expect(result.isError).toBe(true)
    })
  })

  // ===========================================================================
  // 18. Search Empty Database
  // ===========================================================================

  describe('search on empty database', () => {
    it('typed search returns empty array', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.search({ type: 'Contact' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toEqual([])
    })

    it('cross-type search returns empty array', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.search({})
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toEqual([])
    })

    it('count-only on empty returns zero', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.search({
        type: 'Contact',
        countOnly: true,
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.count).toBe(0)
    })
  })
})
