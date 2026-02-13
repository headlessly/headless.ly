/**
 * schema-utils — Utilities for deriving UI metadata from NounSchema.
 *
 * Bridges the gap between the raw NounSchema (fields as Maps)
 * and the column/field definitions the UI components need.
 */

import type { NounSchema, ParsedProperty, VerbConjugation, FieldModifiers } from 'digital-objects'

/**
 * Column definition derived from schema fields.
 * Used by EntityTable and other list components.
 */
export interface ColumnDef {
  key: string
  label: string
  kind: 'field' | 'relationship' | 'meta'
  type?: string
  sortable: boolean
  filterable: boolean
  enumValues?: string[]
  modifiers?: FieldModifiers
}

/**
 * Verb action that can be performed on an entity.
 */
export interface VerbAction {
  name: string
  label: string
  conjugation: VerbConjugation
  disabled?: boolean
}

/**
 * Meta-field keys that exist on every entity.
 */
const META_FIELDS = ['$id', '$type', '$context', '$version', '$createdAt', '$updatedAt'] as const

/**
 * Derive table columns from a NounSchema.
 * Includes schema fields plus selected meta-fields.
 */
export function deriveColumns(schema: NounSchema): ColumnDef[] {
  const columns: ColumnDef[] = []

  // Add $id column
  columns.push({
    key: '$id',
    label: 'ID',
    kind: 'meta',
    type: 'string',
    sortable: true,
    filterable: false,
  })

  // Add schema-defined fields
  for (const [key, prop] of schema.fields) {
    columns.push(fieldToColumn(key, prop))
  }

  // Add relationship columns
  for (const [key, prop] of schema.relationships) {
    columns.push({
      key,
      label: formatLabel(key),
      kind: 'relationship',
      type: prop.targetType,
      sortable: false,
      filterable: false,
    })
  }

  // Add meta columns at the end
  columns.push({
    key: '$createdAt',
    label: 'Created',
    kind: 'meta',
    type: 'datetime',
    sortable: true,
    filterable: false,
  })

  columns.push({
    key: '$updatedAt',
    label: 'Updated',
    kind: 'meta',
    type: 'datetime',
    sortable: true,
    filterable: false,
  })

  return columns
}

/**
 * Convert a ParsedProperty to a ColumnDef.
 */
function fieldToColumn(key: string, prop: ParsedProperty): ColumnDef {
  const col: ColumnDef = {
    key,
    label: formatLabel(key),
    kind: 'field',
    type: prop.type,
    sortable: true,
    filterable: true,
    modifiers: prop.modifiers,
  }

  // Enum fields get their values for dropdown filters
  if (prop.enumValues && prop.enumValues.length > 0) {
    col.enumValues = prop.enumValues
  }

  return col
}

/**
 * Derive form fields from a NounSchema (only data fields, not meta or disabled).
 */
export function deriveFormFields(schema: NounSchema): ParsedProperty[] {
  const fields: ParsedProperty[] = []
  for (const [, prop] of schema.fields) {
    fields.push(prop)
  }
  return fields
}

/**
 * Derive available verb actions from a NounSchema.
 * Excludes standard CRUD verbs (those are handled by the form/buttons).
 */
export function deriveVerbs(schema: NounSchema): VerbAction[] {
  const actions: VerbAction[] = []
  const standardVerbs = new Set(['create', 'get', 'update', 'delete', 'find'])

  for (const [name, conjugation] of schema.verbs) {
    if (standardVerbs.has(name)) continue
    if (schema.disabledVerbs.has(name)) continue
    actions.push({
      name,
      label: formatLabel(name),
      conjugation,
    })
  }

  return actions
}

/**
 * Derive all verb actions including CRUD verbs.
 */
export function deriveAllVerbs(schema: NounSchema): VerbAction[] {
  const actions: VerbAction[] = []

  for (const [name, conjugation] of schema.verbs) {
    if (schema.disabledVerbs.has(name)) continue
    actions.push({
      name,
      label: formatLabel(name),
      conjugation,
      disabled: false,
    })
  }

  return actions
}

/**
 * Derive only filterable columns from a NounSchema.
 */
export function deriveFilterableColumns(schema: NounSchema): ColumnDef[] {
  return deriveColumns(schema).filter((c) => c.filterable)
}

/**
 * Derive only sortable columns from a NounSchema.
 */
export function deriveSortableColumns(schema: NounSchema): ColumnDef[] {
  return deriveColumns(schema).filter((c) => c.sortable)
}

/**
 * Pick a display title for an entity: name > title > $id.
 */
export function deriveEntityTitle(schema: NounSchema, entity: Record<string, unknown>): string {
  if (schema.fields.has('name') && entity.name != null) return String(entity.name)
  if (schema.fields.has('title') && entity.title != null) return String(entity.title)
  return String(entity.$id ?? '')
}

/**
 * Validate form data against a NounSchema.
 * Returns an object mapping field names to error strings (empty if valid).
 */
export function validateFormData(schema: NounSchema, data: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {}

  for (const [key, prop] of schema.fields) {
    // Check required
    if (prop.modifiers?.required && (data[key] === undefined || data[key] === null || data[key] === '')) {
      errors[key] = `${formatLabel(key)} is required`
    }

    // Check enum values
    if (prop.enumValues && prop.enumValues.length > 0 && data[key] !== undefined && data[key] !== null && data[key] !== '') {
      if (!prop.enumValues.includes(String(data[key]))) {
        errors[key] = `${formatLabel(key)} must be one of: ${prop.enumValues.join(', ')}`
      }
    }
  }

  return errors
}

/**
 * Group columns by kind (meta, field, relationship).
 */
