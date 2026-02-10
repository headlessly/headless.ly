import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clearRegistry, setProvider, MemoryNounProvider, Noun } from 'digital-objects'

// Register all 35 entities so commands can find them
import '@headlessly/sdk'

import { run } from '../src/index.js'
import { loadConfig, saveConfig, getConfigDir, getConfigPath } from '../src/config.js'
import { printTable, printJSON, printError, printSuccess } from '../src/output.js'

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
// 1. Command Registration & Routing — Case sensitivity, subcommands (~5 RED)
// ============================================================================

describe('Command Registration & Routing', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('commands should be case-insensitive (Search -> search)', async () => {
    // RED: The router uses exact string matching in switch/case.
    // "Search" (capitalized) should route to searchCommand, not "Unknown command".
    await run(['Search', 'Contact'])
    const errOut = errorOutput()
    expect(errOut).not.toContain('Unknown command')
  })

  it('commands should be case-insensitive (HELP -> help)', async () => {
    // RED: Same issue — "HELP" should be treated as "help"
    await run(['HELP'])
    const out = logOutput()
    expect(out).toContain('Usage: headlessly <command> [options]')
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('--help flag on search command should show search-specific help', async () => {
    // RED: Currently --help is only handled at the top-level router.
    // "headlessly search --help" should show search-specific usage, not run the search.
    await run(['search', '--help'])
    const out = logOutput()
    expect(out).toContain('headlessly search')
    expect(out).toContain('--filter')
    expect(out).toContain('--query')
    // Should NOT attempt to actually search (which would fail with "Provide a type or --query")
    expect(exitSpy).not.toHaveBeenCalledWith(1)
  })

  it('should support "api" as a command for API key management', async () => {
    // RED: There is no "api" command yet. The router should recognize it.
    await run(['api', 'keys', 'list'])
    const errOut = errorOutput()
    expect(errOut).not.toContain('Unknown command')
  })

  it('unknown command should suggest closest match', async () => {
    // RED: Currently unknown commands just say "Unknown command: X" and
    // suggest running "headlessly help". It should suggest the closest command
    // (e.g., "serach" -> "Did you mean: search?")
    await run(['serach'])
    const errOut = errorOutput()
    expect(errOut).toContain('Did you mean')
  })
})

// ============================================================================
// 2. Init Command — Template scaffolding, config persistence (~3 RED)
// ============================================================================

describe('Init Command', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('init with valid template should scaffold entities for that template', async () => {
    // RED: init currently only prints template info but doesn't actually
    // scaffold/seed any entities. It should create starter entities based on template.
    await run(['init', '--template', 'b2b'])

    logSpy.mockClear()
    errorSpy.mockClear()

    // After init with b2b, searching for Contacts should find a seeded contact
    await run(['search', 'Contact'])
    const out = logOutput()
    // Should NOT say "No results." — template should have seeded data
    expect(out).not.toContain('No results.')
  })

  it('init should set mode to "memory" by default when not logged in', async () => {
    // RED: init sets config.mode to config.mode ?? 'local' but the
    // expected default for a brand new init should be 'memory' (in-process)
    // to match the provider.ts documentation.
    await run(['init'])
    const config = await loadConfig()
    expect(config.mode).toBe('memory')
  })

  it('init --dry-run should preview without writing config', async () => {
    // RED: No --dry-run flag support exists in initCommand
    const configBefore = await loadConfig()
    const tenantBefore = configBefore.tenant

    await run(['init', '--tenant', 'preview-org', '--dry-run'])
    const out = logOutput()
    expect(out).toContain('preview')

    // Config should NOT have been changed
    const configAfter = await loadConfig()
    expect(configAfter.tenant).not.toBe('preview-org')
  })
})

// ============================================================================
// 3. Search/Fetch/Do — Data operations, JSON output (~4 RED)
// ============================================================================

