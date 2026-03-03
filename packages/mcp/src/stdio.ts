import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { MCPServer } from './server.js'

/**
 * Connect an MCPServer to stdin/stdout using the MCP SDK's StdioServerTransport.
 * Node.js only — isolated in `@headlessly/mcp/stdio` to keep the main bundle clean for Workers/browsers.
 *
 * ```typescript
 * import { MCPServer } from '@headlessly/mcp'
 * import { connectStdio } from '@headlessly/mcp/stdio'
 *
 * const server = new MCPServer({ provider })
 * await connectStdio(server)
 * ```
 */
export async function connectStdio(server: MCPServer): Promise<void> {
  const transport = new StdioServerTransport()
  process.on('SIGINT', async () => {
    await server.server.close()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    await server.server.close()
    process.exit(0)
  })
  await server.connect(transport)
}
