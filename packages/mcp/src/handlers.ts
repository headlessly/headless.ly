import type { SearchArgs, FetchArgs, DoArgs, MCPToolResult, MCPContext } from './types.js'
import type { NounProvider } from 'digital-objects'
import { getNounSchema, getAllNouns } from 'digital-objects'

export interface MCPHandlerOptions {
  provider: NounProvider
  context?: MCPContext
  /** Optional code evaluator for 'do' with code */
  evaluate?: (code: string, context: Record<string, unknown>) => Promise<unknown>
}

export function createHandlers(options: MCPHandlerOptions) {
  const { provider, evaluate } = options

  return {
    async search(args: SearchArgs): Promise<MCPToolResult> {
      const { type, filter, query, limit = 20, sort } = args
      const clampedLimit = Math.min(Math.max(limit, 1), 100)

      if (type) {
        // Search specific entity type
        let results = await provider.find(type, filter ?? {})

        // Apply text search if query provided
        if (query) {
          const q = query.toLowerCase()
          results = results.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(q)))
        }

        // Apply sort
        if (sort) {
          const entries = Object.entries(sort)
          if (entries.length > 0) {
            const [key, dir] = entries[0]
            results.sort((a, b) => {
              const av = (a as Record<string, unknown>)[key]
              const bv = (b as Record<string, unknown>)[key]
              const cmp = av! < bv! ? -1 : av! > bv! ? 1 : 0
              return dir === 'desc' ? -cmp : cmp
            })
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results.slice(0, clampedLimit), null, 2),
            },
          ],
        }
      }

      // Search across all types
      const allNouns = getAllNouns()
      const allResults: unknown[] = []
      for (const [name] of allNouns) {
        const results = await provider.find(name, filter ?? {})

        if (query) {
          const q = query.toLowerCase()
          const filtered = results.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(q)))
          allResults.push(...filtered)
        } else {
          allResults.push(...results)
        }

        if (allResults.length >= clampedLimit) break
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(allResults.slice(0, clampedLimit), null, 2),
          },
        ],
      }
    },

    async fetch(args: FetchArgs): Promise<MCPToolResult> {
      switch (args.resource) {
        case 'entity': {
          if (!args.type || !args.id) {
            return { content: [{ type: 'text', text: 'Error: type and id required for entity fetch' }], isError: true }
          }
          const entity = await provider.get(args.type, args.id)
          if (!entity) {
            return { content: [{ type: 'text', text: `Entity not found: ${args.type}/${args.id}` }], isError: true }
          }
          return { content: [{ type: 'text', text: JSON.stringify(entity, null, 2) }] }
        }

        case 'schema': {
          if (args.noun) {
            const schema = getNounSchema(args.noun)
            if (!schema) return { content: [{ type: 'text', text: `Schema not found: ${args.noun}` }], isError: true }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      name: schema.name,
                      singular: schema.singular,
                      plural: schema.plural,
                      fields: [...schema.fields.entries()].map(([k, v]) => ({ key: k, ...v })),
                      relationships: [...schema.relationships.entries()].map(([k, v]) => ({ key: k, ...v })),
                      verbs: [...schema.verbs.entries()].map(([k, v]) => ({ key: k, ...v })),
                      disabledVerbs: [...schema.disabledVerbs],
                    },
                    null,
                    2,
                  ),
                },
              ],
            }
          }
          const all = getAllNouns()
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  [...all.values()].map((n) => ({
                    name: n.name,
                    fields: n.fields.size,
                    relationships: n.relationships.size,
                    verbs: n.verbs.size,
                  })),
                  null,
                  2,
                ),
              },
            ],
          }
        }

        case 'events':
        case 'metrics':
        case 'state':
          return { content: [{ type: 'text', text: `${args.resource} fetch not yet implemented` }] }

        default:
          return { content: [{ type: 'text', text: `Unknown resource: ${(args as FetchArgs).resource}` }], isError: true }
      }
    },

    async doAction(args: DoArgs): Promise<MCPToolResult> {
      const { action, type, id, data, code } = args

      // Code evaluation
      if (action === 'eval' && code) {
        if (!evaluate) {
          return { content: [{ type: 'text', text: 'Code evaluation not available' }], isError: true }
        }
        try {
          const result = await evaluate(code, { provider })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true }
        }
      }

      // CRUD actions
      if (!type) {
        return { content: [{ type: 'text', text: 'Error: type required for entity actions' }], isError: true }
      }

      switch (action) {
        case 'create': {
          const entity = await provider.create(type, data ?? {})
          return { content: [{ type: 'text', text: JSON.stringify(entity, null, 2) }] }
        }
        case 'update': {
          if (!id) return { content: [{ type: 'text', text: 'Error: id required for update' }], isError: true }
          const entity = await provider.update(type, id, data ?? {})
          return { content: [{ type: 'text', text: JSON.stringify(entity, null, 2) }] }
        }
        case 'delete': {
          if (!id) return { content: [{ type: 'text', text: 'Error: id required for delete' }], isError: true }
          const result = await provider.delete(type, id)
          return { content: [{ type: 'text', text: JSON.stringify({ deleted: result }) }] }
        }
        default: {
          // Custom verb execution
          if (!id) return { content: [{ type: 'text', text: `Error: id required for verb ${action}` }], isError: true }
          const result = await provider.perform(type, action, id, data)
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        }
      }
    },
  }
}
