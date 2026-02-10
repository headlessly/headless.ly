import { describe, it, expect, vi } from 'vitest'
import type { NounSchema, ParsedProperty, VerbConjugation, NounInstance } from 'digital-objects'
import { Campaign, Segment, Form } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/marketing — deep v4', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Campaign field modifier objects — complete shape (8 tests)
  // ===========================================================================
  describe('Campaign field modifier complete shape', () => {
    it('name field modifiers: required=true, optional=false, indexed=false, unique=false, array=false', () => {
      const schema = Campaign.$schema as NounSchema
      const f = schema.fields.get('name') as ParsedProperty
      expect(f.modifiers).toBeDefined()
      expect(f.modifiers!.required).toBe(true)
      expect(f.modifiers!.optional).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })

    it('slug field modifiers: required=false, optional=false, indexed=true, unique=true, array=false', () => {
      const schema = Campaign.$schema as NounSchema
      const f = schema.fields.get('slug') as ParsedProperty
      expect(f.modifiers).toBeDefined()
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.optional).toBe(false)
      expect(f.modifiers!.indexed).toBe(true)
      expect(f.modifiers!.unique).toBe(true)
      expect(f.modifiers!.array).toBe(false)
    })

    it('slug field type is string', () => {
      const schema = Campaign.$schema as NounSchema
      const f = schema.fields.get('slug') as ParsedProperty
      expect(f.type).toBe('string')
    })

    it('description field modifiers: all false/default', () => {
      const schema = Campaign.$schema as NounSchema
      const f = schema.fields.get('description') as ParsedProperty
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.optional).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })

    it('budget field modifiers: all false/default with type number', () => {
      const schema = Campaign.$schema as NounSchema
      const f = schema.fields.get('budget') as ParsedProperty
      expect(f.kind).toBe('field')
      expect(f.type).toBe('number')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
    })

    it('startDate field kind is field with type date and default modifiers', () => {
      const schema = Campaign.$schema as NounSchema
      const f = schema.fields.get('startDate') as ParsedProperty
      expect(f.kind).toBe('field')
      expect(f.type).toBe('date')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })

    it('launchedAt field kind is field with type datetime and default modifiers', () => {
      const schema = Campaign.$schema as NounSchema
      const f = schema.fields.get('launchedAt') as ParsedProperty
      expect(f.kind).toBe('field')
      expect(f.type).toBe('datetime')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.optional).toBe(false)
    })

    it('currency field kind is field with type string and no modifiers set', () => {
      const schema = Campaign.$schema as NounSchema
      const f = schema.fields.get('currency') as ParsedProperty
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
    })
  })

  // ===========================================================================
  // 2. Segment field modifier objects — complete shape (5 tests)
  // ===========================================================================
  describe('Segment field modifier complete shape', () => {
    it('name field modifiers: required=true, rest false', () => {
      const schema = Segment.$schema as NounSchema
      const f = schema.fields.get('name') as ParsedProperty
      expect(f.modifiers!.required).toBe(true)
      expect(f.modifiers!.optional).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })

    it('description field modifiers: all false/default', () => {
      const schema = Segment.$schema as NounSchema
      const f = schema.fields.get('description') as ParsedProperty
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
    })

    it('criteria field modifiers: all false/default', () => {
      const schema = Segment.$schema as NounSchema
      const f = schema.fields.get('criteria') as ParsedProperty
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })

    it('memberCount field modifiers: all false/default', () => {
      const schema = Segment.$schema as NounSchema
      const f = schema.fields.get('memberCount') as ParsedProperty
      expect(f.kind).toBe('field')
      expect(f.type).toBe('number')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.optional).toBe(false)
    })

    it('isDynamic field modifiers: all false/default', () => {
      const schema = Segment.$schema as NounSchema
      const f = schema.fields.get('isDynamic') as ParsedProperty
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
    })
  })

  // ===========================================================================
  // 3. Form field modifier objects — complete shape (5 tests)
  // ===========================================================================
  describe('Form field modifier complete shape', () => {
    it('name field modifiers: required=true, rest false', () => {
      const schema = Form.$schema as NounSchema
      const f = schema.fields.get('name') as ParsedProperty
      expect(f.modifiers!.required).toBe(true)
      expect(f.modifiers!.optional).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })

    it('description field kind and modifiers', () => {
      const schema = Form.$schema as NounSchema
      const f = schema.fields.get('description') as ParsedProperty
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(false)
    })

    it('fields field kind and modifiers (string, no special modifiers)', () => {
      const schema = Form.$schema as NounSchema
      const f = schema.fields.get('fields') as ParsedProperty
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
    })

    it('submissionCount field kind and modifiers (number, no special modifiers)', () => {
      const schema = Form.$schema as NounSchema
      const f = schema.fields.get('submissionCount') as ParsedProperty
      expect(f.kind).toBe('field')
      expect(f.type).toBe('number')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })

    it('status field is enum kind (not field kind)', () => {
      const schema = Form.$schema as NounSchema
      const f = schema.fields.get('status') as ParsedProperty
      expect(f.kind).toBe('enum')
      // enum fields should not have field modifiers or type
      expect(f.enumValues).toBeDefined()
    })
  })

  // ===========================================================================
  // 4. Form status enum exact order and length (2 tests)
  // ===========================================================================
  describe('Form status enum exact order and length', () => {
    it('Form status enum has exactly 3 values', () => {
      const schema = Form.$schema as NounSchema
      const f = schema.fields.get('status') as ParsedProperty
      expect(f.enumValues).toHaveLength(3)
    })

    it('Form status enum values preserve definition order: Draft, Active, Archived', () => {
      const schema = Form.$schema as NounSchema
      const f = schema.fields.get('status') as ParsedProperty
      expect(f.enumValues).toEqual(['Draft', 'Active', 'Archived'])
    })
  })

  // ===========================================================================
  // 5. Campaign type enum value creation and querying (7 tests)
  // ===========================================================================
  describe('Campaign type enum — create and query each value', () => {
    it('can create and query a campaign with type Email', async () => {
      await Campaign.create({ name: 'T1', type: 'Email' })
      const r = await Campaign.find({ type: 'Email' })
      expect(r).toHaveLength(1)
      expect(r[0].type).toBe('Email')
    })

    it('can create and query a campaign with type Social', async () => {
      await Campaign.create({ name: 'T2', type: 'Social' })
      const r = await Campaign.find({ type: 'Social' })
      expect(r).toHaveLength(1)
      expect(r[0].type).toBe('Social')
    })

    it('can create and query a campaign with type Content', async () => {
      await Campaign.create({ name: 'T3', type: 'Content' })
      const r = await Campaign.find({ type: 'Content' })
      expect(r).toHaveLength(1)
      expect(r[0].type).toBe('Content')
    })

    it('can create and query a campaign with type Event', async () => {
      await Campaign.create({ name: 'T4', type: 'Event' })
      const r = await Campaign.find({ type: 'Event' })
      expect(r).toHaveLength(1)
      expect(r[0].type).toBe('Event')
    })

    it('can create and query a campaign with type Paid', async () => {
      await Campaign.create({ name: 'T5', type: 'Paid' })
      const r = await Campaign.find({ type: 'Paid' })
      expect(r).toHaveLength(1)
      expect(r[0].type).toBe('Paid')
    })

    it('can create and query a campaign with type Webinar', async () => {
      await Campaign.create({ name: 'T6', type: 'Webinar' })
      const r = await Campaign.find({ type: 'Webinar' })
      expect(r).toHaveLength(1)
      expect(r[0].type).toBe('Webinar')
    })

    it('can create and query a campaign with type Referral', async () => {
      await Campaign.create({ name: 'T7', type: 'Referral' })
      const r = await Campaign.find({ type: 'Referral' })
      expect(r).toHaveLength(1)
      expect(r[0].type).toBe('Referral')
    })
  })

  // ===========================================================================
  // 6. Campaign status enum value creation and querying (6 tests)
  // ===========================================================================
  describe('Campaign status enum — create and query each value', () => {
    it('can create and query status Draft', async () => {
      await Campaign.create({ name: 'S1', status: 'Draft' })
      const r = await Campaign.find({ status: 'Draft' })
      expect(r).toHaveLength(1)
    })

    it('can create and query status Scheduled', async () => {
      await Campaign.create({ name: 'S2', status: 'Scheduled' })
      const r = await Campaign.find({ status: 'Scheduled' })
      expect(r).toHaveLength(1)
    })

    it('can create and query status Active', async () => {
      await Campaign.create({ name: 'S3', status: 'Active' })
      const r = await Campaign.find({ status: 'Active' })
      expect(r).toHaveLength(1)
    })

    it('can create and query status Paused', async () => {
      await Campaign.create({ name: 'S4', status: 'Paused' })
      const r = await Campaign.find({ status: 'Paused' })
      expect(r).toHaveLength(1)
    })

    it('can create and query status Completed', async () => {
      await Campaign.create({ name: 'S5', status: 'Completed' })
      const r = await Campaign.find({ status: 'Completed' })
      expect(r).toHaveLength(1)
    })

    it('can create and query status Cancelled', async () => {
      await Campaign.create({ name: 'S6', status: 'Cancelled' })
      const r = await Campaign.find({ status: 'Cancelled' })
      expect(r).toHaveLength(1)
    })
  })

  // ===========================================================================
  // 7. Form status enum — create and query each value (3 tests)
  // ===========================================================================
  describe('Form status enum — create and query each value', () => {
    it('can create and query Form with status Draft', async () => {
      await Form.create({ name: 'FD', status: 'Draft' })
      const r = await Form.find({ status: 'Draft' })
      expect(r).toHaveLength(1)
      expect(r[0].status).toBe('Draft')
    })

    it('can create and query Form with status Active', async () => {
      await Form.create({ name: 'FA', status: 'Active' })
      const r = await Form.find({ status: 'Active' })
      expect(r).toHaveLength(1)
      expect(r[0].status).toBe('Active')
    })

    it('can create and query Form with status Archived', async () => {
      await Form.create({ name: 'FAr', status: 'Archived' })
      const r = await Form.find({ status: 'Archived' })
      expect(r).toHaveLength(1)
      expect(r[0].status).toBe('Archived')
    })
  })

  // ===========================================================================
  // 8. Relationship schema details for Segment and Form (5 tests)
  // ===========================================================================
  describe('Segment and Form relationship schema details', () => {
    it('Segment organization relationship operator is ->', () => {
      const schema = Segment.$schema as NounSchema
      const rel = schema.relationships.get('organization') as ParsedProperty
      expect(rel.operator).toBe('->')
    })

    it('Segment organization relationship targetType is Organization', () => {
      const schema = Segment.$schema as NounSchema
      const rel = schema.relationships.get('organization') as ParsedProperty
      expect(rel.targetType).toBe('Organization')
    })

    it('Form organization relationship operator is -> with targetType Organization', () => {
      const schema = Form.$schema as NounSchema
      const rel = schema.relationships.get('organization') as ParsedProperty
      expect(rel.operator).toBe('->')
      expect(rel.targetType).toBe('Organization')
    })

    it('Form has exactly 1 relationship (organization)', () => {
      const schema = Form.$schema as NounSchema
      expect(schema.relationships.size).toBe(1)
    })

    it('Segment and Form organization relationships do not have isArray', () => {
      const segSchema = Segment.$schema as NounSchema
      const formSchema = Form.$schema as NounSchema
      const segRel = segSchema.relationships.get('organization') as ParsedProperty
      const formRel = formSchema.relationships.get('organization') as ParsedProperty
      expect(segRel.isArray).toBeFalsy()
      expect(formRel.isArray).toBeFalsy()
    })
  })

  // ===========================================================================
  // 8. Campaign owner relationship backref (2 tests)
  // ===========================================================================
  describe('Campaign owner relationship backref details', () => {
    it('Campaign owner has no backref (simple -> Contact)', () => {
      const schema = Campaign.$schema as NounSchema
      const owner = schema.relationships.get('owner') as ParsedProperty
      expect(owner.backref).toBeUndefined()
    })

    it('Campaign owner isArray is falsy', () => {
      const schema = Campaign.$schema as NounSchema
      const owner = schema.relationships.get('owner') as ParsedProperty
      expect(owner.isArray).toBeFalsy()
    })
  })

  // ===========================================================================
  // 9. Relationships not in fields map for Segment and Form (2 tests)
  // ===========================================================================
  describe('relationships not in fields map', () => {
    it('Segment organization is not in fields map', () => {
      const schema = Segment.$schema as NounSchema
      expect(schema.fields.has('organization')).toBe(false)
    })

    it('Form organization is not in fields map', () => {
      const schema = Form.$schema as NounSchema
      expect(schema.fields.has('organization')).toBe(false)
    })
  })

  // ===========================================================================
  // 10. Segment verb conjugation details — CRUD only (3 tests)
  // ===========================================================================
  describe('Segment CRUD verb conjugation details', () => {
    it('Segment create verb: create/creating/created/createdBy/createdAt', () => {
      const schema = Segment.$schema as NounSchema
      const v = schema.verbs.get('create') as VerbConjugation
      expect(v.action).toBe('create')
      expect(v.activity).toBe('creating')
      expect(v.event).toBe('created')
      expect(v.reverseBy).toBe('createdBy')
      expect(v.reverseAt).toBe('createdAt')
    })

    it('Segment update verb: update/updating/updated/updatedBy/updatedAt', () => {
      const schema = Segment.$schema as NounSchema
      const v = schema.verbs.get('update') as VerbConjugation
      expect(v.action).toBe('update')
      expect(v.activity).toBe('updating')
      expect(v.event).toBe('updated')
      expect(v.reverseBy).toBe('updatedBy')
      expect(v.reverseAt).toBe('updatedAt')
    })

    it('Segment delete verb: delete/deleting/deleted/deletedBy/deletedAt', () => {
      const schema = Segment.$schema as NounSchema
      const v = schema.verbs.get('delete') as VerbConjugation
      expect(v.action).toBe('delete')
      expect(v.activity).toBe('deleting')
      expect(v.event).toBe('deleted')
      expect(v.reverseBy).toBe('deletedBy')
      expect(v.reverseAt).toBe('deletedAt')
    })
  })

  // ===========================================================================
  // 11. Form verb reverseBy/reverseAt for ALL verbs (5 tests)
  // ===========================================================================
  describe('Form verb reverseBy/reverseAt for all 5 verbs', () => {
    it('Form create verb reverseBy/reverseAt', () => {
      const schema = Form.$schema as NounSchema
      const v = schema.verbs.get('create') as VerbConjugation
      expect(v.reverseBy).toBe('createdBy')
      expect(v.reverseAt).toBe('createdAt')
    })

    it('Form update verb reverseBy/reverseAt', () => {
      const schema = Form.$schema as NounSchema
      const v = schema.verbs.get('update') as VerbConjugation
      expect(v.reverseBy).toBe('updatedBy')
      expect(v.reverseAt).toBe('updatedAt')
    })

    it('Form delete verb reverseBy/reverseAt', () => {
      const schema = Form.$schema as NounSchema
      const v = schema.verbs.get('delete') as VerbConjugation
      expect(v.reverseBy).toBe('deletedBy')
      expect(v.reverseAt).toBe('deletedAt')
    })

    it('Form publish verb reverseBy/reverseAt: publishedBy/publishedAt', () => {
      const schema = Form.$schema as NounSchema
      const v = schema.verbs.get('publish') as VerbConjugation
      expect(v.reverseBy).toBe('publishedBy')
      expect(v.reverseAt).toBe('publishedAt')
    })

    it('Form archive verb reverseBy/reverseAt: archivedBy/archivedAt', () => {
      const schema = Form.$schema as NounSchema
      const v = schema.verbs.get('archive') as VerbConjugation
      expect(v.reverseBy).toBe('archivedBy')
      expect(v.reverseAt).toBe('archivedAt')
    })
  })

  // ===========================================================================
  // 12. Schema raw key count for Segment and Form (2 tests)
  // ===========================================================================
  describe('schema raw key count for Segment and Form', () => {
    it('Segment raw definition has expected key count (6: 5 fields + 1 relationship)', () => {
      const schema = Segment.$schema as NounSchema
      const rawKeys = Object.keys(schema.raw)
      // name, description, criteria, organization, memberCount, isDynamic
      expect(rawKeys).toHaveLength(6)
    })

    it('Form raw definition has expected key count (8: 5 fields + 1 relationship + 2 verbs)', () => {
      const schema = Form.$schema as NounSchema
      const rawKeys = Object.keys(schema.raw)
      // name, description, fields, organization, status, submissionCount, publish, archive
      expect(rawKeys).toHaveLength(8)
    })
  })

  // ===========================================================================
  // 13. Disabled verbs set for all entities (3 tests)
  // ===========================================================================
  describe('disabled verbs set', () => {
    it('Campaign has no disabled verbs', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.disabledVerbs.size).toBe(0)
    })

    it('Segment has no disabled verbs', () => {
      const schema = Segment.$schema as NounSchema
      expect(schema.disabledVerbs.size).toBe(0)
    })

    it('Form has no disabled verbs', () => {
      const schema = Form.$schema as NounSchema
      expect(schema.disabledVerbs.size).toBe(0)
    })
  })

  // ===========================================================================
  // 14. BEFORE hook transformation chain — multiple transforms (3 tests)
  // ===========================================================================
  describe('BEFORE hook transformation chain', () => {
    it('two creating hooks chain transforms: first sets status, second sets type', async () => {
      Campaign.creating((data: Record<string, unknown>) => {
        return { ...data, status: 'Draft' }
      })
      Campaign.creating((data: Record<string, unknown>) => {
        return { ...data, type: 'Email' }
      })
      const c = await Campaign.create({ name: 'Chain Test' })
      expect(c.status).toBe('Draft')
      expect(c.type).toBe('Email')
    })

    it('BEFORE hook on update transforms data before persistence', async () => {
      Campaign.updating((data: Record<string, unknown>) => {
        return { ...data, currency: 'USD' }
      })
      const c = await Campaign.create({ name: 'Update Transform' })
      const u = await Campaign.update(c.$id, { budget: 5000 })
      expect(u.budget).toBe(5000)
      expect(u.currency).toBe('USD')
    })

    it('BEFORE hook on Form creating injects default fields', async () => {
      Form.creating((data: Record<string, unknown>) => {
        return { ...data, submissionCount: 0, status: 'Draft' }
      })
      const f = await Form.create({ name: 'Default Form' })
      expect(f.submissionCount).toBe(0)
      expect(f.status).toBe('Draft')
    })
  })

  // ===========================================================================
  // 15. Segment CRUD hooks (no custom verbs) (3 tests)
  // ===========================================================================
  describe('Segment CRUD hooks', () => {
    it('Segment.created() fires after create', async () => {
      const names: string[] = []
      Segment.created((instance: NounInstance) => {
        names.push(instance.name as string)
      })
      await Segment.create({ name: 'Hook Segment' })
      expect(names).toContain('Hook Segment')
    })

    it('Segment.updating() fires before update', async () => {
      const calls: string[] = []
      Segment.updating(() => {
        calls.push('updating')
      })
      const s = await Segment.create({ name: 'Before Update' })
      await Segment.update(s.$id, { memberCount: 10 })
      expect(calls).toContain('updating')
    })

    it('Segment.deleted() fires after delete', async () => {
      const deletedIds: string[] = []
      Segment.deleted((instance: NounInstance) => {
        deletedIds.push(instance.$id)
      })
      const s = await Segment.create({ name: 'Del Segment' })
      await Segment.delete(s.$id)
      expect(deletedIds).toHaveLength(1)
      expect(deletedIds[0]).toBe(s.$id)
    })
  })

  // ===========================================================================
  // 16. Version tracking through complex multi-update + verb workflows (3 tests)
  // ===========================================================================
  describe('version tracking through complex workflows', () => {
    it('Campaign: create(v1) -> update(v2) -> launch(v3) -> update(v4) -> pause(v5) -> complete(v6)', async () => {
      const c = await Campaign.create({ name: 'Version Track', status: 'Draft' })
      expect(c.$version).toBe(1)
      const u1 = await Campaign.update(c.$id, { budget: 1000 })
      expect(u1.$version).toBe(2)
      const launched = await Campaign.launch(c.$id)
      expect(launched.$version).toBe(3)
      const u2 = await Campaign.update(c.$id, { actualCost: 500 })
      expect(u2.$version).toBe(4)
      const paused = await Campaign.pause(c.$id)
      expect(paused.$version).toBe(5)
      const completed = await Campaign.complete(c.$id)
      expect(completed.$version).toBe(6)
    })

    it('Form: create(v1) -> update(v2) -> publish(v3) -> update(v4) -> archive(v5)', async () => {
      const f = await Form.create({ name: 'Form Version', status: 'Draft' })
      expect(f.$version).toBe(1)
      const u1 = await Form.update(f.$id, { description: 'Added desc' })
      expect(u1.$version).toBe(2)
      const pub = await Form.publish(f.$id)
      expect(pub.$version).toBe(3)
      const u2 = await Form.update(f.$id, { submissionCount: 10 })
      expect(u2.$version).toBe(4)
      const arch = await Form.archive(f.$id)
      expect(arch.$version).toBe(5)
    })

    it('Segment: 15 sequential updates results in version 16', async () => {
      const s = await Segment.create({ name: 'Version Seg', memberCount: 0 })
      for (let i = 1; i <= 15; i++) {
        await Segment.update(s.$id, { memberCount: i })
      }
      const final = await Segment.get(s.$id)
      expect(final!.$version).toBe(16)
      expect(final!.memberCount).toBe(15)
    })
  })

  // ===========================================================================
  // 17. Concurrent mixed-type operations (3 tests)
  // ===========================================================================
  describe('concurrent mixed-type operations', () => {
    it('creates Campaign, Segment, Form concurrently with Promise.all', async () => {
      const [c, s, f] = await Promise.all([
        Campaign.create({ name: 'Concurrent C', type: 'Email' }),
        Segment.create({ name: 'Concurrent S', memberCount: 50 }),
        Form.create({ name: 'Concurrent F', status: 'Draft' }),
      ])
      expect(c.$type).toBe('Campaign')
      expect(s.$type).toBe('Segment')
      expect(f.$type).toBe('Form')
    })

    it('concurrent verb transitions and CRUD on different types', async () => {
      const c = await Campaign.create({ name: 'Verb C', status: 'Draft' })
      const f = await Form.create({ name: 'Verb F', status: 'Draft' })
      const s = await Segment.create({ name: 'Update S', memberCount: 0 })

      const [launched, published, updated] = await Promise.all([
        Campaign.launch(c.$id),
        Form.publish(f.$id),
        Segment.update(s.$id, { memberCount: 100 }),
      ])
      expect(launched.status).toBe('Launched')
      expect(published.status).toBe('Published')
      expect(updated.memberCount).toBe(100)
    })

    it('concurrent deletes across types all succeed', async () => {
      const c = await Campaign.create({ name: 'Del C' })
      const s = await Segment.create({ name: 'Del S' })
      const f = await Form.create({ name: 'Del F' })

      const [r1, r2, r3] = await Promise.all([Campaign.delete(c.$id), Segment.delete(s.$id), Form.delete(f.$id)])
      expect(r1).toBe(true)
      expect(r2).toBe(true)
      expect(r3).toBe(true)

      const [gc, gs, gf] = await Promise.all([Campaign.get(c.$id), Segment.get(s.$id), Form.get(f.$id)])
      expect(gc).toBeNull()
      expect(gs).toBeNull()
      expect(gf).toBeNull()
    })
  })

  // ===========================================================================
  // 18. Error handling: update/verb on non-existent entity (2 tests)
  // ===========================================================================
  describe('error handling for non-existent entities', () => {
    it('update on non-existent campaign throws', async () => {
      await expect(Campaign.update('campaign_ZZZZZZZZ', { name: 'Nope' })).rejects.toThrow()
    })

    it('verb on non-existent campaign throws', async () => {
      await expect(Campaign.launch('campaign_ZZZZZZZZ')).rejects.toThrow()
    })
  })

  // ===========================================================================
  // 19. Enum kind vs field kind verification across all entities (3 tests)
  // ===========================================================================
  describe('enum kind vs field kind classification', () => {
    it('Campaign: status and type are enum kind, all other fields are field kind', () => {
      const schema = Campaign.$schema as NounSchema
      for (const [name, prop] of schema.fields) {
        if (name === 'status' || name === 'type') {
          expect(prop.kind, `${name} should be enum`).toBe('enum')
        } else {
          expect(prop.kind, `${name} should be field`).toBe('field')
        }
      }
    })

    it('Segment: no enum fields — all fields are field kind', () => {
      const schema = Segment.$schema as NounSchema
      for (const [name, prop] of schema.fields) {
        expect(prop.kind, `${name} should be field`).toBe('field')
      }
    })

    it('Form: status is enum kind, all other fields are field kind', () => {
      const schema = Form.$schema as NounSchema
      for (const [name, prop] of schema.fields) {
        if (name === 'status') {
          expect(prop.kind, `${name} should be enum`).toBe('enum')
        } else {
          expect(prop.kind, `${name} should be field`).toBe('field')
        }
      }
    })
  })

  // ===========================================================================
  // 20. Campaign type enum — exact order preservation (1 test)
  // ===========================================================================
  describe('Campaign type enum exact order', () => {
    it('type enum values preserve definition order: Email, Social, Content, Event, Paid, Webinar, Referral', () => {
      const schema = Campaign.$schema as NounSchema
      const f = schema.fields.get('type') as ParsedProperty
      expect(f.enumValues).toEqual(['Email', 'Social', 'Content', 'Event', 'Paid', 'Webinar', 'Referral'])
    })
  })

  // ===========================================================================
  // 22. Schema raw definition — verb declarations are NOT field definitions (2 tests)
  // ===========================================================================
  describe('verb declarations in raw are not parsed as fields', () => {
    it('Campaign raw has launch/pause/complete but they are not in fields map', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.fields.has('launch')).toBe(false)
      expect(schema.fields.has('pause')).toBe(false)
      expect(schema.fields.has('complete')).toBe(false)
    })

    it('Form raw has publish/archive but they are not in fields map', () => {
      const schema = Form.$schema as NounSchema
      expect(schema.fields.has('publish')).toBe(false)
      expect(schema.fields.has('archive')).toBe(false)
    })
  })

  // ===========================================================================
  // 23. Campaign leads relationship schema details (3 tests)
  // ===========================================================================
  describe('Campaign leads relationship detailed schema', () => {
    it('leads relationship name is leads', () => {
      const schema = Campaign.$schema as NounSchema
      const leads = schema.relationships.get('leads') as ParsedProperty
      expect(leads.name).toBe('leads')
    })

    it('leads relationship has all expected ParsedProperty fields set', () => {
      const schema = Campaign.$schema as NounSchema
      const leads = schema.relationships.get('leads') as ParsedProperty
      expect(leads.kind).toBe('relationship')
      expect(leads.operator).toBe('<-')
      expect(leads.targetType).toBe('Lead')
      expect(leads.backref).toBe('campaign')
      expect(leads.isArray).toBe(true)
    })

    it('owner relationship name is owner', () => {
      const schema = Campaign.$schema as NounSchema
      const owner = schema.relationships.get('owner') as ParsedProperty
      expect(owner.name).toBe('owner')
    })
  })
})
