import type { MCPToolCall, MCPToolResult, MCPContext } from './types.js'
import type { NounProvider } from 'digital-objects'
import { getTools } from './tools.js'
import { createHandlers } from './handlers.js'

export interface MCPServerOptions {
  provider: NounProvider
  context?: MCPContext
  evaluate?: (code: string, context: Record<string, unknown>) => Promise<unknown>
}

export class MCPServer {
  private handlers: ReturnType<typeof createHandlers>
  private context?: MCPContext

  constructor(options: MCPServerOptions) {
    this.handlers = createHandlers(options)
    this.context = options.context
  }

  /** Handle an MCP JSON-RPC request */
  async handleRequest(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { method, params, id } = body

    switch (method) {
      case 'initialize':
        return this.jsonrpc(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'headless.ly',
            version: '0.0.1',
          },
        })

      case 'tools/list':
        return this.jsonrpc(id, {
          tools: getTools(this.context),
        })

      case 'tools/call': {
        const { name, arguments: args } = (params ?? {}) as MCPToolCall
        const result = await this.executeTool(name, args ?? {})
        return this.jsonrpc(id, result)
      }

      default:
        return this.jsonrpc(id, null, { code: -32601, message: `Method not found: ${method}` })
    }
  }

  /** Handle an HTTP request (for use in Hono routes) */
  async handleHTTP(request: Request): Promise<Response> {
    const body = await request.json()
    const result = await this.handleRequest(body as Record<string, unknown>)
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
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
