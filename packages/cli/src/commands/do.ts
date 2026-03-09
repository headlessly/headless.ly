/**
 * headlessly do create <type> [--field key=value...]
 * headlessly do <verb> <type> <id> [--data key=value...]
 * headlessly do eval <code>
 *
 * Examples:
 *   headlessly do create Contact --name Alice --stage Lead --email alice@acme.co
 *   headlessly do create Contact --data '{"name":"Alice","stage":"Lead"}'
 *   headlessly do qualify Contact contact_abc123
 *   headlessly do close Deal deal_xyz --reason "Won"
 *   headlessly do eval "$.Contact.find({ stage: 'Lead' })"
 */

import { parseArgs } from '../args.js'
import { ExitCode } from '../exit-codes.js'
import { printJSON, printError, printSuccess } from '../output.js'
import { getProvider, isRemoteMode } from '../provider.js'
import { validateInput, validateData, ValidationError } from '../validate.js'
import { restCreate, restUpdate, restDelete } from '../api-client.js'

const RESERVED_FLAGS = new Set(['json', 'quiet', 'data', 'dry-run', 'help'])

export function buildData(flags: Record<string, string | boolean | string[]>): Record<string, unknown> {
  const data: Record<string, unknown> = {}

  // Parse --data JSON first
  const rawData = flags['data']
  if (typeof rawData === 'string') {
    try {
      const parsed = JSON.parse(rawData)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        Object.assign(data, parsed)
      } else {
        throw new Error('--data must be a JSON object')
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(`Invalid JSON in --data: ${err.message}`)
      }
      throw err
    }
  }

  // Merge individual flags (override --data values), coercing types
  for (const [key, value] of Object.entries(flags)) {
    if (RESERVED_FLAGS.has(key)) continue
    if (typeof value === 'string') {
      const num = Number(value)
      if (!Number.isNaN(num) && value.trim() !== '') {
        data[key] = num
      } else if (value === 'true') {
        data[key] = true
      } else if (value === 'false') {
        data[key] = false
      } else if (value === 'null') {
        data[key] = null
      } else {
        data[key] = value
      }
    } else {
      data[key] = value
    }
  }

  return data
}

export async function doCommand(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args)
  const json = flags['json'] === true
  const quiet = flags['quiet'] === true
  const dryRun = flags['dry-run'] === true

  // Per-command --help
  if (flags['help'] === true) {
    console.log('headlessly do — Execute actions on entities')
    console.log('')
    console.log('Usage: headlessly do <action> [options]')
    console.log('')
    console.log('Actions:')
    console.log('  create <type> [--field value...]   Create an entity')
    console.log('  update <type> <id> [--field value...]   Update an entity')
    console.log('  delete <type> <id>                 Delete an entity')
    console.log('  <verb> <type> <id>                 Execute a custom verb')
    console.log('  eval <code>                        Evaluate TypeScript code')
    console.log('')
    console.log('Options:')
    console.log('  --data JSON   Entity data as JSON (e.g. \'{"name":"Alice"}\')')
    console.log('  --dry-run     Validate and preview without executing')
    console.log('  --json        Output as JSON')
    console.log('  --quiet       Suppress "ok:" prefix output')
    return
  }

  if (positional.length === 0) {
    printError('Missing action')
    console.log('Usage: headlessly do create <type> [--field value...]')
    console.log('       headlessly do <verb> <type> <id>')
    console.log('       headlessly do eval <code>')
    process.exit(1)
    return
  }

  const action = positional[0]!

  // Validate inputs
  for (const arg of positional) {
    try {
      validateInput(arg)
    } catch (err) {
      if (err instanceof ValidationError) {
        printError(err.message)
        process.exit(ExitCode.USAGE)
        return
      }
      throw err
    }
  }

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
        return
      }

      const data = buildData(flags)

      try {
        validateData(data)
      } catch (err) {
        if (err instanceof ValidationError) {
          printError(err.message)
          process.exit(ExitCode.USAGE)
          return
        }
        throw err
      }

      if (dryRun) {
        const preview = { 'dry-run': true, action: 'create', type, data }
        if (json) {
          printJSON(preview)
        } else {
          printSuccess(`[dry-run] Would create ${type}`)
          printJSON(data)
        }
        return
      }

      const entity = isRemoteMode() ? await restCreate(type, data) : await provider.create(type, data)
      const entityId = (entity as any).$id || (entity as any).id
      if (!json && !quiet) {
        printSuccess(`Created ${type}: ${entityId}`)
      }
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
        return
      }

      try {
        validateInput(id, 'id')
      } catch (err) {
        if (err instanceof ValidationError) {
          printError(err.message)
          process.exit(ExitCode.USAGE)
          return
        }
        throw err
      }

      const data = buildData(flags)

      try {
        validateData(data)
      } catch (err) {
        if (err instanceof ValidationError) {
          printError(err.message)
          process.exit(ExitCode.USAGE)
          return
        }
        throw err
      }

      if (dryRun) {
        const preview = { 'dry-run': true, action: 'update', type, id, data }
        if (json) {
          printJSON(preview)
        } else {
          printSuccess(`[dry-run] Would update ${type}: ${id}`)
          printJSON(data)
        }
        return
      }

      const entity = isRemoteMode() ? await restUpdate(type, id, data) : await provider.update(type, id, data)
      if (!json && !quiet) {
        printSuccess(`Updated ${type}: ${id}`)
      }
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
        return
      }

      try {
        validateInput(id, 'id')
      } catch (err) {
        if (err instanceof ValidationError) {
          printError(err.message)
          process.exit(ExitCode.USAGE)
          return
        }
        throw err
      }

      if (dryRun) {
        const preview = { 'dry-run': true, action: 'delete', type, id }
        if (json) {
          printJSON(preview)
        } else {
          printSuccess(`[dry-run] Would delete ${type}: ${id}`)
        }
        return
      }

      if (isRemoteMode()) {
        await restDelete(type, id)
        if (!json && !quiet) {
          printSuccess(`Deleted ${type}: ${id}`)
        }
      } else {
        const result = await provider.delete(type, id)
        if (result) {
          if (!json && !quiet) {
            printSuccess(`Deleted ${type}: ${id}`)
          }
        } else {
          printError(`${type} not found: ${id}`)
          process.exit(1)
        }
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
      return
    }

    try {
      validateInput(id, 'id')
    } catch (err) {
      if (err instanceof ValidationError) {
        printError(err.message)
        process.exit(ExitCode.USAGE)
        return
      }
      throw err
    }

    const data = buildData(flags)

    try {
      validateData(data)
    } catch (err) {
      if (err instanceof ValidationError) {
        printError(err.message)
        process.exit(ExitCode.USAGE)
        return
      }
      throw err
    }

    if (dryRun) {
      const preview = { 'dry-run': true, action: verb, type, id, data: Object.keys(data).length > 0 ? data : undefined }
      if (json) {
        printJSON(preview)
      } else {
        printSuccess(`[dry-run] Would ${verb} ${type}: ${id}`)
        if (Object.keys(data).length > 0) {
          printJSON(data)
        }
      }
      return
    }

    const entity = await provider.perform(type, verb, id, Object.keys(data).length > 0 ? data : undefined)
    if (!json && !quiet) {
      printSuccess(`${verb} ${type}: ${id}`)
    }
    printJSON(entity)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    printError(`Action failed: ${message}`)
    process.exit(1)
  }
}
