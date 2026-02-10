/**
 * headlessly api [--port 8787]
 * headlessly api keys list
 * headlessly api keys create
 * headlessly api keys revoke <id>
 *
 * Start a local API server or manage API keys for headless.ly
 */

import { parseArgs } from '../args.js'
import { loadConfig } from '../config.js'
import { printSuccess, printError } from '../output.js'
import { getProvider } from '../provider.js'

export async function apiCommand(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args)

  if (flags['help'] === true) {
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
    return
  }

  const sub = positional[0]
  const action = positional[1]

  // API key management subcommand
  if (sub === 'keys') {
    const config = await loadConfig()
    if (action === 'list') {
      if (config.apiKey) {
        console.log(`Active key: ${config.apiKey.slice(0, 8)}...`)
      } else {
        console.log('No API keys configured. Run: headlessly login --api-key hly_...')
      }
      return
    }
    if (action === 'create') {
      console.log('API key creation requires a remote connection.')
      console.log('Run: headlessly login --tenant <org> --api-key <key>')
      return
    }
    if (action === 'revoke') {
      console.log('API key revocation requires a remote connection.')
      return
    }
    console.log('Usage: headlessly api keys [list|create|revoke]')
    return
  }

  // Start local development API server: require "serve" subcommand or --port flag
  if (sub !== 'serve' && !flags['port']) {
    console.log('Usage: headlessly api keys [list|create|revoke]')
    console.log('       headlessly api serve [--port N]')
    console.log('       headlessly api --port N')
    return
  }

  const port = parseInt((flags['port'] as string) || '8787', 10)

  if (isNaN(port) || port < 1 || port > 65535) {
    printError(`Invalid port: ${flags['port']}`)
    console.log('Port must be a number between 1 and 65535.')
    process.exit(1)
    return
  }

  try {
    const provider = await getProvider()
    const { getAllNouns } = await import('digital-objects')
    const nouns = getAllNouns()

    const server = await startLocalServer(port, provider, nouns)
    printSuccess(`Local API server started on http://localhost:${port}`)
    console.log('')
    console.log('Endpoints:')
    console.log(`  GET  http://localhost:${port}/api/:type          — List entities`)
    console.log(`  GET  http://localhost:${port}/api/:type/:id      — Get entity`)
    console.log(`  POST http://localhost:${port}/api/:type          — Create entity`)
    console.log(`  PUT  http://localhost:${port}/api/:type/:id      — Update entity`)
    console.log(`  DELETE http://localhost:${port}/api/:type/:id    — Delete entity`)
    console.log(`  GET  http://localhost:${port}/api/schema         — List schemas`)
    console.log(`  GET  http://localhost:${port}/api/schema/:type   — Get schema`)
    console.log('')
    console.log(`Registered entities: ${nouns.size}`)
    console.log('')
    console.log('Press Ctrl+C to stop.')

    // Keep the process alive until interrupted
    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => {
        server.close()
        console.log('\nServer stopped.')
        resolve()
      })
      process.on('SIGTERM', () => {
        server.close()
        resolve()
      })
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    printError(`Failed to start API server: ${message}`)
    process.exit(1)
  }
}

interface MinimalServer {
  close(): void
}

async function startLocalServer(port: number, provider: Awaited<ReturnType<typeof getProvider>>, nouns: Map<string, unknown>): Promise<MinimalServer> {
  const http = await import('http')
  const { getNounSchema } = await import('digital-objects')

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`)
    const parts = url.pathname.split('/').filter(Boolean)

    // CORS headers for local dev
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    try {
      // GET /api/schema — list all schemas
      if (parts[0] === 'api' && parts[1] === 'schema' && !parts[2]) {
        const summary = [...nouns.values()].map((n: unknown) => {
          const noun = n as { name: string; fields: Map<string, unknown>; relationships: Map<string, unknown>; verbs: Map<string, unknown> }
          return {
            name: noun.name,
            fields: noun.fields.size,
            relationships: noun.relationships.size,
            verbs: noun.verbs.size,
          }
        })
        res.writeHead(200)
        res.end(JSON.stringify(summary, null, 2))
        return
      }

      // GET /api/schema/:type — get specific schema
      if (parts[0] === 'api' && parts[1] === 'schema' && parts[2]) {
        const schema = getNounSchema(parts[2])
        if (!schema) {
          res.writeHead(404)
          res.end(JSON.stringify({ error: `Schema not found: ${parts[2]}` }))
          return
        }
        res.writeHead(200)
        res.end(
          JSON.stringify(
            {
              name: schema.name,
              fields: [...schema.fields.entries()].map(([k, v]) => ({ name: k, kind: v.kind, type: v.type })),
              relationships: [...schema.relationships.entries()].map(([k, v]) => ({ name: k, targetType: v.targetType, operator: v.operator })),
              verbs: [...schema.verbs.entries()].map(([k, v]) => ({ name: k, action: v.action })),
            },
            null,
            2,
          ),
        )
        return
      }

      // /api/:type routes
      if (parts[0] === 'api' && parts[1]) {
        const type = parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
        const id = parts[2]

        if (req.method === 'GET' && !id) {
          // List entities
          const results = await provider.find(type)
          res.writeHead(200)
          res.end(JSON.stringify(results, null, 2))
          return
        }

        if (req.method === 'GET' && id) {
          // Get entity
          const entity = await provider.get(type, id)
          if (!entity) {
            res.writeHead(404)
            res.end(JSON.stringify({ error: `${type} not found: ${id}` }))
            return
          }
          res.writeHead(200)
          res.end(JSON.stringify(entity, null, 2))
          return
        }

        if (req.method === 'POST' && !id) {
          // Create entity
          const body = await readBody(req)
          const entity = await provider.create(type, body)
          res.writeHead(201)
          res.end(JSON.stringify(entity, null, 2))
          return
        }

        if (req.method === 'PUT' && id) {
          // Update entity
          const body = await readBody(req)
          const entity = await provider.update(type, id, body)
          res.writeHead(200)
          res.end(JSON.stringify(entity, null, 2))
          return
        }

        if (req.method === 'DELETE' && id) {
          // Delete entity
          const result = await provider.delete(type, id)
          if (result) {
            res.writeHead(200)
            res.end(JSON.stringify({ deleted: true, type, id }))
          } else {
            res.writeHead(404)
            res.end(JSON.stringify({ error: `${type} not found: ${id}` }))
          }
          return
        }
      }

      // Root info
      if (parts.length === 0 || (parts[0] === 'api' && !parts[1])) {
        res.writeHead(200)
        res.end(
          JSON.stringify(
            {
              name: 'headless.ly local API',
              version: '0.0.1',
              entities: nouns.size,
              endpoints: {
                schema: '/api/schema',
                entities: '/api/:type',
              },
            },
            null,
            2,
          ),
        )
        return
      }

      res.writeHead(404)
      res.end(JSON.stringify({ error: 'Not found' }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      res.writeHead(500)
      res.end(JSON.stringify({ error: message }))
    }
  })

  return new Promise<MinimalServer>((resolve, reject) => {
    server.on('error', reject)
    server.listen(port, () => {
      resolve({ close: () => server.close() })
    })
  })
}

function readBody(req: import('http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString()
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}
