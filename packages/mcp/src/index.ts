export type { MCPTool, MCPSchemaProperty, MCPToolCall, MCPToolResult, MCPContext, SearchArgs, FetchArgs, DoArgs } from './types.js'

export { getTools } from './tools.js'
export { createHandlers } from './handlers.js'
export type { MCPHandlerOptions } from './handlers.js'
export { MCPServer } from './server.js'
export type { MCPServerOptions, ToolSchema, ToolHandler } from './server.js'
export { MCPClient } from './client.js'
export type { MCPClientOptions, MCPServerInfo } from './client.js'
export { HttpTransport, SseTransport } from './transport.js'
export type { MCPTransport, JsonRpcRequest, JsonRpcResponse, HttpTransportOptions, SseTransportOptions, SSEEvent } from './transport.js'
export type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// Auth types from @dotdo/mcp (Worker-safe)
export type { AuthContext, AuthMode } from '@dotdo/mcp'
export { ANONYMOUS_CONTEXT, detectTokenType } from '@dotdo/mcp'
