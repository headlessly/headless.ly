/**
 * Provider initialization for CLI
 *
 * Resolves the correct NounProvider based on config/environment:
 * - remote: DONounProvider targeting saved config or HEADLESSLY_ENDPOINT
 * - local: LocalNounProvider (default, in-process)
 *
 * Environment variables:
 * - HEADLESSLY_ENDPOINT: Remote API URL (e.g. https://crm.headless.ly)
 * - HEADLESSLY_TOKEN / HEADLESSLY_API_KEY: API key or session token for authentication
 *
 * The global provider from digital-objects is the source of truth.
 * If setProvider() was called externally (e.g. in tests), we respect that.
 */

import type { NounProvider } from 'digital-objects'
import { getProvider as getGlobalProvider, setProvider } from 'digital-objects'
import { LocalNounProvider } from '@headlessly/objects'
import { loadConfig } from './config.js'

let initialized = false
const DEFAULT_REMOTE_ENDPOINT = 'https://db.headless.ly'

/**
 * Get the active NounProvider.
 *
 * On first call, checks saved config and environment variables for remote configuration.
 * If remote mode is configured, it initializes DONounProvider.
 * Otherwise sets LocalNounProvider as the default.
 */
export async function getProvider(): Promise<NounProvider> {
  if (!initialized) {
    initialized = true

    const config = await loadConfig()
    const token = process.env.HEADLESSLY_TOKEN || process.env.HEADLESSLY_API_KEY || config.apiKey
    const endpoint = config.endpoint || (config.mode === 'remote' || token ? DEFAULT_REMOTE_ENDPOINT : undefined)

    if (endpoint) {
      const { DONounProvider } = await import('@headlessly/objects')
      const provider = new DONounProvider({
        endpoint,
        apiKey: token,
      })
      setProvider(provider)
    } else {
      setProvider(new LocalNounProvider())
    }
  }

  return getGlobalProvider()
}
