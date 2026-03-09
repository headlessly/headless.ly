import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pickFields } from '../src/output.js'

// ============================================================================
// 1. Unit tests for pickFields
// ============================================================================

describe('pickFields', () => {
  it('picks only specified fields', () => {
    const entities = [
      { $id: 'contact_1', $type: 'Contact', name: 'Alice', email: 'a@b.com', phone: '555-1234' },
      { $id: 'contact_2', $type: 'Contact', name: 'Bob', email: 'b@b.com', phone: '555-5678' },
    ]
    const result = pickFields(entities, ['name', 'email'])
    expect(result).toEqual([
      { name: 'Alice', email: 'a@b.com' },
      { name: 'Bob', email: 'b@b.com' },
    ])
  })

  it('ignores fields that do not exist on the entity', () => {
    const entities = [{ $id: 'contact_1', name: 'Alice' }]
    const result = pickFields(entities, ['name', 'nonexistent'])
    expect(result).toEqual([{ name: 'Alice' }])
  })

  it('returns empty objects when no fields match', () => {
    const entities = [{ $id: 'contact_1', name: 'Alice' }]
    const result = pickFields(entities, ['foo', 'bar'])
    expect(result).toEqual([{}])
  })

  it('handles empty entities array', () => {
    const result = pickFields([], ['name'])
    expect(result).toEqual([])
  })

  it('deduplicates fields', () => {
    const entities = [{ $id: 'contact_1', name: 'Alice' }]
    const result = pickFields(entities, ['name', 'name'])
    expect(result).toEqual([{ name: 'Alice' }])
  })
})

// ============================================================================
// 2. Integration tests for search and fetch --fields
// ============================================================================

const mockProvider = {
  find: vi.fn(async () => [
    { $id: 'contact_1', $type: 'Contact', name: 'Alice', stage: 'Lead', email: 'a@b.com', phone: '555-1234' },
    { $id: 'contact_2', $type: 'Contact', name: 'Bob', stage: 'Qualified', email: 'b@b.com', phone: '555-5678' },
  ]),
  get: vi.fn(async () => ({
    $id: 'contact_1',
    $type: 'Contact',
    name: 'Alice',
    stage: 'Lead',
    email: 'a@b.com',
    phone: '555-1234',
  })),
}

vi.mock('digital-objects', () => ({
  getProvider: () => mockProvider,
  setProvider: vi.fn(),
  getAllNouns: () => new Map(),
  getNounSchema: () => null,
}))

vi.mock('@headlessly/objects', () => ({
  LocalNounProvider: class {},
  DONounProvider: class {},
}))

vi.mock('../src/provider.js', () => ({
  getProvider: async () => mockProvider,
}))

let logSpy: ReturnType<typeof vi.spyOn>
let errorSpy: ReturnType<typeof vi.spyOn>
let exitSpy: ReturnType<typeof vi.spyOn>

function logOutput(): string {
  return logSpy.mock.calls.map((c) => c.join(' ')).join('\n')
}

describe('search --fields', () => {
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: number) => never)
    mockProvider.find.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    exitSpy.mockRestore()
  })

  it('limits JSON output to specified fields', async () => {
    const { searchCommand } = await import('../src/commands/search.js')
    await searchCommand(['Contact', '--json', '--fields', 'name,email'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]).toEqual({ name: 'Alice', email: 'a@b.com' })
    expect(parsed[1]).toEqual({ name: 'Bob', email: 'b@b.com' })
    // Excluded fields should not be present
    expect(parsed[0]).not.toHaveProperty('$id')
    expect(parsed[0]).not.toHaveProperty('phone')
    expect(parsed[0]).not.toHaveProperty('stage')
  })

  it('returns all fields when --fields is not specified', async () => {
    const { searchCommand } = await import('../src/commands/search.js')
    await searchCommand(['Contact', '--json'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed[0]).toHaveProperty('$id')
    expect(parsed[0]).toHaveProperty('name')
    expect(parsed[0]).toHaveProperty('email')
    expect(parsed[0]).toHaveProperty('phone')
    expect(parsed[0]).toHaveProperty('stage')
  })

  it('--help mentions --fields', async () => {
    const { searchCommand } = await import('../src/commands/search.js')
    await searchCommand(['--help'])
    const out = logOutput()
    expect(out).toContain('--fields')
  })
})

describe('fetch --fields', () => {
  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: number) => never)
    mockProvider.get.mockClear()
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    exitSpy.mockRestore()
  })

  it('limits JSON output to specified fields', async () => {
    const { fetchCommand } = await import('../src/commands/fetch.js')
    await fetchCommand(['Contact', 'contact_1', '--fields', 'name,stage'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed).toEqual({ name: 'Alice', stage: 'Lead' })
    expect(parsed).not.toHaveProperty('$id')
    expect(parsed).not.toHaveProperty('email')
    expect(parsed).not.toHaveProperty('phone')
  })

  it('returns all fields when --fields is not specified', async () => {
    const { fetchCommand } = await import('../src/commands/fetch.js')
    await fetchCommand(['Contact', 'contact_1'])
    const out = logOutput()
    const parsed = JSON.parse(out)
    expect(parsed).toHaveProperty('$id')
    expect(parsed).toHaveProperty('name')
    expect(parsed).toHaveProperty('email')
    expect(parsed).toHaveProperty('phone')
  })

  it('--help mentions --fields', async () => {
    const { fetchCommand } = await import('../src/commands/fetch.js')
    await fetchCommand(['--help'])
    const out = logOutput()
    expect(out).toContain('--fields')
  })
})
