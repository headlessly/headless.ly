import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const packages = resolve(__dirname, '..')

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@headlessly/crm': resolve(packages, 'crm/src/index.ts'),
      '@headlessly/billing': resolve(packages, 'billing/src/index.ts'),
      '@headlessly/projects': resolve(packages, 'projects/src/index.ts'),
      '@headlessly/content': resolve(packages, 'content/src/index.ts'),
      '@headlessly/support': resolve(packages, 'support/src/index.ts'),
      '@headlessly/analytics': resolve(packages, 'analytics/src/index.ts'),
      '@headlessly/marketing': resolve(packages, 'marketing/src/index.ts'),
      '@headlessly/experiments': resolve(packages, 'experiments/src/index.ts'),
      '@headlessly/platform': resolve(packages, 'platform/src/index.ts'),
    },
  },
})
