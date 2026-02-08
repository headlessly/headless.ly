/**
 * headlessly schema [noun]
 *
 * Print schema for a noun or list all registered nouns
 *
 * Examples:
 *   headlessly schema             # List all nouns
 *   headlessly schema Contact     # Show Contact schema details
 */

import { parseArgs } from '../args.js'
import { printJSON, printError, printTable } from '../output.js'

export async function schemaCommand(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args)
  const json = flags['json'] === true
  const nounName = positional[0]

  const { getNounSchema, getAllNouns } = await import('digital-objects')

  if (nounName) {
    const schema = getNounSchema(nounName)
    if (!schema) {
      printError(`Schema not found: ${nounName}`)
      console.log('')
      const all = getAllNouns()
      if (all.size > 0) {
        console.log('Available nouns:')
        console.log(`  ${[...all.keys()].join(', ')}`)
      }
      process.exit(1)
    }

    const formatted = {
      name: schema.name,
      singular: schema.singular,
      plural: schema.plural,
      slug: schema.slug,
      fields: [...schema.fields.entries()].map(([k, v]) => ({
        name: k,
        kind: v.kind,
        type: v.type,
        required: v.modifiers?.required ?? false,
        indexed: v.modifiers?.indexed ?? false,
        unique: v.modifiers?.unique ?? false,
      })),
      relationships: [...schema.relationships.entries()].map(([k, v]) => ({
        name: k,
        operator: v.operator,
        targetType: v.targetType,
        backref: v.backref,
        isArray: v.isArray,
      })),
      verbs: [...schema.verbs.entries()].map(([k, v]) => ({
        name: k,
        action: v.action,
        activity: v.activity,
        event: v.event,
      })),
      disabledVerbs: [...schema.disabledVerbs],
    }

    printJSON(formatted)
  } else {
    const all = getAllNouns()

    if (all.size === 0) {
      console.log('No nouns registered. Import @headlessly/sdk to register all 32 entities.')
      return
    }

    const summary = [...all.values()].map((n) => ({
      name: n.name,
      plural: n.plural,
      fields: n.fields.size,
      relationships: n.relationships.size,
      verbs: n.verbs.size,
    }))

    if (json) {
      printJSON(summary)
    } else {
      printTable(summary as Record<string, unknown>[])
    }
  }
}
