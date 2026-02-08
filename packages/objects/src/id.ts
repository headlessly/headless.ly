/**
 * ID generation utilities for Digital Objects
 *
 * Generates short, URL-safe random IDs in the format:
 * - Entity IDs: {type}_{sqid}  (e.g., 'contact_aBc12XyZ')
 * - Event IDs:  evt_{sqid}     (e.g., 'evt_aBc12XyZ4321')
 */

const SQID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateSqid(length = 8): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += SQID_CHARS[Math.floor(Math.random() * SQID_CHARS.length)]
  }
  return result
}

export function generateEntityId(type: string): string {
  return `${type.toLowerCase()}_${generateSqid()}`
}

export function generateEventId(): string {
  return `evt_${generateSqid(12)}`
}
