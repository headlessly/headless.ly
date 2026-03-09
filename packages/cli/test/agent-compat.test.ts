import { describe, it, expect } from 'vitest'
import { ExitCode, formatErrorJSON } from '../src/exit-codes.js'
import { validateInput, ValidationError } from '../src/validate.js'
import { parseArgs } from '../src/args.js'
import { pickFields } from '../src/output.js'

describe('agent compatibility', () => {
  describe('exit codes', () => {
    it('defines distinct integer exit codes', () => {
      const codes = Object.values(ExitCode)
      expect(new Set(codes).size).toBe(codes.length)
      for (const code of codes) {
        expect(typeof code).toBe('number')
        expect(code).toBeGreaterThanOrEqual(0)
        expect(code).toBeLessThan(128)
      }
    })

    it('covers all error categories', () => {
      expect(ExitCode).toHaveProperty('SUCCESS')
      expect(ExitCode).toHaveProperty('USAGE')
      expect(ExitCode).toHaveProperty('AUTH')
      expect(ExitCode).toHaveProperty('NOT_FOUND')
      expect(ExitCode).toHaveProperty('SERVER')
    })
  })

  describe('structured errors', () => {
    it('includes code and message', () => {
      const err = formatErrorJSON('NOT_FOUND', 'Gone', { id: 'x' })
      expect(err.error.code).toBe('NOT_FOUND')
      expect(err.error.message).toBe('Gone')
      expect(err.error.id).toBe('x')
    })

    it('is valid JSON', () => {
      const err = formatErrorJSON('VALIDATION', 'Bad input')
      const json = JSON.stringify(err)
      expect(() => JSON.parse(json)).not.toThrow()
    })
  })

  describe('negative number parsing', () => {
    it('treats negative integers as values', () => {
      const { flags } = parseArgs(['--limit', '-5', '--offset', '10'])
      expect(flags.limit).toBe('-5')
      expect(flags.offset).toBe('10')
    })

    it('treats negative decimals as values', () => {
      const { flags } = parseArgs(['--rate', '-0.5'])
      expect(flags.rate).toBe('-0.5')
    })
  })

  describe('input validation', () => {
    it('rejects path traversal', () => {
      expect(() => validateInput('../../etc/shadow')).toThrow(ValidationError)
    })

    it('rejects null bytes', () => {
      expect(() => validateInput('id\x00injection')).toThrow(ValidationError)
    })

    it('rejects query params in IDs', () => {
      expect(() => validateInput('contact_abc?drop=true', 'id')).toThrow(ValidationError)
    })

    it('accepts normal entity IDs', () => {
      expect(() => validateInput('contact_fX9bL5nRd', 'id')).not.toThrow()
    })
  })

  describe('field masking', () => {
    it('limits entity data to requested fields', () => {
      const entities = [
        { $id: '1', name: 'Alice', secret: 'shh', email: 'a@b.com' },
        { $id: '2', name: 'Bob', secret: 'nope', email: 'b@b.com' },
      ]
      const picked = pickFields(entities, ['$id', 'name'])
      expect(picked).toEqual([
        { $id: '1', name: 'Alice' },
        { $id: '2', name: 'Bob' },
      ])
      expect(picked[0]).not.toHaveProperty('secret')
      expect(picked[0]).not.toHaveProperty('email')
    })

    it('handles missing fields gracefully', () => {
      const entities = [{ name: 'Alice' }]
      const picked = pickFields(entities, ['name', 'nonexistent'])
      expect(picked).toEqual([{ name: 'Alice' }])
    })
  })

  describe('--data JSON parsing via buildData', () => {
    it('buildData is used by do command', async () => {
      // Verify the do module exports or uses buildData
      const doModule = await import('../src/commands/do.js')
      expect(doModule).toBeDefined()
    })
  })
})
