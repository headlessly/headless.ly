/** MCP Tool definition */
export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, MCPSchemaProperty>
    required?: string[]
  }
}

export interface MCPSchemaProperty {
  type: string
  description: string
  enum?: string[]
  items?: MCPSchemaProperty
  properties?: Record<string, MCPSchemaProperty>
}

/** MCP Tool call request */
export interface MCPToolCall {
  name: string
  arguments: Record<string, unknown>
}

/** MCP Tool call result */
export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'resource'
    text?: string
    resource?: { uri: string; mimeType: string; text: string }
  }>
  isError?: boolean
}

/** MCP Server context */
export interface MCPContext {
  tenant?: string
  subdomain?: string
  system?: string
  journey?: string
}

/** Search arguments */
export interface SearchArgs {
  /** Entity type to search (e.g., 'Contact', 'Deal'). Omit to search all types. */
  type?: string
  /** Filter criteria */
  filter?: Record<string, unknown>
  /** Full-text search query */
  query?: string
  /** Maximum results */
  limit?: number
  /** Sort specification */
  sort?: Record<string, 'asc' | 'desc'>
}

/** Fetch arguments */
export interface FetchArgs {
  /** What to fetch: 'entity', 'schema', 'events', 'metrics' */
  resource: 'entity' | 'schema' | 'events' | 'metrics' | 'state'
  /** Entity type */
  type?: string
  /** Entity ID */
  id?: string
  /** Time travel: get state as of this timestamp */
  asOf?: string
  /** Schema: get specific noun or all nouns */
  noun?: string
}

/** Do arguments */
export interface DoArgs {
  /** Action to execute */
  action: string
  /** Entity type */
  type?: string
  /** Entity ID */
  id?: string
  /** Action data */
  data?: Record<string, unknown>
  /** TypeScript code to evaluate (for complex operations) */
  code?: string
}
