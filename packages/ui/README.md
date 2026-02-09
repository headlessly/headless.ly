# @headlessly/ui

> Your schema IS your UI. Tables, forms, and detail views -- generated from Noun definitions.

```tsx
import { HeadlessUIProvider, EntityTable, EntityForm, VerbButton } from '@headlessly/ui'

<HeadlessUIProvider config={{ baseUrl: 'https://db.headless.ly' }}>
  <EntityTable noun='Contact' />
  <EntityForm noun='Deal' onSubmit={(data) => console.log(data)} />
  <VerbButton noun='Contact' entityId='contact_fX9bL5nRd' verb='qualify' />
</HeadlessUIProvider>
```

## The Idea

Every entity defined with `Noun()` already carries everything the UI needs:

```typescript
import { Noun } from 'digital-objects'

export const Contact = Noun('Contact', {
  name: 'string!',
  email: 'string?#',
  stage: 'Lead | Qualified | Customer | Churned | Partner',
  company: '-> Company.contacts',
  deals: '<- Deal.contact[]',
  qualify: 'Qualified',
})
```

From this definition, `@headlessly/ui` knows:
- **`name`** is required text -- renders as a required text input
- **`email`** is optional and indexed -- renders as an optional email input
- **`stage`** is an enum -- renders as a select dropdown with 5 options
- **`company`** is a relationship -- renders as a linked entity picker
- **`deals`** is a reverse relationship -- renders as a related entities list
- **`qualify`** is a custom verb -- renders as an action button

You write Noun definitions. The UI writes itself.

## Install

```bash
npm install @headlessly/ui
```

Requires `react >= 18.0.0` and `digital-objects >= 1.0.0` as peer dependencies.

## Entity Table

Auto-generated columns with sorting, filtering, and pagination -- derived directly from the schema.

```tsx
import { EntityTable } from '@headlessly/ui'

// Minimal -- columns, sorting, and pagination are automatic
<EntityTable noun='Contact' />

// With configuration
<EntityTable
  noun='Deal'
  defaultSort={{ field: 'value', direction: 'desc' }}
  pageSize={25}
/>
```

String fields become searchable text columns. Enum fields become filterable dropdowns. Relationship fields become clickable links. Date fields are formatted. Numbers are aligned right. All from the schema -- zero column definitions.

## Entity Form

Validated create/edit forms generated from schema properties.

```tsx
import { EntityForm } from '@headlessly/ui'

// Create mode -- fields derived from schema, validation from modifiers
<EntityForm noun='Contact' onSubmit={(data) => console.log(data)} />

// Edit mode -- pre-populated from existing entity
<EntityForm noun='Contact' entityId='contact_fX9bL5nRd' />
```

Required fields (`!` modifier) show validation errors. Enum fields render as selects. Relationship fields render as entity pickers with search. Boolean fields render as toggles. All automatic.

## Entity Detail

Read-only detail view with all fields and relationships.

```tsx
import { EntityDetail } from '@headlessly/ui'

<EntityDetail noun='Contact' entityId='contact_fX9bL5nRd' />
```

Fields are labeled, formatted, and grouped. Relationships render as navigable links. The `$version`, `$createdAt`, and `$updatedAt` meta-fields are shown in a metadata section.

## Verb Buttons

Execute custom verbs (and CRUD verbs) with confirmation dialogs.

```tsx
import { VerbButton } from '@headlessly/ui'

// Custom verb -- renders as a button with confirmation
<VerbButton noun='Contact' entityId='contact_fX9bL5nRd' verb='qualify' />
<VerbButton noun='Deal' entityId='deal_k7TmPvQx' verb='close' />

// The button label, confirmation text, and success state
// are all derived from verb conjugation:
// qualify → "Qualify" (label) → "Qualifying..." (pending) → "Qualified" (done)
```

## Entity Timeline

Event timeline showing the full history of an entity -- every mutation, every verb execution, every state change.

```tsx
import { EntityTimeline } from '@headlessly/ui'

<EntityTimeline noun='Contact' entityId='contact_fX9bL5nRd' />
```

Because every mutation is an immutable event, the timeline is complete. Nothing is ever lost.

## Relationship Graph

Visual graph of entity relationships -- follow links across the typed graph.

```tsx
import { RelationshipGraph } from '@headlessly/ui'

<RelationshipGraph rootNoun='Contact' rootId='contact_fX9bL5nRd' depth={2} />
```

