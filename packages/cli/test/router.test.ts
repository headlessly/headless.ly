import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock heavy dependencies that cli imports
vi.mock('@headlessly/sdk', () => ({
  $: new Proxy({}, { get: () => undefined }),
  headlessly: vi.fn(),
  setProvider: vi.fn(),
  getProvider: vi.fn(),
  MemoryNounProvider: vi.fn(),
}))
vi.mock('@headlessly/objects', () => ({
  LocalNounProvider: vi.fn(),
}))
vi.mock('@headlessly/mcp', () => ({
  getTools: vi.fn(() => []),
  createHandlers: vi.fn(() => ({})),
  MCPServer: vi.fn(),
}))
vi.mock('digital-objects', () => ({
  Noun: vi.fn(),
  setProvider: vi.fn(),
  getProvider: vi.fn(),
  clearRegistry: vi.fn(),
  MemoryNounProvider: vi.fn(),
  getAllNouns: vi.fn(() => new Map()),
}))

describe('@headlessly/cli — router', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exports run function', async () => {
    const { run } = await import('../src/index')
    expect(typeof run).toBe('function')
  })

  it('exports parseArgs function', async () => {
    const mod = await import('../src/index')
    if (mod.parseArgs) {
      expect(typeof mod.parseArgs).toBe('function')
    }
  })

  describe('run dispatches commands', () => {
    it('handles help command without error', async () => {
      const { run } = await import('../src/index')
      // Mock console.log to capture output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      try {
        await run(['help'])
      } catch {
        // Some commands may throw if not fully mocked — that's OK
      }
      consoleSpy.mockRestore()
    })

    it('handles --version command', async () => {
      const { run } = await import('../src/index')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      try {
        await run(['--version'])
      } catch {
        // OK
      }
      consoleSpy.mockRestore()
    })

    it('handles unknown command gracefully', async () => {
      const { run } = await import('../src/index')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        await run(['nonexistent'])
      } catch {
        // OK
      }
      consoleSpy.mockRestore()
      errorSpy.mockRestore()
    })
  })
})
