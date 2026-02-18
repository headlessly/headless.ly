# @headlessly/mcp

> Three tools. Not three hundred. The entire business graph via MCP.

```typescript
import { MCPServer } from '@headlessly/mcp'

const server = new MCPServer({ provider })

// search — find entities across the graph
await server.handleRequest({
  jsonrpc: '2.0',
  method: 'tools/call',
  id: 1,
  params: { name: 'search', arguments: { type: 'Contact', filter: { stage: 'Lead' } } },
})

// fetch — get specific entities with relationships
await server.handleRequest({
  jsonrpc: '2.0',
  method: 'tools/call',
  id: 2,
  params: { name: 'fetch', arguments: { type: 'Deal', id: 'deal_k7TmPvQx', include: ['contact', 'subscription'] } },
})

// do — execute any operation with TypeScript
await server.handleRequest({
  jsonrpc: '2.0',
  method: 'tools/call',
  id: 3,
  params: { name: 'do', arguments: { code: 'await $.Contact.qualify("contact_fX9bL5nRd")' } },
})
```

Most SaaS products expose hundreds of API endpoints per domain. An AI agent connecting to HubSpot + Stripe + Zendesk + Jira needs to learn 1,000+ different tool schemas. headless.ly exposes three: `search` across the graph, `fetch` with relationships, `do` anything with TypeScript. One MCP server covers CRM, billing, support, projects, marketing, analytics, experiments, and workflows.

## The Problem

Every SaaS product builds its own MCP server. Each one exposes 20-50 tools with unique schemas, authentication flows, and error formats. Your agent needs to:

- Learn HubSpot's 47 tools for CRM
- Learn Stripe's 38 tools for billing
- Learn Zendesk's 25 tools for support
- Learn Jira's 32 tools for projects
- Learn Mailchimp's 22 tools for marketing
- Map data between all of them

That's 164 tool schemas. And they don't share a data model, so "the contact who has a deal that has a subscription that has a support ticket" requires your agent to orchestrate across four different APIs with four different ID systems.

headless.ly collapses all of this into three tools against one typed graph.

## Three Tools

### search

Find entities across any domain with MongoDB-style filters:

```json title="headless.ly/mcp#search"
{ "type": "Contact", "filter": { "stage": "Lead", "leadScore": { "$gte": 50 } } }
```

```json title="headless.ly/mcp#search"
{ "type": "Deal", "filter": { "stage": "Open", "value": { "$gt": 10000 } }, "sort": "-value", "limit": 10 }
```

### fetch

Get specific entities with relationship traversal:

```json title="headless.ly/mcp#fetch"
{ "type": "Contact", "id": "contact_fX9bL5nRd", "include": ["deals", "subscriptions", "tickets"] }
```

```json title="headless.ly/mcp#fetch"
{ "resource": "schema", "type": "Deal" }
```

```json title="headless.ly/mcp#fetch"
{ "resource": "events", "type": "Contact", "id": "contact_fX9bL5nRd", "asOf": "2025-06-01T00:00:00Z" }
```

### do

Execute any operation — CRUD, custom verbs, or full TypeScript programs:

```ts title="headless.ly/mcp#do"
// Qualify every lead with a score above 80
const leads = await $.Contact.find({ stage: 'Lead', leadScore: { $gte: 80 } })
for (const lead of leads) {
  await $.Contact.qualify(lead.$id)
  await $.Deal.create({
    name: `${lead.name} opportunity`,
    contact: lead.$id,
    stage: 'Prospecting',
  })
}
```

The `do` tool executes arbitrary TypeScript in a sandboxed environment with full access to the entity graph via `$`. This is how agents go beyond CRUD to truly autonomous operations.

## Auto-Generated Tool Definitions

Noun schemas automatically generate MCP tool definitions. No manual schema maintenance:

```typescript
import { getTools } from '@headlessly/mcp'

const tools = getTools()
// [
//   { name: 'search', description: 'Search across 35 entity types...', inputSchema: { ... } },
//   { name: 'fetch', description: 'Fetch entities, schemas, events...', inputSchema: { ... } },
//   { name: 'do', description: 'Execute TypeScript with full entity access...', inputSchema: { ... } },
// ]
```

Every entity type, every field, every verb — all reflected in the tool schemas your agent receives.

## Custom Handlers

Build your own MCP integration with direct handler access:

```typescript
import { createHandlers } from '@headlessly/mcp'

const handlers = createHandlers({
  provider: myProvider,
  evaluate: async (code, context) => {
    // Sandboxed code execution for the 'do' tool
    return await sandbox.run(code, context)
  },
})

const leads = await handlers.search({ type: 'Contact', filter: { stage: 'Lead' } })
const deal = await handlers.fetch({ resource: 'entity', type: 'Deal', id: 'deal_k7TmPvQx' })
const result = await handlers.doAction({ code: 'await $.Contact.qualify("contact_fX9bL5nRd")' })
```

## HTTP Integration

Drop the MCP server into any Hono, Express, or Cloudflare Worker route:

```typescript
import { MCPServer } from '@headlessly/mcp'

const server = new MCPServer({ provider })

// Hono
app.post('/mcp', (c) => server.handleHTTP(c.req.raw))

// Express
app.post('/mcp', (req, res) => {
  const response = await server.handleHTTP(req)
  res.json(response)
})
```

## Install

```bash
npm install @headlessly/mcp
```

## API

### `MCPServer`

Full MCP server with JSON-RPC protocol support.

- **`handleRequest(body)`** -- handle a JSON-RPC request object, returns JSON-RPC response
- **`handleHTTP(request)`** -- handle a raw HTTP request, returns a Response

Supported JSON-RPC methods:

- `initialize` -- protocol handshake
- `tools/list` -- list available tools (auto-generated from Noun schemas)
- `tools/call` -- execute a tool (search, fetch, or do)

### `getTools(context?)`

Generate MCP tool definitions from registered Noun schemas. Returns an array of tool objects with `name`, `description`, and `inputSchema`.

### `createHandlers(options)`

Create handler functions for each tool.

- **`handlers.search(args)`** -- search entities with type, query, filter, limit, sort
- **`handlers.fetch(args)`** -- fetch entity, schema, events, metrics, or state (supports time-travel via `asOf`)
- **`handlers.doAction(args)`** -- execute create, update, delete, custom verbs, or eval code

### Types

- `MCPTool`, `MCPToolCall`, `MCPToolResult` -- tool protocol types
- `MCPContext` -- server context with provider and evaluator
- `SearchArgs`, `FetchArgs`, `DoArgs` -- tool argument types
- `MCPServerOptions`, `MCPHandlerOptions` -- configuration types

## License

MIT
