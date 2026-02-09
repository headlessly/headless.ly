/**
 * VerbButton — Action button that executes an entity verb.
 *
 * Maps to entity verbs (qualify, close, archive, etc.).
 * Shows loading state during execution and error feedback on failure.
 *
 * @example
 * ```tsx
 * import { VerbButton } from '@headlessly/ui'
 *
 * <VerbButton noun='Deal' entityId='deal_1' verb='close' />
 * <VerbButton noun='Contact' entityId='contact_1' verb='qualify' variant='primary' />
 * ```
 */

import React, { useState, useCallback } from 'react'
import { useHeadlessUI } from './provider.js'
import { formatLabel } from './schema-utils.js'
import { buttonStyles } from './styles.js'
import type { NounInstance, StylableProps } from './types.js'

export interface VerbButtonProps extends StylableProps {
  /** The noun name */
  noun: string
  /** The entity $id */
  entityId: string
  /** The verb to execute (e.g. 'qualify', 'close', 'archive') */
  verb: string
  /** Button label (defaults to formatted verb name) */
  label?: string
  /** Additional data to pass to the verb */
  data?: Record<string, unknown>
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'danger'
  /** Disabled state */
  disabled?: boolean
  /** Called on successful verb execution */
  onSuccess?: (entity: NounInstance) => void
  /** Called on error */
  onError?: (error: Error) => void
  /** Confirmation message shown before executing */
  confirm?: string
}

export function VerbButton({
  noun,
  entityId,
  verb,
  label,
  data,
  variant = 'secondary',
  disabled = false,
  onSuccess,
  onError,
  confirm: confirmMessage,
  className,
  style,
}: VerbButtonProps) {
  const { performVerb } = useHeadlessUI()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = useCallback(async () => {
    if (disabled || loading) return

    // Confirmation dialog
    if (confirmMessage) {
      const ok = window.confirm(confirmMessage)
      if (!ok) return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await performVerb(noun, entityId, verb, data)
      onSuccess?.(result)
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      setError(e.message)
      onError?.(e)
    } finally {
      setLoading(false)
    }
  }, [noun, entityId, verb, data, disabled, loading, confirmMessage, performVerb, onSuccess, onError])

  const variantStyle = variant === 'primary' ? buttonStyles.primary : variant === 'danger' ? buttonStyles.danger : buttonStyles.secondary

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <button
        type='button'
        style={{
          ...buttonStyles.base,
          ...variantStyle,
          ...(disabled ? buttonStyles.disabled : {}),
          ...(loading ? buttonStyles.loading : {}),
          ...(style ?? {}),
        }}
        className={className}
        onClick={handleClick}
        disabled={disabled || loading}
        data-testid={`verb-button-${verb}`}
        title={`${formatLabel(verb)} this ${noun}`}
      >
        {loading ? `${formatLabel(verb)}ing...` : (label ?? formatLabel(verb))}
      </button>
      {error && <span style={{ color: 'var(--hly-danger, #dc2626)', fontSize: '11px', marginTop: '4px' }}>{error}</span>}
    </span>
  )
}
