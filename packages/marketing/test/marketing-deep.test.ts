import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import type { NounSchema, ParsedProperty, VerbConjugation } from 'digital-objects'
import { Campaign, Segment, Form } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/marketing — deep coverage (RED)', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Campaign Noun Schema (~5 tests)
  // ===========================================================================
  describe('Campaign schema', () => {
    it('exposes $schema with name, singular, and plural', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.name).toBe('Campaign')
      expect(schema.singular).toBe('campaign')
      expect(schema.plural).toBe('campaigns')
    })

    it('has all expected fields in the schema', () => {
      const schema = Campaign.$schema as NounSchema
      const fieldNames = Array.from(schema.fields.keys())
      expect(fieldNames).toContain('name')
      expect(fieldNames).toContain('status')
      expect(fieldNames).toContain('type')
      expect(fieldNames).toContain('budget')
      expect(fieldNames).toContain('startDate')
      expect(fieldNames).toContain('endDate')
      expect(fieldNames).toContain('description')
      expect(fieldNames).toContain('currency')
      expect(fieldNames).toContain('targetLeads')
      expect(fieldNames).toContain('targetRevenue')
      expect(fieldNames).toContain('actualLeads')
      expect(fieldNames).toContain('actualRevenue')
      expect(fieldNames).toContain('roi')
    })

    it('status field is an enum with correct values', () => {
      const schema = Campaign.$schema as NounSchema
      const statusField = schema.fields.get('status') as ParsedProperty
      expect(statusField).toBeDefined()
      expect(statusField.kind).toBe('enum')
      expect(statusField.enumValues).toBeDefined()
      expect(statusField.enumValues).toContain('Draft')
      expect(statusField.enumValues).toContain('Scheduled')
      expect(statusField.enumValues).toContain('Active')
      expect(statusField.enumValues).toContain('Paused')
      expect(statusField.enumValues).toContain('Completed')
      expect(statusField.enumValues).toContain('Cancelled')
    })

    it('type field is an enum with correct channel values', () => {
      const schema = Campaign.$schema as NounSchema
      const typeField = schema.fields.get('type') as ParsedProperty
      expect(typeField).toBeDefined()
      expect(typeField.kind).toBe('enum')
      expect(typeField.enumValues).toContain('Email')
      expect(typeField.enumValues).toContain('Social')
      expect(typeField.enumValues).toContain('Content')
      expect(typeField.enumValues).toContain('Event')
      expect(typeField.enumValues).toContain('Paid')
      expect(typeField.enumValues).toContain('Webinar')
      expect(typeField.enumValues).toContain('Referral')
    })

    it('has owner and leads relationships', () => {
      const schema = Campaign.$schema as NounSchema
      const relNames = Array.from(schema.relationships.keys())
      expect(relNames).toContain('owner')
      expect(relNames).toContain('leads')
      const ownerRel = schema.relationships.get('owner') as ParsedProperty
      expect(ownerRel.kind).toBe('relationship')
      expect(ownerRel.targetType).toBe('Contact')
    })
  })

  // ===========================================================================
  // 2. Segment Noun Schema (~5 tests)
  // ===========================================================================
  describe('Segment schema', () => {
    it('exposes $schema with name, singular, and plural', () => {
      const schema = Segment.$schema as NounSchema
      expect(schema.name).toBe('Segment')
      expect(schema.singular).toBe('segment')
      expect(schema.plural).toBe('segments')
    })

    it('has all expected fields in the schema', () => {
      const schema = Segment.$schema as NounSchema
      const fieldNames = Array.from(schema.fields.keys())
      expect(fieldNames).toContain('name')
      expect(fieldNames).toContain('description')
      expect(fieldNames).toContain('criteria')
      expect(fieldNames).toContain('memberCount')
      expect(fieldNames).toContain('isDynamic')
    })

    it('name field is required (string!)', () => {
      const schema = Segment.$schema as NounSchema
      const nameField = schema.fields.get('name') as ParsedProperty
      expect(nameField).toBeDefined()
      expect(nameField.kind).toBe('field')
      expect(nameField.modifiers?.required).toBe(true)
    })

    it('has organization relationship', () => {
      const schema = Segment.$schema as NounSchema
      const relNames = Array.from(schema.relationships.keys())
      expect(relNames).toContain('organization')
      const orgRel = schema.relationships.get('organization') as ParsedProperty
      expect(orgRel.kind).toBe('relationship')
      expect(orgRel.targetType).toBe('Organization')
    })

    it('memberCount is a number field', () => {
      const schema = Segment.$schema as NounSchema
      const field = schema.fields.get('memberCount') as ParsedProperty
      expect(field).toBeDefined()
      expect(field.kind).toBe('field')
      expect(field.type).toBe('number')
    })
  })

  // ===========================================================================
  // 3. Form Noun Schema (~5 tests)
  // ===========================================================================
  describe('Form schema', () => {
    it('exposes $schema with name, singular, and plural', () => {
      const schema = Form.$schema as NounSchema
      expect(schema.name).toBe('Form')
      expect(schema.singular).toBe('form')
      expect(schema.plural).toBe('forms')
    })

    it('has all expected fields in the schema', () => {
      const schema = Form.$schema as NounSchema
      const fieldNames = Array.from(schema.fields.keys())
      expect(fieldNames).toContain('name')
      expect(fieldNames).toContain('description')
      expect(fieldNames).toContain('fields')
      expect(fieldNames).toContain('status')
      expect(fieldNames).toContain('submissionCount')
    })

    it('status field is an enum with Draft, Active, Archived', () => {
      const schema = Form.$schema as NounSchema
      const statusField = schema.fields.get('status') as ParsedProperty
      expect(statusField).toBeDefined()
      expect(statusField.kind).toBe('enum')
      expect(statusField.enumValues).toEqual(expect.arrayContaining(['Draft', 'Active', 'Archived']))
    })

    it('name field is required', () => {
      const schema = Form.$schema as NounSchema
      const nameField = schema.fields.get('name') as ParsedProperty
      expect(nameField).toBeDefined()
      expect(nameField.modifiers?.required).toBe(true)
    })

    it('has organization relationship', () => {
      const schema = Form.$schema as NounSchema
      const relNames = Array.from(schema.relationships.keys())
      expect(relNames).toContain('organization')
      const orgRel = schema.relationships.get('organization') as ParsedProperty
      expect(orgRel.kind).toBe('relationship')
      expect(orgRel.targetType).toBe('Organization')
    })
  })

  // ===========================================================================
  // 4. Campaign Verbs (~4 tests)
  // ===========================================================================
  describe('Campaign verbs', () => {
    it('schema has default CRUD verbs (create, update, delete)', () => {
      const schema = Campaign.$schema as NounSchema
      const verbNames = Array.from(schema.verbs.keys())
      expect(verbNames).toContain('create')
      expect(verbNames).toContain('update')
      expect(verbNames).toContain('delete')
    })

    it('schema has custom verbs: launch, pause, complete', () => {
      const schema = Campaign.$schema as NounSchema
      const verbNames = Array.from(schema.verbs.keys())
      expect(verbNames).toContain('launch')
      expect(verbNames).toContain('pause')
      expect(verbNames).toContain('complete')
    })

    it('launch verb has correct conjugation', () => {
      const schema = Campaign.$schema as NounSchema
      const launchVerb = schema.verbs.get('launch') as VerbConjugation
      expect(launchVerb).toBeDefined()
      expect(launchVerb.action).toBe('launch')
      expect(launchVerb.activity).toBe('launching')
      expect(launchVerb.event).toBe('launched')
    })

    it('pause and complete verbs have correct conjugations', () => {
      const schema = Campaign.$schema as NounSchema
      const pauseVerb = schema.verbs.get('pause') as VerbConjugation
      expect(pauseVerb).toBeDefined()
      expect(pauseVerb.action).toBe('pause')
      expect(pauseVerb.activity).toBe('pausing')
      expect(pauseVerb.event).toBe('paused')

      const completeVerb = schema.verbs.get('complete') as VerbConjugation
      expect(completeVerb).toBeDefined()
      expect(completeVerb.action).toBe('complete')
      expect(completeVerb.activity).toBe('completing')
      expect(completeVerb.event).toBe('completed')
    })
  })

  // ===========================================================================
  // 5. Campaign Lifecycle (~5 tests)
  // ===========================================================================
  describe('Campaign lifecycle', () => {
    it('creates a draft campaign with status Draft', async () => {
      const campaign = await Campaign.create({ name: 'Spring Launch', status: 'Draft', type: 'Email' })
      expect(campaign.$type).toBe('Campaign')
      expect(campaign.name).toBe('Spring Launch')
      expect(campaign.status).toBe('Draft')
      expect(campaign.type).toBe('Email')
    })

    it('launch() transitions campaign status', async () => {
      const campaign = await Campaign.create({ name: 'Product Hunt', status: 'Draft' })
      const launched = await Campaign.launch(campaign.$id)
      expect(launched.$id).toBe(campaign.$id)
      // launch: 'Launched' — 'Launched' is NOT in the status enum, so resolveVerbTransition
      // falls through to Strategy 3 (convention field 'status') and sets { status: 'Launched' }
      expect(launched.status).toBe('Launched')
    })

    it('pause() transitions campaign status to Paused', async () => {
      const campaign = await Campaign.create({ name: 'Summer Campaign', status: 'Active' })
      const paused = await Campaign.pause(campaign.$id)
      expect(paused.$id).toBe(campaign.$id)
      // pause: 'Paused' — 'Paused' IS in the status enum, Strategy 1 matches
      expect(paused.status).toBe('Paused')
    })

    it('complete() transitions campaign status to Completed', async () => {
      const campaign = await Campaign.create({ name: 'Q4 Push', status: 'Active' })
      const completed = await Campaign.complete(campaign.$id)
      expect(completed.$id).toBe(campaign.$id)
      // complete: 'Completed' — 'Completed' IS in the status enum, Strategy 1 matches
      expect(completed.status).toBe('Completed')
    })

    it('completed campaign retains all original fields after transition', async () => {
      const campaign = await Campaign.create({
        name: 'Field Retention Test',
        status: 'Active',
        type: 'Webinar',
        budget: 10000,
        currency: 'USD',
      })
      const completed = await Campaign.complete(campaign.$id)
      expect(completed.name).toBe('Field Retention Test')
      expect(completed.type).toBe('Webinar')
      expect(completed.budget).toBe(10000)
      expect(completed.currency).toBe('USD')
      expect(completed.status).toBe('Completed')
      expect(completed.$version).toBe(2)
    })
  })

  // ===========================================================================
  // 6. Form Lifecycle (~4 tests)
  // ===========================================================================
  describe('Form lifecycle', () => {
    it('creates a form with Draft status', async () => {
      const form = await Form.create({ name: 'Newsletter Signup', status: 'Draft' })
      expect(form.$type).toBe('Form')
      expect(form.name).toBe('Newsletter Signup')
      expect(form.status).toBe('Draft')
    })

    it('publish() transitions form status', async () => {
      const form = await Form.create({ name: 'Demo Request', status: 'Draft' })
      const published = await Form.publish(form.$id)
      expect(published.$id).toBe(form.$id)
      // publish: 'Published' — 'Published' is NOT in Form's status enum (Draft|Active|Archived)
      // Strategy 3 sets { status: 'Published' }
      expect(published.status).toBe('Published')
    })

    it('archive() transitions form status to Archived', async () => {
      const form = await Form.create({ name: 'Old Contact Form', status: 'Active' })
      const archived = await Form.archive(form.$id)
      expect(archived.$id).toBe(form.$id)
      // archive: 'Archived' — 'Archived' IS in the status enum, Strategy 1 matches
      expect(archived.status).toBe('Archived')
    })

    it('form retains fields after verb transition', async () => {
      const form = await Form.create({ name: 'Beta Access', status: 'Draft', description: 'Request early access' })
      const archived = await Form.archive(form.$id)
      expect(archived.name).toBe('Beta Access')
      expect(archived.description).toBe('Request early access')
      expect(archived.status).toBe('Archived')
    })
  })

  // ===========================================================================
  // 7. Cross-Entity & Querying (~5 tests)
  // ===========================================================================
  describe('cross-entity and querying', () => {
    it('find() returns all campaigns', async () => {
      await Campaign.create({ name: 'Campaign A', type: 'Email' })
      await Campaign.create({ name: 'Campaign B', type: 'Social' })
      await Campaign.create({ name: 'Campaign C', type: 'Paid' })

      const all = await Campaign.find()
      expect(Array.isArray(all)).toBe(true)
      expect(all.length).toBe(3)
    })

    it('find() filters campaigns by status', async () => {
      await Campaign.create({ name: 'Active 1', status: 'Active' })
      await Campaign.create({ name: 'Active 2', status: 'Active' })
      await Campaign.create({ name: 'Draft 1', status: 'Draft' })

      const active = await Campaign.find({ status: 'Active' })
      expect(active.length).toBe(2)
      expect(active.every((c: any) => c.status === 'Active')).toBe(true)
    })

    it('find() filters campaigns by type', async () => {
      await Campaign.create({ name: 'Email Campaign', type: 'Email' })
      await Campaign.create({ name: 'Social Campaign', type: 'Social' })

      const emails = await Campaign.find({ type: 'Email' })
      expect(emails.length).toBe(1)
      expect(emails[0].name).toBe('Email Campaign')
    })

    it('segments are independent from campaigns in storage', async () => {
      await Campaign.create({ name: 'Marketing Push' })
      await Segment.create({ name: 'Enterprise' })
      await Form.create({ name: 'Contact Us' })

      const campaigns = await Campaign.find()
      const segments = await Segment.find()
      const forms = await Form.find()

      expect(campaigns.length).toBe(1)
      expect(segments.length).toBe(1)
      expect(forms.length).toBe(1)
      expect(campaigns[0].$type).toBe('Campaign')
      expect(segments[0].$type).toBe('Segment')
      expect(forms[0].$type).toBe('Form')
    })

    it('segment can store campaign reference as a field value', async () => {
      const campaign = await Campaign.create({ name: 'Outbound Q1', type: 'Email' })
      const segment = await Segment.create({ name: 'Q1 Targets', criteria: `campaign=${campaign.$id}` })

      expect(segment.criteria).toBe(`campaign=${campaign.$id}`)
      const fetched = await Segment.get(segment.$id)
      expect(fetched).not.toBeNull()
      expect(fetched!.criteria).toContain(campaign.$id)
    })
  })

  // ===========================================================================
  // 8. Hook Registration (~4 tests)
  // ===========================================================================
  describe('hook registration', () => {
    it('Campaign.launched() registers an AFTER hook', async () => {
      const events: string[] = []
      Campaign.launched((instance: any) => {
        events.push(`launched:${instance.name}`)
      })

      const campaign = await Campaign.create({ name: 'Hook Test', status: 'Draft' })
      await Campaign.launch(campaign.$id)

      expect(events).toContain('launched:Hook Test')
    })

    it('Campaign.launching() registers a BEFORE hook', async () => {
      const events: string[] = []
      Campaign.launching(() => {
        events.push('before-launch')
      })

      const campaign = await Campaign.create({ name: 'Before Hook', status: 'Draft' })
      await Campaign.launch(campaign.$id)

      expect(events).toContain('before-launch')
    })

    it('Form.published() registers an AFTER hook', async () => {
      const events: string[] = []
      Form.published((instance: any) => {
        events.push(`published:${instance.name}`)
      })

      const form = await Form.create({ name: 'Signup Form', status: 'Draft' })
      await Form.publish(form.$id)

      expect(events).toContain('published:Signup Form')
    })

    it('Campaign.created() fires on every Campaign.create()', async () => {
      const createdNames: string[] = []
      Campaign.created((instance: any) => {
        createdNames.push(instance.name)
      })

      await Campaign.create({ name: 'First' })
      await Campaign.create({ name: 'Second' })

      expect(createdNames).toEqual(['First', 'Second'])
    })
  })
})
