/**
 * Minimal argument parser — no external dependencies
 *
 * Supports:
 *   --key value        → flags['key'] = 'value'
 *   --key=value        → flags['key'] = 'value'
 *   --flag             → flags['flag'] = true
 *   positional         → positional[]
 *   --key "a>b"        → flags['key'] = 'a>b'
 *   -- (stop parsing)  → everything after goes to positional
 */

export interface ParsedArgs {
  positional: string[]
  flags: Record<string, string | boolean>
}

export function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  let i = 0
  let stopParsing = false

  while (i < args.length) {
    const arg = args[i]!

    // After --, everything is positional
    if (arg === '--' && !stopParsing) {
      stopParsing = true
      i++
      continue
    }

    if (stopParsing || !arg.startsWith('-')) {
      positional.push(arg)
      i++
      continue
    }

    // --key=value
    if (arg.includes('=')) {
      const eqIndex = arg.indexOf('=')
      const key = arg.slice(arg.startsWith('--') ? 2 : 1, eqIndex)
      const value = arg.slice(eqIndex + 1)
      flags[key] = value
      i++
      continue
    }

    // --key or -k
    const key = arg.startsWith('--') ? arg.slice(2) : arg.slice(1)

    // Peek at next arg to see if it's a value
    const next = args[i + 1]
    if (next !== undefined && !next.startsWith('-')) {
      flags[key] = next
      i += 2
    } else {
      flags[key] = true
      i++
    }
  }

  return { positional, flags }
}

/**
 * Parse filter expressions like "stage=Lead" or "value>10000"
 * Returns MongoDB-style filter objects
 */
export function parseFilter(expr: string): Record<string, unknown> {
  // Handle operator patterns: key>value, key<value, key>=value, key<=value, key!=value
  const operatorMatch = expr.match(/^(\w+)(>=|<=|!=|>|<|=)(.+)$/)
  if (!operatorMatch) return {}

  const [, key, op, value] = operatorMatch
  if (!key || !op || value === undefined) return {}

  const parsedValue = parseFilterValue(value)

  switch (op) {
    case '=':
      return { [key]: parsedValue }
    case '>':
      return { [key]: { $gt: parsedValue } }
    case '<':
      return { [key]: { $lt: parsedValue } }
    case '>=':
      return { [key]: { $gte: parsedValue } }
    case '<=':
      return { [key]: { $lte: parsedValue } }
    case '!=':
      return { [key]: { $ne: parsedValue } }
    default:
      return { [key]: parsedValue }
  }
}

function parseFilterValue(value: string): unknown {
  // Try numeric
  const num = Number(value)
  if (!Number.isNaN(num) && value.trim() !== '') return num

  // Try boolean
  if (value === 'true') return true
  if (value === 'false') return false

  // String
  return value
}

/**
 * Parse sort string like "field:asc" or "field:desc"
 */
export function parseSort(sort: string): Record<string, 'asc' | 'desc'> {
  const [field, dir] = sort.split(':')
  if (!field) return {}
  return { [field]: dir === 'desc' ? 'desc' : 'asc' }
}
