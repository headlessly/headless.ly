/**
 * styles — Zero-dependency styling via CSS custom properties and inline styles.
 *
 * All components use these shared style objects. Consumers can override
 * via className prop or CSS custom properties:
 *
 *   --hly-bg: background color
 *   --hly-bg-hover: hover background
 *   --hly-bg-active: active/selected background
 *   --hly-border: border color
 *   --hly-text: primary text color
 *   --hly-text-muted: secondary text color
 *   --hly-text-link: link/accent color
 *   --hly-primary: primary action color
 *   --hly-primary-text: text on primary background
 *   --hly-danger: destructive action color
 *   --hly-danger-text: text on danger background
 *   --hly-radius: border radius
 *   --hly-font: font family
 *   --hly-font-mono: monospace font family
 */

import type React from 'react'

function v(prop: string, fallback: string): string {
  return `var(${prop}, ${fallback})`
}

export const vars = {
  bg: v('--hly-bg', '#ffffff'),
  bgHover: v('--hly-bg-hover', '#f9fafb'),
  bgActive: v('--hly-bg-active', '#f3f4f6'),
  border: v('--hly-border', '#e5e7eb'),
  text: v('--hly-text', '#111827'),
  textMuted: v('--hly-text-muted', '#6b7280'),
  textLink: v('--hly-text-link', '#2563eb'),
  primary: v('--hly-primary', '#2563eb'),
  primaryText: v('--hly-primary-text', '#ffffff'),
  danger: v('--hly-danger', '#dc2626'),
  dangerText: v('--hly-danger-text', '#ffffff'),
  radius: v('--hly-radius', '6px'),
  font: v('--hly-font', "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"),
  fontMono: v('--hly-font-mono', "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace"),
} as const

export const tableStyles = {
  wrapper: {
    width: '100%',
    overflow: 'auto',
    fontFamily: vars.font,
    color: vars.text,
    fontSize: '14px',
  } as React.CSSProperties,

  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    borderSpacing: 0,
  } as React.CSSProperties,

  thead: {
    borderBottom: `2px solid ${vars.border}`,
  } as React.CSSProperties,

  th: {
    padding: '10px 12px',
    textAlign: 'left' as const,
    fontWeight: 600,
    fontSize: '12px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: vars.textMuted,
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  td: {
    padding: '10px 12px',
    borderBottom: `1px solid ${vars.border}`,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '300px',
  } as React.CSSProperties,

  tr: {
    cursor: 'pointer',
  } as React.CSSProperties,

  trHover: {
    backgroundColor: vars.bgHover,
  } as React.CSSProperties,

  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    fontSize: '13px',
    color: vars.textMuted,
  } as React.CSSProperties,
}

export const formStyles = {
  form: {
    fontFamily: vars.font,
    color: vars.text,
    fontSize: '14px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  } as React.CSSProperties,

  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  } as React.CSSProperties,

  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: vars.text,
  } as React.CSSProperties,

  required: {
    color: vars.danger,
    marginLeft: '2px',
  } as React.CSSProperties,

  input: {
    padding: '8px 12px',
    border: `1px solid ${vars.border}`,
    borderRadius: vars.radius,
    fontSize: '14px',
    fontFamily: vars.font,
    color: vars.text,
    backgroundColor: vars.bg,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  select: {
    padding: '8px 12px',
    border: `1px solid ${vars.border}`,
    borderRadius: vars.radius,
    fontSize: '14px',
    fontFamily: vars.font,
    color: vars.text,
    backgroundColor: vars.bg,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  checkbox: {
    width: '16px',
    height: '16px',
  } as React.CSSProperties,

  checkboxGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  error: {
    color: vars.danger,
    fontSize: '12px',
    marginTop: '2px',
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    paddingTop: '8px',
  } as React.CSSProperties,
}

export const buttonStyles = {
  base: {
    padding: '8px 16px',
    borderRadius: vars.radius,
    fontSize: '14px',
    fontWeight: 500,
    fontFamily: vars.font,
    cursor: 'pointer',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap' as const,
    transition: 'opacity 150ms ease',
  } as React.CSSProperties,

  primary: {
    backgroundColor: vars.primary,
    color: vars.primaryText,
  } as React.CSSProperties,

  secondary: {
    backgroundColor: 'transparent',
    color: vars.text,
    border: `1px solid ${vars.border}`,
  } as React.CSSProperties,

  danger: {
    backgroundColor: vars.danger,
    color: vars.dangerText,
  } as React.CSSProperties,

  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  } as React.CSSProperties,

  loading: {
    opacity: 0.7,
    cursor: 'wait',
  } as React.CSSProperties,
}

export const detailStyles = {
  wrapper: {
    fontFamily: vars.font,
    color: vars.text,
    fontSize: '14px',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  } as React.CSSProperties,

  title: {
    fontSize: '24px',
    fontWeight: 600,
    margin: 0,
  } as React.CSSProperties,

  section: {
    marginBottom: '24px',
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    color: vars.text,
  } as React.CSSProperties,

  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '16px',
  } as React.CSSProperties,

  fieldLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: vars.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '4px',
  } as React.CSSProperties,

  fieldValue: {
    fontSize: '14px',
    color: vars.text,
  } as React.CSSProperties,

  link: {
    color: vars.textLink,
    textDecoration: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    backgroundColor: vars.bgActive,
    color: vars.text,
  } as React.CSSProperties,
}

