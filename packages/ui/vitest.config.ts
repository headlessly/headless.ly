import { defineConfig, mergeConfig } from 'vitest/config'
import { resolve } from 'path'
import type { Plugin } from 'vite'
import sharedConfig from '../vitest.shared.ts'

const root = resolve(import.meta.dirname, '../../..')
const react19 = resolve(root, 'node_modules/.pnpm/react@19.2.4/node_modules/react')
const reactDom19 = resolve(root, 'node_modules/.pnpm/react-dom@19.2.4_react@19.2.4/node_modules/react-dom')

// Force ALL react/react-dom imports to a single React 19 copy.
// Without this, pnpm strict isolation causes @headlessly/react to resolve
// react@18 from its own tree while react-dom@19 is used for rendering.
function forceReact19(): Plugin {
  const map: Record<string, string> = {
    react: resolve(react19, 'index.js'),
    'react/jsx-runtime': resolve(react19, 'jsx-runtime.js'),
    'react/jsx-dev-runtime': resolve(react19, 'jsx-dev-runtime.js'),
    'react/compiler-runtime': resolve(react19, 'compiler-runtime.js'),
    'react-dom': resolve(reactDom19, 'index.js'),
    'react-dom/client': resolve(reactDom19, 'client.js'),
    'react-dom/test-utils': resolve(reactDom19, 'test-utils.js'),
  }
  return {
    name: 'force-react-19',
    enforce: 'pre',
    resolveId(source) {
      return map[source] ?? null
    },
  }
}

export default mergeConfig(
  sharedConfig,
  defineConfig({
    plugins: [forceReact19()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./test/setup.ts'],
      // Real @mdxui/admin + @mdxui/primitives barrel is large (90+ components).
      // Increase timeout so module-shape tests don't fail while loading.
      testTimeout: 30_000,
      // Inline all deps so the forceReact19 plugin catches react imports
      // from @headlessly/react and other transitive deps in node_modules.
      server: { deps: { inline: true } },
    },
    resolve: {
      alias: {
        // Resolve workspace packages to source (no dist/ built)
        '@mdxui/discovery': resolve(root, '.studio/ui/packages/discovery/src/index.ts'),
        '@mdxui/neo': resolve(root, '.studio/ui/packages/neo/src/index.ts'),
      },
    },
  }),
)
