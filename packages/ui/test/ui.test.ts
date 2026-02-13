import { describe, it, expect, beforeEach } from 'vitest'
import { clearRegistry, Noun } from 'digital-objects'
import {
  deriveColumns,
  deriveFormFields,
  deriveVerbs,
  deriveAllVerbs,
  fieldInputType,
  isRequired,
  formatLabel,
  formatCellValue,
} from '../src/schema-utils'

describe('@headlessly/ui — component & schema tests (RED)', () => {
  beforeEach(() => {
    clearRegistry()
  })

  // ---------------------------------------------------------------------------
  // 1. Schema Utils (deeper coverage) — deriveColumns edge cases
  // ---------------------------------------------------------------------------
  describe('deriveColumns — deeper coverage', () => {
    it('includes $id meta column', () => {
      const Entity = Noun('ColIdEntity', { name: 'string!' })
      const columns = deriveColumns(Entity.$schema)
      const idCol = columns.find((c) => c.key === '$id')
      expect(idCol).toBeDefined()
      expect(idCol!.kind).toBe('meta')
    })

    it('includes $createdAt and $updatedAt meta columns', () => {
      const Entity = Noun('ColTsEntity', { name: 'string!' })
      const columns = deriveColumns(Entity.$schema)
      const keys = columns.map((c) => c.key)
      expect(keys).toContain('$createdAt')
      expect(keys).toContain('$updatedAt')
    })

    it('handles relationship fields with kind=relationship', () => {
      const Company = Noun('CompanyRel', { name: 'string!' })
      const Contact = Noun('ContactRel', {
        name: 'string!',
        company: '-> CompanyRel.contacts',
      })
      const columns = deriveColumns(Contact.$schema)
      const relCol = columns.find((c) => c.key === 'company')
      expect(relCol).toBeDefined()
      expect(relCol!.kind).toBe('relationship')
    })

    it('adds enumValues on enum field columns', () => {
      const Entity = Noun('ColEnumEntity', {
        stage: 'Lead | Qualified | Customer',
      })
      const columns = deriveColumns(Entity.$schema)
      const stageCol = columns.find((c) => c.key === 'stage')
      expect(stageCol).toBeDefined()
      expect(stageCol!.enumValues).toEqual(['Lead', 'Qualified', 'Customer'])
    })

    it('empty schema (no data fields) still has meta columns ($id, $createdAt, $updatedAt)', () => {
      const Entity = Noun('EmptySchemaEntity', {})
      const columns = deriveColumns(Entity.$schema)
      const keys = columns.map((c) => c.key)
      expect(keys).toContain('$id')
      expect(keys).toContain('$createdAt')
      expect(keys).toContain('$updatedAt')
      expect(columns.length).toBe(3)
    })

    it('data field columns have kind=field', () => {
      const Entity = Noun('FieldKindEntity', { name: 'string!', age: 'int' })
      const columns = deriveColumns(Entity.$schema)
      const nameCol = columns.find((c) => c.key === 'name')
      expect(nameCol).toBeDefined()
      expect(nameCol!.kind).toBe('field')
    })

    it('data fields are sortable, relationship columns are not', () => {
      const Target = Noun('SortTarget', { label: 'string!' })
      const Entity = Noun('SortEntity', {
        name: 'string!',
        target: '-> SortTarget.entities',
      })
      const columns = deriveColumns(Entity.$schema)
      const nameCol = columns.find((c) => c.key === 'name')
      const relCol = columns.find((c) => c.key === 'target')
      expect(nameCol!.sortable).toBe(true)
      expect(relCol!.sortable).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. deriveFormFields — deeper coverage
  // ---------------------------------------------------------------------------
  describe('deriveFormFields — deeper coverage', () => {
    it('returns only data fields, not meta-fields', () => {
      const Entity = Noun('FormFieldsEntity', {
        name: 'string!',
        email: 'string',
      })
      const fields = deriveFormFields(Entity.$schema)
      const names = fields.map((f) => f.name)
      expect(names).toContain('name')
      expect(names).toContain('email')
      expect(names).not.toContain('$id')
      expect(names).not.toContain('$createdAt')
      expect(names).not.toContain('$updatedAt')
      expect(names).not.toContain('$type')
    })

    it('does not include relationship fields', () => {
      const Other = Noun('FormRelOther', { title: 'string!' })
      const Entity = Noun('FormRelEntity', {
        name: 'string!',
        other: '-> FormRelOther.entities',
      })
      const fields = deriveFormFields(Entity.$schema)
      const names = fields.map((f) => f.name)
      expect(names).toContain('name')
      expect(names).not.toContain('other')
    })

    it('does not include verb definitions as form fields', () => {
      const Entity = Noun('FormVerbEntity', {
        name: 'string!',
        status: 'Draft | Published',
        publish: 'Published',
      })
      const fields = deriveFormFields(Entity.$schema)
      const names = fields.map((f) => f.name)
      expect(names).not.toContain('publish')
    })
  })

  // ---------------------------------------------------------------------------
  // 3. NEW: deriveFilterableColumns — filter-only view (RED)
  // ---------------------------------------------------------------------------
  describe('deriveFilterableColumns (RED)', () => {
    it('should be exported from schema-utils', async () => {
      const mod = await import('../src/schema-utils')
      expect(mod.deriveFilterableColumns).toBeDefined()
      expect(typeof mod.deriveFilterableColumns).toBe('function')
    })

    it('returns only columns where filterable is true', async () => {
      const { deriveFilterableColumns } = await import('../src/schema-utils')
      const Entity = Noun('FilterEntity1', {
        name: 'string!',
        stage: 'Lead | Qualified',
      })
      const filterable = deriveFilterableColumns(Entity.$schema)
      // meta columns ($id, $createdAt, $updatedAt) are not filterable
      for (const col of filterable) {
        expect(col.filterable).toBe(true)
      }
      expect(filterable.length).toBeGreaterThan(0)
    })

    it('excludes meta columns from filterable results', async () => {
      const { deriveFilterableColumns } = await import('../src/schema-utils')
      const Entity = Noun('FilterEntity2', { title: 'string!' })
      const filterable = deriveFilterableColumns(Entity.$schema)
      const keys = filterable.map((c: any) => c.key)
      expect(keys).not.toContain('$id')
      expect(keys).not.toContain('$createdAt')
      expect(keys).not.toContain('$updatedAt')
    })
  })

  // ---------------------------------------------------------------------------
  // 4. NEW: deriveSortableColumns (RED)
  // ---------------------------------------------------------------------------
  describe('deriveSortableColumns (RED)', () => {
    it('should be exported from schema-utils', async () => {
      const mod = await import('../src/schema-utils')
      expect(mod.deriveSortableColumns).toBeDefined()
      expect(typeof mod.deriveSortableColumns).toBe('function')
    })

    it('returns only columns where sortable is true', async () => {
      const { deriveSortableColumns } = await import('../src/schema-utils')
      const Target = Noun('SortableTarget', { label: 'string!' })
      const Entity = Noun('SortableEntity', {
        name: 'string!',
        target: '-> SortableTarget.entities',
      })
      const sortable = deriveSortableColumns(Entity.$schema)
      for (const col of sortable) {
        expect(col.sortable).toBe(true)
      }
      // relationship columns should be excluded
      const keys = sortable.map((c: any) => c.key)
      expect(keys).not.toContain('target')
    })
  })

  // ---------------------------------------------------------------------------
  // 5. NEW: deriveEntityTitle — pick display title from an entity (RED)
  // ---------------------------------------------------------------------------
  describe('deriveEntityTitle (RED)', () => {
    it('should be exported from schema-utils', async () => {
      const mod = await import('../src/schema-utils')
      expect(mod.deriveEntityTitle).toBeDefined()
    })

    it('uses name field when available', async () => {
      const { deriveEntityTitle } = await import('../src/schema-utils')
      const Entity = Noun('TitleEntity1', { name: 'string!', email: 'string' })
      const title = deriveEntityTitle(Entity.$schema, {
        $id: 'te_abc',
        $type: 'TitleEntity1',
        $context: '',
        $version: 1,
        $createdAt: '2024-01-01',
        $updatedAt: '2024-01-01',
        name: 'Alice',
        email: 'alice@example.com',
      })
      expect(title).toBe('Alice')
    })

    it('uses title field when name is not present', async () => {
      const { deriveEntityTitle } = await import('../src/schema-utils')
      const Entity = Noun('TitleEntity2', { title: 'string!', body: 'string' })
      const title = deriveEntityTitle(Entity.$schema, {
        $id: 'te_def',
        $type: 'TitleEntity2',
        $context: '',
        $version: 1,
        $createdAt: '2024-01-01',
        $updatedAt: '2024-01-01',
        title: 'My Post',
        body: 'content here',
      })
      expect(title).toBe('My Post')
    })

    it('falls back to $id when no name or title field', async () => {
      const { deriveEntityTitle } = await import('../src/schema-utils')
      const Entity = Noun('TitleEntity3', { code: 'string!', amount: 'int' })
      const title = deriveEntityTitle(Entity.$schema, {
        $id: 'te_xyz',
        $type: 'TitleEntity3',
        $context: '',
        $version: 1,
        $createdAt: '2024-01-01',
        $updatedAt: '2024-01-01',
        code: 'ABC',
        amount: 100,
      })
      expect(title).toBe('te_xyz')
    })
  })

  // ---------------------------------------------------------------------------
  // 6. NEW: validateFormData — schema-based validation (RED)
  // ---------------------------------------------------------------------------
  describe('validateFormData (RED)', () => {
    it('should be exported from schema-utils', async () => {
      const mod = await import('../src/schema-utils')
      expect(mod.validateFormData).toBeDefined()
    })

    it('returns errors for missing required fields', async () => {
      const { validateFormData } = await import('../src/schema-utils')
      const Entity = Noun('ValidEntity1', {
        name: 'string!',
        email: 'string',
      })
      const errors = validateFormData(Entity.$schema, { email: 'test@example.com' })
      expect(errors).toBeDefined()
      expect(errors.name).toBeDefined()
      expect(typeof errors.name).toBe('string')
    })

    it('returns empty object when all required fields are present', async () => {
      const { validateFormData } = await import('../src/schema-utils')
      const Entity = Noun('ValidEntity2', {
        name: 'string!',
        email: 'string',
      })
      const errors = validateFormData(Entity.$schema, { name: 'Alice', email: 'a@b.com' })
      expect(Object.keys(errors).length).toBe(0)
    })

    it('validates enum values are within the allowed set', async () => {
      const { validateFormData } = await import('../src/schema-utils')
      const Entity = Noun('ValidEntity3', {
        name: 'string!',
        stage: 'Lead | Qualified | Customer',
      })
      const errors = validateFormData(Entity.$schema, { name: 'Alice', stage: 'InvalidStage' })
      expect(errors.stage).toBeDefined()
    })
  })

  // ---------------------------------------------------------------------------
  // 7. NEW: columnsByKind — group columns by kind (RED)
  // ---------------------------------------------------------------------------
  describe('columnsByKind (RED)', () => {
    it('should be exported from schema-utils', async () => {
      const mod = await import('../src/schema-utils')
      expect(mod.columnsByKind).toBeDefined()
    })

    it('groups columns into meta, field, and relationship buckets', async () => {
      const { columnsByKind } = await import('../src/schema-utils')
      const Other = Noun('GroupOther', { label: 'string!' })
      const Entity = Noun('GroupEntity', {
        name: 'string!',
        other: '-> GroupOther.entities',
      })
      const grouped = columnsByKind(Entity.$schema)
      expect(grouped.meta).toBeDefined()
      expect(grouped.field).toBeDefined()
      expect(grouped.relationship).toBeDefined()
      expect(grouped.meta.some((c: any) => c.key === '$id')).toBe(true)
      expect(grouped.field.some((c: any) => c.key === 'name')).toBe(true)
      expect(grouped.relationship.some((c: any) => c.key === 'other')).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // 8. Component Exports — verify all exports (v2: @mdxui/admin + @headlessly/react)
  // ---------------------------------------------------------------------------
  describe('package exports', () => {
    it('exports core components from index', async () => {
      const mod = await import('../src/index')
      expect(mod.HeadlessAdmin).toBeDefined()
      expect(mod.EntityGrid).toBeDefined()
      expect(mod.EntityForm).toBeDefined()
      expect(mod.EntityDetail).toBeDefined()
    })

    it('exports re-exported @headlessly/react hooks from index', async () => {
      const mod = await import('../src/index')
      expect(mod.useEntity).toBeDefined()
      expect(mod.useEntities).toBeDefined()
      expect(mod.useSearch).toBeDefined()
      expect(mod.useRealtime).toBeDefined()
      expect(mod.useMutation).toBeDefined()
      expect(mod.useVerb).toBeDefined()
      expect(mod.useCreate).toBeDefined()
      expect(mod.useUpdate).toBeDefined()
      expect(mod.useDelete).toBeDefined()
      expect(mod.useEvents).toBeDefined()
    })

    it('exports HeadlesslyProvider from index', async () => {
      const mod = await import('../src/index')
      expect(mod.HeadlesslyProvider).toBeDefined()
    })

    it('exports schema bridge functions from index', async () => {
      const mod = await import('../src/index')
      expect(mod.nounToColumns).toBeDefined()
      expect(mod.nounToSchemas).toBeDefined()
      expect(mod.domainForEntity).toBeDefined()
      expect(mod.getColumnsForNoun).toBeDefined()
      expect(mod.domains).toBeDefined()
    })

    it('exports schema utils functions from index', async () => {
      const mod = await import('../src/index')
      expect(mod.deriveFilterableColumns).toBeDefined()
      expect(mod.deriveSortableColumns).toBeDefined()
      expect(mod.deriveEntityTitle).toBeDefined()
      expect(mod.validateFormData).toBeDefined()
      expect(mod.columnsByKind).toBeDefined()
    })

    it('exports re-exported @mdxui/admin components from index', async () => {
      const mod = await import('../src/index')
      expect(mod.DatabaseGrid).toBeDefined()
      expect(mod.DatabaseSidebar).toBeDefined()
      expect(mod.TableEditorToolbar).toBeDefined()
    })

    it('exports digital-objects utilities from index', async () => {
      const mod = await import('../src/index')
      expect(mod.getNounSchema).toBeDefined()
      expect(mod.getAllNouns).toBeDefined()
    })
  })

  // ---------------------------------------------------------------------------
  // 9. Field Input Type Mapping — comprehensive
  // ---------------------------------------------------------------------------
  describe('fieldInputType', () => {
    it('maps "string" to "text"', () => {
      expect(fieldInputType({ name: 'title', kind: 'field', type: 'string' })).toBe('text')
    })

    it('maps "int" to "number"', () => {
      expect(fieldInputType({ name: 'count', kind: 'field', type: 'int' })).toBe('number')
    })

    it('maps "integer" to "number"', () => {
      expect(fieldInputType({ name: 'qty', kind: 'field', type: 'integer' })).toBe('number')
    })

    it('maps "float" to "number"', () => {
      expect(fieldInputType({ name: 'price', kind: 'field', type: 'float' })).toBe('number')
    })

    it('maps "double" to "number"', () => {
      expect(fieldInputType({ name: 'amount', kind: 'field', type: 'double' })).toBe('number')
    })

    it('maps "decimal" to "number"', () => {
      expect(fieldInputType({ name: 'rate', kind: 'field', type: 'decimal' })).toBe('number')
    })

    it('maps "number" to "number"', () => {
      expect(fieldInputType({ name: 'value', kind: 'field', type: 'number' })).toBe('number')
    })

    it('maps "bool" to "checkbox"', () => {
      expect(fieldInputType({ name: 'active', kind: 'field', type: 'bool' })).toBe('checkbox')
    })

    it('maps "boolean" to "checkbox"', () => {
      expect(fieldInputType({ name: 'enabled', kind: 'field', type: 'boolean' })).toBe('checkbox')
    })

    it('maps "date" to "date"', () => {
      expect(fieldInputType({ name: 'dob', kind: 'field', type: 'date' })).toBe('date')
    })

    it('maps "datetime" to "datetime-local"', () => {
      expect(fieldInputType({ name: 'startedAt', kind: 'field', type: 'datetime' })).toBe('datetime-local')
    })

    it('maps "timestamp" to "datetime-local"', () => {
      expect(fieldInputType({ name: 'loggedAt', kind: 'field', type: 'timestamp' })).toBe('datetime-local')
    })

    it('maps "email" to "email"', () => {
      expect(fieldInputType({ name: 'email', kind: 'field', type: 'email' })).toBe('email')
    })

    it('maps "url" to "url"', () => {
      expect(fieldInputType({ name: 'website', kind: 'field', type: 'url' })).toBe('url')
    })

    it('maps enum field to "select" regardless of base type', () => {
      expect(
        fieldInputType({
          name: 'stage',
          kind: 'enum',
          type: 'string',
          enumValues: ['Lead', 'Qualified', 'Customer'],
        }),
      ).toBe('select')
    })

    it('maps "textarea" type to "textarea" (RED)', () => {
      expect(fieldInputType({ name: 'description', kind: 'field', type: 'textarea' })).toBe('textarea')
    })

    it('maps "password" type to "password" (RED)', () => {
      expect(fieldInputType({ name: 'secret', kind: 'field', type: 'password' })).toBe('password')
    })

    it('maps "tel"/"phone" type to "tel" (RED)', () => {
      expect(fieldInputType({ name: 'phone', kind: 'field', type: 'tel' })).toBe('tel')
      expect(fieldInputType({ name: 'mobile', kind: 'field', type: 'phone' })).toBe('tel')
    })
  })

  // ---------------------------------------------------------------------------
  // 10. Verb Derivation — comprehensive
  // ---------------------------------------------------------------------------
  describe('deriveVerbs', () => {
    it('excludes standard CRUD verbs (create/get/update/delete/find)', () => {
      const Entity = Noun('VerbCrudEntity', {
        name: 'string!',
        status: 'Draft | Active',
        activate: 'Active',
      })
      const verbs = deriveVerbs(Entity.$schema)
      const verbNames = verbs.map((v) => v.name)
      expect(verbNames).not.toContain('create')
      expect(verbNames).not.toContain('get')
      expect(verbNames).not.toContain('update')
      expect(verbNames).not.toContain('delete')
      expect(verbNames).not.toContain('find')
    })

    it('excludes disabled verbs', () => {
      const Entity = Noun('VerbDisabledEntity', {
        name: 'string!',
        update: null,
        status: 'Draft | Published',
        publish: 'Published',
      })
      const verbs = deriveVerbs(Entity.$schema)
      const verbNames = verbs.map((v) => v.name)
      expect(verbNames).not.toContain('update')
      expect(verbNames).toContain('publish')
    })

    it('returns correct conjugation for custom verbs', () => {
      const Entity = Noun('VerbConjEntity', {
        name: 'string!',
        status: 'Open | Closed',
        close: 'Closed',
      })
      const verbs = deriveVerbs(Entity.$schema)
      const closeVerb = verbs.find((v) => v.name === 'close')
      expect(closeVerb).toBeDefined()
      expect(closeVerb!.conjugation).toBeDefined()
      expect(closeVerb!.conjugation.action).toBe('close')
      expect(closeVerb!.conjugation.activity).toBe('closing')
      expect(closeVerb!.conjugation.event).toBe('closed')
    })

    it('returns empty array for entity with no custom verbs', () => {
      const Entity = Noun('VerbNoneEntity', { name: 'string!', email: 'string' })
      const verbs = deriveVerbs(Entity.$schema)
      expect(verbs).toEqual([])
    })
  })

  describe('deriveAllVerbs', () => {
    it('includes both CRUD and custom verbs', () => {
      const Entity = Noun('AllVerbEntity', {
        name: 'string!',
        status: 'Draft | Published',
        publish: 'Published',
      })
      const allVerbs = deriveAllVerbs(Entity.$schema)
      const names = allVerbs.map((v) => v.name)
      expect(names).toContain('create')
      expect(names).toContain('update')
      expect(names).toContain('delete')
      expect(names).toContain('publish')
    })

    it('excludes only disabled verbs', () => {
      const Entity = Noun('AllVerbDisEntity', {
        name: 'string!',
        update: null,
        status: 'Draft | Active',
        activate: 'Active',
      })
      const allVerbs = deriveAllVerbs(Entity.$schema)
      const names = allVerbs.map((v) => v.name)
      expect(names).not.toContain('update')
      expect(names).toContain('create')
      expect(names).toContain('delete')
      expect(names).toContain('activate')
    })

    it('disabled update (null) is excluded from deriveAllVerbs', () => {
      const Entity = Noun('ImmutableEntity', {
        name: 'string!',
        update: null,
      })
      const allVerbs = deriveAllVerbs(Entity.$schema)
      const names = allVerbs.map((v) => v.name)
      expect(names).not.toContain('update')
      expect(names).toContain('create')
      expect(names).toContain('delete')
    })
  })

  // ---------------------------------------------------------------------------
  // 11. NEW: deriveVerbsByCategory — group verbs into lifecycle/custom (RED)
  // ---------------------------------------------------------------------------
  describe('deriveVerbsByCategory (RED)', () => {
    it('should be exported from schema-utils', async () => {
      const mod = await import('../src/schema-utils')
      expect(mod.deriveVerbsByCategory).toBeDefined()
    })

    it('separates verbs into crud and custom categories', async () => {
      const { deriveVerbsByCategory } = await import('../src/schema-utils')
      const Entity = Noun('VerbCatEntity', {
        name: 'string!',
        status: 'Open | Closed',
        close: 'Closed',
      })
      const categories = deriveVerbsByCategory(Entity.$schema)
      expect(categories.crud).toBeDefined()
      expect(categories.custom).toBeDefined()
      const crudNames = categories.crud.map((v: any) => v.name)
      const customNames = categories.custom.map((v: any) => v.name)
      expect(crudNames).toContain('create')
      expect(customNames).toContain('close')
      expect(customNames).not.toContain('create')
    })
  })

  // ---------------------------------------------------------------------------
  // 12. isRequired
  // ---------------------------------------------------------------------------
  describe('isRequired', () => {
    it('returns true for required fields (modifiers.required === true)', () => {
      expect(isRequired({ name: 'name', kind: 'field', type: 'string', modifiers: { required: true, optional: false, indexed: false, unique: false, array: false } })).toBe(true)
    })

    it('returns false for optional fields', () => {
      expect(isRequired({ name: 'bio', kind: 'field', type: 'string', modifiers: { required: false, optional: true, indexed: false, unique: false, array: false } })).toBe(false)
    })

    it('returns false when modifiers is undefined', () => {
      expect(isRequired({ name: 'misc', kind: 'field', type: 'string' })).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // 13. formatLabel — deeper coverage
  // ---------------------------------------------------------------------------
  describe('formatLabel — deeper', () => {
    it('handles $-prefixed keys by stripping the $', () => {
      expect(formatLabel('$createdAt')).toBe('Created At')
    })

    it('handles PascalCase', () => {
      expect(formatLabel('FirstName')).toBe('First Name')
    })

    it('handles multi-word camelCase', () => {
      expect(formatLabel('totalRevenueAmount')).toBe('Total Revenue Amount')
    })

    it('handles single lowercase word', () => {
      expect(formatLabel('email')).toBe('Email')
    })

    it('handles $updatedAt', () => {
      expect(formatLabel('$updatedAt')).toBe('Updated At')
    })

    it('handles acronyms like ID, URL, API correctly (RED)', () => {
      // $id should produce "ID" not "Id"
      expect(formatLabel('$id')).toBe('ID')
    })

    it('handles snake_case by converting to Title Case (RED)', () => {
      expect(formatLabel('first_name')).toBe('First Name')
    })
  })

  // ---------------------------------------------------------------------------
  // 14. formatCellValue — deeper coverage
  // ---------------------------------------------------------------------------
  describe('formatCellValue — deeper', () => {
    it('formats boolean true as "Yes"', () => {
      expect(formatCellValue(true)).toBe('Yes')
    })

    it('formats boolean false as "No"', () => {
      expect(formatCellValue(false)).toBe('No')
    })

    it('formats datetime value as locale string', () => {
      const result = formatCellValue('2024-06-15T12:30:00Z', 'datetime')
      expect(result).not.toBe('2024-06-15T12:30:00Z')
      expect(result.length).toBeGreaterThan(0)
    })

    it('formats date value as locale date string', () => {
      const result = formatCellValue('2024-06-15', 'date')
      expect(result).not.toBe('2024-06-15')
      expect(result.length).toBeGreaterThan(0)
    })

    it('formats objects as JSON strings', () => {
      const obj = { foo: 'bar', count: 42 }
      expect(formatCellValue(obj)).toBe(JSON.stringify(obj))
    })

    it('formats arrays as JSON strings', () => {
      const arr = [1, 2, 3]
      expect(formatCellValue(arr)).toBe(JSON.stringify(arr))
    })

    it('returns em-dash for null', () => {
      expect(formatCellValue(null)).toBe('\u2014')
    })

    it('returns em-dash for undefined', () => {
      expect(formatCellValue(undefined)).toBe('\u2014')
    })

    it('formats numbers as strings', () => {
      expect(formatCellValue(99.5)).toBe('99.5')
    })

    it('formats currency values with $ symbol when type is currency (RED)', () => {
      const result = formatCellValue(1999.99, 'currency')
      // Should format as a localized currency string with $ prefix
      expect(result).toContain('$')
      expect(result).toMatch(/\$.*1[,.]?999/)
    })

    it('truncates long strings above a threshold (RED)', () => {
      const longStr = 'a'.repeat(200)
      const result = formatCellValue(longStr, 'string')
      // Should truncate very long strings for display
      expect(result.length).toBeLessThan(200)
      expect(result).toContain('...')
    })

    it('formats percentage values with % suffix when type is percent (RED)', () => {
      const result = formatCellValue(0.75, 'percent')
      expect(result).toBe('75%')
    })

    it('formats entity count arrays with length indicator (RED)', () => {
      // When an array is formatted with type=count, should show count
      const result = formatCellValue([1, 2, 3], 'count')
      expect(result).toBe('3')
    })
  })

  // ---------------------------------------------------------------------------
  // 15. NEW: deriveRelationships — extract relationship info (RED)
  // ---------------------------------------------------------------------------
  describe('deriveRelationships (RED)', () => {
    it('should be exported from schema-utils', async () => {
      const mod = await import('../src/schema-utils')
      expect(mod.deriveRelationships).toBeDefined()
    })

    it('returns relationship metadata with targetType and cardinality', async () => {
      const { deriveRelationships } = await import('../src/schema-utils')
      const Company = Noun('RelCompany', { name: 'string!' })
      const Contact = Noun('RelContact', {
        name: 'string!',
        company: '-> RelCompany.contacts',
        deals: '<- Deal.contact[]',
      })
      const rels = deriveRelationships(Contact.$schema)
      expect(Array.isArray(rels)).toBe(true)
      expect(rels.length).toBeGreaterThan(0)
      const companyRel = rels.find((r: any) => r.key === 'company')
      expect(companyRel).toBeDefined()
      expect(companyRel.targetType).toBe('RelCompany')
    })
  })

  // ---------------------------------------------------------------------------
  // 16. NEW: schemaFieldCount — introspection helper (RED)
  // ---------------------------------------------------------------------------
  describe('schemaFieldCount (RED)', () => {
    it('should be exported from schema-utils', async () => {
      const mod = await import('../src/schema-utils')
      expect(mod.schemaFieldCount).toBeDefined()
    })

    it('returns counts of fields, relationships, and verbs', async () => {
      const { schemaFieldCount } = await import('../src/schema-utils')
      const Other = Noun('CountOther', { label: 'string!' })
      const Entity = Noun('CountEntity', {
        name: 'string!',
        email: 'string',
        other: '-> CountOther.entities',
        status: 'Draft | Published',
        publish: 'Published',
      })
      const counts = schemaFieldCount(Entity.$schema)
      expect(counts.fields).toBe(3)  // name, email, status
      expect(counts.relationships).toBe(1)  // other
      expect(counts.verbs).toBeGreaterThanOrEqual(1)  // publish (plus CRUD)
    })
  })

  // ---------------------------------------------------------------------------
  // 17. NEW: deriveDefaultValues — extract default form values from schema (RED)
  // ---------------------------------------------------------------------------
  describe('deriveDefaultValues (RED)', () => {
    it('should be exported from schema-utils', async () => {
      const mod = await import('../src/schema-utils')
      expect(mod.deriveDefaultValues).toBeDefined()
    })

    it('returns a record with default values for each field', async () => {
      const { deriveDefaultValues } = await import('../src/schema-utils')
      const Entity = Noun('DefaultEntity', {
        name: 'string!',
        count: 'int',
        active: 'boolean',
        stage: 'Lead | Qualified | Customer',
      })
      const defaults = deriveDefaultValues(Entity.$schema)
      expect(defaults).toBeDefined()
      expect(typeof defaults).toBe('object')
      // string fields should default to empty string
      expect(defaults.name).toBe('')
      // number fields should default to 0
      expect(defaults.count).toBe(0)
      // boolean fields should default to false
      expect(defaults.active).toBe(false)
      // enum fields should default to first enum value
      expect(defaults.stage).toBe('Lead')
    })
  })

  // ---------------------------------------------------------------------------
  // 18. NEW: fieldToQueryOperator — map field types to best query operators (RED)
  // ---------------------------------------------------------------------------
  describe('fieldToQueryOperator (RED)', () => {
    it('should be exported from schema-utils', async () => {
      const mod = await import('../src/schema-utils')
      expect(mod.fieldToQueryOperator).toBeDefined()
    })

    it('returns $regex for string fields', async () => {
      const { fieldToQueryOperator } = await import('../src/schema-utils')
      expect(fieldToQueryOperator({ name: 'name', kind: 'field', type: 'string' })).toBe('$regex')
    })

    it('returns $eq for number fields', async () => {
      const { fieldToQueryOperator } = await import('../src/schema-utils')
      expect(fieldToQueryOperator({ name: 'age', kind: 'field', type: 'int' })).toBe('$eq')
    })

    it('returns $in for enum fields', async () => {
      const { fieldToQueryOperator } = await import('../src/schema-utils')
      expect(fieldToQueryOperator({ name: 'stage', kind: 'enum', type: 'string', enumValues: ['A', 'B'] })).toBe('$in')
    })

    it('returns $eq for boolean fields', async () => {
      const { fieldToQueryOperator } = await import('../src/schema-utils')
      expect(fieldToQueryOperator({ name: 'active', kind: 'field', type: 'boolean' })).toBe('$eq')
    })
  })
})
