import { beforeEach, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tempHome = mkdtempSync(join(tmpdir(), 'headlessly-cli-tests-'))
const originalHome = process.env.HOME
const originalConfigHome = process.env.XDG_CONFIG_HOME

process.env.HOME = tempHome
process.env.XDG_CONFIG_HOME = join(tempHome, '.config')

beforeEach(() => {
  delete process.env.HEADLESSLY_API_KEY
  delete process.env.HEADLESSLY_TOKEN
  delete process.env.HEADLESSLY_ENDPOINT
  delete process.env.HEADLESSLY_TENANT
  rmSync(join(tempHome, '.headlessly'), { recursive: true, force: true })
})

afterAll(() => {
  if (originalHome === undefined) {
    delete process.env.HOME
  } else {
    process.env.HOME = originalHome
  }

  if (originalConfigHome === undefined) {
    delete process.env.XDG_CONFIG_HOME
  } else {
    process.env.XDG_CONFIG_HOME = originalConfigHome
  }

  rmSync(tempHome, { recursive: true, force: true })
})
