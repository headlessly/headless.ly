/**
 * Provider initialization for CLI
 *
 * On first use with no config, auto-provisions an anonymous tenant so the
 * agent can start operating immediately. Zero auth, zero setup.
 *
 * Resolution order:
 * 1. Environment variables (HEADLESSLY_ENDPOINT, HEADLESSLY_TOKEN)
 * 2. Saved config (~/.headlessly/config.json)
 * 3. Auto-provision a new anonymous tenant
 */

import type { NounProvider } from 'digital-objects'
import { getProvider as getGlobalProvider, setProvider } from 'digital-objects'
import { LocalNounProvider } from '@headlessly/objects'
import { loadConfig, saveConfig } from './config.js'
import { printInfo } from './output.js'

let initialized = false
let _isRemote = false

/** Whether the CLI is configured in remote mode. */
export function isRemoteMode(): boolean {
  return _isRemote
}

/**
 * Auto-provision an anonymous tenant via POST /provision.
 * Saves credentials to ~/.headlessly/config.json for subsequent runs.
 */
async function autoProvision(): Promise<{ endpoint: string; apiKey: string; tenant: string }> {
  const resp = await fetch('https://api.headless.ly/provision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!resp.ok) {
    throw new Error(`Provisioning failed (${resp.status}): ${await resp.text()}`)
  }

  const data = (await resp.json()) as { tenantId: string; sessionToken: string; claimToken?: string }
  const endpoint = `https://api.headless.ly/~${data.tenantId}`
  const config = {
    tenant: data.tenantId,
    mode: 'remote' as const,
    endpoint,
    apiKey: data.sessionToken,
  }

  await saveConfig(config)

  printInfo(`Auto-provisioned tenant: ${data.tenantId}`)
  if (data.claimToken) {
    printInfo(`Claim this tenant permanently: https://id.org.ai/claim/${data.claimToken}`)
  }

  return { endpoint, apiKey: data.sessionToken, tenant: data.tenantId }
}

/**
 * Get the active NounProvider.
 *
 * On first call, checks saved config and environment variables.
 * If nothing is configured, auto-provisions an anonymous tenant.
 */
export async function getProvider(): Promise<NounProvider> {
  if (!initialized) {
    initialized = true

    const config = await loadConfig()
    let token = process.env.HEADLESSLY_TOKEN || process.env.HEADLESSLY_API_KEY || config.apiKey
    let endpoint = config.endpoint || (config.mode === 'remote' || token ? 'https://db.headless.ly' : undefined)

    // No config at all — auto-provision
    if (!endpoint && !token) {
      const provisioned = await autoProvision()
      endpoint = provisioned.endpoint
      token = provisioned.apiKey
    }

    if (endpoint) {
      _isRemote = true
      const { DONounProvider } = await import('@headlessly/objects')
      const provider = new DONounProvider({ endpoint, apiKey: token })
      setProvider(provider)
    } else {
      setProvider(new LocalNounProvider())
    }
  }

  return getGlobalProvider()
}
