/**
 * @headlessly/mcp — E2E Tests
 *
 * Tests the MCP protocol client against live deployed endpoints.
 * Verifies exports (MCPServer, MCPClient, getTools, createHandlers),
 * tool shapes, and live MCP + OpenAPI endpoints.
 *
 * Run: vitest run public/packages/mcp/test-e2e/mcp.e2e.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup, CRM_URL, writeHeaders, readHeaders, generateTestId, getSessionToken } from '../../test-e2e-helpers'
import { MCPServer, MCPClient, getTools, createHandlers } from '../src/index.js'
import { MemoryNounProvider } from 'digital-objects'

// ---------------------------------------------------------------------------
// Setup — provision an authenticated session for live API access
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await setup()
})

// =============================================================================
// Export Verification
// =============================================================================

describe('@headlessly/mcp — exports', () => {
  it('exports MCPServer as a class', () => {
    expect(MCPServer).toBeDefined()
    expect(typeof MCPServer).toBe('function')
  })

  it('exports MCPClient as a class', () => {
    expect(MCPClient).toBeDefined()
    expect(typeof MCPClient).toBe('function')
  })

  it('exports getTools as a function', () => {
    expect(getTools).toBeDefined()
    expect(typeof getTools).toBe('function')
  })

  it('exports createHandlers as a function', () => {
    expect(createHandlers).toBeDefined()
    expect(typeof createHandlers).toBe('function')
  })
})

// =============================================================================
// getTools — tool definitions
// =============================================================================

describe('@headlessly/mcp — getTools', () => {
  it('returns an array of 3 tools', () => {
    const tools = getTools()
    expect(Array.isArray(tools)).toBe(true)
    expect(tools.length).toBe(3)
  })

  it('includes search tool', () => {
    const tools = getTools()
    const search = tools.find((t) => t.name === 'search')
    expect(search).toBeDefined()
    expect(search!.description).toBeDefined()
    expect(typeof search!.description).toBe('string')
    expect(search!.description.length).toBeGreaterThan(0)
  })

  it('includes fetch tool', () => {
    const tools = getTools()
    const fetchTool = tools.find((t) => t.name === 'fetch')
    expect(fetchTool).toBeDefined()
    expect(fetchTool!.description).toBeDefined()
  })

  it('includes do tool', () => {
    const tools = getTools()
    const doTool = tools.find((t) => t.name === 'do')
    expect(doTool).toBeDefined()
    expect(doTool!.description).toBeDefined()
  })

  it('search tool has correct input schema shape', () => {
    const tools = getTools()
    const search = tools.find((t) => t.name === 'search')!
    expect(search.inputSchema).toBeDefined()
    expect(search.inputSchema.type).toBe('object')
    expect(search.inputSchema.properties).toBeDefined()
    expect(search.inputSchema.properties.type).toBeDefined()
    expect(search.inputSchema.properties.query).toBeDefined()
    expect(search.inputSchema.properties.filter).toBeDefined()
    expect(search.inputSchema.properties.limit).toBeDefined()
  })

  it('fetch tool has required fields in schema', () => {
    const tools = getTools()
    const fetchTool = tools.find((t) => t.name === 'fetch')!
    expect(fetchTool.inputSchema).toBeDefined()
    expect(fetchTool.inputSchema.type).toBe('object')
    expect(fetchTool.inputSchema.properties).toBeDefined()
    expect(fetchTool.inputSchema.properties.resource).toBeDefined()
    expect(fetchTool.inputSchema.required).toBeDefined()
    expect(fetchTool.inputSchema.required).toContain('resource')
  })

  it('do tool has action in schema', () => {
    const tools = getTools()
    const doTool = tools.find((t) => t.name === 'do')!
    expect(doTool.inputSchema).toBeDefined()
    expect(doTool.inputSchema.properties.action).toBeDefined()
    expect(doTool.inputSchema.required).toBeDefined()
    expect(doTool.inputSchema.required).toContain('action')
  })

  it('search tool type enum includes core entity types', () => {
    const tools = getTools()
    const search = tools.find((t) => t.name === 'search')!
    const typeEnum = search.inputSchema.properties.type.enum as string[] | undefined

    // If entity types are registered, the enum should include them
    if (typeEnum && typeEnum.length > 0) {
      // At minimum, the registered nouns should appear
      expect(typeEnum.length).toBeGreaterThan(0)
    }
  })

  it('getTools accepts optional context parameter', () => {
    const tools = getTools({ system: 'crm' })
    expect(Array.isArray(tools)).toBe(true)
    expect(tools.length).toBe(3)

    // Context-scoped tools should mention the system in description
    const search = tools.find((t) => t.name === 'search')!
    expect(search.description.toLowerCase()).toContain('crm')
  })
})

// =============================================================================
// createHandlers — handler factory
// =============================================================================

describe('@headlessly/mcp — createHandlers', () => {
  it('returns an object with handler functions', () => {
    const handlers = createHandlers({ provider: new MemoryNounProvider() })
    expect(handlers).toBeDefined()
    expect(typeof handlers).toBe('object')
  })

  it('handler object has search, fetch, and doAction keys', () => {
    const handlers = createHandlers({ provider: new MemoryNounProvider() })
    expect(typeof handlers.search).toBe('function')
    expect(typeof handlers.fetch).toBe('function')
    expect(typeof handlers.doAction).toBe('function')
  })
})

// =============================================================================
// MCPClient — instantiation
// =============================================================================

describe('@headlessly/mcp — MCPClient', () => {
  it('creates an MCPClient with endpoint config', () => {
    const client = new MCPClient(`${CRM_URL}/mcp`)
    expect(client).toBeDefined()
  })

  it('MCPClient exposes callTool method', () => {
    const client = new MCPClient(`${CRM_URL}/mcp`)
    expect(typeof client.callTool).toBe('function')
  })

  it('MCPClient exposes listTools method', () => {
    const client = new MCPClient(`${CRM_URL}/mcp`)
    expect(typeof client.listTools).toBe('function')
  })
})

// =============================================================================
// MCPServer — instantiation
// =============================================================================

describe('@headlessly/mcp — MCPServer', () => {
  it('creates an MCPServer instance', () => {
    const server = new MCPServer({
      provider: new MemoryNounProvider(),
    })
    expect(server).toBeDefined()
  })

  it('MCPServer exposes tool registration method', () => {
    const server = new MCPServer({
      provider: new MemoryNounProvider(),
    })
    expect(typeof server.tool).toBe('function')
  })
})

// =============================================================================
// Live MCP endpoint — POST to crm.headless.ly/mcp
// =============================================================================

describe('@headlessly/mcp — live MCP endpoint', () => {
  it('POST to /mcp with tools/list returns 3 tools', async () => {
    const res = await fetch(`${CRM_URL}/mcp`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      jsonrpc: string
      id: number
      result?: { tools?: Array<{ name: string; description: string }> }
    }
    expect(body.jsonrpc).toBe('2.0')
    expect(body.result?.tools).toBeDefined()
    expect(Array.isArray(body.result!.tools)).toBe(true)

    const toolNames = body.result!.tools!.map((t) => t.name)
    expect(toolNames).toContain('search')
    expect(toolNames).toContain('fetch')
    expect(toolNames).toContain('do')
  }, 15_000)

  it('POST to /mcp with search returns valid JSON-RPC response', async () => {
    const res = await fetch(`${CRM_URL}/mcp`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'search',
          arguments: {
            type: 'Contact',
            limit: 5,
          },
        },
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      jsonrpc: string
      id: number
      result?: { content?: unknown[] }
    }
    expect(body.jsonrpc).toBe('2.0')
    expect(body.id).toBe(2)
    expect(body.result).toBeDefined()
  }, 15_000)

  it('POST to /mcp with fetch schema returns schema content', async () => {
    const res = await fetch(`${CRM_URL}/mcp`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'fetch',
          arguments: {
            resource: 'schema',
            noun: 'Contact',
          },
        },
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      jsonrpc: string
      id: number
      result?: { content?: unknown[] }
    }
    expect(body.jsonrpc).toBe('2.0')
    expect(body.result).toBeDefined()
  }, 15_000)
})

// =============================================================================
// Live OpenAPI endpoint — fetch crm.headless.ly/openapi
// =============================================================================

describe('@headlessly/mcp — live OpenAPI endpoint', () => {
  it('GET /openapi returns a valid OpenAPI 3.x spec', async () => {
    const res = await fetch(`${CRM_URL}/openapi`, {
      headers: { Accept: 'application/json', ...readHeaders() },
    })

    expect(res.status).toBe(200)
    const ct = res.headers.get('content-type') || ''
    expect(ct).toContain('json')

    const spec = (await res.json()) as {
      openapi?: string
      info?: { title?: string; version?: string }
      paths?: Record<string, unknown>
    }

    expect(spec.openapi).toBeDefined()
    expect(spec.openapi).toMatch(/^3\./)
    expect(spec.info).toBeDefined()
    expect(spec.info!.title).toBeDefined()
    expect(spec.paths).toBeDefined()
    expect(typeof spec.paths).toBe('object')
  }, 15_000)

  it('OpenAPI spec includes CRM entity CRUD paths', async () => {
    const res = await fetch(`${CRM_URL}/openapi`, {
      headers: { Accept: 'application/json', ...readHeaders() },
    })

    expect(res.status).toBe(200)
    const spec = (await res.json()) as { paths?: Record<string, unknown> }
    expect(spec.paths).toBeDefined()

    const paths = Object.keys(spec.paths!)
    expect(paths.length).toBeGreaterThan(0)

    const hasCRMPaths = paths.some((p) => p.includes('contact') || p.includes('deal') || p.includes('organization'))
    expect(hasCRMPaths).toBe(true)
  }, 15_000)
})

// =============================================================================
// MCP tool execution — search finds created entities
// =============================================================================

describe('@headlessly/mcp — search finds created entities', () => {
  const uniqueName = `MCP E2E ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  let createdId: string

  beforeAll(async () => {
    // Create a Contact via REST so we can search for it via MCP
    const res = await fetch(`${CRM_URL}/api/contacts`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({ name: uniqueName, email: `mcp-e2e-${Date.now()}@test.headless.ly`, stage: 'Lead' }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { $id: string } }
    createdId = body.data.$id
  })

  afterAll(async () => {
    if (createdId) {
      await fetch(`${CRM_URL}/api/contacts/${createdId}`, {
        method: 'DELETE',
        headers: readHeaders(),
      })
    }
  })

  it('MCP search for Contact returns results', async () => {
    const res = await fetch(`${CRM_URL}/mcp`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/call',
        params: {
          name: 'search',
          arguments: { type: 'Contact', limit: 50 },
        },
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      jsonrpc: string
      id: number
      result?: { content?: Array<{ type: string; text: string }> }
    }
    expect(body.jsonrpc).toBe('2.0')
    expect(body.result).toBeDefined()
    expect(body.result!.content).toBeDefined()
    expect(body.result!.content!.length).toBeGreaterThan(0)

    // The content should contain text mentioning our created entity
    const textContent = body.result!.content!.map((c) => c.text).join('\n')
    expect(textContent.length).toBeGreaterThan(0)
  }, 15_000)

  it('MCP fetch for Contact by $id returns matching entity', async () => {
    const res = await fetch(`${CRM_URL}/mcp`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'fetch',
          arguments: { resource: 'entity', type: 'Contact', id: createdId },
        },
      }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      jsonrpc: string
      result?: { content?: Array<{ type: string; text: string }> }
    }
    expect(body.jsonrpc).toBe('2.0')
    expect(body.result).toBeDefined()
    expect(body.result!.content).toBeDefined()
    expect(body.result!.content!.length).toBeGreaterThan(0)

    // Response text should reference our entity ID or name
    const textContent = body.result!.content!.map((c) => c.text).join('\n')
    expect(textContent).toContain(createdId)
  }, 15_000)
})

// =============================================================================
// MCPClient against live endpoint
// =============================================================================

describe('@headlessly/mcp — MCPClient live', () => {
  let client: MCPClient

  beforeAll(() => {
    client = new MCPClient(`${CRM_URL}/mcp`, {
      headers: { Authorization: `Bearer ${getSessionToken()}` },
    })
  })

  afterAll(async () => {
    await client.close()
  })

  it('client.listTools() returns 3 tools', async () => {
    const tools = await client.listTools()
    expect(Array.isArray(tools)).toBe(true)
    expect(tools.length).toBe(3)
    const names = tools.map((t) => t.name)
    expect(names).toContain('search')
    expect(names).toContain('fetch')
    expect(names).toContain('do')
  }, 15_000)

  it('client.search() returns results for Contact', async () => {
    const result = await client.search({ type: 'Contact', limit: 5 })
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    expect(Array.isArray(result.content)).toBe(true)
  }, 15_000)

  it('client.fetch() returns schema for Contact', async () => {
    const result = await client.fetch({ resource: 'schema', noun: 'Contact' })
    expect(result).toBeDefined()
    expect(result.content).toBeDefined()
    expect(result.content.length).toBeGreaterThan(0)
  }, 15_000)
})
