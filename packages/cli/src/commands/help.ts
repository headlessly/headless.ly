/**
 * headlessly help [command]
 *
 * Print usage info showing all commands, or help for a specific command
 */

const VERSION = '0.0.1'

const COMMAND_HELP: Record<string, () => void> = {
  search: () => {
    console.log('headlessly search — Search entities across the graph')
    console.log('')
    console.log('Usage: headlessly search [type] [options]')
    console.log('')
    console.log('Options:')
    console.log('  --filter key=value    Filter by field (supports >, <, >=, <=, !=)')
    console.log('                        Can be specified multiple times')
    console.log('  --query text          Full-text search across fields')
    console.log('  --limit N             Max results (default: 20)')
    console.log('  --sort field:asc|desc Sort results')
    console.log('  --count               Output only the count of matching entities')
    console.log('  --output format       Output format: table, json, csv')
    console.log('  --no-header           Omit table headers (for piping)')
    console.log('  --json                Output as JSON (shortcut for --output json)')
    console.log('')
    console.log('Examples:')
    console.log('  headlessly search Contact')
    console.log('  headlessly search Contact --filter stage=Lead')
    console.log('  headlessly search Deal --filter "value>10000" --sort value:desc --limit 5')
    console.log('  headlessly search --query "alice"')
  },
  fetch: () => {
    console.log('headlessly fetch — Fetch a specific entity')
    console.log('')
    console.log('Usage: headlessly fetch <type> <id> [options]')
    console.log('       headlessly fetch schema [noun]')
    console.log('       headlessly fetch events [--type Type]')
    console.log('')
    console.log('Options:')
    console.log('  --include field1,field2   Include related entities (comma-separated)')
    console.log('  --json                    Output as JSON')
    console.log('')
    console.log('Examples:')
    console.log('  headlessly fetch Contact contact_fX9bL5nRd')
    console.log('  headlessly fetch Contact contact_fX9bL5nRd --include deals')
    console.log('  headlessly fetch schema Contact')
  },
  do: () => {
    console.log('headlessly do — Execute actions on entities')
    console.log('')
    console.log('Usage: headlessly do <action> [options]')
    console.log('')
    console.log('Actions:')
    console.log('  create <type> [--field value...]   Create an entity')
    console.log('  update <type> <id> [--field value...]   Update an entity')
    console.log('  delete <type> <id>                 Delete an entity')
    console.log('  <verb> <type> <id>                 Execute a custom verb')
    console.log('  eval <code>                        Evaluate TypeScript code')
    console.log('')
    console.log('Options:')
    console.log('  --json     Output as JSON')
    console.log('  --quiet    Suppress "ok:" prefix output')
    console.log('')
    console.log('Examples:')
    console.log('  headlessly do create Contact --name Alice --stage Lead')
    console.log('  headlessly do qualify Contact contact_fX9bL5nRd')
    console.log('  headlessly do delete Contact contact_fX9bL5nRd')
  },
  init: () => {
    console.log('headlessly init — Initialize a new organization')
    console.log('')
    console.log('Usage: headlessly init [options]')
    console.log('')
    console.log('Options:')
    console.log('  --template b2b|b2c|b2d|b2a   Use a business model template')
    console.log('  --tenant name                 Organization name (default: "default")')
    console.log('  --dry-run                     Preview changes without writing config')
    console.log('')
    console.log('Examples:')
    console.log('  headlessly init')
    console.log('  headlessly init --template b2b --tenant my-startup')
    console.log('  headlessly init --dry-run --template b2c')
  },
  schema: () => {
    console.log('headlessly schema — Print entity schemas')
    console.log('')
    console.log('Usage: headlessly schema [noun]')
    console.log('')
    console.log('Options:')
    console.log('  --json    Output as JSON')
    console.log('')
    console.log('Examples:')
    console.log('  headlessly schema')
    console.log('  headlessly schema Contact')
    console.log('  headlessly schema --json')
  },
  api: () => {
    console.log('headlessly api — Local API server and API key management')
    console.log('')
    console.log('Usage: headlessly api [options]')
    console.log('       headlessly api keys <subcommand>')
    console.log('')
    console.log('Options:')
    console.log('  --port N        Port for local API server (default: 8787)')
    console.log('')
    console.log('Subcommands:')
    console.log('  keys list       List API keys')
    console.log('  keys create     Create a new API key')
    console.log('  keys revoke     Revoke an API key')
    console.log('')
    console.log('Examples:')
    console.log('  headlessly api')
    console.log('  headlessly api --port 3000')
    console.log('  headlessly api keys list')
  },
  login: () => {
    console.log('headlessly login — Configure authentication')
    console.log('')
    console.log('Usage: headlessly login [options]')
    console.log('')
    console.log('Options:')
    console.log('  --tenant name       Organization name')
    console.log('  --api-key key       API key for authentication')
    console.log('  --endpoint url      Custom API endpoint (default: https://db.headless.ly)')
    console.log('')
    console.log('Examples:')
    console.log('  headlessly login --tenant acme --api-key hly_...')
  },
  status: () => {
    console.log('headlessly status — Show current org status')
    console.log('')
    console.log('Usage: headlessly status')
    console.log('')
    console.log('Displays tenant, mode, config path, entity counts.')
  },
  mcp: () => {
    console.log('headlessly mcp — Start MCP server on stdin/stdout')
    console.log('')
    console.log('Usage: headlessly mcp')
    console.log('')
    console.log('Starts a JSON-RPC server on stdin/stdout for agent integration.')
    console.log('Send JSON-RPC messages, one per line.')
    console.log('')
    console.log('Tools: search, fetch, do')
  },
}

export async function helpCommand(args?: string[]): Promise<void> {
  // Check if a specific command was requested: headlessly help <command>
  const command = args?.[0]?.toLowerCase()

  if (command && COMMAND_HELP[command]) {
    COMMAND_HELP[command]()
    return
  }

  if (command) {
    console.log(`Unknown command: ${command}`)
    console.log('')
  }

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
  console.log('    --include fields          Include related entities')
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
  console.log('  api [--port N]            Start local API server')
  console.log('  status                    Show current org status')
  console.log('  login                     Configure authentication')
  console.log('  init                      Initialize a new organization')
  console.log('  mcp                       Start MCP server on stdin/stdout')
  console.log('')
  console.log('  help [command]            Show help for a command')
  console.log('  --version                 Show version')
  console.log('')
  console.log('Examples:')
  console.log('')
  console.log('  headlessly search Contact --filter stage=Lead')
  console.log('  headlessly do create Contact --name Alice --stage Lead')
  console.log('  headlessly fetch Contact contact_abc123')
  console.log('  headlessly do qualify Contact contact_abc123')
  console.log('  headlessly schema Contact')
  console.log('  headlessly api --port 3000')
  console.log('  headlessly mcp')
  console.log('')
  console.log('Docs: https://headless.ly/docs/cli')
}

export async function versionCommand(): Promise<void> {
  console.log(VERSION)
}
