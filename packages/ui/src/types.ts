/**
 * @headlessly/ui — UI-specific types for schema-driven CRUD components.
 *
 * These types bridge between the NounSchema from digital-objects
 * and the React component props used throughout the package.
 */

import type { NounSchema, VerbConjugation, NounInstance } from 'digital-objects'

// Re-export from digital-objects
export type { NounSchema, VerbConjugation, NounInstance }

/**
 * Field modifier flags parsed from type strings.
 * Mirrors digital-objects/noun-types.ts FieldModifiers but defined
 * locally since it is not re-exported from the barrel.
 */
export interface FieldModifiers {
  required: boolean
  optional: boolean
  indexed: boolean
  unique: boolean
  array: boolean
}

/**
 * Parsed property result.
 * Mirrors digital-objects/noun-types.ts ParsedProperty but defined
 * locally since it is not re-exported from the barrel.
 */
export interface ParsedProperty {
  name: string
  kind: 'field' | 'relationship' | 'enum' | 'verb' | 'disabled'
  type?: string | undefined
  modifiers?: FieldModifiers | undefined
  defaultValue?: string | undefined
  enumValues?: string[] | undefined
  operator?: string | undefined
  targetType?: string | undefined
  backref?: string | undefined
  isArray?: boolean | undefined
  verbAction?: string | undefined
  verbConjugation?: VerbConjugation | undefined
}

/**
 * Configuration for connecting to the headless.ly backend.
 * Passed to HeadlessUIProvider.
 */
export interface HeadlessUIConfig {
  /** Base URL for the headless.ly API (e.g. https://db.headless.ly) */
  baseUrl: string
  /** Tenant context (e.g. https://headless.ly/~acme) */
  context?: string
  /** API key or bearer token */
  apiKey?: string
  /** WebSocket URL for realtime updates (e.g. wss://db.headless.ly/ws) */
  wsUrl?: string
}

/**
 * Paginated result from entity queries.
 */
export interface PaginatedResult<T> {
  items: T[]
  total?: number
  hasMore: boolean
  nextCursor?: string
}

/**
 * Sort direction for table columns.
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Column sort state.
 */
export interface SortState {
  field: string
  direction: SortDirection
}

/**
 * Filter applied to a field.
 */
export interface FieldFilter {
  field: string
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'regex' | 'exists'
  value: unknown
}

/**
 * Query parameters for entity list fetches.
 */
export interface EntityQuery {
  filter?: Record<string, unknown>
  sort?: Record<string, 1 | -1>
  limit?: number
  offset?: number
  cursor?: string
}

/**
 * Entity event from the event stream / timeline.
 */
export interface EntityEvent {
  id: string
  entityId: string
  entityType: string
  verb: string
  actor?: string
  timestamp: string
  data?: Record<string, unknown>
  diff?: Record<string, { from: unknown; to: unknown }>
}

/**
 * Dashboard card configuration for a single entity type.
 */
export interface DashboardCard {
  noun: string
  title?: string
  limit?: number
}

/**
 * Layout preset for dashboards.
 */
export type DashboardLayout = '2x2' | '3x1' | '1x3' | '2x1' | '1x2' | 'auto'

/**
 * Column definition derived from schema fields.
 * Used by EntityTable to render columns.
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
 * Props that all UI components accept for styling.
 */
export interface StylableProps {
  className?: string
  style?: React.CSSProperties
}

/**
 * Verb action that can be performed on an entity.
 * Used by VerbButton.
 */
export interface VerbAction {
  name: string
  label: string
  conjugation: VerbConjugation
  disabled?: boolean
}

/**
 * Relationship node for the graph visualization.
 */
export interface GraphNode {
  id: string
  type: string
  label: string
  data?: Record<string, unknown>
}

/**
 * Relationship edge for the graph visualization.
 */
export interface GraphEdge {
  source: string
  target: string
  label: string
  type: 'forward' | 'backward'
}