Starting from a Contact, see their Company, their Deals, the Subscriptions from those Deals, the Invoices from those Subscriptions -- all traversed from the schema's relationship definitions.

## Dashboard

Composable dashboard cards from entity aggregations.

```tsx
import { Dashboard } from '@headlessly/ui'

<Dashboard
  cards={[
    { type: 'metric', noun: 'Contact', aggregate: 'count' },
    { type: 'metric', noun: 'Deal', field: 'value', aggregate: 'sum' },
    { type: 'table', noun: 'Contact', limit: 5 },
  ]}
/>
```

## Search Bar

Cross-entity search with typeahead, searching across all entity types.

```tsx
import { SearchBar } from '@headlessly/ui'

<SearchBar
  nouns={['Contact', 'Deal', 'Company']}
  onSelect={(entity) => navigate(`/${entity.$type}/${entity.$id}`)}
/>
```

## Hooks

```tsx
import { useEntity, useEntities, useSearch, useRealtime } from '@headlessly/ui'

// Single entity
const { data: contact, loading, error } = useEntity({
  noun: 'Contact',
  id: 'contact_fX9bL5nRd',
})

// Entity list with filters
const { data: leads, loading } = useEntities({
  noun: 'Contact',
  filter: { stage: 'Lead' },
  sort: { field: 'name', direction: 'asc' },
  limit: 20,
})

// Cross-entity search with debouncing
const { results, searching } = useSearch({
  query: 'alice',
  nouns: ['Contact', 'Company'],
})

// Real-time updates via WebSocket
useRealtime({
  noun: 'Deal',
  filter: { stage: 'Open' },
  onUpdate: (deal) => console.log('Deal updated:', deal.$id),
})
```

## Schema Utilities

Derive UI metadata directly from Noun schemas:

```typescript
import { deriveColumns, deriveFormFields, deriveVerbs } from '@headlessly/ui'

const columns = deriveColumns(ContactSchema)
// → [{ key: 'name', type: 'text', required: true }, { key: 'email', type: 'email', indexed: true }, ...]

const fields = deriveFormFields(ContactSchema)
// → [{ key: 'name', input: 'text', required: true }, { key: 'stage', input: 'select', options: ['Lead', 'Qualified', ...] }, ...]

const verbs = deriveVerbs(ContactSchema)
// → [{ verb: 'qualify', label: 'Qualify', pending: 'Qualifying...', past: 'Qualified' }]
```

Additional utilities: `deriveAllVerbs(schema)`, `fieldInputType(field)`, `isRequired(field)`, `formatLabel(fieldName)`, `formatCellValue(value)`.

## API Reference

### Provider

**`<HeadlessUIProvider config>`** -- Wraps your app with configuration context. Accepts `baseUrl`, authentication, and theme options.

### Components

| Component | Props | Description |
|---|---|---|
| `<EntityTable>` | `noun`, `pageSize?`, `defaultSort?` | Auto-generated sortable, paginated table |
| `<EntityForm>` | `noun`, `entityId?`, `onSubmit?` | Auto-generated create/edit form with validation |
| `<EntityDetail>` | `noun`, `entityId` | Read-only entity detail view |
| `<EntityTimeline>` | `noun`, `entityId` | Event timeline for an entity |
| `<Dashboard>` | `cards`, `layout?` | Configurable metric and entity dashboard |
| `<SearchBar>` | `nouns?`, `onSelect?` | Cross-entity search with typeahead |
| `<VerbButton>` | `noun`, `entityId`, `verb` | Button to execute a custom verb |
| `<RelationshipGraph>` | `rootNoun`, `rootId`, `depth?` | Visual relationship graph |

### Hooks

| Hook | Description |
|---|---|
| `useEntity(options)` | Fetch and manage a single entity |
| `useEntities(options)` | Fetch and manage a list of entities with filters |
| `useSearch(options)` | Cross-entity search with debouncing |
| `useRealtime(options)` | Subscribe to real-time entity updates |
| `useHeadlessUI()` | Access the UI provider context |

### Types

`HeadlessUIConfig`, `PaginatedResult`, `SortDirection`, `SortState`, `ColumnDef`, `FieldFilter`, `EntityQuery`, `EntityEvent`, `DashboardCard`, `DashboardLayout`, `StylableProps`, `VerbAction`, `GraphNode`, `GraphEdge`, `NounSchema`, `ParsedProperty`, `VerbConjugation`, `NounInstance`, `FieldModifiers`

## License

MIT
