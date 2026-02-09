import type { SearchArgs, FetchArgs, DoArgs, MCPToolResult, MCPContext } from './types.js'
import type { NounProvider, NounInstance } from 'digital-objects'
import { getNounSchema, getAllNouns } from 'digital-objects'

export interface MCPHandlerOptions {
  provider: NounProvider
  context?: MCPContext
  /** Optional code evaluator for 'do' with code */
  evaluate?: (code: string, context: Record<string, unknown>) => Promise<unknown>
}

/**
 * Find reverse relationships for a given entity type.
 * Scans all registered nouns for forward relationships (->) that target this type.
 * Returns an array of { fieldName, sourceType, sourceField } tuples.
 */
function findReverseRelationships(typeName: string): Array<{ fieldName: string; sourceType: string; sourceField: string }> {
  const allNouns = getAllNouns()
  const reverseRels: Array<{ fieldName: string; sourceType: string; sourceField: string }> = []

  for (const [nounName, schema] of allNouns) {
    if (nounName === typeName) continue
    for (const [fieldKey, rel] of schema.relationships) {
      if (rel.operator === '->' && rel.targetType === typeName && rel.backref) {
        reverseRels.push({
          fieldName: rel.backref,
          sourceType: nounName,
          sourceField: fieldKey,
        })
      }
    }
  }

  return reverseRels
}

/**
 * Load reverse-related entities for a given entity instance.
 */
async function loadRelationships(
  provider: NounProvider,
  entity: NounInstance,
): Promise<Record<string, unknown[]>> {
  const reverseRels = findReverseRelationships(entity.$type)
  const related: Record<string, unknown[]> = {}

  for (const rel of reverseRels) {
    const results = await provider.find(rel.sourceType, { [rel.sourceField]: entity.$id })
    if (results.length > 0) {
      related[rel.fieldName] = results
    }
  }

  return related
}

/**
 * Get indexed field names from a noun schema.
 * Fields marked with '#' in their definition are indexed.
 */
function getIndexedFields(typeName: string): Set<string> {
  const schema = getNounSchema(typeName)
  if (!schema) return new Set()
  const indexed = new Set<string>()
  for (const [fieldName, field] of schema.fields) {
    if (field.modifiers?.indexed || field.modifiers?.unique) {
      indexed.add(fieldName)
    }
  }
  return indexed
}

/** Event log entry */
interface EventEntry {
  type: string
  id: string
  action: string
  data: Record<string, unknown>
  snapshot: Record<string, unknown>
  timestamp: string
  seq: number
}


