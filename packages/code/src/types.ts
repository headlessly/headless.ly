/**
 * Type definitions for @headlessly/code
 */

/**
 * Configuration for creating a code execution client
 */
export interface CodeClientConfig {
  /** API key for authentication */
  apiKey?: string
  /** Base endpoint URL (default: https://code.headless.ly) */
  endpoint?: string
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number
}

/**
 * Options for creating a sandbox
 */
export interface CreateSandboxOptions {
  /** Custom sandbox ID (generated if not provided) */
  id?: string
  /** Timeout in seconds before sandbox auto-destroys */
  timeout?: number
  /** Environment variables to set in the sandbox */
  env?: Record<string, string>
}

/**
 * Sandbox metadata
 */
export interface SandboxInfo {
  id: string
  status: 'running' | 'stopped' | 'error'
  createdAt: string
  timeout?: number
}

/**
 * Options for command execution
 */
export interface ExecOptions {
  /** Working directory */
  cwd?: string
  /** Environment variables */
  env?: Record<string, string>
  /** Timeout in milliseconds */
  timeout?: number
  /** Standard input to pass to the command */
  stdin?: string
}

/**
 * Result from executing a command
 */
export interface ExecResult {
  success: boolean
  exitCode: number
  stdout: string
  stderr: string
  command: string
  duration: number
  timestamp: string
}

/**
 * SSE event types from streaming execution
 */
export type ExecEvent =
  | { type: 'start'; command: string; timestamp: string }
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'complete'; exitCode: number; duration: number }
  | { type: 'error'; message: string }

/**
 * Options for writing a file
 */
export interface WriteFileOptions {
  /** File permissions (e.g., '0755') */
  permissions?: string
  /** Encoding (default: 'utf-8') */
  encoding?: string
}

/**
 * Options for reading a file
 */
export interface ReadFileOptions {
  /** Encoding (default: 'utf-8') */
  encoding?: string
}

/**
 * File information from listing
 */
export interface FileInfo {
  name: string
  absolutePath: string
  type: 'file' | 'directory' | 'symlink'
  size: number
  modifiedAt: string
  permissions: string
}

/**
 * Options for running code
 */
export interface RunCodeOptions {
  /** Language (default: auto-detect or 'javascript') */
  language?: string
  /** Timeout in milliseconds */
  timeout?: number
  /** Environment variables */
  env?: Record<string, string>
}

/**
 * Result from code execution (code interpreter)
 */
export interface ExecutionResult {
  code: string
  language: string
  logs: string[]
  error?: string
  results: ExecutionOutput[]
  duration: number
}

/**
 * Individual output from code execution
 */
export interface ExecutionOutput {
  type: 'text' | 'image' | 'json' | 'html' | 'error'
  data: string
  mimeType?: string
}

/**
 * API response wrapper used by the worker
 */
export type ApiResponse<T = unknown> = { success: true; data: T; meta?: Record<string, unknown> } | { success: false; error: string }
