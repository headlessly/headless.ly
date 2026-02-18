/**
 * createServer — REST API middleware that exposes entities as HTTP endpoints
 *
 * Creates an Express/Hono-compatible middleware that maps entity operations
 * to standard REST routes:
 *   GET    /api/:type       → find (with query params as filter)
 *   GET    /api/:type/:id   → get
 *   POST   /api/:type       → create
 *   PUT    /api/:type/:id   → update
 *   DELETE /api/:type/:id   → delete
 *   POST   /api/:type/:id/:verb → perform custom verb
 */

/**
 * Entity-like interface for server operations
 * Matches the NounEntity shape from digital-objects
 */
export interface ServerEntity {
  find(filter?: Record<string, unknown>): Promise<unknown[]>
  get(id: string): Promise<unknown | null>
  create(data: Record<string, unknown>): Promise<unknown>
  update(id: string, data: Record<string, unknown>): Promise<unknown>
  delete(id: string): Promise<boolean>
  perform?(verb: string, id: string, data?: Record<string, unknown>): Promise<unknown>
  $type?: string
}

/**
 * Options for createServer
 */
export interface CreateServerOptions {
  /** Entity registry — maps type names to entity objects */
  entities: Record<string, ServerEntity>
  /** Base path prefix (default: '/api') */
  basePath?: string
  /** Optional API key for authentication */
  apiKey?: string
  /** CORS origin (default: '*') */
  cors?: string | boolean
}

/**
 * A parsed incoming request
 */
interface ParsedRequest {
  method: string
  pathname: string
  searchParams: URLSearchParams
  body?: Record<string, unknown>
}

/**
 * A minimal response interface compatible with Express and Hono
 */
interface ServerResponse {
  status: number
  headers: Record<string, string>
  body: string
}

/**
 * Parse a URL path relative to a base path into segments
 */
function parseRoute(pathname: string, basePath: string): string[] {
  const relative = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname
  return relative.split('/').filter(Boolean)
}

/**
 * Handle a single REST request against the entity registry
 */
