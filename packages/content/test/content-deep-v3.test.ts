import { describe, it, expect, vi } from 'vitest'
import { Content, Asset, Site } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/content — deep-v3 coverage', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Content schema raw — every key validated
  // ===========================================================================
  describe('Content schema raw — complete key-by-key', () => {
    it('raw.title is "string!"', () => {
      expect(Content.$schema.raw.title).toBe('string!')
    })

    it('raw.slug is "string##"', () => {
      expect(Content.$schema.raw.slug).toBe('string##')
    })

    it('raw.excerpt is "string"', () => {
      expect(Content.$schema.raw.excerpt).toBe('string')
    })

    it('raw.body is "string"', () => {
      expect(Content.$schema.raw.body).toBe('string')
    })

    it('raw.site is "-> Site.content"', () => {
      expect(Content.$schema.raw.site).toBe('-> Site.content')
    })

    it('raw.type is "Page | Post | Article | Guide"', () => {
      expect(Content.$schema.raw.type).toBe('Page | Post | Article | Guide')
    })

    it('raw.categories is "string"', () => {
      expect(Content.$schema.raw.categories).toBe('string')
    })

    it('raw.tags is "string"', () => {
      expect(Content.$schema.raw.tags).toBe('string')
    })

    it('raw.status is "Draft | Published | Scheduled | Archived"', () => {
      expect(Content.$schema.raw.status).toBe('Draft | Published | Scheduled | Archived')
    })

    it('raw.publishedAt is "datetime"', () => {
      expect(Content.$schema.raw.publishedAt).toBe('datetime')
    })

    it('raw.scheduledAt is "datetime"', () => {
      expect(Content.$schema.raw.scheduledAt).toBe('datetime')
    })

    it('raw.author is "-> Contact"', () => {
      expect(Content.$schema.raw.author).toBe('-> Contact')
    })

    it('raw.seoTitle is "string"', () => {
      expect(Content.$schema.raw.seoTitle).toBe('string')
    })

    it('raw.seoDescription is "string"', () => {
      expect(Content.$schema.raw.seoDescription).toBe('string')
    })

    it('raw.ogImage is "string"', () => {
      expect(Content.$schema.raw.ogImage).toBe('string')
    })

    it('raw.noIndex is "string"', () => {
      expect(Content.$schema.raw.noIndex).toBe('string')
    })

    it('raw.canonicalUrl is "string"', () => {
      expect(Content.$schema.raw.canonicalUrl).toBe('string')
    })

    it('raw.featuredImage is "-> Asset"', () => {
      expect(Content.$schema.raw.featuredImage).toBe('-> Asset')
    })

    it('raw.readingTime is "number"', () => {
      expect(Content.$schema.raw.readingTime).toBe('number')
    })

    it('raw.viewCount is "number"', () => {
      expect(Content.$schema.raw.viewCount).toBe('number')
    })

    it('raw.visibility is "Public | Private | Members"', () => {
      expect(Content.$schema.raw.visibility).toBe('Public | Private | Members')
    })

    it('raw.publish is "Published"', () => {
      expect(Content.$schema.raw.publish).toBe('Published')
    })

    it('raw.archive is "Archived"', () => {
      expect(Content.$schema.raw.archive).toBe('Archived')
    })

    it('raw.schedule is "Scheduled"', () => {
      expect(Content.$schema.raw.schedule).toBe('Scheduled')
    })

    it('raw has exactly 24 keys (18 fields + 3 relationships + 3 verbs)', () => {
      const keys = Object.keys(Content.$schema.raw)
      expect(keys.length).toBe(24)
    })
  })

  // ===========================================================================
  // 2. Asset schema raw — every key validated
  // ===========================================================================
  describe('Asset schema raw — complete key-by-key', () => {
    it('raw.name is "string!"', () => {
      expect(Asset.$schema.raw.name).toBe('string!')
    })

    it('raw.filename is "string!"', () => {
      expect(Asset.$schema.raw.filename).toBe('string!')
    })

    it('raw.url is "string!"', () => {
      expect(Asset.$schema.raw.url).toBe('string!')
    })

    it('raw.type is "Image | Video | Document | Audio | Archive | Other"', () => {
      expect(Asset.$schema.raw.type).toBe('Image | Video | Document | Audio | Archive | Other')
    })

    it('raw.mimeType is "string!"', () => {
      expect(Asset.$schema.raw.mimeType).toBe('string!')
    })

    it('raw.extension is "string"', () => {
      expect(Asset.$schema.raw.extension).toBe('string')
    })

    it('raw.size is "number!"', () => {
      expect(Asset.$schema.raw.size).toBe('number!')
    })

    it('raw.width is "number"', () => {
      expect(Asset.$schema.raw.width).toBe('number')
    })

    it('raw.height is "number"', () => {
      expect(Asset.$schema.raw.height).toBe('number')
    })

    it('raw.alt is "string"', () => {
      expect(Asset.$schema.raw.alt).toBe('string')
    })

    it('raw.caption is "string"', () => {
      expect(Asset.$schema.raw.caption).toBe('string')
    })

    it('raw.duration is "number"', () => {
      expect(Asset.$schema.raw.duration).toBe('number')
    })

    it('raw.thumbnail is "string"', () => {
      expect(Asset.$schema.raw.thumbnail).toBe('string')
    })

    it('raw.tags is "string"', () => {
      expect(Asset.$schema.raw.tags).toBe('string')
    })

    it('raw.uploadedBy is "-> Contact"', () => {
      expect(Asset.$schema.raw.uploadedBy).toBe('-> Contact')
    })

    it('raw.source is "string"', () => {
      expect(Asset.$schema.raw.source).toBe('string')
    })

    it('raw.license is "string"', () => {
      expect(Asset.$schema.raw.license).toBe('string')
    })

    it('raw has exactly 17 keys (16 fields + 1 relationship)', () => {
      const keys = Object.keys(Asset.$schema.raw)
      expect(keys.length).toBe(17)
    })
  })

  // ===========================================================================
  // 3. Site schema raw — every key validated
  // ===========================================================================
  describe('Site schema raw — complete key-by-key', () => {
    it('raw.name is "string!"', () => {
      expect(Site.$schema.raw.name).toBe('string!')
    })

    it('raw.subdomain is "string##"', () => {
      expect(Site.$schema.raw.subdomain).toBe('string##')
    })

    it('raw.title is "string"', () => {
      expect(Site.$schema.raw.title).toBe('string')
    })

    it('raw.description is "string"', () => {
      expect(Site.$schema.raw.description).toBe('string')
    })

    it('raw.tagline is "string"', () => {
      expect(Site.$schema.raw.tagline).toBe('string')
    })

    it('raw.logo is "string"', () => {
      expect(Site.$schema.raw.logo).toBe('string')
    })

    it('raw.favicon is "string"', () => {
      expect(Site.$schema.raw.favicon).toBe('string')
    })

    it('raw.primaryColor is "string"', () => {
      expect(Site.$schema.raw.primaryColor).toBe('string')
    })

    it('raw.accentColor is "string"', () => {
      expect(Site.$schema.raw.accentColor).toBe('string')
    })

    it('raw.status is "Draft | Published | Maintenance"', () => {
      expect(Site.$schema.raw.status).toBe('Draft | Published | Maintenance')
    })

    it('raw.visibility is "Public | Private | Password"', () => {
      expect(Site.$schema.raw.visibility).toBe('Public | Private | Password')
    })

    it('raw.ogImage is "string"', () => {
      expect(Site.$schema.raw.ogImage).toBe('string')
    })

    it('raw.content is "<- Content.site[]"', () => {
      expect(Site.$schema.raw.content).toBe('<- Content.site[]')
    })

    it('raw.defaultLanguage is "string"', () => {
      expect(Site.$schema.raw.defaultLanguage).toBe('string')
    })

    it('raw.supportedLanguages is "string"', () => {
      expect(Site.$schema.raw.supportedLanguages).toBe('string')
    })

    it('raw.timezone is "string"', () => {
      expect(Site.$schema.raw.timezone).toBe('string')
    })

    it('raw has exactly 16 keys (15 fields + 1 relationship)', () => {
      const keys = Object.keys(Site.$schema.raw)
      expect(keys.length).toBe(16)
    })
  })

  // ===========================================================================
  // 4. Content — each type enum value through create+read
  // ===========================================================================
  describe('Content type enum create+read roundtrip', () => {
    it('can create and read back type "Page"', async () => {
      const c = await Content.create({ title: 'My Page', type: 'Page' })
      expect(c.type).toBe('Page')
      const fetched = await Content.get(c.$id)
      expect(fetched!.type).toBe('Page')
    })

    it('can create and read back type "Post"', async () => {
      const c = await Content.create({ title: 'My Post', type: 'Post' })
      expect(c.type).toBe('Post')
      const fetched = await Content.get(c.$id)
      expect(fetched!.type).toBe('Post')
    })

    it('can create and read back type "Article"', async () => {
      const c = await Content.create({ title: 'My Article', type: 'Article' })
      expect(c.type).toBe('Article')
    })

    it('can create and read back type "Guide"', async () => {
      const c = await Content.create({ title: 'My Guide', type: 'Guide' })
      expect(c.type).toBe('Guide')
    })
  })

  // ===========================================================================
  // 5. Asset — each type enum value through create
  // ===========================================================================
  describe('Asset type enum create roundtrip', () => {
    const base = { filename: 'f', url: 'https://x.com/f', mimeType: 'application/octet-stream', size: 100 }

    it('can create Asset with type "Image"', async () => {
      const a = await Asset.create({ ...base, name: 'img', type: 'Image' })
      expect(a.type).toBe('Image')
    })

    it('can create Asset with type "Video"', async () => {
      const a = await Asset.create({ ...base, name: 'vid', type: 'Video' })
      expect(a.type).toBe('Video')
    })

    it('can create Asset with type "Document"', async () => {
      const a = await Asset.create({ ...base, name: 'doc', type: 'Document' })
      expect(a.type).toBe('Document')
    })

    it('can create Asset with type "Audio"', async () => {
      const a = await Asset.create({ ...base, name: 'aud', type: 'Audio' })
      expect(a.type).toBe('Audio')
    })

    it('can create Asset with type "Archive"', async () => {
      const a = await Asset.create({ ...base, name: 'arc', type: 'Archive' })
      expect(a.type).toBe('Archive')
    })

    it('can create Asset with type "Other"', async () => {
      const a = await Asset.create({ ...base, name: 'other', type: 'Other' })
      expect(a.type).toBe('Other')
    })
  })

  // ===========================================================================
  // 6. Site — each status and visibility enum value through create
  // ===========================================================================
  describe('Site status/visibility enum roundtrips', () => {
    it('can create Site with status "Draft"', async () => {
      const s = await Site.create({ name: 'Draft Site', status: 'Draft' })
      expect(s.status).toBe('Draft')
    })

    it('can create Site with status "Maintenance"', async () => {
      const s = await Site.create({ name: 'Maint Site', status: 'Maintenance' })
      expect(s.status).toBe('Maintenance')
    })

    it('can create Site with visibility "Private"', async () => {
      const s = await Site.create({ name: 'Private Site', visibility: 'Private' })
      expect(s.visibility).toBe('Private')
    })

    it('can create Site with visibility "Password"', async () => {
      const s = await Site.create({ name: 'Protected Site', visibility: 'Password' })
      expect(s.visibility).toBe('Password')
    })
  })

  // ===========================================================================
  // 7. Content SEO fields — create, update, and read roundtrips
  // ===========================================================================
  describe('Content SEO fields — update roundtrips', () => {
    it('update seoTitle and verify preservation of seoDescription', async () => {
      const c = await Content.create({
        title: 'SEO Test',
        seoTitle: 'Original SEO Title',
        seoDescription: 'Original Description',
      })
      const u = await Content.update(c.$id, { seoTitle: 'Updated SEO Title' })
      expect(u.seoTitle).toBe('Updated SEO Title')
      expect(u.seoDescription).toBe('Original Description')
    })

    it('update ogImage and canonicalUrl together', async () => {
      const c = await Content.create({ title: 'OG Test' })
      const u = await Content.update(c.$id, {
        ogImage: 'https://cdn.example.com/og-new.png',
        canonicalUrl: 'https://blog.example.com/og-test',
      })
      expect(u.ogImage).toBe('https://cdn.example.com/og-new.png')
      expect(u.canonicalUrl).toBe('https://blog.example.com/og-test')
    })

    it('noIndex persists through create and get roundtrip', async () => {
      const c = await Content.create({ title: 'Hidden Page', noIndex: 'true' })
      const fetched = await Content.get(c.$id)
      expect(fetched!.noIndex).toBe('true')
    })
  })

  // ===========================================================================
  // 8. Site configuration fields — update roundtrips
  // ===========================================================================
  describe('Site configuration fields — update roundtrips', () => {
    it('update primaryColor and accentColor', async () => {
      const s = await Site.create({ name: 'Themed Site', primaryColor: '#000000', accentColor: '#FFFFFF' })
      const u = await Site.update(s.$id, { primaryColor: '#FF0000', accentColor: '#00FF00' })
      expect(u.primaryColor).toBe('#FF0000')
      expect(u.accentColor).toBe('#00FF00')
    })

    it('update defaultLanguage and timezone', async () => {
      const s = await Site.create({ name: 'I18n Site', defaultLanguage: 'en', timezone: 'UTC' })
      const u = await Site.update(s.$id, { defaultLanguage: 'fr', timezone: 'Europe/Paris' })
      expect(u.defaultLanguage).toBe('fr')
      expect(u.timezone).toBe('Europe/Paris')
    })

    it('update supportedLanguages string', async () => {
      const s = await Site.create({ name: 'Multi-lang', supportedLanguages: 'en,fr' })
      const u = await Site.update(s.$id, { supportedLanguages: 'en,fr,de,es' })
      expect(u.supportedLanguages).toBe('en,fr,de,es')
    })

    it('update logo and favicon', async () => {
      const s = await Site.create({ name: 'Brand Site' })
      const u = await Site.update(s.$id, {
        logo: 'https://cdn.example.com/new-logo.svg',
        favicon: 'https://cdn.example.com/new-fav.ico',
      })
      expect(u.logo).toBe('https://cdn.example.com/new-logo.svg')
      expect(u.favicon).toBe('https://cdn.example.com/new-fav.ico')
    })

    it('update Site ogImage', async () => {
      const s = await Site.create({ name: 'OG Site' })
      const u = await Site.update(s.$id, { ogImage: 'https://cdn.example.com/site-og.png' })
      expect(u.ogImage).toBe('https://cdn.example.com/site-og.png')
    })
  })

  // ===========================================================================
  // 9. Concurrent publish/archive operations
  // ===========================================================================
  describe('Concurrent verb operations', () => {
    it('concurrent publish of multiple independent content items', async () => {
      const c1 = await Content.create({ title: 'Concurrent 1', status: 'Draft' })
      const c2 = await Content.create({ title: 'Concurrent 2', status: 'Draft' })
      const c3 = await Content.create({ title: 'Concurrent 3', status: 'Draft' })

      const [p1, p2, p3] = await Promise.all([
        Content.publish(c1.$id),
        Content.publish(c2.$id),
        Content.publish(c3.$id),
      ])

      expect(p1.status).toBe('Published')
      expect(p2.status).toBe('Published')
      expect(p3.status).toBe('Published')
    })

    it('concurrent archive of multiple published items', async () => {
      const c1 = await Content.create({ title: 'Arch 1', status: 'Published' })
      const c2 = await Content.create({ title: 'Arch 2', status: 'Published' })

      const [a1, a2] = await Promise.all([Content.archive(c1.$id), Content.archive(c2.$id)])

      expect(a1.status).toBe('Archived')
      expect(a2.status).toBe('Archived')
    })

    it('concurrent mixed verbs: publish one, archive another, schedule a third', async () => {
      const d = await Content.create({ title: 'Will Publish', status: 'Draft' })
      const p = await Content.create({ title: 'Will Archive', status: 'Published' })
      const s = await Content.create({ title: 'Will Schedule', status: 'Draft' })

      const [pub, arch, sched] = await Promise.all([
        Content.publish(d.$id),
        Content.archive(p.$id),
        Content.schedule(s.$id),
      ])

      expect(pub.status).toBe('Published')
      expect(arch.status).toBe('Archived')
      expect(sched.status).toBe('Scheduled')
    })
  })

  // ===========================================================================
  // 10. Bulk CRUD with filtering
  // ===========================================================================
  describe('Bulk CRUD with filtering', () => {
    it('create many content items and filter by visibility', async () => {
      await Content.create({ title: 'Public 1', visibility: 'Public' })
      await Content.create({ title: 'Private 1', visibility: 'Private' })
      await Content.create({ title: 'Members 1', visibility: 'Members' })
      await Content.create({ title: 'Public 2', visibility: 'Public' })

      const publicItems = await Content.find({ visibility: 'Public' })
      expect(publicItems.length).toBe(2)
      expect(publicItems.every((c: any) => c.visibility === 'Public')).toBe(true)
    })

    it('create assets with various types and filter by mimeType', async () => {
      const base = { filename: 'f', url: 'https://x.com/f', size: 100 }
      await Asset.create({ ...base, name: 'a.jpg', mimeType: 'image/jpeg', type: 'Image' })
      await Asset.create({ ...base, name: 'b.png', mimeType: 'image/png', type: 'Image' })
      await Asset.create({ ...base, name: 'c.mp4', mimeType: 'video/mp4', type: 'Video' })

      const jpegAssets = await Asset.find({ mimeType: 'image/jpeg' })
      expect(jpegAssets.length).toBe(1)
      expect(jpegAssets[0]!.name).toBe('a.jpg')
    })

    it('create multiple sites and filter by visibility', async () => {
      await Site.create({ name: 'Public Site', visibility: 'Public' })
      await Site.create({ name: 'Private Site', visibility: 'Private' })
      await Site.create({ name: 'Password Site', visibility: 'Password' })

      const privateSites = await Site.find({ visibility: 'Private' })
      expect(privateSites.length).toBe(1)
      expect(privateSites[0]!.name).toBe('Private Site')
    })

    it('delete multiple content items and verify find reflects deletions', async () => {
      const c1 = await Content.create({ title: 'Keep' })
      const c2 = await Content.create({ title: 'Remove 1' })
      const c3 = await Content.create({ title: 'Remove 2' })

      await Content.delete(c2.$id)
      await Content.delete(c3.$id)

      const remaining = await Content.find()
      expect(remaining.length).toBe(1)
      expect(remaining[0]!.title).toBe('Keep')
    })
  })

  // ===========================================================================
  // 11. Content — required vs optional field defaults
  // ===========================================================================
  describe('Content — required vs optional field defaults', () => {
    it('creating with only title yields undefined for optional fields', async () => {
      const c = await Content.create({ title: 'Minimal Content' })
      expect(c.title).toBe('Minimal Content')
      expect(c.slug).toBeUndefined()
      expect(c.excerpt).toBeUndefined()
      expect(c.body).toBeUndefined()
      expect(c.seoTitle).toBeUndefined()
      expect(c.seoDescription).toBeUndefined()
      expect(c.ogImage).toBeUndefined()
      expect(c.canonicalUrl).toBeUndefined()
      expect(c.noIndex).toBeUndefined()
      expect(c.readingTime).toBeUndefined()
      expect(c.viewCount).toBeUndefined()
    })
  })

  // ===========================================================================
  // 12. Asset — media-specific fields roundtrip
  // ===========================================================================
  describe('Asset media-specific fields roundtrip', () => {
    it('create audio asset with duration and retrieve', async () => {
      const a = await Asset.create({
        name: 'podcast.mp3',
        filename: 'podcast.mp3',
        url: 'https://cdn.example.com/podcast.mp3',
        mimeType: 'audio/mpeg',
        size: 5242880,
        type: 'Audio',
        duration: 1800,
      })
      expect(a.duration).toBe(1800)
      const fetched = await Asset.get(a.$id)
      expect(fetched!.duration).toBe(1800)
    })

    it('create video asset with thumbnail, width, height, and duration', async () => {
      const a = await Asset.create({
        name: 'demo.mp4',
        filename: 'demo.mp4',
        url: 'https://cdn.example.com/demo.mp4',
        mimeType: 'video/mp4',
        size: 104857600,
        type: 'Video',
        width: 1920,
        height: 1080,
        duration: 300,
        thumbnail: 'https://cdn.example.com/demo-thumb.jpg',
      })
      expect(a.width).toBe(1920)
      expect(a.height).toBe(1080)
      expect(a.duration).toBe(300)
      expect(a.thumbnail).toBe('https://cdn.example.com/demo-thumb.jpg')
    })

    it('create asset with source and license metadata', async () => {
      const a = await Asset.create({
        name: 'stock-photo.jpg',
        filename: 'stock-photo.jpg',
        url: 'https://cdn.example.com/stock-photo.jpg',
        mimeType: 'image/jpeg',
        size: 2048000,
        source: 'Unsplash',
        license: 'CC0',
      })
      expect(a.source).toBe('Unsplash')
      expect(a.license).toBe('CC0')
      const fetched = await Asset.get(a.$id)
      expect(fetched!.source).toBe('Unsplash')
      expect(fetched!.license).toBe('CC0')
    })

    it('update asset duration and thumbnail', async () => {
      const a = await Asset.create({
        name: 'clip.mp4',
        filename: 'clip.mp4',
        url: 'https://cdn.example.com/clip.mp4',
        mimeType: 'video/mp4',
        size: 500000,
        duration: 60,
      })
      const u = await Asset.update(a.$id, {
        duration: 120,
        thumbnail: 'https://cdn.example.com/clip-thumb.jpg',
      })
      expect(u.duration).toBe(120)
      expect(u.thumbnail).toBe('https://cdn.example.com/clip-thumb.jpg')
    })
  })

  // ===========================================================================
  // 13. Content visibility enum — create+read for each value
  // ===========================================================================
  describe('Content visibility enum roundtrips', () => {
    it('creates and reads back visibility "Public"', async () => {
      const c = await Content.create({ title: 'Pub', visibility: 'Public' })
      const f = await Content.get(c.$id)
      expect(f!.visibility).toBe('Public')
    })

    it('creates and reads back visibility "Private"', async () => {
      const c = await Content.create({ title: 'Priv', visibility: 'Private' })
      const f = await Content.get(c.$id)
      expect(f!.visibility).toBe('Private')
    })

    it('creates and reads back visibility "Members"', async () => {
      const c = await Content.create({ title: 'Mem', visibility: 'Members' })
      const f = await Content.get(c.$id)
      expect(f!.visibility).toBe('Members')
    })
  })

  // ===========================================================================
  // 14. Hook data transformation chains
  // ===========================================================================
  describe('Hook data transformation chains', () => {
    it('BEFORE create hook adds default slug from title', async () => {
      Content.creating((data: Record<string, unknown>) => {
        if (!data.slug && typeof data.title === 'string') {
          return { ...data, slug: data.title.toLowerCase().replace(/\s+/g, '-') }
        }
        return data
      })
      const c = await Content.create({ title: 'My Awesome Post' })
      expect(c.slug).toBe('my-awesome-post')
    })

    it('BEFORE create hook adds default viewCount of zero', async () => {
      Content.creating((data: Record<string, unknown>) => {
        if (data.viewCount === undefined) {
          return { ...data, viewCount: 0 }
        }
        return data
      })
      const c = await Content.create({ title: 'View Count Default' })
      expect(c.viewCount).toBe(0)
    })

    it('AFTER publish hook fires with correct status on the instance', async () => {
      const statuses: string[] = []
      Content.published((instance: any) => {
        statuses.push(instance.status)
      })
      const c = await Content.create({ title: 'After Pub Chain', status: 'Draft' })
      await Content.publish(c.$id)
      expect(statuses).toEqual(['Published'])
    })

    it('BEFORE + AFTER hooks both fire in a single publish call', async () => {
      const events: string[] = []
      Content.publishing(() => {
        events.push('before')
      })
      Content.published(() => {
        events.push('after')
      })
      const c = await Content.create({ title: 'Both Hooks', status: 'Draft' })
      await Content.publish(c.$id)
      expect(events).toEqual(['before', 'after'])
    })
  })

  // ===========================================================================
  // 15. Relationship schema — detailed property checks
  // ===========================================================================
  describe('Relationship schema — detailed property checks', () => {
    it('Content.author has no backref (single reference)', () => {
      const rel = Content.$schema.relationships.get('author')!
      expect(rel.backref).toBeUndefined()
    })

    it('Content.author is not an array relationship', () => {
      const rel = Content.$schema.relationships.get('author')!
      expect(rel.isArray).toBeFalsy()
    })

    it('Content.featuredImage has no backref', () => {
      const rel = Content.$schema.relationships.get('featuredImage')!
      expect(rel.backref).toBeUndefined()
    })

    it('Content.featuredImage is not an array relationship', () => {
      const rel = Content.$schema.relationships.get('featuredImage')!
      expect(rel.isArray).toBeFalsy()
    })

    it('Site.content is an array reverse relationship', () => {
      const rel = Site.$schema.relationships.get('content')!
      expect(rel.isArray).toBe(true)
      expect(rel.operator).toBe('<-')
    })

    it('Asset.uploadedBy has no backref', () => {
      const rel = Asset.$schema.relationships.get('uploadedBy')!
      expect(rel.backref).toBeUndefined()
    })

    it('Asset.uploadedBy is a forward relationship', () => {
      const rel = Asset.$schema.relationships.get('uploadedBy')!
      expect(rel.operator).toBe('->')
    })
  })

  // ===========================================================================
  // 16. Content status enum — create+read for each value
  // ===========================================================================
  describe('Content status enum create+read roundtrip', () => {
    it('creates and reads back status "Draft"', async () => {
      const c = await Content.create({ title: 'D', status: 'Draft' })
      const f = await Content.get(c.$id)
      expect(f!.status).toBe('Draft')
    })

    it('creates and reads back status "Published"', async () => {
      const c = await Content.create({ title: 'P', status: 'Published' })
      const f = await Content.get(c.$id)
      expect(f!.status).toBe('Published')
    })

    it('creates and reads back status "Scheduled"', async () => {
      const c = await Content.create({ title: 'S', status: 'Scheduled' })
      const f = await Content.get(c.$id)
      expect(f!.status).toBe('Scheduled')
    })

    it('creates and reads back status "Archived"', async () => {
      const c = await Content.create({ title: 'A', status: 'Archived' })
      const f = await Content.get(c.$id)
      expect(f!.status).toBe('Archived')
    })
  })

  // ===========================================================================
  // 17. Schema field iteration — all fields belong to correct maps
  // ===========================================================================
  describe('Schema field iteration', () => {
    it('Content fields map does not contain relationship keys', () => {
      const fieldKeys = Array.from(Content.$schema.fields.keys())
      expect(fieldKeys).not.toContain('site')
      expect(fieldKeys).not.toContain('author')
      expect(fieldKeys).not.toContain('featuredImage')
    })

    it('Content relationships map does not contain field keys', () => {
      const relKeys = Array.from(Content.$schema.relationships.keys())
      expect(relKeys).not.toContain('title')
      expect(relKeys).not.toContain('slug')
      expect(relKeys).not.toContain('status')
    })

    it('Asset fields map does not contain relationship keys', () => {
      const fieldKeys = Array.from(Asset.$schema.fields.keys())
      expect(fieldKeys).not.toContain('uploadedBy')
    })

    it('Site fields map does not contain relationship keys', () => {
      const fieldKeys = Array.from(Site.$schema.fields.keys())
      expect(fieldKeys).not.toContain('content')
    })

    it('all Content field names are present in fields map', () => {
      const expected = [
        'title', 'slug', 'excerpt', 'body', 'type', 'categories', 'tags',
        'status', 'publishedAt', 'scheduledAt', 'seoTitle', 'seoDescription',
        'ogImage', 'noIndex', 'canonicalUrl', 'readingTime', 'viewCount', 'visibility',
      ]
      const fieldKeys = Array.from(Content.$schema.fields.keys())
      for (const key of expected) {
        expect(fieldKeys).toContain(key)
      }
    })
  })

  // ===========================================================================
  // 18. Version tracking through mixed CRUD + verb operations
  // ===========================================================================
  describe('Version tracking through mixed CRUD + verb operations', () => {
    it('create(v1) -> update(v2) -> publish(v3) -> update(v4) -> archive(v5)', async () => {
      const c = await Content.create({ title: 'Version Track', status: 'Draft' })
      expect(c.$version).toBe(1)

      const u1 = await Content.update(c.$id, { body: 'Added body' })
      expect(u1.$version).toBe(2)

      const pub = await Content.publish(c.$id)
      expect(pub.$version).toBe(3)

      const u2 = await Content.update(c.$id, { body: 'Updated body' })
      expect(u2.$version).toBe(4)

      const arch = await Content.archive(c.$id)
      expect(arch.$version).toBe(5)
    })
  })

  // ===========================================================================
  // 19. Content scheduling workflow — complete path
  // ===========================================================================
  describe('Content scheduling workflow', () => {
    it('Draft -> schedule with scheduledAt -> verify Scheduled status and field', async () => {
      const c = await Content.create({
        title: 'Scheduled Article',
        status: 'Draft',
        scheduledAt: '2026-03-01T09:00:00.000Z',
      })
      expect(c.scheduledAt).toBe('2026-03-01T09:00:00.000Z')

      const scheduled = await Content.schedule(c.$id)
      expect(scheduled.status).toBe('Scheduled')
      expect(scheduled.scheduledAt).toBe('2026-03-01T09:00:00.000Z')
    })

    it('Scheduled -> publish preserves original scheduledAt', async () => {
      const c = await Content.create({
        title: 'Will Publish Later',
        status: 'Draft',
        scheduledAt: '2026-04-15T12:00:00.000Z',
      })
      const sched = await Content.schedule(c.$id)
      const pub = await Content.publish(sched.$id)
      expect(pub.status).toBe('Published')
      expect(pub.scheduledAt).toBe('2026-04-15T12:00:00.000Z')
    })
  })

  // ===========================================================================
  // 20. Asset — required fields only, optional fields undefined
  // ===========================================================================
  describe('Asset — required fields only, optional defaults', () => {
    it('creating with only required fields yields undefined for optionals', async () => {
      const a = await Asset.create({
        name: 'minimal.dat',
        filename: 'minimal.dat',
        url: 'https://cdn.example.com/minimal.dat',
        mimeType: 'application/octet-stream',
        size: 42,
      })
      expect(a.name).toBe('minimal.dat')
      expect(a.extension).toBeUndefined()
      expect(a.width).toBeUndefined()
      expect(a.height).toBeUndefined()
      expect(a.alt).toBeUndefined()
      expect(a.caption).toBeUndefined()
      expect(a.duration).toBeUndefined()
      expect(a.thumbnail).toBeUndefined()
      expect(a.tags).toBeUndefined()
      expect(a.source).toBeUndefined()
      expect(a.license).toBeUndefined()
    })
  })
})
