export class ValidationError extends Error {
  override name = 'ValidationError'

  constructor(message: string) {
    super(message)
  }
}

const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/
const PATH_TRAVERSAL_RE = /\.\.[/\\]/
const PERCENT_ENCODED_RE = /%[0-9A-Fa-f]{2}/

export function validateInput(value: string, context?: 'id' | 'data'): void {
  if (CONTROL_CHAR_RE.test(value)) {
    throw new ValidationError('Input contains disallowed control characters')
  }

  if (PATH_TRAVERSAL_RE.test(value)) {
    throw new ValidationError('Input contains path traversal sequence')
  }

  if (context === 'id') {
    if (value.includes('?') || value.includes('#')) {
      throw new ValidationError('ID must not contain query parameters or fragment identifiers')
    }
    if (PERCENT_ENCODED_RE.test(value)) {
      throw new ValidationError('ID must not contain percent-encoded sequences')
    }
  }
}

export function validateData(data: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(data)) {
    validateInput(key, 'data')
    if (typeof value === 'string') {
      validateInput(value, 'data')
    }
  }
}
