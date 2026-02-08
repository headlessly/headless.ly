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
import { printTable, printJSON, printError } from '../output.js'
import { getProvider } from '../provider.js'

export async function searchCommand(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args)

  const type = positional[0]
  const query = flags['query'] as string | undefined
  const filterExpr = flags['filter'] as string | undefined
  const limitStr = flags['limit'] as string | undefined
  const sortExpr = flags['sort'] as string | undefined
  const json = flags['json'] === true

  const limit = limitStr ? parseInt(limitStr, 10) : 20

  // Build filter from --filter flag
  let filter: Record<string, unknown> = {}
  if (filterExpr) {
    filter = parseFilter(filterExpr)
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

      // Apply limit
      const limited = results.slice(0, limit)

      if (json) {
        printJSON(limited)
      } else {
        printTable(limited as Record<string, unknown>[])
      }

      if (results.length > limit) {
        console.log(`\n(Showing ${limit} of ${results.length} results)`)
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

      if (json) {
        printJSON(limited)
      } else {
        printTable(limited)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    printError(`Search failed: ${message}`)
    process.exit(1)
  }
}
