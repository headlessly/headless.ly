/**
 * headlessly login [--tenant name] [--api-key key]
 *
 * Stores credentials in ~/.headlessly/config.json
 */

import { parseArgs } from '../args.js'
import { loadConfig, saveConfig, getConfigPath } from '../config.js'
import { printError, printSuccess } from '../output.js'

export async function loginCommand(args: string[]): Promise<void> {
  const { flags } = parseArgs(args)

  const tenant = flags['tenant'] as string | undefined
  const apiKey = flags['api-key'] as string | undefined
  const endpoint = flags['endpoint'] as string | undefined

  if (!tenant && !apiKey) {
    printError('Provide --tenant and/or --api-key')
    console.log('Usage: headlessly login --tenant acme --api-key hly_...')
    console.log('')
    console.log('Options:')
    console.log('  --tenant name       Organization name')
    console.log('  --api-key key       API key for authentication')
    console.log('  --endpoint url      Custom API endpoint (default: https://db.headless.ly)')
    process.exit(1)
  }

  const config = await loadConfig()

  if (tenant) config.tenant = tenant
  if (apiKey) config.apiKey = apiKey
  if (endpoint) config.endpoint = endpoint
  config.mode = apiKey ? 'remote' : 'local'

  await saveConfig(config)

  printSuccess(`Logged in as ${config.tenant ?? 'default'}`)
  console.log(`Config saved to ${getConfigPath()}`)

  if (config.mode === 'remote') {
    console.log(`Endpoint: ${config.endpoint ?? 'https://db.headless.ly'}`)
  } else {
    console.log('Mode: local (in-memory)')
  }
}
