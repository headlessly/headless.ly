/**
 * headlessly do create <type> [--field key=value...]
 * headlessly do <verb> <type> <id> [--data key=value...]
 * headlessly do eval <code>
 *
 * Examples:
 *   headlessly do create Contact --name Alice --stage Lead --email alice@acme.co
 *   headlessly do qualify Contact contact_abc123
 *   headlessly do close Deal deal_xyz --reason "Won"
 *   headlessly do eval "$.Contact.find({ stage: 'Lead' })"
 */

import { parseArgs } from '../args.js'
import { printJSON, printError, printSuccess } from '../output.js'
import { getProvider } from '../provider.js'

export async function doCommand(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args)

  if (positional.length === 0) {
    printError('Missing action')
    console.log('Usage: headlessly do create <type> [--field value...]')
    console.log('       headlessly do <verb> <type> <id>')
    console.log('       headlessly do eval <code>')
    process.exit(1)
  }

  const action = positional[0]!

  // Code evaluation
  if (action === 'eval') {
    const code = positional.slice(1).join(' ')
    if (!code) {
      printError('Missing code to evaluate')
      console.log('Usage: headlessly do eval <code>')
      process.exit(1)
    }
    console.log('Code evaluation is not yet available in local mode.')
    console.log('Connect to a remote headless.ly instance with `headlessly login` to use eval.')
    return
  }

  try {
    const provider = await getProvider()

    // Create action
    if (action === 'create') {
      const type = positional[1]
      if (!type) {
        printError('Missing entity type')
        console.log('Usage: headlessly do create <type> [--name value --field value...]')
        process.exit(1)
      }

      // Build data from flags (all non-boolean flags become entity fields)
      const data: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(flags)) {
        if (key === 'json') continue
        data[key] = value
      }

      const entity = await provider.create(type, data)
      printSuccess(`Created ${type}: ${entity.$id}`)
      printJSON(entity)
      return
    }

    // Update action
    if (action === 'update') {
      const type = positional[1]
      const id = positional[2]
      if (!type || !id) {
        printError('Missing type or id')
        console.log('Usage: headlessly do update <type> <id> [--field value...]')
        process.exit(1)
      }

      const data: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(flags)) {
        if (key === 'json') continue
        data[key] = value
      }

      const entity = await provider.update(type, id, data)
      printSuccess(`Updated ${type}: ${id}`)
      printJSON(entity)
      return
    }

    // Delete action
    if (action === 'delete') {
      const type = positional[1]
      const id = positional[2]
      if (!type || !id) {
        printError('Missing type or id')
        console.log('Usage: headlessly do delete <type> <id>')
        process.exit(1)
      }

      const result = await provider.delete(type, id)
      if (result) {
        printSuccess(`Deleted ${type}: ${id}`)
      } else {
        printError(`${type} not found: ${id}`)
        process.exit(1)
      }
      return
    }

    // Custom verb execution: headlessly do <verb> <type> <id>
    const verb = action
    const type = positional[1]
    const id = positional[2]

    if (!type || !id) {
      printError(`Missing type or id for verb "${verb}"`)
      console.log(`Usage: headlessly do ${verb} <type> <id> [--data key=value...]`)
      process.exit(1)
    }

    const data: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(flags)) {
      if (key === 'json') continue
      data[key] = value
    }

    const entity = await provider.perform(type, verb, id, Object.keys(data).length > 0 ? data : undefined)
    printSuccess(`${verb} ${type}: ${id}`)
    printJSON(entity)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    printError(`Action failed: ${message}`)
    process.exit(1)
  }
}
