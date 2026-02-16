/**
 * Type definitions for @headlessly/code
 *
 * Claude Code sandbox client SDK.
 */

/**
 * Configuration for creating a Claude Code client
 */
export interface CodeClientConfig {
  /** API key for authentication */
  apiKey?: string
  /** Base endpoint URL (default: https://code.headless.ly) */
  endpoint?: string
  /** Request timeout in milliseconds (default: 300000 — 5 min for Claude Code tasks) */
  timeout?: number
}

/**
 * Options for running a Claude Code task
 */
export interface RunOptions {
  /** The task/prompt to send to Claude Code */
  task: string
  /** Optional system prompt to append */
  systemPrompt?: string
  /** Resume the most recent Claude Code conversation */
  resume?: boolean
  /** Resume a specific Claude Code session by ID */
  sessionId?: string
  /** Max agentic turns */
  maxTurns?: number
  /** Max spend in USD */
  maxBudget?: number
}

/**
 * Result from a Claude Code task run
 */
export interface RunResult {
  /** Combined stdout + stderr logs from Claude Code */
  logs: string
  /** Git diff of changes made */
  diff: string
  /** Duration in milliseconds */
  duration: number
  /** Sandbox identifier (org/repo/branch) */
  sandbox: string
  /** Claude Code session ID for resuming */
  sessionId?: string
}

/**
 * Sandbox status info
 */
export interface SandboxStatus {
  id: string
  org: string
  repo: string
  branch: string
  status: string
  createdAt: string
}

/**
 * A streaming event from Claude Code execution
 */
export interface StreamEvent {
  type: string
  [key: string]: unknown
}

/**
 * API response wrapper used by the worker
 */
export type ApiResponse<T = unknown> = { success: true; data: T; meta?: Record<string, unknown> } | { success: false; error: string }
