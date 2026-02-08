/**
 * EntityTimeline — Chronological event timeline for an entity.
 *
 * Fetches the event history for a given entity $id and displays
 * events in chronological order with verb badges, actor attribution,
 * and diff views for updates.
 *
 * @example
 * ```tsx
 * import { EntityTimeline } from '@headlessly/ui'
 *
 * <EntityTimeline entityId='contact_1' />
 * ```
 */

import React, { useState, useEffect } from 'react'
import { useHeadlessUI } from './provider.js'
import { formatLabel } from './schema-utils.js'
import { timelineStyles, buttonStyles } from './styles.js'
import type { EntityEvent, StylableProps } from './types.js'

export interface EntityTimelineProps extends StylableProps {
  /** The entity $id to show events for */
  entityId: string
  /** Pre-loaded events (skips fetch if provided) */
  events?: EntityEvent[]
  /** Maximum number of events to show (default: 50) */
  limit?: number
  /** Called when an actor name is clicked */
  onActorClick?: (actorId: string) => void
  /** Custom event renderer */
  renderEvent?: (event: EntityEvent) => React.ReactNode
}

/** Color mapping for common verb types */
function verbColor(verb: string): string {
  const v = verb.toLowerCase()
  if (v === 'created' || v === 'create') return '#16a34a'
  if (v === 'deleted' || v === 'delete') return 'var(--hly-danger, #dc2626)'
  if (v === 'updated' || v === 'update') return 'var(--hly-primary, #2563eb)'
  return '#8b5cf6'
}

/** Format a verb string into a label for display */
function verbLabel(verb: string): string {
  return formatLabel(verb)
}

/** Format a timestamp into a relative or absolute time string */
function formatTimestamp(ts: string): string {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ts

  const now = Date.now()
  const diff = now - d.getTime()

  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`

  return d.toLocaleDateString()
}

export function EntityTimeline({ entityId, events: eventsProp, limit = 50, onActorClick, renderEvent, className, style }: EntityTimelineProps) {
  const { fetchEvents } = useHeadlessUI()
  const [events, setEvents] = useState<EntityEvent[]>(eventsProp ?? [])
  const [loading, setLoading] = useState(!eventsProp)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (eventsProp) {
      setEvents(eventsProp)
      return
    }

    let cancelled = false
    setLoading(true)
    fetchEvents(entityId)
      .then((result) => {
        if (!cancelled) {
          setEvents(result.slice(0, limit))
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [entityId, eventsProp, fetchEvents, limit])

  if (loading) {
    return (
      <div style={{ ...timelineStyles.wrapper, ...(style ?? {}) }} className={className}>
        <p style={{ color: 'var(--hly-text-muted, #6b7280)', fontSize: '13px' }}>Loading events...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...timelineStyles.wrapper, ...(style ?? {}) }} className={className}>
        <p style={{ color: 'var(--hly-danger, #dc2626)', fontSize: '13px' }}>Failed to load events</p>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div style={{ ...timelineStyles.wrapper, ...(style ?? {}) }} className={className}>
        <p style={{ color: 'var(--hly-text-muted, #6b7280)', fontSize: '13px' }}>No events yet</p>
      </div>
    )
  }

  return (
    <div style={{ ...timelineStyles.wrapper, ...(style ?? {}) }} className={className} data-testid='entity-timeline'>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Activity</h3>
      <ul style={timelineStyles.list}>
        {events.map((event, idx) => {
          // Custom renderer
          if (renderEvent) {
            const custom = renderEvent(event)
            if (custom !== undefined) return <React.Fragment key={event.id}>{custom}</React.Fragment>
          }

          const isLast = idx === events.length - 1

          return (
            <li key={event.id} style={timelineStyles.item} data-testid={`timeline-event-${event.id}`}>
              {/* Connecting line */}
              {!isLast && <div style={timelineStyles.line} />}

              {/* Dot */}
              <div style={{ ...timelineStyles.dot, backgroundColor: verbColor(event.verb) }}>{event.verb.charAt(0).toUpperCase()}</div>

              {/* Content */}
              <div style={timelineStyles.content}>
                <div style={timelineStyles.verb}>{verbLabel(event.verb)}</div>

                {event.actor && (
                  <div style={timelineStyles.actor}>
                    by{' '}
                    <span
                      style={onActorClick ? { cursor: 'pointer', textDecoration: 'underline' } : {}}
                      onClick={() => onActorClick?.(event.actor!)}
                    >
                      {event.actor}
                    </span>
                  </div>
                )}

                <div style={timelineStyles.timestamp}>{formatTimestamp(event.timestamp)}</div>

                {/* Diff view for updates */}
                {event.diff && Object.keys(event.diff).length > 0 && (
                  <div style={timelineStyles.diff} data-testid='timeline-diff'>
                    {Object.entries(event.diff).map(([key, change]) => (
                      <div key={key} style={{ marginBottom: '4px' }}>
                        <strong>{formatLabel(key)}:</strong>{' '}
                        <span style={timelineStyles.diffFrom}>{String(change.from ?? '\u2014')}</span>
                        {' \u2192 '}
                        <span style={timelineStyles.diffTo}>{String(change.to ?? '\u2014')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
