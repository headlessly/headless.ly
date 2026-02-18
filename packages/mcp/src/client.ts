import type { MCPTool, MCPToolResult, SearchArgs, FetchArgs, DoArgs } from './types.js'
import type { MCPTransport, JsonRpcRequest, JsonRpcResponse } from './transport.js'
import { HttpTransport } from './transport.js'

/** Options for MCPClient */
export interface MCPClientOptions {
  /** Custom transport (defaults to HttpTransport) */
  transport?: MCPTransport
  /** Request headers for the default HTTP transport */
  headers?: Record<string, string>
  /** Custom fetch implementation */
  fetch?: typeof globalThis.fetch
}

/** Server info returned by initialize */
export interface MCPServerInfo {
  protocolVersion: string
  capabilities: Record<string, unknown>
  serverInfo: {
    name: string
    version: string
    tenant?: string
    subdomain?: string
    [key: string]: unknown
  }
}

/**
 * MCP client for connecting to headless.ly MCP endpoints.
 *
 * ```typescript
 * const client = new MCPClient('https://crm.headless.ly/mcp')
 * await client.connect()
 * const leads = await client.search({ type: 'Contact', filter: { stage: 'Lead' } })
 * const deal = await client.fetch({ resource: 'entity', type: 'Deal', id: 'deal_k7TmPvQx' })
 * await client.do({ action: 'create', type: 'Contact', data: { name: 'Alice', stage: 'Lead' } })
 * await client.close()
 * ```
 */
export class MCPClient {
  private endpoint: string
  private transport: MCPTransport
  private connected = false
  private requestId = 0
  private serverInfo: MCPServerInfo | null = null
  private tools: MCPTool[] | null = null

  constructor(endpoint: string, options?: MCPClientOptions) {
    this.endpoint = endpoint
    this.transport =
      options?.transport ??
      new HttpTransport(endpoint, {
        headers: options?.headers,
        fetch: options?.fetch,
      })
  }

  /** Connect to the MCP server (performs initialize handshake) */
  async connect(): Promise<MCPServerInfo> {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: '@headlessly/mcp', version: '0.0.1' },
    })

    this.serverInfo = response.result as MCPServerInfo
    this.connected = true

    // Send initialized notification
    await this.sendRequest('notifications/initialized', {})

    return this.serverInfo
  }

  /** Check if the client is connected */
  get isConnected(): boolean {
    return this.connected
  }

  /** Get server info (available after connect) */
  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo
  }

  /**
   * List available tools from the MCP server.
   * Caches the result after the first call.
   */
  async listTools(): Promise<MCPTool[]> {
    if (this.tools) return this.tools

    const response = await this.sendRequest('tools/list', {})
    const result = response.result as { tools: MCPTool[] }
    this.tools = result.tools
    return this.tools
  }

  /**
   * Search for entities across the headless.ly graph.
   *
   * ```typescript
   * const leads = await client.search({ type: 'Contact', filter: { stage: 'Lead' } })
   * const allDeals = await client.search({ type: 'Deal', sort: { value: 'desc' }, limit: 10 })
   * ```
   */
  async search(args: SearchArgs): Promise<MCPToolResult> {
    return this.callTool('search', args as unknown as Record<string, unknown>)
  }

  /**
   * Fetch a specific entity, schema, events, or metrics.
   *
   * ```typescript
   * const entity = await client.fetch({ resource: 'entity', type: 'Contact', id: 'contact_fX9bL5nRd' })
   * const schema = await client.fetch({ resource: 'schema', noun: 'Deal' })
   * const events = await client.fetch({ resource: 'events', type: 'Contact', id: 'contact_fX9bL5nRd' })
   * ```
   */
  async fetch(args: FetchArgs): Promise<MCPToolResult> {
    return this.callTool('fetch', args as unknown as Record<string, unknown>)
  }

  /**
   * Execute an action on headless.ly.
   *
   * ```typescript
   * await client.do({ action: 'create', type: 'Contact', data: { name: 'Alice', stage: 'Lead' } })
   * await client.do({ action: 'qualify', type: 'Contact', id: 'contact_fX9bL5nRd' })
   * await client.do({ action: 'eval', code: 'await $.Contact.find({ stage: "Lead" })' })
   * ```
   */
  async do(args: DoArgs): Promise<MCPToolResult> {
    return this.callTool('do', args as unknown as Record<string, unknown>)
  }

  /** Call a tool by name with arbitrary arguments */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    })

    if (response.error) {
      return {
        content: [{ type: 'text', text: response.error.message }],
        isError: true,
      }
    }

    return response.result as MCPToolResult
  }

  /** Close the connection */
  async close(): Promise<void> {
    this.connected = false
    this.tools = null
    this.serverInfo = null
    await this.transport.close()
  }

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<JsonRpcResponse> {
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++this.requestId,
    }
    return this.transport.send(request)
  }
}
