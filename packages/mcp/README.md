# @headlessly/mcp

MCP (Model Context Protocol) server implementation for headless.ly -- three tools: search, fetch, do.

## Install

```bash
npm install @headlessly/mcp
```

## Usage

```typescript
import { MCPServer } from '@headlessly/mcp'
import { MemoryNounProvider } from 'digital-objects'

const server = new MCPServer({
  provider: new MemoryNounProvider(),
})

// Handle JSON-RPC requests
const response = await server.handleRequest({
  jsonrpc: '2.0',
  method: 'tools/call',
  id: 1,
  params: {
    name: 'search',
    arguments: { type: 'Contact', filter: { stage: 'Lead' } },
  },
})

// Handle raw HTTP requests (for Hono/Express routes)
app.post('/mcp', (c) => server.handleHTTP(c.req.raw))
```

### Tool Definitions

```typescript
import { getTools } from '@headlessly/mcp'

// Dynamically generated from registered Noun schemas
const tools = getTools()
// [{ name: 'search', ... }, { name: 'fetch', ... }, { name: 'do', ... }]
```

### Custom Handlers

```typescript
import { createHandlers } from '@headlessly/mcp'

const handlers = createHandlers({
  provider: myProvider,
  evaluate: async (code, context) => {
    // Custom code evaluation for the 'do' tool
    return eval(code)
  },
})

const result = await handlers.search({ type: 'Contact', filter: { stage: 'Lead' } })
const entity = await handlers.fetch({ resource: 'entity', type: 'Contact', id: 'contact_fX9bL5' })
const output = await handlers.doAction({ action: 'create', type: 'Deal', data: { title: 'New' } })
```

## API

### `MCPServer`

Full MCP server with JSON-RPC protocol support.

- **`handleRequest(body)`** -- handle a JSON-RPC request object, returns JSON-RPC response
- **`handleHTTP(request)`** -- handle a raw HTTP request, returns a Response

Supported JSON-RPC methods:
- `initialize` -- protocol handshake
- `tools/list` -- list available tools
- `tools/call` -- execute a tool

### `getTools(context?)`

Generate MCP tool definitions from registered Noun schemas. Returns an array of tool objects with `name`, `description`, and `inputSchema`.

### `createHandlers(options)`

Create handler functions for each tool.

- **`handlers.search(args)`** -- search entities with type, query, filter, limit, sort
- **`handlers.fetch(args)`** -- fetch entity, schema, events, metrics, or state (supports time-travel via `asOf`)
- **`handlers.doAction(args)`** -- execute create, update, delete, custom verbs, or eval code

### Types

- `MCPTool`, `MCPToolCall`, `MCPToolResult` -- tool protocol types
- `MCPContext` -- server context
- `SearchArgs`, `FetchArgs`, `DoArgs` -- tool argument types
- `MCPServerOptions`, `MCPHandlerOptions` -- configuration types

## License

MIT
