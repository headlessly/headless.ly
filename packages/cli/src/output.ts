/**
 * Output formatting helpers
 *
 * Consistent terminal output for entities, tables, errors, and success messages.
 * Lightweight ANSI coloring when stdout is a TTY.
 */

// ANSI color helpers — only colorize when output is a TTY
const isTTY = typeof process !== 'undefined' && process.stdout?.isTTY === true

function ansi(code: string, text: string): string {
  return isTTY ? `\x1b[${code}m${text}\x1b[0m` : text
}

const dim = (s: string) => ansi('2', s)
const bold = (s: string) => ansi('1', s)
const green = (s: string) => ansi('32', s)
const red = (s: string) => ansi('31', s)
const cyan = (s: string) => ansi('36', s)
const yellow = (s: string) => ansi('33', s)
const magenta = (s: string) => ansi('35', s)

/** Print entities as a table */
export function printTable(entities: Record<string, unknown>[], options?: { noHeader?: boolean }): void {
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

  // Print header (unless --no-header)
  if (!options?.noHeader) {
    const header = columns.map((col) => bold(col.padEnd(widths[col]!))).join('  ')
    console.log(header)
    console.log(columns.map((col) => dim('-'.repeat(widths[col]!))).join('  '))
  }

  // Print rows
  for (const entity of entities) {
    const row = columns.map((col) => {
      const val = formatCellValue(entity[col])
      return val.length > 40 ? val.slice(0, 37) + '...' : val.padEnd(widths[col]!)
    })
    console.log(row.join('  '))
  }
}

/** Print entities as CSV */
export function printCSV(entities: Record<string, unknown>[]): void {
  if (entities.length === 0) {
    console.log('No results.')
    return
  }

  const keys = new Set<string>()
  for (const entity of entities) {
    for (const key of Object.keys(entity)) {
      keys.add(key)
    }
  }
  const columns = Array.from(keys)

  // Header row
  console.log(columns.join(','))

  // Data rows
  for (const entity of entities) {
    const row = columns.map((col) => {
      const val = formatCellValue(entity[col])
      // Escape values containing commas or quotes
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return '"' + val.replace(/"/g, '""') + '"'
      }
      return val
    })
    console.log(row.join(','))
  }
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/**
 * Syntax-highlight a JSON string for TTY output.
 * Keys are cyan, strings are green, numbers are yellow,
 * booleans are magenta, null is dim.
 */
function highlightJSON(json: string): string {
  if (!isTTY) return json
  return json.replace(
    /("(?:\\.|[^"\\])*")\s*(:)?|(\b(?:true|false)\b)|(\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (_match, str?: string, colon?: string, bool?: string, nul?: string, num?: string) => {
      if (str) {
        return colon ? cyan(str) + colon : green(str)
      }
      if (bool) return magenta(bool)
      if (nul) return dim(nul)
      if (num) return yellow(num)
      return _match
    },
  )
}

/** Print entity as formatted JSON with optional syntax highlighting */
export function printJSON(data: unknown): void {
  const json = JSON.stringify(data, null, 2)
  console.log(highlightJSON(json))
}

/** Print error message */
export function printError(message: string): void {
  console.error(`${red('error:')} ${message}`)
}

/** Print success message */
export function printSuccess(message: string): void {
  console.log(`${green('ok:')} ${message}`)
}

/** Print a warning message */
export function printWarning(message: string): void {
  console.log(`${yellow('warn:')} ${message}`)
}

/** Print a dim/muted info message */
export function printInfo(message: string): void {
  console.log(dim(message))
}
