import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Content, Asset, Site } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/content — deep coverage (RED)', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Content Noun Schema (~6 tests)
  // ===========================================================================
  describe('Content Noun schema', () => {
    it('has a schema with name "Content"', () => {
      expect(Content.$schema).toBeDefined()
      expect(Content.$schema.name).toBe('Content')
    })

    it('has required title field (string!)', () => {
      const titleField = Content.$schema.fields.get('title')
      expect(titleField).toBeDefined()
      expect(titleField!.kind).toBe('field')
      expect(titleField!.type).toBe('string')
      expect(titleField!.modifiers!.required).toBe(true)
    })

    it('has body field as plain string', () => {
      const bodyField = Content.$schema.fields.get('body')
      expect(bodyField).toBeDefined()
      expect(bodyField!.kind).toBe('field')
      expect(bodyField!.type).toBe('string')
    })

    it('has slug field with unique+indexed modifiers (string##)', () => {
      const slugField = Content.$schema.fields.get('slug')
      expect(slugField).toBeDefined()
      expect(slugField!.kind).toBe('field')
      expect(slugField!.type).toBe('string')
      expect(slugField!.modifiers!.unique).toBe(true)
      expect(slugField!.modifiers!.indexed).toBe(true)
    })

    it('has status enum with Draft, Published, Scheduled, Archived', () => {
      const statusField = Content.$schema.fields.get('status')
      expect(statusField).toBeDefined()
      expect(statusField!.kind).toBe('enum')
      expect(statusField!.enumValues).toEqual(['Draft', 'Published', 'Scheduled', 'Archived'])
    })

    it('has type enum with Page, Post, Article, Guide', () => {
      const typeField = Content.$schema.fields.get('type')
      expect(typeField).toBeDefined()
      expect(typeField!.kind).toBe('enum')
      expect(typeField!.enumValues).toEqual(['Page', 'Post', 'Article', 'Guide'])
    })

    it('has publishedAt as datetime field', () => {
      const field = Content.$schema.fields.get('publishedAt')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('datetime')
    })

    it('has visibility enum with Public, Private, Members', () => {
      const field = Content.$schema.fields.get('visibility')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Public', 'Private', 'Members'])
    })
  })

  // ===========================================================================
  // 2. Asset Noun Schema (~6 tests)
  // ===========================================================================
  describe('Asset Noun schema', () => {
    it('has a schema with name "Asset"', () => {
      expect(Asset.$schema).toBeDefined()
      expect(Asset.$schema.name).toBe('Asset')
    })

    it('has required name field (string!)', () => {
      const field = Asset.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(true)
    })

    it('has required url field (string!)', () => {
      const field = Asset.$schema.fields.get('url')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(true)
    })

    it('has required mimeType field (string!)', () => {
      const field = Asset.$schema.fields.get('mimeType')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(true)
    })

    it('has required size field (number!)', () => {
      const field = Asset.$schema.fields.get('size')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('number')
      expect(field!.modifiers!.required).toBe(true)
    })

    it('has alt as optional string field', () => {
      const field = Asset.$schema.fields.get('alt')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(false)
    })

    it('has type enum with Image, Video, Document, Audio, Archive, Other', () => {
      const field = Asset.$schema.fields.get('type')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Image', 'Video', 'Document', 'Audio', 'Archive', 'Other'])
    })

    it('has width and height as optional number fields', () => {
      const widthField = Asset.$schema.fields.get('width')
      const heightField = Asset.$schema.fields.get('height')
      expect(widthField).toBeDefined()
      expect(widthField!.type).toBe('number')
      expect(widthField!.modifiers!.required).toBe(false)
      expect(heightField).toBeDefined()
      expect(heightField!.type).toBe('number')
      expect(heightField!.modifiers!.required).toBe(false)
    })
  })

  // ===========================================================================
  // 3. Site Noun Schema (~5 tests)
  // ===========================================================================
  describe('Site Noun schema', () => {
    it('has a schema with name "Site"', () => {
      expect(Site.$schema).toBeDefined()
      expect(Site.$schema.name).toBe('Site')
    })

    it('has required name field (string!)', () => {
      const field = Site.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(true)
    })

    it('has subdomain as unique+indexed string (string##)', () => {
      const field = Site.$schema.fields.get('subdomain')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })

    it('has status enum with Draft, Published, Maintenance', () => {
      const field = Site.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Draft', 'Published', 'Maintenance'])
    })

    it('has visibility enum with Public, Private, Password', () => {
      const field = Site.$schema.fields.get('visibility')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Public', 'Private', 'Password'])
    })
  })

  // ===========================================================================
  // 4. Content Verbs (~6 tests)
  // ===========================================================================
  describe('Content verbs', () => {
    it('has default CRUD verbs registered in schema', () => {
      const verbs = Content.$schema.verbs
      expect(verbs.has('create')).toBe(true)
      expect(verbs.has('update')).toBe(true)
      expect(verbs.has('delete')).toBe(true)
    })

    it('has publish verb in schema verbs map', () => {
      const verbs = Content.$schema.verbs
      expect(verbs.has('publish')).toBe(true)
      const conj = verbs.get('publish')!
      expect(conj.action).toBe('publish')
      expect(conj.activity).toBe('publishing')
      expect(conj.event).toBe('published')
    })

    it('has archive verb in schema verbs map', () => {
      const verbs = Content.$schema.verbs
      expect(verbs.has('archive')).toBe(true)
      const conj = verbs.get('archive')!
      expect(conj.action).toBe('archive')
      expect(conj.activity).toBe('archiving')
      expect(conj.event).toBe('archived')
    })

    it('has schedule verb in schema verbs map', () => {
      const verbs = Content.$schema.verbs
      expect(verbs.has('schedule')).toBe(true)
      const conj = verbs.get('schedule')!
      expect(conj.action).toBe('schedule')
      expect(conj.activity).toBe('scheduling')
      expect(conj.event).toBe('scheduled')
    })

    it('publish action is callable as a function', () => {
      expect(typeof Content.publish).toBe('function')
    })

    it('archive action is callable as a function', () => {
      expect(typeof Content.archive).toBe('function')
    })
  })

  // ===========================================================================
  // 5. Content Lifecycle (~6 tests)
  // ===========================================================================
  describe('Content lifecycle', () => {
    it('creates content with Draft status by default fields', async () => {
      const content = await Content.create({ title: 'My First Post', status: 'Draft' })
      expect(content.$type).toBe('Content')
      expect(content.title).toBe('My First Post')
      expect(content.status).toBe('Draft')
    })

    it('publish verb transitions status from Draft to Published', async () => {
      const content = await Content.create({ title: 'Draft Article', status: 'Draft' })
      expect(content.status).toBe('Draft')

      const published = await Content.publish(content.$id)
      expect(published.status).toBe('Published')
      expect(published.$version).toBe(2)
    })

    it('archive verb transitions status to Archived', async () => {
      const content = await Content.create({ title: 'Old Post', status: 'Published' })
      const archived = await Content.archive(content.$id)
      expect(archived.status).toBe('Archived')
      expect(archived.$version).toBe(2)
    })

    it('schedule verb transitions status to Scheduled', async () => {
      const content = await Content.create({ title: 'Future Post', status: 'Draft' })
      const scheduled = await Content.schedule(content.$id)
      expect(scheduled.status).toBe('Scheduled')
      expect(scheduled.$version).toBe(2)
    })

    it('content preserves all fields through create and update', async () => {
      const content = await Content.create({
        title: 'Full Content',
        slug: 'full-content',
        body: 'Some body text',
        type: 'Post',
        status: 'Draft',
        excerpt: 'A short excerpt',
      })
      expect(content.title).toBe('Full Content')
      expect(content.slug).toBe('full-content')
      expect(content.body).toBe('Some body text')
      expect(content.type).toBe('Post')
      expect(content.excerpt).toBe('A short excerpt')

      const updated = await Content.update(content.$id, { title: 'Updated Content' })
      expect(updated.title).toBe('Updated Content')
      expect(updated.slug).toBe('full-content')
      expect(updated.body).toBe('Some body text')
    })

    it('multiple verb transitions increment version correctly', async () => {
      const content = await Content.create({ title: 'Lifecycle Post', status: 'Draft' })
      expect(content.$version).toBe(1)

      const published = await Content.publish(content.$id)
      expect(published.$version).toBe(2)

      const archived = await Content.archive(published.$id)
      expect(archived.$version).toBe(3)
    })
  })

  // ===========================================================================
  // 6. Relationships (~6 tests)
  // ===========================================================================
  describe('Relationships', () => {
    it('Content has author relationship to Contact (forward)', () => {
      const rels = Content.$schema.relationships
      expect(rels.has('author')).toBe(true)
      const authorRel = rels.get('author')!
      expect(authorRel.kind).toBe('relationship')
      expect(authorRel.operator).toBe('->')
      expect(authorRel.targetType).toBe('Contact')
    })

    it('Content has site relationship to Site (forward)', () => {
      const rels = Content.$schema.relationships
      expect(rels.has('site')).toBe(true)
      const siteRel = rels.get('site')!
      expect(siteRel.kind).toBe('relationship')
      expect(siteRel.operator).toBe('->')
      expect(siteRel.targetType).toBe('Site')
      expect(siteRel.backref).toBe('content')
    })

    it('Content has featuredImage relationship to Asset (forward)', () => {
      const rels = Content.$schema.relationships
      expect(rels.has('featuredImage')).toBe(true)
      const rel = rels.get('featuredImage')!
      expect(rel.kind).toBe('relationship')
      expect(rel.operator).toBe('->')
      expect(rel.targetType).toBe('Asset')
    })

    it('Site has content relationship to Content (reverse array)', () => {
      const rels = Site.$schema.relationships
      expect(rels.has('content')).toBe(true)
      const contentRel = rels.get('content')!
      expect(contentRel.kind).toBe('relationship')
      expect(contentRel.operator).toBe('<-')
      expect(contentRel.targetType).toBe('Content')
      expect(contentRel.backref).toBe('site')
      expect(contentRel.isArray).toBe(true)
    })

    it('Asset has uploadedBy relationship to Contact (forward)', () => {
      const rels = Asset.$schema.relationships
      expect(rels.has('uploadedBy')).toBe(true)
      const rel = rels.get('uploadedBy')!
      expect(rel.kind).toBe('relationship')
      expect(rel.operator).toBe('->')
      expect(rel.targetType).toBe('Contact')
    })

    it('Content and Site relationship is bidirectional (site <-> content)', () => {
      const contentSiteRel = Content.$schema.relationships.get('site')!
      const siteContentRel = Site.$schema.relationships.get('content')!

      // Content.site -> Site.content
      expect(contentSiteRel.targetType).toBe('Site')
      expect(contentSiteRel.backref).toBe('content')
      expect(contentSiteRel.operator).toBe('->')

      // Site.content <- Content.site[]
      expect(siteContentRel.targetType).toBe('Content')
      expect(siteContentRel.backref).toBe('site')
      expect(siteContentRel.operator).toBe('<-')
    })
  })

  // ===========================================================================
  // 7. Hook Registration (~5 tests)
  // ===========================================================================
  describe('Hook registration', () => {
    it('publishing hook is called before publish', async () => {
      const hookFn = vi.fn()
      Content.publishing(hookFn)

      const content = await Content.create({ title: 'Hook Test', status: 'Draft' })
      await Content.publish(content.$id)

      expect(hookFn).toHaveBeenCalledTimes(1)
    })

    it('published hook is called after publish', async () => {
      const hookFn = vi.fn()
      Content.published(hookFn)

      const content = await Content.create({ title: 'After Hook Test', status: 'Draft' })
      await Content.publish(content.$id)

      expect(hookFn).toHaveBeenCalledTimes(1)
      expect(hookFn.mock.calls[0][0]).toHaveProperty('$id')
      expect(hookFn.mock.calls[0][0].status).toBe('Published')
    })

    it('archiving hook is called before archive', async () => {
      const hookFn = vi.fn()
      Content.archiving(hookFn)

      const content = await Content.create({ title: 'Archive Hook', status: 'Published' })
      await Content.archive(content.$id)

      expect(hookFn).toHaveBeenCalledTimes(1)
    })

    it('archived hook is called after archive with instance', async () => {
      const hookFn = vi.fn()
      Content.archived(hookFn)

      const content = await Content.create({ title: 'Archived Hook', status: 'Published' })
      await Content.archive(content.$id)

      expect(hookFn).toHaveBeenCalledTimes(1)
      expect(hookFn.mock.calls[0][0].status).toBe('Archived')
    })

    it('hook unsubscribe function removes the hook', async () => {
      const hookFn = vi.fn()
      const unsub = Content.publishing(hookFn)

      const c1 = await Content.create({ title: 'Before Unsub', status: 'Draft' })
      await Content.publish(c1.$id)
      expect(hookFn).toHaveBeenCalledTimes(1)

      // Unsubscribe
      unsub()

      const c2 = await Content.create({ title: 'After Unsub', status: 'Draft' })
      await Content.publish(c2.$id)
      // Should not have been called again
      expect(hookFn).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // 8. Find and Filter (~5 tests)
  // ===========================================================================
  describe('Find and filter', () => {
    it('find returns all content when no filter provided', async () => {
      await Content.create({ title: 'Post A', status: 'Draft' })
      await Content.create({ title: 'Post B', status: 'Published' })
      await Content.create({ title: 'Post C', status: 'Draft' })

      const all = await Content.find()
      expect(all.length).toBe(3)
    })

    it('find filters by status', async () => {
      await Content.create({ title: 'Draft 1', status: 'Draft' })
      await Content.create({ title: 'Published 1', status: 'Published' })
      await Content.create({ title: 'Draft 2', status: 'Draft' })

      const drafts = await Content.find({ status: 'Draft' })
      expect(drafts.length).toBe(2)
      expect(drafts.every((c: any) => c.status === 'Draft')).toBe(true)
    })

    it('find filters by type', async () => {
      await Content.create({ title: 'Blog Post', type: 'Post' })
      await Content.create({ title: 'About Page', type: 'Page' })
      await Content.create({ title: 'Another Post', type: 'Post' })

      const posts = await Content.find({ type: 'Post' })
      expect(posts.length).toBe(2)
      expect(posts.every((c: any) => c.type === 'Post')).toBe(true)
    })

    it('find returns empty array when no matches', async () => {
      await Content.create({ title: 'Only Draft', status: 'Draft' })

      const archived = await Content.find({ status: 'Archived' })
      expect(archived).toEqual([])
    })

    it('get returns null for non-existent id', async () => {
      const result = await Content.get('content_nonexistent')
      expect(result).toBeNull()
    })
  })

  // ===========================================================================
  // 9. Schema Metadata (~3 tests)
  // ===========================================================================
  describe('Schema metadata', () => {
    it('Content schema has singular and plural forms', () => {
      expect(Content.$schema.singular).toBeDefined()
      expect(Content.$schema.plural).toBeDefined()
      expect(typeof Content.$schema.singular).toBe('string')
      expect(typeof Content.$schema.plural).toBe('string')
    })

    it('Content schema has slug derived from name', () => {
      expect(Content.$schema.slug).toBeDefined()
      expect(typeof Content.$schema.slug).toBe('string')
    })

    it('Content schema raw contains the original definition', () => {
      const raw = Content.$schema.raw
      expect(raw).toBeDefined()
      expect(raw.title).toBe('string!')
      expect(raw.slug).toBe('string##')
      expect(raw.status).toBe('Draft | Published | Scheduled | Archived')
      expect(raw.publish).toBe('Published')
      expect(raw.archive).toBe('Archived')
      expect(raw.schedule).toBe('Scheduled')
    })
  })
})
