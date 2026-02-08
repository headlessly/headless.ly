/**
 * headlessly mcp
 *
 * Start an MCP server on stdin/stdout for agent integration.
 * Reads JSON-RPC messages from stdin, writes responses to stdout.
 * This lets agents use headless.ly as an MCP server.
 */

import { getProvider } from '../provider.js'

export async function mcpCommand(_args: string[]): Promise<void> {
  const { MCPServer } = await import('@headlessly/mcp')

  const provider = await getProvider()
  const server = new MCPServer({ provider })

  // Read JSON-RPC from stdin line by line
  let buffer = ''

  process.stdin.setEncoding('utf-8')
  process.stdin.on('data', async (chunk: string) => {
    buffer += chunk

    // Process complete lines
    const lines = buffer.split('\n')
    buffer = lines.pop()! // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const request = JSON.parse(trimmed)
        const response = await server.handleRequest(request)
        process.stdout.write(JSON.stringify(response) + '\n')
      } catch (err) {
        const error = {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error',
            data: err instanceof Error ? err.message : String(err),
          },
        }
        process.stdout.write(JSON.stringify(error) + '\n')
      }
    }
  })

  process.stdin.on('end', () => {
    process.exit(0)
  })

  // Log to stderr so stdout stays clean for JSON-RPC
  process.stderr.write('headlessly MCP server started (stdin/stdout)\n')
  process.stderr.write('Send JSON-RPC messages, one per line.\n')
}
