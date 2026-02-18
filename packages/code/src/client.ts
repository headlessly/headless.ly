/**
 * Claude Code client SDK for headless.ly
 *
 * Session-oriented API: code.repo('org', 'name') returns a session handle
 * for running tasks, streaming output, inspecting diffs, and connecting terminals.
 *
 * Three interaction modes via the same session object:
 *   - One-shot:       session.run('Fix the bug')
 *   - Agent/streaming: session.stream('Add tests')
 *   - Session/resume:  session.run('Refactor', { resume: true })
 */

import type { CodeClientConfig, RunOptions, RunResult, SandboxStatus, StreamEvent, ApiResponse } from './types.js'

/**
 * A session handle for a specific GitHub repo sandbox.
 *
 * The sandbox persists between calls — same org/repo/branch always hits the
 * same container. Claude Code's session files persist in the container.
 */
export interface RepoSession {
  /** GitHub org */
  readonly org: string
  /** GitHub repo name */
  readonly repo: string
  /** Git branch */
  readonly branch: string

  /** Run a Claude Code task and wait for completion */
  run(task: string, options?: Omit<RunOptions, 'task'>): Promise<RunResult>

  /** Run a Claude Code task with streaming SSE output */
  stream(task: string, options?: Omit<RunOptions, 'task'>): AsyncIterable<StreamEvent>

  /** Get the current git diff from the sandbox */
  diff(): Promise<string>

  /** Get sandbox status */
  status(): Promise<SandboxStatus>

  /** Get the WebSocket URL for terminal connection (SandboxAddon-compatible) */
  terminalWsUrl(): string

  /** Destroy the sandbox and free resources */
  destroy(): Promise<void>
}

/**
 * Claude Code client
 */
export interface CodeClient {
  /** Get a session handle for a GitHub repo (lazy — no API call) */
  repo(org: string, name: string, branch?: string): RepoSession
  /** The configuration used to create this client */
  config: CodeClientConfig
}

/**
 * Create a Claude Code client
 *
 * @example
 * ```typescript
 * import { createCodeClient } from '@headlessly/code'
 *
 * const code = createCodeClient({ apiKey: process.env.HEADLESSLY_API_KEY })
 * const session = code.repo('acme', 'app')
 *
 * // One-shot
 * const result = await session.run('Fix the login bug')
 * console.log(result.diff)
 *
 * // Stream (agent-oriented)
 * for await (const event of session.stream('Add comprehensive tests')) {
 *   if (event.type === 'diff') console.log(event.diff)
 * }
 *
 * // Resume conversation
 * const r2 = await session.run('Now refactor the auth module', { resume: true })
 *
 * // Inspect workspace
 * const currentDiff = await session.diff()
 *
 * // Terminal — connect with @cloudflare/sandbox/xterm SandboxAddon
 * const wsUrl = session.terminalWsUrl()
 *
 * // Cleanup
 * await session.destroy()
 * ```
 */
export function createCodeClient(config: CodeClientConfig = {}): CodeClient {
  const baseUrl = (config.endpoint || 'https://code.headless.ly').replace(/\/$/, '')
  const timeout = config.timeout ?? 300000

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
      signal: timeout ? AbortSignal.timeout(timeout) : undefined,
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
    repo(org: string, name: string, branch = 'main'): RepoSession {
      const repoPath = `/${org}/${name}/${branch}`

      return {
        org,
        repo: name,
        branch,

        async run(task: string, options?: Omit<RunOptions, 'task'>): Promise<RunResult> {
          if (!task) throw new Error('task is required')
          return request<RunResult>('POST', repoPath, { task, ...options })
        },

        stream(task: string, options?: Omit<RunOptions, 'task'>): AsyncIterable<StreamEvent> {
          if (!task) throw new Error('task is required')

          // Return an async iterable that streams SSE events
          const url = `${baseUrl}${repoPath}`
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          }
          if (config.apiKey) {
            headers['Authorization'] = `Bearer ${config.apiKey}`
          }

          return {
            [Symbol.asyncIterator](): AsyncIterableIterator<StreamEvent> {
              let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
              const decoder = new TextDecoder()
              let buffer = ''
              let done = false

              const init = async () => {
                const response = await fetch(url, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({ task, ...options }),
                  signal: timeout ? AbortSignal.timeout(timeout) : undefined,
                })

                if (!response.ok) {
                  const text = await response.text()
                  throw new Error(`POST ${repoPath} stream failed: ${response.status} ${text}`)
                }

                if (!response.body) {
                  throw new Error('Response body is null')
                }

                reader = response.body.getReader()
              }

              return {
                [Symbol.asyncIterator]() {
                  return this
                },

                async next(): Promise<IteratorResult<StreamEvent>> {
                  if (done) return { done: true, value: undefined }

                  if (!reader) await init()

                  while (true) {
                    // Check buffer for complete SSE events
                    const eventEnd = buffer.indexOf('\n\n')
                    if (eventEnd !== -1) {
                      const eventStr = buffer.slice(0, eventEnd)
                      buffer = buffer.slice(eventEnd + 2)

                      // Parse SSE data line
                      for (const line of eventStr.split('\n')) {
                        if (line.startsWith('data: ')) {
                          const data = line.slice(6)
                          try {
                            const event = JSON.parse(data) as StreamEvent
                            if (event.type === 'done') {
                              done = true
                              reader?.releaseLock()
                              return { done: true, value: undefined }
                            }
                            return { done: false, value: event }
                          } catch {
                            return { done: false, value: { type: 'raw', data } }
                          }
                        }
                      }
                      continue
                    }

                    // Read more data
                    const { done: streamDone, value } = await reader!.read()
                    if (streamDone) {
                      done = true
                      reader?.releaseLock()
                      return { done: true, value: undefined }
                    }
                    buffer += decoder.decode(value, { stream: true })
                  }
                },

                async return(): Promise<IteratorResult<StreamEvent>> {
                  done = true
                  reader?.releaseLock()
                  return { done: true, value: undefined }
                },

                async throw(): Promise<IteratorResult<StreamEvent>> {
                  done = true
                  reader?.releaseLock()
                  return { done: true, value: undefined }
                },
              }
            },
          }
        },

        async diff(): Promise<string> {
          const result = await request<{ diff: string }>('GET', `${repoPath}/diff`)
          return result.diff
        },

        async status(): Promise<SandboxStatus> {
          return request<SandboxStatus>('GET', repoPath)
        },

        terminalWsUrl(): string {
          const wsBase = baseUrl.replace(/^http/, 'ws')
          return `${wsBase}/ws/${org}/${name}/${branch}`
        },

        async destroy(): Promise<void> {
          await request<{ id: string; destroyed: boolean }>('DELETE', repoPath)
        },
      }
    },

    config,
  }
}
