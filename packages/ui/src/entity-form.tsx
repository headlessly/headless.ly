/**
 * EntityForm — Create/edit form auto-generated from NounSchema.
 *
 * Reads schema fields to produce the correct input types:
 * string -> text input, enum -> select, boolean -> checkbox, datetime -> date picker.
 * Required fields marked with *, relationship fields use a text input for entity ID.
 *
 * @example
 * ```tsx
 * import { EntityForm } from '@headlessly/ui'
 *
 * // Create mode
 * <EntityForm noun='Contact' onSubmit={(data) => console.log(data)} />
 *
 * // Edit mode
 * <EntityForm noun='Contact' entity={existingContact} onSubmit={(data) => console.log(data)} />
 * ```
 */

import React, { useState, useCallback, useMemo } from 'react'
import { getNounSchema } from 'digital-objects'
import { useHeadlessUI } from './provider.js'
import { deriveFormFields, fieldInputType, isRequired, formatLabel } from './schema-utils.js'
import { formStyles, buttonStyles } from './styles.js'
import type { NounInstance, ParsedProperty, StylableProps, NounSchema } from './types.js'

export interface EntityFormProps extends StylableProps {
  /** The noun name (e.g. 'Contact', 'Deal') */
  noun: string
  /** Pass schema directly instead of registry lookup */
  schema?: NounSchema
  /** Existing entity for edit mode. If omitted, renders in create mode */
  entity?: NounInstance | null
  /** Called on successful submit with the form data */
  onSubmit?: (data: Record<string, unknown>) => void | Promise<void>
  /** Called after a successful create/update operation with the resulting entity */
  onSuccess?: (entity: NounInstance) => void
  /** Called on error */
  onError?: (error: Error) => void
  /** Called when cancel is clicked */
  onCancel?: () => void
  /** Fields to exclude from the form */
  excludeFields?: string[]
  /** Fields to include (if set, only these fields are shown) */
  includeFields?: string[]
  /** Custom field renderer */
  renderField?: (field: ParsedProperty, value: unknown, onChange: (value: unknown) => void) => React.ReactNode
  /** Whether to auto-submit to the API (default: true) */
  autoSubmit?: boolean
  /** Submit button label (default: 'Create' or 'Update') */
  submitLabel?: string
}

