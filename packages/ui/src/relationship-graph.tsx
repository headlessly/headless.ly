/**
 * RelationshipGraph — Visual graph of entity relationships.
 *
 * Renders entities as nodes and their relationships as edges
 * using SVG. Provides a simple force-directed-ish layout using
 * a grid arrangement (no external graph library dependency).
 *
 * @example
 * ```tsx
 * import { RelationshipGraph } from '@headlessly/ui'
 *
 * <RelationshipGraph
 *   nodes={[
 *     { id: 'contact_1', type: 'Contact', label: 'Alice' },
 *     { id: 'deal_1', type: 'Deal', label: 'Acme Enterprise' },
 *     { id: 'company_1', type: 'Company', label: 'Acme Inc' },
 *   ]}
 *   edges={[
 *     { source: 'contact_1', target: 'deal_1', label: 'deals', type: 'forward' },
 *     { source: 'contact_1', target: 'company_1', label: 'company', type: 'forward' },
 *   ]}
 *   onNodeClick={(node) => navigate(`/${node.type}/${node.id}`)}
 * />
 * ```
 */

import React, { useMemo } from 'react'
import { graphStyles } from './styles.js'
import type { GraphNode, GraphEdge, StylableProps } from './types.js'

export interface RelationshipGraphProps extends StylableProps {
  /** Graph nodes (entities) */
  nodes: GraphNode[]
  /** Graph edges (relationships) */
  edges: GraphEdge[]
  /** SVG width (default: 800) */
  width?: number
  /** SVG height (default: 500) */
  height?: number
  /** Called when a node is clicked */
  onNodeClick?: (node: GraphNode) => void
  /** Node width (default: 140) */
  nodeWidth?: number
  /** Node height (default: 50) */
  nodeHeight?: number
}

/** Color for node border based on entity type */
function typeColor(type: string): string {
  const colors: Record<string, string> = {
    Contact: '#2563eb',
    Company: '#7c3aed',
    Deal: '#16a34a',
    Project: '#ea580c',
    Issue: '#d97706',
    Ticket: '#dc2626',
    Subscription: '#0891b2',
    User: '#4f46e5',
    Campaign: '#c026d3',
    Content: '#0d9488',
  }
  return colors[type] ?? '#6b7280'
}

interface LayoutNode extends GraphNode {
  x: number
  y: number
}

/**
 * Simple grid layout for nodes.
 * Places nodes in a grid pattern with some padding.
 */
function layoutNodes(nodes: GraphNode[], width: number, height: number, nodeWidth: number, nodeHeight: number): LayoutNode[] {
  const count = nodes.length
  if (count === 0) return []

  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)

  const cellW = width / (cols + 1)
  const cellH = height / (rows + 1)

  return nodes.map((node, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    return {
      ...node,
      x: cellW * (col + 1),
      y: cellH * (row + 1),
    }
  })
}

export function RelationshipGraph({
  nodes,
  edges,
  width = 800,
  height = 500,
  onNodeClick,
  nodeWidth = 140,
  nodeHeight = 50,
  className,
  style,
}: RelationshipGraphProps) {
  const layouted = useMemo(() => layoutNodes(nodes, width, height, nodeWidth, nodeHeight), [nodes, width, height, nodeWidth, nodeHeight])

  const nodeMap = useMemo(() => {
    const map = new Map<string, LayoutNode>()
    for (const n of layouted) map.set(n.id, n)
    return map
  }, [layouted])

  if (nodes.length === 0) {
    return (
      <div style={{ ...graphStyles.wrapper, width, height, ...(style ?? {}) }} className={className}>
        <p style={{ padding: '16px', color: 'var(--hly-text-muted, #6b7280)', fontSize: '13px', textAlign: 'center' }}>No relationships to display</p>
      </div>
    )
  }

  return (
    <div style={{ ...graphStyles.wrapper, ...(style ?? {}) }} className={className} data-testid='relationship-graph'>
      <svg width={width} height={height} style={graphStyles.svg} viewBox={`0 0 ${width} ${height}`}>
        {/* Edges */}
        {edges.map((edge, idx) => {
          const source = nodeMap.get(edge.source)
          const target = nodeMap.get(edge.target)
          if (!source || !target) return null

          const midX = (source.x + target.x) / 2
          const midY = (source.y + target.y) / 2

          return (
            <g key={`edge-${idx}`} data-testid={`graph-edge-${edge.source}-${edge.target}`}>
              <line
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke='var(--hly-border, #e5e7eb)'
                strokeWidth={1.5}
                strokeDasharray={edge.type === 'backward' ? '4 4' : undefined}
              />
              {/* Arrow at midpoint */}
              <circle cx={midX} cy={midY} r={3} fill='var(--hly-border, #e5e7eb)' />
              {/* Edge label */}
              {edge.label && (
                <text x={midX} y={midY - 8} textAnchor='middle' fontSize={10} fill='var(--hly-text-muted, #6b7280)'>
                  {edge.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {layouted.map((node) => {
          const color = typeColor(node.type)
          return (
            <g
              key={node.id}
              style={{ cursor: onNodeClick ? 'pointer' : 'default' }}
              onClick={() => onNodeClick?.(node)}
              data-testid={`graph-node-${node.id}`}
            >
              <rect
                x={node.x - nodeWidth / 2}
                y={node.y - nodeHeight / 2}
                width={nodeWidth}
                height={nodeHeight}
                fill='var(--hly-bg, #ffffff)'
                stroke={color}
                strokeWidth={2}
                rx={6}
                ry={6}
              />
              <text x={node.x} y={node.y - 4} textAnchor='middle' fontSize={12} fontWeight={600} fill='var(--hly-text, #111827)'>
                {node.label.length > 16 ? node.label.slice(0, 15) + '\u2026' : node.label}
              </text>
              <text x={node.x} y={node.y + 12} textAnchor='middle' fontSize={10} fill='var(--hly-text-muted, #6b7280)'>
                {node.type}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
