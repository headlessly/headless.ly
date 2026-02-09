import { describe, it, expect } from 'vitest'

describe('@headlessly/rpc — factory', () => {
  it('exports headlessly function', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.headlessly).toBe('function')
  })

  it('exports createHeadlesslyClient', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.createHeadlesslyClient).toBe('function')
  })

  it('re-exports RPC types', async () => {
    const mod = await import('../src/index')
    // Check that key rpc.do re-exports exist
    expect(mod.RPC).toBeDefined()
  })
})
