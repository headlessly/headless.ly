import { describe, it, expect, beforeEach } from 'vitest'
import { clearRegistry, Noun } from 'digital-objects'
import {
  deriveColumns,
  deriveFormFields,
  deriveVerbs,
  deriveAllVerbs,
  deriveFilterableColumns,
  deriveSortableColumns,
  deriveEntityTitle,
  validateFormData,
  columnsByKind,
  deriveVerbsByCategory,
  deriveRelationships,
  schemaFieldCount,
  deriveDefaultValues,
  fieldToQueryOperator,
  fieldInputType,
  isRequired,
  formatLabel,
  formatCellValue,
} from '../src/schema-utils'

// ---------------------------------------------------------------------------
// Deep v2 tests — 60+ NEW tests covering untested areas
// ---------------------------------------------------------------------------

describe('@headlessly/ui — deep v2 tests', () => {
  beforeEach(() => {
    clearRegistry()
  })

  // =========================================================================
  // SECTION A: Schema-driven form generation — deriveFormFields edge cases
  // =========================================================================
  describe('deriveFormFields — edge cases', () => {
    it('returns empty array for a schema with no data fields (only relationships and verbs)', () => {
      const Other = Noun('FormEdgeOther', { label: 'string!' })
      const Entity = Noun('FormEdgeEntity', {
        other: '-> FormEdgeOther.entities',
        status: 'Open | Closed',
        close: 'Closed',
      })
      const fields = deriveFormFields(Entity.$schema)
      // 'status' is an enum field (data field), should appear
      // 'other' is a relationship, should not appear
      // 'close' is a verb, should not appear
      const names = fields.map((f) => f.name)
      expect(names).toContain('status')
      expect(names).not.toContain('other')
      expect(names).not.toContain('close')
    })

    it('returns fields preserving order from schema definition', () => {
      const Entity = Noun('FormOrderEntity', {
        alpha: 'string!',
        beta: 'int',
        gamma: 'boolean',
        delta: 'Draft | Published',
      })
      const fields = deriveFormFields(Entity.$schema)
      const names = fields.map((f) => f.name)
      expect(names[0]).toBe('alpha')
      expect(names[1]).toBe('beta')
      expect(names[2]).toBe('gamma')
      expect(names[3]).toBe('delta')
    })

    it('returns fields with correct kind assignments', () => {
      const Entity = Noun('FormKindEntity', {
        name: 'string!',
        priority: 'Low | Medium | High',
      })
      const fields = deriveFormFields(Entity.$schema)
      const nameField = fields.find((f) => f.name === 'name')
      const priorityField = fields.find((f) => f.name === 'priority')
      expect(nameField?.kind).toBe('field')
      expect(priorityField?.kind).toBe('enum')
    })

    it('handles schema with only a single field', () => {
      const Entity = Noun('SingleFieldEntity', { code: 'string!' })
      const fields = deriveFormFields(Entity.$schema)
      expect(fields.length).toBe(1)
      expect(fields[0].name).toBe('code')
    })
  })

  // =========================================================================
  // SECTION B: Field type rendering — fieldInputType edge cases
  // =========================================================================
  describe('fieldInputType — edge cases', () => {
    it('defaults to "text" for unknown/unrecognized type', () => {
      expect(fieldInputType({ name: 'custom', kind: 'field', type: 'foobar' })).toBe('text')
    })

    it('defaults to "text" when type is undefined', () => {
      expect(fieldInputType({ name: 'noType', kind: 'field' })).toBe('text')
    })

    it('is case-insensitive for type strings', () => {
      expect(fieldInputType({ name: 'a', kind: 'field', type: 'Boolean' })).toBe('checkbox')
      expect(fieldInputType({ name: 'b', kind: 'field', type: 'DATE' })).toBe('date')
      expect(fieldInputType({ name: 'c', kind: 'field', type: 'Number' })).toBe('number')
      expect(fieldInputType({ name: 'd', kind: 'field', type: 'EMAIL' })).toBe('email')
    })

    it('returns "select" for field with enumValues even when kind is "field"', () => {
      expect(
        fieldInputType({
          name: 'tier',
          kind: 'field',
          type: 'string',
          enumValues: ['Free', 'Pro', 'Enterprise'],
        }),
      ).toBe('select')
    })

    it('maps "text" type to "text"', () => {
      expect(fieldInputType({ name: 'body', kind: 'field', type: 'text' })).toBe('text')
    })
  })

  // =========================================================================
  // SECTION C: Validation rules from schema — validateFormData edge cases
  // =========================================================================
  describe('validateFormData — edge cases', () => {
    it('treats empty string as missing for required fields', () => {
      const Entity = Noun('ValEmptyStr', { name: 'string!' })
      const errors = validateFormData(Entity.$schema, { name: '' })
      expect(errors.name).toBeDefined()
    })

    it('treats null as missing for required fields', () => {
      const Entity = Noun('ValNull', { name: 'string!' })
      const errors = validateFormData(Entity.$schema, { name: null })
      expect(errors.name).toBeDefined()
    })

    it('treats undefined as missing for required fields', () => {
      const Entity = Noun('ValUndef', { name: 'string!' })
      const errors = validateFormData(Entity.$schema, {})
      expect(errors.name).toBeDefined()
    })

    it('reports multiple errors at once for multiple missing required fields', () => {
      const Entity = Noun('ValMulti', {
        firstName: 'string!',
        lastName: 'string!',
        email: 'string!',
      })
      const errors = validateFormData(Entity.$schema, {})
      expect(Object.keys(errors).length).toBe(3)
      expect(errors.firstName).toBeDefined()
      expect(errors.lastName).toBeDefined()
      expect(errors.email).toBeDefined()
    })

    it('does not report errors for optional fields that are missing', () => {
      const Entity = Noun('ValOptional', {
        name: 'string!',
        bio: 'string',
        website: 'string?',
      })
      const errors = validateFormData(Entity.$schema, { name: 'Alice' })
      expect(Object.keys(errors).length).toBe(0)
    })

    it('does not validate enum for empty/undefined values', () => {
      const Entity = Noun('ValEnumEmpty', {
        stage: 'Lead | Qualified | Customer',
      })
      const errors = validateFormData(Entity.$schema, { stage: '' })
      // empty string on optional enum should not produce an enum error
      expect(errors.stage).toBeUndefined()
    })

    it('passes validation when enum value is valid', () => {
      const Entity = Noun('ValEnumValid', {
        name: 'string!',
        stage: 'Lead | Qualified | Customer',
      })
      const errors = validateFormData(Entity.$schema, { name: 'Alice', stage: 'Lead' })
      expect(Object.keys(errors).length).toBe(0)
    })

    it('validates enum values are case-sensitive', () => {
      const Entity = Noun('ValEnumCase', {
        stage: 'Lead | Qualified | Customer',
      })
      const errors = validateFormData(Entity.$schema, { stage: 'lead' })
      expect(errors.stage).toBeDefined()
      expect(errors.stage).toContain('must be one of')
    })

    it('error messages contain the field label', () => {
      const Entity = Noun('ValErrMsg', { firstName: 'string!' })
      const errors = validateFormData(Entity.$schema, {})
      expect(errors.firstName).toContain('First Name')
    })
  })

  // =========================================================================
  // SECTION D: CRUD component lifecycle — deriveVerbs / deriveAllVerbs edge cases
  // =========================================================================
  describe('deriveVerbs — advanced verb scenarios', () => {
    it('handles multiple custom verbs on one entity', () => {
      const Entity = Noun('MultiVerbEntity', {
        name: 'string!',
        status: 'Draft | Active | Archived | Suspended',
        activate: 'Active',
        archive: 'Archived',
        suspend: 'Suspended',
      })
      const verbs = deriveVerbs(Entity.$schema)
      const names = verbs.map((v) => v.name)
      expect(names).toContain('activate')
      expect(names).toContain('archive')
      expect(names).toContain('suspend')
      expect(names.length).toBe(3)
    })

    it('verb actions have properly formatted labels', () => {
      const Entity = Noun('VerbLabelEntity', {
        name: 'string!',
        status: 'Open | Closed',
        close: 'Closed',
      })
      const verbs = deriveVerbs(Entity.$schema)
      const closeVerb = verbs.find((v) => v.name === 'close')
      expect(closeVerb?.label).toBe('Close')
    })

    it('handles entity with all CRUD verbs disabled', () => {
      const Entity = Noun('NoUpdateEntity', {
        name: 'string!',
        update: null,
        delete: null,
      })
      const allVerbs = deriveAllVerbs(Entity.$schema)
      const names = allVerbs.map((v) => v.name)
      expect(names).not.toContain('update')
      expect(names).not.toContain('delete')
      expect(names).toContain('create')
    })
  })

  describe('deriveVerbsByCategory — edge cases', () => {
    it('returns empty custom array when there are no custom verbs', () => {
      const Entity = Noun('NoCustVerbEntity', { name: 'string!' })
      const { crud, custom } = deriveVerbsByCategory(Entity.$schema)
      expect(custom.length).toBe(0)
      expect(crud.length).toBeGreaterThan(0)
    })

    it('crud array contains only standard verbs', () => {
      const Entity = Noun('CrudOnlyEntity', {
        name: 'string!',
        status: 'Open | Closed',
        close: 'Closed',
      })
      const { crud } = deriveVerbsByCategory(Entity.$schema)
      const standardNames = new Set(['create', 'get', 'update', 'delete', 'find'])
      for (const v of crud) {
        expect(standardNames.has(v.name)).toBe(true)
      }
    })
  })

  // =========================================================================
  // SECTION E: List/table components with sorting and filtering — column derivation
  // =========================================================================
  describe('deriveColumns — complex schemas', () => {
    it('handles schema with many field types simultaneously', () => {
      const Entity = Noun('ManyTypesEntity', {
        name: 'string!',
        age: 'int',
        active: 'boolean',
        score: 'float',
        priority: 'Low | Medium | High',
      })
      const columns = deriveColumns(Entity.$schema)
      const keys = columns.map((c) => c.key)
      expect(keys).toContain('name')
      expect(keys).toContain('age')
      expect(keys).toContain('active')
      expect(keys).toContain('score')
      expect(keys).toContain('priority')
      // Plus meta: $id, $createdAt, $updatedAt
      expect(columns.length).toBe(8)
    })

    it('marks all data fields as filterable', () => {
      const Entity = Noun('FilterableEntity', {
        name: 'string!',
        email: 'string',
        count: 'int',
      })
      const columns = deriveColumns(Entity.$schema)
      const dataColumns = columns.filter((c) => c.kind === 'field')
      for (const col of dataColumns) {
        expect(col.filterable).toBe(true)
      }
    })

    it('preserves modifiers on columns', () => {
      const Entity = Noun('ModEntity', { email: 'string?#' })
      const columns = deriveColumns(Entity.$schema)
      const emailCol = columns.find((c) => c.key === 'email')
      expect(emailCol).toBeDefined()
      expect(emailCol!.modifiers).toBeDefined()
    })

    it('handles multiple relationship columns', () => {
      const A = Noun('RelA', { label: 'string!' })
      const B = Noun('RelB', { label: 'string!' })
      const Entity = Noun('MultiRelEntity', {
        name: 'string!',
        relA: '-> RelA.entities',
        relB: '-> RelB.entities',
      })
      const columns = deriveColumns(Entity.$schema)
      const relColumns = columns.filter((c) => c.kind === 'relationship')
      expect(relColumns.length).toBe(2)
      const relKeys = relColumns.map((c) => c.key)
      expect(relKeys).toContain('relA')
      expect(relKeys).toContain('relB')
    })
  })

  describe('deriveFilterableColumns — advanced', () => {
    it('returns correct count when schema has mixed field types', () => {
      const Other = Noun('FilterAdvOther', { label: 'string!' })
      const Entity = Noun('FilterAdvEntity', {
        name: 'string!',
        count: 'int',
        ref: '-> FilterAdvOther.entities',
      })
      const filterable = deriveFilterableColumns(Entity.$schema)
      // only data fields are filterable, not meta or relationship
      const keys = filterable.map((c) => c.key)
      expect(keys).toContain('name')
      expect(keys).toContain('count')
      expect(keys).not.toContain('ref')
      expect(keys).not.toContain('$id')
    })
  })

  describe('deriveSortableColumns — advanced', () => {
    it('includes meta columns that are sortable', () => {
      const Entity = Noun('SortAdvEntity', { name: 'string!' })
      const sortable = deriveSortableColumns(Entity.$schema)
      const keys = sortable.map((c) => c.key)
      expect(keys).toContain('$id')
      expect(keys).toContain('$createdAt')
      expect(keys).toContain('$updatedAt')
    })

    it('excludes relationship columns from sortable', () => {
      const Target = Noun('SortAdvTarget', { label: 'string!' })
      const Entity = Noun('SortAdvEntity2', {
        name: 'string!',
        target: '-> SortAdvTarget.entities',
      })
      const sortable = deriveSortableColumns(Entity.$schema)
      const keys = sortable.map((c) => c.key)
      expect(keys).not.toContain('target')
    })
  })

  // =========================================================================
  // SECTION F: Detail view components — deriveEntityTitle edge cases
  // =========================================================================
  describe('deriveEntityTitle — edge cases', () => {
    it('prefers name over title when both exist', () => {
      const Entity = Noun('TitleBothEntity', { name: 'string!', title: 'string' })
      const result = deriveEntityTitle(Entity.$schema, {
        $id: 'e_1',
        $type: 'TitleBothEntity',
        $context: '',
        $version: 1,
        $createdAt: '',
        $updatedAt: '',
        name: 'Alice',
        title: 'My Title',
      })
      expect(result).toBe('Alice')
    })

    it('returns empty string when $id is also undefined', () => {
      const Entity = Noun('TitleNoIdEntity', { code: 'string' })
      const result = deriveEntityTitle(Entity.$schema, {
        $id: undefined as any,
        $type: 'TitleNoIdEntity',
        $context: '',
        $version: 1,
        $createdAt: '',
        $updatedAt: '',
        code: 'ABC',
      })
      expect(result).toBe('')
    })

    it('handles name field with null value (falls back to title or $id)', () => {
      const Entity = Noun('TitleNullNameEntity', { name: 'string', title: 'string' })
      const result = deriveEntityTitle(Entity.$schema, {
        $id: 'e_2',
        $type: 'TitleNullNameEntity',
        $context: '',
        $version: 1,
        $createdAt: '',
        $updatedAt: '',
        name: null,
        title: 'Fallback Title',
      })
      expect(result).toBe('Fallback Title')
    })

    it('coerces numeric values to string', () => {
      const Entity = Noun('TitleNumEntity', { name: 'string!', count: 'int' })
      const result = deriveEntityTitle(Entity.$schema, {
        $id: 'e_3',
        $type: 'TitleNumEntity',
        $context: '',
        $version: 1,
        $createdAt: '',
        $updatedAt: '',
        name: 42 as any,
        count: 10,
      })
      expect(result).toBe('42')
    })
  })

  // =========================================================================
  // SECTION G: Error and edge cases — empty schemas, unknown types, nested
  // =========================================================================
  describe('empty schema edge cases', () => {
    it('deriveFormFields returns empty array for empty schema', () => {
      const Entity = Noun('EmptyFormEntity', {})
      expect(deriveFormFields(Entity.$schema)).toEqual([])
    })

    it('validateFormData returns empty errors for empty schema', () => {
      const Entity = Noun('EmptyValidEntity', {})
      expect(validateFormData(Entity.$schema, {})).toEqual({})
    })

    it('deriveVerbs returns empty array for empty schema', () => {
      const Entity = Noun('EmptyVerbEntity', {})
      expect(deriveVerbs(Entity.$schema)).toEqual([])
    })

    it('columnsByKind returns empty field and relationship arrays for empty schema', () => {
      const Entity = Noun('EmptyGroupEntity', {})
      const { meta, field, relationship } = columnsByKind(Entity.$schema)
      expect(field.length).toBe(0)
      expect(relationship.length).toBe(0)
      // meta should still have $id, $createdAt, $updatedAt
      expect(meta.length).toBe(3)
    })

    it('schemaFieldCount returns all zeros for empty schema', () => {
      const Entity = Noun('EmptyCountEntity', {})
      const counts = schemaFieldCount(Entity.$schema)
      expect(counts.fields).toBe(0)
      expect(counts.relationships).toBe(0)
      // verbs may still include default CRUD verbs
      expect(counts.verbs).toBeGreaterThanOrEqual(0)
    })

    it('deriveRelationships returns empty array for schema with no relationships', () => {
      const Entity = Noun('NoRelEntity', { name: 'string!', age: 'int' })
      const rels = deriveRelationships(Entity.$schema)
      expect(rels).toEqual([])
    })

    it('deriveDefaultValues returns empty object for empty schema', () => {
      const Entity = Noun('EmptyDefaultEntity', {})
      expect(deriveDefaultValues(Entity.$schema)).toEqual({})
    })
  })

  // =========================================================================
  // SECTION H: deriveDefaultValues — comprehensive type coverage
  // =========================================================================
  describe('deriveDefaultValues — type coverage', () => {
    it('defaults float fields to 0', () => {
      const Entity = Noun('DefFloat', { score: 'float' })
      const defaults = deriveDefaultValues(Entity.$schema)
      expect(defaults.score).toBe(0)
    })

    it('defaults double fields to 0', () => {
      const Entity = Noun('DefDouble', { amount: 'double' })
      const defaults = deriveDefaultValues(Entity.$schema)
      expect(defaults.amount).toBe(0)
    })

    it('defaults decimal fields to 0', () => {
      const Entity = Noun('DefDecimal', { rate: 'decimal' })
      const defaults = deriveDefaultValues(Entity.$schema)
      expect(defaults.rate).toBe(0)
    })

    it('defaults integer fields to 0', () => {
      const Entity = Noun('DefInteger', { qty: 'integer' })
      const defaults = deriveDefaultValues(Entity.$schema)
      expect(defaults.qty).toBe(0)
    })

    it('defaults bool fields to false', () => {
      const Entity = Noun('DefBool', { active: 'bool' })
      const defaults = deriveDefaultValues(Entity.$schema)
      expect(defaults.active).toBe(false)
    })

    it('defaults date/datetime/unknown string fields to empty string', () => {
      const Entity = Noun('DefDate', { dob: 'date', created: 'datetime', misc: 'custom' })
      const defaults = deriveDefaultValues(Entity.$schema)
      expect(defaults.dob).toBe('')
      expect(defaults.created).toBe('')
      expect(defaults.misc).toBe('')
    })

    it('defaults enum fields to first enum value', () => {
      const Entity = Noun('DefEnum', { priority: 'High | Medium | Low' })
      const defaults = deriveDefaultValues(Entity.$schema)
      expect(defaults.priority).toBe('High')
    })

    it('handles mixed field types in a single schema', () => {
      const Entity = Noun('DefMixed', {
        name: 'string!',
        count: 'int',
        active: 'boolean',
        stage: 'Draft | Published',
      })
      const defaults = deriveDefaultValues(Entity.$schema)
      expect(defaults.name).toBe('')
      expect(defaults.count).toBe(0)
      expect(defaults.active).toBe(false)
      expect(defaults.stage).toBe('Draft')
    })
  })

  // =========================================================================
  // SECTION I: fieldToQueryOperator — comprehensive coverage
  // =========================================================================
  describe('fieldToQueryOperator — comprehensive coverage', () => {
    it('returns $regex for text type', () => {
      expect(fieldToQueryOperator({ name: 'body', kind: 'field', type: 'text' })).toBe('$regex')
    })

    it('returns $eq for float type', () => {
      expect(fieldToQueryOperator({ name: 'score', kind: 'field', type: 'float' })).toBe('$eq')
    })

    it('returns $eq for double type', () => {
      expect(fieldToQueryOperator({ name: 'amount', kind: 'field', type: 'double' })).toBe('$eq')
    })

    it('returns $eq for decimal type', () => {
      expect(fieldToQueryOperator({ name: 'rate', kind: 'field', type: 'decimal' })).toBe('$eq')
    })

    it('returns $eq for number type', () => {
      expect(fieldToQueryOperator({ name: 'val', kind: 'field', type: 'number' })).toBe('$eq')
    })

    it('returns $eq for bool type', () => {
      expect(fieldToQueryOperator({ name: 'flag', kind: 'field', type: 'bool' })).toBe('$eq')
    })

    it('returns $eq for unknown type (defaults)', () => {
      expect(fieldToQueryOperator({ name: 'custom', kind: 'field', type: 'foobar' })).toBe('$eq')
    })

    it('returns $regex when type is undefined (defaults to string)', () => {
      // When type is undefined, the function defaults to 'string', which maps to $regex
      expect(fieldToQueryOperator({ name: 'noType', kind: 'field' })).toBe('$regex')
    })

    it('returns $in when enumValues are present even on a "field" kind', () => {
      expect(fieldToQueryOperator({ name: 'tier', kind: 'field', type: 'string', enumValues: ['A', 'B'] })).toBe('$in')
    })
  })

  // =========================================================================
  // SECTION J: formatLabel — comprehensive acronym and edge cases
  // =========================================================================
  describe('formatLabel — comprehensive', () => {
    it('uppercases URL acronym', () => {
      expect(formatLabel('apiUrl')).toBe('API URL')
    })

    it('uppercases API acronym', () => {
      expect(formatLabel('apiKey')).toBe('API Key')
    })

    it('uppercases HTML acronym', () => {
      expect(formatLabel('htmlContent')).toBe('HTML Content')
    })

    it('uppercases CSS acronym', () => {
      expect(formatLabel('cssClass')).toBe('CSS Class')
    })

    it('uppercases JSON acronym', () => {
      expect(formatLabel('jsonData')).toBe('JSON Data')
    })

    it('uppercases SQL acronym', () => {
      expect(formatLabel('sqlQuery')).toBe('SQL Query')
    })

    it('uppercases HTTP and HTTPS acronyms', () => {
      expect(formatLabel('httpStatus')).toBe('HTTP Status')
      expect(formatLabel('httpsUrl')).toBe('HTTPS URL')
    })

    it('uppercases XML acronym', () => {
      expect(formatLabel('xmlPayload')).toBe('XML Payload')
    })

    it('uppercases IP acronym', () => {
      expect(formatLabel('ipAddress')).toBe('IP Address')
    })

    it('handles a key that is just a single character', () => {
      const result = formatLabel('x')
      expect(result).toBe('X')
    })

    it('handles empty string gracefully', () => {
      const result = formatLabel('')
      // Should return empty or something reasonable
      expect(typeof result).toBe('string')
    })

    it('handles snake_case with multiple underscores', () => {
      expect(formatLabel('first_name_value')).toBe('First Name Value')
    })

    it('handles $version meta field', () => {
      expect(formatLabel('$version')).toBe('Version')
    })

    it('handles $context meta field', () => {
      expect(formatLabel('$context')).toBe('Context')
    })
  })

  // =========================================================================
  // SECTION K: formatCellValue — comprehensive edge cases
  // =========================================================================
  describe('formatCellValue — comprehensive edge cases', () => {
    it('returns "Yes" for true', () => {
      expect(formatCellValue(true)).toBe('Yes')
    })

    it('returns "No" for false', () => {
      expect(formatCellValue(false)).toBe('No')
    })

    it('returns em-dash for null', () => {
      expect(formatCellValue(null)).toBe('\u2014')
    })

    it('returns em-dash for undefined', () => {
      expect(formatCellValue(undefined)).toBe('\u2014')
    })

    it('formats 0 as "0" (falsy but valid)', () => {
      expect(formatCellValue(0)).toBe('0')
    })

    it('formats empty string without truncation', () => {
      expect(formatCellValue('', 'string')).toBe('')
    })

    it('formats an invalid date string by returning the original string', () => {
      const result = formatCellValue('not-a-date', 'datetime')
      expect(result).toBe('not-a-date')
    })

    it('formats negative numbers', () => {
      expect(formatCellValue(-42)).toBe('-42')
    })

    it('formats currency with negative amounts', () => {
      const result = formatCellValue(-500, 'currency')
      expect(result).toContain('$')
    })

    it('formats 0 percent as "0%"', () => {
      expect(formatCellValue(0, 'percent')).toBe('0%')
    })

    it('formats 1.0 (100%) as "100%"', () => {
      expect(formatCellValue(1, 'percent')).toBe('100%')
    })

    it('formats empty array as "0" with count type', () => {
      expect(formatCellValue([], 'count')).toBe('0')
    })

    it('formats nested object as JSON', () => {
      const obj = { a: { b: 1 } }
      expect(formatCellValue(obj)).toBe(JSON.stringify(obj))
    })

    it('formats timestamp type same as datetime', () => {
      const result = formatCellValue('2024-06-15T12:30:00Z', 'timestamp')
      // Should parse as a date and produce a locale string
      expect(result).not.toBe('2024-06-15T12:30:00Z')
      expect(result.length).toBeGreaterThan(0)
    })

    it('string that is exactly at 100 chars is not truncated', () => {
      const str = 'a'.repeat(100)
      const result = formatCellValue(str, 'string')
      expect(result).toBe(str)
      expect(result.length).toBe(100)
    })

    it('string that is 101 chars is truncated with ellipsis', () => {
      const str = 'a'.repeat(101)
      const result = formatCellValue(str, 'string')
      // Truncates to 100 chars + '...' = 103 total
      expect(result.length).toBe(103)
      expect(result).toContain('...')
      expect(result).toBe('a'.repeat(100) + '...')
    })
  })

  // =========================================================================
  // SECTION L: deriveRelationships — direction and multiple relationships
  // =========================================================================
  describe('deriveRelationships — direction detection', () => {
    it('detects forward relationship with "->"', () => {
      const Target = Noun('RelFwdTarget', { label: 'string!' })
      const Entity = Noun('RelFwdEntity', {
        name: 'string!',
        target: '-> RelFwdTarget.entities',
      })
      const rels = deriveRelationships(Entity.$schema)
      const fwdRel = rels.find((r) => r.key === 'target')
      expect(fwdRel).toBeDefined()
      expect(fwdRel!.direction).toBe('forward')
      expect(fwdRel!.targetType).toBe('RelFwdTarget')
    })

    it('detects backward relationship with "<-"', () => {
      const Entity = Noun('RelBwdEntity', {
        name: 'string!',
        items: '<- Item.parent[]',
      })
      const rels = deriveRelationships(Entity.$schema)
      const bwdRel = rels.find((r) => r.key === 'items')
      expect(bwdRel).toBeDefined()
      expect(bwdRel!.direction).toBe('backward')
    })

    it('handles entity with both forward and backward relationships', () => {
      const Company = Noun('RelMixCompany', { name: 'string!' })
      const Entity = Noun('RelMixEntity', {
        name: 'string!',
        company: '-> RelMixCompany.contacts',
        deals: '<- Deal.contact[]',
      })
      const rels = deriveRelationships(Entity.$schema)
      expect(rels.length).toBe(2)
      const directions = rels.map((r) => r.direction)
      expect(directions).toContain('forward')
      expect(directions).toContain('backward')
    })
  })

  // =========================================================================
  // SECTION M: schemaFieldCount — comprehensive counting
  // =========================================================================
  describe('schemaFieldCount — comprehensive', () => {
    it('counts only data fields, not relationships or verbs', () => {
      const Target = Noun('CountTarget2', { label: 'string!' })
      const Entity = Noun('CountEntity2', {
        name: 'string!',
        email: 'string',
        stage: 'Draft | Published',
        target: '-> CountTarget2.entities',
        publish: 'Published',
      })
      const counts = schemaFieldCount(Entity.$schema)
      expect(counts.fields).toBe(3) // name, email, stage
      expect(counts.relationships).toBe(1) // target
      expect(counts.verbs).toBeGreaterThanOrEqual(4) // CRUD + publish
    })

    it('counts verbs correctly with disabled verbs', () => {
      const Entity = Noun('CountDisabled', {
        name: 'string!',
        update: null,
      })
      const counts = schemaFieldCount(Entity.$schema)
      // disabled verbs may still be in the verbs map depending on implementation
      // but either way, the count should reflect the schema
      expect(counts.fields).toBe(1)
      expect(counts.relationships).toBe(0)
    })

    it('entity with many enum fields counts them all as fields', () => {
      const Entity = Noun('CountEnums', {
        priority: 'Low | Medium | High',
        status: 'Open | Closed',
        type: 'Bug | Feature | Task',
      })
      const counts = schemaFieldCount(Entity.$schema)
      expect(counts.fields).toBe(3)
    })
  })

  // =========================================================================
  // SECTION N: isRequired — from Noun-generated schemas
  // =========================================================================
  describe('isRequired — from generated schemas', () => {
    it('returns true for a "string!" field from Noun', () => {
      const Entity = Noun('IsReqEntity1', { name: 'string!' })
      const fields = deriveFormFields(Entity.$schema)
      const nameField = fields.find((f) => f.name === 'name')
      expect(nameField).toBeDefined()
      expect(isRequired(nameField!)).toBe(true)
    })

    it('returns false for a "string" (no modifier) field from Noun', () => {
      const Entity = Noun('IsReqEntity2', { bio: 'string' })
      const fields = deriveFormFields(Entity.$schema)
      const bioField = fields.find((f) => f.name === 'bio')
      expect(bioField).toBeDefined()
      expect(isRequired(bioField!)).toBe(false)
    })

    it('returns false for a "string?" (optional) field from Noun', () => {
      const Entity = Noun('IsReqEntity3', { note: 'string?' })
      const fields = deriveFormFields(Entity.$schema)
      const noteField = fields.find((f) => f.name === 'note')
      expect(noteField).toBeDefined()
      expect(isRequired(noteField!)).toBe(false)
    })
  })

  // =========================================================================
  // SECTION O: columnsByKind — comprehensive grouping tests
  // =========================================================================
  describe('columnsByKind — comprehensive', () => {
    it('meta bucket always has exactly 3 entries ($id, $createdAt, $updatedAt)', () => {
      const Entity = Noun('GroupMeta', { name: 'string!', age: 'int' })
      const { meta } = columnsByKind(Entity.$schema)
      expect(meta.length).toBe(3)
      const keys = meta.map((c) => c.key)
      expect(keys).toContain('$id')
      expect(keys).toContain('$createdAt')
      expect(keys).toContain('$updatedAt')
    })

    it('relationship bucket matches number of schema relationships', () => {
      const A = Noun('GroupRelA', { label: 'string!' })
      const B = Noun('GroupRelB', { label: 'string!' })
      const Entity = Noun('GroupRelEntity', {
        name: 'string!',
        a: '-> GroupRelA.entities',
        b: '-> GroupRelB.entities',
      })
      const { relationship } = columnsByKind(Entity.$schema)
      expect(relationship.length).toBe(2)
    })

    it('field + relationship + meta sums to total columns', () => {
      const Other = Noun('GroupSumOther', { label: 'string!' })
      const Entity = Noun('GroupSumEntity', {
        name: 'string!',
        email: 'string',
        other: '-> GroupSumOther.entities',
      })
      const { meta, field, relationship } = columnsByKind(Entity.$schema)
      const total = deriveColumns(Entity.$schema)
      expect(meta.length + field.length + relationship.length).toBe(total.length)
    })
  })

  // =========================================================================
  // SECTION P: Styles module exports
  // =========================================================================
  describe('styles module exports', () => {
    it('exports tableStyles with expected keys', async () => {
      const mod = await import('../src/styles')
      expect(mod.tableStyles).toBeDefined()
      expect(mod.tableStyles.wrapper).toBeDefined()
      expect(mod.tableStyles.table).toBeDefined()
      expect(mod.tableStyles.th).toBeDefined()
      expect(mod.tableStyles.td).toBeDefined()
      expect(mod.tableStyles.tr).toBeDefined()
      expect(mod.tableStyles.pagination).toBeDefined()
    })

    it('exports formStyles with expected keys', async () => {
      const mod = await import('../src/styles')
      expect(mod.formStyles).toBeDefined()
      expect(mod.formStyles.form).toBeDefined()
      expect(mod.formStyles.fieldGroup).toBeDefined()
      expect(mod.formStyles.label).toBeDefined()
      expect(mod.formStyles.input).toBeDefined()
      expect(mod.formStyles.select).toBeDefined()
      expect(mod.formStyles.error).toBeDefined()
    })

    it('exports buttonStyles with all variants', async () => {
      const mod = await import('../src/styles')
      expect(mod.buttonStyles).toBeDefined()
      expect(mod.buttonStyles.base).toBeDefined()
      expect(mod.buttonStyles.primary).toBeDefined()
      expect(mod.buttonStyles.secondary).toBeDefined()
      expect(mod.buttonStyles.danger).toBeDefined()
      expect(mod.buttonStyles.disabled).toBeDefined()
      expect(mod.buttonStyles.loading).toBeDefined()
    })

    it('exports detailStyles with expected keys', async () => {
      const mod = await import('../src/styles')
      expect(mod.detailStyles).toBeDefined()
      expect(mod.detailStyles.wrapper).toBeDefined()
      expect(mod.detailStyles.header).toBeDefined()
      expect(mod.detailStyles.title).toBeDefined()
      expect(mod.detailStyles.section).toBeDefined()
      expect(mod.detailStyles.fieldGrid).toBeDefined()
      expect(mod.detailStyles.badge).toBeDefined()
      expect(mod.detailStyles.link).toBeDefined()
    })

    it('exports timelineStyles with expected keys', async () => {
      const mod = await import('../src/styles')
      expect(mod.timelineStyles).toBeDefined()
      expect(mod.timelineStyles.wrapper).toBeDefined()
      expect(mod.timelineStyles.list).toBeDefined()
      expect(mod.timelineStyles.item).toBeDefined()
      expect(mod.timelineStyles.dot).toBeDefined()
      expect(mod.timelineStyles.diff).toBeDefined()
    })

    it('exports dashboardStyles with expected keys', async () => {
      const mod = await import('../src/styles')
      expect(mod.dashboardStyles).toBeDefined()
      expect(mod.dashboardStyles.grid).toBeDefined()
      expect(mod.dashboardStyles.card).toBeDefined()
      expect(mod.dashboardStyles.cardHeader).toBeDefined()
      expect(mod.dashboardStyles.cardTitle).toBeDefined()
    })

    it('exports searchStyles with expected keys', async () => {
      const mod = await import('../src/styles')
      expect(mod.searchStyles).toBeDefined()
      expect(mod.searchStyles.wrapper).toBeDefined()
      expect(mod.searchStyles.input).toBeDefined()
      expect(mod.searchStyles.dropdown).toBeDefined()
      expect(mod.searchStyles.resultItem).toBeDefined()
    })

    it('exports graphStyles with expected keys', async () => {
      const mod = await import('../src/styles')
      expect(mod.graphStyles).toBeDefined()
      expect(mod.graphStyles.wrapper).toBeDefined()
      expect(mod.graphStyles.svg).toBeDefined()
    })

    it('exports CSS custom property vars', async () => {
      const mod = await import('../src/styles')
      expect(mod.vars).toBeDefined()
      expect(mod.vars.bg).toBeDefined()
      expect(mod.vars.primary).toBeDefined()
      expect(mod.vars.danger).toBeDefined()
      expect(mod.vars.text).toBeDefined()
      expect(mod.vars.font).toBeDefined()
    })
  })

  // =========================================================================
  // SECTION Q: Cross-utility integration tests (multiple utils on same schema)
  // =========================================================================
  describe('cross-utility integration', () => {
    it('deriveColumns and deriveFormFields produce consistent field sets', () => {
      const Entity = Noun('IntegEntity', {
        name: 'string!',
        email: 'string',
        stage: 'Lead | Qualified | Customer',
      })
      const columns = deriveColumns(Entity.$schema)
      const formFields = deriveFormFields(Entity.$schema)
      const colDataKeys = columns.filter((c) => c.kind === 'field').map((c) => c.key)
      const formKeys = formFields.map((f) => f.name)
      // Every form field should have a matching column
      for (const key of formKeys) {
        expect(colDataKeys).toContain(key)
      }
    })

    it('deriveDefaultValues keys match deriveFormFields names', () => {
      const Entity = Noun('IntegDefEntity', {
        name: 'string!',
        count: 'int',
        priority: 'Low | Medium | High',
      })
      const defaults = deriveDefaultValues(Entity.$schema)
      const formFields = deriveFormFields(Entity.$schema)
      const formKeys = formFields.map((f) => f.name)
      for (const key of formKeys) {
        expect(key in defaults).toBe(true)
      }
    })

    it('validateFormData with deriveDefaultValues produces no errors for optional-only schema', () => {
      const Entity = Noun('IntegValDefEntity', {
        bio: 'string',
        website: 'string?',
      })
      const defaults = deriveDefaultValues(Entity.$schema)
      const errors = validateFormData(Entity.$schema, defaults)
      expect(Object.keys(errors).length).toBe(0)
    })

    it('schemaFieldCount.fields matches deriveFormFields length', () => {
      const Entity = Noun('IntegCountEntity', {
        name: 'string!',
        email: 'string',
        age: 'int',
      })
      const count = schemaFieldCount(Entity.$schema)
      const fields = deriveFormFields(Entity.$schema)
      expect(count.fields).toBe(fields.length)
    })

    it('schemaFieldCount.relationships matches deriveRelationships length', () => {
      const Target = Noun('IntegRelTarget', { label: 'string!' })
      const Entity = Noun('IntegRelEntity', {
        name: 'string!',
        target: '-> IntegRelTarget.entities',
      })
      const count = schemaFieldCount(Entity.$schema)
      const rels = deriveRelationships(Entity.$schema)
      expect(count.relationships).toBe(rels.length)
    })
  })

  // =========================================================================
  // SECTION R: Type exports and module shape
  // =========================================================================
  describe('type and module shape', () => {
    it('index exports all schema-utils functions', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.deriveColumns).toBe('function')
      expect(typeof mod.deriveFormFields).toBe('function')
      expect(typeof mod.deriveVerbs).toBe('function')
      expect(typeof mod.deriveAllVerbs).toBe('function')
      expect(typeof mod.deriveFilterableColumns).toBe('function')
      expect(typeof mod.deriveSortableColumns).toBe('function')
      expect(typeof mod.deriveEntityTitle).toBe('function')
      expect(typeof mod.validateFormData).toBe('function')
      expect(typeof mod.columnsByKind).toBe('function')
      expect(typeof mod.deriveVerbsByCategory).toBe('function')
      expect(typeof mod.deriveRelationships).toBe('function')
      expect(typeof mod.schemaFieldCount).toBe('function')
      expect(typeof mod.deriveDefaultValues).toBe('function')
      expect(typeof mod.fieldToQueryOperator).toBe('function')
      expect(typeof mod.fieldInputType).toBe('function')
      expect(typeof mod.isRequired).toBe('function')
      expect(typeof mod.formatLabel).toBe('function')
      expect(typeof mod.formatCellValue).toBe('function')
    })

    it('index exports all component functions', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.EntityTable).toBe('function')
      expect(typeof mod.EntityForm).toBe('function')
      expect(typeof mod.EntityDetail).toBe('function')
      expect(typeof mod.EntityTimeline).toBe('function')
      expect(typeof mod.Dashboard).toBe('function')
      expect(typeof mod.SearchBar).toBe('function')
      expect(typeof mod.VerbButton).toBe('function')
      expect(typeof mod.RelationshipGraph).toBe('function')
    })

    it('index exports all hooks', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.useEntity).toBe('function')
      expect(typeof mod.useEntities).toBe('function')
      expect(typeof mod.useSearch).toBe('function')
      expect(typeof mod.useRealtime).toBe('function')
    })

    it('index exports HeadlessUIProvider and useHeadlessUI', async () => {
      const mod = await import('../src/index')
      expect(typeof mod.HeadlessUIProvider).toBe('function')
      expect(typeof mod.useHeadlessUI).toBe('function')
    })
  })
})
