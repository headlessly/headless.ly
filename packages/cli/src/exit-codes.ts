/**
 * Exit codes and structured error output for CLI
 *
 * Distinct exit codes let AI agents programmatically detect failure categories.
 * Structured JSON errors provide machine-readable detail beyond stderr strings.
 */

export const ExitCode = {
  SUCCESS: 0,
  USAGE: 1,
  AUTH: 2,
  NOT_FOUND: 3,
  SERVER: 4,
} as const

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode]

export type ErrorCode = 'USAGE' | 'AUTH' | 'NOT_FOUND' | 'SERVER' | 'VALIDATION' | 'NETWORK'

export interface StructuredError {
  error: {
    code: ErrorCode
    message: string
    [key: string]: unknown
  }
}

export function formatErrorJSON(code: ErrorCode, message: string, details?: Record<string, unknown>): StructuredError {
  return {
    error: {
      code,
      message,
      ...details,
    },
  }
}
