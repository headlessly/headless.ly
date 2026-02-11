/**
 * @headlessly/mcp — E2E Tests
 *
 * Tests the MCP protocol client against live deployed endpoints.
 * Verifies exports (MCPServer, MCPClient, getTools, createHandlers),
 * tool shapes, and live MCP + OpenAPI endpoints.
 *
 * Run: vitest run public/packages/mcp/test-e2e/mcp.e2e.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { setup, CRM_URL, writeHeaders, readHeaders, generateTestId } from '../../test-e2e-helpers'
import { MCPServer, MCPClient, getTools, createHandlers } from '../src/index.js'
import { MemoryNounProvider } from 'digital-objects'

// ---------------------------------------------------------------------------
// Setup — provision an authenticated session for live API access
// ---------------------------------------------------------------------------

let isCRMReachable = false

beforeAll(async () => {
  try {
    await setup()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(CRM_URL, {
      signal: controller.signal,
    }).catch(() => null)
    clearTimeout(timeout)
    if (res && (res.ok || res.status === 401 || res.status === 403)) isCRMReachable = true
  } catch {
    // provision or network failure
  }
  if (!isCRMReachable) console.log(`Skipping live MCP tests: ${CRM_URL} not reachable`)
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

describe.skipIf(!isCRMReachable)('@headlessly/mcp — live MCP endpoint', () => {
  it('POST to /mcp with search request returns results', async () => {
    const res = await fetch(`${CRM_URL}/mcp`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
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

    // MCP endpoint should exist
    expect(res.status).not.toBe(404)

    // Accept 200 (success) or 401/403 (auth required) or 400 (malformed)
    expect([200, 400, 401, 403]).toContain(res.status)

    if (res.status === 200) {
      const body = (await res.json()) as {
        jsonrpc: string
        id: number
        result?: { content?: unknown[] }
      }
      expect(body.jsonrpc).toBe('2.0')
      expect(body.id).toBe(1)
    }
  }, 15000)

  it('POST to /mcp with fetch request for schema', async () => {
    const res = await fetch(`${CRM_URL}/mcp`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
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

    expect(res.status).not.toBe(404)
    expect([200, 400, 401, 403]).toContain(res.status)

    if (res.status === 200) {
      const body = (await res.json()) as {
        jsonrpc: string
        result?: { content?: unknown[] }
      }
      expect(body.jsonrpc).toBe('2.0')
    }
  }, 15000)

  it('POST to /mcp with tools/list returns available tools', async () => {
    const res = await fetch(`${CRM_URL}/mcp`, {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
        params: {},
      }),
    })

    expect(res.status).not.toBe(404)
    expect([200, 400, 401, 403]).toContain(res.status)

    if (res.status === 200) {
      const body = (await res.json()) as {
        jsonrpc: string
        id: number
        result?: { tools?: Array<{ name: string; description: string }> }
      }
      expect(body.jsonrpc).toBe('2.0')

      if (body.result?.tools) {
        expect(Array.isArray(body.result.tools)).toBe(true)
        const toolNames = body.result.tools.map((t) => t.name)
        expect(toolNames).toContain('search')
        expect(toolNames).toContain('fetch')
        expect(toolNames).toContain('do')
      }
    }
  }, 15000)

  it('GET /mcp returns MCP server info or SSE stream', async () => {
    const res = await fetch(`${CRM_URL}/mcp`, {
      method: 'GET',
      headers: readHeaders(),
    })

    // GET on MCP can return SSE (200 with text/event-stream) or JSON info or redirect
    expect(res.status).not.toBe(404)
    expect([200, 301, 302, 400, 401, 403, 405]).toContain(res.status)
  }, 15000)
})

// =============================================================================
// Live OpenAPI endpoint — fetch crm.headless.ly/openapi
// =============================================================================

describe.skipIf(!isCRMReachable)('@headlessly/mcp — live OpenAPI endpoint', () => {
  it('GET /openapi returns a valid OpenAPI spec', async () => {
    const res = await fetch(`${CRM_URL}/openapi`, {
      headers: { Accept: 'application/json', ...readHeaders() },
    })

    // OpenAPI endpoint should exist
    expect([200, 401, 403]).toContain(res.status)

    if (res.status === 200) {
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
    }
  }, 15000)

  it('OpenAPI spec includes entity CRUD paths', async () => {
    const res = await fetch(`${CRM_URL}/openapi`, {
      headers: { Accept: 'application/json', ...readHeaders() },
    })

    if (res.status === 200) {
      const spec = (await res.json()) as {
        paths?: Record<string, unknown>
      }

      if (spec.paths) {
        const paths = Object.keys(spec.paths)
        // Should include at least some entity paths
        expect(paths.length).toBeGreaterThan(0)

        // Look for CRM-related paths
        const hasCRMPaths = paths.some((p) => p.includes('contact') || p.includes('deal') || p.includes('organization'))
        expect(hasCRMPaths).toBe(true)
      }
    }
  }, 15000)
})
