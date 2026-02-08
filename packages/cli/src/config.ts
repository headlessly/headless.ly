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
  try {
    if (!existsSync(CONFIG_FILE)) return {}
    const raw = await readFile(CONFIG_FILE, 'utf-8')
    return JSON.parse(raw) as CLIConfig
  } catch {
    return {}
  }
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
