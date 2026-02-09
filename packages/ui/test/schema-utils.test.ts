import { describe, it, expect, beforeEach } from 'vitest'
import { clearRegistry, Noun } from 'digital-objects'
import { deriveColumns, deriveFormFields, deriveVerbs, formatLabel, formatCellValue } from '../src/schema-utils'

describe('@headlessly/ui — schema-utils', () => {
  beforeEach(() => {
    clearRegistry()
  })

  describe('deriveColumns', () => {
    it('derives columns from a noun schema', () => {
      const Contact = Noun('Contact', {
        name: 'string!',
        email: 'string',
        stage: 'Lead | Qualified',
      })
      const columns = deriveColumns(Contact.$schema)
      expect(columns).toBeDefined()
      expect(Array.isArray(columns)).toBe(true)
      expect(columns.length).toBeGreaterThan(0)
    })

    it('includes data fields but not meta-fields', () => {
      const Contact = Noun('TestContact', {
        name: 'string!',
        email: 'string',
      })
      const columns = deriveColumns(Contact.$schema)
      const keys = columns.map((c: any) => c.key || c.field || c.name)
      expect(keys).toContain('name')
      expect(keys).toContain('email')
    })
  })

  describe('deriveFormFields', () => {
    it('derives form fields from a noun schema', () => {
      const Entity = Noun('FormEntity', {
        name: 'string!',
        description: 'string',
        priority: 'Low | Medium | High',
      })
      const fields = deriveFormFields(Entity.$schema)
      expect(fields).toBeDefined()
      expect(Array.isArray(fields)).toBe(true)
    })
  })

  describe('deriveVerbs', () => {
    it('extracts custom verbs (excludes CRUD)', () => {
      const Entity = Noun('VerbEntity', {
        name: 'string!',
        status: 'Draft | Published',
        publish: 'Published',
        archive: 'Archived',
      })
      const verbs = deriveVerbs(Entity.$schema)
      expect(verbs).toBeDefined()
      expect(Array.isArray(verbs)).toBe(true)
      const verbNames = verbs.map((v: any) => v.action || v.name || v)
      expect(verbNames).toContain('publish')
      expect(verbNames).toContain('archive')
      // Should not include CRUD verbs
      expect(verbNames).not.toContain('create')
      expect(verbNames).not.toContain('update')
      expect(verbNames).not.toContain('delete')
    })
  })

  describe('formatLabel', () => {
    it('converts camelCase to title case', () => {
      expect(formatLabel('firstName')).toBe('First Name')
    })

    it('converts simple field names', () => {
      expect(formatLabel('email')).toBe('Email')
    })
  })

  describe('formatCellValue', () => {
    it('returns string representation of value', () => {
      expect(formatCellValue('hello')).toBe('hello')
    })

    it('handles null/undefined', () => {
      expect(formatCellValue(null)).toBe('\u2014')
      expect(formatCellValue(undefined)).toBe('\u2014')
    })

    it('handles numbers', () => {
      expect(formatCellValue(42)).toBe('42')
    })
  })
})
