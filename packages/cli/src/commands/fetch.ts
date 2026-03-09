/**
 * headlessly fetch <type> <id> [--include field1,field2]
 * headlessly fetch schema [noun]
 * headlessly fetch events [--type Type] [--since timestamp]
 *
 * Examples:
 *   headlessly fetch Contact contact_abc123
 *   headlessly fetch Contact contact_abc123 --include deals,activities
 *   headlessly fetch schema Contact
 *   headlessly fetch schema
 *   headlessly fetch events --type Contact --since 2024-01-01
 */

import { parseArgs } from '../args.js'
import { ExitCode } from '../exit-codes.js'
import { printJSON, printError, printTable, pickFields } from '../output.js'
import { getProvider } from '../provider.js'
import { validateInput, ValidationError } from '../validate.js'

export async function fetchCommand(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args)
  const json = flags['json'] === true

  // Per-command --help
  if (flags['help'] === true) {
    console.log('headlessly fetch — Fetch a specific entity')
    console.log('')
    console.log('Usage: headlessly fetch <type> <id> [options]')
    console.log('       headlessly fetch schema [noun]')
    console.log('       headlessly fetch events [--type Type]')
    console.log('')
    console.log('Options:')
    console.log('  --include field1,field2   Include related entities (comma-separated)')
    console.log('  --history                 Show entity event history')
    console.log('  --json                    Output as JSON')
    console.log('  --fields f1,f2,...        Only include specified fields in output')
    return
  }

  if (positional.length === 0) {
    if (json) {
      printJSON({ error: 'Missing arguments', usage: 'headlessly fetch <type> <id>' })
      return
    }
    printError('Missing arguments')
    console.log('Usage: headlessly fetch <type> <id>')
    console.log('       headlessly fetch schema [noun]')
    console.log('       headlessly fetch events [--type Type]')
    process.exit(1)
    return
  }

  const first = positional[0]!

  // Schema fetch
  if (first === 'schema') {
    const nounName = positional[1]
    const { getNounSchema, getAllNouns } = await import('digital-objects')

    if (nounName) {
      const schema = getNounSchema(nounName)
      if (!schema) {
        if (json) {
          printJSON({ error: `Schema not found: ${nounName}` })
          return
        }
        printError(`Schema not found: ${nounName}`)
        process.exit(1)
        return
      }

      const formatted = {
        name: schema.name,
        singular: schema.singular,
        plural: schema.plural,
        fields: [...schema.fields.entries()].map(([k, v]) => ({ key: k, kind: v.kind, type: v.type })),
        relationships: [...schema.relationships.entries()].map(([k, v]) => ({ key: k, targetType: v.targetType, operator: v.operator })),
        verbs: [...schema.verbs.entries()].map(([k, v]) => ({ key: k, action: v.action, activity: v.activity, event: v.event })),
        disabledVerbs: [...schema.disabledVerbs],
      }

      printJSON(formatted)
    } else {
      const all = getAllNouns()
      const summary = [...all.values()].map((n) => ({
        name: n.name,
        fields: n.fields.size,
        relationships: n.relationships.size,
        verbs: n.verbs.size,
      }))

      if (json) {
        printJSON(summary)
      } else {
        printTable(summary)
      }
    }
    return
  }

  // Events fetch
  if (first === 'events') {
    console.log('Event fetching is not yet implemented.')
    console.log('Events will be available when connected to a remote headless.ly instance.')
    return
  }

  // Validate ID if present
  const idToValidate = positional[1]
  if (idToValidate) {
    try {
      validateInput(idToValidate, 'id')
    } catch (err) {
      if (err instanceof ValidationError) {
        if (json) {
          printJSON({ error: { code: 'VALIDATION', message: err.message } })
          return
        }
        printError(err.message)
        process.exit(ExitCode.USAGE)
        return
      }
      throw err
    }
  }

  // History fetch: headlessly fetch <type> <id> --history
  if (flags['history'] === true) {
    const type = first
    const id = positional[1]
    if (!type || !id) {
      printError('Usage: headlessly fetch <type> <id> --history')
      process.exit(1)
      return
    }

    try {
      const provider = await getProvider()
      if ('getHistory' in provider && typeof (provider as any).getHistory === 'function') {
        const events = await (provider as any).getHistory(type, id)
        if (json) {
          printJSON(events)
        } else {
          printTable(events as Record<string, unknown>[])
        }
      } else {
        // Fallback: show current version info as single snapshot
        const entity = await provider.get(type, id)
        if (!entity) {
          printError(`${type} not found: ${id}`)
          process.exit(1)
          return
        }
        const snapshot = [{
          operation: 'snapshot',
          timestamp: (entity as any).$updatedAt || (entity as any).$createdAt || new Date().toISOString(),
          version: (entity as any).$version || 1,
        }]
        if (json) {
          printJSON(snapshot)
        } else {
          printTable(snapshot as Record<string, unknown>[])
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      printError(`History fetch failed: ${message}`)
      process.exit(1)
    }
    return
  }

  // Entity fetch: headlessly fetch <type> <id> [--include field1,field2]
  const type = first
  const id = positional[1]
  const includeRaw = (flags['include'] ?? flags['populate']) as string | undefined
  const fieldsRaw = flags['fields'] as string | undefined
  const fields = fieldsRaw ? fieldsRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined

  if (!id) {
    if (json) {
      printJSON({ error: 'Missing entity ID', usage: 'headlessly fetch <type> <id>' })
      return
    }
    printError('Missing entity ID')
    console.log('Usage: headlessly fetch <type> <id>')
    process.exit(1)
    return
  }

  // Parse --include as comma-separated list
  const include = includeRaw
    ? includeRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined

  try {
    const provider = await getProvider()
    const entity = await provider.get(type, id)

    if (!entity) {
      if (json) {
        printJSON({ error: `${type} not found: ${id}` })
        return
      }
      printError(`${type} not found: ${id}`)
      process.exit(1)
      return
    }

    // If --include is specified, resolve related entities
    if (include && include.length > 0) {
      const result = { ...entity } as Record<string, unknown>

      for (const field of include) {
        try {
          // Attempt to find related entities by looking up the field as a type
          // Convention: include field name is plural lowercase of the target type
          // e.g. "deals" -> find Deal entities where contact matches this entity's $id
          const singularGuess = field.endsWith('s') ? field.slice(0, -1) : field
          const typeName = singularGuess.charAt(0).toUpperCase() + singularGuess.slice(1)

          // Try to find entities of that type that reference this entity
          const related = await provider.find(typeName)
          if (related.length > 0) {
            // Filter to those referencing this entity by any field matching our $id
            const matching = related.filter((r) => Object.values(r).some((v) => v === entity.$id))
            result[field] = matching
          } else {
            result[field] = []
          }
        } catch {
          result[field] = []
        }
      }

      const masked = fields ? pickFields([result], fields)[0] : result
      printJSON(masked)
    } else {
      const masked = fields ? pickFields([entity as Record<string, unknown>], fields)[0] : entity
      printJSON(masked)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (json) {
      printJSON({ error: `Fetch failed: ${message}` })
      return
    }
    printError(`Fetch failed: ${message}`)
    process.exit(1)
  }
}
