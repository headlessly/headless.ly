/**
 * headlessly fetch <type> <id>
 * headlessly fetch schema [noun]
 * headlessly fetch events [--type Type] [--since timestamp]
 *
 * Examples:
 *   headlessly fetch Contact contact_abc123
 *   headlessly fetch schema Contact
 *   headlessly fetch schema
 *   headlessly fetch events --type Contact --since 2024-01-01
 */

import { parseArgs } from '../args.js'
import { printJSON, printError, printTable } from '../output.js'
import { getProvider } from '../provider.js'

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
    console.log('  --json    Output as JSON')
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

  // Entity fetch: headlessly fetch <type> <id>
  const type = first
  const id = positional[1]

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

    printJSON(entity)
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
