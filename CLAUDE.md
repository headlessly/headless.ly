# public/ — The @headlessly Package Repository

This repo contains the open source `@headlessly/*` packages — SDK, domain packages, client libraries, and CLI.

## Editing Policy

Direct edits are welcome. This content is hand-crafted for quality. When the package count grows to thousands, generation pipelines will take over — but right now, every doc page and README should be written to be excellent, not templated to be consistent.

## What Lives Here

```
packages/
├── sdk/           → @headlessly/sdk — unified 32-entity SDK, $ context
├── headlessly/    → headless.ly — main entry point, Headlessly() factory
├── crm/           → @headlessly/crm — Contact, Company, Deal
├── billing/       → @headlessly/billing — Customer, Product, Price, Subscription, Invoice, Payment
├── projects/      → @headlessly/projects — Project, Issue, Comment
├── content/       → @headlessly/content — Content, Asset, Site
├── support/       → @headlessly/support — Ticket
├── analytics/     → @headlessly/analytics — Event, Metric, Funnel, Goal
├── marketing/     → @headlessly/marketing — Campaign, Segment, Form
├── experiments/   → @headlessly/experiments — Experiment, FeatureFlag
├── platform/      → @headlessly/platform — Workflow, Integration, Agent
├── rpc/           → @headlessly/rpc — preconfigured rpc.do with capnweb pipelining
├── objects/       → @headlessly/objects — DO-backed NounProvider
├── events/        → @headlessly/events — event system, time travel
├── mcp/           → @headlessly/mcp — MCP protocol client
├── cli/           → @headlessly/cli — developer/agent CLI
├── js/            → @headlessly/js — browser SDK
├── node/          → @headlessly/node — Node.js SDK
├── react/         → @headlessly/react — React hooks, providers
├── ui/            → @headlessly/ui — schema-driven React CRUD components
└── code/          → @headlessly/code — sandboxed code execution client
docs/              → Fumadocs MDX documentation (headless.ly)
```

## RPC Foundation: rpc.do + capnweb

All remote operations use [rpc.do](https://rpc.do) with [capnweb](https://github.com/cloudflare/capnweb) promise pipelining. This is NOT optional HTTP fetch — it's the foundation of the SDK.

Key features:
- **Promise pipelining**: Chain dependent operations, execute in one round-trip
- **Magic `.map()`**: Record-replay — callback runs once in recording mode, replays on server per item
- **Automatic batching**: Concurrent `Promise.all()` calls become a single request
- **Pass-by-reference**: Server objects (sql, storage, collections) accessed via lightweight proxies
- **Multiple transports**: HTTP, WebSocket, Cloudflare service bindings

```typescript
// One round-trip for the entire chain
const deals = await $.Contact
  .find({ stage: 'Qualified' })
  .map(contact => contact.deals)
  .filter(deal => deal.stage === 'Open')
```

## SDK Conventions (Critical)

All code examples MUST use the current `@headlessly/*` package naming. We own the `@headlessly` npm scope. `@headlessly/sdk@0.0.1` is published.

### Three Import Styles

**1. Universal context (`$`)** — full access to every entity:

```typescript
import { $ } from '@headlessly/sdk'

await $.Contact.create({ name: 'Alice', stage: 'Lead' })
await $.Deal.close('deal_fX9bL5nRd')
```

**2. Direct entity imports** — domain-specific packages:

```typescript
import { Contact, Deal } from '@headlessly/crm'
import { Subscription } from '@headlessly/billing'

await Contact.create({ name: 'Alice', stage: 'Lead' })
await Deal.close('deal_fX9bL5nRd')
```

**3. Domain namespace imports** — grouping by product domain:

```typescript
import { crm, billing } from '@headlessly/sdk'

await crm.Contact.create({ name: 'Alice', stage: 'Lead' })
await billing.Subscription.create({ plan: 'pro', contact: 'contact_k7TmPvQx' })
```

### Package Hierarchy

| Layer | Packages | Purpose |
|---|---|---|
| **SDK** | `@headlessly/sdk` | Full 32-entity graph, exports `$` and domain namespaces |
| **Entry** | `headless.ly` | Headlessly() factory with provider configuration |
| **CLI** | `@headlessly/cli` | CLI entry point (`npx @headlessly/cli`) |
| **Domain** | `crm`, `billing`, `projects`, `content`, `support`, `analytics`, `marketing`, `experiments`, `platform` | Each owns a set of entities |
| **RPC** | `@headlessly/rpc` | Preconfigured rpc.do client for headless.ly |
| **Infrastructure** | `objects`, `events`, `mcp`, `code` | Provider, event system, MCP, code execution |
| **Client SDKs** | `js`, `node`, `react`, `ui` | Browser, Node.js, React, CRUD components |

### Domain-to-Entity Mapping

- `@headlessly/crm` — Contact, Company, Deal
- `@headlessly/billing` — Customer, Product, Price, Subscription, Invoice, Payment
- `@headlessly/projects` — Project, Issue, Comment
- `@headlessly/content` — Content, Asset, Site
- `@headlessly/support` — Ticket
- `@headlessly/analytics` — Event, Metric, Funnel, Goal
- `@headlessly/marketing` — Campaign, Segment, Form
- `@headlessly/experiments` — Experiment, FeatureFlag
- `@headlessly/platform` — Workflow, Integration, Agent

### Entity IDs

Entity IDs use the format `{type}_{sqid}` where the suffix is generated by [sqids](https://sqids.org/) — short, unique, URL-safe, with a built-in blocklist to prevent offensive strings.

- `contact_fX9bL5nRd`, `deal_k7TmPvQx`, `project_e5JhLzXc`
- Never use sequential numeric IDs: `contact_1`, `contact_847`
- Never use obviously fake IDs: `contact_123`, `contact_abc`
- Keep IDs consistent within a single file

### MCP Tool Representation

headless.ly exposes three MCP tools: `search`, `fetch`, `do`. Represent them with titled code blocks:

```json title="headless.ly/mcp#search"
{ "type": "Contact", "filter": { "stage": "Lead" } }
```

```json title="headless.ly/mcp#fetch"
{ "type": "Contact", "id": "contact_fX9bL5nRd", "include": ["deals"] }
```

```ts title="headless.ly/mcp#do"
const leads = await $.Contact.find({ stage: 'Lead' })
for (const lead of leads) {
  await $.Contact.qualify(lead.$id)
}
```

### What NOT to Write

```typescript
// WRONG — old pattern
import Headlessly from 'headless.ly'
const org = Headlessly({ tenant: 'my-startup' })
org.Contact.create(...)

// WRONG — headless.ly is not a valid npm package name for direct imports
import { Contact } from 'headless.ly'

// WRONG — MCP tools are not function calls
search({ type: 'Contact', filter: { stage: 'Lead' } })
do({ method: 'Contact.qualify', args: ['contact_1'] })

// WRONG — raw HTTP fetch instead of rpc.do
const response = await fetch('https://db.headless.ly/contacts')
```

## Code Style

- No semicolons, single quotes, 2-space indent (project Prettier config)
- Always include import statements
- Always show the full operation, not a fragment
- Prefer `const` over `let`
- Use meaningful variable names

## Source Relationships

When content here overlaps with source data:
- Schema definitions → `packages/*/src/index.ts` (Noun definitions)
- RPC transport → `packages/rpc/` wraps `rpc.do`
- Provider layer → `packages/objects/` uses `rpc.do` for DO communication
- Entity documentation → `docs/reference/entities/`
