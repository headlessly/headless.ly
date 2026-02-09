/**
 * headlessly status
 *
 * Show current org status: tenant, mode, entity counts
 */

import { loadConfig, getConfigPath } from '../config.js'
import { getProvider } from '../provider.js'
import { existsSync } from 'fs'

export async function statusCommand(_args: string[]): Promise<void> {
  const config = await loadConfig()
  const configPath = getConfigPath()
  const configExists = existsSync(configPath)

  console.log('headless.ly status')
  console.log('==================')
  console.log('')

  console.log(`  Tenant:   ${config.tenant ?? 'default'}`)
  console.log(`  Mode:     ${config.mode ?? 'local'}`)
  console.log(`  Config:   ${configPath}`)

  if (!configExists || !config.tenant || config.tenant === 'default') {
    console.log('')
    console.log('  Tip: Run headlessly init to configure your organization')
  }

  if (config.endpoint) {
    console.log(`  Endpoint: ${config.endpoint}`)
  }

  if (config.apiKey) {
    console.log(`  API Key:  ${config.apiKey.slice(0, 8)}...`)
  }

  console.log('')

  // Show registered noun counts
  try {
    const { getAllNouns } = await import('digital-objects')
    const nouns = getAllNouns()

    if (nouns.size > 0) {
      console.log(`  Registered entities: ${nouns.size}`)

      const provider = await getProvider()
      const counts: { name: string; count: number }[] = []

      for (const [name] of nouns) {
        try {
          const results = await provider.find(name)
          if (results.length > 0) {
            counts.push({ name, count: results.length })
          }
        } catch {
          // Skip types that fail to query
        }
      }

      if (counts.length > 0) {
        console.log('')
        console.log('  Entity counts:')
        for (const { name, count } of counts) {
          console.log(`    ${name}: ${count}`)
        }
      }
    }
  } catch {
    // digital-objects not loaded yet
  }

  console.log('')
}
