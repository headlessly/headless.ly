import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setProvider, MemoryNounProvider } from 'digital-objects'

// Register all 35 entities
import '@headlessly/sdk'

import { run } from '../src/index.js'
import { printTable, printJSON, printCSV, printError, printSuccess } from '../src/output.js'

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
// 1. Fetch with --include flag (6 tests)
// ============================================================================

describe('Fetch Command — --include flag', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('fetch --help mentions --include option', async () => {
    await run(['fetch', '--help'])
    const out = logOutput()
    expect(out).toContain('--include')
    expect(out).toContain('comma-separated')
  })

  it('fetch entity with --include returns entity with related field', async () => {
    const contact = await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
    await provider.create('Deal', { title: 'Big Deal', stage: 'Open', contact: contact.$id })

    await run(['fetch', 'Contact', contact.$id, '--include', 'deals'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.name).toBe('Alice')
    expect(Array.isArray(parsed.deals)).toBe(true)
    expect(parsed.deals.length).toBe(1)
    expect(parsed.deals[0].title).toBe('Big Deal')
  })

  it('fetch entity with --include but no related entities returns empty array', async () => {
    const contact = await provider.create('Contact', { name: 'Lonely', stage: 'Lead' })

    await run(['fetch', 'Contact', contact.$id, '--include', 'deals'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.name).toBe('Lonely')
    expect(Array.isArray(parsed.deals)).toBe(true)
    expect(parsed.deals.length).toBe(0)
  })

  it('fetch entity without --include returns plain entity', async () => {
    const contact = await provider.create('Contact', { name: 'Plain', stage: 'Lead' })

    await run(['fetch', 'Contact', contact.$id])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.name).toBe('Plain')
    expect(parsed.deals).toBeUndefined()
  })

  it('fetch with --include handles multiple comma-separated fields', async () => {
    const contact = await provider.create('Contact', { name: 'Multi', stage: 'Lead' })
    await provider.create('Deal', { title: 'Deal 1', contact: contact.$id })

    await run(['fetch', 'Contact', contact.$id, '--include', 'deals,activities'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.name).toBe('Multi')
    expect(Array.isArray(parsed.deals)).toBe(true)
    expect(Array.isArray(parsed.activities)).toBe(true)
  })

  it('fetch nonexistent entity with --include and --json returns JSON error', async () => {
    await run(['fetch', 'Contact', 'contact_nope', '--include', 'deals', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.error).toContain('not found')
    expect(exitSpy).not.toHaveBeenCalledWith(1)
  })
})

// ============================================================================
// 2. Help command — per-command help via "help <command>" (8 tests)
// ============================================================================

describe('Help Command — Per-Command Help', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('help search shows search-specific help', async () => {
    await run(['help', 'search'])
    const out = logOutput()
    expect(out).toContain('headlessly search')
    expect(out).toContain('--filter')
    expect(out).toContain('--query')
    expect(out).toContain('--limit')
    expect(out).toContain('--sort')
    expect(out).toContain('--count')
  })

  it('help fetch shows fetch-specific help', async () => {
    await run(['help', 'fetch'])
    const out = logOutput()
    expect(out).toContain('headlessly fetch')
    expect(out).toContain('--include')
    expect(out).toContain('schema')
    expect(out).toContain('events')
  })

  it('help do shows do-specific help', async () => {
    await run(['help', 'do'])
    const out = logOutput()
    expect(out).toContain('headlessly do')
    expect(out).toContain('create')
    expect(out).toContain('update')
    expect(out).toContain('delete')
    expect(out).toContain('eval')
    expect(out).toContain('--quiet')
  })

  it('help init shows init-specific help', async () => {
    await run(['help', 'init'])
    const out = logOutput()
    expect(out).toContain('headlessly init')
    expect(out).toContain('--template')
    expect(out).toContain('--tenant')
    expect(out).toContain('--dry-run')
  })

  it('help schema shows schema-specific help', async () => {
    await run(['help', 'schema'])
    const out = logOutput()
    expect(out).toContain('headlessly schema')
    expect(out).toContain('--json')
  })

  it('help api shows api-specific help', async () => {
    await run(['help', 'api'])
    const out = logOutput()
    expect(out).toContain('headlessly api')
    expect(out).toContain('--port')
    expect(out).toContain('keys')
  })

  it('help login shows login-specific help', async () => {
    await run(['help', 'login'])
    const out = logOutput()
    expect(out).toContain('headlessly login')
    expect(out).toContain('--tenant')
    expect(out).toContain('--api-key')
    expect(out).toContain('--endpoint')
  })

  it('help mcp shows mcp-specific help', async () => {
    await run(['help', 'mcp'])
    const out = logOutput()
    expect(out).toContain('headlessly mcp')
    expect(out).toContain('stdin/stdout')
  })
})

// ============================================================================
// 3. Help command — unknown subcommand fallback (2 tests)
// ============================================================================

describe('Help Command — Fallback', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('help with unknown command shows error and full help', async () => {
    await run(['help', 'nonexistent'])
    const out = logOutput()
    expect(out).toContain('Unknown command: nonexistent')
    expect(out).toContain('Usage: headlessly <command> [options]')
  })

  it('help with no args shows full help', async () => {
    await run(['help'])
    const out = logOutput()
    expect(out).toContain('Usage: headlessly <command> [options]')
    expect(out).toContain('api')
    expect(out).toContain('--include')
  })
})

