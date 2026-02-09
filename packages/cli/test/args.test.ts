import { describe, it, expect, vi } from 'vitest'
import { parseArgs, parseFilter, parseSort } from '../src/args.js'
import { printTable, printJSON, printError, printSuccess } from '../src/output.js'

describe('parseArgs', () => {
  it('parses --key value pair', () => {
    const result = parseArgs(['--name', 'Alice'])
    expect(result).toEqual({ flags: { name: 'Alice' }, positional: [] })
  })

  it('parses --key=value form', () => {
    const result = parseArgs(['--name=Alice'])
    expect(result).toEqual({ flags: { name: 'Alice' }, positional: [] })
  })

  it('parses boolean flag', () => {
    const result = parseArgs(['--json'])
    expect(result).toEqual({ flags: { json: true }, positional: [] })
  })

  it('parses positional arguments', () => {
    const result = parseArgs(['Contact'])
    expect(result).toEqual({ positional: ['Contact'], flags: {} })
  })

  it('stops parsing flags after --', () => {
    const result = parseArgs(['--', '--flag'])
    expect(result).toEqual({ positional: ['--flag'], flags: {} })
  })

  it('returns empty result for no args', () => {
    const result = parseArgs([])
    expect(result).toEqual({ positional: [], flags: {} })
  })

  it('handles mixed flags and positionals', () => {
    const result = parseArgs(['Contact', '--filter', 'stage=Lead', '--json'])
    expect(result).toEqual({
      positional: ['Contact'],
      flags: { filter: 'stage=Lead', json: true },
    })
  })

  it('handles multiple positional args', () => {
    const result = parseArgs(['search', 'Contact'])
    expect(result).toEqual({ positional: ['search', 'Contact'], flags: {} })
  })

  it('handles -k short flag as boolean', () => {
    const result = parseArgs(['-v'])
    expect(result).toEqual({ positional: [], flags: { v: true } })
  })

  it('handles -k value short flag with value', () => {
    const result = parseArgs(['-n', 'Alice'])
    expect(result).toEqual({ positional: [], flags: { n: 'Alice' } })
  })

  it('handles --key=value with equals in value', () => {
    const result = parseArgs(['--filter=stage=Lead'])
    expect(result).toEqual({ positional: [], flags: { filter: 'stage=Lead' } })
  })

  it('handles multiple flags', () => {
    const result = parseArgs(['--limit', '10', '--offset', '20', '--json'])
    expect(result).toEqual({ positional: [], flags: { limit: '10', offset: '20', json: true } })
  })

  it('handles quoted value with special chars via --key value', () => {
    const result = parseArgs(['--key', 'a>b'])
    expect(result).toEqual({ positional: [], flags: { key: 'a>b' } })
  })

  // Known bug: negative numbers treated as flags because of startsWith('-') check
  it('BUG: treats negative numbers as flags', () => {
    const result = parseArgs(['--timeout', '-1'])
    // Expected: { flags: { timeout: '-1' }, positional: [] }
    // Actual: -1 starts with '-', so timeout becomes boolean true and -1 becomes flag '1'
    expect(result.flags.timeout).toBe(true)
    expect(result.flags['1']).toBe(true)
  })

  it('handles -- followed by multiple positionals', () => {
    const result = parseArgs(['--json', '--', 'a', 'b', '--c'])
    expect(result).toEqual({ positional: ['a', 'b', '--c'], flags: { json: true } })
  })

  it('handles flag at end (boolean)', () => {
    const result = parseArgs(['Contact', '--verbose'])
    expect(result).toEqual({ positional: ['Contact'], flags: { verbose: true } })
  })
})

describe('parseFilter', () => {
  it('parses equality: stage=Lead', () => {
    expect(parseFilter('stage=Lead')).toEqual({ stage: 'Lead' })
  })

  it('parses greater-than with numeric value', () => {
    expect(parseFilter('value>10000')).toEqual({ value: { $gt: 10000 } })
  })

  it('parses less-than', () => {
    expect(parseFilter('count<5')).toEqual({ count: { $lt: 5 } })
  })

  it('parses gte', () => {
    expect(parseFilter('count>=5')).toEqual({ count: { $gte: 5 } })
  })

  it('parses lte', () => {
    expect(parseFilter('count<=5')).toEqual({ count: { $lte: 5 } })
  })

  it('parses not-equal', () => {
    expect(parseFilter('stage!=Churned')).toEqual({ stage: { $ne: 'Churned' } })
  })

  it('coerces boolean true', () => {
    expect(parseFilter('active=true')).toEqual({ active: true })
  })

  it('coerces boolean false', () => {
    expect(parseFilter('active=false')).toEqual({ active: false })
  })

  it('coerces numeric values', () => {
    expect(parseFilter('value=42')).toEqual({ value: 42 })
  })

  it('returns empty for empty string', () => {
    expect(parseFilter('')).toEqual({})
  })

  it('returns empty for invalid expression', () => {
    expect(parseFilter('no-operator-here')).toEqual({})
  })

  it('handles zero value', () => {
    expect(parseFilter('count=0')).toEqual({ count: 0 })
  })

  it('handles negative numbers in filter', () => {
    expect(parseFilter('balance>-100')).toEqual({ balance: { $gt: -100 } })
  })

  it('handles float values', () => {
    expect(parseFilter('rate=0.5')).toEqual({ rate: 0.5 })
  })
})

describe('parseSort', () => {
  it('parses field:asc', () => {
    expect(parseSort('name:asc')).toEqual({ name: 'asc' })
  })

  it('parses field:desc', () => {
    expect(parseSort('value:desc')).toEqual({ value: 'desc' })
  })

  it('defaults to asc when no direction', () => {
    expect(parseSort('name')).toEqual({ name: 'asc' })
  })

  it('returns empty for empty string', () => {
    expect(parseSort('')).toEqual({})
  })

  it('defaults unknown directions to asc', () => {
    expect(parseSort('name:up')).toEqual({ name: 'asc' })
  })
})

describe('printTable', () => {
  it('prints "No results." for empty array', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printTable([])
    expect(logSpy).toHaveBeenCalledWith('No results.')
    logSpy.mockRestore()
  })

  it('prints header and rows for entities', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printTable([{ name: 'Alice', stage: 'Lead' }])
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('name')
    expect(output).toContain('stage')
    expect(output).toContain('Alice')
    expect(output).toContain('Lead')
    logSpy.mockRestore()
  })

  it('truncates values longer than 40 chars', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const longValue = 'a'.repeat(50)
    printTable([{ name: longValue }])
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('...')
    expect(output).not.toContain(longValue)
    logSpy.mockRestore()
  })
})

describe('printJSON', () => {
  it('outputs valid JSON', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const data = { name: 'Alice', count: 42 }
    printJSON(data)
    const output = logSpy.mock.calls[0]![0]
    expect(JSON.parse(output)).toEqual(data)
    logSpy.mockRestore()
  })
})

describe('printError', () => {
  it('prints to stderr with "error:" prefix', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    printError('something went wrong')
    expect(errorSpy).toHaveBeenCalledWith('error: something went wrong')
    errorSpy.mockRestore()
  })
})

describe('printSuccess', () => {
  it('prints with "ok:" prefix', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printSuccess('done')
    expect(logSpy).toHaveBeenCalledWith('ok: done')
    logSpy.mockRestore()
  })
})
