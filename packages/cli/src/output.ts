/**
 * Output formatting helpers
 *
 * Consistent terminal output for entities, tables, errors, and success messages.
 * No color dependencies — uses simple text formatting.
 */

/** Print entities as a table */
export function printTable(entities: Record<string, unknown>[]): void {
  if (entities.length === 0) {
    console.log('No results.')
    return
  }

  // Collect all keys
  const keys = new Set<string>()
  for (const entity of entities) {
    for (const key of Object.keys(entity)) {
      keys.add(key)
    }
  }
  const columns = Array.from(keys)

  // Calculate column widths
  const widths: Record<string, number> = {}
  for (const col of columns) {
    widths[col] = col.length
    for (const entity of entities) {
      const val = formatCellValue(entity[col])
      if (val.length > widths[col]!) {
        widths[col] = val.length
      }
    }
    // Cap at 40 characters
    if (widths[col]! > 40) widths[col] = 40
  }

  // Print header
  const header = columns.map((col) => col.padEnd(widths[col]!)).join('  ')
  console.log(header)
  console.log(columns.map((col) => '-'.repeat(widths[col]!)).join('  '))

  // Print rows
  for (const entity of entities) {
    const row = columns.map((col) => {
      const val = formatCellValue(entity[col])
      return val.length > 40 ? val.slice(0, 37) + '...' : val.padEnd(widths[col]!)
    })
    console.log(row.join('  '))
  }
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Print entity as formatted JSON */
export function printJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

/** Print error message */
export function printError(message: string): void {
  console.error(`error: ${message}`)
}

/** Print success message */
export function printSuccess(message: string): void {
  console.log(`ok: ${message}`)
}
