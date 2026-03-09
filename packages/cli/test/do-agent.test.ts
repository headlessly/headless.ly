import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { buildData } from '../src/commands/do.js'

const mockProvider = {
  create: vi.fn(async (type: string, data: any) => ({ $id: `${type.toLowerCase()}_test`, $type: type, ...data })),
  update: vi.fn(async (type: string, id: string, data: any) => ({ $id: id, $type: type, ...data })),
  delete: vi.fn(async (_type: string, _id: string) => ({ deletedCount: 1 })),
  find: vi.fn(async () => []),
  get: vi.fn(async () => ({ $id: 'contact_test', $type: 'Contact', name: 'Alice' })),
  perform: vi.fn(async (type: string, verb: string, id: string) => ({ $id: id, $type: type })),
}

vi.mock('../src/provider.js', () => ({
  getProvider: async () => mockProvider,
}))

let logSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>
let exitSpy: ReturnType<typeof vi.spyOn>

function logOutput(): string {
  return logSpy.mock.calls.map((c) => c.join(' ')).join('\n')
}

function errorOutput(): string {
  return errorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
}

function allOutput(): string {
  return logOutput() + '\n' + errorOutput()
}

function setup() {
  vi.clearAllMocks()
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: number) => never)
}

function teardown() {
  logSpy.mockRestore()
  errorSpy.mockRestore()
  exitSpy.mockRestore()
}

// ============================================================================
// buildData unit tests
// ============================================================================

describe('buildData', () => {
  it('parses --data JSON', () => {
    const result = buildData({ data: '{"name":"Alice","stage":"Lead"}' })
    expect(result).toEqual({ name: 'Alice', stage: 'Lead' })
  })

  it('individual flags override --data values', () => {
    const result = buildData({ data: '{"name":"Alice","stage":"Lead"}', name: 'Bob' })
    expect(result).toEqual({ name: 'Bob', stage: 'Lead' })
  })

  it('throws on invalid JSON', () => {
    expect(() => buildData({ data: '{bad json' })).toThrow('Invalid JSON in --data')
  })

  it('throws when --data is not a JSON object', () => {
    expect(() => buildData({ data: '"hello"' })).toThrow('--data must be a JSON object')
  })

  it('throws when --data is a JSON array', () => {
    expect(() => buildData({ data: '[1,2,3]' })).toThrow('--data must be a JSON object')
  })

  it('skips reserved flags', () => {
    const result = buildData({ json: true, quiet: true, 'dry-run': true, help: true, name: 'Alice' })
    expect(result).toEqual({ name: 'Alice' })
  })
})

// ============================================================================
// --data integration with doCommand
// ============================================================================

describe('--data flag', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('passes parsed JSON to provider.create', async () => {
    const { doCommand } = await import('../src/commands/do.js')
    await doCommand(['create', 'Contact', '--data', '{"name":"Alice","stage":"Lead"}'])
    expect(mockProvider.create).toHaveBeenCalledWith('Contact', { name: 'Alice', stage: 'Lead' })
  })

  it('merges --data with individual flags, flags win', async () => {
    const { doCommand } = await import('../src/commands/do.js')
    await doCommand(['create', 'Contact', '--data', '{"name":"Alice","stage":"Lead"}', '--name', 'Bob'])
    expect(mockProvider.create).toHaveBeenCalledWith('Contact', { name: 'Bob', stage: 'Lead' })
  })

  it('prints error on invalid JSON in --data', async () => {
    const { doCommand } = await import('../src/commands/do.js')
    await doCommand(['create', 'Contact', '--data', '{bad'])
    const err = errorOutput()
    expect(err).toContain('Invalid JSON in --data')
  })
})

// ============================================================================
// --dry-run
// ============================================================================

describe('--dry-run flag', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('does NOT call provider.create on dry-run', async () => {
    const { doCommand } = await import('../src/commands/do.js')
    await doCommand(['create', 'Contact', '--dry-run', '--name', 'Alice'])
    expect(mockProvider.create).not.toHaveBeenCalled()
    const out = allOutput()
    expect(out).toContain('[dry-run]')
    expect(out).toContain('Would create Contact')
  })

  it('outputs JSON preview when --dry-run --json', async () => {
    const { doCommand } = await import('../src/commands/do.js')
    await doCommand(['create', 'Contact', '--dry-run', '--json', '--name', 'Alice'])
    expect(mockProvider.create).not.toHaveBeenCalled()
    const out = logOutput()
    expect(out).toContain('"dry-run"')
    expect(out).toContain('"action"')
    expect(out).toContain('"create"')
  })

  it('does NOT call provider.delete on dry-run', async () => {
    const { doCommand } = await import('../src/commands/do.js')
    await doCommand(['delete', 'Contact', 'contact_abc', '--dry-run'])
    expect(mockProvider.delete).not.toHaveBeenCalled()
    const out = allOutput()
    expect(out).toContain('[dry-run]')
    expect(out).toContain('Would delete Contact')
  })

  it('does NOT call provider.update on dry-run', async () => {
    const { doCommand } = await import('../src/commands/do.js')
    await doCommand(['update', 'Contact', 'contact_abc', '--dry-run', '--name', 'Bob'])
    expect(mockProvider.update).not.toHaveBeenCalled()
    const out = allOutput()
    expect(out).toContain('[dry-run]')
    expect(out).toContain('Would update Contact')
  })

  it('does NOT call provider.perform on dry-run for custom verb', async () => {
    const { doCommand } = await import('../src/commands/do.js')
    await doCommand(['qualify', 'Contact', 'contact_abc', '--dry-run'])
    expect(mockProvider.perform).not.toHaveBeenCalled()
    const out = allOutput()
    expect(out).toContain('[dry-run]')
    expect(out).toContain('Would qualify Contact')
  })
})

// ============================================================================
// Help text
// ============================================================================

describe('help text', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('shows --data and --dry-run in help output', async () => {
    const { doCommand } = await import('../src/commands/do.js')
    await doCommand(['--help'])
    const out = logOutput()
    expect(out).toContain('--data JSON')
    expect(out).toContain('--dry-run')
  })
})