// ============================================================================
// 4. API command — serve and port handling (5 tests)
// ============================================================================

describe('API Command — Serve and Port', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('api --help shows --port option', async () => {
    await run(['api', '--help'])
    const out = logOutput()
    expect(out).toContain('--port')
    expect(out).toContain('8787')
  })

  it('api --help mentions serve subcommand', async () => {
    await run(['api', '--help'])
    const out = logOutput()
    expect(out).toContain('Local API server')
  })

  it('api with no args shows usage with serve hint', async () => {
    await run(['api'])
    const out = logOutput()
    expect(out).toContain('Usage')
    expect(out).toContain('serve')
  })

  it('api keys unknown action shows usage', async () => {
    await run(['api', 'keys', 'unknown'])
    const out = logOutput()
    expect(out).toContain('Usage')
    expect(out).toContain('list')
    expect(out).toContain('create')
    expect(out).toContain('revoke')
  })

  it('api keys with no action shows usage', async () => {
    await run(['api', 'keys'])
    const out = logOutput()
    expect(out).toContain('Usage')
  })
})

// ============================================================================
// 5. Output formatting — printWarning and printInfo (4 tests)
// ============================================================================

describe('Output Formatting — New Helpers', () => {
  it('printError outputs message with error: prefix', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    printError('something broke')
    const output = spy.mock.calls[0]![0]
    expect(output).toContain('error:')
    expect(output).toContain('something broke')
    spy.mockRestore()
  })

  it('printSuccess outputs message with ok: prefix', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printSuccess('it worked')
    const output = spy.mock.calls[0]![0]
    expect(output).toContain('ok:')
    expect(output).toContain('it worked')
    spy.mockRestore()
  })

  it('printJSON outputs valid parseable JSON', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const data = { name: 'test', count: 42, nested: { a: true } }
    printJSON(data)
    const output = spy.mock.calls[0]![0]
    // Should be parseable (even if it has ANSI codes when TTY, it won't in test)
    expect(JSON.parse(output)).toEqual(data)
    spy.mockRestore()
  })

  it('printTable handles single-column entity', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printTable([{ id: '1' }, { id: '2' }, { id: '3' }])
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(out).toContain('id')
    expect(out).toContain('1')
    expect(out).toContain('2')
    expect(out).toContain('3')
    spy.mockRestore()
  })
})

// ============================================================================
// 6. Search command — global query with JSON output (3 tests)
// ============================================================================

