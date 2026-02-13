import { describe, it, expect, beforeEach } from 'vitest'
import { clearRegistry, Noun } from 'digital-objects'
import { nounToColumns, nounToSchemas, domainForEntity, getColumnsForNoun } from '../src/schema-bridge'

describe('@headlessly/ui — schema-bridge', () => {
  beforeEach(() => {
    clearRegistry()
  })

  describe('nounToColumns', () => {
    it('converts a simple noun to DatabaseColumnDef[]', () => {
      const Contact = Noun('Contact', {
        name: 'string!',
        email: 'string?#',
        stage: 'Lead | Qualified | Customer',
      })
      const columns = nounToColumns(Contact.$schema)

      expect(columns).toBeDefined()
      expect(Array.isArray(columns)).toBe(true)

      // Should have $id + 3 fields + $createdAt + $updatedAt = 6
      expect(columns.length).toBe(6)
    })

    it('includes $id as primary key', () => {
      const Entity = Noun('PkEntity', { name: 'string!' })
      const columns = nounToColumns(Entity.$schema)
      const idCol = columns.find((c) => c.accessorKey === '$id')

      expect(idCol).toBeDefined()
      expect(idCol!.isPrimaryKey).toBe(true)
      expect(idCol!.editable).toBe(false)
      expect(idCol!.dataType).toBe('text')
    })

    it('maps string fields to text dataType', () => {
      const Entity = Noun('TextEntity', { name: 'string!' })
      const columns = nounToColumns(Entity.$schema)
      const nameCol = columns.find((c) => c.accessorKey === 'name')

      expect(nameCol).toBeDefined()
      expect(nameCol!.dataType).toBe('text')
      expect(nameCol!.nullable).toBe(false)
    })

    it('maps number fields to number dataType', () => {
      const Entity = Noun('NumEntity', { amount: 'number' })
      const columns = nounToColumns(Entity.$schema)
      const amountCol = columns.find((c) => c.accessorKey === 'amount')

      expect(amountCol).toBeDefined()
      expect(amountCol!.dataType).toBe('number')
    })

    it('maps boolean fields to boolean dataType', () => {
      const Entity = Noun('BoolEntity', { active: 'boolean' })
      const columns = nounToColumns(Entity.$schema)
      const activeCol = columns.find((c) => c.accessorKey === 'active')

      expect(activeCol).toBeDefined()
      expect(activeCol!.dataType).toBe('boolean')
    })

    it('maps enum fields with enumValues', () => {
      const Entity = Noun('EnumEntity', { status: 'Active | Inactive | Archived' })
      const columns = nounToColumns(Entity.$schema)
      const statusCol = columns.find((c) => c.accessorKey === 'status')

      expect(statusCol).toBeDefined()
      expect(statusCol!.dataType).toBe('enum')
      expect(statusCol!.enumValues).toEqual(['Active', 'Inactive', 'Archived'])
    })

    it('maps email fields to email dataType', () => {
      const Entity = Noun('EmailEntity', { email: 'email' })
      const columns = nounToColumns(Entity.$schema)
      const emailCol = columns.find((c) => c.accessorKey === 'email')

      expect(emailCol).toBeDefined()
      expect(emailCol!.dataType).toBe('email')
    })

    it('maps forward relationships', () => {
      Noun('Org', { name: 'string!' })
      const Entity = Noun('RelEntity', {
        name: 'string!',
        organization: '-> Org.members',
      })
      const columns = nounToColumns(Entity.$schema)
      const relCol = columns.find((c) => c.accessorKey === 'organization')

      expect(relCol).toBeDefined()
      expect(relCol!.dataType).toBe('relationship')
      expect(relCol!.targetTable).toBe('Org')
      expect(relCol!.relationshipType).toBe('hasOne')
      expect(relCol!.relationshipDirection).toBe('outbound')
    })

    it('maps reverse relationships as hasMany inbound', () => {
      Noun('DealRef', { name: 'string!' })
      const Entity = Noun('RevRelEntity', {
        name: 'string!',
        deals: '<- DealRef.contact[]',
      })
      const columns = nounToColumns(Entity.$schema)
      const relCol = columns.find((c) => c.accessorKey === 'deals')

      expect(relCol).toBeDefined()
      expect(relCol!.dataType).toBe('relationship')
      expect(relCol!.targetTable).toBe('DealRef')
      expect(relCol!.relationshipType).toBe('hasMany')
      expect(relCol!.relationshipDirection).toBe('inbound')
      expect(relCol!.editable).toBe(false)
    })

    it('includes meta columns at the end', () => {
      const Entity = Noun('MetaEntity', { name: 'string!' })
      const columns = nounToColumns(Entity.$schema)
      const lastTwo = columns.slice(-2)

      expect(lastTwo[0].accessorKey).toBe('$createdAt')
      expect(lastTwo[0].dataType).toBe('date')
      expect(lastTwo[0].editable).toBe(false)

      expect(lastTwo[1].accessorKey).toBe('$updatedAt')
      expect(lastTwo[1].dataType).toBe('date')
      expect(lastTwo[1].editable).toBe(false)
    })

    it('marks unique fields with isUnique', () => {
      const Entity = Noun('UniqueEntity', { code: 'string##' })
      const columns = nounToColumns(Entity.$schema)
      const codeCol = columns.find((c) => c.accessorKey === 'code')

      expect(codeCol).toBeDefined()
      expect(codeCol!.isUnique).toBe(true)
    })
  })

  describe('domainForEntity', () => {
    it('returns correct domain for known entities', () => {
      expect(domainForEntity('Contact')).toBe('crm')
      expect(domainForEntity('Deal')).toBe('crm')
      expect(domainForEntity('Subscription')).toBe('billing')
      expect(domainForEntity('Project')).toBe('projects')
      expect(domainForEntity('Ticket')).toBe('support')
      expect(domainForEntity('Event')).toBe('analytics')
      expect(domainForEntity('Campaign')).toBe('marketing')
      expect(domainForEntity('Experiment')).toBe('experiments')
      expect(domainForEntity('Workflow')).toBe('platform')
      expect(domainForEntity('Message')).toBe('communication')
      expect(domainForEntity('User')).toBe('identity')
    })

    it('returns "other" for unknown entities', () => {
      expect(domainForEntity('FooBar')).toBe('other')
    })
  })

  describe('nounToSchemas', () => {
    it('groups registered nouns by domain', () => {
      Noun('Contact', { name: 'string!', email: 'string' })
      Noun('Deal', { title: 'string!', value: 'number' })
      Noun('Subscription', { plan: 'string!' })

      const schemas = nounToSchemas()

      expect(schemas.length).toBeGreaterThan(0)

      const crmSchema = schemas.find((s) => s.name === 'crm')
      expect(crmSchema).toBeDefined()
      expect(crmSchema!.tables.map((t) => t.name)).toContain('Contact')
      expect(crmSchema!.tables.map((t) => t.name)).toContain('Deal')

      const billingSchema = schemas.find((s) => s.name === 'billing')
      expect(billingSchema).toBeDefined()
      expect(billingSchema!.tables.map((t) => t.name)).toContain('Subscription')
    })

    it('filters to specified entities when provided', () => {
      Noun('Contact', { name: 'string!' })
      Noun('Deal', { title: 'string!' })
      Noun('Subscription', { plan: 'string!' })

      const schemas = nounToSchemas(['Contact', 'Subscription'])

      const allTables = schemas.flatMap((s) => s.tables.map((t) => t.name))
      expect(allTables).toContain('Contact')
      expect(allTables).toContain('Subscription')
      expect(allTables).not.toContain('Deal')
    })
  })

  describe('getColumnsForNoun', () => {
    it('returns columns for a registered noun', () => {
      Noun('Contact', { name: 'string!', email: 'string' })
      const columns = getColumnsForNoun('Contact')

      expect(columns).toBeDefined()
      expect(columns!.length).toBeGreaterThan(0)
    })

    it('returns undefined for an unregistered noun', () => {
      const columns = getColumnsForNoun('NonExistent')
      expect(columns).toBeUndefined()
    })
  })
})
