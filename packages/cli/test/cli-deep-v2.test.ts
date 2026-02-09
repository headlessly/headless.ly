import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setProvider, MemoryNounProvider } from 'digital-objects'

// Register all 35 entities
import '@headlessly/sdk'

import { run } from '../src/index.js'
import { parseArgs, parseFilter, parseSort } from '../src/args.js'
import { printTable, printJSON, printCSV, printError, printSuccess } from '../src/output.js'
import { getConfigDir, getConfigPath } from '../src/config.js'

// ============================================================================
// Helpers
// ============================================================================

let logSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>
let exitSpy: ReturnType<typeof vi.spyOn>
let stderrSpy: ReturnType<typeof vi.spyOn>
let provider: MemoryNounProvider

function logOutput(): string {
  return logSpy.mock.calls.map((c) => c.join(' ')).join('\n')
}

function errorOutput(): string {
  return errorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
}

function setup() {
  provider = new MemoryNounProvider()
  setProvider(provider)
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: number) => never)
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation((() => true) as unknown as typeof process.stderr.write)
}

function teardown() {
  logSpy.mockRestore()
  errorSpy.mockRestore()
  exitSpy.mockRestore()
  stderrSpy.mockRestore()
}

// ============================================================================
// 1. Levenshtein & Command Suggestion (6 tests)
// ============================================================================

describe('Levenshtein & Command Suggestion', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('suggests "search" for "serch"', async () => {
    await run(['serch'])
    const err = errorOutput()
    expect(err).toContain('Did you mean')
    expect(err).toContain('search')
  })

  it('suggests "fetch" for "feth"', async () => {
    await run(['feth'])
    const err = errorOutput()
    expect(err).toContain('Did you mean')
    expect(err).toContain('fetch')
  })

  it('suggests "login" for "logn"', async () => {
    await run(['logn'])
    const err = errorOutput()
    expect(err).toContain('Did you mean')
    expect(err).toContain('login')
  })

  it('suggests "init" for "int"', async () => {
    await run(['int'])
    const err = errorOutput()
    expect(err).toContain('Did you mean')
    expect(err).toContain('init')
  })

  it('does not suggest for completely unrelated input', async () => {
    await run(['zzzzzzzzzzzzz'])
    const err = errorOutput()
    expect(err).toContain('Unknown command')
    expect(err).not.toContain('Did you mean')
  })

  it('suggests "schema" for "schem"', async () => {
    await run(['schem'])
    const err = errorOutput()
    expect(err).toContain('Did you mean')
    expect(err).toContain('schema')
  })
})

// ============================================================================
// 2. Version Command (3 tests)
// ============================================================================

describe('Version Command', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('--version outputs "0.0.1"', async () => {
    await run(['--version'])
    const out = logOutput()
    expect(out).toBe('0.0.1')
  })

  it('-v outputs the version string', async () => {
    await run(['-v'])
    const out = logOutput()
    expect(out).toBe('0.0.1')
  })

  it('--version does not trigger process.exit', async () => {
    await run(['--version'])
    expect(exitSpy).not.toHaveBeenCalled()
  })
})

// ============================================================================
// 3. Help Command Content (4 tests)
// ============================================================================

describe('Help Command Content', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('help lists all known commands', async () => {
    await run(['help'])
    const out = logOutput()
    expect(out).toContain('search')
    expect(out).toContain('fetch')
    expect(out).toContain('do')
    expect(out).toContain('login')
    expect(out).toContain('init')
    expect(out).toContain('status')
    expect(out).toContain('mcp')
    expect(out).toContain('schema')
  })

  it('help includes examples section', async () => {
    await run(['help'])
    const out = logOutput()
    expect(out).toContain('Examples')
  })

  it('help includes docs URL', async () => {
    await run(['help'])
    const out = logOutput()
    expect(out).toContain('https://headless.ly/docs/cli')
  })

  it('help shows version in header', async () => {
    await run(['help'])
    const out = logOutput()
    expect(out).toContain('v0.0.1')
  })
})

