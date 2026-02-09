/**
 * EntityDetail — Single entity view with fields, relationships, verbs, and timeline.
 *
 * Fetches a single entity by $type and $id, then renders all fields
 * in a clean layout with relationship links, verb action buttons,
 * and an optional event timeline sidebar.
 *
 * @example
 * ```tsx
 * import { EntityDetail } from '@headlessly/ui'
 *
 * <EntityDetail
 *   noun='Contact'
 *   id='contact_1'
 *   onNavigate={(type, id) => navigate(`/${type}/${id}`)}
 * />
 * ```
 */

import React, { useMemo } from 'react'
import { getNounSchema } from 'digital-objects'
import { useEntity } from './hooks/use-entity.js'
import { deriveColumns, deriveVerbs, formatCellValue, formatLabel } from './schema-utils.js'
import { VerbButton } from './verb-button.js'
import { EntityTimeline } from './entity-timeline.js'
import { detailStyles, buttonStyles } from './styles.js'
import type { NounInstance, StylableProps, NounSchema, VerbAction } from './types.js'

export interface EntityDetailProps extends StylableProps {
  /** The noun name (e.g. 'Contact', 'Deal') */
  noun: string
  /** Pass schema directly instead of registry lookup */
  schema?: NounSchema
  /** The entity $id to fetch and display */
  id: string
  /** Pre-loaded entity (skips fetch if provided) */
  entity?: NounInstance
  /** Called when a relationship link is clicked */
  onNavigate?: (type: string, id: string) => void
  /** Called when edit is clicked */
  onEdit?: (entity: NounInstance) => void
  /** Called when delete is clicked */
  onDelete?: (entity: NounInstance) => void
  /** Called after a verb is successfully executed */
  onVerbSuccess?: (verb: string, entity: NounInstance) => void
  /** Whether to show the event timeline (default: true) */
  showTimeline?: boolean
  /** Whether to show verb action buttons (default: true) */
  showVerbs?: boolean
  /** Fields to exclude from the display */
  excludeFields?: string[]
}

