# @headlessly/cli

> Agent-first CLI for headless.ly. Auto-provisions on first use. Structured JSON output. Zero config.

```bash
npx @headlessly/cli search Contact --json
```

No signup. No API key. The CLI auto-provisions an anonymous tenant on first run, saves credentials, and you're operating in seconds.

## Install

```bash
npm install -g @headlessly/cli
```

Or run directly:

```bash
npx @headlessly/cli search Contact --json
```

## Quick Start

Just run a command. The CLI auto-provisions a tenant on first use:

```bash
# First run — auto-provisions and saves credentials
headlessly search Contact --json
# => Auto-provisioned tenant: anon_abc123
# => []

# Create data
headlessly do create Contact --data '{"name":"Alice","email":"alice@example.com","stage":"Lead"}' --json

# Search it back
headlessly search Contact --json --fields name,stage

# See the CDC events
headlessly fetch events --json --limit 5

# Claim the tenant permanently via GitHub commit
# https://id.org.ai/claim/clm_...
```

## search

Find entities with filters, sorting, and field masking.

```bash
headlessly search Contact --json
headlessly search Contact --filter stage=Lead --limit 10 --json
headlessly search Deal --filter "value>10000" --sort value:desc --json
headlessly search Contact --fields name,email,stage --json
headlessly search --query "alice" --json
headlessly search Contact --count
headlessly search Contact --output csv
```

## fetch

Get a specific entity, schema, or events.

```bash
# Entity by ID
headlessly fetch Contact contact_fX9bL5nRd --json
headlessly fetch Contact contact_fX9bL5nRd --fields name,email,stage --json
headlessly fetch Contact contact_fX9bL5nRd --include deals --json

# Schema
headlessly fetch schema
headlessly fetch schema Contact

# Events (ClickHouse CDC)
headlessly fetch events --json --limit 10
headlessly fetch events --type Contact --since 2026-01-01 --json
headlessly fetch events --fields id,type,event,ts --json

# Entity history
headlessly fetch Contact contact_fX9bL5nRd --history --json
```

## do

Create, update, delete entities, or execute custom verbs.

```bash
# Create
headlessly do create Contact --data '{"name":"Alice","stage":"Lead"}' --json

# Update
headlessly do update Contact contact_fX9bL5nRd --data '{"stage":"Qualified"}' --json

# Delete
headlessly do delete Contact contact_fX9bL5nRd --json

# Custom verbs
headlessly do qualify Contact contact_fX9bL5nRd --json
headlessly do close Deal deal_k7TmPvQx --json

# Dry run — preview without executing
headlessly do create Contact --data '{"name":"Test"}' --dry-run --json
```

Individual fields can also be passed as flags: `--name Alice --stage Lead`.

## Agent-First Design

**Structured output**: `--json` on any command. JSON on stdout, status messages on stderr.

**Field masking**: `--fields name,stage` keeps context windows small.

**Dry run**: `--dry-run` previews mutations without executing.

**Exit codes**: 0 (success), 1 (usage), 2 (auth), 3 (not found), 4 (server).

**Structured errors**:

```json
{ "error": { "code": "VALIDATION", "message": "Field 'stage' must be one of: Lead, Qualified, Customer" } }
```

## Commands

| Command                   | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `search [type]`           | Search entities with filters, sorting, field masking |
| `fetch <type> <id>`       | Fetch entity, schema, or events                      |
| `do <action> [type] [id]` | Create, update, delete, or execute custom verbs      |
| `login`                   | Configure remote endpoint and credentials            |
| `status`                  | Show connection status and registered entities       |
| `mcp`                     | Start MCP server for AI agent connections            |
| `help`                    | Show usage information                               |
| `--version`               | Show version                                         |

## Configuration

The CLI reads configuration from three sources (in order of precedence):

1. **Environment variables**: `HEADLESSLY_ENDPOINT`, `HEADLESSLY_API_KEY` or `HEADLESSLY_TOKEN`, `HEADLESSLY_TENANT`
2. **Config file**: `~/.headlessly/config.json` (auto-created on first use, or by `headlessly login`)
3. **Auto-provision**: If no config exists, provisions an anonymous tenant automatically

```bash
# Explicit login
headlessly login --tenant my-startup --api-key hly_abc123

# Or via environment
export HEADLESSLY_API_KEY=hly_abc123
export HEADLESSLY_ENDPOINT=https://api.headless.ly/~my-startup
headlessly search Contact --json

# Or just run it — auto-provisions on first use
headlessly search Contact --json
```

## MCP Server

Start a local MCP server for AI agent connections:

```bash
headlessly mcp
```

Exposes three tools: `search`, `fetch`, `do`.

## License

MIT
