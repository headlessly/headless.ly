import { resolve } from 'path'

const packages = resolve(import.meta.dirname, '.')
const root = resolve(packages, '../..')

/**
 * Shared E2E vitest config for @headlessly/* packages.
 *
 * Run from any package that has vitest installed:
 *   cd packages/crm && npx vitest run --config ../vitest.e2e.config.ts
 *
 * Or run all at once via:
 *   pnpm -r --filter './public/packages/*' run test:e2e
 */
export default {
  resolve: {
    alias: {
      'digital-objects': resolve(root, '.org.ai/primitives/packages/digital-objects/src/index.ts'),
      '@headlessly/crm': resolve(packages, 'crm/src/index.ts'),
      '@headlessly/billing': resolve(packages, 'billing/src/index.ts'),
      '@headlessly/projects': resolve(packages, 'projects/src/index.ts'),
      '@headlessly/content': resolve(packages, 'content/src/index.ts'),
      '@headlessly/support': resolve(packages, 'support/src/index.ts'),
      '@headlessly/analytics': resolve(packages, 'analytics/src/index.ts'),
      '@headlessly/marketing': resolve(packages, 'marketing/src/index.ts'),
      '@headlessly/experiments': resolve(packages, 'experiments/src/index.ts'),
      '@headlessly/platform': resolve(packages, 'platform/src/index.ts'),
      '@headlessly/sdk': resolve(packages, 'sdk/src/index.ts'),
      '@headlessly/objects': resolve(packages, 'objects/src/index.ts'),
      '@headlessly/events': resolve(packages, 'events/src/index.ts'),
      '@headlessly/mcp': resolve(packages, 'mcp/src/index.ts'),
      '@headlessly/rpc': resolve(packages, 'rpc/src/index.ts'),
      '@headlessly/js': resolve(packages, 'js/src/index.ts'),
      '@headlessly/node': resolve(packages, 'node/src/index.ts'),
      '@headlessly/code': resolve(packages, 'code/src/index.ts'),
      '@headlessly/cli': resolve(packages, 'cli/src/index.ts'),
      'rpc.do/errors': resolve(packages, 'sdk/node_modules/rpc.do/dist/errors.js'),
      'rpc.do/transports': resolve(packages, 'sdk/node_modules/rpc.do/dist/transports.js'),
      'rpc.do/auth': resolve(packages, 'sdk/node_modules/rpc.do/dist/auth.js'),
      'rpc.do': resolve(packages, 'sdk/node_modules/rpc.do/dist/index.js'),
    },
  },
  test: {
    include: ['test-e2e/**/*.e2e.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    environment: 'node',
    reporters: ['verbose'],
    retry: 1,
    sequence: { concurrent: false },
  },
}
