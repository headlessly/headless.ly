/**
 * Code execution client for headless.ly platform
 *
 * Provides sandboxed code execution, file operations, and streaming
 * command execution via the code.headless.ly worker.
 */

import type {
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
  ApiResponse,
} from './types.js'
import { parseExecStream } from './stream.js'

export interface CodeClient {
  /** Create a new sandbox environment */
  createSandbox(options?: CreateSandboxOptions): Promise<SandboxInfo>
  /** Get sandbox info by ID */
  getSandbox(sandboxId: string): Promise<SandboxInfo | null>
  /** Destroy a sandbox */
  destroySandbox(sandboxId: string): Promise<void>
  /** Execute a command in a sandbox */
  exec(sandboxId: string, command: string, options?: ExecOptions): Promise<ExecResult>
  /** Execute a command with streaming output */
  execStream(sandboxId: string, command: string, options?: ExecOptions): Promise<AsyncIterable<ExecEvent>>
  /** Write a file in a sandbox */
  writeFile(sandboxId: string, path: string, content: string, options?: WriteFileOptions): Promise<void>
  /** Read a file from a sandbox */
  readFile(sandboxId: string, path: string, options?: ReadFileOptions): Promise<string>
  /** List files in a sandbox directory */
  listFiles(sandboxId: string, path: string): Promise<FileInfo[]>
  /** Check if a file exists in a sandbox */
  exists(sandboxId: string, path: string): Promise<boolean>
  /** Delete a file from a sandbox */
  deleteFile(sandboxId: string, path: string): Promise<void>
  /** Run code in a sandbox (code interpreter) */
  runCode(sandboxId: string, code: string, options?: RunCodeOptions): Promise<ExecutionResult>
  /** The configuration used to create this client */
  config: CodeClientConfig
}

/**
 * Create a code execution client
 *
 * @example
 * ```typescript
 * const code = createCodeClient({ apiKey: process.env.HEADLESSLY_API_KEY })
 *
 * const sandbox = await code.createSandbox()
 * const result = await code.exec(sandbox.id, 'echo hello')
 * console.log(result.stdout) // "hello\n"
 *
 * await code.destroySandbox(sandbox.id)
 * ```
 */
export function createCodeClient(config: CodeClientConfig = {}): CodeClient {
  const baseUrl = config.endpoint || 'https://code.headless.ly'

  const authHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }
    return headers
  }

  const request = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`${method} ${path} failed: ${response.status} ${text}`)
    }

    const data = (await response.json()) as ApiResponse<T>
    if (!data.success) {
      throw new Error((data as { success: false; error: string }).error)
    }
    return (data as { success: true; data: T }).data
  }

  return {
    async createSandbox(options?: CreateSandboxOptions): Promise<SandboxInfo> {
      return request<SandboxInfo>('POST', '/sandbox', options)
    },

    async getSandbox(sandboxId: string): Promise<SandboxInfo | null> {
      try {
        return await request<SandboxInfo>('GET', `/sandbox/${sandboxId}`)
      } catch {
        return null
      }
    },

    async destroySandbox(sandboxId: string): Promise<void> {
      await request<void>('DELETE', `/sandbox/${sandboxId}`)
    },

    async exec(sandboxId: string, command: string, options?: ExecOptions): Promise<ExecResult> {
      return request<ExecResult>('POST', '/exec', { sandboxId, command, ...options })
    },

    async execStream(sandboxId: string, command: string, options?: ExecOptions): Promise<AsyncIterable<ExecEvent>> {
      const response = await fetch(`${baseUrl}/exec/stream`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ sandboxId, command, ...options }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`POST /exec/stream failed: ${response.status} ${text}`)
      }

      return parseExecStream(response)
    },

    async writeFile(sandboxId: string, path: string, content: string, options?: WriteFileOptions): Promise<void> {
      await request<void>('POST', '/files/write', { sandboxId, path, content, ...options })
    },

    async readFile(sandboxId: string, path: string, options?: ReadFileOptions): Promise<string> {
      const result = await request<{ content: string }>('POST', '/files/read', { sandboxId, path, ...options })
      return result.content
    },

    async listFiles(sandboxId: string, path: string): Promise<FileInfo[]> {
      const result = await request<{ files: FileInfo[] } | FileInfo[]>('POST', '/files/list', { sandboxId, path })
      // The sandbox SDK wraps the result in { files: [...] }
      if (Array.isArray(result)) return result
      return (result as { files: FileInfo[] }).files ?? []
    },

    async exists(sandboxId: string, path: string): Promise<boolean> {
      try {
        const result = await request<{ exists: boolean }>('POST', '/files/exists', { sandboxId, path })
        return result.exists
      } catch {
        return false
      }
    },

    async deleteFile(sandboxId: string, path: string): Promise<void> {
      await request<void>('POST', '/files/delete', { sandboxId, path })
    },

    async runCode(sandboxId: string, code: string, options?: RunCodeOptions): Promise<ExecutionResult> {
      return request<ExecutionResult>('POST', '/code/run', { sandboxId, code, ...options })
    },

    config,
  }
}
