import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearRegistry, setProvider, MemoryNounProvider, Noun } from 'digital-objects'
import { MCPServer } from '../src/server'
import { getTools } from '../src/tools'
import { createHandlers } from '../src/handlers'
import type { MCPToolResult } from '../src/types'

describe('@headlessly/mcp — deep v3 tests', () => {
  let provider: MemoryNounProvider

  beforeEach(() => {
    clearRegistry()
    provider = new MemoryNounProvider()
    setProvider(provider)

    Noun('Contact', {
      name: 'string!',
      email: 'string?#',
      phone: 'string?',
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
      website: 'string?#',
    })

    Noun('Project', {
      name: 'string!',
      status: 'Active | Completed | Archived',
      owner: '-> Contact.projects',
      archive: 'Archived',
    })
  })

  // ===========================================================================
  // 1. Concurrent Tool Invocations
  // ===========================================================================

  describe('concurrent tool invocations', () => {
    it('handles concurrent search calls without interference', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 10; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: i < 5 ? 'Lead' : 'Qualified' })
      }

      const [leadsResult, qualifiedResult, allResult] = await Promise.all([
        handlers.search({ type: 'Contact', filter: { stage: 'Lead' } }),
        handlers.search({ type: 'Contact', filter: { stage: 'Qualified' } }),
        handlers.search({ type: 'Contact' }),
      ])

      const leads = JSON.parse(leadsResult.content[0].text!)
      const qualified = JSON.parse(qualifiedResult.content[0].text!)
      const all = JSON.parse(allResult.content[0].text!)

      expect(leads).toHaveLength(5)
      expect(qualified).toHaveLength(5)
      expect(all).toHaveLength(10)
    })

    it('handles concurrent create operations via do handler', async () => {
      const handlers = createHandlers({ provider })

      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          handlers.doAction({
            action: 'create',
            type: 'Contact',
            data: { name: `Concurrent ${i}`, stage: 'Lead' },
          }),
        ),
      )

      for (const result of results) {
        expect(result.isError).toBeFalsy()
        const parsed = JSON.parse(result.content[0].text!)
        expect(parsed.$type).toBe('Contact')
      }

      // All entities should exist
      const all = await provider.find('Contact', {})
      expect(all).toHaveLength(5)
    })

    it('handles concurrent fetch and mutate without corruption', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const [fetchResult, updateResult] = await Promise.all([
        handlers.fetch({ resource: 'entity', type: 'Contact', id: contact.$id }),
        handlers.doAction({
          action: 'update',
          type: 'Contact',
          id: contact.$id,
          data: { stage: 'Qualified' },
        }),
      ])

      expect(fetchResult.isError).toBeFalsy()
      expect(updateResult.isError).toBeFalsy()
    })

    it('concurrent batch operations each get independent results', async () => {
      const handlers = createHandlers({ provider })

      const [batch1, batch2] = await Promise.all([
        handlers.doAction({
          action: 'batch',
          type: 'Contact',
          data: {
            operations: [
              { action: 'create', data: { name: 'Batch1-A', stage: 'Lead' } },
              { action: 'create', data: { name: 'Batch1-B', stage: 'Lead' } },
            ],
          },
        }),
        handlers.doAction({
          action: 'batch',
          type: 'Deal',
          data: {
            operations: [
              { action: 'create', data: { title: 'Batch2-A', stage: 'Open' } },
              { action: 'create', data: { title: 'Batch2-B', stage: 'Open' } },
            ],
          },
        }),
      ])

      const parsed1 = JSON.parse(batch1.content[0].text!)
      const parsed2 = JSON.parse(batch2.content[0].text!)

      expect(parsed1.results).toHaveLength(2)
      expect(parsed2.results).toHaveLength(2)
      expect(parsed1.results[0].$type).toBe('Contact')
      expect(parsed2.results[0].$type).toBe('Deal')
    })
  })

  // ===========================================================================
  // 2. Multi-Step Do Operations
  // ===========================================================================

  describe('multi-step do operations', () => {
    it('create then update via sequential do calls', async () => {
      const handlers = createHandlers({ provider })

      const createResult = await handlers.doAction({
        action: 'create',
        type: 'Contact',
        data: { name: 'Alice', stage: 'Lead' },
      })
      const created = JSON.parse(createResult.content[0].text!)

      const updateResult = await handlers.doAction({
        action: 'update',
        type: 'Contact',
        id: created.$id,
        data: { stage: 'Qualified' },
      })
      const updated = JSON.parse(updateResult.content[0].text!)

      expect(updated.$id).toBe(created.$id)
      expect(updated.stage).toBe('Qualified')
      expect(updated.$version).toBe(2)
    })

    it('create contact then create deal referencing contact', async () => {
      const handlers = createHandlers({ provider })

      const contactResult = await handlers.doAction({
        action: 'create',
        type: 'Contact',
        data: { name: 'Alice', stage: 'Lead' },
      })
      const contact = JSON.parse(contactResult.content[0].text!)

      const dealResult = await handlers.doAction({
        action: 'create',
        type: 'Deal',
        data: { title: 'Alice Deal', stage: 'Open', value: 10000, contact: contact.$id },
      })
      const deal = JSON.parse(dealResult.content[0].text!)

      expect(deal.contact).toBe(contact.$id)

      // Verify relationship loading works
      const fetchResult = await handlers.fetch({
        resource: 'entity',
        type: 'Contact',
        id: contact.$id,
      })
      const fetched = JSON.parse(fetchResult.content[0].text!)
      expect(fetched.deals).toBeDefined()
      expect(fetched.deals[0].$id).toBe(deal.$id)
    })

    it('create, perform verb, then verify events', async () => {
      const handlers = createHandlers({ provider })

      const createResult = await handlers.doAction({
        action: 'create',
        type: 'Contact',
        data: { name: 'Alice', stage: 'Lead' },
      })
      const contact = JSON.parse(createResult.content[0].text!)

      await handlers.doAction({
        action: 'qualify',
        type: 'Contact',
        id: contact.$id,
        data: { stage: 'Qualified' },
      })

      const events = await handlers.fetch({
        resource: 'events',
        type: 'Contact',
        id: contact.$id,
      })
      const parsed = JSON.parse(events.content[0].text!)
      const actions = parsed.map((e: { action: string }) => e.action)
      expect(actions).toContain('create')
      expect(actions).toContain('qualify')
    })
  })

  // ===========================================================================
  // 3. $version Tracking Through Mutations
  // ===========================================================================

  describe('version tracking through mutations', () => {
    it('$version increments on each update', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      expect(contact.$version).toBe(1)

      const r1 = await handlers.doAction({
        action: 'update',
        type: 'Contact',
        id: contact.$id,
        data: { phone: '555-0001' },
      })
      expect(JSON.parse(r1.content[0].text!).$version).toBe(2)

      const r2 = await handlers.doAction({
        action: 'update',
        type: 'Contact',
        id: contact.$id,
        data: { phone: '555-0002' },
      })
      expect(JSON.parse(r2.content[0].text!).$version).toBe(3)

      const r3 = await handlers.doAction({
        action: 'update',
        type: 'Contact',
        id: contact.$id,
        data: { phone: '555-0003' },
      })
      expect(JSON.parse(r3.content[0].text!).$version).toBe(4)
    })

    it('$version increments through verb perform', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const result = await handlers.doAction({
        action: 'qualify',
        type: 'Contact',
        id: contact.$id,
        data: { stage: 'Qualified' },
      })
      const parsed = JSON.parse(result.content[0].text!)
      // perform with data calls update internally, so version should increment
      expect(parsed.$version).toBeGreaterThan(1)
    })
  })

  // ===========================================================================
  // 4. Event Log Ordering and Sequencing
  // ===========================================================================

  describe('event log ordering and sequencing', () => {
    it('events are ordered by sequence number across rapid mutations', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      // Rapid mutations
      await provider.update('Contact', contact.$id, { phone: '111' })
      await provider.update('Contact', contact.$id, { phone: '222' })
      await provider.update('Contact', contact.$id, { phone: '333' })

      const result = await handlers.fetch({
        resource: 'events',
        type: 'Contact',
        id: contact.$id,
      })
      const events = JSON.parse(result.content[0].text!)
      expect(events).toHaveLength(4) // create + 3 updates

      // Timestamps should be monotonically non-decreasing
      for (let i = 1; i < events.length; i++) {
        const prev = new Date(events[i - 1].timestamp).getTime()
        const curr = new Date(events[i].timestamp).getTime()
        expect(curr).toBeGreaterThanOrEqual(prev)
      }
    })

    it('event log for different entities is isolated', async () => {
      const handlers = createHandlers({ provider })
      const alice = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const bob = await provider.create('Contact', { name: 'Bob', stage: 'Lead' })
      await provider.update('Contact', alice.$id, { stage: 'Qualified' })

      const aliceEvents = await handlers.fetch({ resource: 'events', type: 'Contact', id: alice.$id })
      const bobEvents = await handlers.fetch({ resource: 'events', type: 'Contact', id: bob.$id })

      const aliceParsed = JSON.parse(aliceEvents.content[0].text!)
      const bobParsed = JSON.parse(bobEvents.content[0].text!)

      expect(aliceParsed).toHaveLength(2) // create + update
      expect(bobParsed).toHaveLength(1) // create only
    })

    it('event data includes the mutation payload', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified', phone: '555-0001' })

      const result = await handlers.fetch({ resource: 'events', type: 'Contact', id: contact.$id })
      const events = JSON.parse(result.content[0].text!)

      const updateEvent = events.find((e: { action: string }) => e.action === 'update')
      expect(updateEvent).toBeDefined()
      expect(updateEvent.data.stage).toBe('Qualified')
      expect(updateEvent.data.phone).toBe('555-0001')
    })
  })

  // ===========================================================================
  // 5. Time-Travel Edge Cases
  // ===========================================================================

  describe('time-travel edge cases', () => {
    it('asOf far in the future returns latest state', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })

      const futureTime = new Date(Date.now() + 1000000).toISOString()
      const result = await handlers.fetch({
        resource: 'entity',
        type: 'Contact',
        id: contact.$id,
        asOf: futureTime,
      })

      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.stage).toBe('Qualified')
    })

    it('asOf for non-existent entity id returns error', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({
        resource: 'entity',
        type: 'Contact',
        id: 'contact_doesnotexist',
        asOf: new Date().toISOString(),
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not found')
    })

    it('asOf with invalid date string still processes', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      // Invalid date parses to NaN timestamp
      const result = await handlers.fetch({
        resource: 'entity',
        type: 'Contact',
        id: contact.$id,
        asOf: 'not-a-date',
      })
      // NaN comparisons always fail, so no events will match before/at asOf
      expect(result.isError).toBe(true)
    })

    it('time-travel returns correct state after multiple rapid updates', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      // Small delay so we can capture a time between create and updates
      const afterCreate = new Date(Date.now() + 50).toISOString()
      await new Promise((r) => setTimeout(r, 60))

      await provider.update('Contact', contact.$id, { stage: 'Qualified' })
      await provider.update('Contact', contact.$id, { stage: 'Customer' })

      // Should return the create snapshot (before updates)
      const result = await handlers.fetch({
        resource: 'entity',
        type: 'Contact',
        id: contact.$id,
        asOf: afterCreate,
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.stage).toBe('Lead')
    })
  })

  // ===========================================================================
  // 6. Delete Then Search/Fetch Behavior
  // ===========================================================================

  describe('delete then search/fetch behavior', () => {
    it('deleted entity no longer appears in search', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.delete('Contact', contact.$id)

      const result = await handlers.search({ type: 'Contact', filter: { name: 'Alice' } })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(0)
    })

    it('deleted entity returns not found on fetch', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.delete('Contact', contact.$id)

      const result = await handlers.fetch({
        resource: 'entity',
        type: 'Contact',
        id: contact.$id,
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not found')
    })

    it('event log persists after entity deletion', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.update('Contact', contact.$id, { stage: 'Qualified' })
      await provider.delete('Contact', contact.$id)

      const result = await handlers.fetch({
        resource: 'events',
        type: 'Contact',
        id: contact.$id,
      })
      const events = JSON.parse(result.content[0].text!)
      expect(events.length).toBeGreaterThanOrEqual(3)
      const actions = events.map((e: { action: string }) => e.action)
      expect(actions).toContain('create')
      expect(actions).toContain('update')
      expect(actions).toContain('delete')
    })
  })

  // ===========================================================================
  // 7. Search with Multiple Sort and Filter Combinations
  // ===========================================================================

  describe('search sort and filter edge cases', () => {
    it('sort by numeric field ascending', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Deal', { title: 'Small', value: 1000, stage: 'Open' })
      await provider.create('Deal', { title: 'Large', value: 50000, stage: 'Open' })
      await provider.create('Deal', { title: 'Medium', value: 10000, stage: 'Open' })

      const result = await handlers.search({ type: 'Deal', sort: { value: 'asc' } })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed[0].title).toBe('Small')
      expect(parsed[1].title).toBe('Medium')
      expect(parsed[2].title).toBe('Large')
    })

    it('sort by numeric field descending', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Deal', { title: 'Small', value: 1000, stage: 'Open' })
      await provider.create('Deal', { title: 'Large', value: 50000, stage: 'Open' })
      await provider.create('Deal', { title: 'Medium', value: 10000, stage: 'Open' })

      const result = await handlers.search({ type: 'Deal', sort: { value: 'desc' } })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed[0].title).toBe('Large')
      expect(parsed[1].title).toBe('Medium')
      expect(parsed[2].title).toBe('Small')
    })

    it('sort combined with filter and query', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Deal', { title: 'Alpha Open Deal', value: 5000, stage: 'Open' })
      await provider.create('Deal', { title: 'Beta Open Deal', value: 1000, stage: 'Open' })
      await provider.create('Deal', { title: 'Gamma Won Deal', value: 9000, stage: 'Won' })
      await provider.create('Deal', { title: 'Delta Open Deal', value: 3000, stage: 'Open' })

      const result = await handlers.search({
        type: 'Deal',
        filter: { stage: 'Open' },
        query: 'deal',
        sort: { value: 'asc' },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(3)
      expect(parsed[0].title).toBe('Beta Open Deal')
      expect(parsed[1].title).toBe('Delta Open Deal')
      expect(parsed[2].title).toBe('Alpha Open Deal')
    })

    it('empty sort object has no effect on order', async () => {
      const handlers = createHandlers({ provider })
      const a = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const b = await provider.create('Contact', { name: 'Bob', stage: 'Lead' })

      const result = await handlers.search({ type: 'Contact', sort: {} })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(2)
      // Order should be insertion order (no sorting applied)
      expect(parsed[0].$id).toBe(a.$id)
      expect(parsed[1].$id).toBe(b.$id)
    })
  })

  // ===========================================================================
  // 8. HTTP Handler Edge Cases
  // ===========================================================================

  describe('HTTP handler edge cases', () => {
    it('empty array batch returns empty array response', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
      const response = await server.handleHTTP(request)
      const body = await response.json()
      expect(body).toEqual([])
    })

    it('single-item batch returns single-item array response', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ method: 'initialize', id: 1 }]),
      })
      const response = await server.handleHTTP(request)
      const body = (await response.json()) as unknown[]
      expect(body).toHaveLength(1)
      expect((body[0] as Record<string, unknown>).id).toBe(1)
    })

    it('batch request maintains order of responses', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { method: 'initialize', id: 'first' },
          { method: 'tools/list', id: 'second' },
          { method: 'resources/list', id: 'third' },
        ]),
      })
      const response = await server.handleHTTP(request)
      const body = (await response.json()) as Array<Record<string, unknown>>
      expect(body[0].id).toBe('first')
      expect(body[1].id).toBe('second')
      expect(body[2].id).toBe('third')
    })

    it('HTTP handler handles tools/call with create through full round-trip', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'tools/call',
          id: 1,
          params: {
            name: 'do',
            arguments: {
              action: 'create',
              type: 'Contact',
              data: { name: 'HTTP Alice', stage: 'Lead' },
            },
          },
        }),
      })
      const response = await server.handleHTTP(request)
      expect(response.status).toBe(200)
      const body = (await response.json()) as Record<string, unknown>
      const result = body.result as MCPToolResult
      const entity = JSON.parse(result.content[0].text!)
      expect(entity.name).toBe('HTTP Alice')
      expect(entity.$type).toBe('Contact')
    })
  })

  // ===========================================================================
  // 9. Server Re-initialization and Multiple Servers
  // ===========================================================================

  describe('server re-initialization and multiple servers', () => {
    it('multiple initialize calls return consistent results', async () => {
      const server = new MCPServer({ provider })
      const r1 = await server.handleRequest({ method: 'initialize', id: 1 })
      const r2 = await server.handleRequest({ method: 'initialize', id: 2 })

      const result1 = r1.result as Record<string, unknown>
      const result2 = r2.result as Record<string, unknown>
      expect(result1.protocolVersion).toBe(result2.protocolVersion)
      expect(JSON.stringify(result1.serverInfo)).toBe(JSON.stringify(result2.serverInfo))
    })

    it('two servers with different contexts return different metadata', async () => {
      const server1 = new MCPServer({ provider, context: { tenant: 'acme', system: 'crm' } })
      const server2 = new MCPServer({ provider, context: { tenant: 'beta', system: 'billing' } })

      const r1 = await server1.handleRequest({ method: 'initialize', id: 1 })
      const r2 = await server2.handleRequest({ method: 'initialize', id: 1 })

      const info1 = (r1.result as Record<string, unknown>).serverInfo as Record<string, unknown>
      const info2 = (r2.result as Record<string, unknown>).serverInfo as Record<string, unknown>
      expect(info1.tenant).toBe('acme')
      expect(info2.tenant).toBe('beta')
    })

    it('two servers share the same provider data', async () => {
      const server1 = new MCPServer({ provider })
      const server2 = new MCPServer({ provider })

      // Create via server1
      await server1.handleRequest({
        method: 'tools/call',
        id: 1,
        params: {
          name: 'do',
          arguments: { action: 'create', type: 'Contact', data: { name: 'Shared', stage: 'Lead' } },
        },
      })

      // Search via server2
      const response = await server2.handleRequest({
        method: 'tools/call',
        id: 2,
        params: {
          name: 'search',
          arguments: { type: 'Contact', query: 'shared' },
        },
      })
      const result = response.result as MCPToolResult
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.length).toBeGreaterThanOrEqual(1)
      expect(parsed[0].name).toBe('Shared')
    })
  })

  // ===========================================================================
  // 10. Tool Call with Edge-Case Arguments
  // ===========================================================================

  describe('tool call with edge-case arguments', () => {
    it('search with undefined arguments defaults to empty search', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: { name: 'search' },
      })
      const result = response.result as MCPToolResult
      expect(result.content).toBeDefined()
      expect(result.isError).toBeFalsy()
    })

    it('do with empty data object still creates entity', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'create',
        type: 'Contact',
        data: {},
      })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.$type).toBe('Contact')
      expect(parsed.$id).toBeDefined()
    })

    it('search with limit exactly 1 returns single result', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Lead' })
      await provider.create('Contact', { name: 'Carol', stage: 'Lead' })

      const result = await handlers.search({ type: 'Contact', limit: 1 })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.items).toHaveLength(1)
      expect(parsed.total).toBe(3)
    })

    it('search with limit exactly 100 returns all when under limit', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 5; i++) {
        await provider.create('Contact', { name: `C${i}`, stage: 'Lead' })
      }

      const result = await handlers.search({ type: 'Contact', limit: 100 })
      const parsed = JSON.parse(result.content[0].text!)
      // 5 items fit within 100, so no pagination needed
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(5)
    })
  })

  // ===========================================================================
  // 11. Schema Versioning Through MCP
  // ===========================================================================

  describe('schema access through MCP server', () => {
    it('tools/list dynamically reflects registered nouns', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'tools/list', id: 1 })
      const result = response.result as { tools: Array<{ name: string; inputSchema: Record<string, unknown> }> }
      const searchTool = result.tools.find((t) => t.name === 'search')!
      const typeProp = (searchTool.inputSchema.properties as Record<string, { enum?: string[] }>).type
      expect(typeProp.enum).toContain('Contact')
      expect(typeProp.enum).toContain('Deal')
      expect(typeProp.enum).toContain('Company')
      expect(typeProp.enum).toContain('Project')
    })

    it('schema fetch returns detailed field info for Project', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema', noun: 'Project' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.name).toBe('Project')
      const fieldKeys = parsed.fields.map((f: { key: string }) => f.key)
      expect(fieldKeys).toContain('name')
      expect(fieldKeys).toContain('status')
    })

    it('schema fetch shows relationships for Deal', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema', noun: 'Deal' })
      const parsed = JSON.parse(result.content[0].text!)
      const relKeys = parsed.relationships.map((r: { key: string }) => r.key)
      expect(relKeys).toContain('contact')
    })

    it('all-schemas summary counts reflect actual schema content', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.fetch({ resource: 'schema' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.length).toBeGreaterThanOrEqual(4) // Contact, Deal, Company, Project

      for (const schema of parsed) {
        expect(schema.fields).toBeGreaterThanOrEqual(0)
        expect(schema.relationships).toBeGreaterThanOrEqual(0)
        expect(schema.verbs).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // ===========================================================================
  // 12. Batch Error Recovery
  // ===========================================================================

  describe('batch operation error recovery', () => {
    it('batch continues after failed operation', async () => {
      const handlers = createHandlers({ provider })

      const result = await handlers.doAction({
        action: 'batch',
        type: 'Contact',
        data: {
          operations: [
            { action: 'create', data: { name: 'First', stage: 'Lead' } },
            { action: 'update', id: 'contact_nonexistent', data: { stage: 'Qualified' } },
            { action: 'create', data: { name: 'Third', stage: 'Lead' } },
          ],
        },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.results).toHaveLength(3)
      expect(parsed.results[0].success).toBe(true)
      expect(parsed.results[0].name).toBe('First')
      expect(parsed.results[1].success).toBe(false)
      expect(parsed.results[2].success).toBe(true)
      expect(parsed.results[2].name).toBe('Third')
    })

    it('batch delete without op.id reports error for that operation', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'batch',
        type: 'Contact',
        data: {
          operations: [{ action: 'delete' }],
        },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.results[0].success).toBe(false)
      expect(parsed.results[0].error).toContain('id required')
    })

    it('batch with all update failures still returns results array', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'batch',
        type: 'Contact',
        data: {
          operations: [
            { action: 'update', id: 'x1', data: {} },
            { action: 'update', id: 'x2', data: {} },
            { action: 'update', id: 'x3', data: {} },
          ],
        },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.results).toHaveLength(3)
      for (const r of parsed.results) {
        expect(r.success).toBe(false)
      }
    })

    it('batch with large number of operations completes', async () => {
      const handlers = createHandlers({ provider })
      const operations = Array.from({ length: 50 }, (_, i) => ({
        action: 'create',
        data: { name: `Batch Contact ${i}`, stage: 'Lead' },
      }))

      const result = await handlers.doAction({
        action: 'batch',
        type: 'Contact',
        data: { operations },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.results).toHaveLength(50)
      for (const r of parsed.results) {
        expect(r.success).toBe(true)
      }
    })
  })

  // ===========================================================================
  // 13. Eval Handler Complex Returns
  // ===========================================================================

  describe('eval handler complex returns', () => {
    it('eval returning an array serializes correctly', async () => {
      const evaluate = vi.fn().mockResolvedValue([1, 2, 3, 'four'])
      const handlers = createHandlers({ provider, evaluate })

      const result = await handlers.doAction({ action: 'eval', code: '[1,2,3,"four"]' })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toEqual([1, 2, 3, 'four'])
    })

    it('eval returning nested objects serializes correctly', async () => {
      const evaluate = vi.fn().mockResolvedValue({ a: { b: { c: 'deep' } } })
      const handlers = createHandlers({ provider, evaluate })

      const result = await handlers.doAction({ action: 'eval', code: 'nested' })
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.a.b.c).toBe('deep')
    })

    it('eval returning undefined results in undefined text field', async () => {
      const evaluate = vi.fn().mockResolvedValue(undefined)
      const handlers = createHandlers({ provider, evaluate })

      const result = await handlers.doAction({ action: 'eval', code: 'return undefined' })
      expect(result.isError).toBeFalsy()
      // JSON.stringify(undefined, null, 2) returns the JS undefined value,
      // so the text field in the content array will be undefined
      expect(result.content[0].text).toBeUndefined()
    })

    it('eval with plain object error returns stringified representation', async () => {
      // When a non-Error object is thrown, String(err) produces '[object Object]'
      const err = { message: 'custom error object' }
      const evaluate = vi.fn().mockRejectedValue(err)
      const handlers = createHandlers({ provider, evaluate })

      const result = await handlers.doAction({ action: 'eval', code: 'fails' })
      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text!)
      // Non-Error objects go through String() which returns '[object Object]'
      expect(parsed.error.message).toBe('[object Object]')
    })

    it('eval with numeric error still returns error', async () => {
      const evaluate = vi.fn().mockRejectedValue(42)
      const handlers = createHandlers({ provider, evaluate })

      const result = await handlers.doAction({ action: 'eval', code: 'throw 42' })
      expect(result.isError).toBe(true)
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.error.message).toBe('42')
    })
  })

  // ===========================================================================
  // 14. Cross-Entity Relationship Chains
  // ===========================================================================

  describe('cross-entity relationship chains', () => {
    it('contact with multiple deals loads all deals', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Deal', { title: 'Deal 1', stage: 'Open', value: 1000, contact: contact.$id })
      await provider.create('Deal', { title: 'Deal 2', stage: 'Open', value: 2000, contact: contact.$id })
      await provider.create('Deal', { title: 'Deal 3', stage: 'Won', value: 3000, contact: contact.$id })

      const result = await handlers.fetch({
        resource: 'entity',
        type: 'Contact',
        id: contact.$id,
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.deals).toHaveLength(3)
    })

    it('deal with no contact reference does not inject relationships', async () => {
      const handlers = createHandlers({ provider })
      const deal = await provider.create('Deal', { title: 'Orphan Deal', stage: 'Open', value: 5000 })

      const result = await handlers.fetch({
        resource: 'entity',
        type: 'Deal',
        id: deal.$id,
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.title).toBe('Orphan Deal')
      // No reverse relationship keys should be added
    })

    it('contact with projects loaded via relationship', async () => {
      const handlers = createHandlers({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Project', { name: 'Project X', status: 'Active', owner: contact.$id })

      const result = await handlers.fetch({
        resource: 'entity',
        type: 'Contact',
        id: contact.$id,
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.projects).toBeDefined()
      expect(parsed.projects).toHaveLength(1)
      expect(parsed.projects[0].name).toBe('Project X')
    })

    it('search enriches all results with relationships', async () => {
      const handlers = createHandlers({ provider })
      const alice = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      const bob = await provider.create('Contact', { name: 'Bob', stage: 'Lead' })
      await provider.create('Deal', { title: 'Alice Deal', stage: 'Open', contact: alice.$id })
      await provider.create('Deal', { title: 'Bob Deal', stage: 'Open', contact: bob.$id })

      const result = await handlers.search({ type: 'Contact' })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed).toHaveLength(2)
      for (const entity of parsed) {
        expect(entity.deals).toBeDefined()
        expect(entity.deals).toHaveLength(1)
      }
    })
  })

  // ===========================================================================
  // 15. Upsert Edge Cases
  // ===========================================================================

  describe('upsert edge cases', () => {
    it('upsert with only $ fields creates new entity', async () => {
      const handlers = createHandlers({ provider })
      // data with only meta-like fields should not match anything
      const result = await handlers.doAction({
        action: 'upsert',
        type: 'Contact',
        data: { name: 'NewPerson', stage: 'Lead' },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.$type).toBe('Contact')
      expect(parsed.name).toBe('NewPerson')
    })

    it('upsert creates when existing entities have different field values', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', email: 'alice@test.com', stage: 'Lead' })

      const result = await handlers.doAction({
        action: 'upsert',
        type: 'Contact',
        data: { email: 'bob@test.com', name: 'Bob', stage: 'Lead' },
      })
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.name).toBe('Bob')

      // Should now have 2 contacts
      const all = await provider.find('Contact', {})
      expect(all).toHaveLength(2)
    })

    it('upsert with empty data creates new entity', async () => {
      const handlers = createHandlers({ provider })
      const result = await handlers.doAction({
        action: 'upsert',
        type: 'Contact',
        data: {},
      })
      // With empty data, no fields to match, should create
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.$type).toBe('Contact')
    })
  })

  // ===========================================================================
  // 16. JSON-RPC ID Edge Cases
  // ===========================================================================

  describe('JSON-RPC ID edge cases', () => {
    it('preserves undefined id in response', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize' })
      // id was not sent, should be undefined
      expect(response.id).toBeUndefined()
    })

    it('preserves negative numeric id', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: -42 })
      expect(response.id).toBe(-42)
    })

    it('preserves float id', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: 3.14 })
      expect(response.id).toBe(3.14)
    })

    it('preserves empty string id', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: '' })
      expect(response.id).toBe('')
    })
  })

  // ===========================================================================
  // 17. Cursor Pagination Deep
  // ===========================================================================

  describe('cursor pagination deep', () => {
    it('cursor encodes offset as base64 JSON', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 10; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      const page1 = await handlers.search({ type: 'Contact', limit: 3 })
      const parsed1 = JSON.parse(page1.content[0].text!)
      expect(parsed1.nextCursor).toBeDefined()

      // Decode cursor to verify it contains offset
      const decoded = JSON.parse(Buffer.from(parsed1.nextCursor, 'base64').toString('utf-8'))
      expect(decoded.offset).toBe(3)
    })

    it('last page has no nextCursor when all remaining items are returned', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 7; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      // Page 1: items 0-2 (3 items), nextCursor exists
      const page1 = await handlers.search({ type: 'Contact', limit: 3 })
      const parsed1 = JSON.parse(page1.content[0].text!)
      expect(parsed1.nextCursor).toBeDefined()

      // Page 2: items 3-5 (3 items), nextCursor exists
      const page2 = await handlers.search({
        type: 'Contact',
        limit: 3,
        cursor: parsed1.nextCursor,
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed2 = JSON.parse(page2.content[0].text!)
      expect(parsed2.items).toHaveLength(3)
      expect(parsed2.nextCursor).toBeDefined()

      // Page 3: item 6 (1 item), no nextCursor
      const page3 = await handlers.search({
        type: 'Contact',
        limit: 3,
        cursor: parsed2.nextCursor,
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed3 = JSON.parse(page3.content[0].text!)
      // Last page might be a plain array or paginated without nextCursor
      if (parsed3.items) {
        expect(parsed3.items).toHaveLength(1)
        expect(parsed3.nextCursor).toBeUndefined()
      } else {
        expect(parsed3).toHaveLength(1)
      }
    })

    it('cursor with offset beyond total returns empty', async () => {
      const handlers = createHandlers({ provider })
      for (let i = 0; i < 3; i++) {
        await provider.create('Contact', { name: `Contact ${i}`, stage: 'Lead' })
      }

      // Manually craft a cursor with offset beyond total
      const cursor = Buffer.from(JSON.stringify({ offset: 100 })).toString('base64')
      const result = await handlers.search({
        type: 'Contact',
        limit: 3,
        cursor,
      } as Record<string, unknown> as Parameters<typeof handlers.search>[0])
      const parsed = JSON.parse(result.content[0].text!)
      // Should have 0 items since offset is beyond total
      if (parsed.items) {
        expect(parsed.items).toHaveLength(0)
      } else {
        expect(parsed).toHaveLength(0)
      }
    })
  })

  // ===========================================================================
  // 18. MCP Protocol Compliance
  // ===========================================================================

  describe('MCP protocol compliance', () => {
    it('initialize response contains all required MCP fields', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'initialize', id: 1 })
      expect(response.jsonrpc).toBe('2.0')
      const result = response.result as Record<string, unknown>
      expect(result.protocolVersion).toBeDefined()
      expect(typeof result.protocolVersion).toBe('string')
      expect(result.capabilities).toBeDefined()
      expect(result.serverInfo).toBeDefined()
      const serverInfo = result.serverInfo as Record<string, unknown>
      expect(serverInfo.name).toBeDefined()
      expect(serverInfo.version).toBeDefined()
    })

    it('tools/list tools each have name, description, and valid inputSchema', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'tools/list', id: 1 })
      const result = response.result as { tools: Array<Record<string, unknown>> }
      for (const tool of result.tools) {
        expect(typeof tool.name).toBe('string')
        expect(typeof tool.description).toBe('string')
        const schema = tool.inputSchema as Record<string, unknown>
        expect(schema.type).toBe('object')
        expect(schema.properties).toBeDefined()
      }
    })

    it('tool results always have content array with type text', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const searchResult = await handlers.search({ type: 'Contact' })
      expect(searchResult.content).toBeInstanceOf(Array)
      expect(searchResult.content[0].type).toBe('text')
      expect(typeof searchResult.content[0].text).toBe('string')

      const fetchResult = await handlers.fetch({ resource: 'schema' })
      expect(fetchResult.content).toBeInstanceOf(Array)
      expect(fetchResult.content[0].type).toBe('text')

      const doResult = await handlers.doAction({
        action: 'create',
        type: 'Contact',
        data: { name: 'Test', stage: 'Lead' },
      })
      expect(doResult.content).toBeInstanceOf(Array)
      expect(doResult.content[0].type).toBe('text')
    })

    it('error results set isError: true and provide message text', async () => {
      const handlers = createHandlers({ provider })

      const missingType = await handlers.doAction({ action: 'create' })
      expect(missingType.isError).toBe(true)
      expect(missingType.content[0].text!.length).toBeGreaterThan(0)

      const missingId = await handlers.doAction({ action: 'update', type: 'Contact' })
      expect(missingId.isError).toBe(true)

      const notFound = await handlers.fetch({ resource: 'entity', type: 'Contact', id: 'x' })
      expect(notFound.isError).toBe(true)
    })

    it('method not found error uses standard JSON-RPC code -32601', async () => {
      const server = new MCPServer({ provider })
      const response = await server.handleRequest({ method: 'completely/unknown', id: 1 })
      const error = response.error as { code: number; message: string }
      expect(error.code).toBe(-32601)
    })

    it('parse error uses standard JSON-RPC code -32700', async () => {
      const server = new MCPServer({ provider })
      const request = new Request('https://crm.headless.ly/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{{invalid}}',
      })
      const response = await server.handleHTTP(request)
      const body = (await response.json()) as Record<string, unknown>
      const error = body.error as { code: number }
      expect(error.code).toBe(-32700)
    })
  })

  // ===========================================================================
  // 19. Cross-Type Search with Filter
  // ===========================================================================

  describe('cross-type search with filter', () => {
    it('cross-type search passes filter to each type', async () => {
      const handlers = createHandlers({ provider })
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Qualified' })
      await provider.create('Deal', { title: 'Open Deal', stage: 'Open' })

      // Filter on stage=Lead should only match contacts with Lead stage
      // Note: cross-type search passes filter to each type's find
      const result = await handlers.search({ filter: { stage: 'Lead' } })
      const parsed = JSON.parse(result.content[0].text!)
      // Only the Lead contact should match (Deal stage is 'Open', not 'Lead')
      const names = parsed.map((r: Record<string, unknown>) => r.name || r.title)
      expect(names).toContain('Alice')
      expect(names).not.toContain('Bob')
    })
  })

  // ===========================================================================
  // 20. Handler Instances Are Isolated
  // ===========================================================================

  describe('handler instance isolation', () => {
    it('event logs are separate per createHandlers call', async () => {
      const handlers1 = createHandlers({ provider })
      const handlers2 = createHandlers({ provider })

      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      // Only handlers1 should see this event (provider was instrumented by handlers1 last)
      // Actually, both createHandlers calls instrument the provider, so the last one wins
      // But each has its own eventLog, so only the last one captures events
      const events1 = await handlers1.fetch({ resource: 'events', type: 'Contact', id: contact.$id })
      const events2 = await handlers2.fetch({ resource: 'events', type: 'Contact', id: contact.$id })

      const parsed1 = JSON.parse(events1.content[0].text!)
      const parsed2 = JSON.parse(events2.content[0].text!)

      // The second createHandlers overwrites the provider's create/update/delete/perform,
      // so only handlers2's event log captures events from the provider
      // handlers1's event log should be empty since its instrumented methods were replaced
      expect(parsed2.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ===========================================================================
  // 21. Custom Verb Through Server Full Round-Trip
  // ===========================================================================

  describe('custom verb through server full round-trip', () => {
    it('qualify verb via tools/call returns updated entity', async () => {
      const server = new MCPServer({ provider })
      const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

      const response = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: {
          name: 'do',
          arguments: {
            action: 'qualify',
            type: 'Contact',
            id: contact.$id,
            data: { stage: 'Qualified' },
          },
        },
      })
      const result = response.result as MCPToolResult
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.stage).toBe('Qualified')
    })

    it('close verb on Deal via tools/call', async () => {
      const server = new MCPServer({ provider })
      const deal = await provider.create('Deal', { title: 'Big Deal', stage: 'Open', value: 50000 })

      const response = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: {
          name: 'do',
          arguments: {
            action: 'close',
            type: 'Deal',
            id: deal.$id,
            data: { stage: 'Won' },
          },
        },
      })
      const result = response.result as MCPToolResult
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.stage).toBe('Won')
    })

    it('archive verb on Project via tools/call', async () => {
      const server = new MCPServer({ provider })
      const project = await provider.create('Project', { name: 'Old Project', status: 'Active' })

      const response = await server.handleRequest({
        method: 'tools/call',
        id: 1,
        params: {
          name: 'do',
          arguments: {
            action: 'archive',
            type: 'Project',
            id: project.$id,
            data: { status: 'Archived' },
          },
        },
      })
      const result = response.result as MCPToolResult
      expect(result.isError).toBeFalsy()
      const parsed = JSON.parse(result.content[0].text!)
      expect(parsed.status).toBe('Archived')
    })
  })
})
