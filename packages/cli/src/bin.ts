#!/usr/bin/env node
import { run } from './index.js'

// Register all 35 entity nouns before running commands
const sdk = '@headlessly/' + 'sdk'
await import(sdk).catch(() => {})

run(process.argv.slice(2))
