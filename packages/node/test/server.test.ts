import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createServer } from '../src/server.js'
import type { ServerEntity, CreateServerOptions } from '../src/server.js'

// ---------------------------------------------------------------------------
// Mock entity store
// ---------------------------------------------------------------------------

function createMockEntity(typeName: string): ServerEntity & { _store: Map<string, Record<string, unknown>> } {
  const store = new Map<string, Record<string, unknown>>()
  let nextId = 1

  return {
    _store: store,
    $type: typeName,

    async find(filter?: Record<string, unknown>) {
      const all = Array.from(store.values())
      if (!filter) return all
      return all.filter((item) => {
        for (const [key, value] of Object.entries(filter)) {
          if (item[key] !== value) return false
        }
        return true
      })
    },

    async get(id: string) {
      return store.get(id) ?? null
    },

    async create(data: Record<string, unknown>) {
      const id = `${typeName.toLowerCase()}_${nextId++}`
      const instance = { $id: id, $type: typeName, ...data }
      store.set(id, instance)
      return instance
    },

    async update(id: string, data: Record<string, unknown>) {
      const existing = store.get(id)
      if (!existing) throw new Error(`${typeName} not found: ${id}`)
      const updated = { ...existing, ...data }
      store.set(id, updated)
      return updated
    },

    async delete(id: string) {
      return store.delete(id)
    },

    async perform(verb: string, id: string, data?: Record<string, unknown>) {
      const existing = store.get(id)
      if (!existing) throw new Error(`${typeName} not found: ${id}`)
      const updated = { ...existing, ...data, _lastVerb: verb }
      store.set(id, updated)
      return updated
    },
  }
}

// ---------------------------------------------------------------------------
// Mock response object for Express-style
// ---------------------------------------------------------------------------

