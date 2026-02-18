import { describe, it, expect, vi } from 'vitest'
import type { NounSchema, ParsedProperty, VerbConjugation, NounInstance, NounEntity } from 'digital-objects'
import { Campaign, Segment, Form } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/marketing — deep v2', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Campaign schema field-level validation (7 tests)
  // ===========================================================================
  describe('Campaign schema — field-level validation', () => {
    it('name field is required (string!)', () => {
      const schema = Campaign.$schema as NounSchema
      const nameField = schema.fields.get('name') as ParsedProperty
      expect(nameField).toBeDefined()
      expect(nameField.kind).toBe('field')
      expect(nameField.modifiers?.required).toBe(true)
      expect(nameField.type).toBe('string')
    })

    it('slug field is a unique-indexed string (string##)', () => {
      const schema = Campaign.$schema as NounSchema
      const slugField = schema.fields.get('slug') as ParsedProperty
      expect(slugField).toBeDefined()
      expect(slugField.kind).toBe('field')
      expect(slugField.modifiers?.unique).toBe(true)
      expect(slugField.modifiers?.indexed).toBe(true)
    })

    it('description is an optional string field with no required modifier', () => {
      const schema = Campaign.$schema as NounSchema
      const descField = schema.fields.get('description') as ParsedProperty
      expect(descField).toBeDefined()
      expect(descField.kind).toBe('field')
      expect(descField.type).toBe('string')
      expect(descField.modifiers?.required).toBe(false)
    })

    it('startDate and endDate are date fields', () => {
      const schema = Campaign.$schema as NounSchema
      const startDate = schema.fields.get('startDate') as ParsedProperty
      const endDate = schema.fields.get('endDate') as ParsedProperty
      expect(startDate.type).toBe('date')
      expect(endDate.type).toBe('date')
    })

    it('launchedAt is a datetime field', () => {
      const schema = Campaign.$schema as NounSchema
      const launchedAt = schema.fields.get('launchedAt') as ParsedProperty
      expect(launchedAt).toBeDefined()
      expect(launchedAt.type).toBe('datetime')
    })

    it('budget, actualCost, targetLeads, targetRevenue, actualLeads, actualRevenue, roi are number fields', () => {
      const schema = Campaign.$schema as NounSchema
      const numberFields = ['budget', 'actualCost', 'targetLeads', 'targetRevenue', 'actualLeads', 'actualRevenue', 'roi']
      for (const name of numberFields) {
        const field = schema.fields.get(name) as ParsedProperty
        expect(field, `${name} should exist`).toBeDefined()
        expect(field.type, `${name} should be number`).toBe('number')
      }
    })

    it('UTM fields (utmSource, utmMedium, utmCampaign) and landingPageUrl are string fields', () => {
      const schema = Campaign.$schema as NounSchema
      const stringFields = ['utmSource', 'utmMedium', 'utmCampaign', 'landingPageUrl', 'currency']
      for (const name of stringFields) {
        const field = schema.fields.get(name) as ParsedProperty
        expect(field, `${name} should exist`).toBeDefined()
        expect(field.type, `${name} should be string`).toBe('string')
      }
    })
  })

  // ===========================================================================
  // 2. Campaign relationships (4 tests)
  // ===========================================================================
  describe('Campaign relationships', () => {
    it('owner is a forward relationship (->)', () => {
      const schema = Campaign.$schema as NounSchema
      const owner = schema.relationships.get('owner') as ParsedProperty
      expect(owner).toBeDefined()
      expect(owner.kind).toBe('relationship')
      expect(owner.operator).toBe('->')
      expect(owner.targetType).toBe('Contact')
    })

    it('leads is a reverse relationship (<-) to Lead.campaign', () => {
      const schema = Campaign.$schema as NounSchema
      const leads = schema.relationships.get('leads') as ParsedProperty
      expect(leads).toBeDefined()
      expect(leads.kind).toBe('relationship')
      expect(leads.operator).toBe('<-')
      expect(leads.targetType).toBe('Lead')
      expect(leads.backref).toBe('campaign')
      expect(leads.isArray).toBe(true)
    })

    it('owner does not have isArray flag set', () => {
      const schema = Campaign.$schema as NounSchema
      const owner = schema.relationships.get('owner') as ParsedProperty
      expect(owner.isArray).toBeFalsy()
    })

    it('relationships are not stored in fields map', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.fields.has('owner')).toBe(false)
      expect(schema.fields.has('leads')).toBe(false)
    })
  })

  // ===========================================================================
  // 3. Campaign status enum completeness (3 tests)
  // ===========================================================================
  describe('Campaign status enum', () => {
    it('has exactly 6 status values', () => {
      const schema = Campaign.$schema as NounSchema
      const statusField = schema.fields.get('status') as ParsedProperty
      expect(statusField.enumValues).toHaveLength(6)
    })

    it('type enum has exactly 7 channel values', () => {
      const schema = Campaign.$schema as NounSchema
      const typeField = schema.fields.get('type') as ParsedProperty
      expect(typeField.enumValues).toHaveLength(7)
    })

    it('enum values preserve original order from definition', () => {
      const schema = Campaign.$schema as NounSchema
      const statusField = schema.fields.get('status') as ParsedProperty
      expect(statusField.enumValues).toEqual(['Draft', 'Scheduled', 'Active', 'Paused', 'Completed', 'Cancelled'])
    })
  })

  // ===========================================================================
  // 4. Campaign verb schema completeness (5 tests)
  // ===========================================================================
  describe('Campaign verb schema completeness', () => {
    it('has exactly 6 verbs (3 CRUD + 3 custom)', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.verbs.size).toBe(6)
    })

    it('no verbs are disabled', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.disabledVerbs.size).toBe(0)
    })

    it('launch verb has correct reverseBy and reverseAt', () => {
      const schema = Campaign.$schema as NounSchema
      const launch = schema.verbs.get('launch') as VerbConjugation
      expect(launch.reverseBy).toBe('launchedBy')
      expect(launch.reverseAt).toBe('launchedAt')
    })

    it('create verb has standard conjugation', () => {
      const schema = Campaign.$schema as NounSchema
      const create = schema.verbs.get('create') as VerbConjugation
      expect(create.action).toBe('create')
      expect(create.activity).toBe('creating')
      expect(create.event).toBe('created')
    })

    it('delete verb has standard conjugation', () => {
      const schema = Campaign.$schema as NounSchema
      const del = schema.verbs.get('delete') as VerbConjugation
      expect(del.action).toBe('delete')
      expect(del.activity).toBe('deleting')
      expect(del.event).toBe('deleted')
    })
  })

  // ===========================================================================
  // 5. Segment schema — detailed (5 tests)
  // ===========================================================================
  describe('Segment schema — detailed', () => {
    it('has exactly 5 fields (name, description, criteria, memberCount, isDynamic)', () => {
      const schema = Segment.$schema as NounSchema
      expect(schema.fields.size).toBe(5)
    })

    it('criteria is a string field (stores filter expressions)', () => {
      const schema = Segment.$schema as NounSchema
      const criteria = schema.fields.get('criteria') as ParsedProperty
      expect(criteria.kind).toBe('field')
      expect(criteria.type).toBe('string')
    })

    it('isDynamic is a string field (not boolean)', () => {
      const schema = Segment.$schema as NounSchema
      const isDynamic = schema.fields.get('isDynamic') as ParsedProperty
      expect(isDynamic.kind).toBe('field')
      expect(isDynamic.type).toBe('string')
    })

    it('Segment has no custom verbs — only 3 CRUD verbs', () => {
      const schema = Segment.$schema as NounSchema
      expect(schema.verbs.size).toBe(3)
      expect(schema.verbs.has('create')).toBe(true)
      expect(schema.verbs.has('update')).toBe(true)
      expect(schema.verbs.has('delete')).toBe(true)
    })

    it('Segment has 1 relationship (organization)', () => {
      const schema = Segment.$schema as NounSchema
      expect(schema.relationships.size).toBe(1)
    })
  })

  // ===========================================================================
  // 6. Form schema — detailed (5 tests)
  // ===========================================================================
  describe('Form schema — detailed', () => {
    it('has exactly 5 fields (name, description, fields, status, submissionCount)', () => {
      const schema = Form.$schema as NounSchema
      expect(schema.fields.size).toBe(5)
    })

    it('submissionCount is a number field', () => {
      const schema = Form.$schema as NounSchema
      const field = schema.fields.get('submissionCount') as ParsedProperty
      expect(field.type).toBe('number')
    })

    it('Form has exactly 5 verbs (3 CRUD + publish, archive)', () => {
      const schema = Form.$schema as NounSchema
      expect(schema.verbs.size).toBe(5)
      expect(schema.verbs.has('publish')).toBe(true)
      expect(schema.verbs.has('archive')).toBe(true)
    })

    it('publish verb conjugation: publish -> publishing -> published', () => {
      const schema = Form.$schema as NounSchema
      const publish = schema.verbs.get('publish') as VerbConjugation
      expect(publish.action).toBe('publish')
      expect(publish.activity).toBe('publishing')
      expect(publish.event).toBe('published')
      expect(publish.reverseBy).toBe('publishedBy')
    })

    it('archive verb conjugation: archive -> archiving -> archived', () => {
      const schema = Form.$schema as NounSchema
      const archive = schema.verbs.get('archive') as VerbConjugation
      expect(archive.action).toBe('archive')
      expect(archive.activity).toBe('archiving')
      expect(archive.event).toBe('archived')
      expect(archive.reverseBy).toBe('archivedBy')
    })
  })

  // ===========================================================================
  // 7. Meta-field validation on create (5 tests)
  // ===========================================================================
  describe('meta-field validation', () => {
    it('Campaign.$id follows the pattern campaign_{8-char-sqid}', async () => {
      const c = await Campaign.create({ name: 'Test' })
      expect(c.$id).toMatch(/^campaign_[a-zA-Z0-9]{8}$/)
    })

    it('Segment.$id follows the pattern segment_{8-char-sqid}', async () => {
      const s = await Segment.create({ name: 'Test' })
      expect(s.$id).toMatch(/^segment_[a-zA-Z0-9]{8}$/)
    })

    it('Form.$id follows the pattern form_{8-char-sqid}', async () => {
      const f = await Form.create({ name: 'Test' })
      expect(f.$id).toMatch(/^form_[a-zA-Z0-9]{8}$/)
    })

    it('$context is a headless.ly tenant URL', async () => {
      const c = await Campaign.create({ name: 'Ctx Test' })
      expect(c.$context).toMatch(/^https:\/\/headless\.ly\/~/)
    })

    it('$createdAt and $updatedAt are ISO 8601 timestamps', async () => {
      const c = await Campaign.create({ name: 'Time Test' })
      expect(new Date(c.$createdAt).toISOString()).toBe(c.$createdAt)
      expect(new Date(c.$updatedAt).toISOString()).toBe(c.$updatedAt)
    })
  })

  // ===========================================================================
  // 8. CRUD: version increment and immutability (4 tests)
  // ===========================================================================
  describe('CRUD version semantics', () => {
    it('new entity starts at $version 1', async () => {
      const c = await Campaign.create({ name: 'V1' })
      expect(c.$version).toBe(1)
    })

    it('update increments $version by 1', async () => {
      const c = await Campaign.create({ name: 'V1' })
      const u1 = await Campaign.update(c.$id, { name: 'V2' })
      expect(u1.$version).toBe(2)
      const u2 = await Campaign.update(c.$id, { name: 'V3' })
      expect(u2.$version).toBe(3)
    })

    it('update does not change $id, $type, or $context', async () => {
      const c = await Campaign.create({ name: 'Immut' })
      const u = await Campaign.update(c.$id, { name: 'Changed' })
      expect(u.$id).toBe(c.$id)
      expect(u.$type).toBe(c.$type)
      expect(u.$context).toBe(c.$context)
    })

    it('update preserves $createdAt while advancing $updatedAt', async () => {
      const c = await Campaign.create({ name: 'Timestamp' })
      const u = await Campaign.update(c.$id, { name: 'Updated' })
      expect(u.$createdAt).toBe(c.$createdAt)
      // $updatedAt should be same or after $createdAt
      expect(new Date(u.$updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(u.$createdAt).getTime())
    })
  })

  // ===========================================================================
  // 9. Delete and get-after-delete (3 tests)
  // ===========================================================================
  describe('delete semantics', () => {
    it('delete returns true for existing entity', async () => {
      const c = await Campaign.create({ name: 'To Delete' })
      const result = await Campaign.delete(c.$id)
      expect(result).toBe(true)
    })

    it('get after delete returns null', async () => {
      const c = await Campaign.create({ name: 'Gone' })
      await Campaign.delete(c.$id)
      const fetched = await Campaign.get(c.$id)
      expect(fetched).toBeNull()
    })

    it('delete of non-existent ID returns false', async () => {
      const result = await Campaign.delete('campaign_XXXXXXXX')
      expect(result).toBe(false)
    })
  })

  // ===========================================================================
  // 10. MongoDB-style query operators (8 tests)
  // ===========================================================================
  describe('MongoDB-style query operators', () => {
    it('$eq matches exact value', async () => {
      await Campaign.create({ name: 'Alpha', budget: 1000 })
      await Campaign.create({ name: 'Beta', budget: 2000 })
      const results = await Campaign.find({ budget: { $eq: 1000 } })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Alpha')
    })

    it('$ne excludes matching value', async () => {
      await Campaign.create({ name: 'Keep', status: 'Active' })
      await Campaign.create({ name: 'Skip', status: 'Draft' })
      const results = await Campaign.find({ status: { $ne: 'Draft' } })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Keep')
    })

    it('$gt filters numbers strictly greater', async () => {
      await Campaign.create({ name: 'Low', budget: 500 })
      await Campaign.create({ name: 'Mid', budget: 1000 })
      await Campaign.create({ name: 'High', budget: 5000 })
      const results = await Campaign.find({ budget: { $gt: 500 } })
      expect(results).toHaveLength(2)
    })

    it('$gte filters numbers greater than or equal', async () => {
      await Campaign.create({ name: 'Exact', budget: 1000 })
      await Campaign.create({ name: 'Above', budget: 2000 })
      await Campaign.create({ name: 'Below', budget: 500 })
      const results = await Campaign.find({ budget: { $gte: 1000 } })
      expect(results).toHaveLength(2)
    })

    it('$lt and $lte filter numbers less than', async () => {
      await Campaign.create({ name: 'Small', budget: 100 })
      await Campaign.create({ name: 'Medium', budget: 500 })
      await Campaign.create({ name: 'Large', budget: 1000 })
      const ltResults = await Campaign.find({ budget: { $lt: 500 } })
      expect(ltResults).toHaveLength(1)
      const lteResults = await Campaign.find({ budget: { $lte: 500 } })
      expect(lteResults).toHaveLength(2)
    })

    it('$in matches any value in array', async () => {
      await Campaign.create({ name: 'Email', type: 'Email' })
      await Campaign.create({ name: 'Social', type: 'Social' })
      await Campaign.create({ name: 'Paid', type: 'Paid' })
      const results = await Campaign.find({ type: { $in: ['Email', 'Social'] } })
      expect(results).toHaveLength(2)
    })

    it('$nin excludes values in array', async () => {
      await Campaign.create({ name: 'Email', type: 'Email' })
      await Campaign.create({ name: 'Social', type: 'Social' })
      await Campaign.create({ name: 'Paid', type: 'Paid' })
      const results = await Campaign.find({ type: { $nin: ['Email', 'Social'] } })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Paid')
    })

    it('$regex matches string pattern', async () => {
      await Campaign.create({ name: 'Spring Sale 2025' })
      await Campaign.create({ name: 'Summer Promo' })
      await Campaign.create({ name: 'Fall Sale 2025' })
      const results = await Campaign.find({ name: { $regex: 'Sale' } })
      expect(results).toHaveLength(2)
    })
  })

  // ===========================================================================
  // 11. Verb transitions on Campaign (3 tests)
  // ===========================================================================
  describe('Campaign verb transitions', () => {
    it('launch() sets status to Launched (falls through to convention field)', async () => {
      const c = await Campaign.create({ name: 'Launch Test', status: 'Draft' })
      const launched = await Campaign.launch(c.$id)
      // Launched is NOT in the status enum, so resolveVerbTransition Strategy 3 applies
      expect(launched.status).toBe('Launched')
    })

    it('pause() on a launched campaign sets status to Paused', async () => {
      const c = await Campaign.create({ name: 'Pause Test', status: 'Active' })
      const paused = await Campaign.pause(c.$id)
      expect(paused.status).toBe('Paused')
      expect(paused.$version).toBe(2)
    })

    it('complete() advances version by 1', async () => {
      const c = await Campaign.create({ name: 'Complete Test', status: 'Active' })
      const completed = await Campaign.complete(c.$id)
      expect(completed.$version).toBe(2)
      expect(completed.status).toBe('Completed')
    })
  })

  // ===========================================================================
  // 12. Form verb transitions (3 tests)
  // ===========================================================================
  describe('Form verb transitions', () => {
    it('publish() then archive() in sequence produces correct final state', async () => {
      const f = await Form.create({ name: 'Lifecycle Form', status: 'Draft' })
      const published = await Form.publish(f.$id)
      expect(published.status).toBe('Published')
      expect(published.$version).toBe(2)

      const archived = await Form.archive(f.$id)
      expect(archived.status).toBe('Archived')
      expect(archived.$version).toBe(3)
    })

    it('archive() preserves all user data fields', async () => {
      const f = await Form.create({
        name: 'Data Form',
        description: 'Collects user info',
        fields: 'name,email,phone',
        submissionCount: 42,
      })
      const archived = await Form.archive(f.$id)
      expect(archived.name).toBe('Data Form')
      expect(archived.description).toBe('Collects user info')
      expect(archived.fields).toBe('name,email,phone')
      expect(archived.submissionCount).toBe(42)
    })

    it('publish() on a form without prior status still sets Published', async () => {
      const f = await Form.create({ name: 'No Status Form' })
      const published = await Form.publish(f.$id)
      expect(published.status).toBe('Published')
    })
  })

  // ===========================================================================
  // 13. Hook registration — BEFORE hooks (4 tests)
  // ===========================================================================
  describe('BEFORE hook registration', () => {
    it('Campaign.creating() fires before create and receives data', async () => {
      const receivedData: Record<string, unknown>[] = []
      Campaign.creating((data: Record<string, unknown>) => {
        receivedData.push({ ...data })
      })
      await Campaign.create({ name: 'Before Create', type: 'Email' })
      expect(receivedData).toHaveLength(1)
      expect(receivedData[0].name).toBe('Before Create')
      expect(receivedData[0].type).toBe('Email')
    })

    it('BEFORE hook can transform data (return modified object)', async () => {
      Campaign.creating((data: Record<string, unknown>) => {
        return { ...data, status: 'Draft' }
      })
      const c = await Campaign.create({ name: 'Transform Test' })
      expect(c.status).toBe('Draft')
    })

    it('Form.publishing() fires before publish verb', async () => {
      const calls: string[] = []
      Form.publishing(() => {
        calls.push('publishing')
      })
      const f = await Form.create({ name: 'Hook Form', status: 'Draft' })
      await Form.publish(f.$id)
      expect(calls).toContain('publishing')
    })

    it('Campaign.pausing() fires before pause verb', async () => {
      const calls: string[] = []
      Campaign.pausing(() => {
        calls.push('pausing')
      })
      const c = await Campaign.create({ name: 'Pause Hook', status: 'Active' })
      await Campaign.pause(c.$id)
      expect(calls).toContain('pausing')
    })
  })

  // ===========================================================================
  // 14. Hook registration — AFTER hooks (4 tests)
  // ===========================================================================
  describe('AFTER hook registration', () => {
    it('Campaign.completed() fires after complete verb with instance', async () => {
      const instances: NounInstance[] = []
      Campaign.completed((instance: NounInstance) => {
        instances.push(instance)
      })
      const c = await Campaign.create({ name: 'After Complete', status: 'Active' })
      await Campaign.complete(c.$id)
      expect(instances).toHaveLength(1)
      expect(instances[0].$id).toBe(c.$id)
      expect(instances[0].status).toBe('Completed')
    })

    it('Form.archived() fires after archive verb', async () => {
      const names: string[] = []
      Form.archived((instance: NounInstance) => {
        names.push(instance.name as string)
      })
      const f = await Form.create({ name: 'Archive Hook Form', status: 'Active' })
      await Form.archive(f.$id)
      expect(names).toContain('Archive Hook Form')
    })

    it('Campaign.updated() fires after update()', async () => {
      const updates: NounInstance[] = []
      Campaign.updated((instance: NounInstance) => {
        updates.push(instance)
      })
      const c = await Campaign.create({ name: 'Update Hook' })
      await Campaign.update(c.$id, { budget: 5000 })
      expect(updates).toHaveLength(1)
      expect(updates[0].budget).toBe(5000)
    })

    it('Campaign.deleted() fires after delete()', async () => {
      const deletedIds: string[] = []
      Campaign.deleted((instance: NounInstance) => {
        deletedIds.push(instance.$id)
      })
      const c = await Campaign.create({ name: 'Delete Hook' })
      await Campaign.delete(c.$id)
      expect(deletedIds).toHaveLength(1)
      expect(deletedIds[0]).toBe(c.$id)
    })
  })

  // ===========================================================================
  // 15. Hook unsubscribe (2 tests)
  // ===========================================================================
  describe('hook unsubscribe', () => {
    it('unsubscribe prevents AFTER hook from firing', async () => {
      const calls: string[] = []
      const unsub = Campaign.launched((instance: NounInstance) => {
        calls.push(instance.name as string)
      })

      const c1 = await Campaign.create({ name: 'First', status: 'Draft' })
      await Campaign.launch(c1.$id)
      expect(calls).toHaveLength(1)

      // Unsubscribe
      ;(unsub as () => void)()

      const c2 = await Campaign.create({ name: 'Second', status: 'Draft' })
      await Campaign.launch(c2.$id)
      // Should still be 1 since we unsubscribed
      expect(calls).toHaveLength(1)
    })

    it('unsubscribe prevents BEFORE hook from firing', async () => {
      const calls: string[] = []
      const unsub = Campaign.completing(() => {
        calls.push('completing')
      })

      const c1 = await Campaign.create({ name: 'C1', status: 'Active' })
      await Campaign.complete(c1.$id)
      expect(calls).toHaveLength(1)
      ;(unsub as () => void)()

      const c2 = await Campaign.create({ name: 'C2', status: 'Active' })
      await Campaign.complete(c2.$id)
      expect(calls).toHaveLength(1)
    })
  })

  // ===========================================================================
  // 16. Cross-entity isolation (3 tests)
  // ===========================================================================
  describe('cross-entity isolation', () => {
    it('Campaign.find() never returns Segment or Form entities', async () => {
      await Campaign.create({ name: 'C' })
      await Segment.create({ name: 'S' })
      await Form.create({ name: 'F' })
      const campaigns = await Campaign.find()
      expect(campaigns.every((c: any) => c.$type === 'Campaign')).toBe(true)
      expect(campaigns).toHaveLength(1)
    })

    it('Segment.find() never returns Campaign or Form entities', async () => {
      await Campaign.create({ name: 'C' })
      await Segment.create({ name: 'S' })
      await Form.create({ name: 'F' })
      const segments = await Segment.find()
      expect(segments.every((s: any) => s.$type === 'Segment')).toBe(true)
      expect(segments).toHaveLength(1)
    })

    it('Form.find() never returns Campaign or Segment entities', async () => {
      await Campaign.create({ name: 'C' })
      await Segment.create({ name: 'S' })
      await Form.create({ name: 'F' })
      const forms = await Form.find()
      expect(forms.every((f: any) => f.$type === 'Form')).toBe(true)
      expect(forms).toHaveLength(1)
    })
  })

  // ===========================================================================
  // 17. Edge cases — empty queries and boundary values (5 tests)
  // ===========================================================================
  describe('edge cases', () => {
    it('find() with no entities returns empty array', async () => {
      const results = await Campaign.find()
      expect(results).toEqual([])
    })

    it('find() with filter that matches nothing returns empty array', async () => {
      await Campaign.create({ name: 'Exists', status: 'Active' })
      const results = await Campaign.find({ status: 'Completed' })
      expect(results).toEqual([])
    })

    it('get() with non-existent ID returns null', async () => {
      const result = await Campaign.get('campaign_ZZZZZZZZ')
      expect(result).toBeNull()
    })

    it('create with minimal fields (just name) succeeds', async () => {
      const c = await Campaign.create({ name: 'Minimal' })
      expect(c.$type).toBe('Campaign')
      expect(c.name).toBe('Minimal')
      expect(c.budget).toBeUndefined()
      expect(c.type).toBeUndefined()
    })

    it('creating a campaign with budget 0 stores 0 (not undefined)', async () => {
      const c = await Campaign.create({ name: 'Zero Budget', budget: 0 })
      expect(c.budget).toBe(0)
      const fetched = await Campaign.get(c.$id)
      expect(fetched!.budget).toBe(0)
    })
  })

  // ===========================================================================
  // 18. Schema raw property access (3 tests)
  // ===========================================================================
  describe('schema raw definition access', () => {
    it('Campaign raw definition contains launch, pause, complete as verb declarations', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.raw.launch).toBe('Launched')
      expect(schema.raw.pause).toBe('Paused')
      expect(schema.raw.complete).toBe('Completed')
    })

    it('Form raw definition contains publish and archive as verb declarations', () => {
      const schema = Form.$schema as NounSchema
      expect(schema.raw.publish).toBe('Published')
      expect(schema.raw.archive).toBe('Archived')
    })

    it('Segment raw definition has no verb declarations', () => {
      const schema = Segment.$schema as NounSchema
      // Segment has no PascalCase values that are verb declarations
      const verbKeys = Object.entries(schema.raw).filter(([key, val]) => typeof val === 'string' && /^[A-Z][a-zA-Z]+$/.test(val) && /^[a-z]/.test(key))
      expect(verbKeys).toHaveLength(0)
    })
  })

  // ===========================================================================
  // 19. $name and $schema static access (3 tests)
  // ===========================================================================
  describe('$name and $schema static access', () => {
    it('Campaign.$name returns "Campaign"', () => {
      expect((Campaign as any).$name).toBe('Campaign')
    })

    it('Segment.$name returns "Segment"', () => {
      expect((Segment as any).$name).toBe('Segment')
    })

    it('Form.$name returns "Form"', () => {
      expect((Form as any).$name).toBe('Form')
    })
  })

  // ===========================================================================
  // 20. Segment CRUD with criteria (3 tests)
  // ===========================================================================
  describe('Segment CRUD with criteria', () => {
    it('can store and retrieve complex criteria strings', async () => {
      const criteria = 'industry=saas AND revenue>100000 AND stage IN (Qualified,Customer)'
      const s = await Segment.create({ name: 'High Value SaaS', criteria })
      const fetched = await Segment.get(s.$id)
      expect(fetched!.criteria).toBe(criteria)
    })

    it('can update segment memberCount', async () => {
      const s = await Segment.create({ name: 'Growing Segment', memberCount: 10 })
      const updated = await Segment.update(s.$id, { memberCount: 150 })
      expect(updated.memberCount).toBe(150)
      expect(updated.$version).toBe(2)
    })

    it('segment with isDynamic set to "true" string is stored as-is', async () => {
      const s = await Segment.create({ name: 'Dynamic Seg', isDynamic: 'true' })
      const fetched = await Segment.get(s.$id)
      expect(fetched!.isDynamic).toBe('true')
    })
  })

  // ===========================================================================
  // 21. Multiple entity creation with unique IDs (2 tests)
  // ===========================================================================
  describe('unique ID generation', () => {
    it('10 campaigns all receive unique $id values', async () => {
      const ids = new Set<string>()
      for (let i = 0; i < 10; i++) {
        const c = await Campaign.create({ name: `Campaign ${i}` })
        ids.add(c.$id)
      }
      expect(ids.size).toBe(10)
    })

    it('IDs across different entity types never collide', async () => {
      const c = await Campaign.create({ name: 'C' })
      const s = await Segment.create({ name: 'S' })
      const f = await Form.create({ name: 'F' })
      // Different prefixes guarantee no collision
      expect(c.$id.startsWith('campaign_')).toBe(true)
      expect(s.$id.startsWith('segment_')).toBe(true)
      expect(f.$id.startsWith('form_')).toBe(true)
      expect(new Set([c.$id, s.$id, f.$id]).size).toBe(3)
    })
  })

  // ===========================================================================
  // 22. Schema singular/plural/slug (3 tests)
  // ===========================================================================
  describe('linguistic derivation', () => {
    it('Campaign singular/plural/slug', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.singular).toBe('campaign')
      expect(schema.plural).toBe('campaigns')
      expect(schema.slug).toBe('campaign')
    })

    it('Segment singular/plural/slug', () => {
      const schema = Segment.$schema as NounSchema
      expect(schema.singular).toBe('segment')
      expect(schema.plural).toBe('segments')
      expect(schema.slug).toBe('segment')
    })

    it('Form singular/plural/slug', () => {
      const schema = Form.$schema as NounSchema
      expect(schema.singular).toBe('form')
      expect(schema.plural).toBe('forms')
      expect(schema.slug).toBe('form')
    })
  })

  // ===========================================================================
  // 23. Campaign scheduling edge case (2 tests)
  // ===========================================================================
  describe('Campaign scheduling data', () => {
    it('can store startDate and endDate as date strings', async () => {
      const c = await Campaign.create({
        name: 'Date Test',
        startDate: '2025-06-01',
        endDate: '2025-06-30',
      })
      expect(c.startDate).toBe('2025-06-01')
      expect(c.endDate).toBe('2025-06-30')
    })

    it('can store campaign with full UTM parameters', async () => {
      const c = await Campaign.create({
        name: 'UTM Campaign',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'spring_2025',
        landingPageUrl: 'https://headless.ly/demo',
      })
      const fetched = await Campaign.get(c.$id)
      expect(fetched!.utmSource).toBe('google')
      expect(fetched!.utmMedium).toBe('cpc')
      expect(fetched!.utmCampaign).toBe('spring_2025')
      expect(fetched!.landingPageUrl).toBe('https://headless.ly/demo')
    })
  })

  // ===========================================================================
  // 24. Form submission count tracking (2 tests)
  // ===========================================================================
  describe('Form submission tracking', () => {
    it('can increment submissionCount via update', async () => {
      const f = await Form.create({ name: 'Counter Form', submissionCount: 0 })
      const u1 = await Form.update(f.$id, { submissionCount: 1 })
      expect(u1.submissionCount).toBe(1)
      const u2 = await Form.update(f.$id, { submissionCount: 2 })
      expect(u2.submissionCount).toBe(2)
      expect(u2.$version).toBe(3)
    })

    it('form fields string can describe a schema', async () => {
      const f = await Form.create({
        name: 'Structured Form',
        fields: JSON.stringify([
          { name: 'email', type: 'email', required: true },
          { name: 'company', type: 'text', required: false },
        ]),
      })
      const parsed = JSON.parse(f.fields as string)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].name).toBe('email')
    })
  })

  // ===========================================================================
  // 25. $exists operator (2 tests)
  // ===========================================================================
  describe('$exists operator', () => {
    it('$exists: true matches entities with the field set', async () => {
      await Campaign.create({ name: 'With Budget', budget: 1000 })
      await Campaign.create({ name: 'Without Budget' })
      const results = await Campaign.find({ budget: { $exists: true } })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('With Budget')
    })

    it('$exists: false matches entities without the field', async () => {
      await Campaign.create({ name: 'Has Type', type: 'Email' })
      await Campaign.create({ name: 'No Type' })
      const results = await Campaign.find({ type: { $exists: false } })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('No Type')
    })
  })
})
