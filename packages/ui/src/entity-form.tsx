'use client'

/**
 * EntityForm — Schema-driven create/edit form for a single entity.
 *
 * Uses digital-objects schema introspection to auto-generate form fields
 * and @headlessly/react hooks for data operations.
 */

import { useState, useMemo, useCallback, type FormEvent } from 'react'
import { getNounSchema, type NounInstance } from 'digital-objects'
import { useEntity, useCreate, useUpdate } from '@headlessly/react'
import { deriveFormFields, deriveDefaultValues, validateFormData, fieldInputType, formatLabel, isRequired } from './schema-utils.js'

export interface EntityFormProps {
  /** Entity type name (e.g. 'Contact') */
  noun: string
  /** Entity ID for edit mode. If omitted, renders in create mode. */
  id?: string
  /** Callback after successful submit */
  onSubmit?: (entity: NounInstance) => void
  /** Callback when cancel is clicked */
  onCancel?: () => void
  /** Optional className */
  className?: string
}

export function EntityForm({ noun, id, onSubmit, onCancel, className }: EntityFormProps) {
  const schema = getNounSchema(noun)
  const fields = useMemo(() => (schema ? deriveFormFields(schema) : []), [schema])
  const defaults = useMemo(() => (schema ? deriveDefaultValues(schema) : {}), [schema])

  // Load existing entity in edit mode
  const { data: existing, loading: loadingEntity } = useEntity(noun, id ?? '', { include: [] })
  const { create, loading: creating } = useCreate(noun)
  const { update, loading: updating } = useUpdate(noun)

  const isEdit = !!id
  const initialValues = isEdit && existing ? (existing as Record<string, unknown>) : defaults
  const [formData, setFormData] = useState<Record<string, unknown>>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Sync form data when existing entity loads
  useMemo(() => {
    if (isEdit && existing) {
      setFormData(existing as Record<string, unknown>)
    }
  }, [isEdit, existing])

  const handleChange = useCallback((key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      if (!schema) return

      const validationErrors = validateFormData(schema, formData)
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors)
        return
      }

      // Strip meta-fields from form data for submission
      const submitData: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(formData)) {
        if (!key.startsWith('$')) {
          submitData[key] = value
        }
      }

      if (isEdit && id) {
        const result = await update(id, submitData)
        if (result) onSubmit?.(result as NounInstance)
      } else {
        const result = await create(submitData)
        if (result) onSubmit?.(result as NounInstance)
      }
    },
    [schema, formData, isEdit, id, create, update, onSubmit],
  )

  if (!schema) {
    return <div className={className}>Unknown entity: {noun}</div>
  }

  if (isEdit && loadingEntity) {
    return <div className={className}>Loading...</div>
  }

  const isSubmitting = creating || updating

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className ?? ''}`}>
      <h2 className='text-lg font-semibold'>{isEdit ? `Edit ${schema.name}` : `Create ${schema.name}`}</h2>

      {fields.map((field) => {
        const inputType = fieldInputType(field)
        const required = isRequired(field)
        const value = formData[field.name] ?? ''
        const error = errors[field.name]

        return (
          <div key={field.name} className='space-y-1'>
            <label className='block text-sm font-medium'>
              {formatLabel(field.name)}
              {required && <span className='text-destructive ml-1'>*</span>}
            </label>

            {inputType === 'select' && field.enumValues ? (
              <select value={String(value)} onChange={(e) => handleChange(field.name, e.target.value)} className='w-full rounded-md border px-3 py-2 text-sm'>
                {!required && <option value=''>—</option>}
                {field.enumValues.map((v: string) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : inputType === 'checkbox' ? (
              <input type='checkbox' checked={!!value} onChange={(e) => handleChange(field.name, e.target.checked)} className='rounded border' />
            ) : inputType === 'textarea' ? (
              <textarea
                value={String(value)}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className='w-full rounded-md border px-3 py-2 text-sm'
                rows={4}
              />
            ) : (
              <input
                type={inputType}
                value={String(value)}
                onChange={(e) => handleChange(field.name, inputType === 'number' ? Number(e.target.value) : e.target.value)}
                required={required}
                className='w-full rounded-md border px-3 py-2 text-sm'
              />
            )}

            {error && <p className='text-sm text-destructive'>{error}</p>}
          </div>
        )
      })}

      <div className='flex gap-2 pt-2'>
        <button type='submit' disabled={isSubmitting} className='rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50'>
          {isSubmitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
        </button>
        {onCancel && (
          <button type='button' onClick={onCancel} className='rounded-md border px-4 py-2 text-sm'>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