export function EntityDetail({
  noun,
  schema: schemaProp,
  id,
  entity: entityProp,
  onNavigate,
  onEdit,
  onDelete,
  onVerbSuccess,
  showTimeline = true,
  showVerbs = true,
  excludeFields,
  className,
  style,
}: EntityDetailProps) {
  const schema = schemaProp ?? getNounSchema(noun)
  const { entity: fetchedEntity, loading, error, refetch } = useEntity(noun, id, { skip: !!entityProp })
  const entity = entityProp ?? fetchedEntity

  const columns = useMemo(() => {
    if (!schema) return []
    const cols = deriveColumns(schema)
    return excludeFields ? cols.filter((c) => !excludeFields.includes(c.key)) : cols
  }, [schema, excludeFields])

  const verbs = useMemo<VerbAction[]>(() => {
    if (!schema) return []
    return deriveVerbs(schema)
  }, [schema])

  if (!schema) {
    return (
      <div style={{ ...detailStyles.wrapper, ...(style ?? {}) }} className={className}>
        <p style={{ color: 'var(--hly-text-muted, #6b7280)' }}>Unknown noun: {noun}. Register it with Noun() first.</p>
      </div>
    )
  }

  if (loading && !entity) {
    return (
      <div style={{ ...detailStyles.wrapper, ...(style ?? {}) }} className={className}>
        <p style={{ color: 'var(--hly-text-muted, #6b7280)' }}>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...detailStyles.wrapper, ...(style ?? {}) }} className={className}>
        <p style={{ color: 'var(--hly-danger, #dc2626)' }}>Error: {error.message}</p>
        <button style={{ ...buttonStyles.base, ...buttonStyles.secondary }} onClick={() => refetch()}>
          Retry
        </button>
      </div>
    )
  }

  if (!entity) {
    return (
      <div style={{ ...detailStyles.wrapper, ...(style ?? {}) }} className={className}>
        <p style={{ color: 'var(--hly-text-muted, #6b7280)' }}>
          {noun} not found: {id}
        </p>
      </div>
    )
  }

  // Separate fields, relationships, and meta
  const dataFields = columns.filter((c) => c.kind === 'field')
  const relationshipFields = columns.filter((c) => c.kind === 'relationship')
  const metaFields = columns.filter((c) => c.kind === 'meta')

  return (
    <div style={{ ...detailStyles.wrapper, ...(style ?? {}) }} className={className} data-testid='entity-detail'>
      {/* Header */}
      <div style={detailStyles.header}>
        <div>
          <h2 style={detailStyles.title} data-testid='entity-detail-title'>
            {String(entity.name ?? entity.title ?? entity.$id)}
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--hly-text-muted, #6b7280)' }}>
            {entity.$type} &middot; {entity.$id}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {onEdit && (
            <button style={{ ...buttonStyles.base, ...buttonStyles.secondary }} onClick={() => onEdit(entity)}>
              Edit
            </button>
          )}
          {onDelete && (
            <button style={{ ...buttonStyles.base, ...buttonStyles.danger }} onClick={() => onDelete(entity)}>
              Delete
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '32px' }}>
        {/* Main content */}
        <div style={{ flex: 1 }}>
          {/* Data fields */}
          {dataFields.length > 0 && (
            <div style={detailStyles.section}>
              <h3 style={detailStyles.sectionTitle}>Fields</h3>
              <div style={detailStyles.fieldGrid}>
                {dataFields.map((col) => (
                  <div key={col.key}>
                    <div style={detailStyles.fieldLabel}>{col.label}</div>
                    <div style={detailStyles.fieldValue}>
                      {col.enumValues && entity[col.key] ? (
                        <span style={detailStyles.badge}>{String(entity[col.key])}</span>
                      ) : (
                        formatCellValue(entity[col.key], col.type)
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Relationships */}
          {relationshipFields.length > 0 && (
            <div style={detailStyles.section}>
              <h3 style={detailStyles.sectionTitle}>Relationships</h3>
              <div style={detailStyles.fieldGrid}>
                {relationshipFields.map((col) => {
                  const val = entity[col.key]
                  const ids = Array.isArray(val) ? val : val ? [val] : []
                  return (
                    <div key={col.key}>
                      <div style={detailStyles.fieldLabel}>{col.label}</div>
                      <div style={detailStyles.fieldValue}>
                        {ids.length === 0
                          ? '\u2014'
                          : ids.map((relId: unknown, i: number) => (
                              <span key={i}>
                                {i > 0 && ', '}
                                <span
                                  style={onNavigate ? detailStyles.link : {}}
                                  onClick={() => onNavigate?.(col.type ?? noun, String(relId))}
                                  role={onNavigate ? 'link' : undefined}
                                >
                                  {String(relId)}
                                </span>
                              </span>
                            ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Custom verbs */}
          {showVerbs && verbs.length > 0 && (
            <div style={detailStyles.section}>
              <h3 style={detailStyles.sectionTitle}>Actions</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {verbs.map((verb) => (
                  <VerbButton
                    key={verb.name}
                    noun={noun}
                    entityId={entity.$id}
                    verb={verb.name}
                    label={verb.label}
                    onSuccess={(result) => {
                      refetch()
                      onVerbSuccess?.(verb.name, result)
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div style={detailStyles.section}>
            <h3 style={detailStyles.sectionTitle}>Metadata</h3>
            <div style={detailStyles.fieldGrid}>
              {metaFields.map((col) => (
                <div key={col.key}>
                  <div style={detailStyles.fieldLabel}>{col.label}</div>
                  <div style={detailStyles.fieldValue}>{formatCellValue(entity[col.key], col.type)}</div>
                </div>
              ))}
              <div>
                <div style={detailStyles.fieldLabel}>Version</div>
                <div style={detailStyles.fieldValue}>{entity.$version ?? '\u2014'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline sidebar */}
        {showTimeline && (
          <div style={{ width: '320px', flexShrink: 0 }}>
            <EntityTimeline entityId={entity.$id} />
          </div>
        )}
      </div>
    </div>
  )
}
