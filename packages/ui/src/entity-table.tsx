/**
 * EntityTable — Sortable, filterable entity list table.
 *
 * Reads a NounSchema to auto-generate columns.
 * Supports sort, filter by enum or text, pagination, row click, and bulk actions.
 *
 * @example
 * ```tsx
 * import { EntityTable } from '@headlessly/ui'
 *
 * <EntityTable
 *   noun='Contact'
 *   onRowClick={(entity) => navigate(`/contacts/${entity.$id}`)}
 * />
 * ```
 */

import React, { useState, useCallback, useMemo } from 'react'
import { getNounSchema } from 'digital-objects'
import { useEntities } from './hooks/use-entities.js'
import { deriveColumns, formatCellValue, formatLabel } from './schema-utils.js'
import { tableStyles, buttonStyles, formStyles } from './styles.js'
import type { NounInstance, SortState, ColumnDef, StylableProps, NounSchema } from './types.js'

export interface EntityTableProps extends StylableProps {
  /** The noun name (e.g. 'Contact', 'Deal') */
  noun: string
  /** Alternatively, pass the schema directly instead of looking it up from the registry */
  schema?: NounSchema
  /** Default filter applied to queries */
  defaultFilter?: Record<string, unknown>
  /** Number of rows per page (default: 25) */
  pageSize?: number
  /** Columns to show (by key). If omitted, all columns are shown */
  columns?: string[]
  /** Columns to hide */
  hideColumns?: string[]
  /** Called when a row is clicked */
  onRowClick?: (entity: NounInstance) => void
  /** Called when bulk action is triggered. Receives selected entity IDs. */
  onBulkAction?: (verb: string, ids: string[]) => void
  /** Custom cell renderer */
  renderCell?: (key: string, value: unknown, entity: NounInstance, column: ColumnDef) => React.ReactNode
  /** Whether to show the filter bar (default: true) */
  showFilters?: boolean
  /** Whether to enable row selection checkboxes (default: false) */
  selectable?: boolean
}

