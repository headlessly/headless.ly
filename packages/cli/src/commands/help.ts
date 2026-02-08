/**
 * headlessly help
 *
 * Print usage info showing all commands
 */

const VERSION = '0.0.1'

export async function helpCommand(): Promise<void> {
  console.log(`headlessly v${VERSION} — The CLI for headless.ly`)
  console.log('')
  console.log('Usage: headlessly <command> [options]')
  console.log('')
  console.log('Commands:')
  console.log('')
  console.log('  search [type]             Search entities across the graph')
  console.log('    --filter key=value        Filter by field (supports >, <, >=, <=, !=)')
  console.log('    --query text              Full-text search across fields')
  console.log('    --limit N                 Max results (default: 20)')
  console.log('    --sort field:asc|desc     Sort results')
  console.log('    --json                    Output as JSON')
  console.log('')
  console.log('  fetch <type> <id>         Fetch a specific entity')
  console.log('  fetch schema [noun]       Show schema for a noun or all nouns')
  console.log('  fetch events              Fetch event stream')
  console.log('')
  console.log('  do create <type> [flags]  Create an entity (flags become fields)')
  console.log('  do update <type> <id>     Update an entity')
  console.log('  do delete <type> <id>     Delete an entity')
  console.log('  do <verb> <type> <id>     Execute a custom verb')
  console.log('  do eval <code>            Evaluate TypeScript code')
  console.log('')
  console.log('  schema [noun]             Print entity schemas')
  console.log('  status                    Show current org status')
  console.log('  login                     Configure authentication')
  console.log('  init                      Initialize a new organization')
  console.log('  mcp                       Start MCP server on stdin/stdout')
  console.log('')
  console.log('  help                      Show this help')
  console.log('  --version                 Show version')
  console.log('')
  console.log('Examples:')
  console.log('')
  console.log('  headlessly search Contact --filter stage=Lead')
  console.log('  headlessly do create Contact --name Alice --stage Lead')
  console.log('  headlessly fetch Contact contact_abc123')
  console.log('  headlessly do qualify Contact contact_abc123')
  console.log('  headlessly schema Contact')
  console.log('  headlessly mcp')
  console.log('')
  console.log('Docs: https://headless.ly/docs/cli')
}

export async function versionCommand(): Promise<void> {
  console.log(VERSION)
}
