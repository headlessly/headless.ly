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

function resolveConfigDir(): string {
  return join(homedir(), '.headlessly')
}

function resolveConfigPath(): string {
  return join(resolveConfigDir(), 'config.json')
}

export async function loadConfig(): Promise<CLIConfig> {
  let config: CLIConfig = {}
  const configFile = resolveConfigPath()
  try {
    if (existsSync(configFile)) {
      const raw = await readFile(configFile, 'utf-8')
      config = JSON.parse(raw) as CLIConfig
    }
  } catch {
    // ignore
  }

  // Env vars override file config
  if (process.env.HEADLESSLY_API_KEY) {
    config.apiKey = process.env.HEADLESSLY_API_KEY
  } else if (process.env.HEADLESSLY_TOKEN) {
    config.apiKey = process.env.HEADLESSLY_TOKEN
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
  const configDir = resolveConfigDir()
  const configFile = resolveConfigPath()

  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true })
  }
  await writeFile(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

export function getConfigDir(): string {
  return resolveConfigDir()
}

export function getConfigPath(): string {
  return resolveConfigPath()
}