describe('Search/Fetch/Do Commands — Data Operations', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('search should support multiple --filter flags combined', async () => {
    // RED: Currently parseArgs only captures the last --filter value.
    // Multiple filters like --filter stage=Lead --filter name=Alice should both apply.
    // Here Alice has stage Lead AND Customer. Both filters must apply to get just the Lead one.
    await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
    await provider.create('Contact', { name: 'Alice', stage: 'Customer' })
    await provider.create('Contact', { name: 'Bob', stage: 'Lead' })
    // With only the last filter (name=Alice), both Alices match.
    // With both filters (stage=Lead AND name=Alice), only one Alice matches.
    await run(['search', 'Contact', '--filter', 'stage=Lead', '--filter', 'name=Alice', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    // Should match only the Alice with stage Lead, not Alice with stage Customer
    expect(parsed.length).toBe(1)
    expect(parsed[0].name).toBe('Alice')
    expect(parsed[0].stage).toBe('Lead')
  })

  it('fetch with non-existent entity and --json should output JSON error, not exit', async () => {
    // RED: fetch currently calls process.exit(1) when entity not found,
    // even with --json flag. With --json it should output { "error": ... } instead.
    await run(['fetch', 'Contact', 'contact_nonexistent', '--json'])
    // Should not have exited
    expect(exitSpy).not.toHaveBeenCalledWith(1)
    // Should have printed a structured JSON error
    const out = logOutput()
    expect(out.length).toBeGreaterThan(0)
  })

  it('search should support --output csv format flag', async () => {
    // RED: Only --json flag exists. There should be a general --output flag
    // that supports table, json, and csv formats.
    await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
    await run(['search', 'Contact', '--output', 'csv'])
    const out = logOutput()
    // CSV should have comma-separated values
    expect(out).toContain(',')
    expect(out).toContain('name')
    expect(out).toContain('Alice')
  })

  it('search --count should output only the count number', async () => {
    // RED: No --count flag exists. Should print just the number of matching entities.
    await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
    await provider.create('Contact', { name: 'Bob', stage: 'Customer' })
    await run(['search', 'Contact', '--count'])
    const out = logOutput().trim()
    expect(out).toBe('2')
  })
})

// ============================================================================
// 4. Configuration — Env vars, precedence (~4 RED)
// ============================================================================

describe('Configuration — Env Vars & Precedence', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('HEADLESSLY_API_KEY env var should set the API key', async () => {
    // RED: config.ts doesn't read from environment variables at all.
    // loadConfig should check HEADLESSLY_API_KEY env var as a fallback.
    const original = process.env.HEADLESSLY_API_KEY
    process.env.HEADLESSLY_API_KEY = 'hly_envtest123'
    try {
      const config = await loadConfig()
      expect(config.apiKey).toBe('hly_envtest123')
    } finally {
      if (original === undefined) {
        delete process.env.HEADLESSLY_API_KEY
      } else {
        process.env.HEADLESSLY_API_KEY = original
      }
    }
  })

  it('HEADLESSLY_ENDPOINT env var should override default endpoint', async () => {
    // RED: Same — env vars not supported in config.ts
    const original = process.env.HEADLESSLY_ENDPOINT
    process.env.HEADLESSLY_ENDPOINT = 'https://custom.headless.ly'
    try {
      const config = await loadConfig()
      expect(config.endpoint).toBe('https://custom.headless.ly')
    } finally {
      if (original === undefined) {
        delete process.env.HEADLESSLY_ENDPOINT
      } else {
        process.env.HEADLESSLY_ENDPOINT = original
      }
    }
  })

  it('HEADLESSLY_TENANT env var should set the tenant', async () => {
    // RED: env var not supported
    const original = process.env.HEADLESSLY_TENANT
    process.env.HEADLESSLY_TENANT = 'env-org'
    try {
      const config = await loadConfig()
      expect(config.tenant).toBe('env-org')
    } finally {
      if (original === undefined) {
        delete process.env.HEADLESSLY_TENANT
      } else {
        process.env.HEADLESSLY_TENANT = original
      }
    }
  })

  it('status should show helpful "run headlessly init" message when no config', async () => {
    // The status command shows "Run headlessly init" when tenant is default/empty.
    // Mock loadConfig to simulate no-config scenario.
    const configMod = await import('../src/config.js')
    const origLoad = configMod.loadConfig
    vi.spyOn(configMod, 'loadConfig').mockResolvedValue({})
    try {
      await run(['status'])
      const out = logOutput()
      expect(out).toContain('headlessly init')
    } finally {
      vi.mocked(configMod.loadConfig).mockImplementation(origLoad)
    }
  })
})

// ============================================================================
// 5. Output Formatting — Quiet mode, no-header, structured errors (~4 RED)
// ============================================================================

describe('Output Formatting — Advanced', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('--quiet flag should suppress "ok:" prefix and non-essential output', async () => {
    // RED: No --quiet flag exists in any command.
    await run(['do', 'create', 'Contact', '--name', 'Alice', '--stage', 'Lead', '--quiet'])
    const out = logOutput()
    expect(out).not.toContain('ok:')
    // Should still output the entity data
    expect(out).toContain('Alice')
  })

  it('search --no-header should omit table headers for piping', async () => {
    // RED: printTable always prints headers. Commands should support --no-header.
    await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
    await run(['search', 'Contact', '--no-header'])
    const out = logOutput()
    // Should contain data but NOT the header separator line (dashes)
    expect(out).toContain('Alice')
    expect(out).not.toMatch(/^-+\s/m)
  })

  it('fetch error with --json should output structured JSON, not plain text', async () => {
    // RED: When --json is used and an error occurs, the output should be
    // structured JSON on stdout, not a plain text error on stderr.
    await run(['fetch', 'Contact', 'contact_missing', '--json'])
    // Error should be structured JSON, not plain text
    expect(exitSpy).not.toHaveBeenCalledWith(1)
    const out = logOutput()
    expect(out.length).toBeGreaterThan(0)
    // Should be parseable JSON
    expect(() => JSON.parse(out)).not.toThrow()
  })

  it('do create with --json should suppress "ok:" message and output pure JSON', async () => {
    // RED: do create prints "ok: Created Contact: ..." AND then JSON.
    // With --json, only the JSON entity should be output.
    await run(['do', 'create', 'Contact', '--name', 'Test', '--stage', 'Lead', '--json'])
    const out = logOutput()
    // The entire output should be parseable as a single JSON entity
    // (not "ok: Created..." followed by JSON)
    const lines = out.split('\n')
    const hasOkLine = lines.some((l: string) => l.startsWith('ok:'))
    expect(hasOkLine).toBe(false)
  })
})

