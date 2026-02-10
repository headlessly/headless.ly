import { describe, it, expect } from 'vitest'

import { headlessly, createHeadlesslyClient, RPC, buildHeadlesslyConfig } from '../src/index.js'

describe('headlessly()', () => {
  it('returns a defined proxy object', () => {
    const client = headlessly({ tenant: 'acme' })
    expect(client).toBeDefined()
  })

  it('createHeadlesslyClient is an alias for headlessly', () => {
    expect(createHeadlesslyClient).toBe(headlessly)
  })

  it('constructs default URL: https://db.headless.ly/~{tenant}', () => {
    const { url, rpcOptions } = buildHeadlesslyConfig({ tenant: 'acme' })
    expect(url).toBe('https://db.headless.ly/~acme')
    expect(rpcOptions).toEqual({})
  })

  it('passes apiKey as auth option', () => {
    const { url, rpcOptions } = buildHeadlesslyConfig({ tenant: 'acme', apiKey: 'key_test' })
    expect(url).toBe('https://db.headless.ly/~acme')
    expect(rpcOptions).toEqual({ auth: 'key_test' })
  })

  it('uses ws transport: wss protocol', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', transport: 'ws' })
    expect(url).toBe('wss://db.headless.ly/~acme')
  })

  it('uses custom endpoint', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', endpoint: 'http://localhost:8787' })
    expect(url).toBe('https://localhost:8787/~acme')
  })

  it('uses custom endpoint with ws transport', () => {
    const { url } = buildHeadlesslyConfig({ tenant: 'acme', endpoint: 'http://localhost:8787', transport: 'ws' })
    expect(url).toBe('wss://localhost:8787/~acme')
  })

  it('combines apiKey and ws transport', () => {
    const { url, rpcOptions } = buildHeadlesslyConfig({ tenant: 'acme', apiKey: 'key_test', transport: 'ws' })
    expect(url).toBe('wss://db.headless.ly/~acme')
    expect(rpcOptions).toEqual({ auth: 'key_test' })
  })

  it('re-exports RPC from rpc.do', () => {
    expect(RPC).toBeDefined()
    expect(typeof RPC).toBe('function')
  })
})
