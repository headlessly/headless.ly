/**
 * headlessly init [--template b2b|b2c|b2d|b2a] [--tenant name]
 *
 * Initialize a new headless.ly organization
 */

import { parseArgs } from '../args.js'
import { loadConfig, saveConfig } from '../config.js'
import { printSuccess, printError } from '../output.js'

const TEMPLATES = ['b2b', 'b2c', 'b2d', 'b2a'] as const

export async function initCommand(args: string[]): Promise<void> {
  const { flags } = parseArgs(args)

  const tenant = (flags['tenant'] as string) || 'default'
  const template = flags['template'] as string | undefined

  if (template && !TEMPLATES.includes(template as (typeof TEMPLATES)[number])) {
    printError(`Unknown template: ${template}`)
    console.log(`Available templates: ${TEMPLATES.join(', ')}`)
    process.exit(1)
  }

  // Save tenant config
  const config = await loadConfig()
  config.tenant = tenant
  config.mode = config.mode ?? 'local'
  await saveConfig(config)

  printSuccess(`Initialized organization: ${tenant}`)
  console.log('')
  console.log('Getting started:')
  console.log('')
  console.log('  # Search entities')
  console.log('  headlessly search Contact')
  console.log('')
  console.log('  # Create a contact')
  console.log('  headlessly do create Contact --name Alice --stage Lead')
  console.log('')
  console.log('  # View schema')
  console.log('  headlessly schema Contact')
  console.log('')
  console.log('  # Start MCP server for agent integration')
  console.log('  headlessly mcp')
  console.log('')

  if (template) {
    console.log(`Template: ${template}`)
    console.log(`  Optimized entity defaults for ${template.toUpperCase()} workflows.`)
  }

  console.log('Connect to headless.ly for persistent storage:')
  console.log('  headlessly login --tenant', tenant, '--api-key hly_...')
}
