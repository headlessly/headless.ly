/**
 * CLI configuration
 *
 * Stores tenant credentials and settings in ~/.headlessly/config.json
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

export interface CLIConfig {
  tenant?: string
  apiKey?: string
  endpoint?: string
  mode?: 'memory' | 'local' | 'remote'
}

const CONFIG_DIR = join(homedir(), '.headlessly')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

export async function loadConfig(): Promise<CLIConfig> {
  let config: CLIConfig = {}
  try {
    if (existsSync(CONFIG_FILE)) {
      const raw = await readFile(CONFIG_FILE, 'utf-8')
      config = JSON.parse(raw) as CLIConfig
    }
  } catch {
    // ignore
  }

  // Env vars override file config
  if (process.env.HEADLESSLY_API_KEY) {
    config.apiKey = process.env.HEADLESSLY_API_KEY
  }
  if (process.env.HEADLESSLY_ENDPOINT) {
    config.endpoint = process.env.HEADLESSLY_ENDPOINT
  }
  if (process.env.HEADLESSLY_TENANT) {
    config.tenant = process.env.HEADLESSLY_TENANT
  }

  return config
}

export async function saveConfig(config: CLIConfig): Promise<void> {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true })
  }
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

export function getConfigDir(): string {
  return CONFIG_DIR
}

export function getConfigPath(): string {
  return CONFIG_FILE
}