export function columnsByKind(schema: NounSchema): { meta: ColumnDef[]; field: ColumnDef[]; relationship: ColumnDef[] } {
  const columns = deriveColumns(schema)
  return {
    meta: columns.filter((c) => c.kind === 'meta'),
    field: columns.filter((c) => c.kind === 'field'),
    relationship: columns.filter((c) => c.kind === 'relationship'),
  }
}

/**
 * Group verbs into crud and custom categories.
 */
export function deriveVerbsByCategory(schema: NounSchema): { crud: VerbAction[]; custom: VerbAction[] } {
  const standardVerbs = new Set(['create', 'get', 'update', 'delete', 'find'])
  const allVerbs = deriveAllVerbs(schema)
  return {
    crud: allVerbs.filter((v) => standardVerbs.has(v.name)),
    custom: allVerbs.filter((v) => !standardVerbs.has(v.name)),
  }
}

/**
 * Extract relationship metadata from a NounSchema.
 */
export function deriveRelationships(schema: NounSchema): Array<{ key: string; targetType: string; direction: string }> {
  const rels: Array<{ key: string; targetType: string; direction: string }> = []
  for (const [key, prop] of schema.relationships) {
    rels.push({
      key,
      targetType: prop.targetType ?? '',
      direction: prop.operator === '<-' ? 'backward' : 'forward',
    })
  }
  return rels
}

/**
 * Count fields, relationships, and verbs in a schema.
 */
export function schemaFieldCount(schema: NounSchema): { fields: number; relationships: number; verbs: number } {
  return {
    fields: schema.fields.size,
    relationships: schema.relationships.size,
    verbs: schema.verbs.size,
  }
}

/**
 * Derive default form values from a NounSchema.
 */
export function deriveDefaultValues(schema: NounSchema): Record<string, unknown> {
  const defaults: Record<string, unknown> = {}
  for (const [key, prop] of schema.fields) {
    if (prop.enumValues && prop.enumValues.length > 0) {
      defaults[key] = prop.enumValues[0]
    } else {
      const type = prop.type?.toLowerCase() ?? 'string'
      switch (type) {
        case 'int':
        case 'integer':
        case 'float':
        case 'double':
        case 'decimal':
        case 'number':
          defaults[key] = 0
          break
        case 'bool':
        case 'boolean':
          defaults[key] = false
          break
        default:
          defaults[key] = ''
      }
    }
  }
  return defaults
}

/**
 * Map a field's type to the best MongoDB query operator.
 */
export function fieldToQueryOperator(prop: ParsedProperty): string {
  if (prop.kind === 'enum' || (prop.enumValues && prop.enumValues.length > 0)) return '$in'

  const type = prop.type?.toLowerCase() ?? 'string'
  switch (type) {
    case 'string':
    case 'text':
      return '$regex'
    case 'int':
    case 'integer':
    case 'float':
    case 'double':
    case 'decimal':
    case 'number':
    case 'bool':
    case 'boolean':
      return '$eq'
    default:
      return '$eq'
  }
}

/**
 * Get the input type for an HTML form field based on the property type.
 */
export function fieldInputType(prop: ParsedProperty): string {
  const type = prop.type?.toLowerCase() ?? 'string'

  if (prop.enumValues && prop.enumValues.length > 0) return 'select'

  switch (type) {
    case 'string':
    case 'text':
      return 'text'
    case 'int':
    case 'integer':
    case 'float':
    case 'double':
    case 'decimal':
    case 'number':
      return 'number'
    case 'bool':
    case 'boolean':
      return 'checkbox'
    case 'date':
      return 'date'
    case 'datetime':
    case 'timestamp':
      return 'datetime-local'
    case 'email':
      return 'email'
    case 'url':
      return 'url'
    case 'textarea':
      return 'textarea'
    case 'password':
      return 'password'
    case 'tel':
    case 'phone':
      return 'tel'
    default:
      return 'text'
  }
}

/**
 * Check if a property is required based on its modifiers.
 */
export function isRequired(prop: ParsedProperty): boolean {
  return prop.modifiers?.required ?? false
}

/**
 * Known acronyms that should be fully uppercased.
 */
const ACRONYMS = new Set(['id', 'url', 'api', 'html', 'css', 'json', 'xml', 'http', 'https', 'sql', 'ip'])

/**
 * Format a camelCase, PascalCase, or snake_case key into a human-readable label.
 * e.g., 'firstName' -> 'First Name', '$createdAt' -> 'Created At', '$id' -> 'ID'
 */
export function formatLabel(key: string): string {
  const clean = key.startsWith('$') ? key.slice(1) : key

  // Split on underscores first (snake_case), then on camelCase boundaries
  const words = clean
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(/\s+/)

  return words
    .map((w) => {
      const lower = w.toLowerCase()
      if (ACRONYMS.has(lower)) return lower.toUpperCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

/**
 * Format a value for display in a table cell.
 */
export function formatCellValue(value: unknown, type?: string): string {
  if (value === null || value === undefined) return '\u2014'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'

  if (type === 'datetime' || type === 'timestamp' || type === 'date') {
    const d = new Date(value as string | number)
    if (!isNaN(d.getTime())) {
      return type === 'date' ? d.toLocaleDateString() : d.toLocaleString()
    }
  }

  if (type === 'currency' && typeof value === 'number') {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  }

  if (type === 'percent' && typeof value === 'number') {
    return `${Math.round(value * 100)}%`
  }

  if (type === 'count' && Array.isArray(value)) {
    return String(value.length)
  }

  if (typeof value === 'object') return JSON.stringify(value)

  if (type === 'string' || type === undefined) {
    const str = String(value)
    if (str.length > 100) return str.slice(0, 100) + '...'
    return str
  }

  return String(value)
}
