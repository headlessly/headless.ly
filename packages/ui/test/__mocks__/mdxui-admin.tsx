/**
 * Mock for @mdxui/admin to avoid transitive dependency resolution issues in vitest.
 * @mdxui/admin source imports @mdxui/primitives, @mdxui/discovery, and other packages
 * that are not available in the @headlessly/ui test context.
 *
 * Exports only the symbols that @headlessly/ui re-exports from @mdxui/admin.
 * Each component captures its props via vi.fn() wrappers for test assertions.
 */

import * as React from 'react'
import { vi } from 'vitest'

// DatabaseGrid — the main data grid component
export const DatabaseGrid = vi.fn(function DatabaseGrid(props: Record<string, unknown>) {
  const { data, columns, isLoading, emptyMessage, className } = props as {
    data?: unknown[]
    columns?: unknown[]
    isLoading?: boolean
    emptyMessage?: string
    className?: string
  }

  if (isLoading) {
    return React.createElement('div', { 'data-testid': 'database-grid', className, role: 'status' }, 'Loading...')
  }

  if (!data || data.length === 0) {
    return React.createElement('div', { 'data-testid': 'database-grid', className }, emptyMessage ?? 'No data')
  }

  return React.createElement('div', { 'data-testid': 'database-grid', className, 'data-row-count': data.length }, `${data.length} rows`)
})

// DatabaseSidebar — schema/table navigator
export const DatabaseSidebar = vi.fn(function DatabaseSidebar(props: Record<string, unknown>) {
  const { schemas, onSelectTable, collapsed } = props as {
    schemas?: Array<{ name: string; tables: Array<{ name: string }> }>
    onSelectTable?: (schema: string, table: string) => void
    collapsed?: boolean
  }

  return React.createElement(
    'div',
    { 'data-testid': 'database-sidebar', 'data-collapsed': collapsed },
    schemas?.map((schema) =>
      React.createElement(
        'div',
        { key: schema.name, 'data-testid': `schema-${schema.name}` },
        schema.tables.map((table) =>
          React.createElement(
            'button',
            {
              key: table.name,
              'data-testid': `table-${table.name}`,
              onClick: () => onSelectTable?.(schema.name, table.name),
            },
            table.name,
          ),
        ),
      ),
    ),
  )
})

// TableEditorToolbar — toolbar with filters, view modes, etc.
export const TableEditorToolbar = vi.fn(function TableEditorToolbar(props: Record<string, unknown>) {
  const { tableName, viewMode, onViewModeChange, sidebarCollapsed, onSidebarCollapsedChange } = props as {
    tableName?: string
    viewMode?: string
    onViewModeChange?: (mode: string) => void
    sidebarCollapsed?: boolean
    onSidebarCollapsedChange?: (collapsed: boolean) => void
  }

  return React.createElement(
    'div',
    { 'data-testid': 'table-editor-toolbar', 'data-table': tableName },
    React.createElement('button', { 'data-testid': 'toggle-sidebar', onClick: () => onSidebarCollapsedChange?.(!sidebarCollapsed) }, 'Toggle Sidebar'),
    React.createElement('button', { 'data-testid': 'view-query', onClick: () => onViewModeChange?.('query') }, 'Query'),
    React.createElement('button', { 'data-testid': 'view-table', onClick: () => onViewModeChange?.('table') }, 'Table'),
  )
})

// Type exports (re-exported as empty interfaces at runtime)
export type DatabaseGridProps = Record<string, unknown>
export type DatabaseColumnDef = Record<string, unknown>
export type ColumnDataType = string
export type DatabaseSidebarProps = Record<string, unknown>
export type DatabaseSchema = Record<string, unknown>
export type DatabaseTable = Record<string, unknown>
export type TableEditorToolbarProps = Record<string, unknown>
export type FilterCondition = Record<string, unknown>
export type RowHeightPreset = string
