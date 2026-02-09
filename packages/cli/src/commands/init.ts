/**
 * headlessly init [--template b2b|b2c|b2d|b2a] [--tenant name]
 *
 * Initialize a new headless.ly organization
 */

import { parseArgs } from '../args.js'
import { loadConfig, saveConfig } from '../config.js'
import { printSuccess, printError } from '../output.js'
import { getProvider } from '../provider.js'

const TEMPLATES = ['b2b', 'b2c', 'b2d', 'b2a'] as const

const TEMPLATE_SEEDS: Record<string, Array<{ type: string; data: Record<string, unknown> }>> = {
  b2b: [
    { type: 'Contact', data: { name: 'Example Customer', stage: 'Lead' } },
    { type: 'Company', data: { name: 'Acme Corp' } },
    { type: 'Deal', data: { title: 'Enterprise Deal', stage: 'Open' } },
  ],
  b2c: [
    { type: 'Contact', data: { name: 'Example User', stage: 'Lead' } },
    { type: 'Product', data: { name: 'Starter Plan' } },
  ],
  b2d: [
    { type: 'Contact', data: { name: 'Developer', stage: 'Lead' } },
    { type: 'Project', data: { name: 'SDK Integration' } },
  ],
  b2a: [
    { type: 'Contact', data: { name: 'Agent', stage: 'Lead' } },
    { type: 'Workflow', data: { name: 'Onboarding Flow' } },
  ],
}

export async function initCommand(args: string[]): Promise<void> {
  const { flags } = parseArgs(args)

  // Per-command --help
  if (flags['help'] === true) {
    console.log('headlessly init — Initialize a new organization')
    console.log('')
    console.log('Usage: headlessly init [options]')
    console.log('')
    console.log('Options:')
    console.log('  --template b2b|b2c|b2d|b2a   Use a business model template')
    console.log('  --tenant name                 Organization name (default: "default")')
    console.log('  --dry-run                     Preview changes without writing config')
    return
  }

  const tenant = (flags['tenant'] as string) || 'default'
  const template = flags['template'] as string | undefined
  const dryRun = flags['dry-run'] === true

  if (template && !TEMPLATES.includes(template as (typeof TEMPLATES)[number])) {
    printError(`Unknown template: ${template}`)
    console.log(`Available templates: ${TEMPLATES.join(', ')}`)
    process.exit(1)
    return
  }

  if (dryRun) {
    console.log('Dry run preview:')
    console.log(`  Tenant:   ${tenant}`)
    console.log(`  Mode:     memory`)
    if (template) {
      console.log(`  Template: ${template}`)
      const seeds = TEMPLATE_SEEDS[template]
      if (seeds) {
        console.log(`  Entities: ${seeds.length} starter entities would be created`)
      }
    }
    return
  }

  // Save tenant config
  const config = await loadConfig()
  config.tenant = tenant
  config.mode = 'memory'
  await saveConfig(config)

  // Scaffold template entities if specified
  if (template) {
    const seeds = TEMPLATE_SEEDS[template]
    if (seeds) {
      try {
        const provider = await getProvider()
        for (const seed of seeds) {
          await provider.create(seed.type, seed.data)
        }
      } catch {
        // Silently continue — seeding is best-effort
      }
    }
  }

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
