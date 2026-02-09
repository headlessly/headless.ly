import { describe, it, expect } from 'vitest'
import { getNounSchema, clearRegistry, setProvider, MemoryNounProvider } from 'digital-objects'
import { Organization, Contact, Lead, Deal, Activity, Pipeline } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/crm — deep tests', () => {
  setupTestProvider()

  // =========================================================================
  // 1. Schema structure — every entity registers a NounSchema
  // =========================================================================
  describe('schema registration', () => {
    it('Organization schema is registered in the global registry', () => {
      const schema = Organization.$schema
      expect(schema).toBeDefined()
      expect(schema.name).toBe('Organization')
    })

    it('Contact schema is registered in the global registry', () => {
      const schema = Contact.$schema
      expect(schema).toBeDefined()
      expect(schema.name).toBe('Contact')
    })

    it('Lead schema is registered in the global registry', () => {
      const schema = Lead.$schema
      expect(schema).toBeDefined()
      expect(schema.name).toBe('Lead')
    })

    it('Deal schema is registered in the global registry', () => {
      const schema = Deal.$schema
      expect(schema).toBeDefined()
      expect(schema.name).toBe('Deal')
    })

    it('Activity schema is registered in the global registry', () => {
      const schema = Activity.$schema
      expect(schema).toBeDefined()
      expect(schema.name).toBe('Activity')
    })

    it('Pipeline schema is registered in the global registry', () => {
      const schema = Pipeline.$schema
      expect(schema).toBeDefined()
      expect(schema.name).toBe('Pipeline')
    })
  })

  // =========================================================================
  // 2. Linguistic derivation — singular, plural, slug
  // =========================================================================
  describe('linguistic derivation', () => {
    it('Organization derives correct singular/plural/slug', () => {
      const s = Organization.$schema
      expect(s.singular).toBe('organization')
      expect(s.plural).toBe('organizations')
      expect(s.slug).toBe('organization')
    })

    it('Contact derives correct singular/plural/slug', () => {
      const s = Contact.$schema
      expect(s.singular).toBe('contact')
      expect(s.plural).toBe('contacts')
      expect(s.slug).toBe('contact')
    })

    it('Lead derives correct singular/plural/slug', () => {
      const s = Lead.$schema
      expect(s.singular).toBe('lead')
      expect(s.plural).toBe('leads')
      expect(s.slug).toBe('lead')
    })

    it('Deal derives correct singular/plural/slug', () => {
      const s = Deal.$schema
      expect(s.singular).toBe('deal')
      expect(s.plural).toBe('deals')
      expect(s.slug).toBe('deal')
    })

    it('Activity derives correct singular/plural/slug', () => {
      const s = Activity.$schema
      expect(s.singular).toBe('activity')
      expect(s.plural).toBe('activities')
      expect(s.slug).toBe('activity')
    })

    it('Pipeline derives correct singular/plural/slug', () => {
      const s = Pipeline.$schema
      expect(s.singular).toBe('pipeline')
      expect(s.plural).toBe('pipelines')
      expect(s.slug).toBe('pipeline')
    })
  })

  // =========================================================================
  // 3. Field parsing — required, optional, indexed, unique
  // =========================================================================
  describe('field parsing', () => {
    it('Organization.name is a required string field', () => {
      const field = Organization.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('Organization.slug is a unique-indexed string (##)', () => {
      const field = Organization.$schema.fields.get('slug')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.unique).toBe(true)
      expect(field!.modifiers?.indexed).toBe(true)
    })

    it('Organization.domain is unique-indexed (##)', () => {
      const field = Organization.$schema.fields.get('domain')
      expect(field).toBeDefined()
      expect(field!.modifiers?.unique).toBe(true)
      expect(field!.modifiers?.indexed).toBe(true)
    })

    it('Organization.website is a plain optional string', () => {
      const field = Organization.$schema.fields.get('website')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
      expect(field!.modifiers?.optional).toBe(false)
    })

    it('Contact.email is unique-indexed (##)', () => {
      const field = Contact.$schema.fields.get('email')
      expect(field).toBeDefined()
      expect(field!.modifiers?.unique).toBe(true)
      expect(field!.modifiers?.indexed).toBe(true)
    })

    it('Contact.name is required', () => {
      const field = Contact.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.modifiers?.required).toBe(true)
    })

    it('Deal.value is a required number', () => {
      const field = Deal.$schema.fields.get('value')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('number')
      expect(field!.modifiers?.required).toBe(true)
    })

    it('Lead.source is a required string', () => {
      const field = Lead.$schema.fields.get('source')
      expect(field).toBeDefined()
      expect(field!.modifiers?.required).toBe(true)
      expect(field!.type).toBe('string')
    })

    it('Activity.subject is required', () => {
      const field = Activity.$schema.fields.get('subject')
      expect(field).toBeDefined()
      expect(field!.modifiers?.required).toBe(true)
    })

    it('Pipeline.name is required', () => {
      const field = Pipeline.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.modifiers?.required).toBe(true)
    })

    it('Organization.employeeCount is a number field', () => {
      const field = Organization.$schema.fields.get('employeeCount')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('Organization.annualRevenue is a number field', () => {
      const field = Organization.$schema.fields.get('annualRevenue')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('Contact.lastEngagement is a datetime field', () => {
      const field = Contact.$schema.fields.get('lastEngagement')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })

    it('Deal.expectedCloseDate is a date field', () => {
      const field = Deal.$schema.fields.get('expectedCloseDate')
      expect(field).toBeDefined()
      expect(field!.type).toBe('date')
    })

    it('Lead.convertedAt is a datetime field', () => {
      const field = Lead.$schema.fields.get('convertedAt')
      expect(field).toBeDefined()
      expect(field!.type).toBe('datetime')
    })

    it('Activity.duration is a number field', () => {
      const field = Activity.$schema.fields.get('duration')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })

    it('Pipeline.dealRotting is a number field', () => {
      const field = Pipeline.$schema.fields.get('dealRotting')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
    })
  })

  // =========================================================================
  // 4. Enum field parsing
  // =========================================================================
  describe('enum fields', () => {
    it('Organization.type has correct enum values', () => {
      const field = Organization.$schema.fields.get('type')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Prospect', 'Customer', 'Partner', 'Vendor', 'Competitor'])
    })

    it('Organization.status has correct enum values', () => {
      const field = Organization.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Active', 'Inactive', 'Churned', 'Archived'])
    })

    it('Organization.tier has correct enum values', () => {
      const field = Organization.$schema.fields.get('tier')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Enterprise', 'Business', 'Startup', 'SMB'])
    })

    it('Contact.role has correct enum values', () => {
      const field = Contact.$schema.fields.get('role')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['DecisionMaker', 'Influencer', 'Champion', 'Blocker', 'User'])
    })

    it('Contact.status has correct enum values', () => {
      const field = Contact.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Active', 'Inactive', 'Bounced', 'Unsubscribed'])
    })

    it('Contact.preferredChannel has correct enum values', () => {
      const field = Contact.$schema.fields.get('preferredChannel')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Email', 'Phone', 'SMS', 'Chat'])
    })

    it('Lead.status has correct enum values', () => {
      const field = Lead.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['New', 'Contacted', 'Qualified', 'Converted', 'Lost'])
    })

    it('Deal.stage has correct enum values', () => {
      const field = Deal.$schema.fields.get('stage')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'ClosedWon', 'ClosedLost'])
    })

    it('Deal.recurringInterval has correct enum values', () => {
      const field = Deal.$schema.fields.get('recurringInterval')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Monthly', 'Quarterly', 'Yearly'])
    })

    it('Activity.type enum has all activity types', () => {
      const field = Activity.$schema.fields.get('type')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Call', 'Email', 'Meeting', 'Task', 'Note', 'Demo', 'FollowUp'])
    })

    it('Activity.status has correct enum values', () => {
      const field = Activity.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Pending', 'InProgress', 'Completed', 'Cancelled'])
    })

    it('Activity.priority has correct enum values', () => {
      const field = Activity.$schema.fields.get('priority')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Low', 'Medium', 'High', 'Urgent'])
    })
  })

  // =========================================================================
  // 5. Relationship parsing — forward (->), back-reference (<-)
  // =========================================================================
  describe('relationships', () => {
    // Organization relationships
    it('Organization.parent is a forward reference to Organization.subsidiaries', () => {
      const rel = Organization.$schema.relationships.get('parent')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
      expect(rel!.backref).toBe('subsidiaries')
    })

    it('Organization.subsidiaries is a back-reference from Organization.parent (array)', () => {
      const rel = Organization.$schema.relationships.get('subsidiaries')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.operator).toBe('<-')
      expect(rel!.targetType).toBe('Organization')
      expect(rel!.backref).toBe('parent')
      expect(rel!.isArray).toBe(true)
    })

    it('Organization.contacts is a back-reference from Contact.organization (array)', () => {
      const rel = Organization.$schema.relationships.get('contacts')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.operator).toBe('<-')
      expect(rel!.targetType).toBe('Contact')
      expect(rel!.backref).toBe('organization')
      expect(rel!.isArray).toBe(true)
    })

    it('Organization.deals is a back-reference from Deal.organization (array)', () => {
      const rel = Organization.$schema.relationships.get('deals')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('<-')
      expect(rel!.targetType).toBe('Deal')
      expect(rel!.backref).toBe('organization')
      expect(rel!.isArray).toBe(true)
    })

    it('Organization.subscriptions is a back-reference from Subscription', () => {
      const rel = Organization.$schema.relationships.get('subscriptions')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('<-')
      expect(rel!.targetType).toBe('Subscription')
      expect(rel!.backref).toBe('organization')
      expect(rel!.isArray).toBe(true)
    })

    // Contact relationships
    it('Contact.organization is a forward reference to Organization.contacts', () => {
      const rel = Contact.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
      expect(rel!.backref).toBe('contacts')
    })

    it('Contact.leads is a back-reference from Lead.contact (array)', () => {
      const rel = Contact.$schema.relationships.get('leads')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('<-')
      expect(rel!.targetType).toBe('Lead')
      expect(rel!.backref).toBe('contact')
      expect(rel!.isArray).toBe(true)
    })

    it('Contact.activities is a back-reference from Activity.contact (array)', () => {
      const rel = Contact.$schema.relationships.get('activities')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('<-')
      expect(rel!.targetType).toBe('Activity')
      expect(rel!.backref).toBe('contact')
      expect(rel!.isArray).toBe(true)
    })

    it('Contact.manager is a self-referencing forward reference', () => {
      const rel = Contact.$schema.relationships.get('manager')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Contact')
      expect(rel!.backref).toBe('reports')
    })

    it('Contact.reports is a self-referencing back-reference (array)', () => {
      const rel = Contact.$schema.relationships.get('reports')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('<-')
      expect(rel!.targetType).toBe('Contact')
      expect(rel!.backref).toBe('manager')
      expect(rel!.isArray).toBe(true)
    })

    // Lead relationships
    it('Lead.contact is a forward reference to Contact.leads', () => {
      const rel = Lead.$schema.relationships.get('contact')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Contact')
      expect(rel!.backref).toBe('leads')
    })

    it('Lead.organization is a forward reference to Organization (no backref)', () => {
      const rel = Lead.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
      expect(rel!.backref).toBeUndefined()
    })

    it('Lead.owner is a forward reference to Contact (no backref)', () => {
      const rel = Lead.$schema.relationships.get('owner')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Contact')
      expect(rel!.backref).toBeUndefined()
    })

    it('Lead.campaign is a forward reference to Campaign.leads', () => {
      const rel = Lead.$schema.relationships.get('campaign')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Campaign')
      expect(rel!.backref).toBe('leads')
    })

    it('Lead.deal is a forward reference to Deal.leads', () => {
      const rel = Lead.$schema.relationships.get('deal')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Deal')
      expect(rel!.backref).toBe('leads')
    })

    // Deal relationships
    it('Deal.organization is a forward reference to Organization.deals', () => {
      const rel = Deal.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
      expect(rel!.backref).toBe('deals')
    })

    it('Deal.contact is a forward reference to Contact (no backref)', () => {
      const rel = Deal.$schema.relationships.get('contact')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Contact')
      expect(rel!.backref).toBeUndefined()
    })

    it('Deal.leads is a back-reference from Lead.deal (array)', () => {
      const rel = Deal.$schema.relationships.get('leads')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('<-')
      expect(rel!.targetType).toBe('Lead')
      expect(rel!.backref).toBe('deal')
      expect(rel!.isArray).toBe(true)
    })

    it('Deal.activities is a back-reference from Activity.deal (array)', () => {
      const rel = Deal.$schema.relationships.get('activities')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('<-')
      expect(rel!.targetType).toBe('Activity')
      expect(rel!.backref).toBe('deal')
      expect(rel!.isArray).toBe(true)
    })

    it('Deal.campaign is a forward reference to Campaign (no backref)', () => {
      const rel = Deal.$schema.relationships.get('campaign')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Campaign')
      expect(rel!.backref).toBeUndefined()
    })

    // Activity relationships
    it('Activity.deal is a forward reference to Deal.activities', () => {
      const rel = Activity.$schema.relationships.get('deal')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Deal')
      expect(rel!.backref).toBe('activities')
    })

    it('Activity.contact is a forward reference to Contact.activities', () => {
      const rel = Activity.$schema.relationships.get('contact')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Contact')
      expect(rel!.backref).toBe('activities')
    })

    it('Activity.organization is a forward reference to Organization (no backref)', () => {
      const rel = Activity.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
      expect(rel!.backref).toBeUndefined()
    })

    it('Activity.assignee is a forward reference to Contact (no backref)', () => {
      const rel = Activity.$schema.relationships.get('assignee')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Contact')
      expect(rel!.backref).toBeUndefined()
    })

    it('Activity.createdBy is a forward reference to Contact (no backref)', () => {
      const rel = Activity.$schema.relationships.get('createdBy')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Contact')
      expect(rel!.backref).toBeUndefined()
    })

    it('Activity.campaign is a forward reference to Campaign (no backref)', () => {
      const rel = Activity.$schema.relationships.get('campaign')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Campaign')
      expect(rel!.backref).toBeUndefined()
    })
  })

  // =========================================================================
  // 6. Verb declarations and conjugation
  // =========================================================================
  describe('verb schemas', () => {
    it('Organization has no custom verbs (only CRUD)', () => {
      const schema = Organization.$schema
      // CRUD verbs: create, update, delete
      expect(schema.verbs.has('create')).toBe(true)
      expect(schema.verbs.has('update')).toBe(true)
      expect(schema.verbs.has('delete')).toBe(true)
      // No custom verbs
      expect(schema.verbs.size).toBe(3)
    })

    it('Contact has qualify custom verb + CRUD', () => {
      const schema = Contact.$schema
      expect(schema.verbs.has('qualify')).toBe(true)
      expect(schema.verbs.size).toBe(4) // create, update, delete, qualify
    })

    it('Lead has convert and lose custom verbs + CRUD', () => {
      const schema = Lead.$schema
      expect(schema.verbs.has('convert')).toBe(true)
      expect(schema.verbs.has('lose')).toBe(true)
      expect(schema.verbs.size).toBe(5) // create, update, delete, convert, lose
    })

    it('Deal has close, win, lose custom verbs + CRUD', () => {
      const schema = Deal.$schema
      expect(schema.verbs.has('close')).toBe(true)
      expect(schema.verbs.has('win')).toBe(true)
      expect(schema.verbs.has('lose')).toBe(true)
      expect(schema.verbs.size).toBe(6) // create, update, delete, close, win, lose
    })

    it('Activity has complete and cancel custom verbs + CRUD', () => {
      const schema = Activity.$schema
      expect(schema.verbs.has('complete')).toBe(true)
      expect(schema.verbs.has('cancel')).toBe(true)
      expect(schema.verbs.size).toBe(5) // create, update, delete, complete, cancel
    })

    it('Pipeline has no custom verbs (only CRUD)', () => {
      const schema = Pipeline.$schema
      expect(schema.verbs.size).toBe(3)
    })
  })

  describe('verb conjugation details', () => {
    it('Contact.qualify conjugation: qualifying / qualified / qualifiedBy / qualifiedAt', () => {
      const verb = Contact.$schema.verbs.get('qualify')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('qualify')
      expect(verb!.activity).toBe('qualifying')
      expect(verb!.event).toBe('qualified')
      expect(verb!.reverseBy).toBe('qualifiedBy')
      expect(verb!.reverseAt).toBe('qualifiedAt')
    })

    it('Lead.convert conjugation: converting / converted / convertedBy / convertedAt', () => {
      const verb = Lead.$schema.verbs.get('convert')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('convert')
      expect(verb!.activity).toBe('converting')
      expect(verb!.event).toBe('converted')
      expect(verb!.reverseBy).toBe('convertedBy')
      expect(verb!.reverseAt).toBe('convertedAt')
    })

    it('Lead.lose conjugation: losing / lost / lostBy / lostAt', () => {
      const verb = Lead.$schema.verbs.get('lose')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('lose')
      expect(verb!.activity).toBe('losing')
      expect(verb!.event).toBe('lost')
      expect(verb!.reverseBy).toBe('lostBy')
      expect(verb!.reverseAt).toBe('lostAt')
    })

    it('Deal.close conjugation: closing / closed / closedBy / closedAt', () => {
      const verb = Deal.$schema.verbs.get('close')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('close')
      expect(verb!.activity).toBe('closing')
      expect(verb!.event).toBe('closed')
      expect(verb!.reverseBy).toBe('closedBy')
      expect(verb!.reverseAt).toBe('closedAt')
    })

    it('Deal.win conjugation: winning / won / wonBy / wonAt', () => {
      const verb = Deal.$schema.verbs.get('win')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('win')
      expect(verb!.activity).toBe('winning')
      expect(verb!.event).toBe('won')
      expect(verb!.reverseBy).toBe('wonBy')
      expect(verb!.reverseAt).toBe('wonAt')
    })

    it('Deal.lose conjugation: losing / lost / lostBy / lostAt', () => {
      const verb = Deal.$schema.verbs.get('lose')
      expect(verb).toBeDefined()
      expect(verb!.event).toBe('lost')
      expect(verb!.activity).toBe('losing')
    })

    it('Activity.complete conjugation: completing / completed / completedBy / completedAt', () => {
      const verb = Activity.$schema.verbs.get('complete')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('complete')
      expect(verb!.activity).toBe('completing')
      expect(verb!.event).toBe('completed')
      expect(verb!.reverseBy).toBe('completedBy')
      expect(verb!.reverseAt).toBe('completedAt')
    })

    it('Activity.cancel conjugation: cancelling / cancelled / cancelledBy / cancelledAt', () => {
      const verb = Activity.$schema.verbs.get('cancel')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('cancel')
      expect(verb!.activity).toBe('cancelling')
      expect(verb!.event).toBe('cancelled')
      expect(verb!.reverseBy).toBe('cancelledBy')
      expect(verb!.reverseAt).toBe('cancelledAt')
    })

    it('CRUD verb create has proper conjugation', () => {
      const verb = Organization.$schema.verbs.get('create')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('create')
      expect(verb!.activity).toBe('creating')
      expect(verb!.event).toBe('created')
      expect(verb!.reverseBy).toBe('createdBy')
      expect(verb!.reverseAt).toBe('createdAt')
    })

    it('CRUD verb update has proper conjugation', () => {
      const verb = Organization.$schema.verbs.get('update')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('update')
      expect(verb!.activity).toBe('updating')
      expect(verb!.event).toBe('updated')
      expect(verb!.reverseBy).toBe('updatedBy')
      expect(verb!.reverseAt).toBe('updatedAt')
    })

    it('CRUD verb delete has proper conjugation', () => {
      const verb = Organization.$schema.verbs.get('delete')
      expect(verb).toBeDefined()
      expect(verb!.action).toBe('delete')
      expect(verb!.activity).toBe('deleting')
      expect(verb!.event).toBe('deleted')
      expect(verb!.reverseBy).toBe('deletedBy')
      expect(verb!.reverseAt).toBe('deletedAt')
    })
  })

  // =========================================================================
  // 7. Proxy verb access — action, activity (BEFORE), event (AFTER)
  // =========================================================================
  describe('proxy verb access', () => {
    it('Contact.qualify is callable (action)', () => {
      expect(typeof Contact.qualify).toBe('function')
    })

    it('Contact.qualifying is callable (BEFORE hook)', () => {
      expect(typeof Contact.qualifying).toBe('function')
    })

    it('Contact.qualified is callable (AFTER hook)', () => {
      expect(typeof Contact.qualified).toBe('function')
    })

    it('Lead.convert / converting / converted all exist', () => {
      expect(typeof Lead.convert).toBe('function')
      expect(typeof Lead.converting).toBe('function')
      expect(typeof Lead.converted).toBe('function')
    })

    it('Lead.lose / losing / lost all exist', () => {
      expect(typeof Lead.lose).toBe('function')
      expect(typeof Lead.losing).toBe('function')
      expect(typeof Lead.lost).toBe('function')
    })

    it('Deal.close / closing / closed all exist', () => {
      expect(typeof Deal.close).toBe('function')
      expect(typeof Deal.closing).toBe('function')
      expect(typeof Deal.closed).toBe('function')
    })

    it('Deal.win / winning / won all exist', () => {
      expect(typeof Deal.win).toBe('function')
      expect(typeof Deal.winning).toBe('function')
      expect(typeof Deal.won).toBe('function')
    })

    it('Deal.lose / losing / lost all exist', () => {
      expect(typeof Deal.lose).toBe('function')
      expect(typeof Deal.losing).toBe('function')
      expect(typeof Deal.lost).toBe('function')
    })

    it('Activity.complete / completing / completed all exist', () => {
      expect(typeof Activity.complete).toBe('function')
      expect(typeof Activity.completing).toBe('function')
      expect(typeof Activity.completed).toBe('function')
    })

    it('Activity.cancel / cancelling / cancelled all exist', () => {
      expect(typeof Activity.cancel).toBe('function')
      expect(typeof Activity.cancelling).toBe('function')
      expect(typeof Activity.cancelled).toBe('function')
    })

    it('CRUD verbs are functions on all entities', () => {
      const entities = [Organization, Contact, Lead, Deal, Activity, Pipeline]
      for (const entity of entities) {
        expect(typeof entity.create).toBe('function')
        expect(typeof entity.get).toBe('function')
        expect(typeof entity.find).toBe('function')
        expect(typeof entity.update).toBe('function')
        expect(typeof entity.delete).toBe('function')
      }
    })

    it('CRUD BEFORE/AFTER hooks exist: creating / created', () => {
      expect(typeof Organization.creating).toBe('function')
      expect(typeof Organization.created).toBe('function')
    })

    it('CRUD BEFORE/AFTER hooks exist: updating / updated', () => {
      expect(typeof Organization.updating).toBe('function')
      expect(typeof Organization.updated).toBe('function')
    })

    it('CRUD BEFORE/AFTER hooks exist: deleting / deleted', () => {
      expect(typeof Organization.deleting).toBe('function')
      expect(typeof Organization.deleted).toBe('function')
    })
  })

  // =========================================================================
  // 8. No disabled verbs — none of the CRM entities disable CRUD
  // =========================================================================
  describe('no disabled verbs', () => {
    it('no entity has disabledVerbs', () => {
      const entities = [Organization, Contact, Lead, Deal, Activity, Pipeline]
      for (const entity of entities) {
        expect(entity.$schema.disabledVerbs.size).toBe(0)
      }
    })
  })

  // =========================================================================
  // 9. Raw definition preserved in schema
  // =========================================================================
  describe('raw definition preserved', () => {
    it('Organization raw definition is accessible', () => {
      const raw = Organization.$schema.raw
      expect(raw).toBeDefined()
      expect(raw.name).toBe('string!')
      expect(raw.domain).toBe('string##')
      expect(raw.parent).toBe('-> Organization.subsidiaries')
    })

    it('Contact raw definition preserves qualify verb', () => {
      const raw = Contact.$schema.raw
      expect(raw.qualify).toBe('Qualified')
    })

    it('Lead raw definition preserves convert and lose verbs', () => {
      const raw = Lead.$schema.raw
      expect(raw.convert).toBe('Converted')
      expect(raw.lose).toBe('Lost')
    })

    it('Deal raw definition preserves close, win, lose verbs', () => {
      const raw = Deal.$schema.raw
      expect(raw.close).toBe('Closed')
      expect(raw.win).toBe('Won')
      expect(raw.lose).toBe('Lost')
    })
  })

  // =========================================================================
  // 10. Runtime behavior — find, hooks, custom verbs
  // =========================================================================
  describe('runtime: find with filters', () => {
    it('find returns empty array when no entities exist', async () => {
      const results = await Organization.find()
      expect(results).toEqual([])
    })

    it('find returns entities matching a filter', async () => {
      await Contact.create({ name: 'Alice', status: 'Active' })
      await Contact.create({ name: 'Bob', status: 'Inactive' })
      await Contact.create({ name: 'Carol', status: 'Active' })

      const active = await Contact.find({ status: 'Active' })
      expect(active.length).toBe(2)
      expect(active.map((c: any) => c.name).sort()).toEqual(['Alice', 'Carol'])
    })

    it('find returns all entities when no filter is provided', async () => {
      await Deal.create({ name: 'Deal A', value: 10000 })
      await Deal.create({ name: 'Deal B', value: 20000 })
      const all = await Deal.find()
      expect(all.length).toBe(2)
    })
  })

  describe('runtime: custom verb execution', () => {
    it('Contact.qualify transitions status to Qualified', async () => {
      const contact = await Contact.create({ name: 'Alice', status: 'Active' })
      const qualified = await (Contact as any).qualify(contact.$id)
      expect(qualified).toBeDefined()
      expect(qualified.$id).toBe(contact.$id)
      // Verb resolve sets the status field to the target value (Qualified)
      expect(qualified.status).toBe('Qualified')
    })

    it('Activity.complete transitions status to Completed', async () => {
      const activity = await Activity.create({ subject: 'Call client', type: 'Call', status: 'Pending' })
      const completed = await (Activity as any).complete(activity.$id)
      expect(completed).toBeDefined()
      expect(completed.status).toBe('Completed')
    })

    it('Activity.cancel transitions status to Cancelled', async () => {
      const activity = await Activity.create({ subject: 'Meeting', type: 'Meeting', status: 'Pending' })
      const cancelled = await (Activity as any).cancel(activity.$id)
      expect(cancelled).toBeDefined()
      expect(cancelled.status).toBe('Cancelled')
    })
  })

  describe('runtime: BEFORE and AFTER hooks', () => {
    it('BEFORE hook (creating) can transform input data', async () => {
      const unsub = (Contact as any).creating((data: Record<string, unknown>) => {
        return { ...data, source: 'auto-enriched' }
      })

      const contact = await Contact.create({ name: 'Alice' })
      expect(contact.source).toBe('auto-enriched')

      unsub()
    })

    it('AFTER hook (created) fires after entity creation', async () => {
      let hookedInstance: any = null
      const unsub = (Contact as any).created((instance: any) => {
        hookedInstance = instance
      })

      const contact = await Contact.create({ name: 'Bob' })
      expect(hookedInstance).toBeDefined()
      expect(hookedInstance.$id).toBe(contact.$id)
      expect(hookedInstance.name).toBe('Bob')

      unsub()
    })

    it('unsubscribe prevents AFTER hook from firing', async () => {
      let callCount = 0
      const unsub = (Deal as any).created(() => {
        callCount++
      })

      await Deal.create({ name: 'Deal 1', value: 100 })
      expect(callCount).toBe(1)

      unsub()

      await Deal.create({ name: 'Deal 2', value: 200 })
      expect(callCount).toBe(1) // not incremented
    })
  })

  // =========================================================================
  // 11. Relationship and field counts
  // =========================================================================
  describe('field and relationship counts', () => {
    it('Organization has correct number of fields and relationships', () => {
      const schema = Organization.$schema
      // Fields: name, legalName, slug, domain, website, description, logo,
      //         type, status, tier, source, industry, naicsCode, employeeCount,
      //         annualRevenue, foundedYear, address, city, state, country,
      //         postalCode, timezone, lifetimeValue, healthScore, npsScore,
      //         linkedinUrl, twitterHandle = 27
      // Relationships: parent, subsidiaries, contacts, deals, subscriptions = 5
      expect(schema.fields.size).toBe(27)
      expect(schema.relationships.size).toBe(5)
    })

    it('Contact has correct number of fields and relationships', () => {
      const schema = Contact.$schema
      // Fields: name, firstName, lastName, email, phone, mobile, avatar, title,
      //         department, role, status, source, leadScore, preferredChannel,
      //         timezone, language, linkedinUrl, twitterHandle, marketingConsent,
      //         lastEngagement = 20
      // Relationships: organization, leads, activities, manager, reports = 5
      expect(schema.fields.size).toBe(20)
      expect(schema.relationships.size).toBe(5)
    })

    it('Lead has correct number of fields and relationships', () => {
      const schema = Lead.$schema
      // Fields: name, status, source, sourceDetail, score, budget, authority,
      //         need, timeline, convertedAt, lostReason, lostAt, firstTouchAt,
      //         lastActivityAt = 14
      // Relationships: contact, organization, owner, campaign, deal = 5
      expect(schema.fields.size).toBe(14)
      expect(schema.relationships.size).toBe(5)
    })

    it('Deal has correct number of fields and relationships', () => {
      const schema = Deal.$schema
      // Fields: name, value, currency, recurringValue, recurringInterval, stage,
      //         probability, expectedCloseDate, actualCloseDate, description,
      //         nextStep, competitorNotes, lostReason, wonReason, source,
      //         lastActivityAt = 16
      // Relationships: organization, contact, owner, leads, campaign, activities = 6
      expect(schema.fields.size).toBe(16)
      expect(schema.relationships.size).toBe(6)
    })

    it('Activity has correct number of fields and relationships', () => {
      const schema = Activity.$schema
      // Fields: subject, type, description, dueAt, startAt, endAt, duration,
      //         allDay, timezone, status, priority, completedAt, outcome,
      //         recordingUrl, meetingLink, reminderAt = 16
      // Relationships: deal, contact, organization, campaign, assignee, createdBy = 6
      expect(schema.fields.size).toBe(16)
      expect(schema.relationships.size).toBe(6)
    })

    it('Pipeline has correct number of fields and relationships', () => {
      const schema = Pipeline.$schema
      // Fields: name, slug, description, isDefault, stages, dealRotting = 6
      // Relationships: none
      expect(schema.fields.size).toBe(6)
      expect(schema.relationships.size).toBe(0)
    })
  })

  // =========================================================================
  // 12. Entity ID format
  // =========================================================================
  describe('entity ID format', () => {
    it('Organization IDs follow the pattern organization_<8-char sqid>', async () => {
      const org = await Organization.create({ name: 'Test Corp' })
      expect(org.$id).toMatch(/^organization_[a-zA-Z0-9]{8}$/)
    })

    it('Contact IDs follow the pattern contact_<8-char sqid>', async () => {
      const contact = await Contact.create({ name: 'Test User' })
      expect(contact.$id).toMatch(/^contact_[a-zA-Z0-9]{8}$/)
    })

    it('Lead IDs follow the pattern lead_<8-char sqid>', async () => {
      const lead = await Lead.create({ name: 'Test Lead', source: 'Web' })
      expect(lead.$id).toMatch(/^lead_[a-zA-Z0-9]{8}$/)
    })

    it('Deal IDs follow the pattern deal_<8-char sqid>', async () => {
      const deal = await Deal.create({ name: 'Test Deal', value: 5000 })
      expect(deal.$id).toMatch(/^deal_[a-zA-Z0-9]{8}$/)
    })

    it('Activity IDs follow the pattern activity_<8-char sqid>', async () => {
      const activity = await Activity.create({ subject: 'Test Activity', type: 'Call' })
      expect(activity.$id).toMatch(/^activity_[a-zA-Z0-9]{8}$/)
    })

    it('Pipeline IDs follow the pattern pipeline_<8-char sqid>', async () => {
      const pipeline = await Pipeline.create({ name: 'Test Pipeline' })
      expect(pipeline.$id).toMatch(/^pipeline_[a-zA-Z0-9]{8}$/)
    })

    it('every created entity gets a unique ID', async () => {
      const ids = new Set<string>()
      for (let i = 0; i < 20; i++) {
        const c = await Contact.create({ name: `Contact ${i}` })
        ids.add(c.$id)
      }
      expect(ids.size).toBe(20)
    })
  })

  // =========================================================================
  // 13. Meta-fields on created entities
  // =========================================================================
  describe('meta-fields', () => {
    it('$type matches the entity type', async () => {
      const org = await Organization.create({ name: 'Acme' })
      expect(org.$type).toBe('Organization')
    })

    it('$version starts at 1', async () => {
      const contact = await Contact.create({ name: 'Alice' })
      expect(contact.$version).toBe(1)
    })

    it('$version increments on update', async () => {
      const deal = await Deal.create({ name: 'Big Deal', value: 100000 })
      expect(deal.$version).toBe(1)
      const updated = await Deal.update(deal.$id, { value: 200000 })
      expect(updated.$version).toBe(2)
      const updated2 = await Deal.update(deal.$id, { value: 300000 })
      expect(updated2.$version).toBe(3)
    })

    it('$context is set to a tenant URL', async () => {
      const lead = await Lead.create({ name: 'Lead', source: 'Test' })
      expect(lead.$context).toMatch(/^https:\/\/headless\.ly\/~/)
    })

    it('$createdAt is an ISO datetime string', async () => {
      const activity = await Activity.create({ subject: 'Test', type: 'Call' })
      expect(activity.$createdAt).toBeDefined()
      expect(new Date(activity.$createdAt).toISOString()).toBe(activity.$createdAt)
    })

    it('$updatedAt equals $createdAt on new entity', async () => {
      const pipeline = await Pipeline.create({ name: 'Default' })
      expect(pipeline.$createdAt).toBe(pipeline.$updatedAt)
    })

    it('$updatedAt changes on update', async () => {
      const org = await Organization.create({ name: 'Acme' })
      // Introduce a small delay to ensure timestamps differ
      await new Promise((r) => setTimeout(r, 5))
      const updated = await Organization.update(org.$id, { name: 'Acme Inc' })
      expect(updated.$updatedAt).not.toBe(org.$createdAt)
    })
  })

  // =========================================================================
  // 14. Delete behavior
  // =========================================================================
  describe('delete behavior', () => {
    it('deleting a non-existent entity returns false', async () => {
      const result = await Organization.delete('organization_ZZZZZZZZ')
      expect(result).toBe(false)
    })

    it('deleting an existing entity returns true', async () => {
      const contact = await Contact.create({ name: 'To Delete' })
      const result = await Contact.delete(contact.$id)
      expect(result).toBe(true)
    })

    it('get returns null after deletion', async () => {
      const deal = await Deal.create({ name: 'Ephemeral', value: 1 })
      await Deal.delete(deal.$id)
      const found = await Deal.get(deal.$id)
      expect(found).toBeNull()
    })
  })

  // =========================================================================
  // 15. Update preserves immutable meta-fields
  // =========================================================================
  describe('update preserves meta-fields', () => {
    it('update does not change $id', async () => {
      const org = await Organization.create({ name: 'Original' })
      const updated = await Organization.update(org.$id, { name: 'Updated' })
      expect(updated.$id).toBe(org.$id)
    })

    it('update does not change $type', async () => {
      const contact = await Contact.create({ name: 'Alice' })
      const updated = await Contact.update(contact.$id, { name: 'Alice B' })
      expect(updated.$type).toBe('Contact')
    })

    it('update does not change $context', async () => {
      const lead = await Lead.create({ name: 'Lead', source: 'Web' })
      const updated = await Lead.update(lead.$id, { source: 'Referral' })
      expect(updated.$context).toBe(lead.$context)
    })

    it('update does not change $createdAt', async () => {
      const deal = await Deal.create({ name: 'Deal', value: 1000 })
      await new Promise((r) => setTimeout(r, 5))
      const updated = await Deal.update(deal.$id, { value: 2000 })
      expect(updated.$createdAt).toBe(deal.$createdAt)
    })
  })
})