export function EntityTable({
  noun,
  schema: schemaProp,
  defaultFilter,
  pageSize = 25,
  columns: visibleColumns,
  hideColumns,
  onRowClick,
  onBulkAction,
  renderCell,
  showFilters = true,
  selectable = false,
  className,
  style,
}: EntityTableProps) {
  const schema = schemaProp ?? getNounSchema(noun)
  const [sort, setSort] = useState<SortState | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  // Build query from current state
  const queryFilter = useMemo(() => {
    const f: Record<string, unknown> = { ...defaultFilter }
    for (const [field, value] of Object.entries(filters)) {
      if (value) {
        f[field] = { $regex: value }
      }
    }
    return f
  }, [defaultFilter, filters])

  const querySort = useMemo(() => {
    if (!sort) return undefined
    return { [sort.field]: sort.direction === 'asc' ? 1 : -1 } as Record<string, 1 | -1>
  }, [sort])

  const { entities, loading, error, total, hasMore, loadMore, refetch } = useEntities(noun, {
    filter: Object.keys(queryFilter).length > 0 ? queryFilter : undefined,
    sort: querySort,
    limit: pageSize,
    offset: page * pageSize,
  })

  // Derive columns from schema
  const allColumns = useMemo<ColumnDef[]>(() => {
    if (!schema) return []
    return deriveColumns(schema)
  }, [schema])

  const displayColumns = useMemo(() => {
    let cols = allColumns
    if (visibleColumns) {
      cols = cols.filter((c) => visibleColumns.includes(c.key))
    }
    if (hideColumns) {
      cols = cols.filter((c) => !hideColumns.includes(c.key))
    }
    return cols
  }, [allColumns, visibleColumns, hideColumns])

  const handleSort = useCallback((field: string) => {
    setSort((prev) => {
      if (prev?.field === field) {
        return prev.direction === 'asc' ? { field, direction: 'desc' } : null
      }
      return { field, direction: 'asc' }
    })
  }, [])

  const handleFilterChange = useCallback((field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(0)
  }, [])

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(entities.map((e) => e.$id)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [entities],
  )

  const handleSelectRow = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const sortIndicator = (field: string) => {
    if (sort?.field !== field) return ' '
    return sort.direction === 'asc' ? ' \u2191' : ' \u2193'
  }

  if (!schema) {
    return (
      <div style={{ ...tableStyles.wrapper, ...(style ?? {}) }} className={className}>
        <p style={{ color: 'var(--hly-text-muted, #6b7280)', padding: '16px' }}>Unknown noun: {noun}. Register it with Noun() first.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...tableStyles.wrapper, ...(style ?? {}) }} className={className}>
        <p style={{ color: 'var(--hly-danger, #dc2626)', padding: '16px' }}>
          Error loading {noun}: {error.message}
        </p>
        <button style={{ ...buttonStyles.base, ...buttonStyles.secondary, margin: '0 16px 16px' }} onClick={() => refetch()}>
          Retry
        </button>
      </div>
    )
  }

  const totalPages = total ? Math.ceil(total / pageSize) : undefined

  return (
    <div style={{ ...tableStyles.wrapper, ...(style ?? {}) }} className={className} data-testid='entity-table'>
      {/* Filters */}
      {showFilters && (
        <div style={{ display: 'flex', gap: '8px', padding: '8px 0', flexWrap: 'wrap' }} data-testid='entity-table-filters'>
          {displayColumns
            .filter((c) => c.filterable)
            .map((col) =>
              col.enumValues ? (
                <select
                  key={col.key}
                  style={formStyles.select}
                  value={filters[col.key] ?? ''}
                  onChange={(e) => handleFilterChange(col.key, e.target.value)}
                  aria-label={`Filter by ${col.label}`}
                >
                  <option value=''>All {col.label}</option>
                  {col.enumValues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  key={col.key}
                  type='text'
                  placeholder={`Filter ${col.label}...`}
                  style={{ ...formStyles.input, maxWidth: '180px' }}
                  value={filters[col.key] ?? ''}
                  onChange={(e) => handleFilterChange(col.key, e.target.value)}
                  aria-label={`Filter by ${col.label}`}
                />
              ),
            )}
        </div>
      )}

      {/* Bulk actions */}
      {selectable && selectedIds.size > 0 && onBulkAction && (
        <div style={{ display: 'flex', gap: '8px', padding: '8px 0', alignItems: 'center' }} data-testid='bulk-actions'>
          <span style={{ fontSize: '13px', color: 'var(--hly-text-muted, #6b7280)' }}>{selectedIds.size} selected</span>
          <button style={{ ...buttonStyles.base, ...buttonStyles.danger }} onClick={() => onBulkAction('delete', [...selectedIds])}>
            Delete
          </button>
        </div>
      )}

      {/* Table */}
      <table style={tableStyles.table}>
        <thead style={tableStyles.thead}>
          <tr>
            {selectable && (
              <th style={{ ...tableStyles.th, width: '40px' }}>
                <input
                  type='checkbox'
                  checked={entities.length > 0 && selectedIds.size === entities.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label='Select all'
                />
              </th>
            )}
            {displayColumns.map((col) => (
              <th
                key={col.key}
                style={tableStyles.th}
                onClick={() => col.sortable && handleSort(col.key)}
                aria-sort={sort?.field === col.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                {col.label}
                {col.sortable && sortIndicator(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && entities.length === 0 ? (
            <tr>
              <td
                colSpan={displayColumns.length + (selectable ? 1 : 0)}
                style={{ ...tableStyles.td, textAlign: 'center', color: 'var(--hly-text-muted, #6b7280)' }}
              >
                Loading...
              </td>
            </tr>
          ) : entities.length === 0 ? (
            <tr>
              <td
                colSpan={displayColumns.length + (selectable ? 1 : 0)}
                style={{ ...tableStyles.td, textAlign: 'center', color: 'var(--hly-text-muted, #6b7280)' }}
              >
                No {schema.plural ?? noun} found
              </td>
            </tr>
          ) : (
            entities.map((entity) => (
              <tr
                key={entity.$id}
                style={{
                  ...tableStyles.tr,
                  ...(hoveredRow === entity.$id ? tableStyles.trHover : {}),
                }}
                onClick={() => onRowClick?.(entity)}
                onMouseEnter={() => setHoveredRow(entity.$id)}
                onMouseLeave={() => setHoveredRow(null)}
                data-testid={`entity-row-${entity.$id}`}
              >
                {selectable && (
                  <td style={tableStyles.td}>
                    <input
                      type='checkbox'
                      checked={selectedIds.has(entity.$id)}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleSelectRow(entity.$id, e.target.checked)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${entity.$id}`}
                    />
                  </td>
                )}
                {displayColumns.map((col) => (
                  <td key={col.key} style={tableStyles.td}>
                    {renderCell ? renderCell(col.key, entity[col.key], entity, col) : formatCellValue(entity[col.key], col.type)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div style={tableStyles.pagination} data-testid='entity-table-pagination'>
        <span>
          {total !== undefined ? `${total} total` : `${entities.length} loaded`}
          {totalPages !== undefined && ` \u00B7 Page ${page + 1} of ${totalPages}`}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            style={{ ...buttonStyles.base, ...buttonStyles.secondary, ...(page === 0 ? buttonStyles.disabled : {}) }}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <button
            style={{
              ...buttonStyles.base,
              ...buttonStyles.secondary,
              ...(!hasMore && (totalPages === undefined || page + 1 >= totalPages) ? buttonStyles.disabled : {}),
            }}
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore && (totalPages === undefined || page + 1 >= totalPages)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
