/**
 * Dashboard — Multi-entity dashboard grid.
 *
 * Displays a grid of entity summary cards. Each card shows the entity count,
 * recent items, and quick action buttons. Configurable layout.
 *
 * @example
 * ```tsx
 * import { Dashboard } from '@headlessly/ui'
 *
 * <Dashboard
 *   cards={[
 *     { noun: 'Contact', title: 'Contacts', limit: 5 },
 *     { noun: 'Deal', title: 'Deals', limit: 5 },
 *     { noun: 'Ticket', title: 'Support Tickets', limit: 3 },
 *     { noun: 'Subscription', title: 'Subscriptions', limit: 3 },
 *   ]}
 *   layout='2x2'
 * />
 * ```
 */

import React, { useMemo } from 'react'
import { getNounSchema } from 'digital-objects'
import { useEntities } from './hooks/use-entities.js'
import { formatCellValue, formatLabel } from './schema-utils.js'
import { dashboardStyles, buttonStyles } from './styles.js'
import type { DashboardCard, DashboardLayout, NounInstance, StylableProps } from './types.js'

export interface DashboardProps extends StylableProps {
  /** Cards to display in the dashboard grid */
  cards: DashboardCard[]
  /** Grid layout preset (default: 'auto') */
  layout?: DashboardLayout
  /** Called when a card title or "View All" is clicked */
  onNavigate?: (noun: string) => void
  /** Called when a specific entity row in a card is clicked */
  onEntityClick?: (noun: string, entity: NounInstance) => void
  /** Called when "Create" is clicked on a card */
  onCreate?: (noun: string) => void
}

function layoutToColumns(layout: DashboardLayout, cardCount: number): string {
  switch (layout) {
    case '2x2':
      return 'repeat(2, 1fr)'
    case '3x1':
      return 'repeat(3, 1fr)'
    case '1x3':
      return '1fr'
    case '2x1':
      return 'repeat(2, 1fr)'
    case '1x2':
      return '1fr'
    case 'auto':
    default:
      if (cardCount <= 2) return 'repeat(2, 1fr)'
      if (cardCount <= 3) return 'repeat(3, 1fr)'
      return 'repeat(2, 1fr)'
  }
}

/** Single dashboard card */
function DashboardCardComponent({
  card,
  onNavigate,
  onEntityClick,
  onCreate,
}: {
  card: DashboardCard
  onNavigate?: (noun: string) => void
  onEntityClick?: (noun: string, entity: NounInstance) => void
  onCreate?: (noun: string) => void
}) {
  const schema = getNounSchema(card.noun)
  const { entities, loading, total } = useEntities(card.noun, {
    limit: card.limit ?? 5,
    sort: { $createdAt: -1 },
  })

  const title = card.title ?? schema?.plural ?? card.noun
  const displayField = useMemo(() => {
    if (!schema) return null
    // Find the first string field to display as the row label
    for (const [key, prop] of schema.fields) {
      if (prop.type === 'string' && (key === 'name' || key === 'title' || key === 'email' || key === 'subject')) {
        return key
      }
    }
    // Fallback to first string field
    for (const [key, prop] of schema.fields) {
      if (prop.type === 'string') return key
    }
    return null
  }, [schema])

  return (
    <div style={dashboardStyles.card} data-testid={`dashboard-card-${card.noun}`}>
      <div style={dashboardStyles.cardHeader}>
        <h3
          style={{ ...dashboardStyles.cardTitle, ...(onNavigate ? { cursor: 'pointer' } : {}) }}
          onClick={() => onNavigate?.(card.noun)}
        >
          {title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={dashboardStyles.cardCount}>{loading ? '\u2014' : (total ?? entities.length)}</span>
          {onCreate && (
            <button
              style={{ ...buttonStyles.base, ...buttonStyles.primary, padding: '4px 12px', fontSize: '12px' }}
              onClick={() => onCreate(card.noun)}
            >
              + New
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--hly-text-muted, #6b7280)', fontSize: '13px', margin: 0 }}>Loading...</p>
      ) : entities.length === 0 ? (
        <p style={{ color: 'var(--hly-text-muted, #6b7280)', fontSize: '13px', margin: 0 }}>No {title.toLowerCase()} yet</p>
      ) : (
        <ul style={dashboardStyles.cardList}>
          {entities.map((entity) => (
            <li
              key={entity.$id}
              style={{ ...dashboardStyles.cardListItem, ...(onEntityClick ? { cursor: 'pointer' } : {}) }}
              onClick={() => onEntityClick?.(card.noun, entity)}
            >
              <span>{displayField ? String(entity[displayField] ?? entity.$id) : entity.$id}</span>
              <span style={{ fontSize: '12px', color: 'var(--hly-text-muted, #6b7280)' }}>
                {formatCellValue(entity.$createdAt, 'datetime')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {onNavigate && entities.length > 0 && (
        <button
          style={{
            ...buttonStyles.base,
            ...buttonStyles.secondary,
            width: '100%',
            justifyContent: 'center',
            marginTop: '12px',
            fontSize: '12px',
            padding: '6px',
          }}
          onClick={() => onNavigate(card.noun)}
        >
          View all {title.toLowerCase()}
        </button>
      )}
    </div>
  )
}

export function Dashboard({ cards, layout = 'auto', onNavigate, onEntityClick, onCreate, className, style }: DashboardProps) {
  const gridColumns = layoutToColumns(layout, cards.length)

  return (
    <div
      style={{
        ...dashboardStyles.grid,
        gridTemplateColumns: gridColumns,
        ...(style ?? {}),
      }}
      className={className}
      data-testid='dashboard'
    >
      {cards.map((card) => (
        <DashboardCardComponent key={card.noun} card={card} onNavigate={onNavigate} onEntityClick={onEntityClick} onCreate={onCreate} />
      ))}
    </div>
  )
}
