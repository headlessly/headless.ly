# @headlessly/ui

Schema-driven React CRUD components for headless.ly entities -- auto-generated tables, forms, detail views, timelines, and dashboards from Noun schemas.

## Install

```bash
npm install @headlessly/ui
```

Requires `react >= 18.0.0` and `digital-objects >= 1.0.0` as peer dependencies.

## Usage

```tsx
import { HeadlessUIProvider, EntityTable, EntityForm, Dashboard } from '@headlessly/ui'

function App() {
  return (
    <HeadlessUIProvider config={{ baseUrl: 'https://db.headless.ly' }}>
      <EntityTable noun='Contact' />
    </HeadlessUIProvider>
  )
}
```

### Entity Table

```tsx
import { EntityTable } from '@headlessly/ui'

// Auto-generated columns from Noun schema
<EntityTable noun='Contact' />

// With sorting, filtering, and pagination
<EntityTable
  noun='Deal'
  defaultSort={{ field: 'value', direction: 'desc' }}
  pageSize={25}
/>
```

### Entity Form

```tsx
import { EntityForm } from '@headlessly/ui'

// Auto-generated form fields from schema
<EntityForm noun='Contact' onSubmit={(data) => console.log(data)} />

// Edit mode
<EntityForm noun='Contact' entityId='contact_fX9bL5' />
```

### Verb Buttons

```tsx
import { VerbButton } from '@headlessly/ui'

// Renders a button for a custom verb with confirmation
<VerbButton noun='Contact' entityId='contact_fX9bL5' verb='qualify' />
<VerbButton noun='Deal' entityId='deal_k7TmPv' verb='close' />
```

### Dashboard

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

### Relationship Graph

```tsx
import { RelationshipGraph } from '@headlessly/ui'

<RelationshipGraph
  rootNoun='Contact'
  rootId='contact_fX9bL5'
  depth={2}
/>
```

## API

### `<HeadlessUIProvider>`

Wraps your app with configuration context. Accepts a `config` prop with `baseUrl`, authentication, and theme options.

### Components

- **`<EntityTable noun pageSize? defaultSort?>`** -- auto-generated sortable, paginated table
- **`<EntityForm noun entityId? onSubmit?>`** -- auto-generated create/edit form with validation
- **`<EntityDetail noun entityId>`** -- read-only entity detail view
- **`<EntityTimeline noun entityId>`** -- event timeline for an entity
- **`<Dashboard cards layout?>`** -- configurable metric and entity dashboard
- **`<SearchBar nouns? onSelect?>`** -- cross-entity search with typeahead
- **`<VerbButton noun entityId verb>`** -- button to execute a custom verb
- **`<RelationshipGraph rootNoun rootId depth?>`** -- visual relationship graph

### Hooks

- **`useEntity(options)`** -- fetch and manage a single entity
- **`useEntities(options)`** -- fetch and manage a list of entities with filters
- **`useSearch(options)`** -- cross-entity search with debouncing
- **`useRealtime(options)`** -- subscribe to real-time entity updates
- **`useHeadlessUI()`** -- access the UI provider context

### Schema Utilities

- **`deriveColumns(schema)`** -- derive table column definitions from a Noun schema
- **`deriveFormFields(schema)`** -- derive form field definitions from a Noun schema
- **`deriveVerbs(schema)`** -- get custom verbs for a Noun
- **`deriveAllVerbs(schema)`** -- get all verbs including CRUD
- **`fieldInputType(field)`** -- determine the input type for a schema field
- **`isRequired(field)`** -- check if a field is required
- **`formatLabel(fieldName)`** -- convert a field name to a display label
- **`formatCellValue(value)`** -- format a value for table display

### Types

- `HeadlessUIConfig`, `PaginatedResult`, `SortDirection`, `SortState`
- `ColumnDef`, `FieldFilter`, `EntityQuery`, `EntityEvent`
- `DashboardCard`, `DashboardLayout`, `StylableProps`
- `VerbAction`, `GraphNode`, `GraphEdge`
- `NounSchema`, `ParsedProperty`, `VerbConjugation`, `NounInstance`, `FieldModifiers`

## License

MIT
