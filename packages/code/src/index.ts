/**
 * @headlessly/code
 *
 * Code execution client SDK for the headless.ly platform.
 * Provides sandboxed Linux environments for AI agent code execution.
 *
 * @example
 * ```typescript
 * import { createCodeClient } from '@headlessly/code'
 *
 * const code = createCodeClient({ apiKey: 'xxx' })
 *
 * // Create a sandbox
 * const sandbox = await code.createSandbox()
 *
 * // Execute commands
 * const result = await code.exec(sandbox.id, 'echo hello world')
 * console.log(result.stdout) // "hello world\n"
 *
 * // Stream command output
 * for await (const event of await code.execStream(sandbox.id, 'npm install')) {
 *   if (event.type === 'stdout') process.stdout.write(event.data)
 *   if (event.type === 'stderr') process.stderr.write(event.data)
 * }
 *
 * // File operations
 * await code.writeFile(sandbox.id, '/app/index.js', 'console.log("hi")')
 * const content = await code.readFile(sandbox.id, '/app/index.js')
 *
 * // Code interpreter
 * const output = await code.runCode(sandbox.id, 'print(1 + 1)', { language: 'python' })
 *
 * // Clean up
 * await code.destroySandbox(sandbox.id)
 * ```
 */

export { createCodeClient } from './client.js'
export { parseExecStream } from './stream.js'

export type { CodeClient } from './client.js'

export type {
  CodeClientConfig,
  CreateSandboxOptions,
  SandboxInfo,
  ExecOptions,
  ExecResult,
  ExecEvent,
  WriteFileOptions,
  ReadFileOptions,
  FileInfo,
  RunCodeOptions,
  ExecutionResult,
  ExecutionOutput,
  ApiResponse,
} from './types.js'
