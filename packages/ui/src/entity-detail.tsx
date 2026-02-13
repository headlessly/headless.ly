'use client'

/**
 * EntityDetail — Detail panel for a single entity.
 *
 * Shows all fields, relationships, available verbs, and meta information.
 * Uses schema introspection for auto-generated layout.
 */

import { useMemo, useCallback } from 'react'
import { getNounSchema } from 'digital-objects'
import { useEntity, useVerb } from '@headlessly/react'
import { deriveVerbs, deriveRelationships, formatLabel, formatCellValue } from './schema-utils.js'

export interface EntityDetailProps {
  /** Entity type name (e.g. 'Contact') */
  noun: string
  /** Entity ID */
  id: string
  /** Callback when a relationship link is clicked */
  onNavigate?: (targetNoun: string, targetId: string) => void
  /** Callback when edit is requested */
  onEdit?: (noun: string, id: string) => void
  /** Optional className */
  className?: string
}

export function EntityDetail({ noun, id, onNavigate, onEdit, className }: EntityDetailProps) {
  const schema = getNounSchema(noun)
  const { data: entity, loading, error, refetch } = useEntity(noun, id)

  const verbs = useMemo(() => (schema ? deriveVerbs(schema) : []), [schema])
  const relationships = useMemo(() => (schema ? deriveRelationships(schema) : []), [schema])

  if (!schema) {
    return <div className={className}>Unknown entity: {noun}</div>
  }

  if (loading) {
    return <div className={className}>Loading...</div>
  }

  if (error) {
    return <div className={className}>Error: {error.message}</div>
  }

  if (!entity) {
    return <div className={className}>{schema.name} not found</div>
  }

  const entityData = entity as Record<string, unknown>

  return (
    <div className={`space-y-6 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{schema.name}</h2>
          <p className="text-sm text-muted-foreground">{String(entityData.$id)}</p>
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <button onClick={() => onEdit(noun, id)} className="rounded-md border px-3 py-1.5 text-sm">
              Edit
            </button>
          )}
          <button onClick={refetch} className="rounded-md border px-3 py-1.5 text-sm">
            Refresh
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Fields</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {Array.from(schema.fields).map(([key, prop]) => (
            <div key={key}>
              <dt className="text-sm text-muted-foreground">{formatLabel(key)}</dt>
              <dd className="text-sm font-medium">{formatCellValue(entityData[key], prop.type)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Relationships */}
      {relationships.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Relationships</h3>
          <div className="space-y-2">
            {relationships.map((rel) => {
              const value = entityData[rel.key]
              return (
                <div key={rel.key} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">{formatLabel(rel.key)}</span>
                  <span className="text-sm">
                    {value ? (
                      <button
                        onClick={() => onNavigate?.(rel.targetType, String(value))}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {String(value)}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">{'\u2014'}</span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Verbs */}
      {verbs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Actions</h3>
          <div className="flex flex-wrap gap-2">
            {verbs.map((verb) => (
              <VerbActionButton key={verb.name} noun={noun} id={id} verb={verb.name} label={verb.label} onComplete={refetch} />
            ))}
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Meta</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Type</dt>
            <dd className="font-mono">{String(entityData.$type ?? noun)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Version</dt>
            <dd>{String(entityData.$version ?? 1)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{formatCellValue(entityData.$createdAt, 'datetime')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{formatCellValue(entityData.$updatedAt, 'datetime')}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}

/**
 * Internal verb action button with loading state.
 */
function VerbActionButton({
  noun,
  id,
  verb,
  label,
  onComplete,
}: {
  noun: string
  id: string
  verb: string
  label: string
  onComplete?: () => void
}) {
  const { execute, loading } = useVerb(noun, verb)

  const handleClick = useCallback(async () => {
    await execute(id)
    onComplete?.()
  }, [execute, id, onComplete])

  return (
    <button onClick={handleClick} disabled={loading} className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50">
      {loading ? `${label}...` : label}
    </button>
  )
}
