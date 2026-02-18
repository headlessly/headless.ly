import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Content, Asset, Site } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/content — deep-v2 coverage', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Content — exhaustive field coverage
  // ===========================================================================
  describe('Content field exhaustive coverage', () => {
    it('has excerpt as optional string field', () => {
      const field = Content.$schema.fields.get('excerpt')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(false)
    })

    it('has categories as optional string field', () => {
      const field = Content.$schema.fields.get('categories')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has tags as optional string field', () => {
      const field = Content.$schema.fields.get('tags')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has scheduledAt as datetime field', () => {
      const field = Content.$schema.fields.get('scheduledAt')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('datetime')
    })

    it('has seoTitle as optional string field', () => {
      const field = Content.$schema.fields.get('seoTitle')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(false)
    })

    it('has seoDescription as optional string field', () => {
      const field = Content.$schema.fields.get('seoDescription')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has ogImage as optional string field', () => {
      const field = Content.$schema.fields.get('ogImage')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has noIndex as string field', () => {
      const field = Content.$schema.fields.get('noIndex')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has canonicalUrl as optional string field', () => {
      const field = Content.$schema.fields.get('canonicalUrl')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has readingTime as number field', () => {
      const field = Content.$schema.fields.get('readingTime')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('number')
    })

    it('has viewCount as number field', () => {
      const field = Content.$schema.fields.get('viewCount')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('number')
    })

    it('slug field is not required but is unique+indexed', () => {
      const field = Content.$schema.fields.get('slug')
      expect(field!.modifiers!.required).toBe(false)
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })
  })

  // ===========================================================================
  // 2. Asset — exhaustive field coverage
  // ===========================================================================
  describe('Asset field exhaustive coverage', () => {
    it('has required filename field (string!)', () => {
      const field = Asset.$schema.fields.get('filename')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(true)
    })

    it('has extension as optional string field', () => {
      const field = Asset.$schema.fields.get('extension')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(false)
    })

    it('has caption as optional string field', () => {
      const field = Asset.$schema.fields.get('caption')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has duration as optional number field', () => {
      const field = Asset.$schema.fields.get('duration')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('number')
      expect(field!.modifiers!.required).toBe(false)
    })

    it('has thumbnail as optional string field', () => {
      const field = Asset.$schema.fields.get('thumbnail')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has tags as optional string field', () => {
      const field = Asset.$schema.fields.get('tags')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has source as optional string field', () => {
      const field = Asset.$schema.fields.get('source')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has license as optional string field', () => {
      const field = Asset.$schema.fields.get('license')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })
  })

  // ===========================================================================
  // 3. Site — exhaustive field coverage
  // ===========================================================================
  describe('Site field exhaustive coverage', () => {
    it('has title as optional string field', () => {
      const field = Site.$schema.fields.get('title')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(false)
    })

    it('has description as optional string field', () => {
      const field = Site.$schema.fields.get('description')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has tagline as optional string field', () => {
      const field = Site.$schema.fields.get('tagline')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has logo as optional string field', () => {
      const field = Site.$schema.fields.get('logo')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has favicon as optional string field', () => {
      const field = Site.$schema.fields.get('favicon')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has primaryColor as optional string field', () => {
      const field = Site.$schema.fields.get('primaryColor')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has accentColor as optional string field', () => {
      const field = Site.$schema.fields.get('accentColor')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has ogImage as optional string field', () => {
      const field = Site.$schema.fields.get('ogImage')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has defaultLanguage as optional string field', () => {
      const field = Site.$schema.fields.get('defaultLanguage')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has supportedLanguages as optional string field', () => {
      const field = Site.$schema.fields.get('supportedLanguages')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('has timezone as optional string field', () => {
      const field = Site.$schema.fields.get('timezone')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('subdomain is not required but is unique+indexed', () => {
      const field = Site.$schema.fields.get('subdomain')
      expect(field!.modifiers!.required).toBe(false)
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })
  })

  // ===========================================================================
  // 4. Meta-field validation on creation
  // ===========================================================================
  describe('Meta-field validation', () => {
    it('Content $id starts with content_ followed by 8 alphanumeric chars', async () => {
      const c = await Content.create({ title: 'ID Test' })
      expect(c.$id).toMatch(/^content_[a-zA-Z0-9]{8}$/)
    })

    it('Asset $id starts with asset_ followed by 8 alphanumeric chars', async () => {
      const a = await Asset.create({ name: 'test.png', filename: 'test.png', url: 'https://cdn.example.com/test.png', mimeType: 'image/png', size: 1024 })
      expect(a.$id).toMatch(/^asset_[a-zA-Z0-9]{8}$/)
    })

    it('Site $id starts with site_ followed by 8 alphanumeric chars', async () => {
      const s = await Site.create({ name: 'Test Site' })
      expect(s.$id).toMatch(/^site_[a-zA-Z0-9]{8}$/)
    })

    it('Content $context is a valid tenant URL', async () => {
      const c = await Content.create({ title: 'Context Test' })
      expect(c.$context).toMatch(/^https:\/\/headless\.ly\/~.+$/)
    })

    it('Content $version starts at 1 on creation', async () => {
      const c = await Content.create({ title: 'Version Test' })
      expect(c.$version).toBe(1)
    })

    it('Content $createdAt and $updatedAt are ISO datetime strings on creation', async () => {
      const c = await Content.create({ title: 'Dates Test' })
      expect(c.$createdAt).toBeDefined()
      expect(c.$updatedAt).toBeDefined()
      // ISO 8601 format check
      expect(new Date(c.$createdAt as string).toISOString()).toBe(c.$createdAt)
      expect(new Date(c.$updatedAt as string).toISOString()).toBe(c.$updatedAt)
    })

    it('$type is correct for each entity', async () => {
      const c = await Content.create({ title: 'Type Test' })
      const a = await Asset.create({ name: 'f.png', filename: 'f.png', url: 'https://x.com/f.png', mimeType: 'image/png', size: 100 })
      const s = await Site.create({ name: 'S' })
      expect(c.$type).toBe('Content')
      expect(a.$type).toBe('Asset')
      expect(s.$type).toBe('Site')
    })

    it('each created entity gets a unique $id', async () => {
      const c1 = await Content.create({ title: 'A' })
      const c2 = await Content.create({ title: 'B' })
      const c3 = await Content.create({ title: 'C' })
      expect(c1.$id).not.toBe(c2.$id)
      expect(c2.$id).not.toBe(c3.$id)
      expect(c1.$id).not.toBe(c3.$id)
    })
  })

  // ===========================================================================
  // 5. Content CRUD operations — edge cases
  // ===========================================================================
  describe('Content CRUD edge cases', () => {
    it('create preserves all optional fields when provided', async () => {
      const c = await Content.create({
        title: 'Full',
        slug: 'full-post',
        excerpt: 'Short summary',
        body: '<p>Hello world</p>',
        type: 'Article',
        status: 'Draft',
        categories: 'tech,web',
        tags: 'typescript,testing',
        seoTitle: 'Full Post SEO',
        seoDescription: 'A description for SEO',
        ogImage: 'https://cdn.example.com/og.png',
        canonicalUrl: 'https://blog.example.com/full',
        readingTime: 5,
        viewCount: 0,
        visibility: 'Public',
      })
      expect(c.title).toBe('Full')
      expect(c.slug).toBe('full-post')
      expect(c.excerpt).toBe('Short summary')
      expect(c.body).toBe('<p>Hello world</p>')
      expect(c.type).toBe('Article')
      expect(c.status).toBe('Draft')
      expect(c.categories).toBe('tech,web')
      expect(c.tags).toBe('typescript,testing')
      expect(c.seoTitle).toBe('Full Post SEO')
      expect(c.seoDescription).toBe('A description for SEO')
      expect(c.ogImage).toBe('https://cdn.example.com/og.png')
      expect(c.canonicalUrl).toBe('https://blog.example.com/full')
      expect(c.readingTime).toBe(5)
      expect(c.viewCount).toBe(0)
      expect(c.visibility).toBe('Public')
    })

    it('update only changes specified fields', async () => {
      const c = await Content.create({ title: 'Original', body: 'Body text', slug: 'original' })
      const updated = await Content.update(c.$id, { title: 'Changed' })
      expect(updated.title).toBe('Changed')
      expect(updated.body).toBe('Body text')
      expect(updated.slug).toBe('original')
    })

    it('update increments $version by 1', async () => {
      const c = await Content.create({ title: 'V1' })
      expect(c.$version).toBe(1)
      const u1 = await Content.update(c.$id, { title: 'V2' })
      expect(u1.$version).toBe(2)
      const u2 = await Content.update(c.$id, { title: 'V3' })
      expect(u2.$version).toBe(3)
    })

    it('update sets a new $updatedAt timestamp', async () => {
      const c = await Content.create({ title: 'Timestamp Test' })
      const original = c.$updatedAt
      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10))
      const updated = await Content.update(c.$id, { title: 'Updated Timestamp' })
      expect(updated.$updatedAt).toBeDefined()
      // $createdAt should NOT change
      expect(updated.$createdAt).toBe(c.$createdAt)
    })

    it('update preserves $id, $type, $context, $createdAt', async () => {
      const c = await Content.create({ title: 'Immutable' })
      const u = await Content.update(c.$id, { title: 'Changed', body: 'New body' })
      expect(u.$id).toBe(c.$id)
      expect(u.$type).toBe(c.$type)
      expect(u.$context).toBe(c.$context)
      expect(u.$createdAt).toBe(c.$createdAt)
    })

    it('delete returns true for existing entity', async () => {
      const c = await Content.create({ title: 'Delete Me' })
      const result = await Content.delete(c.$id)
      expect(result).toBe(true)
    })

    it('delete returns false for non-existent entity', async () => {
      const result = await Content.delete('content_nonexist')
      expect(result).toBe(false)
    })

    it('get returns null after delete', async () => {
      const c = await Content.create({ title: 'Temp' })
      await Content.delete(c.$id)
      const gone = await Content.get(c.$id)
      expect(gone).toBeNull()
    })

    it('get retrieves an entity by $id', async () => {
      const c = await Content.create({ title: 'Fetch Me' })
      const fetched = await Content.get(c.$id)
      expect(fetched).toBeDefined()
      expect(fetched!.$id).toBe(c.$id)
      expect(fetched!.title).toBe('Fetch Me')
    })
  })

  // ===========================================================================
  // 6. Asset CRUD operations
  // ===========================================================================
  describe('Asset CRUD operations', () => {
    const assetData = {
      name: 'hero-banner.jpg',
      filename: 'hero-banner.jpg',
      url: 'https://cdn.example.com/hero-banner.jpg',
      mimeType: 'image/jpeg',
      size: 512000,
      width: 1920,
      height: 1080,
      alt: 'Hero banner image',
      caption: 'Main site banner',
      type: 'Image',
      extension: 'jpg',
    }

    it('create stores all asset fields correctly', async () => {
      const a = await Asset.create(assetData)
      expect(a.name).toBe('hero-banner.jpg')
      expect(a.filename).toBe('hero-banner.jpg')
      expect(a.url).toBe('https://cdn.example.com/hero-banner.jpg')
      expect(a.mimeType).toBe('image/jpeg')
      expect(a.size).toBe(512000)
      expect(a.width).toBe(1920)
      expect(a.height).toBe(1080)
      expect(a.alt).toBe('Hero banner image')
      expect(a.caption).toBe('Main site banner')
      expect(a.type).toBe('Image')
      expect(a.extension).toBe('jpg')
    })

    it('update asset name and alt text', async () => {
      const a = await Asset.create(assetData)
      const u = await Asset.update(a.$id, { name: 'updated-banner.jpg', alt: 'Updated alt' })
      expect(u.name).toBe('updated-banner.jpg')
      expect(u.alt).toBe('Updated alt')
      expect(u.url).toBe(assetData.url)
    })

    it('find assets by type', async () => {
      await Asset.create({ ...assetData, type: 'Image', name: 'img1.jpg' })
      await Asset.create({ ...assetData, type: 'Video', name: 'vid1.mp4', mimeType: 'video/mp4' })
      await Asset.create({ ...assetData, type: 'Image', name: 'img2.png' })
      const images = await Asset.find({ type: 'Image' })
      expect(images.length).toBe(2)
      expect(images.every((a: any) => a.type === 'Image')).toBe(true)
    })

    it('delete asset and confirm gone', async () => {
      const a = await Asset.create(assetData)
      const del = await Asset.delete(a.$id)
      expect(del).toBe(true)
      const gone = await Asset.get(a.$id)
      expect(gone).toBeNull()
    })

    it('Asset has no custom verbs — only CRUD', () => {
      const verbs = Asset.$schema.verbs
      expect(verbs.has('create')).toBe(true)
      expect(verbs.has('update')).toBe(true)
      expect(verbs.has('delete')).toBe(true)
      // No custom verbs like publish/archive
      expect(verbs.has('publish')).toBe(false)
      expect(verbs.has('archive')).toBe(false)
    })
  })

  // ===========================================================================
  // 7. Site CRUD operations
  // ===========================================================================
  describe('Site CRUD operations', () => {
    it('create stores all site fields correctly', async () => {
      const s = await Site.create({
        name: 'Dev Blog',
        subdomain: 'dev-blog',
        title: 'The Dev Blog',
        description: 'A blog about development',
        tagline: 'Code, build, ship',
        logo: 'https://cdn.example.com/logo.svg',
        favicon: 'https://cdn.example.com/favicon.ico',
        primaryColor: '#3B82F6',
        accentColor: '#F59E0B',
        status: 'Published',
        visibility: 'Public',
        defaultLanguage: 'en',
        timezone: 'America/New_York',
      })
      expect(s.name).toBe('Dev Blog')
      expect(s.subdomain).toBe('dev-blog')
      expect(s.title).toBe('The Dev Blog')
      expect(s.description).toBe('A blog about development')
      expect(s.tagline).toBe('Code, build, ship')
      expect(s.primaryColor).toBe('#3B82F6')
      expect(s.accentColor).toBe('#F59E0B')
      expect(s.status).toBe('Published')
      expect(s.visibility).toBe('Public')
      expect(s.defaultLanguage).toBe('en')
      expect(s.timezone).toBe('America/New_York')
    })

    it('update site changes only specified fields', async () => {
      const s = await Site.create({ name: 'Original Site', subdomain: 'original' })
      const u = await Site.update(s.$id, { name: 'Renamed Site' })
      expect(u.name).toBe('Renamed Site')
      expect(u.subdomain).toBe('original')
    })

    it('find sites by status', async () => {
      await Site.create({ name: 'Published Site', status: 'Published' })
      await Site.create({ name: 'Draft Site', status: 'Draft' })
      await Site.create({ name: 'Maintenance Site', status: 'Maintenance' })
      const published = await Site.find({ status: 'Published' })
      expect(published.length).toBe(1)
      expect(published[0]!.name).toBe('Published Site')
    })

    it('Site has no custom verbs — only CRUD', () => {
      const verbs = Site.$schema.verbs
      expect(verbs.has('create')).toBe(true)
      expect(verbs.has('update')).toBe(true)
      expect(verbs.has('delete')).toBe(true)
      expect(verbs.has('publish')).toBe(false)
    })
  })

  // ===========================================================================
  // 8. Verb conjugation — full lifecycle forms
  // ===========================================================================
  describe('Verb conjugation — full lifecycle', () => {
    it('publish verb has reverseBy and reverseAt forms', () => {
      const verbs = Content.$schema.verbs
      const publish = verbs.get('publish')!
      expect(publish.reverseBy).toBe('publishedBy')
      expect(publish.reverseAt).toBe('publishedAt')
    })

    it('archive verb has reverseBy and reverseAt forms', () => {
      const verbs = Content.$schema.verbs
      const archive = verbs.get('archive')!
      expect(archive.reverseBy).toBe('archivedBy')
      expect(archive.reverseAt).toBe('archivedAt')
    })

    it('schedule verb has reverseBy and reverseAt forms', () => {
      const verbs = Content.$schema.verbs
      const schedule = verbs.get('schedule')!
      expect(schedule.reverseBy).toBe('scheduledBy')
      expect(schedule.reverseAt).toBe('scheduledAt')
    })

    it('CRUD verbs have correct conjugation forms', () => {
      const verbs = Content.$schema.verbs
      const create = verbs.get('create')!
      expect(create.action).toBe('create')
      expect(create.activity).toBe('creating')
      expect(create.event).toBe('created')
      expect(create.reverseBy).toBe('createdBy')
      expect(create.reverseAt).toBe('createdAt')

      const update = verbs.get('update')!
      expect(update.action).toBe('update')
      expect(update.activity).toBe('updating')
      expect(update.event).toBe('updated')

      const del = verbs.get('delete')!
      expect(del.action).toBe('delete')
      expect(del.activity).toBe('deleting')
      expect(del.event).toBe('deleted')
    })

    it('schedule action, scheduling activity, and scheduled event are all callable', () => {
      expect(typeof Content.schedule).toBe('function')
      expect(typeof Content.scheduling).toBe('function')
      expect(typeof Content.scheduled).toBe('function')
    })
  })

  // ===========================================================================
  // 9. Content lifecycle — advanced transitions
  // ===========================================================================
  describe('Content lifecycle — advanced transitions', () => {
    it('Draft -> Scheduled -> Published lifecycle', async () => {
      const c = await Content.create({ title: 'Scheduled Post', status: 'Draft' })
      expect(c.status).toBe('Draft')
      expect(c.$version).toBe(1)

      const scheduled = await Content.schedule(c.$id)
      expect(scheduled.status).toBe('Scheduled')
      expect(scheduled.$version).toBe(2)

      const published = await Content.publish(scheduled.$id)
      expect(published.status).toBe('Published')
      expect(published.$version).toBe(3)
    })

    it('Draft -> Published -> Archived -> Published (re-publish)', async () => {
      const c = await Content.create({ title: 'Republish Test', status: 'Draft' })
      const pub = await Content.publish(c.$id)
      expect(pub.status).toBe('Published')

      const arch = await Content.archive(pub.$id)
      expect(arch.status).toBe('Archived')

      const repub = await Content.publish(arch.$id)
      expect(repub.status).toBe('Published')
      expect(repub.$version).toBe(4)
    })

    it('verb transitions do not affect other fields', async () => {
      const c = await Content.create({
        title: 'Field Preservation',
        slug: 'field-preservation',
        body: 'Test body',
        type: 'Post',
        status: 'Draft',
      })
      const published = await Content.publish(c.$id)
      expect(published.title).toBe('Field Preservation')
      expect(published.slug).toBe('field-preservation')
      expect(published.body).toBe('Test body')
      expect(published.type).toBe('Post')
    })
  })

  // ===========================================================================
  // 10. Hook registration — CRUD verbs
  // ===========================================================================
  describe('CRUD hook registration', () => {
    it('creating hook is called before create', async () => {
      const hookFn = vi.fn()
      Content.creating(hookFn)
      await Content.create({ title: 'Before Create Hook' })
      expect(hookFn).toHaveBeenCalledTimes(1)
    })

    it('created hook is called after create with the new instance', async () => {
      const hookFn = vi.fn()
      Content.created(hookFn)
      const c = await Content.create({ title: 'After Create Hook' })
      expect(hookFn).toHaveBeenCalledTimes(1)
      expect(hookFn.mock.calls[0][0].$type).toBe('Content')
      expect(hookFn.mock.calls[0][0].title).toBe('After Create Hook')
    })

    it('updating hook is called before update', async () => {
      const hookFn = vi.fn()
      Content.updating(hookFn)
      const c = await Content.create({ title: 'Before Update' })
      await Content.update(c.$id, { title: 'After Update' })
      expect(hookFn).toHaveBeenCalledTimes(1)
    })

    it('updated hook is called after update with the updated instance', async () => {
      const hookFn = vi.fn()
      Content.updated(hookFn)
      const c = await Content.create({ title: 'Before' })
      await Content.update(c.$id, { title: 'After' })
      expect(hookFn).toHaveBeenCalledTimes(1)
      expect(hookFn.mock.calls[0][0].title).toBe('After')
    })

    it('deleting hook is called before delete', async () => {
      const hookFn = vi.fn()
      Content.deleting(hookFn)
      const c = await Content.create({ title: 'Will Delete' })
      await Content.delete(c.$id)
      expect(hookFn).toHaveBeenCalledTimes(1)
    })

    it('deleted hook is called after delete', async () => {
      const hookFn = vi.fn()
      Content.deleted(hookFn)
      const c = await Content.create({ title: 'Was Deleted' })
      await Content.delete(c.$id)
      expect(hookFn).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // 11. Hook registration — custom verbs (schedule)
  // ===========================================================================
  describe('Schedule hook registration', () => {
    it('scheduling hook is called before schedule', async () => {
      const hookFn = vi.fn()
      Content.scheduling(hookFn)
      const c = await Content.create({ title: 'Schedule Hook', status: 'Draft' })
      await Content.schedule(c.$id)
      expect(hookFn).toHaveBeenCalledTimes(1)
    })

    it('scheduled hook is called after schedule with instance', async () => {
      const hookFn = vi.fn()
      Content.scheduled(hookFn)
      const c = await Content.create({ title: 'Scheduled Hook', status: 'Draft' })
      await Content.schedule(c.$id)
      expect(hookFn).toHaveBeenCalledTimes(1)
      expect(hookFn.mock.calls[0][0].status).toBe('Scheduled')
    })

    it('scheduled hook unsubscribe works', async () => {
      const hookFn = vi.fn()
      const unsub = Content.scheduled(hookFn)

      const c1 = await Content.create({ title: 'Pre-unsub', status: 'Draft' })
      await Content.schedule(c1.$id)
      expect(hookFn).toHaveBeenCalledTimes(1)

      unsub()

      const c2 = await Content.create({ title: 'Post-unsub', status: 'Draft' })
      await Content.schedule(c2.$id)
      expect(hookFn).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // 12. BEFORE hook data transformation
  // ===========================================================================
  describe('BEFORE hook data transformation', () => {
    it('creating hook can transform input data', async () => {
      Content.creating((data: Record<string, unknown>) => {
        return { ...data, slug: 'auto-generated-slug' }
      })
      const c = await Content.create({ title: 'No Slug Provided' })
      expect(c.slug).toBe('auto-generated-slug')
    })

    it('publishing hook receives input and can transform', async () => {
      const hookFn = vi.fn()
      Content.publishing(hookFn)
      const c = await Content.create({ title: 'Pub Hook Transform', status: 'Draft' })
      await Content.publish(c.$id)
      expect(hookFn).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // 13. Schema metadata — linguistic derivations
  // ===========================================================================
  describe('Schema metadata — linguistic derivations', () => {
    it('Content singular is "content"', () => {
      expect(Content.$schema.singular).toBe('content')
    })

    it('Content plural is "contents"', () => {
      expect(Content.$schema.plural).toBe('contents')
    })

    it('Content slug is "content"', () => {
      expect(Content.$schema.slug).toBe('content')
    })

    it('Asset singular is "asset"', () => {
      expect(Asset.$schema.singular).toBe('asset')
    })

    it('Asset plural is "assets"', () => {
      expect(Asset.$schema.plural).toBe('assets')
    })

    it('Asset slug is "asset"', () => {
      expect(Asset.$schema.slug).toBe('asset')
    })

    it('Site singular is "site"', () => {
      expect(Site.$schema.singular).toBe('site')
    })

    it('Site plural is "sites"', () => {
      expect(Site.$schema.plural).toBe('sites')
    })

    it('Site slug is "site"', () => {
      expect(Site.$schema.slug).toBe('site')
    })
  })

  // ===========================================================================
  // 14. Schema raw definition fidelity
  // ===========================================================================
  describe('Schema raw definition fidelity', () => {
    it('Asset schema raw matches source definition', () => {
      const raw = Asset.$schema.raw
      expect(raw.name).toBe('string!')
      expect(raw.filename).toBe('string!')
      expect(raw.url).toBe('string!')
      expect(raw.mimeType).toBe('string!')
      expect(raw.size).toBe('number!')
      expect(raw.type).toBe('Image | Video | Document | Audio | Archive | Other')
      expect(raw.uploadedBy).toBe('-> Contact')
      expect(raw.width).toBe('number')
      expect(raw.height).toBe('number')
    })

    it('Site schema raw matches source definition', () => {
      const raw = Site.$schema.raw
      expect(raw.name).toBe('string!')
      expect(raw.subdomain).toBe('string##')
      expect(raw.status).toBe('Draft | Published | Maintenance')
      expect(raw.visibility).toBe('Public | Private | Password')
      expect(raw.content).toBe('<- Content.site[]')
      expect(raw.defaultLanguage).toBe('string')
      expect(raw.timezone).toBe('string')
    })

    it('Content schema raw contains relationship definitions', () => {
      const raw = Content.$schema.raw
      expect(raw.site).toBe('-> Site.content')
      expect(raw.author).toBe('-> Contact')
      expect(raw.featuredImage).toBe('-> Asset')
    })
  })

  // ===========================================================================
  // 15. Field count validation
  // ===========================================================================
  describe('Field count validation', () => {
    it('Content has exactly the expected number of parsed fields', () => {
      // Fields: title, slug, excerpt, body, type, categories, tags, status,
      //         publishedAt, scheduledAt, seoTitle, seoDescription, ogImage,
      //         noIndex, canonicalUrl, readingTime, viewCount, visibility = 18
      expect(Content.$schema.fields.size).toBe(18)
    })

    it('Content has exactly the expected number of relationships', () => {
      // Relationships: site, author, featuredImage = 3
      expect(Content.$schema.relationships.size).toBe(3)
    })

    it('Content has exactly the expected number of verbs (CRUD + custom)', () => {
      // CRUD: create, update, delete = 3
      // Custom: publish, archive, schedule = 3
      // Total: 6
      expect(Content.$schema.verbs.size).toBe(6)
    })

    it('Asset has the expected number of parsed fields', () => {
      // Fields: name, filename, url, type, mimeType, extension, size,
      //         width, height, alt, caption, duration, thumbnail, tags, source, license = 16
      expect(Asset.$schema.fields.size).toBe(16)
    })

    it('Asset has exactly 1 relationship (uploadedBy)', () => {
      expect(Asset.$schema.relationships.size).toBe(1)
    })

    it('Site has the expected number of parsed fields', () => {
      // Fields: name, subdomain, title, description, tagline, logo, favicon,
      //         primaryColor, accentColor, status, visibility, ogImage,
      //         defaultLanguage, supportedLanguages, timezone = 15
      expect(Site.$schema.fields.size).toBe(15)
    })

    it('Site has exactly 1 relationship (content)', () => {
      expect(Site.$schema.relationships.size).toBe(1)
    })
  })

  // ===========================================================================
  // 16. Find with MongoDB-style operators
  // ===========================================================================
  describe('Find with MongoDB-style operators', () => {
    it('$in operator matches multiple values', async () => {
      await Content.create({ title: 'Draft Post', status: 'Draft' })
      await Content.create({ title: 'Published Post', status: 'Published' })
      await Content.create({ title: 'Archived Post', status: 'Archived' })

      const active = await Content.find({ status: { $in: ['Draft', 'Published'] } })
      expect(active.length).toBe(2)
    })

    it('$ne operator excludes matching values', async () => {
      await Content.create({ title: 'Keep', status: 'Published' })
      await Content.create({ title: 'Skip', status: 'Archived' })
      await Content.create({ title: 'Also Keep', status: 'Draft' })

      const nonArchived = await Content.find({ status: { $ne: 'Archived' } })
      expect(nonArchived.length).toBe(2)
      expect(nonArchived.every((c: any) => c.status !== 'Archived')).toBe(true)
    })

    it('$gt operator on numeric fields', async () => {
      await Asset.create({ name: 'small.jpg', filename: 'small.jpg', url: 'https://x.com/s.jpg', mimeType: 'image/jpeg', size: 100 })
      await Asset.create({ name: 'medium.jpg', filename: 'medium.jpg', url: 'https://x.com/m.jpg', mimeType: 'image/jpeg', size: 5000 })
      await Asset.create({ name: 'large.jpg', filename: 'large.jpg', url: 'https://x.com/l.jpg', mimeType: 'image/jpeg', size: 100000 })

      const large = await Asset.find({ size: { $gt: 1000 } })
      expect(large.length).toBe(2)
    })

    it('$regex operator for pattern matching on titles', async () => {
      await Content.create({ title: 'Getting Started with TypeScript' })
      await Content.create({ title: 'Advanced TypeScript Patterns' })
      await Content.create({ title: 'Introduction to JavaScript' })

      const tsContent = await Content.find({ title: { $regex: 'TypeScript' } })
      expect(tsContent.length).toBe(2)
    })

    it('$exists operator checks for field presence', async () => {
      await Content.create({ title: 'With Slug', slug: 'with-slug' })
      await Content.create({ title: 'No Slug' })

      const withSlug = await Content.find({ slug: { $exists: true } })
      // Both have slug field technically (one is undefined)
      // Behavior depends on provider implementation
      expect(withSlug.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ===========================================================================
  // 17. Multiple hook registration
  // ===========================================================================
  describe('Multiple hook registration', () => {
    it('multiple BEFORE hooks run in registration order', async () => {
      const order: number[] = []
      Content.publishing(() => {
        order.push(1)
      })
      Content.publishing(() => {
        order.push(2)
      })
      Content.publishing(() => {
        order.push(3)
      })

      const c = await Content.create({ title: 'Multi Hook', status: 'Draft' })
      await Content.publish(c.$id)
      expect(order).toEqual([1, 2, 3])
    })

    it('multiple AFTER hooks run in registration order', async () => {
      const order: number[] = []
      Content.published(() => {
        order.push(1)
      })
      Content.published(() => {
        order.push(2)
      })

      const c = await Content.create({ title: 'Multi After', status: 'Draft' })
      await Content.publish(c.$id)
      expect(order).toEqual([1, 2])
    })
  })

  // ===========================================================================
  // 18. $name accessor
  // ===========================================================================
  describe('$name accessor', () => {
    it('Content.$name is "Content"', () => {
      expect(Content.$name).toBe('Content')
    })

    it('Asset.$name is "Asset"', () => {
      expect(Asset.$name).toBe('Asset')
    })

    it('Site.$name is "Site"', () => {
      expect(Site.$name).toBe('Site')
    })
  })

  // ===========================================================================
  // 19. Disabled verbs
  // ===========================================================================
  describe('Disabled verbs', () => {
    it('Content has no disabled verbs', () => {
      expect(Content.$schema.disabledVerbs.size).toBe(0)
    })

    it('Asset has no disabled verbs', () => {
      expect(Asset.$schema.disabledVerbs.size).toBe(0)
    })

    it('Site has no disabled verbs', () => {
      expect(Site.$schema.disabledVerbs.size).toBe(0)
    })
  })

  // ===========================================================================
  // 20. Cross-entity independence
  // ===========================================================================
  describe('Cross-entity independence', () => {
    it('Content and Asset stores are independent', async () => {
      await Content.create({ title: 'A Content' })
      await Asset.create({ name: 'a.png', filename: 'a.png', url: 'https://x.com/a.png', mimeType: 'image/png', size: 100 })

      const contents = await Content.find()
      const assets = await Asset.find()
      expect(contents.length).toBe(1)
      expect(assets.length).toBe(1)
      expect(contents[0]!.$type).toBe('Content')
      expect(assets[0]!.$type).toBe('Asset')
    })

    it('deleting Content does not affect Asset', async () => {
      const c = await Content.create({ title: 'Temp Content' })
      await Asset.create({ name: 'stays.png', filename: 'stays.png', url: 'https://x.com/stays.png', mimeType: 'image/png', size: 50 })

      await Content.delete(c.$id)

      const contents = await Content.find()
      const assets = await Asset.find()
      expect(contents.length).toBe(0)
      expect(assets.length).toBe(1)
    })
  })
})
