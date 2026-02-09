import { describe, it, expect } from 'vitest'
import { generateSqid, generateEntityId, generateEventId } from '../src/id'

describe('@headlessly/objects — ID generation', () => {
  describe('generateSqid', () => {
    it('generates an 8-character string', () => {
      const sqid = generateSqid()
      expect(sqid).toHaveLength(8)
    })

    it('only contains alphanumeric characters', () => {
      const sqid = generateSqid()
      expect(sqid).toMatch(/^[a-zA-Z0-9]{8}$/)
    })

    it('generates unique values', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        ids.add(generateSqid())
      }
      expect(ids.size).toBe(100)
    })
  })

  describe('generateEntityId', () => {
    it('formats as {type}_{sqid}', () => {
      const id = generateEntityId('Contact')
      expect(id).toMatch(/^contact_[a-zA-Z0-9]{8}$/)
    })

    it('lowercases the type prefix', () => {
      const id = generateEntityId('FeatureFlag')
      expect(id).toMatch(/^featureflag_/)
    })
  })

  describe('generateEventId', () => {
    it('generates a prefixed event id', () => {
      const id = generateEventId()
      expect(id).toMatch(/^evt_/)
    })
  })
})