export function EntityForm({
  noun,
  schema: schemaProp,
  entity,
  onSubmit,
  onSuccess,
  onError,
  onCancel,
  excludeFields,
  includeFields,
  renderField,
  autoSubmit = true,
  submitLabel,
  className,
  style,
}: EntityFormProps) {
  const schema = schemaProp ?? getNounSchema(noun)
  const { createEntity, updateEntity } = useHeadlessUI()
  const isEdit = !!entity

  // Initialize form values from entity or empty
  const initialValues = useMemo(() => {
    const values: Record<string, unknown> = {}
    if (!schema) return values
    for (const field of deriveFormFields(schema)) {
      values[field.name] = entity?.[field.name] ?? ''
    }
    return values
  }, [schema, entity])

  const [values, setValues] = useState<Record<string, unknown>>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Derive displayable fields
  const fields = useMemo(() => {
    if (!schema) return []
    let f = deriveFormFields(schema)
    if (includeFields) {
      f = f.filter((p) => includeFields.includes(p.name))
    }
    if (excludeFields) {
      f = f.filter((p) => !excludeFields.includes(p.name))
    }
    return f
  }, [schema, includeFields, excludeFields])

  const handleChange = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    for (const field of fields) {
      if (isRequired(field)) {
        const val = values[field.name]
        if (val === '' || val === null || val === undefined) {
          errs[field.name] = `${formatLabel(field.name)} is required`
        }
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }, [fields, values])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validate()) return

      // Clean up empty strings to undefined
      const data: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(values)) {
        if (val !== '' && val !== undefined) {
          data[key] = val
        }
      }

      // Call custom onSubmit
      if (onSubmit) {
        try {
          await onSubmit(data)
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          onError?.(error)
          setSubmitError(error.message)
          return
        }
      }

      // Auto-submit to API
      if (autoSubmit) {
        setSubmitting(true)
        setSubmitError(null)
        try {
          const result = isEdit ? await updateEntity(noun, entity!.$id, data) : await createEntity(noun, data)
          onSuccess?.(result)
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          onError?.(error)
          setSubmitError(error.message)
        } finally {
          setSubmitting(false)
        }
      }
    },
    [values, validate, onSubmit, autoSubmit, isEdit, noun, entity, createEntity, updateEntity, onSuccess, onError],
  )

  if (!schema) {
    return (
      <div style={{ ...formStyles.form, ...(style ?? {}) }} className={className}>
        <p style={{ color: 'var(--hly-text-muted, #6b7280)' }}>Unknown noun: {noun}. Register it with Noun() first.</p>
      </div>
    )
  }

  return (
    <form style={{ ...formStyles.form, ...(style ?? {}) }} className={className} onSubmit={handleSubmit} data-testid='entity-form'>
      {fields.map((field) => {
        const inputType = fieldInputType(field)
        const required = isRequired(field)
        const value = values[field.name]

        // Custom renderer
        if (renderField) {
          const custom = renderField(field, value, (v) => handleChange(field.name, v))
          if (custom !== undefined) return <React.Fragment key={field.name}>{custom}</React.Fragment>
        }

        if (inputType === 'checkbox') {
          return (
            <div key={field.name} style={formStyles.fieldGroup}>
              <div style={formStyles.checkboxGroup}>
                <input
                  type='checkbox'
                  id={`field-${field.name}`}
                  style={formStyles.checkbox}
                  checked={!!value}
                  onChange={(e) => handleChange(field.name, e.target.checked)}
                  aria-label={formatLabel(field.name)}
                />
                <label htmlFor={`field-${field.name}`} style={formStyles.label}>
                  {formatLabel(field.name)}
                </label>
              </div>
              {errors[field.name] && <span style={formStyles.error}>{errors[field.name]}</span>}
            </div>
          )
        }

        if (inputType === 'select' && field.enumValues) {
          return (
            <div key={field.name} style={formStyles.fieldGroup}>
              <label htmlFor={`field-${field.name}`} style={formStyles.label}>
                {formatLabel(field.name)}
                {required && <span style={formStyles.required}>*</span>}
              </label>
              <select
                id={`field-${field.name}`}
                style={formStyles.select}
                value={String(value ?? '')}
                onChange={(e) => handleChange(field.name, e.target.value)}
                required={required}
                aria-label={formatLabel(field.name)}
              >
                <option value=''>Select {formatLabel(field.name)}...</option>
                {field.enumValues.map((v: string) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              {errors[field.name] && <span style={formStyles.error}>{errors[field.name]}</span>}
            </div>
          )
        }

        return (
          <div key={field.name} style={formStyles.fieldGroup}>
            <label htmlFor={`field-${field.name}`} style={formStyles.label}>
              {formatLabel(field.name)}
              {required && <span style={formStyles.required}>*</span>}
            </label>
            <input
              type={inputType}
              id={`field-${field.name}`}
              style={formStyles.input}
              value={String(value ?? '')}
              onChange={(e) => handleChange(field.name, inputType === 'number' ? Number(e.target.value) : e.target.value)}
              required={required}
              aria-label={formatLabel(field.name)}
            />
            {errors[field.name] && <span style={formStyles.error}>{errors[field.name]}</span>}
          </div>
        )
      })}

      {submitError && (
        <div style={formStyles.error} data-testid='form-error'>
          {submitError}
        </div>
      )}

      <div style={formStyles.actions}>
        {onCancel && (
          <button type='button' style={{ ...buttonStyles.base, ...buttonStyles.secondary }} onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type='submit'
          style={{ ...buttonStyles.base, ...buttonStyles.primary, ...(submitting ? buttonStyles.loading : {}) }}
          disabled={submitting}
          data-testid='form-submit'
        >
          {submitting ? 'Saving...' : submitLabel ?? (isEdit ? 'Update' : 'Create')}
        </button>
      </div>
    </form>
  )
}
