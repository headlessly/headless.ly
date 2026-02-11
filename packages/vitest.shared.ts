import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const packages = resolve(import.meta.dirname, '.')
const root = resolve(packages, '../..')

/**
 * Shared vitest config for all @headlessly/* packages.
 *
 * Provides alias resolution so tests can import domain packages
 * by name without building first (resolves to src/index.ts).
 */
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      // Foundation — resolve to local source (npm version may be stale)
      'digital-objects': resolve(root, '.org.ai/primitives/packages/digital-objects/src/index.ts'),
      // Domain packages
      '@headlessly/crm': resolve(packages, 'crm/src/index.ts'),
      '@headlessly/billing': resolve(packages, 'billing/src/index.ts'),
      '@headlessly/projects': resolve(packages, 'projects/src/index.ts'),
      '@headlessly/content': resolve(packages, 'content/src/index.ts'),
      '@headlessly/support': resolve(packages, 'support/src/index.ts'),
      '@headlessly/analytics': resolve(packages, 'analytics/src/index.ts'),
      '@headlessly/marketing': resolve(packages, 'marketing/src/index.ts'),
      '@headlessly/experiments': resolve(packages, 'experiments/src/index.ts'),
      '@headlessly/platform': resolve(packages, 'platform/src/index.ts'),
      // SDK
      '@headlessly/sdk': resolve(packages, 'sdk/src/index.ts'),
      // Infrastructure
      '@headlessly/objects': resolve(packages, 'objects/src/index.ts'),
      '@headlessly/events': resolve(packages, 'events/src/index.ts'),
      '@headlessly/mcp': resolve(packages, 'mcp/src/index.ts'),
      '@headlessly/rpc': resolve(packages, 'rpc/src/index.ts'),
      // Client SDKs
      '@headlessly/js': resolve(packages, 'js/src/index.ts'),
      '@headlessly/node': resolve(packages, 'node/src/index.ts'),
      '@headlessly/react': resolve(packages, 'react/src/index.tsx'),
      '@headlessly/ui': resolve(packages, 'ui/src/index.ts'),
      // Specialized
      '@headlessly/cli': resolve(packages, 'cli/src/index.ts'),
      '@headlessly/code': resolve(packages, 'code/src/index.ts'),
      // External npm dependencies resolved through the monorepo
      'rpc.do/errors': resolve(root, 'public/packages/sdk/node_modules/rpc.do/dist/errors.js'),
      'rpc.do/transports': resolve(root, 'public/packages/sdk/node_modules/rpc.do/dist/transports.js'),
      'rpc.do/auth': resolve(root, 'public/packages/sdk/node_modules/rpc.do/dist/auth.js'),
      'rpc.do': resolve(root, 'public/packages/sdk/node_modules/rpc.do/dist/index.js'),
    },
  },
})