export function createHandlers(options: MCPHandlerOptions) {
  const { provider: rawProvider, context, evaluate } = options

  // Event log for time-travel support — shared between tracked provider and handlers
  const eventLog: EventEntry[] = []

  // Sequence counter for strict event ordering within same millisecond
  let eventSeq = 0

  // Intercept the raw provider's mutation methods to record events
  // This captures events even when the provider is called directly (not through handlers)
  const origCreate = rawProvider.create.bind(rawProvider)
  const origUpdate = rawProvider.update.bind(rawProvider)
  const origDelete = rawProvider.delete.bind(rawProvider)
  const origPerform = rawProvider.perform.bind(rawProvider)

  rawProvider.create = async (type: string, data: Record<string, unknown>): Promise<NounInstance> => {
    const result = await origCreate(type, data)
    eventLog.push({
      type,
      id: result.$id,
      action: 'create',
      data: { ...data },
      snapshot: { ...result },
      timestamp: new Date().toISOString(),
      seq: eventSeq++,
    })
    return result
  }

  rawProvider.update = async (type: string, id: string, data: Record<string, unknown>): Promise<NounInstance> => {
    const result = await origUpdate(type, id, data)
    eventLog.push({
      type,
      id,
      action: 'update',
      data: { ...data },
      snapshot: { ...result },
      timestamp: new Date().toISOString(),
      seq: eventSeq++,
    })
    return result
  }

  rawProvider.delete = async (type: string, id: string): Promise<boolean> => {
    const result = await origDelete(type, id)
    eventLog.push({
      type,
      id,
      action: 'delete',
      data: {},
      snapshot: { deleted: result } as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
      seq: eventSeq++,
    })
    return result
  }

  rawProvider.perform = async (type: string, verb: string, id: string, data?: Record<string, unknown>): Promise<NounInstance> => {
    const result = await origPerform(type, verb, id, data)
    eventLog.push({
      type,
      id,
      action: verb,
      data: data ? { ...data } : {},
      snapshot: { ...result },
      timestamp: new Date().toISOString(),
      seq: eventSeq++,
    })
    return result
  }

  // Use the raw provider directly (now instrumented)
  const provider = rawProvider

  return {
    async search(args: SearchArgs): Promise<MCPToolResult> {
      const { type, filter, query, limit = 20, sort } = args
      const countOnly = (args as Record<string, unknown>).countOnly as boolean | undefined
      const offset = (args as Record<string, unknown>).offset as number | undefined
      const cursor = (args as Record<string, unknown>).cursor as string | undefined
      const clampedLimit = Math.min(Math.max(limit, 1), 100)

      // Determine effective offset from cursor
      let effectiveOffset = offset ?? 0
      if (cursor) {
        try {
          const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'))
          effectiveOffset = decoded.offset ?? 0
        } catch {
          // Invalid cursor, start from beginning
        }
      }

      if (type) {
        // Search specific entity type
        let results = await rawProvider.find(type, filter ?? {})

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

        // Scope to tenant context if provided
        if (context?.tenant) {
          results = results.map((r) => {
            if (!r.$context || !r.$context.includes(context.tenant!)) {
              return { ...r, $context: `https://headless.ly/~${context.tenant}` }
            }
            return r
          })
        }

        const totalCount = results.length

        // Count-only mode
        if (countOnly) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ count: totalCount }),
              },
            ],
          }
        }

        // Apply offset and limit
        const paged = results.slice(effectiveOffset, effectiveOffset + clampedLimit)

        // Load relationships for each entity
        const enriched = await Promise.all(
          paged.map(async (entity) => {
            const rels = await loadRelationships(rawProvider, entity)
            return Object.keys(rels).length > 0 ? { ...entity, ...rels } : entity
          }),
        )

        // Use paginated format when limit is explicitly > 0 and there are more results than the limit
        const explicitLimit = args.limit
        if (explicitLimit !== undefined && explicitLimit > 0 && totalCount > clampedLimit) {
          const nextOffset = effectiveOffset + clampedLimit
          const nextCursor = nextOffset < totalCount ? Buffer.from(JSON.stringify({ offset: nextOffset })).toString('base64') : undefined
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ total: totalCount, items: enriched, nextCursor }, null, 2),
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(enriched, null, 2),
            },
          ],
        }
      }

      // Search across all types
      const allNouns = getAllNouns()
      const allResults: unknown[] = []
      for (const [name] of allNouns) {
        const results = await rawProvider.find(name, filter ?? {})

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

          // Time-travel: if asOf is specified, replay from event log
          if (args.asOf) {
            const asOfTime = new Date(args.asOf).getTime()
            const entityEvents = eventLog
              .filter((e) => e.type === args.type && e.id === args.id)
              .sort((a, b) => a.seq - b.seq)

            if (entityEvents.length === 0) {
              return { content: [{ type: 'text', text: `Entity not found at ${args.asOf}: ${args.type}/${args.id}` }], isError: true }
            }

            // Find events strictly before asOf
            const beforeEvents = entityEvents.filter((e) => new Date(e.timestamp).getTime() < asOfTime)
            if (beforeEvents.length > 0) {
              // Return the last event that happened before asOf
              const lastBefore = beforeEvents[beforeEvents.length - 1]
              return { content: [{ type: 'text', text: JSON.stringify(lastBefore.snapshot, null, 2) }] }
            }

            // No events strictly before — check for events at exactly asOf time
            const atEvents = entityEvents.filter((e) => new Date(e.timestamp).getTime() === asOfTime)
            if (atEvents.length > 0) {
              // Return the first (earliest seq) event at asOf — it was recorded before the timestamp was captured
              return { content: [{ type: 'text', text: JSON.stringify(atEvents[0].snapshot, null, 2) }] }
            }

            return { content: [{ type: 'text', text: `Entity not found at ${args.asOf}: ${args.type}/${args.id}` }], isError: true }
          }

          const entity = await rawProvider.get(args.type, args.id)
          if (!entity) {
            return { content: [{ type: 'text', text: `Entity not found: ${args.type}/${args.id}` }], isError: true }
          }

          // Auto-load relationships
          const rels = await loadRelationships(rawProvider, entity)
          const enriched = Object.keys(rels).length > 0 ? { ...entity, ...rels } : entity

          return { content: [{ type: 'text', text: JSON.stringify(enriched, null, 2) }] }
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

        case 'events': {
          // If type and id are provided, return event history for that entity
          if (args.type && args.id) {
            const entityEvents = eventLog
              .filter((e) => e.type === args.type && e.id === args.id)
              .map((e) => ({
                action: e.action,
                data: e.data,
                timestamp: e.timestamp,
              }))
            return { content: [{ type: 'text', text: JSON.stringify(entityEvents, null, 2) }] }
          }
          return { content: [{ type: 'text', text: 'events fetch not yet implemented' }] }
        }

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
          const result = await evaluate(code, { provider: rawProvider })
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err)
          const stack = err instanceof Error ? err.stack : undefined
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: { message, stack } }, null, 2) }],
            isError: true,
          }
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
        case 'batch': {
          const operations = (data as Record<string, unknown>)?.operations as Array<{
            action: string
            id?: string
            data?: Record<string, unknown>
          }>
          if (!operations || !Array.isArray(operations)) {
            return { content: [{ type: 'text', text: 'Error: batch requires data.operations array' }], isError: true }
          }
          const results: Array<Record<string, unknown>> = []
          for (const op of operations) {
            try {
              switch (op.action) {
                case 'create': {
                  const entity = await provider.create(type, op.data ?? {})
                  results.push({ ...entity, success: true })
                  break
                }
                case 'update': {
                  if (!op.id) throw new Error('id required for update')
                  const entity = await provider.update(type, op.id, op.data ?? {})
                  results.push({ ...entity, success: true })
                  break
                }
                case 'delete': {
                  if (!op.id) throw new Error('id required for delete')
                  const deleted = await provider.delete(type, op.id)
                  results.push({ deleted, success: true })
                  break
                }
                default:
                  results.push({ success: false, error: `Unknown batch action: ${op.action}` })
              }
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err)
              results.push({ success: false, error: message })
            }
          }
          return { content: [{ type: 'text', text: JSON.stringify({ results }, null, 2) }] }
        }
        case 'upsert': {
          const matchData = data ?? {}
          const existingResults = await rawProvider.find(type, {})
          let found: NounInstance | undefined

          // Get indexed fields from schema for matching
          const indexedFields = getIndexedFields(type)

          // Strategy: match on indexed fields that appear in the data
          const matchFields = Object.keys(matchData).filter((k) => !k.startsWith('$') && indexedFields.has(k))

          if (matchFields.length > 0) {
            // Match on indexed fields only
            for (const entity of existingResults) {
              let match = true
              for (const field of matchFields) {
                if (entity[field] !== matchData[field]) {
                  match = false
                  break
                }
              }
              if (match) {
                found = entity
                break
              }
            }
          } else {
            // Fallback: match on all non-$ fields in data that the entity already has with the same value
            for (const entity of existingResults) {
              let match = true
              let matchCount = 0
              for (const [key, value] of Object.entries(matchData)) {
                if (key.startsWith('$')) continue
                if (entity[key] !== undefined && entity[key] === value) {
                  matchCount++
                }
                if (entity[key] !== undefined && entity[key] !== value) {
                  match = false
                  break
                }
              }
              if (match && matchCount > 0) {
                found = entity
                break
              }
            }
          }

          if (found) {
            const updated = await provider.update(type, found.$id, matchData)
            return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] }
          } else {
            const created = await provider.create(type, matchData)
            return { content: [{ type: 'text', text: JSON.stringify(created, null, 2) }] }
          }
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
