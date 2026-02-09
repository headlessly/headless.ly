# @headlessly/cli

CLI tool for headless.ly developers and agents -- mirrors the three MCP tools (search, fetch, do) plus org management.

## Install

```bash
npm install -g @headlessly/cli
```

Or run directly:

```bash
npx @headlessly/cli
```

## Usage

```bash
# Search for entities
headlessly search Contact --filter '{"stage":"Lead"}'
headlessly search Deal --filter '{"status":"Open"}' --limit 10

# Fetch a specific entity
headlessly fetch Contact contact_fX9bL5
headlessly fetch Deal deal_k7TmPv --include deals

# Execute actions
headlessly do create Contact '{"name":"Alice","stage":"Lead"}'
headlessly do qualify contact_fX9bL5

# Login and init
headlessly login
headlessly init

# Check status
headlessly status

# View schema definitions
headlessly schema Contact
headlessly schema Deal

# Start MCP server
headlessly mcp
```

## Commands

| Command              | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| `search <type>`      | Search for entities across the graph                       |
| `fetch <type> <id>`  | Fetch a specific entity by type and ID                     |
| `do <action> [args]` | Execute an action (create, update, delete, or custom verb) |
| `login`              | Authenticate with headless.ly                              |
| `init`               | Initialize a new headless.ly project                       |
| `status`             | Show current org and connection status                     |
| `schema [noun]`      | Display schema definitions                                 |
| `mcp`                | Start an MCP server                                        |
| `help`               | Show usage information                                     |
| `--version`          | Show version                                               |

## API

Programmatic usage:

```typescript
import { run, parseArgs, loadConfig, saveConfig } from '@headlessly/cli'

// Run a command programmatically
await run(['search', 'Contact', '--filter', '{"stage":"Lead"}'])

// Parse CLI arguments
const args = parseArgs(['search', 'Contact', '--limit', '10'])

// Load/save CLI config
const config = await loadConfig()
await saveConfig({ tenant: 'acme', apiKey: 'key_...' })
```

### Exports

- **`run(args)`** -- execute a CLI command from an argument array
- **`parseArgs(args)`** -- parse CLI arguments into a structured object
- **`loadConfig()`** -- load CLI configuration from disk
- **`saveConfig(config)`** -- persist CLI configuration

## License

MIT
