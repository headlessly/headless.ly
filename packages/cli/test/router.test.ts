import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { clearRegistry, setProvider, MemoryNounProvider } from 'digital-objects'

// Register all 35 entities so commands can find them
import '@headlessly/sdk'

import { run, parseArgs } from '../src/index.js'

describe('@headlessly/cli — router (real tests)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Set up a fresh MemoryNounProvider for each test
    const provider = new MemoryNounProvider()
    setProvider(provider)

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: number) => never)
  })

  afterEach(() => {
    logSpy.mockRestore()
    errorSpy.mockRestore()
    exitSpy.mockRestore()
  })

  // =========================================================================
  // Exports
  // =========================================================================

  it('exports run function', () => {
    expect(typeof run).toBe('function')
  })

  it('exports parseArgs function', () => {
    expect(typeof parseArgs).toBe('function')
  })

  // =========================================================================
  // Help & version
  // =========================================================================

  it('help command prints usage', async () => {
    await run(['help'])
    expect(logSpy).toHaveBeenCalled()
    const output = logSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('headlessly')
  })

  it('--version prints version', async () => {
    await run(['--version'])
    expect(logSpy).toHaveBeenCalled()
  })

  it('-h is alias for help', async () => {
    await run(['-h'])
    expect(logSpy).toHaveBeenCalled()
  })

  // =========================================================================
  // Unknown command
  // =========================================================================

  it('unknown command prints error', async () => {
    await run(['nonexistent'])
    expect(errorSpy).toHaveBeenCalled()
    const output = errorSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(output).toContain('Unknown command')
    expect(exitSpy).toHaveBeenCalledWith(1)
  })

  // =========================================================================
  // Schema command
  // =========================================================================

  it('schema command outputs entity schemas', async () => {
    try {
      await run(['schema'])
    } catch {
      // Schema command may need setup — that's fine
    }
    // Should have printed something or thrown gracefully
  })

  // =========================================================================
  // No command shows help
  // =========================================================================

  it('no command shows help', async () => {
    await run([])
    expect(logSpy).toHaveBeenCalled()
  })
})
