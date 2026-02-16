/**
 * @headlessly/code
 *
 * Claude Code client SDK for the headless.ly platform.
 * Run Claude Code against any GitHub repo via sandboxed containers.
 *
 * @example
 * ```typescript
 * import { createCodeClient } from '@headlessly/code'
 *
 * const code = createCodeClient({ apiKey: 'xxx' })
 * const session = code.repo('acme', 'app')
 *
 * // One-shot — run a task and get the diff
 * const result = await session.run('Fix the login bug')
 * console.log(result.diff)
 *
 * // Streaming — observe Claude Code in real-time
 * for await (const event of session.stream('Add comprehensive tests')) {
 *   if (event.type === 'diff') console.log(event.diff)
 * }
 *
 * // Resume — continue the conversation
 * const r2 = await session.run('Refactor the auth module', { resume: true })
 *
 * // Terminal — connect via xterm + SandboxAddon
 * // import { SandboxAddon } from '@cloudflare/sandbox/xterm'
 * const wsUrl = session.terminalWsUrl()
 * // terminal.loadAddon(new SandboxAddon({ getWebSocketUrl: () => wsUrl }))
 *
 * // Cleanup
 * await session.destroy()
 * ```
 */

export { createCodeClient } from './client.js'

export type { CodeClient, RepoSession } from './client.js'

export type { CodeClientConfig, RunOptions, RunResult, SandboxStatus, StreamEvent, ApiResponse } from './types.js'
