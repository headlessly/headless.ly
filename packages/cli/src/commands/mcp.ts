/**
 * headlessly mcp
 *
 * Start an MCP server on stdin/stdout for agent integration.
 * Uses the official MCP SDK StdioServerTransport for protocol compliance.
 * Supports oauth.do device-flow authentication via mcp.do.
 */

import { getProvider } from '../provider.js'

export async function mcpCommand(args: string[]): Promise<void> {
  const { MCPServer } = await import('@headlessly/mcp')
  const { connectStdio } = await import('@headlessly/mcp/stdio')

  const provider = await getProvider()
  const server = new MCPServer({ provider })

  const authMode = args.includes('--auth') ? 'auth-required' as const : 'anon+auth' as const
  const noBrowser = args.includes('--no-browser')
  const forceLogin = args.includes('--force-login')

  process.stderr.write('headlessly MCP server starting (stdio)...\n')
  await connectStdio(server, { authMode, noBrowser, forceLogin })
}
