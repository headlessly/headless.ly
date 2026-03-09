import { describe, it, expect } from 'vitest'
import { ExitCode, formatErrorJSON } from '../src/exit-codes.js'

describe('ExitCode', () => {
  it('has distinct integer values', () => {
    const values = Object.values(ExitCode)
    expect(values.every((v) => Number.isInteger(v))).toBe(true)
    expect(new Set(values).size).toBe(values.length)
  })

  it('maps SUCCESS to 0', () => {
    expect(ExitCode.SUCCESS).toBe(0)
  })

  it('maps USAGE to 1', () => {
    expect(ExitCode.USAGE).toBe(1)
  })

  it('maps AUTH to 2', () => {
    expect(ExitCode.AUTH).toBe(2)
  })

  it('maps NOT_FOUND to 3', () => {
    expect(ExitCode.NOT_FOUND).toBe(3)
  })

  it('maps SERVER to 4', () => {
    expect(ExitCode.SERVER).toBe(4)
  })
})

describe('formatErrorJSON', () => {
  it('returns structured error with code and message', () => {
    const result = formatErrorJSON('AUTH', 'Not authenticated')
    expect(result).toEqual({
      error: {
        code: 'AUTH',
        message: 'Not authenticated',
      },
    })
  })

  it('includes additional details when provided', () => {
    const result = formatErrorJSON('VALIDATION', 'Invalid field', { field: 'name', expected: 'string' })
    expect(result).toEqual({
      error: {
        code: 'VALIDATION',
        message: 'Invalid field',
        field: 'name',
        expected: 'string',
      },
    })
  })

  it('works without details', () => {
    const result = formatErrorJSON('NETWORK', 'Connection refused')
    expect(result).toEqual({
      error: {
        code: 'NETWORK',
        message: 'Connection refused',
      },
    })
  })
})
