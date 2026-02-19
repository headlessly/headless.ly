/**
 * schema-bridge — Converts NounSchema (digital-objects) to DatabaseColumnDef[] (@mdxui/admin).
 *
 * This is the key integration layer that bridges the two ecosystems:
 * - digital-objects: typed entity definitions via Noun()
 * - @mdxui/admin: Supabase-style database editor components
 */

import type { NounSchema } from 'digital-objects'
import type { ParsedProperty } from './schema-utils.js'
import { getNounSchema, getAllNouns } from 'digital-objects'
import type { DatabaseColumnDef, DatabaseSchema, DatabaseTable } from '@mdxui/admin'
import { formatLabel } from './schema-utils.js'

/**
 * Domain → Entity mapping for the 35 core entities.
 */
const DOMAIN_ENTITIES: Record<string, string[]> = {
  identity: ['User', 'ApiKey'],
  crm: ['Organization', 'Contact', 'Lead', 'Deal', 'Activity', 'Pipeline'],
  billing: ['Customer', 'Product', 'Plan', 'Price', 'Subscription', 'Invoice', 'Payment'],
  projects: ['Project', 'Issue', 'Comment'],
  content: ['Content', 'Asset', 'Site'],
  support: ['Ticket'],
  analytics: ['Event', 'Metric', 'Funnel', 'Goal'],
  marketing: ['Campaign', 'Segment', 'Form'],
  experiments: ['Experiment', 'FeatureFlag'],
  platform: ['Workflow', 'Integration', 'Agent'],
  communication: ['Message'],
}

/**
 * Reverse lookup: entity name → domain name.
 */
const ENTITY_TO_DOMAIN: Record<string, string> = {}
for (const [domain, entities] of Object.entries(DOMAIN_ENTITIES)) {
  for (const entity of entities) {
    ENTITY_TO_DOMAIN[entity] = domain
  }
}

/**
 * Map a digital-objects field type to an @mdxui/admin ColumnDataType.
 */
function fieldTypeToDataType(type: string | undefined): DatabaseColumnDef['dataType'] {
  switch (type?.toLowerCase()) {
    case 'string':
    case 'text':
    case 'markdown':
    case 'uuid':
    case 'ulid':
    case 'id':
      return 'text'
    case 'email':
      return 'email'
    case 'url':
      return 'url'
    case 'number':
    case 'int':
    case 'integer':
    case 'float':
    case 'double':
    case 'decimal':
      return 'number'
    case 'boolean':
    case 'bool':
      return 'boolean'
    case 'date':
    case 'datetime':
    case 'timestamp':
      return 'date'
    case 'json':
      return 'json'
    default:
      return 'text'
  }
}

/**
 * Convert a single ParsedProperty to a DatabaseColumnDef.
 */
function fieldToColumnDef(key: string, prop: ParsedProperty): DatabaseColumnDef {
  // Enum fields
  if (prop.enumValues && prop.enumValues.length > 0) {
    return {
      accessorKey: key,
      header: formatLabel(key),
      dataType: 'enum',
      enumValues: prop.enumValues,
      nullable: prop.modifiers?.optional ?? !prop.modifiers?.required,
      editable: true,
      sortable: true,
    }
  }

  const dataType = fieldTypeToDataType(prop.type)
  return {
    accessorKey: key,
    header: formatLabel(key),
    dataType,
    nullable: prop.modifiers?.optional ?? !prop.modifiers?.required,
    editable: true,
    sortable: true,
    isUnique: prop.modifiers?.unique ?? false,
  }
}

/**
 * Convert a relationship ParsedProperty to a DatabaseColumnDef.
 */
function relationshipToColumnDef(key: string, prop: ParsedProperty): DatabaseColumnDef {
  const isInbound = prop.operator === '<-'
  const isMany = prop.isArray ?? false

  return {
    accessorKey: key,
    header: formatLabel(key),
    dataType: 'relationship',
    targetTable: prop.targetType,
    relationshipType: isMany ? 'hasMany' : 'hasOne',
    relationshipDirection: isInbound ? 'inbound' : 'outbound',
    displayField: 'name',
    editable: !isInbound,
    sortable: false,
    nullable: true,
    isForeignKey: !isInbound,
    foreignKeyTable: prop.targetType,
  }
}

/**
 * Convert a NounSchema to an array of DatabaseColumnDef[].
 * Includes meta-columns ($id, $type, $createdAt, $updatedAt).
 */
export function nounToColumns(schema: NounSchema): DatabaseColumnDef[] {
  const columns: DatabaseColumnDef[] = []

  // $id — primary key
  columns.push({
    accessorKey: '$id',
    header: 'ID',
    dataType: 'text',
    isPrimaryKey: true,
    editable: false,
    sortable: true,
    nullable: false,
    isUnique: true,
  })

  // Schema-defined fields
  for (const [key, prop] of schema.fields) {
    columns.push(fieldToColumnDef(key, prop))
  }

  // Relationships
  for (const [key, prop] of schema.relationships) {
    columns.push(relationshipToColumnDef(key, prop))
  }

  // Meta columns at the end
  columns.push({
    accessorKey: '$createdAt',
    header: 'Created',
    dataType: 'date',
    editable: false,
    sortable: true,
    nullable: false,
  })

  columns.push({
    accessorKey: '$updatedAt',
    header: 'Updated',
    dataType: 'date',
    editable: false,
    sortable: true,
    nullable: false,
  })

  return columns
}

/**
 * Return the domain name for a given entity name.
 * Falls back to 'other' for unrecognized entities.
 */
export function domainForEntity(name: string): string {
  return ENTITY_TO_DOMAIN[name] ?? 'other'
}

/**
 * Build DatabaseSchema[] for the sidebar, grouping entities by domain.
 *
 * @param entities — optional subset of entity names to include (default: all registered)
 */
export function nounToSchemas(entities?: string[]): DatabaseSchema[] {
  const allNouns = getAllNouns()

  // Determine which entities to include
  const entitySet = entities ? new Set(entities) : null

  // Group by domain
  const domainMap = new Map<string, DatabaseTable[]>()

  for (const [name, schema] of allNouns) {
    if (entitySet && !entitySet.has(name)) continue

    const domain = domainForEntity(name)
    if (!domainMap.has(domain)) {
      domainMap.set(domain, [])
    }
    domainMap.get(domain)!.push({
      name: schema.name,
      rowCount: 0,
      schema: domain,
    })
  }

  // Convert to DatabaseSchema[], sorted by domain order
  const domainOrder = Object.keys(DOMAIN_ENTITIES)
  const schemas: DatabaseSchema[] = []

  for (const domain of domainOrder) {
    const tables = domainMap.get(domain)
    if (tables && tables.length > 0) {
      schemas.push({
        name: domain,
        tables: tables.sort((a, b) => a.name.localeCompare(b.name)),
      })
    }
  }

  // Catch any domains not in the predefined list
  for (const [domain, tables] of domainMap) {
    if (!domainOrder.includes(domain) && tables.length > 0) {
      schemas.push({ name: domain, tables })
    }
  }

  return schemas
}

/**
 * Get columns for a noun by name. Returns undefined if not found.
 */
export function getColumnsForNoun(nounName: string): DatabaseColumnDef[] | undefined {
  const schema = getNounSchema(nounName)
  if (!schema) return undefined
  return nounToColumns(schema)
}

/**
 * All domain names with their entity lists.
 */
export { DOMAIN_ENTITIES as domains }
