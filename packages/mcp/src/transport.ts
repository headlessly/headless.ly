import type { MCPToolResult } from './types.js'

/** JSON-RPC request */
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id: string | number | null
}

/** JSON-RPC response */
export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/** Transport interface for MCP communication */
export interface MCPTransport {
  /** Send a JSON-RPC request and receive a response */
  send(request: JsonRpcRequest): Promise<JsonRpcResponse>
  /** Close the transport */
  close(): Promise<void>
}

/** Options for HTTP transport */
export interface HttpTransportOptions {
  /** Request headers (e.g., Authorization) */
  headers?: Record<string, string>
  /** Fetch implementation (defaults to globalThis.fetch) */
  fetch?: typeof globalThis.fetch
}

/**
 * HTTP transport for MCP communication.
 * Sends JSON-RPC requests as POST requests to the endpoint.
 */
export class HttpTransport implements MCPTransport {
  private endpoint: string
  private headers: Record<string, string>
  private fetchFn: typeof globalThis.fetch

  constructor(endpoint: string, options?: HttpTransportOptions) {
    this.endpoint = endpoint
    this.headers = {
      'Content-Type': 'application/json',
      ...options?.headers,
    }
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis)
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const response = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`MCP HTTP error: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as JsonRpcResponse
  }

  async close(): Promise<void> {
    // HTTP transport is stateless, nothing to close
  }
}

/** SSE event from the server */
export interface SSEEvent {
  event?: string
  data: string
  id?: string
  retry?: number
}

/** Options for SSE transport */
export interface SseTransportOptions {
  /** Request headers (e.g., Authorization) */
  headers?: Record<string, string>
  /** Fetch implementation (defaults to globalThis.fetch) */
  fetch?: typeof globalThis.fetch
  /** Callback invoked for each SSE event received */
  onEvent?: (event: SSEEvent) => void
}

/**
 * SSE (Server-Sent Events) transport for MCP communication.
 * Sends JSON-RPC requests via POST and reads streaming SSE responses.
 * Each SSE message contains a JSON-RPC response.
 */
export class SseTransport implements MCPTransport {
  private endpoint: string
  private headers: Record<string, string>
  private fetchFn: typeof globalThis.fetch
  private onEvent?: (event: SSEEvent) => void
  private abortController: AbortController | null = null

  constructor(endpoint: string, options?: SseTransportOptions) {
    this.endpoint = endpoint
    this.headers = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...options?.headers,
    }
    this.fetchFn = options?.fetch ?? globalThis.fetch.bind(globalThis)
    this.onEvent = options?.onEvent
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.abortController = new AbortController()

    const response = await this.fetchFn(this.endpoint, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(request),
      signal: this.abortController.signal,
    })

    if (!response.ok) {
      throw new Error(`MCP SSE error: ${response.status} ${response.statusText}`)
    }

    const contentType = response.headers.get('Content-Type') ?? ''

    // If server responds with JSON (non-streaming), parse directly
    if (contentType.includes('application/json')) {
      return (await response.json()) as JsonRpcResponse
    }

    // Parse SSE stream for the JSON-RPC response
    if (!response.body) {
      throw new Error('MCP SSE error: no response body')
    }

    return this.parseSSEStream(response.body)
  }

  private async parseSSEStream(body: ReadableStream<Uint8Array>): Promise<JsonRpcResponse> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let lastResponse: JsonRpcResponse | null = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let currentEvent: string | undefined
        let currentData = ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            currentData += line.slice(5).trim()
          } else if (line.startsWith('id:')) {
            // SSE event ID -- not used for JSON-RPC but tracked
          } else if (line === '') {
            // Empty line signals end of an event
            if (currentData) {
              const sseEvent: SSEEvent = { event: currentEvent, data: currentData }
              this.onEvent?.(sseEvent)

              try {
                lastResponse = JSON.parse(currentData) as JsonRpcResponse
              } catch {
                // Not JSON -- skip
              }
            }
            currentEvent = undefined
            currentData = ''
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    if (!lastResponse) {
      throw new Error('MCP SSE error: no JSON-RPC response received in stream')
    }

    return lastResponse
  }

  async close(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}
