# @headlessly/content

Content management entities for pages, posts, media assets, and sites — headless CMS as typed Digital Objects.

## Install

```bash
npm install @headlessly/content
```

## Entities

### Content

Pages, posts, articles, and guides with SEO metadata and publishing lifecycle.

```typescript
import { Content } from '@headlessly/content'

await Content.create({
  title: 'Getting Started with Headlessly',
  slug: 'getting-started',
  type: 'Guide',
  status: 'Draft',
  site: 'site_e5JhLzXc',
})

await Content.publish('content_fX9bL5nRd')
await Content.schedule('content_fX9bL5nRd')
await Content.archive('content_fX9bL5nRd')
```

**Fields**: `title`, `slug`, `excerpt`, `body`, `type`, `categories`, `tags`, `status`, `publishedAt`, `scheduledAt`, `seoTitle`, `seoDescription`, `ogImage`, `noIndex`, `canonicalUrl`, `readingTime`, `viewCount`, `visibility`

**Relationships**:

- `site` -> Site.content
- `author` -> Contact
- `featuredImage` -> Asset

**Verbs**: `publish()` / `publishing()` / `published()` / `publishedBy`, `archive()` / `archiving()` / `archived()` / `archivedBy`, `schedule()` / `scheduling()` / `scheduled()` / `scheduledBy`

**Enums**:

- `type`: Page | Post | Article | Guide
- `status`: Draft | Published | Scheduled | Archived
- `visibility`: Public | Private | Members

### Asset

Media files — images, videos, documents, audio — with dimensions and metadata.

```typescript
import { Asset } from '@headlessly/content'

await Asset.create({
  name: 'Hero Image',
  filename: 'hero.png',
  url: 'https://r2.headless.ly/assets/hero.png',
  mimeType: 'image/png',
  size: 245000,
  width: 1920,
  height: 1080,
})
```

**Fields**: `name`, `filename`, `url`, `type`, `mimeType`, `extension`, `size`, `width`, `height`, `alt`, `caption`, `duration`, `thumbnail`, `tags`, `source`, `license`

**Relationships**:

- `uploadedBy` -> Contact

**Enums**:

- `type`: Image | Video | Document | Audio | Archive | Other

### Site

Site configuration with branding, localization, and content collection.

```typescript
import { Site } from '@headlessly/content'

await Site.create({
  name: 'Acme Blog',
  subdomain: 'blog',
  status: 'Published',
  visibility: 'Public',
  defaultLanguage: 'en',
})
```

**Fields**: `name`, `subdomain`, `title`, `description`, `tagline`, `logo`, `favicon`, `primaryColor`, `accentColor`, `status`, `visibility`, `ogImage`, `defaultLanguage`, `supportedLanguages`, `timezone`

**Relationships**:

- `content` <- Content.site[]

**Enums**:

- `status`: Draft | Published | Maintenance
- `visibility`: Public | Private | Password

## Event-Driven Reactions

React to content lifecycle events:

```typescript
import { Content } from '@headlessly/content'

Content.published((content) => {
  console.log(`${content.title} is now live at ${content.slug}`)
})

Content.scheduled((content) => {
  console.log(`${content.title} scheduled for ${content.scheduledAt}`)
})
```

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const drafts = await Site.find({ status: 'Published' })
  .map((s) => s.content)
  .filter((c) => c.status === 'Draft')
```

## License

MIT
