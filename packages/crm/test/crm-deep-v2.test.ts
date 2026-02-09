import { describe, it, expect } from 'vitest'
import { Organization, Contact, Lead, Deal, Activity, Pipeline } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/crm — deep v2', () => {
  setupTestProvider()

  // =========================================================================
  // 1. Full field-level schema validation for every entity field
  //    Tests fields NOT already tested in crm-deep.test.ts
  // =========================================================================
  describe('Organization field-level schema completeness', () => {
    it('legalName is an optional string field', () => {
      const field = Organization.$schema.fields.get('legalName')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('description is a plain string field', () => {
      const field = Organization.$schema.fields.get('description')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('logo is a plain string field', () => {
      const field = Organization.$schema.fields.get('logo')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('source is a plain string field', () => {
      const field = Organization.$schema.fields.get('source')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('industry is a plain string field', () => {
      const field = Organization.$schema.fields.get('industry')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('naicsCode is a plain string field', () => {
      const field = Organization.$schema.fields.get('naicsCode')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('foundedYear is a number field', () => {
      const field = Organization.$schema.fields.get('foundedYear')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('number')
    })

    it('address is a string field', () => {
      const field = Organization.$schema.fields.get('address')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('city is a string field', () => {
      const field = Organization.$schema.fields.get('city')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('state is a string field', () => {
      const field = Organization.$schema.fields.get('state')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('country is a string field', () => {
      const field = Organization.$schema.fields.get('country')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('postalCode is a string field', () => {
      const field = Organization.$schema.fields.get('postalCode')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('timezone is a string field', () => {
      const field = Organization.$schema.fields.get('timezone')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('lifetimeValue is a number field', () => {
      const field = Organization.$schema.fields.get('lifetimeValue')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('healthScore is a number field', () => {
      const field = Organization.$schema.fields.get('healthScore')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('npsScore is a number field', () => {
      const field = Organization.$schema.fields.get('npsScore')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('linkedinUrl is a string field', () => {
      const field = Organization.$schema.fields.get('linkedinUrl')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('twitterHandle is a string field', () => {
      const field = Organization.$schema.fields.get('twitterHandle')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })
  })

  describe('Contact field-level schema completeness', () => {
    it('firstName is a plain string field', () => {
      const field = Contact.$schema.fields.get('firstName')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('lastName is a plain string field', () => {
      const field = Contact.$schema.fields.get('lastName')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('phone is a plain string field', () => {
      const field = Contact.$schema.fields.get('phone')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('mobile is a string field', () => {
      const field = Contact.$schema.fields.get('mobile')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('avatar is a string field', () => {
      const field = Contact.$schema.fields.get('avatar')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('title is a string field', () => {
      const field = Contact.$schema.fields.get('title')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('department is a string field', () => {
      const field = Contact.$schema.fields.get('department')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('source is a string field', () => {
      const field = Contact.$schema.fields.get('source')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('leadScore is a number field', () => {
      const field = Contact.$schema.fields.get('leadScore')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('timezone is a string field', () => {
      const field = Contact.$schema.fields.get('timezone')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('language is a string field', () => {
      const field = Contact.$schema.fields.get('language')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('linkedinUrl is a string field', () => {
      const field = Contact.$schema.fields.get('linkedinUrl')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('twitterHandle is a string field', () => {
      const field = Contact.$schema.fields.get('twitterHandle')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('marketingConsent is a string field', () => {
      const field = Contact.$schema.fields.get('marketingConsent')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })
  })

  // =========================================================================
  // 2. Lead and Deal field-level validation (fields not yet covered)
  // =========================================================================
  describe('Lead field-level schema completeness', () => {
    it('sourceDetail is a string field', () => {
      const field = Lead.$schema.fields.get('sourceDetail')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('score is a number field', () => {
      const field = Lead.$schema.fields.get('score')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('budget is a number field', () => {
      const field = Lead.$schema.fields.get('budget')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('authority is a string field', () => {
      const field = Lead.$schema.fields.get('authority')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('need is a string field', () => {
      const field = Lead.$schema.fields.get('need')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('timeline is a string field', () => {
      const field = Lead.$schema.fields.get('timeline')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('lostReason is a string field', () => {
      const field = Lead.$schema.fields.get('lostReason')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('lostAt is a datetime field', () => {
      const field = Lead.$schema.fields.get('lostAt')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })

    it('firstTouchAt is a datetime field', () => {
      const field = Lead.$schema.fields.get('firstTouchAt')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })

    it('lastActivityAt is a datetime field', () => {
      const field = Lead.$schema.fields.get('lastActivityAt')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })
  })

  describe('Deal field-level schema completeness', () => {
    it('currency is a string field', () => {
      const field = Deal.$schema.fields.get('currency')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('recurringValue is a number field', () => {
      const field = Deal.$schema.fields.get('recurringValue')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('probability is a number field', () => {
      const field = Deal.$schema.fields.get('probability')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('actualCloseDate is a date field', () => {
      const field = Deal.$schema.fields.get('actualCloseDate')
      expect(field).toBeDefined()
      expect(field!.type).toBe('date')
    })

    it('description is a string field', () => {
      const field = Deal.$schema.fields.get('description')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('nextStep is a string field', () => {
      const field = Deal.$schema.fields.get('nextStep')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('competitorNotes is a string field', () => {
      const field = Deal.$schema.fields.get('competitorNotes')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('lostReason is a string field', () => {
      const field = Deal.$schema.fields.get('lostReason')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('wonReason is a string field', () => {
      const field = Deal.$schema.fields.get('wonReason')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('source is a string field', () => {
      const field = Deal.$schema.fields.get('source')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('lastActivityAt is a datetime field', () => {
      const field = Deal.$schema.fields.get('lastActivityAt')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })
  })

  describe('Activity field-level schema completeness', () => {
    it('dueAt is a datetime field', () => {
      const field = Activity.$schema.fields.get('dueAt')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })

    it('startAt is a datetime field', () => {
      const field = Activity.$schema.fields.get('startAt')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })

    it('endAt is a datetime field', () => {
      const field = Activity.$schema.fields.get('endAt')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })

    it('allDay is a string field', () => {
      const field = Activity.$schema.fields.get('allDay')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('timezone is a string field', () => {
      const field = Activity.$schema.fields.get('timezone')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('completedAt is a datetime field', () => {
      const field = Activity.$schema.fields.get('completedAt')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })

    it('outcome is a string field', () => {
      const field = Activity.$schema.fields.get('outcome')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('recordingUrl is a string field', () => {
      const field = Activity.$schema.fields.get('recordingUrl')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('meetingLink is a string field', () => {
      const field = Activity.$schema.fields.get('meetingLink')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('reminderAt is a datetime field', () => {
      const field = Activity.$schema.fields.get('reminderAt')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })
  })

  describe('Pipeline field-level schema completeness', () => {
    it('slug is a unique-indexed string', () => {
      const field = Pipeline.$schema.fields.get('slug')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.unique).toBe(true)
      expect(field!.modifiers?.indexed).toBe(true)
    })

    it('description is a string field', () => {
      const field = Pipeline.$schema.fields.get('description')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('isDefault is a string field', () => {
      const field = Pipeline.$schema.fields.get('isDefault')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })

    it('stages is a string field', () => {
      const field = Pipeline.$schema.fields.get('stages')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
    })
  })

  // =========================================================================
  // 3. Relationship isArray and forward vs back-reference precision
  // =========================================================================
  describe('relationship isArray for forward references', () => {
    it('Organization.parent is NOT an array (single forward ref)', () => {
      const rel = Organization.$schema.relationships.get('parent')
      expect(rel).toBeDefined()
      expect(rel!.isArray).toBeFalsy()
    })

    it('Contact.organization is NOT an array (single forward ref)', () => {
      const rel = Contact.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.isArray).toBeFalsy()
    })

    it('Contact.manager is NOT an array (single self-forward ref)', () => {
      const rel = Contact.$schema.relationships.get('manager')
      expect(rel).toBeDefined()
      expect(rel!.isArray).toBeFalsy()
    })

    it('Lead.contact is NOT an array', () => {
      const rel = Lead.$schema.relationships.get('contact')
      expect(rel).toBeDefined()
      expect(rel!.isArray).toBeFalsy()
    })

    it('Lead.organization is NOT an array', () => {
      const rel = Lead.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.isArray).toBeFalsy()
    })

    it('Lead.owner is NOT an array', () => {
      const rel = Lead.$schema.relationships.get('owner')
      expect(rel).toBeDefined()
      expect(rel!.isArray).toBeFalsy()
    })

    it('Deal.owner is a forward reference to Contact (no backref)', () => {
      const rel = Deal.$schema.relationships.get('owner')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Contact')
      expect(rel!.backref).toBeUndefined()
      expect(rel!.isArray).toBeFalsy()
    })
  })

  // =========================================================================
  // 4. Enum value CRUD operations — create with each value and filter
  // =========================================================================
  describe('enum value creation and querying', () => {
    it('can create Organization with each tier value', async () => {
      const tiers = ['Enterprise', 'Business', 'Startup', 'SMB']
      for (const tier of tiers) {
        const org = await Organization.create({ name: `${tier} Corp`, tier })
        expect(org.tier).toBe(tier)
      }
    })

    it('can create Contact with each role and filter by role', async () => {
      const roles = ['DecisionMaker', 'Influencer', 'Champion', 'Blocker', 'User']
      for (const role of roles) {
        await Contact.create({ name: `Contact ${role}`, role })
      }
      const decisionMakers = await Contact.find({ role: 'DecisionMaker' })
      expect(decisionMakers.length).toBe(1)
      expect(decisionMakers[0].role).toBe('DecisionMaker')
    })

    it('can create Contact with each preferredChannel value', async () => {
      const channels = ['Email', 'Phone', 'SMS', 'Chat']
      for (const ch of channels) {
        const c = await Contact.create({ name: `Contact ${ch}`, preferredChannel: ch })
        expect(c.preferredChannel).toBe(ch)
      }
    })

    it('can create Lead with each status value', async () => {
      const statuses = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost']
      for (const status of statuses) {
        const lead = await Lead.create({ name: `Lead ${status}`, source: 'Test', status })
        expect(lead.status).toBe(status)
      }
    })

    it('can create Deal with each stage and filter', async () => {
      const stages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'ClosedWon', 'ClosedLost']
      for (const stage of stages) {
        await Deal.create({ name: `Deal ${stage}`, value: 1000, stage })
      }
      const proposals = await Deal.find({ stage: 'Proposal' })
      expect(proposals.length).toBe(1)
      expect(proposals[0].stage).toBe('Proposal')
    })

    it('can create Deal with each recurringInterval value', async () => {
      const intervals = ['Monthly', 'Quarterly', 'Yearly']
      for (const interval of intervals) {
        const deal = await Deal.create({ name: `Deal ${interval}`, value: 500, recurringInterval: interval })
        expect(deal.recurringInterval).toBe(interval)
      }
    })

    it('can create Activity with each type value', async () => {
      const types = ['Call', 'Email', 'Meeting', 'Task', 'Note', 'Demo', 'FollowUp']
      for (const type of types) {
        const activity = await Activity.create({ subject: `Activity ${type}`, type })
        expect(activity.type).toBe(type)
      }
    })

    it('can create Activity with each priority value', async () => {
      const priorities = ['Low', 'Medium', 'High', 'Urgent']
      for (const priority of priorities) {
        const activity = await Activity.create({ subject: `Priority ${priority}`, type: 'Task', priority })
        expect(activity.priority).toBe(priority)
      }
    })

    it('can create Organization with each status value', async () => {
      const statuses = ['Active', 'Inactive', 'Churned', 'Archived']
      for (const status of statuses) {
        const org = await Organization.create({ name: `Org ${status}`, status })
        expect(org.status).toBe(status)
      }
    })

    it('can create Contact with each status value', async () => {
      const statuses = ['Active', 'Inactive', 'Bounced', 'Unsubscribed']
      for (const status of statuses) {
        const c = await Contact.create({ name: `Contact ${status}`, status })
        expect(c.status).toBe(status)
      }
    })

    it('can create Activity with each status value', async () => {
      const statuses = ['Pending', 'InProgress', 'Completed', 'Cancelled']
      for (const status of statuses) {
        const a = await Activity.create({ subject: `Status ${status}`, type: 'Task', status })
        expect(a.status).toBe(status)
      }
    })

    it('can create Organization with each type value', async () => {
      const types = ['Prospect', 'Customer', 'Partner', 'Vendor', 'Competitor']
      for (const type of types) {
        const org = await Organization.create({ name: `Org ${type}`, type })
        expect(org.type).toBe(type)
      }
    })
  })

  // =========================================================================
  // 5. Verb state transitions for every custom verb
  // =========================================================================
  describe('verb state transitions', () => {
    it('Lead.convert transitions status to Converted', async () => {
      const lead = await Lead.create({ name: 'A Lead', source: 'Web', status: 'Qualified' })
      const converted = await (Lead as any).convert(lead.$id)
      expect(converted).toBeDefined()
      expect(converted.status).toBe('Converted')
    })

    it('Lead.lose transitions status to Lost', async () => {
      const lead = await Lead.create({ name: 'Lost Lead', source: 'Ads', status: 'New' })
      const lost = await (Lead as any).lose(lead.$id)
      expect(lost).toBeDefined()
      expect(lost.status).toBe('Lost')
    })

    it('Deal.close transitions stage to Closed', async () => {
      const deal = await Deal.create({ name: 'Close Deal', value: 5000, stage: 'Negotiation' })
      const closed = await (Deal as any).close(deal.$id)
      expect(closed).toBeDefined()
      // 'Closed' is not in the Deal.stage enum, so resolveVerbTransition falls back to stage/status convention
      expect(closed.stage).toBe('Closed')
    })

    it('Deal.win transitions stage to Won', async () => {
      const deal = await Deal.create({ name: 'Win Deal', value: 10000, stage: 'Negotiation' })
      const won = await (Deal as any).win(deal.$id)
      expect(won).toBeDefined()
      expect(won.stage).toBe('Won')
    })

    it('Deal.lose transitions stage to Lost', async () => {
      const deal = await Deal.create({ name: 'Lose Deal', value: 3000, stage: 'Proposal' })
      const lost = await (Deal as any).lose(deal.$id)
      expect(lost).toBeDefined()
      expect(lost.stage).toBe('Lost')
    })

    it('custom verb preserves $id after state transition', async () => {
      const contact = await Contact.create({ name: 'Keep Id', status: 'Active' })
      const qualified = await (Contact as any).qualify(contact.$id)
      expect(qualified.$id).toBe(contact.$id)
    })

    it('custom verb increments $version', async () => {
      const activity = await Activity.create({ subject: 'Version Test', type: 'Task', status: 'Pending' })
      expect(activity.$version).toBe(1)
      const completed = await (Activity as any).complete(activity.$id)
      expect(completed.$version).toBe(2)
    })
  })

  // =========================================================================
  // 6. CRUD hook data transformation chains
  // =========================================================================
  describe('CRUD hook chains', () => {
    it('multiple BEFORE hooks compose in order', async () => {
      const unsub1 = (Organization as any).creating((data: Record<string, unknown>) => {
        return { ...data, source: 'hook1' }
      })
      const unsub2 = (Organization as any).creating((data: Record<string, unknown>) => {
        return { ...data, industry: data.source + '-enriched' }
      })

      const org = await Organization.create({ name: 'Chained Hooks' })
      expect(org.source).toBe('hook1')
      expect(org.industry).toBe('hook1-enriched')

      unsub1()
      unsub2()
    })

    it('BEFORE hook on update can modify data before persistence', async () => {
      const unsub = (Deal as any).updating((data: Record<string, unknown>) => {
        if (typeof data.value === 'number' && data.value > 100000) {
          return { ...data, stage: 'Enterprise' }
        }
        return data
      })

      const deal = await Deal.create({ name: 'Hook Deal', value: 5000 })
      const updated = await Deal.update(deal.$id, { value: 200000 })
      expect(updated.stage).toBe('Enterprise')

      unsub()
    })

    it('AFTER hook on update receives updated instance', async () => {
      let hookedValue: unknown
      const unsub = (Deal as any).updated((instance: any) => {
        hookedValue = instance.value
      })

      const deal = await Deal.create({ name: 'After Hook', value: 1000 })
      await Deal.update(deal.$id, { value: 9999 })
      expect(hookedValue).toBe(9999)

      unsub()
    })

    it('BEFORE hook can reject by throwing', async () => {
      const unsub = (Contact as any).creating(() => {
        throw new Error('Validation failed')
      })

      await expect(Contact.create({ name: 'Rejected' })).rejects.toThrow('Validation failed')

      unsub()
    })

    it('AFTER hook fires for custom verbs', async () => {
      let qualifiedName: unknown
      const unsub = (Contact as any).qualified((instance: any) => {
        qualifiedName = instance.name
      })

      const contact = await Contact.create({ name: 'Hook Qualify', status: 'Active' })
      await (Contact as any).qualify(contact.$id)
      expect(qualifiedName).toBe('Hook Qualify')

      unsub()
    })

    it('BEFORE hook on custom verb fires before execution', async () => {
      let beforeCalled = false
      const unsub = (Contact as any).qualifying(() => {
        beforeCalled = true
      })

      const contact = await Contact.create({ name: 'Before Qualify', status: 'Active' })
      await (Contact as any).qualify(contact.$id)
      expect(beforeCalled).toBe(true)

      unsub()
    })

    it('BEFORE deleting hook fires', async () => {
      let deletingCalled = false
      const unsub = (Pipeline as any).deleting(() => {
        deletingCalled = true
      })

      const pipeline = await Pipeline.create({ name: 'Delete Hook Test' })
      await Pipeline.delete(pipeline.$id)
      expect(deletingCalled).toBe(true)

      unsub()
    })

    it('AFTER deleted hook fires with entity info', async () => {
      let deletedId: unknown
      const unsub = (Pipeline as any).deleted((instance: any) => {
        deletedId = instance.$id
      })

      const pipeline = await Pipeline.create({ name: 'After Delete' })
      await Pipeline.delete(pipeline.$id)
      expect(deletedId).toBe(pipeline.$id)

      unsub()
    })
  })

  // =========================================================================
  // 7. Concurrent cross-entity operations
  // =========================================================================
  describe('concurrent cross-entity operations', () => {
    it('can create entities across all types concurrently', async () => {
      const results = await Promise.all([
        Organization.create({ name: 'Concurrent Org' }),
        Contact.create({ name: 'Concurrent Contact' }),
        Lead.create({ name: 'Concurrent Lead', source: 'Test' }),
        Deal.create({ name: 'Concurrent Deal', value: 1000 }),
        Activity.create({ subject: 'Concurrent Activity', type: 'Call' }),
        Pipeline.create({ name: 'Concurrent Pipeline' }),
      ])

      expect(results).toHaveLength(6)
      expect(results[0].$type).toBe('Organization')
      expect(results[1].$type).toBe('Contact')
      expect(results[2].$type).toBe('Lead')
      expect(results[3].$type).toBe('Deal')
      expect(results[4].$type).toBe('Activity')
      expect(results[5].$type).toBe('Pipeline')
    })

    it('concurrent updates to different entities do not interfere', async () => {
      const deal1 = await Deal.create({ name: 'Deal A', value: 100 })
      const deal2 = await Deal.create({ name: 'Deal B', value: 200 })

      const [updated1, updated2] = await Promise.all([
        Deal.update(deal1.$id, { value: 999 }),
        Deal.update(deal2.$id, { value: 888 }),
      ])

      expect(updated1.value).toBe(999)
      expect(updated2.value).toBe(888)
      expect(updated1.$id).not.toBe(updated2.$id)
    })

    it('concurrent find operations across entities', async () => {
      await Organization.create({ name: 'FindOrg', status: 'Active' })
      await Contact.create({ name: 'FindContact', status: 'Active' })
      await Lead.create({ name: 'FindLead', source: 'Web', status: 'New' })

      const [orgs, contacts, leads] = await Promise.all([
        Organization.find({ status: 'Active' }),
        Contact.find({ status: 'Active' }),
        Lead.find({ status: 'New' }),
      ])

      expect(orgs.length).toBeGreaterThanOrEqual(1)
      expect(contacts.length).toBeGreaterThanOrEqual(1)
      expect(leads.length).toBeGreaterThanOrEqual(1)
    })
  })

  // =========================================================================
  // 8. Schema raw definition key-by-key validation
  // =========================================================================
  describe('raw definition key-by-key', () => {
    it('Organization raw has all expected keys', () => {
      const raw = Organization.$schema.raw
      const expectedKeys = [
        'name', 'legalName', 'slug', 'domain', 'website', 'description', 'logo',
        'type', 'status', 'tier', 'source', 'industry', 'naicsCode',
        'employeeCount', 'annualRevenue', 'foundedYear',
        'address', 'city', 'state', 'country', 'postalCode', 'timezone',
        'parent', 'subsidiaries', 'contacts', 'deals', 'subscriptions',
        'lifetimeValue', 'healthScore', 'npsScore', 'linkedinUrl', 'twitterHandle',
      ]
      for (const key of expectedKeys) {
        expect(raw).toHaveProperty(key)
      }
      expect(Object.keys(raw).length).toBe(expectedKeys.length)
    })

    it('Contact raw has all expected keys', () => {
      const raw = Contact.$schema.raw
      const expectedKeys = [
        'name', 'firstName', 'lastName', 'email', 'phone', 'mobile', 'avatar',
        'title', 'department', 'organization', 'role', 'status', 'source',
        'leadScore', 'preferredChannel', 'timezone', 'language',
        'leads', 'activities', 'manager', 'reports',
        'linkedinUrl', 'twitterHandle', 'marketingConsent', 'lastEngagement',
        'qualify',
      ]
      for (const key of expectedKeys) {
        expect(raw).toHaveProperty(key)
      }
      expect(Object.keys(raw).length).toBe(expectedKeys.length)
    })

    it('Lead raw has all expected keys', () => {
      const raw = Lead.$schema.raw
      const expectedKeys = [
        'name', 'contact', 'organization', 'owner', 'status', 'source',
        'sourceDetail', 'campaign', 'score', 'budget', 'authority', 'need',
        'timeline', 'deal', 'convertedAt', 'lostReason', 'lostAt',
        'firstTouchAt', 'lastActivityAt', 'convert', 'lose',
      ]
      for (const key of expectedKeys) {
        expect(raw).toHaveProperty(key)
      }
      expect(Object.keys(raw).length).toBe(expectedKeys.length)
    })

    it('Deal raw has all expected keys', () => {
      const raw = Deal.$schema.raw
      const expectedKeys = [
        'name', 'organization', 'contact', 'owner', 'value', 'currency',
        'recurringValue', 'recurringInterval', 'stage', 'probability',
        'expectedCloseDate', 'actualCloseDate', 'description', 'nextStep',
        'competitorNotes', 'lostReason', 'wonReason', 'leads', 'source',
        'campaign', 'activities', 'lastActivityAt', 'close', 'win', 'lose',
      ]
      for (const key of expectedKeys) {
        expect(raw).toHaveProperty(key)
      }
      expect(Object.keys(raw).length).toBe(expectedKeys.length)
    })

    it('Activity raw has all expected keys', () => {
      const raw = Activity.$schema.raw
      const expectedKeys = [
        'subject', 'type', 'description', 'deal', 'contact', 'organization',
        'campaign', 'assignee', 'createdBy', 'dueAt', 'startAt', 'endAt',
        'duration', 'allDay', 'timezone', 'status', 'priority', 'completedAt',
        'outcome', 'recordingUrl', 'meetingLink', 'reminderAt', 'complete', 'cancel',
      ]
      for (const key of expectedKeys) {
        expect(raw).toHaveProperty(key)
      }
      expect(Object.keys(raw).length).toBe(expectedKeys.length)
    })

    it('Pipeline raw has all expected keys', () => {
      const raw = Pipeline.$schema.raw
      const expectedKeys = ['name', 'slug', 'description', 'isDefault', 'stages', 'dealRotting']
      for (const key of expectedKeys) {
        expect(raw).toHaveProperty(key)
      }
      expect(Object.keys(raw).length).toBe(expectedKeys.length)
    })

    it('Organization raw relationship strings are preserved verbatim', () => {
      const raw = Organization.$schema.raw
      expect(raw.subsidiaries).toBe('<- Organization.parent[]')
      expect(raw.contacts).toBe('<- Contact.organization[]')
      expect(raw.deals).toBe('<- Deal.organization[]')
      expect(raw.subscriptions).toBe('<- Subscription.organization[]')
    })

    it('Contact raw relationship strings are preserved verbatim', () => {
      const raw = Contact.$schema.raw
      expect(raw.organization).toBe('-> Organization.contacts')
      expect(raw.leads).toBe('<- Lead.contact[]')
      expect(raw.activities).toBe('<- Activity.contact[]')
      expect(raw.manager).toBe('-> Contact.reports')
      expect(raw.reports).toBe('<- Contact.manager[]')
    })

    it('Lead raw preserves verb target values', () => {
      const raw = Lead.$schema.raw
      expect(raw.convert).toBe('Converted')
      expect(raw.lose).toBe('Lost')
    })

    it('Activity raw preserves verb target values', () => {
      const raw = Activity.$schema.raw
      expect(raw.complete).toBe('Completed')
      expect(raw.cancel).toBe('Cancelled')
    })
  })

  // =========================================================================
  // 9. Bulk CRUD operations
  // =========================================================================
  describe('bulk CRUD operations', () => {
    it('can create 50 contacts and find them all', async () => {
      for (let i = 0; i < 50; i++) {
        await Contact.create({ name: `Bulk Contact ${i}`, status: 'Active' })
      }
      const all = await Contact.find({ status: 'Active' })
      expect(all.length).toBe(50)
    })

    it('can create and update multiple deals in sequence', async () => {
      const deals = []
      for (let i = 0; i < 10; i++) {
        deals.push(await Deal.create({ name: `Bulk Deal ${i}`, value: i * 1000 }))
      }
      for (const deal of deals) {
        await Deal.update(deal.$id, { value: (deal.value as number) + 500 })
      }
      const all = await Deal.find()
      expect(all.length).toBe(10)
      for (const deal of all) {
        expect((deal.value as number) % 500).toBe(0)
        expect(deal.$version).toBe(2)
      }
    })

    it('can create and delete multiple leads', async () => {
      const leads = []
      for (let i = 0; i < 5; i++) {
        leads.push(await Lead.create({ name: `Bulk Lead ${i}`, source: 'Bulk' }))
      }
      for (const lead of leads) {
        const result = await Lead.delete(lead.$id)
        expect(result).toBe(true)
      }
      const remaining = await Lead.find()
      expect(remaining.length).toBe(0)
    })
  })

  // =========================================================================
  // 10. Pipeline stage management patterns
  // =========================================================================
  describe('pipeline stage management', () => {
    it('can create a pipeline with stages as a serialized string', async () => {
      const pipeline = await Pipeline.create({
        name: 'Sales Pipeline',
        stages: 'Prospecting,Qualification,Proposal,Negotiation,ClosedWon,ClosedLost',
      })
      expect(pipeline.stages).toBe('Prospecting,Qualification,Proposal,Negotiation,ClosedWon,ClosedLost')
    })

    it('can update pipeline stages', async () => {
      const pipeline = await Pipeline.create({
        name: 'Custom Pipeline',
        stages: 'Step1,Step2',
      })
      const updated = await Pipeline.update(pipeline.$id, {
        stages: 'Step1,Step2,Step3',
      })
      expect(updated.stages).toBe('Step1,Step2,Step3')
    })

    it('can set dealRotting threshold on pipeline', async () => {
      const pipeline = await Pipeline.create({
        name: 'Rotting Pipeline',
        dealRotting: 30,
      })
      expect(pipeline.dealRotting).toBe(30)
      const updated = await Pipeline.update(pipeline.$id, { dealRotting: 14 })
      expect(updated.dealRotting).toBe(14)
    })

    it('can manage multiple pipelines independently', async () => {
      const p1 = await Pipeline.create({ name: 'Sales', slug: 'sales' })
      const p2 = await Pipeline.create({ name: 'Enterprise', slug: 'enterprise' })

      expect(p1.$id).not.toBe(p2.$id)
      expect(p1.slug).toBe('sales')
      expect(p2.slug).toBe('enterprise')
    })
  })

  // =========================================================================
  // 11. Activity logging patterns
  // =========================================================================
  describe('activity logging patterns', () => {
    it('can log a call activity with full details', async () => {
      const activity = await Activity.create({
        subject: 'Discovery Call with Acme',
        type: 'Call',
        description: 'Discussed product needs',
        duration: 30,
        status: 'Completed',
        outcome: 'Positive interest',
      })
      expect(activity.type).toBe('Call')
      expect(activity.duration).toBe(30)
      expect(activity.status).toBe('Completed')
      expect(activity.outcome).toBe('Positive interest')
    })

    it('can log a meeting activity with time range', async () => {
      const activity = await Activity.create({
        subject: 'Product Demo',
        type: 'Meeting',
        startAt: '2025-06-01T14:00:00Z',
        endAt: '2025-06-01T15:00:00Z',
        meetingLink: 'https://meet.google.com/abc-defg-hij',
        status: 'Pending',
      })
      expect(activity.startAt).toBe('2025-06-01T14:00:00Z')
      expect(activity.endAt).toBe('2025-06-01T15:00:00Z')
      expect(activity.meetingLink).toBe('https://meet.google.com/abc-defg-hij')
    })

    it('can create follow-up activity with reminder', async () => {
      const activity = await Activity.create({
        subject: 'Follow up on proposal',
        type: 'FollowUp',
        dueAt: '2025-07-01T09:00:00Z',
        reminderAt: '2025-06-30T09:00:00Z',
        priority: 'High',
        status: 'Pending',
      })
      expect(activity.type).toBe('FollowUp')
      expect(activity.priority).toBe('High')
      expect(activity.reminderAt).toBe('2025-06-30T09:00:00Z')
    })

    it('can complete an activity and verify status transition', async () => {
      const activity = await Activity.create({
        subject: 'Send proposal',
        type: 'Task',
        status: 'Pending',
        priority: 'Medium',
      })
      const completed = await (Activity as any).complete(activity.$id)
      expect(completed.status).toBe('Completed')
    })

    it('can cancel an activity and verify status transition', async () => {
      const activity = await Activity.create({
        subject: 'Cancelled meeting',
        type: 'Meeting',
        status: 'Pending',
      })
      const cancelled = await (Activity as any).cancel(activity.$id)
      expect(cancelled.status).toBe('Cancelled')
    })
  })

  // =========================================================================
  // 12. MongoDB-style query operators
  // =========================================================================
  describe('MongoDB-style query operators', () => {
    it('find with $gt filters deals by value', async () => {
      await Deal.create({ name: 'Small Deal', value: 1000 })
      await Deal.create({ name: 'Medium Deal', value: 5000 })
      await Deal.create({ name: 'Large Deal', value: 50000 })

      const large = await Deal.find({ value: { $gt: 10000 } })
      expect(large.length).toBe(1)
      expect(large[0].name).toBe('Large Deal')
    })

    it('find with $gte includes boundary value', async () => {
      await Deal.create({ name: 'Exact Deal', value: 5000 })
      await Deal.create({ name: 'Above Deal', value: 6000 })
      await Deal.create({ name: 'Below Deal', value: 4000 })

      const results = await Deal.find({ value: { $gte: 5000 } })
      expect(results.length).toBe(2)
    })

    it('find with $lt filters lower values', async () => {
      await Deal.create({ name: 'Low', value: 100 })
      await Deal.create({ name: 'High', value: 9000 })

      const low = await Deal.find({ value: { $lt: 500 } })
      expect(low.length).toBe(1)
      expect(low[0].name).toBe('Low')
    })

    it('find with $in filters by set of values', async () => {
      await Contact.create({ name: 'Alice', role: 'Champion' })
      await Contact.create({ name: 'Bob', role: 'Blocker' })
      await Contact.create({ name: 'Carol', role: 'User' })

      const results = await Contact.find({ role: { $in: ['Champion', 'Blocker'] } })
      expect(results.length).toBe(2)
    })

    it('find with $ne excludes matching value', async () => {
      await Organization.create({ name: 'Active Org', status: 'Active' })
      await Organization.create({ name: 'Inactive Org', status: 'Inactive' })
      await Organization.create({ name: 'Another Active', status: 'Active' })

      const nonActive = await Organization.find({ status: { $ne: 'Active' } })
      expect(nonActive.length).toBe(1)
      expect(nonActive[0].status).toBe('Inactive')
    })
  })
})
