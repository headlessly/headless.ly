import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { authenticateStdio, tryGetAuth, getAuthForMode } from 'mcp.do'
import type { AuthContext, AuthMode } from '@dotdo/mcp'
import type { MCPServer } from './server.js'

export interface ConnectStdioOptions {
  /** Auth mode: 'anon' | 'anon+auth' | 'auth-required' (default: 'anon+auth') */
  authMode?: AuthMode
  /** Skip browser launch for auth */
  noBrowser?: boolean
  /** Force re-authentication even if token exists */
  forceLogin?: boolean
  /** Explicit auth context (skips the id.org.ai-backed device flow) */
  authContext?: AuthContext
}

/**
 * Connect an MCPServer to stdin/stdout using the MCP SDK's StdioServerTransport.
 * Node.js only — isolated in `@headlessly/mcp/stdio` to keep the main bundle clean for Workers/browsers.
 *
 * Authenticates via the id.org.ai-backed device flow exposed by mcp.do.
 * Default mode is 'anon+auth': uses existing token if available, falls back to anonymous.
 *
 * ```typescript
 * import { MCPServer } from '@headlessly/mcp'
 * import { connectStdio } from '@headlessly/mcp/stdio'
 *
 * const server = new MCPServer({ provider })
 * await connectStdio(server)
 * ```
 */
export async function connectStdio(server: MCPServer, options: ConnectStdioOptions = {}): Promise<void> {
  let authContext: AuthContext
  if (options.authContext) {
    authContext = options.authContext
  } else {
    const mode = options.authMode ?? 'anon+auth'
    authContext = await getAuthForMode(mode, {
      noBrowser: options.noBrowser,
      forceLogin: options.forceLogin,
      print: (msg) => process.stderr.write(msg + '\n'),
    })
  }

  server.setAuthContext(authContext)

  if (authContext.type === 'oauth') {
    process.stderr.write(`Authenticated as ${authContext.id}\n`)
  }

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

// Re-export auth utilities for direct use
export { authenticateStdio, tryGetAuth, getAuthForMode }
