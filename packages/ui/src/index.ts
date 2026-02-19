/**
 * @headlessly/ui — Schema-driven React CRUD components for headless.ly entities.
 *
 * Thin wiring layer: @mdxui/admin for rendering + @headlessly/react for data + digital-objects for schema.
 *
 * @example
 * ```tsx
 * import { HeadlesslyProvider } from '@headlessly/react'
 * import { HeadlessAdmin } from '@headlessly/ui'
 *
 * <HeadlesslyProvider tenant="acme" apiKey="hly_sk_xxx">
 *   <HeadlessAdmin />
 * </HeadlesslyProvider>
 * ```
 */

// Core components
export { HeadlessAdmin, type HeadlessAdminProps } from './headless-admin.js'
export { EntityGrid, type EntityGridProps } from './entity-grid.js'
export { EntityForm, type EntityFormProps } from './entity-form.js'
export { EntityDetail, type EntityDetailProps } from './entity-detail.js'

// Schema bridge (NounSchema → DatabaseColumnDef[])
export { nounToColumns, nounToSchemas, domainForEntity, getColumnsForNoun, domains } from './schema-bridge.js'

// Schema utilities (kept from original)
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
  type ColumnDef,
  type VerbAction,
} from './schema-utils.js'

// Re-export @mdxui/admin components for direct use
export {
  DatabaseGrid,
  DatabaseSidebar,
  TableEditorToolbar,
  type DatabaseGridProps,
  type DatabaseColumnDef,
  type ColumnDataType,
  type DatabaseSidebarProps,
  type DatabaseSchema,
  type DatabaseTable,
  type TableEditorToolbarProps,
  type FilterCondition,
  type RowHeightPreset,
} from '@mdxui/admin'

// Re-export @headlessly/react hooks (so users don't need both packages)
export {
  HeadlesslyProvider,
  useEntity,
  useEntities,
  useMutation,
  useVerb,
  useSearch,
  useCreate,
  useUpdate,
  useDelete,
  useRealtime,
  useEvents,
} from '@headlessly/react'

// Re-export digital-objects types for convenience
export type { NounSchema, NounInstance, VerbConjugation } from 'digital-objects'
export { getNounSchema, getAllNouns } from 'digital-objects'

// Re-export local type definitions (matching digital-objects internal types)
export type { ParsedProperty, FieldModifiers } from './schema-utils.js'
