/**
 * Provider initialization for CLI
 *
 * Resolves the correct NounProvider based on config/environment:
 * - remote: DONounProvider targeting HEADLESSLY_ENDPOINT (when env vars set)
 * - memory: MemoryNounProvider (default, in-process)
 *
 * Environment variables:
 * - HEADLESSLY_ENDPOINT: Remote API URL (e.g. https://crm.headless.ly)
 * - HEADLESSLY_TOKEN: API key or session token for authentication
 *
 * The global provider from digital-objects is the source of truth.
 * If setProvider() was called externally (e.g. in tests), we respect that.
 */

import type { NounProvider } from 'digital-objects'
import { getProvider as getGlobalProvider, setProvider } from 'digital-objects'

let initialized = false

/**
 * Get the active NounProvider.
 *
 * On first call, checks environment variables for remote configuration.
 * If HEADLESSLY_ENDPOINT is set, configures DONounProvider for remote mode.
 * Otherwise returns the default MemoryNounProvider from digital-objects.
 */
export async function getProvider(): Promise<NounProvider> {
  if (!initialized) {
    initialized = true

    const endpoint = process.env.HEADLESSLY_ENDPOINT
    const token = process.env.HEADLESSLY_TOKEN

    if (endpoint) {
      try {
        const { DONounProvider } = await import('@headlessly/objects')
        const provider = new DONounProvider({
          endpoint,
          apiKey: token,
        })
        setProvider(provider)
      } catch (err) {
        // If @headlessly/objects is not available, fall back to memory
        console.error(`Warning: could not initialize remote provider: ${err instanceof Error ? err.message : err}`)
      }
    }
  }

  return getGlobalProvider()
}