function createMockRes() {
  let _status = 200
  let _body = ''
  const _headers: Record<string, string> = {}

  return {
    get statusCode() {
      return _status
    },
    set statusCode(v: number) {
      _status = v
    },
    writeHead(status: number, headers?: Record<string, string>) {
      _status = status
      if (headers) Object.assign(_headers, headers)
    },
    end(body?: string) {
      if (body) _body = body
    },
    setHeader(name: string, value: string) {
      _headers[name] = value
    },
    // Accessors for assertions
    getStatus: () => _status,
    getBody: () => _body,
    getParsedBody: () => JSON.parse(_body),
    getHeaders: () => _headers,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createServer — REST API middleware', () => {
  let contactEntity: ReturnType<typeof createMockEntity>
  let dealEntity: ReturnType<typeof createMockEntity>
  let middleware: ReturnType<typeof createServer>

  beforeEach(() => {
    contactEntity = createMockEntity('Contact')
    dealEntity = createMockEntity('Deal')
    middleware = createServer({
      entities: {
        Contact: contactEntity,
        Deal: dealEntity,
      },
    })
  })

  // =========================================================================
  // Route listing
  // =========================================================================

  describe('GET /api — list entity types', () => {
    it('returns available entity types', async () => {
      const req = { method: 'GET', url: '/api', path: '/api' }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(200)
      expect(res.getParsedBody()).toEqual({ types: ['Contact', 'Deal'] })
    })
  })

  // =========================================================================
  // CRUD operations
  // =========================================================================

  describe('POST /api/:type — create', () => {
    it('creates an entity and returns 201', async () => {
      const req = { method: 'POST', url: '/api/Contact', path: '/api/Contact', body: { name: 'Alice', stage: 'Lead' } }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(201)
      const body = res.getParsedBody()
      expect(body.$type).toBe('Contact')
      expect(body.name).toBe('Alice')
      expect(body.$id).toBeDefined()
    })

    it('returns 400 when no body provided', async () => {
      const req = { method: 'POST', url: '/api/Contact', path: '/api/Contact' }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(400)
      expect(res.getParsedBody().error).toContain('body required')
    })
  })

  describe('GET /api/:type — find', () => {
    it('returns all entities of a type', async () => {
      await contactEntity.create({ name: 'Alice' })
      await contactEntity.create({ name: 'Bob' })

      const req = { method: 'GET', url: '/api/Contact', path: '/api/Contact' }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(200)
      const body = res.getParsedBody()
      expect(body).toHaveLength(2)
    })

    it('filters by query parameters', async () => {
      await contactEntity.create({ name: 'Alice', stage: 'Lead' })
      await contactEntity.create({ name: 'Bob', stage: 'Customer' })

      const req = { method: 'GET', url: '/api/Contact?stage=Lead', path: '/api/Contact' }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(200)
      const body = res.getParsedBody()
      expect(body).toHaveLength(1)
      expect(body[0].name).toBe('Alice')
    })

    it('ignores query params starting with underscore', async () => {
      await contactEntity.create({ name: 'Alice' })

      const req = { method: 'GET', url: '/api/Contact?_limit=10', path: '/api/Contact' }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(200)
      const body = res.getParsedBody()
      expect(body).toHaveLength(1)
    })
  })

  describe('GET /api/:type/:id — get', () => {
    it('returns a specific entity', async () => {
      const created = (await contactEntity.create({ name: 'Alice' })) as { $id: string }

      const req = { method: 'GET', url: `/api/Contact/${created.$id}`, path: `/api/Contact/${created.$id}` }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(200)
      expect(res.getParsedBody().name).toBe('Alice')
    })

    it('returns 404 when entity not found', async () => {
      const req = { method: 'GET', url: '/api/Contact/contact_nonexistent', path: '/api/Contact/contact_nonexistent' }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(404)
      expect(res.getParsedBody().error).toContain('not found')
    })
  })

  describe('PUT /api/:type/:id — update', () => {
    it('updates an entity and returns 200', async () => {
      const created = (await contactEntity.create({ name: 'Alice', stage: 'Lead' })) as { $id: string }

      const req = {
        method: 'PUT',
        url: `/api/Contact/${created.$id}`,
        path: `/api/Contact/${created.$id}`,
        body: { stage: 'Customer' },
      }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(200)
      expect(res.getParsedBody().stage).toBe('Customer')
    })

    it('returns 400 when no body provided', async () => {
      const req = { method: 'PUT', url: '/api/Contact/contact_1', path: '/api/Contact/contact_1' }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(400)
    })
  })

  describe('DELETE /api/:type/:id — delete', () => {
    it('deletes an entity and returns 200', async () => {
      const created = (await contactEntity.create({ name: 'Alice' })) as { $id: string }

      const req = { method: 'DELETE', url: `/api/Contact/${created.$id}`, path: `/api/Contact/${created.$id}` }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(200)
      expect(res.getParsedBody().deleted).toBe(true)
    })

    it('returns 404 when entity not found', async () => {
      const req = { method: 'DELETE', url: '/api/Contact/contact_nonexistent', path: '/api/Contact/contact_nonexistent' }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(404)
    })
  })

  // =========================================================================
  // Custom verbs
  // =========================================================================

  describe('POST /api/:type/:id/:verb — custom verb', () => {
    it('performs a custom verb on an entity', async () => {
      const created = (await contactEntity.create({ name: 'Alice', stage: 'Lead' })) as { $id: string }

      const req = {
        method: 'POST',
        url: `/api/Contact/${created.$id}/qualify`,
        path: `/api/Contact/${created.$id}/qualify`,
        body: { qualifiedBy: 'agent' },
      }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(200)
      expect(res.getParsedBody()._lastVerb).toBe('qualify')
    })
  })

  // =========================================================================
  // Unknown entity type
  // =========================================================================

  describe('unknown entity type', () => {
    it('returns 404 for unknown entity type', async () => {
      const req = { method: 'GET', url: '/api/Unknown', path: '/api/Unknown' }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(404)
      expect(res.getParsedBody().error).toContain('Unknown entity type')
    })
  })

  // =========================================================================
  // Passthrough for non-API paths
  // =========================================================================

  describe('passthrough', () => {
    it('calls next() for paths not under base path', async () => {
      const next = vi.fn()
      const req = { method: 'GET', url: '/health', path: '/health' }
      const res = createMockRes()
      await middleware(req, res, next)

      expect(next).toHaveBeenCalledOnce()
    })
  })

  // =========================================================================
  // Custom base path
  // =========================================================================

  describe('custom basePath', () => {
    it('uses custom base path', async () => {
      const mw = createServer({
        entities: { Contact: contactEntity },
        basePath: '/v2',
      })

      await contactEntity.create({ name: 'Alice' })

      const req = { method: 'GET', url: '/v2/Contact', path: '/v2/Contact' }
      const res = createMockRes()
      await mw(req, res)

      expect(res.getStatus()).toBe(200)
      expect(res.getParsedBody()).toHaveLength(1)
    })
  })

  // =========================================================================
  // CORS
  // =========================================================================

  describe('CORS', () => {
    it('sets CORS headers when cors option is true', async () => {
      const mw = createServer({
        entities: { Contact: contactEntity },
        cors: true,
      })

      const req = { method: 'GET', url: '/api', path: '/api' }
      const res = createMockRes()
      await mw(req, res)

      expect(res.getStatus()).toBe(200)
      const body = res.getParsedBody()
      expect(body.types).toBeDefined()
    })

    it('sets custom CORS origin', async () => {
      const mw = createServer({
        entities: { Contact: contactEntity },
        cors: 'https://app.headless.ly',
      })

      const req = { method: 'GET', url: '/api', path: '/api' }
      const res = createMockRes()
      await mw(req, res)

      expect(res.getStatus()).toBe(200)
    })
  })

  // =========================================================================
  // Authentication
  // =========================================================================

  describe('authentication', () => {
    it('rejects requests without authorization when apiKey is set', async () => {
      const mw = createServer({
        entities: { Contact: contactEntity },
        apiKey: 'secret_key',
      })

      const req = { method: 'GET', url: '/api/Contact', path: '/api/Contact', headers: {} }
      const res = createMockRes()
      await mw(req, res)

      expect(res.getStatus()).toBe(401)
    })

    it('accepts requests with correct Bearer token', async () => {
      const mw = createServer({
        entities: { Contact: contactEntity },
        apiKey: 'secret_key',
      })

      await contactEntity.create({ name: 'Alice' })

      const req = {
        method: 'GET',
        url: '/api/Contact',
        path: '/api/Contact',
        headers: { authorization: 'Bearer secret_key' },
      }
      const res = createMockRes()
      await mw(req, res)

      expect(res.getStatus()).toBe(200)
    })

    it('rejects requests with wrong Bearer token', async () => {
      const mw = createServer({
        entities: { Contact: contactEntity },
        apiKey: 'secret_key',
      })

      const req = {
        method: 'GET',
        url: '/api/Contact',
        path: '/api/Contact',
        headers: { authorization: 'Bearer wrong_key' },
      }
      const res = createMockRes()
      await mw(req, res)

      expect(res.getStatus()).toBe(401)
    })
  })

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('returns 500 when entity operation throws', async () => {
      const brokenEntity: ServerEntity = {
        async find() {
          throw new Error('DB connection lost')
        },
        async get() {
          return null
        },
        async create() {
          throw new Error('DB error')
        },
        async update() {
          throw new Error('DB error')
        },
        async delete() {
          return false
        },
      }

      const mw = createServer({ entities: { Broken: brokenEntity } })
      const req = { method: 'GET', url: '/api/Broken', path: '/api/Broken' }
      const res = createMockRes()
      await mw(req, res)

      expect(res.getStatus()).toBe(500)
      expect(res.getParsedBody().error).toBe('DB connection lost')
    })
  })

  // =========================================================================
  // Method not allowed
  // =========================================================================

  describe('method not allowed', () => {
    it('returns 405 for PATCH on collection', async () => {
      const req = { method: 'PATCH', url: '/api/Contact', path: '/api/Contact' }
      const res = createMockRes()
      await middleware(req, res)

      expect(res.getStatus()).toBe(405)
    })
  })
})
