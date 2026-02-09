import { describe, it, expect, beforeEach } from 'vitest'
import { clearRegistry } from 'digital-objects'
import { LocalNounProvider } from '../src/local-provider'

describe('@headlessly/objects — LocalNounProvider', () => {
  let provider: LocalNounProvider

  beforeEach(() => {
    clearRegistry()
    provider = new LocalNounProvider({ context: 'https://headless.ly/~test' })
  })

  describe('CRUD operations', () => {
    it('creates an entity with meta-fields', async () => {
      const entity = await provider.create('Contact', { name: 'Alice' })
      expect(entity.$id).toMatch(/^contact_/)
      expect(entity.$type).toBe('Contact')
      expect(entity.$version).toBe(1)
      expect(entity.name).toBe('Alice')
    })

    it('gets an entity by id', async () => {
      const created = await provider.create('Contact', { name: 'Alice' })
      const fetched = await provider.get('Contact', created.$id)
      expect(fetched).toBeDefined()
      expect(fetched!.$id).toBe(created.$id)
      expect(fetched!.name).toBe('Alice')
    })

    it('returns null for non-existent entity', async () => {
      const result = await provider.get('Contact', 'contact_notfound')
      expect(result).toBeNull()
    })

    it('finds entities by type', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Contact', { name: 'Bob' })
      await provider.create('Deal', { name: 'Big Deal', value: 100 })

      const contacts = await provider.find('Contact')
      expect(contacts.length).toBe(2)
    })

    it('finds entities with filter', async () => {
      await provider.create('Contact', { name: 'Alice', stage: 'Lead' })
      await provider.create('Contact', { name: 'Bob', stage: 'Qualified' })

      const leads = await provider.find('Contact', { stage: 'Lead' })
      expect(leads.length).toBe(1)
      expect(leads[0].name).toBe('Alice')
    })

    it('updates an entity and increments version', async () => {
      const created = await provider.create('Contact', { name: 'Alice' })
      const updated = await provider.update('Contact', created.$id, { name: 'Alice Smith' })
      expect(updated.$version).toBe(2)
      expect(updated.name).toBe('Alice Smith')
    })

    it('deletes an entity', async () => {
      const created = await provider.create('Contact', { name: 'Alice' })
      const result = await provider.delete('Contact', created.$id)
      expect(result).toBe(true)

      const gone = await provider.get('Contact', created.$id)
      expect(gone).toBeNull()
    })

    it('returns false when deleting non-existent entity', async () => {
      const result = await provider.delete('Contact', 'contact_notfound')
      expect(result).toBe(false)
    })
  })

  describe('clear', () => {
    it('removes all stored entities', async () => {
      await provider.create('Contact', { name: 'Alice' })
      await provider.create('Deal', { name: 'Deal 1', value: 100 })
      provider.clear()

      const contacts = await provider.find('Contact')
      const deals = await provider.find('Deal')
      expect(contacts.length).toBe(0)
      expect(deals.length).toBe(0)
    })
  })
})
