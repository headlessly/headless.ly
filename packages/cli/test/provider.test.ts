import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('digital-objects', () => {
  let currentProvider: unknown

  return {
    __resetProvider: () => {
      currentProvider = undefined
    },
    getProvider: () => currentProvider,
    setProvider: (provider: unknown) => {
      currentProvider = provider
    },
  }
})

vi.mock('@headlessly/objects', () => {
  class LocalNounProvider {
    readonly kind = 'local'
  }

  class DONounProvider {
    readonly kind = 'remote'
    readonly endpoint: string
    readonly apiKey?: string

    constructor(options: { endpoint: string; apiKey?: string }) {
      this.endpoint = options.endpoint
      this.apiKey = options.apiKey
    }
  }

  return { LocalNounProvider, DONounProvider }
})

describe('getProvider()', () => {
  let tempHome: string
  let originalHome: string | undefined
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    vi.resetModules()
    tempHome = await mkdtemp(join(tmpdir(), 'headlessly-cli-provider-'))
    originalHome = process.env.HOME
    originalEnv = { ...process.env }
    process.env.HOME = tempHome
    delete process.env.HEADLESSLY_API_KEY
    delete process.env.HEADLESSLY_TOKEN
    delete process.env.HEADLESSLY_ENDPOINT
    delete process.env.HEADLESSLY_TENANT

    const digitalObjects = (await import('digital-objects')) as { __resetProvider: () => void }
    digitalObjects.__resetProvider()
  })

  afterEach(async () => {
    process.env = originalEnv
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }
    await rm(tempHome, { recursive: true, force: true })
  })

  it('uses saved config for remote provider initialization', async () => {
    const { saveConfig } = await import('../src/config.js')
    await saveConfig({
      mode: 'remote',
      endpoint: 'https://db.headless.ly',
      apiKey: 'cfg_key',
      tenant: 'acme',
    })

    const { getProvider } = await import('../src/provider.js')
    const provider = await getProvider()

    expect(provider).toMatchObject({
      kind: 'remote',
      endpoint: 'https://db.headless.ly',
      apiKey: 'cfg_key',
    })
  })

  it('accepts HEADLESSLY_TOKEN as a compatibility alias', async () => {
    const { saveConfig } = await import('../src/config.js')
    await saveConfig({
      mode: 'remote',
      endpoint: 'https://db.headless.ly',
      apiKey: 'cfg_key',
    })

    process.env.HEADLESSLY_TOKEN = 'env_alias_token'

    const { getProvider } = await import('../src/provider.js')
    const provider = await getProvider()

    expect(provider).toMatchObject({
      kind: 'remote',
      apiKey: 'env_alias_token',
    })
  })

  it('falls back to the local provider with no remote configuration', async () => {
    const { getProvider } = await import('../src/provider.js')
    const provider = await getProvider()

    expect(provider).toMatchObject({ kind: 'local' })
  })
})