// ============================================================================
// 6. Schema Command — Bug: missing return after process.exit (~2 RED)
// ============================================================================

describe('Schema Command — Bugs', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('schema for unknown noun should NOT throw when process.exit is mocked', async () => {
    // RED (BUG): schemaCommand calls process.exit(1) on line 31 but does NOT return,
    // so when process.exit is mocked, execution falls through to line 35 where
    // schema.name throws TypeError. The fix: add `return` after process.exit(1).
    let threw = false
    try {
      await run(['schema', 'NonexistentEntity'])
    } catch {
      threw = true
    }
    // Bug: it currently throws. After fix, it should NOT throw.
    expect(threw).toBe(false)
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  it('schema Contact slug should be plural form "contacts"', async () => {
    // RED: The schema output has slug as "contact" (singular) but the expected
    // plural form for URL slugs should be "contacts".
    await run(['schema', 'Contact'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed).toHaveProperty('slug')
    expect(parsed.slug).toBe('contacts')
  })
})

// ============================================================================
// 7. End-to-end CRUD Workflow (~3 GREEN + 2 RED)
// ============================================================================

describe('End-to-end CRUD Workflow', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('create then search should find the created entity', async () => {
    await run(['do', 'create', 'Contact', '--name', 'Alice', '--stage', 'Lead'])

    logSpy.mockClear()
    errorSpy.mockClear()

    await run(['search', 'Contact'])
    const out = logOutput()
    expect(out).toContain('Alice')
    expect(out).toContain('Lead')
  })

  it('create then fetch by ID should return the entity', async () => {
    await run(['do', 'create', 'Contact', '--name', 'Bob', '--stage', 'Customer'])
    const createOut = logOutput()
    // Extract the entity ID from the JSON output
    const match = createOut.match(/"\$id"\s*:\s*"([^"]+)"/)
    expect(match).toBeTruthy()

    if (match) {
      logSpy.mockClear()
      errorSpy.mockClear()
      await run(['fetch', 'Contact', match[1]!])
      const fetchOut = logOutput()
      expect(fetchOut).toContain('Bob')
    }
  })

  it('search with --json should return parseable JSON after create', async () => {
    await provider.create('Contact', { name: 'Carol', stage: 'Lead' })
    await run(['search', 'Contact', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(1)
    expect(parsed[0].name).toBe('Carol')
  })

  it('search with --sort should order results correctly', async () => {
    await provider.create('Contact', { name: 'Zara', stage: 'Lead' })
    await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
    await provider.create('Contact', { name: 'Mike', stage: 'Lead' })

    await run(['search', 'Contact', '--sort', 'name:asc', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed[0].name).toBe('Alice')
    expect(parsed[1].name).toBe('Mike')
    expect(parsed[2].name).toBe('Zara')
  })

  it('search with --limit should cap results correctly in JSON mode', async () => {
    for (let i = 0; i < 5; i++) {
      await provider.create('Contact', { name: `Contact-${i}`, stage: 'Lead' })
    }

    await run(['search', 'Contact', '--limit', '2', '--json'])
    const out = logOutput()
    // RED: When there are more results than limit, the search command appends
    // a "(Showing 2 of 5 results)" message which breaks JSON parsing.
    // In --json mode, the output should be pure JSON with no extra text.
    expect(() => JSON.parse(out)).not.toThrow()
    const parsed = JSON.parse(out)
    expect(parsed.length).toBe(2)
  })
})

// ============================================================================
// 8. Per-Command Help (~3 RED)
// ============================================================================

describe('Per-Command Help', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('fetch --help should show fetch-specific usage without errors', async () => {
    // RED: No per-command --help support. fetch treats --help as missing args.
    await run(['fetch', '--help'])
    const out = logOutput()
    expect(out).toContain('headlessly fetch')
    expect(out).toContain('<type>')
    expect(out).toContain('<id>')
    expect(exitSpy).not.toHaveBeenCalledWith(1)
  })

  it('do --help should show all do subcommands without errors', async () => {
    // RED: No per-command --help support. do treats --help as missing action.
    await run(['do', '--help'])
    const out = logOutput()
    expect(out).toContain('headlessly do')
    expect(out).toContain('create')
    expect(out).toContain('update')
    expect(out).toContain('delete')
    expect(exitSpy).not.toHaveBeenCalledWith(1)
  })

  it('init --help should show init usage without executing init', async () => {
    // RED: No per-command --help support. init runs normally when --help is passed
    // because parseArgs treats --help as a boolean flag.
    await run(['init', '--help'])
    const out = logOutput()
    expect(out).toContain('headlessly init')
    expect(out).toContain('--template')
    expect(out).toContain('--tenant')
    // Should NOT have actually run init (no "Getting started" or "ok:" output)
    expect(out).not.toContain('Getting started')
  })
})
