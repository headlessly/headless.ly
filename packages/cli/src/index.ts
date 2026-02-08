/**
 * @headlessly/cli — Command router
 *
 * The headlessly CLI wraps the SDK and provides search/fetch/do commands
 * that match the three MCP tools.
 */

import { searchCommand } from './commands/search.js'
import { fetchCommand } from './commands/fetch.js'
import { doCommand } from './commands/do.js'
import { loginCommand } from './commands/login.js'
import { initCommand } from './commands/init.js'
import { statusCommand } from './commands/status.js'
import { mcpCommand } from './commands/mcp.js'
import { schemaCommand } from './commands/schema.js'
import { helpCommand, versionCommand } from './commands/help.js'

export async function run(args: string[]): Promise<void> {
  const [command, ...rest] = args

  switch (command) {
    case 'search':
      return searchCommand(rest)
    case 'fetch':
      return fetchCommand(rest)
    case 'do':
      return doCommand(rest)
    case 'login':
      return loginCommand(rest)
    case 'init':
      return initCommand(rest)
    case 'status':
      return statusCommand(rest)
    case 'mcp':
      return mcpCommand(rest)
    case 'schema':
      return schemaCommand(rest)
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      return helpCommand()
    case '--version':
    case '-v':
      return versionCommand()
    default:
      console.error(`Unknown command: ${command}`)
      console.error('Run "headlessly help" for usage')
      process.exit(1)
  }
}

// Re-export for programmatic usage
export { parseArgs } from './args.js'
export type { ParsedArgs } from './args.js'
export { loadConfig, saveConfig } from './config.js'
export type { CLIConfig } from './config.js'
