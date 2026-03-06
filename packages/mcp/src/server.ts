import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { MCPTool, MCPToolCall, MCPToolResult, MCPContext, MCPSchemaProperty } from './types.js'
import type { NounProvider } from 'digital-objects'
import type { AuthContext } from '@dotdo/mcp'
import { ANONYMOUS_CONTEXT } from '@dotdo/mcp'
import { getTools } from './tools.js'
import { createHandlers } from './handlers.js'
import { inputSchemaToZod } from './schema-to-zod.js'

export interface MCPServerOptions {
  provider: NounProvider
  context?: MCPContext
  evaluate?: (code: string, context: Record<string, unknown>) => Promise<unknown>
}

/** Schema definition for a custom tool parameter */
export interface ToolSchema {
  type: 'object'
  properties: Record<string, MCPSchemaProperty>
  required?: string[]
}

/** Handler function for a custom tool */
export type ToolHandler = (args: Record<string, unknown>) => Promise<MCPToolResult>

/** Registered custom tool */
interface RegisteredTool {
  name: string
  description: string
  inputSchema: ToolSchema
  handler: ToolHandler
}

export class MCPServer {
  private handlers: ReturnType<typeof createHandlers>
  private context?: MCPContext
  private customTools: Map<string, RegisteredTool> = new Map()
  private _server: McpServer
  private authContext: AuthContext = ANONYMOUS_CONTEXT

  constructor(options: MCPServerOptions) {
    this.handlers = createHandlers(options)
    this.context = options.context

    this._server = new McpServer({
      name: 'headless.ly',
      version: '0.0.1',
    })

    // Register the three builtin tools on the SDK server
    const tools = getTools(this.context)
    for (const tool of tools) {
      const zodSchema = inputSchemaToZod(tool.inputSchema)
      const toolName = tool.name
      this._server.tool(toolName, tool.description, zodSchema.shape, async (args) => {
        const result = await this.executeTool(toolName, args as Record<string, unknown>)
        return toSdkResult(result)
      })
    }
  }

  /** Access the underlying @modelcontextprotocol/sdk McpServer instance */
  get server(): McpServer {
    return this._server
  }

  /** Connect this server to an MCP SDK transport (e.g. StdioServerTransport) */
  async connect(transport: Transport): Promise<void> {
    await this._server.connect(transport)
  }

  /** Set the current auth context (e.g. after id.org.ai-backed device-flow login) */
  setAuthContext(ctx: AuthContext): void {
    this.authContext = ctx
  }

  /** Get the current auth context */
  getAuthContext(): AuthContext {
    return this.authContext
  }

  /**
   * Register a custom tool on this MCP server.
   *
   * ```typescript
   * server.tool('summarize', {
   *   type: 'object',
   *   properties: { text: { type: 'string', description: 'Text to summarize' } },
   *   required: ['text'],
   * }, async (args) => {
   *   return { content: [{ type: 'text', text: `Summary of: ${args.text}` }] }
   * })
   * ```
   */
  tool(name: string, schema: ToolSchema, handler: ToolHandler): this {
    this.customTools.set(name, {
      name,
      description: schema.properties ? `Custom tool: ${name}` : `Custom tool: ${name}`,
      inputSchema: schema,
      handler,
    })

    // Also register on the SDK server (may fail if overriding a builtin — that's OK,
    // handleRequest() checks customTools first so the override still works for HTTP path)
    try {
      const zodSchema = inputSchemaToZod(schema)
      this._server.tool(name, `Custom tool: ${name}`, zodSchema.shape, async (args) => {
        const result = await handler(args as Record<string, unknown>)
        return toSdkResult(result)
      })
    } catch {
      // SDK throws if tool name already registered — custom tool still works via handleRequest()
    }

    return this
  }

  /** Alias for handleRequest -- process an incoming MCP JSON-RPC request */
  async handle(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.handleRequest(body)
  }

  /** Handle an MCP JSON-RPC request */
  async handleRequest(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { method, params, id } = body

    switch (method) {
      case 'initialize': {
        const serverInfo: Record<string, unknown> = {
          name: 'headless.ly',
          version: '0.0.1',
        }
        // Include tenant context in serverInfo when available
        if (this.context?.tenant) {
          serverInfo.tenant = this.context.tenant
        }
        if (this.context?.subdomain) {
          serverInfo.subdomain = this.context.subdomain
        }
        return this.jsonrpc(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo,
        })
      }

      case 'tools/list': {
        const builtinTools = getTools(this.context)
        const customToolDefs: MCPTool[] = [...this.customTools.values()].map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }))
        return this.jsonrpc(id, {
          tools: [...builtinTools, ...customToolDefs],
        })
      }

      case 'tools/call': {
        const { name, arguments: args } = (params ?? {}) as MCPToolCall
        const result = await this.executeTool(name, args ?? {})
        return this.jsonrpc(id, result)
      }

      // MCP lifecycle notifications
      case 'notifications/initialized':
        return this.jsonrpc(id, {})

      // Resource and prompt discovery
      case 'resources/list':
        return this.jsonrpc(id, { resources: [] })

      case 'prompts/list':
        return this.jsonrpc(id, { prompts: [] })

      default:
        return this.jsonrpc(id, null, { code: -32601, message: `Method not found: ${method}` })
    }
  }

  /** Handle an HTTP request (for use in Hono routes) */
  async handleHTTP(request: Request): Promise<Response> {
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    let parsed: unknown
    try {
      parsed = await request.json()
    } catch {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error: invalid JSON' },
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        },
      )
    }

    // Handle batch JSON-RPC requests
    if (Array.isArray(parsed)) {
      const results = await Promise.all(parsed.map((req: Record<string, unknown>) => this.handleRequest(req)))
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const result = await this.handleRequest(parsed as Record<string, unknown>)
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  /**
   * Return a fetch-compatible handler for Cloudflare Workers.
   *
   * ```typescript
   * const server = new MCPServer({ provider })
   * export default { fetch: server.toFetchHandler() }
   * ```
   */
  toFetchHandler(): (request: Request) => Promise<Response> {
    return (request: Request) => this.handleHTTP(request)
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    // Check custom tools first
    const customTool = this.customTools.get(name)
    if (customTool) {
      return customTool.handler(args)
    }

    switch (name) {
      case 'search':
        return this.handlers.search(args as unknown as Parameters<typeof this.handlers.search>[0])
      case 'fetch':
        return this.handlers.fetch(args as unknown as Parameters<typeof this.handlers.fetch>[0])
      case 'do':
        return this.handlers.doAction(args as unknown as Parameters<typeof this.handlers.doAction>[0])
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
    }
  }

  private jsonrpc(id: unknown, result: unknown, error?: { code: number; message: string }) {
    if (error) return { jsonrpc: '2.0', id, error }
    return { jsonrpc: '2.0', id, result }
  }
}

/** Convert our MCPToolResult to the SDK's expected CallToolResult shape */
function toSdkResult(result: MCPToolResult) {
  return {
    content: result.content.map((item) => {
      if (item.type === 'resource' && item.resource) {
        return { type: 'resource' as const, resource: item.resource }
      }
      return { type: 'text' as const, text: item.text ?? '' }
    }),
    isError: result.isError,
  }
}
