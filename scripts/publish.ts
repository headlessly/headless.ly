#!/usr/bin/env npx tsx
/**
 * Smart publish script for @headlessly/* packages.
 *
 * 1. Discovers all publishable packages in packages/
 * 2. Checks npm registry for already-published versions
 * 3. Replaces workspace:* with actual versions
 * 4. Publishes via npm with web auth (TouchID)
 * 5. Restores original package.json files
 *
 * Usage:
 *   pnpm publish-packages              # publish all unpublished
 *   pnpm publish-packages -- --dry-run # preview what would be published
 *   pnpm publish-packages -- mcp cli   # publish specific packages only
 */

import { execSync, spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const packagesDir = join(rootDir, 'packages')

interface PackageJson {
  name: string
  version: string
  private?: boolean
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function getPackageDirs(): string[] {
  return readdirSync(packagesDir)
    .filter((name) => {
      const pkgPath = join(packagesDir, name)
      const pkgJsonPath = join(pkgPath, 'package.json')
      try {
        return statSync(pkgPath).isDirectory() && statSync(pkgJsonPath).isFile()
      } catch {
        return false
      }
    })
    .map((name) => join(packagesDir, name))
}

function readPackageJson(pkgDir: string): PackageJson {
  return JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf-8'))
}

function writePackageJson(pkgDir: string, pkg: PackageJson): void {
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
}

function isPublished(name: string, version: string): boolean {
  try {
    execSync(`npm view "${name}@${version}" version`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function getNpmVersion(name: string): string | null {
  try {
    return execSync(`npm view "${name}" version`, { stdio: 'pipe' }).toString().trim()
  } catch {
    return null
  }
}

function replaceWorkspaceProtocol(deps: Record<string, string> | undefined, versionMap: Map<string, string>): Record<string, string> | undefined {
  if (!deps) return deps

  const result: Record<string, string> = {}
  for (const [name, version] of Object.entries(deps)) {
    if (version.startsWith('workspace:')) {
      let actualVersion = versionMap.get(name)
      // Workspace dep might be outside public/ (e.g. digital-objects) — check npm
      if (!actualVersion) {
        actualVersion = getNpmVersion(name) ?? undefined
      }
      if (!actualVersion) {
        throw new Error(`Could not find version for workspace dependency: ${name} (not in local packages or npm)`)
      }
      const prefix = version.replace('workspace:', '').replace('*', '')
      result[name] = prefix + actualVersion
    } else {
      result[name] = version
    }
  }
  return result
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filterPackages = args.filter((a) => !a.startsWith('--'))

  const dirs = getPackageDirs()
  const versionMap = new Map<string, string>()
  const originalContents = new Map<string, string>()
  const toPublish: { dir: string; name: string; version: string }[] = []

  // First pass: collect versions and check what needs publishing
  console.log('Checking which packages need publishing...\n')

  for (const dir of dirs) {
    const pkg = readPackageJson(dir)
    versionMap.set(pkg.name, pkg.version)

    if (pkg.private) {
      console.log(`  skip  ${pkg.name} (private)`)
      continue
    }

    // Filter to specific packages if requested
    if (filterPackages.length > 0) {
      const dirName = dir.split('/').pop()!
      const matches = filterPackages.some((f) => pkg.name === f || pkg.name === `@headlessly/${f}` || dirName === f)
      if (!matches) continue
    }

    if (isPublished(pkg.name, pkg.version)) {
      console.log(`  done  ${pkg.name}@${pkg.version} (already published)`)
    } else {
      console.log(`  new   ${pkg.name}@${pkg.version}`)
      toPublish.push({ dir, name: pkg.name, version: pkg.version })
    }
  }

  if (toPublish.length === 0) {
    console.log('\nAll packages are already published!')
    return
  }

  if (dryRun) {
    console.log(`\nDry run: would publish ${toPublish.length} package(s):`)
    for (const { name, version } of toPublish) {
      console.log(`  - ${name}@${version}`)
    }
    return
  }

  // Save original package.json contents and replace workspace:*
  console.log('\nPreparing packages for publish...')

  for (const { dir } of toPublish) {
    const pkgJsonPath = join(dir, 'package.json')
    originalContents.set(pkgJsonPath, readFileSync(pkgJsonPath, 'utf-8'))

    const pkg = readPackageJson(dir)
    pkg.dependencies = replaceWorkspaceProtocol(pkg.dependencies, versionMap)
    pkg.devDependencies = replaceWorkspaceProtocol(pkg.devDependencies, versionMap)
    pkg.peerDependencies = replaceWorkspaceProtocol(pkg.peerDependencies, versionMap)
    writePackageJson(dir, pkg)
  }

  console.log(`\nPublishing ${toPublish.length} package(s)...\n`)

  let failed = false
  for (const { dir, name, version } of toPublish) {
    console.log(`Publishing ${name}@${version}...`)
    const result = spawnSync('npm', ['publish', '--access', 'public'], {
      cwd: dir,
      stdio: 'inherit',
    })

    if (result.status !== 0) {
      console.error(`FAILED ${name}@${version}`)
      failed = true
      break
    }
    console.log(`Published ${name}@${version}`)
  }

  // Restore original package.json files
  console.log('\nRestoring package.json files...')
  for (const [path, content] of originalContents) {
    writeFileSync(path, content)
  }

  if (failed) {
    process.exit(1)
  }

  console.log(`\nAll ${toPublish.length} packages published!`)
}

main()