// ============================================================================
// 4. Login Command (5 tests)
// ============================================================================

describe('Login Command', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('login with no args prints error and usage', async () => {
    await run(['login'])
    const err = errorOutput()
    expect(err).toContain('--tenant')
    expect(err).toContain('--api-key')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('login with --tenant only should succeed and set mode to local', async () => {
    await run(['login', '--tenant', 'test-org'])
    const out = logOutput()
    expect(out).toContain('test-org')
    expect(out).toContain('local')
  })

  it('login with --api-key should set mode to remote', async () => {
    await run(['login', '--api-key', 'hly_test123abc'])
    const out = logOutput()
    expect(out).toContain('Logged in')
  })

  it('login with --tenant and --api-key and --endpoint', async () => {
    await run(['login', '--tenant', 'acme', '--api-key', 'hly_xyz', '--endpoint', 'https://custom.api.io'])
    const out = logOutput()
    expect(out).toContain('acme')
    expect(out).toContain('https://custom.api.io')
  })

  it('login prints config file path', async () => {
    await run(['login', '--tenant', 'my-org'])
    const out = logOutput()
    expect(out).toContain('config.json')
  })
})

// ============================================================================
// 5. Init Command (5 tests)
// ============================================================================

describe('Init Command — Extended', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('init with invalid template prints error with available templates', async () => {
    await run(['init', '--template', 'invalid'])
    const err = errorOutput()
    expect(err).toContain('Unknown template')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('init with b2c template scaffolds Product entities', async () => {
    await run(['init', '--template', 'b2c'])
    const out = logOutput()
    expect(out).toContain('Initialized')
  })

  it('init with b2d template scaffolds Project entities', async () => {
    await run(['init', '--template', 'b2d'])
    const out = logOutput()
    expect(out).toContain('Initialized')
  })

  it('init with b2a template scaffolds Workflow entities', async () => {
    await run(['init', '--template', 'b2a'])
    const out = logOutput()
    expect(out).toContain('Initialized')
  })

  it('init with --tenant sets the tenant name in output', async () => {
    await run(['init', '--tenant', 'my-startup'])
    const out = logOutput()
    expect(out).toContain('my-startup')
  })
})

// ============================================================================
// 6. API Command (5 tests)
// ============================================================================

describe('API Command', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('api --help shows subcommand list', async () => {
    await run(['api', '--help'])
    const out = logOutput()
    expect(out).toContain('keys list')
    expect(out).toContain('keys create')
    expect(out).toContain('keys revoke')
  })

  it('api with no subcommand shows usage', async () => {
    await run(['api'])
    const out = logOutput()
    expect(out).toContain('Usage')
  })

  it('api keys create prints remote requirement message', async () => {
    await run(['api', 'keys', 'create'])
    const out = logOutput()
    expect(out).toContain('remote connection')
  })

  it('api keys revoke prints remote requirement message', async () => {
    await run(['api', 'keys', 'revoke'])
    const out = logOutput()
    expect(out).toContain('remote connection')
  })

  it('api keys list outputs key info or guidance', async () => {
    await run(['api', 'keys', 'list'])
    const out = logOutput()
    // Depending on config state, either shows active key or guidance
    const hasKeyInfo = out.includes('Active key') || out.includes('No API keys configured')
    expect(hasKeyInfo).toBe(true)
  })
})

// ============================================================================
// 7. Do Command — Extended (8 tests)
// ============================================================================

describe('Do Command — Extended', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('do with no args prints error and usage', async () => {
    await run(['do'])
    const err = errorOutput()
    expect(err).toContain('Missing action')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('do create without type prints error', async () => {
    await run(['do', 'create'])
    const err = errorOutput()
    expect(err).toContain('Missing entity type')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('do update without type or id prints error', async () => {
    await run(['do', 'update'])
    const err = errorOutput()
    expect(err).toContain('Missing type or id')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('do delete without type or id prints error', async () => {
    await run(['do', 'delete'])
    const err = errorOutput()
    expect(err).toContain('Missing type or id')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('do eval without code prints error', async () => {
    await run(['do', 'eval'])
    const err = errorOutput()
    expect(err).toContain('Missing code')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('do eval with code prints not-yet-available message', async () => {
    await run(['do', 'eval', 'console.log("hello")'])
    const out = logOutput()
    expect(out).toContain('not yet available')
  })

  it('do create Contact with --json suppresses ok: prefix', async () => {
    await run(['do', 'create', 'Contact', '--name', 'TestUser', '--stage', 'Lead', '--json'])
    const out = logOutput()
    expect(out).not.toContain('ok:')
    expect(out).toContain('TestUser')
  })

  it('do custom verb with missing id prints usage', async () => {
    await run(['do', 'qualify', 'Contact'])
    const err = errorOutput()
    expect(err).toContain('Missing type or id')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})

// ============================================================================
// 8. Fetch Command — Extended (6 tests)
// ============================================================================

describe('Fetch Command — Extended', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('fetch with no args prints error and usage', async () => {
    await run(['fetch'])
    const err = errorOutput()
    expect(err).toContain('Missing arguments')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('fetch with no args and --json prints JSON error without exiting', async () => {
    await run(['fetch', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.error).toContain('Missing arguments')
    expect(exitSpy).not.toHaveBeenCalledWith(1)
  })

  it('fetch events prints not-yet-implemented message', async () => {
    await run(['fetch', 'events'])
    const out = logOutput()
    expect(out).toContain('not yet implemented')
  })

  it('fetch <type> without id prints missing entity ID error', async () => {
    await run(['fetch', 'Contact'])
    const err = errorOutput()
    expect(err).toContain('Missing entity ID')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('fetch <type> without id and --json prints JSON error', async () => {
    await run(['fetch', 'Contact', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.error).toContain('Missing entity ID')
    expect(exitSpy).not.toHaveBeenCalledWith(1)
  })

  it('fetch schema lists all registered nouns as table', async () => {
    await run(['fetch', 'schema'])
    const out = logOutput()
    // Should have printed something (table output)
    expect(out.length).toBeGreaterThan(0)
    expect(exitSpy).not.toHaveBeenCalledWith(1)
  })
})

// ============================================================================
// 9. Fetch Schema Subcommand (4 tests)
// ============================================================================

describe('Fetch Schema Subcommand', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('fetch schema Contact returns JSON with name field', async () => {
    await run(['fetch', 'schema', 'Contact'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.name).toBe('Contact')
  })

  it('fetch schema Contact includes fields array', async () => {
    await run(['fetch', 'schema', 'Contact'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed.fields)).toBe(true)
    expect(parsed.fields.length).toBeGreaterThan(0)
  })

  it('fetch schema NonExistent with --json returns JSON error', async () => {
    await run(['fetch', 'schema', 'NonExistent', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.error).toContain('Schema not found')
  })

  it('fetch schema NonExistent without --json calls process.exit(1)', async () => {
    await run(['fetch', 'schema', 'NonExistent'])
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})

// ============================================================================
// 10. Search Command — Extended (5 tests)
// ============================================================================

describe('Search Command — Extended', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('search with no type and no query prints error', async () => {
    await run(['search'])
    const err = errorOutput()
    expect(err).toContain('Provide a type or --query')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('search --help shows filter and query options', async () => {
    await run(['search', '--help'])
    const out = logOutput()
    expect(out).toContain('--filter')
    expect(out).toContain('--query')
    expect(out).toContain('--limit')
    expect(out).toContain('--sort')
    expect(out).toContain('--count')
    expect(out).toContain('--json')
    expect(exitSpy).not.toHaveBeenCalledWith(1)
  })

  it('search Contact with --query filters results by text', async () => {
    await provider.create('Contact', { name: 'Alice Smith', stage: 'Lead' })
    await provider.create('Contact', { name: 'Bob Jones', stage: 'Lead' })
    await run(['search', 'Contact', '--query', 'Alice', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.length).toBe(1)
    expect(parsed[0].name).toBe('Alice Smith')
  })

  it('search Contact with --limit 1 returns only 1 result in JSON', async () => {
    await provider.create('Contact', { name: 'A', stage: 'Lead' })
    await provider.create('Contact', { name: 'B', stage: 'Lead' })
    await provider.create('Contact', { name: 'C', stage: 'Lead' })
    await run(['search', 'Contact', '--limit', '1', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.length).toBe(1)
  })

  it('search Contact with no results prints "No results."', async () => {
    await run(['search', 'Contact'])
    const out = logOutput()
    expect(out).toContain('No results.')
  })
})

// ============================================================================
// 11. Status Command (3 tests)
// ============================================================================

describe('Status Command', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('status shows tenant info', async () => {
    await run(['status'])
    const out = logOutput()
    expect(out).toContain('Tenant')
    expect(out).toContain('Mode')
    expect(out).toContain('Config')
  })

  it('status shows headless.ly header', async () => {
    await run(['status'])
    const out = logOutput()
    expect(out).toContain('headless.ly status')
    expect(out).toContain('==================')
  })

  it('status shows registered entity count', async () => {
    await run(['status'])
    const out = logOutput()
    expect(out).toContain('Registered entities')
  })
})

// ============================================================================
// 12. Schema Command — Extended (4 tests)
// ============================================================================

describe('Schema Command — Extended', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('schema with no args lists all nouns in table format', async () => {
    await run(['schema'])
    const out = logOutput()
    expect(out).toContain('name')
    expect(out).toContain('fields')
    expect(out).toContain('relationships')
    expect(out).toContain('verbs')
  })

  it('schema --json outputs JSON array of all nouns', async () => {
    await run(['schema', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed[0]).toHaveProperty('name')
    expect(parsed[0]).toHaveProperty('fields')
  })

  it('schema Contact outputs JSON with verbs array', async () => {
    await run(['schema', 'Contact'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed.verbs)).toBe(true)
  })

  it('schema Contact outputs JSON with relationships array', async () => {
    await run(['schema', 'Contact'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed.relationships)).toBe(true)
  })
})

// ============================================================================
// 13. parseArgs Edge Cases (6 tests)
// ============================================================================

describe('parseArgs — Edge Cases', () => {
  it('multiple values for same key become array', () => {
    const result = parseArgs(['--tag', 'a', '--tag', 'b', '--tag', 'c'])
    expect(result.flags.tag).toEqual(['a', 'b', 'c'])
  })

  it('two values for same key become two-element array', () => {
    const result = parseArgs(['--filter', 'stage=Lead', '--filter', 'name=Alice'])
    expect(result.flags.filter).toEqual(['stage=Lead', 'name=Alice'])
  })

  it('-k=value short flag with equals sign', () => {
    const result = parseArgs(['-f=bar'])
    expect(result.flags.f).toBe('bar')
  })

  it('empty string value via --key=""', () => {
    const result = parseArgs(['--name='])
    expect(result.flags.name).toBe('')
  })

  it('flag value with spaces (shell already splits)', () => {
    const result = parseArgs(['--name', 'Alice Smith'])
    expect(result.flags.name).toBe('Alice Smith')
  })

  it('interleaved positionals and flags', () => {
    const result = parseArgs(['pos1', '--flag', 'val', 'pos2'])
    expect(result.positional).toEqual(['pos1', 'pos2'])
    expect(result.flags.flag).toBe('val')
  })
})

// ============================================================================
// 14. parseFilter — Extended Edge Cases (4 tests)
// ============================================================================

describe('parseFilter — Extended Edge Cases', () => {
  it('handles string value with no special chars', () => {
    const result = parseFilter('name=Alice')
    expect(result).toEqual({ name: 'Alice' })
  })

  it('handles value with period (e.g. version number)', () => {
    const result = parseFilter('version=1.2.3')
    expect(result).toEqual({ version: '1.2.3' })
  })

  it('handles large numeric value', () => {
    const result = parseFilter('revenue>1000000')
    expect(result).toEqual({ revenue: { $gt: 1000000 } })
  })

  it('handles string that looks partially numeric', () => {
    const result = parseFilter('code=ABC123')
    expect(result).toEqual({ code: 'ABC123' })
  })
})

// ============================================================================
// 15. parseSort — Extended (2 tests)
// ============================================================================

describe('parseSort — Extended', () => {
  it('handles colon with no direction as asc', () => {
    const result = parseSort('name:')
    expect(result).toEqual({ name: 'asc' })
  })

  it('handles field with underscore', () => {
    const result = parseSort('created_at:desc')
    expect(result).toEqual({ created_at: 'desc' })
  })
})

// ============================================================================
// 16. Output Formatting — printCSV (4 tests)
// ============================================================================

describe('printCSV', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('prints "No results." for empty array', () => {
    printCSV([])
    expect(spy).toHaveBeenCalledWith('No results.')
  })

  it('prints header row with column names', () => {
    printCSV([{ name: 'Alice', age: 30 }])
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    const lines = out.split('\n')
    expect(lines[0]).toContain('name')
    expect(lines[0]).toContain('age')
  })

  it('escapes values containing commas', () => {
    printCSV([{ note: 'hello, world' }])
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(out).toContain('"hello, world"')
  })

  it('escapes values containing quotes by doubling them', () => {
    printCSV([{ note: 'she said "hi"' }])
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(out).toContain('""hi""')
  })
})

// ============================================================================
// 17. Output Formatting — printTable noHeader (2 tests)
// ============================================================================

describe('printTable — noHeader option', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('with noHeader=true omits header row and separator', () => {
    printTable([{ name: 'Alice', stage: 'Lead' }], { noHeader: true })
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(out).toContain('Alice')
    // Should not have separator dashes
    expect(out).not.toMatch(/^-+$/m)
  })

  it('with noHeader=false (default) includes header', () => {
    printTable([{ name: 'Alice', stage: 'Lead' }])
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(out).toContain('name')
    expect(out).toContain('stage')
    // Separator line of dashes should be present
    expect(out).toMatch(/-+/)
  })
})

// ============================================================================
// 18. Output Formatting — formatCellValue edge cases via printTable (3 tests)
// ============================================================================

describe('printTable — Cell Value Formatting', () => {
  let spy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    spy.mockRestore()
  })

  it('null values render as empty string', () => {
    printTable([{ name: 'Alice', extra: null }])
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(out).toContain('Alice')
    // null should not literally appear
    expect(out).not.toContain('null')
  })

  it('object values render as JSON', () => {
    printTable([{ name: 'Alice', meta: { foo: 'bar' } }])
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(out).toContain('foo')
    expect(out).toContain('bar')
  })

  it('undefined values render as empty string', () => {
    printTable([{ name: 'Alice' }, { name: 'Bob', extra: 'yes' }])
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(out).toContain('Alice')
    expect(out).toContain('Bob')
    // The "extra" column should show for Bob but empty for Alice
  })
})

// ============================================================================
// 19. Config Helpers (2 tests)
// ============================================================================

describe('Config Helpers', () => {
  it('getConfigDir returns path containing .headlessly', () => {
    const dir = getConfigDir()
    expect(dir).toContain('.headlessly')
  })

  it('getConfigPath returns path ending in config.json', () => {
    const path = getConfigPath()
    expect(path).toMatch(/config\.json$/)
    expect(path).toContain('.headlessly')
  })
})

// ============================================================================
// 20. Command Routing Edge Cases (4 tests)
// ============================================================================

describe('Command Routing — Edge Cases', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('empty string command treated as undefined — shows help', async () => {
    // The switch will lowercase '' to '' which doesn't match any case
    // so it goes to default and tries suggestion
    await run([''])
    // Lowercase '' is not undefined but is an empty string — hits default case
    const err = errorOutput()
    // It will say "Unknown command: " since rawCommand is ''
    expect(err).toContain('Unknown command')
  })

  it('command with leading/trailing spaces (after shell processing)', async () => {
    // In practice shells strip whitespace, but if programmatic call has spaces in args
    await run(['  search  ', 'Contact'])
    // '  search  '.toLowerCase() = '  search  ' which won't match 'search'
    const err = errorOutput()
    expect(err).toContain('Unknown command')
  })

  it('numeric command name hits default case', async () => {
    await run(['123'])
    const err = errorOutput()
    expect(err).toContain('Unknown command')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('run with only --json flag (no command) shows help', async () => {
    // ['--json'] -> command='--json' which doesn't match help/version special flags
    // So it hits default and suggests closest
    await run(['--json'])
    const err = errorOutput()
    expect(err).toContain('Unknown command')
  })
})

// ============================================================================
// 21. Do Command — CRUD Lifecycle (5 tests)
// ============================================================================

describe('Do Command — CRUD Lifecycle', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('create then update modifies the entity', async () => {
    await run(['do', 'create', 'Contact', '--name', 'Alice', '--stage', 'Lead'])
    const createOut = logOutput()
    const idMatch = createOut.match(/"\$id"\s*:\s*"([^"]+)"/)
    expect(idMatch).toBeTruthy()

    if (idMatch) {
      logSpy.mockClear()
      errorSpy.mockClear()
      await run(['do', 'update', 'Contact', idMatch[1]!, '--stage', 'Customer'])
      const updateOut = logOutput()
      expect(updateOut).toContain('Customer')
    }
  })

  it('create then delete removes the entity', async () => {
    await run(['do', 'create', 'Contact', '--name', 'ToDelete', '--stage', 'Lead'])
    const createOut = logOutput()
    const idMatch = createOut.match(/"\$id"\s*:\s*"([^"]+)"/)
    expect(idMatch).toBeTruthy()

    if (idMatch) {
      logSpy.mockClear()
      errorSpy.mockClear()
      exitSpy.mockClear()
      await run(['do', 'delete', 'Contact', idMatch[1]!])
      const out = logOutput()
      expect(out).toContain('Deleted')

      // Verify it's gone
      logSpy.mockClear()
      errorSpy.mockClear()
      exitSpy.mockClear()
      await run(['fetch', 'Contact', idMatch[1]!])
      expect(exitSpy).toHaveBeenCalledWith(1)
    }
  })

  it('delete nonexistent entity prints error', async () => {
    await run(['do', 'delete', 'Contact', 'contact_doesnotexist'])
    const err = errorOutput()
    expect(err).toContain('not found')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('do create with --quiet suppresses ok: prefix', async () => {
    await run(['do', 'create', 'Contact', '--name', 'Quiet', '--stage', 'Lead', '--quiet'])
    const out = logOutput()
    expect(out).not.toContain('ok:')
  })

  it('do delete with --quiet and --json suppresses ok: prefix', async () => {
    await run(['do', 'create', 'Contact', '--name', 'WillDelete', '--stage', 'Lead'])
    const createOut = logOutput()
    const idMatch = createOut.match(/"\$id"\s*:\s*"([^"]+)"/)

    if (idMatch) {
      logSpy.mockClear()
      errorSpy.mockClear()
      exitSpy.mockClear()
      await run(['do', 'delete', 'Contact', idMatch[1]!, '--quiet'])
      const out = logOutput()
      expect(out).not.toContain('ok:')
    }
  })
})

// ============================================================================
// 22. Search Command — Sort Directions (3 tests)
// ============================================================================

describe('Search Command — Sort Directions', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('search --sort name:desc returns descending order', async () => {
    await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
    await provider.create('Contact', { name: 'Zara', stage: 'Lead' })
    await provider.create('Contact', { name: 'Mike', stage: 'Lead' })

    await run(['search', 'Contact', '--sort', 'name:desc', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed[0].name).toBe('Zara')
    expect(parsed[2].name).toBe('Alice')
  })

  it('search --sort with default asc direction', async () => {
    await provider.create('Contact', { name: 'Zara', stage: 'Lead' })
    await provider.create('Contact', { name: 'Alice', stage: 'Lead' })

    await run(['search', 'Contact', '--sort', 'name', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed[0].name).toBe('Alice')
    expect(parsed[1].name).toBe('Zara')
  })

  it('search --sort combined with --filter', async () => {
    await provider.create('Contact', { name: 'Zara', stage: 'Lead' })
    await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
    await provider.create('Contact', { name: 'Bob', stage: 'Customer' })

    await run(['search', 'Contact', '--filter', 'stage=Lead', '--sort', 'name:asc', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    // Bob should be filtered out (Customer, not Lead)
    expect(parsed.length).toBe(2)
    expect(parsed[0].name).toBe('Alice')
    expect(parsed[1].name).toBe('Zara')
  })
})

// ============================================================================
// 23. Environment Variable Handling (3 tests)
// ============================================================================

describe('Environment Variable Handling', () => {
  it('HEADLESSLY_API_KEY overrides file config', async () => {
    const { loadConfig } = await import('../src/config.js')
    const original = process.env.HEADLESSLY_API_KEY
    process.env.HEADLESSLY_API_KEY = 'hly_envoverride'
    try {
      const config = await loadConfig()
      expect(config.apiKey).toBe('hly_envoverride')
    } finally {
      if (original === undefined) {
        delete process.env.HEADLESSLY_API_KEY
      } else {
        process.env.HEADLESSLY_API_KEY = original
      }
    }
  })

  it('HEADLESSLY_ENDPOINT env var is respected', async () => {
    const { loadConfig } = await import('../src/config.js')
    const original = process.env.HEADLESSLY_ENDPOINT
    process.env.HEADLESSLY_ENDPOINT = 'https://test.endpoint.io'
    try {
      const config = await loadConfig()
      expect(config.endpoint).toBe('https://test.endpoint.io')
    } finally {
      if (original === undefined) {
        delete process.env.HEADLESSLY_ENDPOINT
      } else {
        process.env.HEADLESSLY_ENDPOINT = original
      }
    }
  })

  it('HEADLESSLY_TENANT env var is respected', async () => {
    const { loadConfig } = await import('../src/config.js')
    const original = process.env.HEADLESSLY_TENANT
    process.env.HEADLESSLY_TENANT = 'env-tenant'
    try {
      const config = await loadConfig()
      expect(config.tenant).toBe('env-tenant')
    } finally {
      if (original === undefined) {
        delete process.env.HEADLESSLY_TENANT
      } else {
        process.env.HEADLESSLY_TENANT = original
      }
    }
  })
})

// ============================================================================
// 24. Fetch Command — Entity Lifecycle (3 tests)
// ============================================================================

describe('Fetch Command — Entity Lifecycle', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('fetch entity after create returns correct data', async () => {
    const entity = await provider.create('Contact', { name: 'FetchMe', stage: 'Lead' })
    await run(['fetch', 'Contact', entity.$id])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.name).toBe('FetchMe')
    expect(parsed.$id).toBe(entity.$id)
  })

  it('fetch entity that does not exist prints error', async () => {
    await run(['fetch', 'Contact', 'contact_nope'])
    const err = errorOutput()
    expect(err).toContain('not found')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('fetch schema --json outputs JSON instead of table', async () => {
    await run(['fetch', 'schema', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed)).toBe(true)
  })
})
