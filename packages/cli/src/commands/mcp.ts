/**
 * headlessly mcp
 *
 * Start an MCP server on stdin/stdout for agent integration.
 * Uses the official MCP SDK StdioServerTransport for protocol compliance.
 */

import { getProvider } from '../provider.js'

export async function mcpCommand(_args: string[]): Promise<void> {
  const { MCPServer } = await import('@headlessly/mcp')
  const { connectStdio } = await import('@headlessly/mcp/stdio')

  const provider = await getProvider()
  const server = new MCPServer({ provider })

  process.stderr.write('headlessly MCP server started (stdio via MCP SDK)\n')
  await connectStdio(server)
}