async function handleRequest(req: ParsedRequest, options: CreateServerOptions): Promise<ServerResponse> {
  const basePath = options.basePath ?? '/api'
  const segments = parseRoute(req.pathname, basePath)

  // Auth check
  if (options.apiKey) {
    const authHeader = req.searchParams.get('_auth') || ''
    // Auth would normally come from headers, but we check a simplified version here
    // The middleware wrapper handles actual header extraction
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (options.cors) {
    headers['Access-Control-Allow-Origin'] = typeof options.cors === 'string' ? options.cors : '*'
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
  }

  if (segments.length === 0) {
    // GET /api → list available entity types
    return {
      status: 200,
      headers,
      body: JSON.stringify({ types: Object.keys(options.entities) }),
    }
  }

  const typeName = segments[0]
  const entity = options.entities[typeName]

  if (!entity) {
    return {
      status: 404,
      headers,
      body: JSON.stringify({ error: `Unknown entity type: ${typeName}` }),
    }
  }

  const id = segments[1]
  const verb = segments[2]

  try {
    // POST /api/:type/:id/:verb → perform custom verb
    if (req.method === 'POST' && id && verb) {
      if (!entity.perform) {
        return { status: 405, headers, body: JSON.stringify({ error: 'Custom verbs not supported' }) }
      }
      const result = await entity.perform(verb, id, req.body)
      return { status: 200, headers, body: JSON.stringify(result) }
    }

    // GET /api/:type → find
    if (req.method === 'GET' && !id) {
      const filter: Record<string, unknown> = {}
      for (const [key, value] of req.searchParams) {
        if (key.startsWith('_')) continue // skip internal params
        filter[key] = value
      }
      const results = await entity.find(Object.keys(filter).length > 0 ? filter : undefined)
      return { status: 200, headers, body: JSON.stringify(results) }
    }

    // GET /api/:type/:id → get
    if (req.method === 'GET' && id) {
      const result = await entity.get(id)
      if (!result) {
        return { status: 404, headers, body: JSON.stringify({ error: `${typeName} not found: ${id}` }) }
      }
      return { status: 200, headers, body: JSON.stringify(result) }
    }

    // POST /api/:type → create
    if (req.method === 'POST' && !id) {
      if (!req.body) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
      }
      const result = await entity.create(req.body)
      return { status: 201, headers, body: JSON.stringify(result) }
    }

    // PUT /api/:type/:id → update
    if (req.method === 'PUT' && id) {
      if (!req.body) {
        return { status: 400, headers, body: JSON.stringify({ error: 'Request body required' }) }
      }
      const result = await entity.update(id, req.body)
      return { status: 200, headers, body: JSON.stringify(result) }
    }

    // DELETE /api/:type/:id → delete
    if (req.method === 'DELETE' && id) {
      const success = await entity.delete(id)
      if (!success) {
        return { status: 404, headers, body: JSON.stringify({ error: `${typeName} not found: ${id}` }) }
      }
      return { status: 200, headers, body: JSON.stringify({ deleted: true }) }
    }

    return { status: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { status: 500, headers, body: JSON.stringify({ error: message }) }
  }
}

/**
 * Create an Express-compatible middleware that exposes entities as a REST API
 *
 * @example
 * ```typescript
 * import { headlessly } from '@headlessly/node'
 * import { createServer } from '@headlessly/node'
 * import express from 'express'
 *
 * const { $, entities } = headlessly()
 * const app = express()
 * app.use(express.json())
 * app.use(createServer({ entities }))
 * app.listen(3000)
 * ```
 */
export function createServer(options: CreateServerOptions) {
  const basePath = options.basePath ?? '/api'

  return async function serverMiddleware(
    req: {
      method: string
      url: string
      path?: string
      body?: unknown
      headers?: Record<string, string> | { authorization?: string }
    },
    res: {
      statusCode?: number
      status?: (code: number) => { json: (data: unknown) => void; end: () => void; send?: (body: string) => void }
      setHeader?: (name: string, value: string) => void
      writeHead?: (status: number, headers?: Record<string, string>) => void
      end?: (body?: string) => void
      json?: (data: unknown) => void
    },
    next?: () => void | Promise<void>,
  ): Promise<void> {
    const pathname = req.path ?? new URL(req.url, 'http://localhost').pathname

    // Only handle requests under the base path
    if (!pathname.startsWith(basePath)) {
      if (next) await next()
      return
    }

    // OPTIONS for CORS
    if (req.method === 'OPTIONS') {
      if (res.writeHead && res.end) {
        const headers: Record<string, string> = {}
        if (options.cors) {
          headers['Access-Control-Allow-Origin'] = typeof options.cors === 'string' ? options.cors : '*'
          headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
          headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        }
        res.writeHead(204, headers)
        res.end()
      }
      return
    }

    // Auth check
    if (options.apiKey) {
      const authHeader = (req.headers as Record<string, string>)?.authorization || (req.headers as Record<string, string>)?.Authorization || ''
      const token = authHeader.replace('Bearer ', '')
      if (token !== options.apiKey) {
        if (res.writeHead && res.end) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unauthorized' }))
        } else if (res.status) {
          res.status(401).json({ error: 'Unauthorized' })
        }
        return
      }
    }

    const url = new URL(req.url, 'http://localhost')

    const parsed: ParsedRequest = {
      method: req.method,
      pathname,
      searchParams: url.searchParams,
      body: req.body as Record<string, unknown> | undefined,
    }

    const response = await handleRequest(parsed, options)

    // Express-style response
    if (res.writeHead && res.end) {
      res.writeHead(response.status, response.headers)
      res.end(response.body)
      return
    }

    // Hono-style response
    if (res.status && typeof res.status === 'function') {
      const s = res.status(response.status)
      if (s.send) {
        s.send(response.body)
      } else {
        s.json(JSON.parse(response.body))
      }
      return
    }

    // Fallback
    if (res.setHeader && res.end) {
      for (const [k, v] of Object.entries(response.headers)) {
        res.setHeader(k, v)
      }
      if (res.statusCode !== undefined) res.statusCode = response.status
      res.end(response.body)
    }
  }
}
