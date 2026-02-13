'use client'

/**
 * HeadlessAdmin — Full multi-entity Supabase-style database explorer.
 *
 * Renders all 35 (or a subset of) headless.ly entities in a sidebar + grid layout.
 * Must be wrapped in <HeadlesslyProvider> from @headlessly/react.
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

import { useState, useMemo, useCallback } from 'react'
import { getNounSchema } from 'digital-objects'
import {
  DatabaseSidebar,
  TableEditorToolbar,
  type DatabaseColumnDef,
  type FilterCondition,
} from '@mdxui/admin'
import { nounToSchemas, nounToColumns, domainForEntity } from './schema-bridge.js'
import { EntityGrid } from './entity-grid.js'

export interface HeadlessAdminProps {
  /** Subset of entity names to show (default: all registered nouns) */
  entities?: string[]
  /** Group entities by domain in sidebar (default: true) */
  groupByDomain?: boolean
  /** Default view mode */
  defaultView?: 'table' | 'query' | 'query-results'
  /** Default entity to select */
  defaultEntity?: string
  /** Callback when an entity row is clicked */
  onViewRow?: (noun: string, id: string, row: Record<string, unknown>) => void
  /** Callback when navigating to a related entity */
  onRelationshipNavigate?: (targetNoun: string, targetId: string) => void
  /** Whether inline editing is enabled */
  editable?: boolean
  /** Optional className */
  className?: string
}

export function HeadlessAdmin({
  entities,
  defaultView = 'table',
  defaultEntity,
  onViewRow,
  onRelationshipNavigate,
  editable = true,
  className,
}: HeadlessAdminProps) {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(defaultEntity ?? null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'query' | 'query-results'>(defaultView)
  const [filters, setFilters] = useState<FilterCondition[]>([])

  // Build sidebar schemas from all registered nouns
  const schemas = useMemo(() => nounToSchemas(entities), [entities])

  // Get columns for the selected entity
  const selectedSchema = selectedEntity ? getNounSchema(selectedEntity) : null
  const columns = useMemo(() => (selectedSchema ? nounToColumns(selectedSchema) : []), [selectedSchema])

  const handleSelectTable = useCallback((_schema: string, table: string) => {
    setSelectedEntity(table)
    setFilters([])
  }, [])

  const handleViewRow = useCallback(
    (id: string, row: Record<string, unknown>) => {
      if (selectedEntity) {
        onViewRow?.(selectedEntity, id, row)
      }
    },
    [selectedEntity, onViewRow],
  )

  const handleRelationshipNavigate = useCallback(
    (link: { targetTable: string; targetId: string }, _column: DatabaseColumnDef) => {
      if (onRelationshipNavigate) {
        onRelationshipNavigate(link.targetTable, link.targetId)
      } else {
        // Default: navigate to the target entity in the grid
        setSelectedEntity(link.targetTable)
      }
    },
    [onRelationshipNavigate],
  )

  const selectedDomain = selectedEntity ? domainForEntity(selectedEntity) : ''

  return (
    <div className={`flex h-full ${className ?? ''}`}>
      <DatabaseSidebar
        schemas={schemas}
        selectedTable={selectedEntity ? `${selectedDomain}.${selectedEntity}` : undefined}
        onSelectTable={handleSelectTable}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedEntity && selectedSchema && (
          <>
            <TableEditorToolbar
              schema={selectedDomain}
              tableName={selectedEntity}
              columns={columns}
              totalRowCount={0}
              sidebarCollapsed={sidebarCollapsed}
              onSidebarCollapsedChange={setSidebarCollapsed}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              filters={filters}
              onFiltersChange={setFilters}
            />
            <EntityGrid
              noun={selectedEntity}
              editable={editable}
              onViewRow={handleViewRow}
              onRelationshipNavigate={handleRelationshipNavigate}
            />
          </>
        )}
        {!selectedEntity && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select an entity from the sidebar
          </div>
        )}
      </div>
    </div>
  )
}
