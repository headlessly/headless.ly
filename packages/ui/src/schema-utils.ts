/**
 * schema-utils — Utilities for deriving UI metadata from NounSchema.
 *
 * Bridges the gap between the raw NounSchema (fields as Maps)
 * and the column/field definitions the UI components need.
 */

import type { NounSchema, ParsedProperty, VerbConjugation, ColumnDef, VerbAction } from './types.js'

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
 * Format a camelCase or PascalCase key into a human-readable label.
 * e.g., 'firstName' -> 'First Name', '$createdAt' -> 'Created At'
 */
export function formatLabel(key: string): string {
  const clean = key.startsWith('$') ? key.slice(1) : key
  return clean
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()
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

  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
