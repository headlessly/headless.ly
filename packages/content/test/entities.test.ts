import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Content, Asset, Site } from '../src/index.ts'
import { setupTestProvider, expectMetaFields, expectCrudVerbs, expectVerbConjugation, testCrudLifecycle } from '../../test-utils'

describe('@headlessly/content', () => {
  setupTestProvider()

  describe('exports', () => {
    it('exports Content', () => {
      expect(Content).toBeDefined()
      expect(Content.$name).toBe('Content')
    })

    it('exports Asset', () => {
      expect(Asset).toBeDefined()
      expect(Asset.$name).toBe('Asset')
    })

    it('exports Site', () => {
      expect(Site).toBeDefined()
      expect(Site.$name).toBe('Site')
    })
  })

  describe('CRUD verbs', () => {
    it('Content has standard CRUD verbs', () => {
      expectCrudVerbs(Content)
    })

    it('Asset has standard CRUD verbs', () => {
      expectCrudVerbs(Asset)
    })

    it('Site has standard CRUD verbs', () => {
      expectCrudVerbs(Site)
    })
  })

  describe('verb conjugation', () => {
    it('Content has publish verb conjugation', () => {
      expectVerbConjugation(Content, 'publish', 'publishing', 'published')
    })

    it('Content has archive verb conjugation', () => {
      expectVerbConjugation(Content, 'archive', 'archiving', 'archived')
    })

    it('Content has schedule verb conjugation', () => {
      expectVerbConjugation(Content, 'schedule', 'scheduling', 'scheduled')
    })
  })

  describe('create with meta-fields', () => {
    it('Content has correct meta-fields on create', async () => {
      const content = await Content.create({ title: 'Getting Started Guide' })
      expectMetaFields(content, 'Content')
      expect(content.title).toBe('Getting Started Guide')
    })

    it('Asset has correct meta-fields on create', async () => {
      const asset = await Asset.create({ name: 'hero.png', filename: 'hero.png', url: 'https://cdn.example.com/hero.png', mimeType: 'image/png', size: 204800 })
      expectMetaFields(asset, 'Asset')
      expect(asset.name).toBe('hero.png')
      expect(asset.filename).toBe('hero.png')
      expect(asset.url).toBe('https://cdn.example.com/hero.png')
      expect(asset.mimeType).toBe('image/png')
      expect(asset.size).toBe(204800)
    })

    it('Site has correct meta-fields on create', async () => {
      const site = await Site.create({ name: 'Docs Site' })
      expectMetaFields(site, 'Site')
      expect(site.name).toBe('Docs Site')
    })
  })

  describe('full CRUD lifecycle', () => {
    it('Content supports full CRUD lifecycle', async () => {
      await testCrudLifecycle(Content, 'Content', { title: 'Getting Started Guide' }, { title: 'Updated Guide' })
    })

    it('Asset supports full CRUD lifecycle', async () => {
      await testCrudLifecycle(
        Asset,
        'Asset',
        { name: 'hero.png', filename: 'hero.png', url: 'https://cdn.example.com/hero.png', mimeType: 'image/png', size: 204800 },
        { name: 'banner.png' },
      )
    })

    it('Site supports full CRUD lifecycle', async () => {
      await testCrudLifecycle(Site, 'Site', { name: 'Docs Site' }, { name: 'Blog Site' })
    })
  })
})
