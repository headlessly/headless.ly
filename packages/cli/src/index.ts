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
import { apiCommand } from './commands/api.js'
import { helpCommand, versionCommand } from './commands/help.js'

const COMMANDS = ['search', 'fetch', 'do', 'login', 'init', 'status', 'mcp', 'schema', 'api', 'help']

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1,
          matrix[i]![j - 1]! + 1,
          matrix[i - 1]![j]! + 1,
        )
      }
    }
  }
  return matrix[b.length]![a.length]!
}

function suggestCommand(input: string): string | undefined {
  let best: string | undefined
  let bestDist = Infinity
  for (const cmd of COMMANDS) {
    const dist = levenshtein(input, cmd)
    if (dist < bestDist && dist <= 3) {
      bestDist = dist
      best = cmd
    }
  }
  return best
}

export async function run(args: string[]): Promise<void> {
  const [rawCommand, ...rest] = args
  const command = rawCommand?.toLowerCase()

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
    case 'api':
      return apiCommand(rest)
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      return helpCommand()
    case '--version':
    case '-v':
      return versionCommand()
    default: {
      const suggestion = suggestCommand(command)
      if (suggestion) {
        console.error(`Unknown command: ${rawCommand}. Did you mean: ${suggestion}?`)
      } else {
        console.error(`Unknown command: ${rawCommand}`)
      }
      console.error('Run "headlessly help" for usage')
      process.exit(1)
    }
  }
}

// Re-export for programmatic usage
export { parseArgs } from './args.js'
export type { ParsedArgs } from './args.js'
export { loadConfig, saveConfig } from './config.js'
export type { CLIConfig } from './config.js'
