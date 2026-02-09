# @headlessly/content

> Your CMS was designed for humans in a browser. Your agents deserve better.

```typescript
import { Content, Site } from '@headlessly/content'

await Content.create({ title: 'Why Agents Need Headless CMS', slug: 'agents-need-headless', type: 'Article', status: 'Draft', site: 'site_e5JhLzXc' })
await Content.publish('content_fX9bL5nRd')

// Content publishes — analytics, marketing, and SEO react instantly
Content.published(async (content, $) => {
  await $.Event.create({ type: 'content.published', value: content.slug })
  await $.Campaign.create({ name: `Promote: ${content.title}`, type: 'Social' })
  await $.Goal.update('goal_nR4xLmPq', { progress: 1 })
})
```

No Contentful webhooks. No Sanity GROQ. No WordPress REST API v2. Content, assets, and sites — in one typed system your agent can operate autonomously.

## The Problem

Contentful has content modeling GUIs, 15 SDKs, and a rich text editor your agent will never use. Sanity has GROQ, a real-time studio, and a "structure builder" — all designed for a human sitting in a browser. WordPress has 60,000 plugins, a block editor, and two decades of decisions made for bloggers, not agents.

None of them were built for an AI agent to operate.

Your agent doesn't need a WYSIWYG editor. It needs `Content.publish()`. It doesn't need a media library with drag-and-drop uploads. It needs `Asset.create()`. It doesn't need a "content model builder" GUI. It needs a BEFORE hook:

```typescript
Content.publishing(content => {
  if (!content.seoTitle || !content.seoDescription) throw new Error('SEO metadata required before publishing')
})
```

## One Typed Graph

When you publish content in Contentful, does your analytics pipeline track it? Does your marketing system reference it in a campaign? Does your CRM know which contact authored it?

Not without webhooks, Zapier, and duct tape.

In headless.ly, publishing content IS tracking an event IS launching a campaign IS updating a goal — because they're all nodes in the same graph:

```typescript
import { Content, Asset } from '@headlessly/content'

Content.published(async (content, $) => {
  await $.Event.create({ type: 'content.published', value: content.slug })
  await $.Campaign.create({ name: `Promote: ${content.title}`, type: 'Social', segment: 'subscribers' })
  await $.Metric.increment('articles_published')
})

Content.archived(async (content, $) => {
  await $.Event.create({ type: 'content.archived', value: content.slug })
})
```

Assets aren't siloed in a media library. An asset uploaded to content is the same asset referenced by a campaign, a product, a contact avatar — one node in the graph, not five copies across five tools.

No webhooks. No Zapier. No integration tax. One graph.

## Install

```bash
npm install @headlessly/content
```

## Entities

### Content

Pages, posts, articles, and guides with full publishing lifecycle and SEO metadata.

```typescript
import { Content } from '@headlessly/content'

const article = await Content.create({
  title: 'Getting Started with Headlessly',
  slug: 'getting-started',
  type: 'Guide',
  status: 'Draft',
  site: 'site_e5JhLzXc',
  author: 'contact_fX9bL5nRd',
})

await Content.publish(article.$id)
await Content.schedule('content_k7TmPvQx')
await Content.archive('content_mN8pZwKj')

Content.published((content, $) => {
  $.Event.create({ type: 'content.published', value: content.slug })
})
```

**Verbs**: `publish()` · `publishing()` · `published()` · `publishedBy` | `schedule()` · `scheduling()` · `scheduled()` · `scheduledBy` | `archive()` · `archiving()` · `archived()` · `archivedBy`

**Key fields**: title, slug, excerpt, body, type (`Page | Post | Article | Guide`), status (`Draft | Published | Scheduled | Archived`), visibility (`Public | Private | Members`), publishedAt, scheduledAt, seoTitle, seoDescription, readingTime, viewCount

**Relationships**: -> Site.content, -> Contact (author), -> Asset (featuredImage), <- Comment[]

### Asset

Media files — images, videos, documents, audio — available to every entity in the graph.

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

**Key fields**: name, filename, url, type (`Image | Video | Document | Audio | Archive | Other`), mimeType, size, width, height, alt, caption, duration, tags

**Relationships**: -> Contact (uploadedBy), <- Content[] (featuredImage), <- Product[], <- Campaign[]

### Site

Site configuration with branding, localization, and content collections.

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

**Key fields**: name, subdomain, title, description, tagline, logo, favicon, primaryColor, status (`Draft | Published | Maintenance`), visibility (`Public | Private | Password`), defaultLanguage, supportedLanguages, timezone

**Relationships**: <- Content.site[], -> Organization

## Agent-Native

Your agent connects to one MCP endpoint. It can manage your entire content system:

```json title="content.headless.ly/mcp#search"
{ "type": "Content", "filter": { "status": "Published", "type": "Article" } }
```

```json title="content.headless.ly/mcp#fetch"
{ "type": "Content", "id": "content_fX9bL5nRd", "include": ["site", "author", "featuredImage"] }
```

```ts title="content.headless.ly/mcp#do"
const drafts = await $.Content.find({ status: 'Draft', site: 'site_e5JhLzXc' })
for (const draft of drafts) {
  if (draft.seoTitle && draft.seoDescription) {
    await $.Content.publish(draft.$id)
    await $.Event.create({ type: 'content.published', value: draft.slug })
  }
}
```

Three tools. Not a REST API with 47 endpoints.

## Cross-Domain Operations

Query results are standard arrays — chain operations with familiar JavaScript:

```typescript
const sites = await Site.find({ status: 'Published' })
for (const site of sites) {
  const articles = await Content.find({ site: site.$id, status: 'Published', type: 'Article' })
  for (const article of articles) {
    await Event.create({ type: 'content.indexed', value: article.slug })
  }
}
```

## License

MIT
