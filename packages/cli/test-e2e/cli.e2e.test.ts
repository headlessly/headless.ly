/**
 * E2E Tests for @headlessly/cli — CLI tool
 *
 * Validates exports, argument parsing, and config loading.
 * No interactive CLI execution — tests the programmatic API surface.
 */

import { describe, it, expect } from 'vitest'
import { run, parseArgs, loadConfig } from '../src/index.js'
import type { ParsedArgs, CLIConfig } from '../src/index.js'

// =============================================================================
// 1. Exports exist
// =============================================================================

describe('@headlessly/cli exports', () => {
  it('exports run as a function', () => {
    expect(run).toBeDefined()
    expect(typeof run).toBe('function')
  })

  it('exports parseArgs as a function', () => {
    expect(parseArgs).toBeDefined()
    expect(typeof parseArgs).toBe('function')
  })

  it('exports loadConfig as a function', () => {
    expect(loadConfig).toBeDefined()
    expect(typeof loadConfig).toBe('function')
  })
})

// =============================================================================
// 2. parseArgs basic functionality
// =============================================================================

describe('parseArgs()', () => {
  it('parses empty args', () => {
    const result = parseArgs([])
    expect(result).toBeDefined()
    expect(result.positional).toEqual([])
    expect(result.flags).toEqual({})
  })

  it('parses a single positional command', () => {
    const result = parseArgs(['search'])
    expect(result.positional).toEqual(['search'])
    expect(result.flags).toEqual({})
  })

  it('parses positional + flag with value', () => {
    const result = parseArgs(['search', '--type', 'Contact'])
    expect(result.positional).toEqual(['search'])
    expect(result.flags.type).toBe('Contact')
  })

  it('parses search --type Contact correctly', () => {
    const result = parseArgs(['search', '--type', 'Contact'])
    expect(result.positional[0]).toBe('search')
    expect(result.flags.type).toBe('Contact')
  })

  it('parses help as a positional', () => {
    const result = parseArgs(['help'])
    expect(result.positional).toEqual(['help'])
    expect(result.flags).toEqual({})
  })

  it('parses --key=value syntax', () => {
    const result = parseArgs(['fetch', '--id=contact_fX9bL5nRd'])
    expect(result.positional).toEqual(['fetch'])
    expect(result.flags.id).toBe('contact_fX9bL5nRd')
  })

  it('parses boolean flags', () => {
    const result = parseArgs(['search', '--verbose'])
    expect(result.positional).toEqual(['search'])
    expect(result.flags.verbose).toBe(true)
  })

  it('parses multiple flags', () => {
    const result = parseArgs(['search', '--type', 'Contact', '--limit', '10', '--verbose'])
    expect(result.positional).toEqual(['search'])
    expect(result.flags.type).toBe('Contact')
    expect(result.flags.limit).toBe('10')
    expect(result.flags.verbose).toBe(true)
  })

  it('handles -- stop-parsing sentinel', () => {
    const result = parseArgs(['do', '--', '--not-a-flag'])
    expect(result.positional).toEqual(['do', '--not-a-flag'])
  })

  it('handles mixed positional args', () => {
    const result = parseArgs(['api', 'contacts', '--format', 'json'])
    expect(result.positional).toEqual(['api', 'contacts'])
    expect(result.flags.format).toBe('json')
  })

  it('handles short flags', () => {
    const result = parseArgs(['-v'])
    expect(result.flags.v).toBe(true)
  })

  it('handles filter-like values with operators', () => {
    const result = parseArgs(['search', '--filter', 'stage=Lead'])
    expect(result.positional).toEqual(['search'])
    expect(result.flags.filter).toBe('stage=Lead')
  })
})

// =============================================================================
// 3. loadConfig
// =============================================================================

describe('loadConfig()', () => {
  it('returns an object', async () => {
    const config = await loadConfig()
    expect(config).toBeDefined()
    expect(typeof config).toBe('object')
  })

  it('returns a CLIConfig-compatible object', async () => {
    const config = await loadConfig()
    // The returned object should be a plain object (not null, not an array)
    expect(typeof config).toBe('object')
    expect(config).not.toBeNull()
    expect(Array.isArray(config)).toBe(false)
    // Optional fields are either undefined or the correct type
    if (config.tenant !== undefined) expect(typeof config.tenant).toBe('string')
    if (config.apiKey !== undefined) expect(typeof config.apiKey).toBe('string')
    if (config.endpoint !== undefined) expect(typeof config.endpoint).toBe('string')
  })

  it('respects HEADLESSLY_API_KEY env var', async () => {
    const prev = process.env.HEADLESSLY_API_KEY
    try {
      process.env.HEADLESSLY_API_KEY = 'hl_env_test_key'
      const config = await loadConfig()
      expect(config.apiKey).toBe('hl_env_test_key')
    } finally {
      if (prev !== undefined) {
        process.env.HEADLESSLY_API_KEY = prev
      } else {
        delete process.env.HEADLESSLY_API_KEY
      }
    }
  })

  it('respects HEADLESSLY_ENDPOINT env var', async () => {
    const prev = process.env.HEADLESSLY_ENDPOINT
    try {
      process.env.HEADLESSLY_ENDPOINT = 'https://custom.headless.ly'
      const config = await loadConfig()
      expect(config.endpoint).toBe('https://custom.headless.ly')
    } finally {
      if (prev !== undefined) {
        process.env.HEADLESSLY_ENDPOINT = prev
      } else {
        delete process.env.HEADLESSLY_ENDPOINT
      }
    }
  })

  it('respects HEADLESSLY_TENANT env var', async () => {
    const prev = process.env.HEADLESSLY_TENANT
    try {
      process.env.HEADLESSLY_TENANT = 'test-tenant'
      const config = await loadConfig()
      expect(config.tenant).toBe('test-tenant')
    } finally {
      if (prev !== undefined) {
        process.env.HEADLESSLY_TENANT = prev
      } else {
        delete process.env.HEADLESSLY_TENANT
      }
    }
  })
})

// =============================================================================
// 4. run() with help — does not throw
// =============================================================================

describe('run()', () => {
  it('run with help does not throw', async () => {
    // Capture console.log output to prevent noise
    const logs: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => logs.push(args.map(String).join(' '))
    try {
      await expect(run(['help'])).resolves.toBeUndefined()
    } finally {
      console.log = origLog
    }
  })

  it('run with --help does not throw', async () => {
    const origLog = console.log
    console.log = () => {}
    try {
      await expect(run(['--help'])).resolves.toBeUndefined()
    } finally {
      console.log = origLog
    }
  })
})