describe('Search — Global Query JSON output', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('search --query across types returns results from different entity types', async () => {
    await provider.create('Contact', { name: 'SearchableContact', stage: 'Lead' })
    await provider.create('Deal', { title: 'SearchableDeal', stage: 'Open' })

    await run(['search', '--query', 'Searchable', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.length).toBeGreaterThanOrEqual(2)
  })

  it('search --query with limit caps global results', async () => {
    for (let i = 0; i < 5; i++) {
      await provider.create('Contact', { name: `GlobalMatch-${i}`, stage: 'Lead' })
    }

    await run(['search', '--query', 'GlobalMatch', '--limit', '2', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.length).toBe(2)
  })

  it('search --query with no matches returns empty JSON array', async () => {
    await run(['search', '--query', 'ZzzNothingMatchesThis', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(0)
  })
})

// ============================================================================
// 7. Do command — create with various field types (4 tests)
// ============================================================================

describe('Do Command — Field Type Handling', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('do create passes string flags as entity fields', async () => {
    await run(['do', 'create', 'Contact', '--name', 'Alice', '--stage', 'Lead', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.name).toBe('Alice')
    expect(parsed.stage).toBe('Lead')
  })

  it('do create with --json and --quiet outputs only JSON', async () => {
    await run(['do', 'create', 'Contact', '--name', 'Silent', '--stage', 'Lead', '--json', '--quiet'])
    const out = logOutput()
    const lines = out.split('\n')
    const hasOkLine = lines.some((l: string) => l.includes('ok:'))
    expect(hasOkLine).toBe(false)
    // Should still be parseable JSON
    expect(() => JSON.parse(out)).not.toThrow()
  })

  it('do update changes entity data', async () => {
    const entity = await provider.create('Contact', { name: 'Before', stage: 'Lead' })
    await run(['do', 'update', 'Contact', entity.$id, '--name', 'After', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.name).toBe('After')
  })

  it('do delete then fetch confirms deletion', async () => {
    const entity = await provider.create('Contact', { name: 'Ephemeral', stage: 'Lead' })
    await run(['do', 'delete', 'Contact', entity.$id])

    logSpy.mockClear()
    errorSpy.mockClear()
    exitSpy.mockClear()

    await run(['fetch', 'Contact', entity.$id])
    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})

// ============================================================================
// 8. Schema command — detailed output validation (5 tests)
// ============================================================================

describe('Schema Command — Output Validation', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('schema Contact includes slug field', async () => {
    await run(['schema', 'Contact'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed).toHaveProperty('slug')
  })

  it('schema Contact fields include modifier properties', async () => {
    await run(['schema', 'Contact'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.fields.length).toBeGreaterThan(0)
    const field = parsed.fields[0]
    expect(field).toHaveProperty('name')
    expect(field).toHaveProperty('kind')
    expect(field).toHaveProperty('required')
    expect(field).toHaveProperty('indexed')
    expect(field).toHaveProperty('unique')
  })

  it('schema Contact relationships include backref and isArray', async () => {
    await run(['schema', 'Contact'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    if (parsed.relationships.length > 0) {
      const rel = parsed.relationships[0]
      expect(rel).toHaveProperty('name')
      expect(rel).toHaveProperty('operator')
      expect(rel).toHaveProperty('targetType')
      expect(rel).toHaveProperty('backref')
      expect(rel).toHaveProperty('isArray')
    }
  })

  it('schema unknown noun prints error and lists available nouns', async () => {
    await run(['schema', 'NotARealNoun'])
    const err = errorOutput()
    expect(err).toContain('Schema not found')
    const out = logOutput()
    expect(out).toContain('Available nouns')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('schema list includes plural column', async () => {
    await run(['schema'])
    const out = logOutput()
    expect(out).toContain('plural')
  })
})

// ============================================================================
// 9. Init command — full workflow (4 tests)
// ============================================================================

describe('Init Command — Full Workflow', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('init then search for seeded entity type works', async () => {
    await run(['init', '--template', 'b2b'])

    logSpy.mockClear()
    errorSpy.mockClear()

    await run(['search', 'Deal', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.length).toBeGreaterThanOrEqual(1)
    expect(parsed[0].title).toBe('Enterprise Deal')
  })

  it('init --dry-run does not modify provider state', async () => {
    await run(['init', '--template', 'b2b', '--dry-run'])

    logSpy.mockClear()
    errorSpy.mockClear()

    // No entities should have been created
    await run(['search', 'Contact', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.length).toBe(0)
  })

  it('init output includes MCP command hint', async () => {
    await run(['init'])
    const out = logOutput()
    expect(out).toContain('headlessly mcp')
  })

  it('init output includes login command hint', async () => {
    await run(['init'])
    const out = logOutput()
    expect(out).toContain('headlessly login')
  })
})

// ============================================================================
// 10. Search with combined flags — integration tests (4 tests)
// ============================================================================

describe('Search — Combined Flags Integration', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('search with --filter, --sort, --limit, --json all combined', async () => {
    await provider.create('Contact', { name: 'Zara', stage: 'Lead' })
    await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
    await provider.create('Contact', { name: 'Mike', stage: 'Customer' })
    await provider.create('Contact', { name: 'Bob', stage: 'Lead' })

    await run(['search', 'Contact', '--filter', 'stage=Lead', '--sort', 'name:asc', '--limit', '2', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.length).toBe(2)
    expect(parsed[0].name).toBe('Alice')
    expect(parsed[1].name).toBe('Bob')
  })

  it('search --count with --filter returns correct count', async () => {
    await provider.create('Contact', { name: 'A', stage: 'Lead' })
    await provider.create('Contact', { name: 'B', stage: 'Lead' })
    await provider.create('Contact', { name: 'C', stage: 'Customer' })

    await run(['search', 'Contact', '--filter', 'stage=Lead', '--count'])
    const out = logOutput().trim()
    expect(out).toBe('2')
  })

  it('search --output csv with filter produces filtered CSV', async () => {
    await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
    await provider.create('Contact', { name: 'Bob', stage: 'Customer' })

    await run(['search', 'Contact', '--filter', 'stage=Lead', '--output', 'csv'])
    const out = logOutput()
    expect(out).toContain('Alice')
    expect(out).not.toContain('Bob')
    expect(out).toContain(',')
  })

  it('search with --query and --filter both apply', async () => {
    await provider.create('Contact', { name: 'Alice Smith', stage: 'Lead' })
    await provider.create('Contact', { name: 'Alice Jones', stage: 'Customer' })
    await provider.create('Contact', { name: 'Bob Smith', stage: 'Lead' })

    await run(['search', 'Contact', '--filter', 'stage=Lead', '--query', 'Alice', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.length).toBe(1)
    expect(parsed[0].name).toBe('Alice Smith')
  })
})

// ============================================================================
// 11. Status command — comprehensive checks (3 tests)
// ============================================================================

describe('Status Command — Comprehensive', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('status shows entity counts when entities exist', async () => {
    await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
    await provider.create('Contact', { name: 'Bob', stage: 'Lead' })

    await run(['status'])
    const out = logOutput()
    expect(out).toContain('Contact')
    expect(out).toContain('2')
  })

  it('status shows registered entities count from SDK', async () => {
    await run(['status'])
    const out = logOutput()
    expect(out).toContain('Registered entities')
    // Should have 35 entities registered
    expect(out).toContain('35')
  })

  it('status does not crash with empty provider', async () => {
    await run(['status'])
    const out = logOutput()
    expect(out).toContain('headless.ly status')
    expect(exitSpy).not.toHaveBeenCalledWith(1)
  })
})

// ============================================================================
// 12. End-to-end multi-type workflow (3 tests)
// ============================================================================

describe('End-to-End Multi-Type Workflow', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('create Contact, Deal, then search each type finds correct results', async () => {
    await run(['do', 'create', 'Contact', '--name', 'Alice', '--stage', 'Lead'])
    await run(['do', 'create', 'Deal', '--title', 'Big Opportunity', '--stage', 'Open'])

    logSpy.mockClear()
    errorSpy.mockClear()

    await run(['search', 'Contact', '--json'])
    const contactOut = logOutput()
    const contacts = JSON.parse(contactOut)
    expect(contacts.length).toBe(1)
    expect(contacts[0].name).toBe('Alice')

    logSpy.mockClear()

    await run(['search', 'Deal', '--json'])
    const dealOut = logOutput()
    const deals = JSON.parse(dealOut)
    expect(deals.length).toBe(1)
    expect(deals[0].title).toBe('Big Opportunity')
  })

  it('create, fetch, update, search cycle works end-to-end', async () => {
    // Create
    await run(['do', 'create', 'Contact', '--name', 'Lifecycle', '--stage', 'Lead', '--json'])
    const createOut = logOutput()
    const created = JSON.parse(createOut)
    expect(created.name).toBe('Lifecycle')
    const id = created.$id

    logSpy.mockClear()

    // Fetch
    await run(['fetch', 'Contact', id])
    const fetchOut = logOutput()
    const fetched = JSON.parse(fetchOut)
    expect(fetched.$id).toBe(id)

    logSpy.mockClear()

    // Update
    await run(['do', 'update', 'Contact', id, '--stage', 'Qualified', '--json'])
    const updateOut = logOutput()
    const updated = JSON.parse(updateOut)
    expect(updated.stage).toBe('Qualified')

    logSpy.mockClear()

    // Search
    await run(['search', 'Contact', '--filter', 'stage=Qualified', '--json'])
    const searchOut = logOutput()
    const results = JSON.parse(searchOut)
    expect(results.length).toBe(1)
    expect(results[0].stage).toBe('Qualified')
  })

  it('init with template then full CRUD workflow succeeds', async () => {
    await run(['init', '--template', 'b2b'])

    logSpy.mockClear()
    errorSpy.mockClear()

    // Search seeded contacts
    await run(['search', 'Contact', '--json'])
    const contactsOut = logOutput()
    const contacts = JSON.parse(contactsOut)
    expect(contacts.length).toBeGreaterThanOrEqual(1)

    logSpy.mockClear()

    // Create additional contact
    await run(['do', 'create', 'Contact', '--name', 'New Person', '--stage', 'Customer', '--json'])
    const newOut = logOutput()
    const newContact = JSON.parse(newOut)

    logSpy.mockClear()

    // Search should include both
    await run(['search', 'Contact', '--json'])
    const allOut = logOutput()
    const allContacts = JSON.parse(allOut)
    expect(allContacts.length).toBeGreaterThan(contacts.length)

    logSpy.mockClear()

    // Delete the new one
    await run(['do', 'delete', 'Contact', newContact.$id])
    const deleteOut = logOutput()
    expect(deleteOut).toContain('Deleted')
  })
})

// ============================================================================
// 13. printCSV edge cases (3 tests)
// ============================================================================

describe('printCSV — Additional Edge Cases', () => {
  it('handles entities with null and undefined values', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printCSV([
      { name: 'Alice', value: null },
      { name: 'Bob', value: undefined },
    ])
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(out).toContain('name')
    expect(out).toContain('Alice')
    expect(out).toContain('Bob')
    spy.mockRestore()
  })

  it('handles entities with numeric values', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printCSV([{ name: 'Item', price: 42.5 }])
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(out).toContain('42.5')
    spy.mockRestore()
  })

  it('handles entities with boolean values', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    printCSV([{ name: 'Feature', active: true }])
    const out = spy.mock.calls.map((c) => c[0]).join('\n')
    expect(out).toContain('true')
    spy.mockRestore()
  })
})

// ============================================================================
// 14. Help global output includes api command (2 tests)
// ============================================================================

describe('Help Global — API and Include', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('global help mentions api command', async () => {
    await run(['help'])
    const out = logOutput()
    expect(out).toContain('api')
    expect(out).toContain('--port')
  })

  it('global help mentions --include for fetch', async () => {
    await run(['help'])
    const out = logOutput()
    expect(out).toContain('--include')
  })
})

// ============================================================================
// 15. Fetch schema — additional validation (3 tests)
// ============================================================================

describe('Fetch Schema — Additional', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('fetch schema Deal returns verbs and disabledVerbs', async () => {
    await run(['fetch', 'schema', 'Deal'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed.name).toBe('Deal')
    expect(Array.isArray(parsed.verbs)).toBe(true)
    expect(Array.isArray(parsed.disabledVerbs)).toBe(true)
  })

  it('fetch schema with --json for all nouns returns array', async () => {
    await run(['fetch', 'schema', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
  })

  it('fetch schema specific noun returns singular and plural', async () => {
    await run(['fetch', 'schema', 'Contact'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed).toHaveProperty('singular')
    expect(parsed).toHaveProperty('plural')
  })
})

// ============================================================================
// 16. Login command — edge cases (3 tests)
// ============================================================================

describe('Login Command — Edge Cases', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('login with only --endpoint sets no mode', async () => {
    // --endpoint alone without --tenant or --api-key should fail
    await run(['login', '--endpoint', 'https://custom.io'])
    const err = errorOutput()
    expect(err).toContain('--tenant')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('login with --api-key shows Endpoint in output', async () => {
    await run(['login', '--api-key', 'hly_test123'])
    const out = logOutput()
    expect(out).toContain('Endpoint')
  })

  it('login with --tenant and --api-key shows tenant name', async () => {
    await run(['login', '--tenant', 'myorg', '--api-key', 'hly_key123'])
    const out = logOutput()
    expect(out).toContain('myorg')
  })
})
