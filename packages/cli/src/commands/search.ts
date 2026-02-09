/**
 * headlessly search [type] [--filter key=value] [--query text] [--limit N] [--sort field:asc]
 *
 * Examples:
 *   headlessly search Contact
 *   headlessly search Contact --filter stage=Lead
 *   headlessly search Deal --filter "value>10000" --sort value:desc --limit 5
 *   headlessly search --query "alice"
 */

import { parseArgs, parseFilter, parseSort } from '../args.js'
import { printTable, printJSON, printError, printCSV } from '../output.js'
import { getProvider } from '../provider.js'

export async function searchCommand(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args)

  // Per-command --help
  if (flags['help'] === true) {
    console.log('headlessly search — Search entities across the graph')
    console.log('')
    console.log('Usage: headlessly search [type] [options]')
    console.log('')
    console.log('Options:')
    console.log('  --filter key=value    Filter by field (supports >, <, >=, <=, !=)')
    console.log('                        Can be specified multiple times')
    console.log('  --query text          Full-text search across fields')
    console.log('  --limit N             Max results (default: 20)')
    console.log('  --sort field:asc|desc Sort results')
    console.log('  --count               Output only the count of matching entities')
    console.log('  --output format       Output format: table, json, csv')
    console.log('  --no-header           Omit table headers (for piping)')
    console.log('  --json                Output as JSON (shortcut for --output json)')
    return
  }

  const type = positional[0]
  const query = flags['query'] as string | undefined
  const filterExpr = flags['filter'] as string | string[] | undefined
  const limitStr = flags['limit'] as string | undefined
  const sortExpr = flags['sort'] as string | undefined
  const json = flags['json'] === true
  const outputFormat = flags['output'] as string | undefined
  const countOnly = flags['count'] === true
  const noHeader = flags['no-header'] === true

  const limit = limitStr ? parseInt(limitStr, 10) : 20

  // Build filter from --filter flag(s) — supports multiple
  let filter: Record<string, unknown> = {}
  if (filterExpr) {
    if (Array.isArray(filterExpr)) {
      for (const expr of filterExpr) {
        Object.assign(filter, parseFilter(expr))
      }
    } else {
      filter = parseFilter(filterExpr)
    }
  }

  try {
    const provider = await getProvider()

    if (type) {
      // Search specific type
      let results = await provider.find(type, Object.keys(filter).length > 0 ? filter : undefined)

      // Apply text query
      if (query) {
        const q = query.toLowerCase()
        results = results.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(q)))
      }

      // Apply sort
      if (sortExpr) {
        const sort = parseSort(sortExpr)
        const entries = Object.entries(sort)
        if (entries.length > 0) {
          const [key, dir] = entries[0]!
          results.sort((a, b) => {
            const av = a[key!] as string | number
            const bv = b[key!] as string | number
            const cmp = av < bv ? -1 : av > bv ? 1 : 0
            return dir === 'desc' ? -cmp : cmp
          })
        }
      }

      // --count: output only the count
      if (countOnly) {
        console.log(results.length)
        return
      }

      // Apply limit
      const total = results.length
      const limited = results.slice(0, limit)

      if (json || outputFormat === 'json') {
        printJSON(limited)
      } else if (outputFormat === 'csv') {
        printCSV(limited as Record<string, unknown>[])
      } else {
        printTable(limited as Record<string, unknown>[], { noHeader })
      }

      if (total > limit && !json && outputFormat !== 'json') {
        console.log(`\n(Showing ${limit} of ${total} results)`)
      }
    } else {
      // Search across all types requires type — print usage
      if (!query) {
        printError('Provide a type or --query to search')
        console.log('Usage: headlessly search [type] [--filter key=value] [--query text]')
        process.exit(1)
      }

      // Global search with query (search all registered nouns)
      const { getAllNouns } = await import('digital-objects')
      const allNouns = getAllNouns()
      const allResults: Record<string, unknown>[] = []

      for (const [name] of allNouns) {
        const results = await provider.find(name)
        const q = query.toLowerCase()
        const filtered = results.filter((r) => Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(q)))
        allResults.push(...(filtered as Record<string, unknown>[]))
        if (allResults.length >= limit) break
      }

      const limited = allResults.slice(0, limit)

      if (json || outputFormat === 'json') {
        printJSON(limited)
      } else if (outputFormat === 'csv') {
        printCSV(limited)
      } else {
        printTable(limited, { noHeader })
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    printError(`Search failed: ${message}`)
    process.exit(1)
  }
}
