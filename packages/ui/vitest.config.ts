import { defineConfig, mergeConfig } from 'vitest/config'
import { resolve } from 'path'
import sharedConfig from '../vitest.shared.ts'

const mockDir = resolve(import.meta.dirname, 'test/__mocks__')

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./test/setup.ts'],
    },
    resolve: {
      alias: {
        // Mock @mdxui/admin to avoid transitive dependency issues in vitest.
        // @mdxui/admin source pulls in @mdxui/primitives, @mdxui/discovery,
        // mermaid, shiki, and other packages that crash in jsdom.
        // This is a VIEW layer mock — data hooks use real implementations.
        '@mdxui/admin': resolve(mockDir, 'mdxui-admin.tsx'),
      },
    },
  }),
)
