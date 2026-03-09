import { describe, it, expect } from 'vitest'
import { validateInput, validateData, ValidationError } from '../src/validate.js'

describe('validateInput', () => {
  it('accepts normal strings', () => {
    expect(() => validateInput('hello world')).not.toThrow()
    expect(() => validateInput('contact_fX9bL5nRd')).not.toThrow()
    expect(() => validateInput('Alice Smith')).not.toThrow()
    expect(() => validateInput('')).not.toThrow()
  })

  it('rejects null byte', () => {
    expect(() => validateInput('hello\x00world')).toThrow(ValidationError)
  })

  it('rejects bell character', () => {
    expect(() => validateInput('hello\x07world')).toThrow(ValidationError)
  })

  it('rejects escape character', () => {
    expect(() => validateInput('hello\x1Bworld')).toThrow(ValidationError)
  })

  it('allows tabs', () => {
    expect(() => validateInput('col1\tcol2')).not.toThrow()
  })

  it('allows newlines', () => {
    expect(() => validateInput('line1\nline2')).not.toThrow()
    expect(() => validateInput('line1\r\nline2')).not.toThrow()
  })

  it('rejects path traversal with ../', () => {
    expect(() => validateInput('../../etc/passwd')).toThrow(ValidationError)
    expect(() => validateInput('foo/../bar')).toThrow(ValidationError)
  })

  it('rejects path traversal with ..\\', () => {
    expect(() => validateInput('..\\windows\\system32')).toThrow(ValidationError)
  })

  it('allows single dots and ./', () => {
    expect(() => validateInput('.')).not.toThrow()
    expect(() => validateInput('./')).not.toThrow()
    expect(() => validateInput('file.txt')).not.toThrow()
  })

  it('rejects embedded query params in ID context', () => {
    expect(() => validateInput('contact_abc?fields=name', 'id')).toThrow(ValidationError)
  })

  it('rejects hash in ID context', () => {
    expect(() => validateInput('contact_abc#section', 'id')).toThrow(ValidationError)
  })

  it('allows query params in non-ID context', () => {
    expect(() => validateInput('contact_abc?fields=name')).not.toThrow()
    expect(() => validateInput('contact_abc?fields=name', 'data')).not.toThrow()
  })

  it('rejects percent-encoded sequences in ID context', () => {
    expect(() => validateInput('contact_%2F_abc', 'id')).toThrow(ValidationError)
  })

  it('allows percent-encoded sequences in non-ID context', () => {
    expect(() => validateInput('contact_%2F_abc')).not.toThrow()
  })
})

describe('validateData', () => {
  it('accepts valid data', () => {
    expect(() => validateData({ name: 'Alice', age: 30, active: true })).not.toThrow()
  })

  it('validates string values', () => {
    expect(() => validateData({ name: 'hello\x00world' })).toThrow(ValidationError)
  })

  it('validates string keys', () => {
    expect(() => validateData({ 'bad\x00key': 'value' })).toThrow(ValidationError)
  })

  it('skips non-string values', () => {
    expect(() => validateData({ count: 42, active: true, tags: null })).not.toThrow()
  })

  it('rejects path traversal in values', () => {
    expect(() => validateData({ path: '../../etc/passwd' })).toThrow(ValidationError)
  })
})

describe('ValidationError', () => {
  it('has name ValidationError', () => {
    const err = new ValidationError('test')
    expect(err.name).toBe('ValidationError')
    expect(err).toBeInstanceOf(Error)
  })
})
