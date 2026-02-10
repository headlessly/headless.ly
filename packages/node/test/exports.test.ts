import { describe, it, expect } from 'vitest'

describe('@headlessly/node — module exports', () => {
  it('exports headlessly function', async () => {
    const mod = await import('../src/index.js')
    expect(typeof mod.headlessly).toBe('function')
  })

  it('exports NDJSONEventPersistence class', async () => {
    const mod = await import('../src/index.js')
    expect(typeof mod.NDJSONEventPersistence).toBe('function')
  })

  it('exports createServer function', async () => {
    const mod = await import('../src/index.js')
    expect(typeof mod.createServer).toBe('function')
  })

  it('exports sync function', async () => {
    const mod = await import('../src/index.js')
    expect(typeof mod.sync).toBe('function')
  })

  it('exports HeadlessNodeClient class (legacy)', async () => {
    const mod = await import('../src/index.js')
    expect(typeof mod.HeadlessNodeClient).toBe('function')
  })

  it('exports createClient factory (legacy)', async () => {
    const mod = await import('../src/index.js')
    expect(typeof mod.createClient).toBe('function')
  })

  it('exports Headlessly singleton (legacy)', async () => {
    const mod = await import('../src/index.js')
    expect(typeof mod.Headlessly).toBe('object')
    expect(typeof mod.Headlessly.init).toBe('function')
    expect(typeof mod.Headlessly.reset).toBe('function')
  })

  it('exports expressMiddleware (legacy)', async () => {
    const mod = await import('../src/index.js')
    expect(typeof mod.expressMiddleware).toBe('function')
  })

  it('exports honoMiddleware (legacy)', async () => {
    const mod = await import('../src/index.js')
    expect(typeof mod.honoMiddleware).toBe('function')
  })

  it('default export contains all main exports', async () => {
    const mod = await import('../src/index.js')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default.createClient).toBe('function')
    expect(typeof mod.default.HeadlessNodeClient).toBe('function')
  })
})
