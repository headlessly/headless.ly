/**
 * @headlessly/ui — Schema-driven React CRUD components for headless.ly entities.
 *
 * Components read from NounSchema to auto-generate tables, forms, detail views,
 * timelines, dashboards, search bars, verb buttons, and relationship graphs.
 *
 * @example
 * ```tsx
 * import { HeadlessUIProvider, EntityTable, EntityForm, Dashboard } from '@headlessly/ui'
 * import { Noun } from 'digital-objects'
 *
 * const Contact = Noun('Contact', {
 *   name: 'string!',
 *   email: 'string?#',
 *   stage: 'Lead | Qualified | Customer',
 * })
 *
 * function App() {
 *   return (
 *     <HeadlessUIProvider config={{ baseUrl: 'https://db.headless.ly' }}>
 *       <EntityTable noun='Contact' />
 *     </HeadlessUIProvider>
 *   )
 * }
 * ```
 */

// Provider
export { HeadlessUIProvider, useHeadlessUI, type HeadlessUIProviderProps, type HeadlessUIContextValue } from './provider.js'

// Components
export { EntityTable, type EntityTableProps } from './entity-table.js'
export { EntityForm, type EntityFormProps } from './entity-form.js'
export { EntityDetail, type EntityDetailProps } from './entity-detail.js'
export { EntityTimeline, type EntityTimelineProps } from './entity-timeline.js'
export { Dashboard, type DashboardProps } from './dashboard.js'
export { SearchBar, type SearchBarProps } from './search-bar.js'
export { VerbButton, type VerbButtonProps } from './verb-button.js'
export { RelationshipGraph, type RelationshipGraphProps } from './relationship-graph.js'

// Hooks
export { useEntity, type UseEntityOptions, type UseEntityResult } from './hooks/use-entity.js'
export { useEntities, type UseEntitiesOptions, type UseEntitiesResult } from './hooks/use-entities.js'
export { useSearch, type UseSearchOptions, type UseSearchResult, type SearchResult } from './hooks/use-search.js'
export { useRealtime, type UseRealtimeOptions, type UseRealtimeResult } from './hooks/use-realtime.js'

// Schema utilities
export {
  deriveColumns,
  deriveFormFields,
  deriveVerbs,
  deriveAllVerbs,
  deriveFilterableColumns,
  deriveSortableColumns,
  deriveEntityTitle,
  validateFormData,
  columnsByKind,
  deriveVerbsByCategory,
  deriveRelationships,
  schemaFieldCount,
  deriveDefaultValues,
  fieldToQueryOperator,
  fieldInputType,
  isRequired,
  formatLabel,
  formatCellValue,
} from './schema-utils.js'

// Types
export type {
  HeadlessUIConfig,
  PaginatedResult,
  SortDirection,
  SortState,
  FieldFilter,
  EntityQuery,
  EntityEvent,
  DashboardCard,
  DashboardLayout,
  ColumnDef,
  StylableProps,
  VerbAction,
  GraphNode,
  GraphEdge,
} from './types.js'

// Re-export NounSchema types for convenience
export type { NounSchema, ParsedProperty, VerbConjugation, NounInstance, FieldModifiers } from './types.js'
