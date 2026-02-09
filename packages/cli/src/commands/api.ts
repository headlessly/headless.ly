/**
 * headlessly api keys list
 * headlessly api keys create
 * headlessly api keys revoke <id>
 *
 * Manage API keys for headless.ly
 */

import { parseArgs } from '../args.js'
import { loadConfig } from '../config.js'

export async function apiCommand(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args)

  if (flags['help'] === true) {
    console.log('headlessly api — API key management')
    console.log('')
    console.log('Usage: headlessly api <subcommand>')
    console.log('')
    console.log('Subcommands:')
    console.log('  keys list       List API keys')
    console.log('  keys create     Create a new API key')
    console.log('  keys revoke     Revoke an API key')
    return
  }

  const sub = positional[0]
  const action = positional[1]

  if (sub === 'keys') {
    const config = await loadConfig()
    if (action === 'list') {
      if (config.apiKey) {
        console.log(`Active key: ${config.apiKey.slice(0, 8)}...`)
      } else {
        console.log('No API keys configured. Run: headlessly login --api-key hly_...')
      }
      return
    }
    if (action === 'create') {
      console.log('API key creation requires a remote connection.')
      console.log('Run: headlessly login --tenant <org> --api-key <key>')
      return
    }
    if (action === 'revoke') {
      console.log('API key revocation requires a remote connection.')
      return
    }
  }

  console.log('Usage: headlessly api keys [list|create|revoke]')
}
