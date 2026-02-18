# @headlessly/cli

> `search`, `fetch`, `do` -- from your terminal. The headless.ly CLI for developers and agents.

```bash
headlessly search Contact --stage Lead
headlessly fetch Deal deal_fX9bL5nRd --include contact
headlessly do 'await $.Contact.qualify("contact_fX9bL5nRd")'
```

## The Three Primitives

The same three operations that power the SDK and MCP, available from the command line. No REST endpoint memorization. No curl incantations. Three verbs.

## Install

```bash
npm install -g @headlessly/cli
```

Or run directly:

```bash
npx @headlessly/cli search Contact --stage Lead
```

## search

Find entities across the graph with filters, sorting, and pagination.

```bash
# Find all leads
headlessly search Contact --stage Lead

# Find open deals sorted by value
headlessly search Deal --stage Open --sort -value --limit 10

# Filter with MongoDB-style operators
headlessly search Deal --filter '{"value":{"$gte":10000}}'

# Search across entity types
headlessly search --query 'alice'

# Output as JSON
headlessly search Contact --stage Lead --json
```

## fetch

Get a specific entity by type and ID, with optional relationship expansion.

```bash
# Fetch a contact
headlessly fetch Contact contact_fX9bL5nRd

# Include relationships
headlessly fetch Deal deal_k7TmPvQx --include contact,company

# Fetch a schema definition
headlessly fetch schema Contact

# Fetch with full event history
headlessly fetch Contact contact_fX9bL5nRd --history
```

## do

Execute any operation -- CRUD, custom verbs, or arbitrary code.

```bash
# Create an entity
headlessly do 'await $.Contact.create({ name: "Alice", stage: "Lead" })'

# Execute a custom verb
headlessly do 'await $.Contact.qualify("contact_fX9bL5nRd")'

# Chain operations
headlessly do '
  const leads = await $.Contact.find({ stage: "Lead" })
  for (const lead of leads) {
    await $.Contact.qualify(lead.$id)
  }
  console.log(`Qualified ${leads.length} leads`)
'

# Cross-domain operations
headlessly do '
  const deal = await $.Deal.close("deal_k7TmPvQx")
  await $.Subscription.create({ plan: "pro", contact: deal.contact })
'
```

The `do` command runs TypeScript via secure sandboxed execution. `$` gives you the full 35-entity context -- same as `import { $ } from '@headlessly/sdk'`.

## Org Management

```bash
# Authenticate with headless.ly
headlessly login

# Initialize a new project in the current directory
headlessly init

# Show current org, tenant, and connection status
headlessly status

# View schema definitions
headlessly schema                 # List all 35 entity types
headlessly schema Contact         # Show Contact schema with fields, verbs, relationships
headlessly schema Deal --verbs    # Show verb conjugations for Deal
```

## MCP Server

Start a local MCP server that exposes `search`, `fetch`, and `do` to any MCP-compatible agent:

```bash
headlessly mcp
```

Point your agent at the local MCP endpoint and it gets access to the entire entity graph through the same three primitives.

## Commands

| Command             | Description                                       |
| ------------------- | ------------------------------------------------- |
| `search <type>`     | Search for entities across the graph              |
| `fetch <type> <id>` | Fetch a specific entity by type and ID            |
| `do <code>`         | Execute an action or code with full entity access |
| `login`             | Authenticate with headless.ly                     |
| `init`              | Initialize a new headless.ly project              |
| `status`            | Show current org and connection status            |
| `schema [noun]`     | Display schema definitions                        |
| `mcp`               | Start an MCP server                               |
| `help`              | Show usage information                            |
| `--version`         | Show version                                      |

## Programmatic API

Use the CLI as a library:

```typescript
import { run, parseArgs, loadConfig, saveConfig } from '@headlessly/cli'

// Run a command programmatically
await run(['search', 'Contact', '--stage', 'Lead'])

// Parse CLI arguments into structured objects
const args = parseArgs(['search', 'Contact', '--limit', '10'])
// → { command: 'search', type: 'Contact', options: { limit: 10 } }

// Load CLI configuration from ~/.headlessly/config.json
const config = await loadConfig()
// → { tenant: 'acme', apiKey: 'key_fX9bL5nRd', endpoint: 'https://db.headless.ly' }

// Save configuration
await saveConfig({ tenant: 'acme', apiKey: 'key_fX9bL5nRd' })
```

## Configuration

The CLI reads configuration from three sources (in order of precedence):

1. **Command-line flags**: `--tenant acme --api-key key_xxx`
2. **Environment variables**: `HEADLESSLY_TENANT`, `HEADLESSLY_API_KEY`
3. **Config file**: `~/.headlessly/config.json` (created by `headlessly login`)

```bash
# Set tenant via flag
headlessly search Contact --tenant acme --stage Lead

# Or via environment
export HEADLESSLY_TENANT=acme
export HEADLESSLY_API_KEY=key_fX9bL5nRd
headlessly search Contact --stage Lead
```

## License

MIT
