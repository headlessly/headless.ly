'use client'

/**
 * EntityGrid — Single-entity grid view wiring @mdxui/admin DatabaseGrid
 * to @headlessly/react data hooks.
 */

import { useMemo, useCallback } from 'react'
import { getNounSchema } from 'digital-objects'
import { DatabaseGrid, type DatabaseColumnDef } from '@mdxui/admin'
import { useEntities, useMutation } from '@headlessly/react'
import { nounToColumns } from './schema-bridge.js'

export interface EntityGridProps {
  /** Entity type name (e.g. 'Contact') */
  noun: string
  /** Optional filter to narrow results */
  filter?: Record<string, unknown>
  /** Whether inline editing is enabled */
  editable?: boolean
  /** Row height preset */
  rowHeight?: 'compact' | 'default' | 'comfortable' | 'tall'
  /** Callback when a row is clicked */
  onViewRow?: (id: string, row: Record<string, unknown>) => void
  /** Callback when navigating to a related entity */
  onRelationshipNavigate?: (link: { targetTable: string; targetId: string }, column: DatabaseColumnDef) => void
  /** Optional className */
  className?: string
}

export function EntityGrid({ noun, filter, editable = true, rowHeight = 'default', onViewRow, onRelationshipNavigate, className }: EntityGridProps) {
  const schema = getNounSchema(noun)
  const columns = useMemo(() => (schema ? nounToColumns(schema) : []), [schema])

  const { data, loading } = useEntities(noun, filter)
  const { create, update, remove } = useMutation(noun)

  const handleCellUpdate = useCallback(
    (rowIndex: number, columnId: string, value: unknown) => {
      const row = data[rowIndex]
      if (!row?.$id) return
      update(String(row.$id), { [columnId]: value })
    },
    [data, update],
  )

  const handleInsert = useCallback(
    (row: Record<string, unknown>) => {
      create(row)
    },
    [create],
  )

  const handleDeleteRows = useCallback(
    (rowIds: string[]) => {
      for (const id of rowIds) {
        remove(id)
      }
    },
    [remove],
  )

  const handleViewRow = useCallback(
    (rowId: string, row: Record<string, unknown>) => {
      onViewRow?.(rowId, row)
    },
    [onViewRow],
  )

  if (!schema) {
    return <div className={className}>Unknown entity: {noun}</div>
  }

  const editableColumns = editable ? columns : columns.map((c) => ({ ...c, editable: false }))

  return (
    <DatabaseGrid
      data={data as Record<string, unknown>[]}
      columns={editableColumns}
      isLoading={loading}
      rowHeight={rowHeight}
      rowIdField='$id'
      onCellUpdate={editable ? handleCellUpdate : undefined}
      onInsert={editable ? handleInsert : undefined}
      onDeleteRows={editable ? handleDeleteRows : undefined}
      onViewRow={onViewRow ? handleViewRow : undefined}
      onRelationshipNavigate={onRelationshipNavigate}
      emptyMessage={`No ${schema.plural} found`}
      className={className}
    />
  )
}