export const timelineStyles = {
  wrapper: {
    fontFamily: vars.font,
    color: vars.text,
    fontSize: '14px',
  } as React.CSSProperties,

  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    position: 'relative' as const,
  } as React.CSSProperties,

  item: {
    display: 'flex',
    gap: '12px',
    paddingBottom: '20px',
    position: 'relative' as const,
  } as React.CSSProperties,

  line: {
    position: 'absolute' as const,
    left: '11px',
    top: '24px',
    bottom: 0,
    width: '2px',
    backgroundColor: vars.border,
  } as React.CSSProperties,

  dot: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: vars.primary,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: vars.primaryText,
    fontWeight: 700,
  } as React.CSSProperties,

  content: {
    flex: 1,
    paddingTop: '2px',
  } as React.CSSProperties,

  verb: {
    fontWeight: 600,
    fontSize: '13px',
    marginBottom: '2px',
  } as React.CSSProperties,

  actor: {
    fontSize: '12px',
    color: vars.textMuted,
  } as React.CSSProperties,

  timestamp: {
    fontSize: '12px',
    color: vars.textMuted,
  } as React.CSSProperties,

  diff: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: vars.bgActive,
    borderRadius: vars.radius,
    fontSize: '12px',
    fontFamily: vars.fontMono,
  } as React.CSSProperties,

  diffFrom: {
    color: vars.danger,
    textDecoration: 'line-through',
  } as React.CSSProperties,

  diffTo: {
    color: '#16a34a',
  } as React.CSSProperties,
}

export const dashboardStyles = {
  grid: {
    display: 'grid',
    gap: '16px',
    fontFamily: vars.font,
    color: vars.text,
  } as React.CSSProperties,

  card: {
    border: `1px solid ${vars.border}`,
    borderRadius: vars.radius,
    padding: '20px',
    backgroundColor: vars.bg,
  } as React.CSSProperties,

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  } as React.CSSProperties,

  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    margin: 0,
  } as React.CSSProperties,

  cardCount: {
    fontSize: '28px',
    fontWeight: 700,
    color: vars.primary,
  } as React.CSSProperties,

  cardList: {
    listStyle: 'none',
    margin: '12px 0 0',
    padding: 0,
  } as React.CSSProperties,

  cardListItem: {
    padding: '8px 0',
    borderBottom: `1px solid ${vars.border}`,
    fontSize: '13px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
}

export const searchStyles = {
  wrapper: {
    position: 'relative' as const,
    fontFamily: vars.font,
    color: vars.text,
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '14px',
    fontFamily: vars.font,
    border: `1px solid ${vars.border}`,
    borderRadius: vars.radius,
    outline: 'none',
    boxSizing: 'border-box' as const,
    color: vars.text,
    backgroundColor: vars.bg,
  } as React.CSSProperties,

  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    backgroundColor: vars.bg,
    border: `1px solid ${vars.border}`,
    borderRadius: vars.radius,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    maxHeight: '320px',
    overflow: 'auto',
    zIndex: 100,
  } as React.CSSProperties,

  resultItem: {
    padding: '10px 16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: `1px solid ${vars.border}`,
  } as React.CSSProperties,

  resultType: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: vars.textMuted,
    backgroundColor: vars.bgActive,
    padding: '2px 6px',
    borderRadius: '4px',
    flexShrink: 0,
  } as React.CSSProperties,

  resultTitle: {
    fontSize: '14px',
    fontWeight: 500,
  } as React.CSSProperties,

  resultId: {
    fontSize: '12px',
    color: vars.textMuted,
    fontFamily: vars.fontMono,
  } as React.CSSProperties,

  noResults: {
    padding: '16px',
    textAlign: 'center' as const,
    color: vars.textMuted,
    fontSize: '13px',
  } as React.CSSProperties,

  loading: {
    padding: '16px',
    textAlign: 'center' as const,
    color: vars.textMuted,
    fontSize: '13px',
  } as React.CSSProperties,
}

export const graphStyles = {
  wrapper: {
    fontFamily: vars.font,
    color: vars.text,
    border: `1px solid ${vars.border}`,
    borderRadius: vars.radius,
    overflow: 'hidden',
    position: 'relative' as const,
  } as React.CSSProperties,

  svg: {
    width: '100%',
    height: '100%',
  } as React.CSSProperties,

  nodeGroup: {
    cursor: 'pointer',
  } as React.CSSProperties,

  nodeRect: {
    fill: vars.bg,
    stroke: vars.border,
    strokeWidth: 1.5,
    rx: 6,
    ry: 6,
  },

  nodeText: {
    fontSize: '12px',
    fontFamily: vars.font,
    fill: vars.text,
    textAnchor: 'middle' as const,
    dominantBaseline: 'middle' as const,
  },

  nodeType: {
    fontSize: '10px',
    fontFamily: vars.font,
    fill: vars.textMuted,
    textAnchor: 'middle' as const,
  },

  edgeLine: {
    stroke: vars.border,
    strokeWidth: 1.5,
    fill: 'none',
  },

  edgeLabel: {
    fontSize: '10px',
    fontFamily: vars.font,
    fill: vars.textMuted,
    textAnchor: 'middle' as const,
  },
}
