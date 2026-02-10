/**
 * Cross-domain entity integration tests
 *
 * Verifies that entities from different @headlessly/* packages work together:
 * cross-domain CRUD, entity registry completeness, verb hook chains,
 * domain namespace isolation, mixed-domain queries, and relationship strings.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import {
  $,
  crm,
  billing,
  projects,
  content,
  support,
  analytics,
  marketing,
  experiments,
  platform,
  entityNames,
  resolveEntity,
} from '../src/index'
import type { NounSchema } from 'digital-objects'

describe('@headlessly/sdk — cross-domain integration', () => {
  beforeEach(() => {
    clearRegistry()
    setProvider(new MemoryNounProvider())
  })

  // ===========================================================================
  // 1. Cross-domain CRUD
  // ===========================================================================
  describe('cross-domain CRUD', () => {
    it('Organization (CRM) -> Customer (Billing) reference chain', async () => {
      const org = await $.Organization.create({ name: 'Acme Corp', type: 'Customer' })
      const contact = await $.Contact.create({ name: 'Alice', organization: org.$id })
      const customer = await $.Customer.create({ name: 'Acme Corp', email: 'billing@acme.co', organization: org.$id })

      // Both contact and customer resolve to the same organization
      const contactOrg = await $.Organization.get(contact.organization as string)
      const customerOrg = await $.Organization.get(customer.organization as string)
      expect(contactOrg).toBeDefined()
      expect(contactOrg.$id).toBe(customerOrg.$id)
    })

    it('Contact (CRM) -> Deal (CRM) -> Subscription (Billing) chain', async () => {
      const contact = await $.Contact.create({ name: 'Bob', email: 'bob@test.io' })
      const deal = await $.Deal.create({
        name: 'Enterprise License',
        value: 120000,
        contact: contact.$id,
        stage: 'ClosedWon',
      })
      const customer = await $.Customer.create({
        name: 'Bob',
        email: 'bob@test.io',
        organization: contact.organization as string,
      })
      const subscription = await $.Subscription.create({
        status: 'Active',
        customer: customer.$id,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        startedAt: new Date().toISOString(),
      })

      // Verify the full chain: Contact -> Deal, Customer -> Subscription
      expect(deal.contact).toBe(contact.$id)
      expect(subscription.customer).toBe(customer.$id)
      expect(subscription.$type).toBe('Subscription')
      expect(deal.$type).toBe('Deal')
    })

    it('Project (Projects) -> Issues -> Comments chain', async () => {
      const project = await $.Project.create({ name: 'SDK Rewrite', status: 'Active' })
      const issue1 = await $.Issue.create({
        title: 'Refactor core',
        project: project.$id,
        status: 'Open',
        type: 'Feature',
      })
      const issue2 = await $.Issue.create({
        title: 'Add tests',
        project: project.$id,
        status: 'Open',
        type: 'Task',
      })
      const comment = await $.Comment.create({
        body: 'Working on this now',
        issue: issue1.$id,
      })

      expect(issue1.project).toBe(project.$id)
      expect(issue2.project).toBe(project.$id)
      expect(comment.issue).toBe(issue1.$id)

      // All issues for this project
      const projectIssues = await $.Issue.find({ project: project.$id })
      expect(projectIssues.length).toBe(2)

      // Comments on the first issue
      const issueComments = await $.Comment.find({ issue: issue1.$id })
      expect(issueComments.length).toBe(1)
    })

    it('Content (Content) -> Author (CRM Contact) -> Site (Content)', async () => {
      const author = await $.Contact.create({ name: 'Writer Jane', email: 'jane@blog.co' })
      const site = await $.Site.create({ name: 'Engineering Blog', status: 'Published' })
      const article = await $.Content.create({
        title: 'Building Agent-First Systems',
        type: 'Article',
        status: 'Published',
        author: author.$id,
        site: site.$id,
      })

      expect(article.author).toBe(author.$id)
      expect(article.site).toBe(site.$id)

      const resolvedAuthor = await $.Contact.get(article.author as string)
      expect(resolvedAuthor).toBeDefined()
      expect(resolvedAuthor.name).toBe('Writer Jane')
    })

    it('Ticket (Support) references Organization (CRM) and Contact (CRM)', async () => {
      const org = await $.Organization.create({ name: 'SupportCo' })
      const requester = await $.Contact.create({ name: 'Frustrated User', organization: org.$id })
      const assignee = await $.Contact.create({ name: 'Support Agent', organization: org.$id })
      const ticket = await $.Ticket.create({
        subject: 'Cannot access dashboard',
        status: 'Open',
        priority: 'High',
        requester: requester.$id,
        assignee: assignee.$id,
        organization: org.$id,
      })

      expect(ticket.requester).toBe(requester.$id)
      expect(ticket.assignee).toBe(assignee.$id)
      expect(ticket.organization).toBe(org.$id)
    })

    it('Lead (CRM) references Campaign (Marketing) cross-domain', async () => {
      const campaign = await $.Campaign.create({
        name: 'Product Launch',
        type: 'Email',
        status: 'Active',
      })
      const contact = await $.Contact.create({ name: 'Lead Person' })
      const lead = await $.Lead.create({
        name: 'Product Launch Lead',
        contact: contact.$id,
        campaign: campaign.$id,
        source: 'website',
        status: 'New',
      })

      expect(lead.campaign).toBe(campaign.$id)
      const resolvedCampaign = await $.Campaign.get(lead.campaign as string)
      expect(resolvedCampaign).toBeDefined()
      expect(resolvedCampaign.name).toBe('Product Launch')
    })

    it('FeatureFlag (Experiments) references Experiment (Experiments) and Organization (CRM)', async () => {
      const org = await $.Organization.create({ name: 'ExperimentCo' })
      const experiment = await $.Experiment.create({
        name: 'Dark Mode Test',
        status: 'Running',
        organization: org.$id,
      })
      const flag = await $.FeatureFlag.create({
        key: 'dark-mode',
        name: 'Dark Mode',
        organization: org.$id,
        experiment: experiment.$id,
        type: 'Boolean',
        status: 'Active',
      })

      expect(flag.experiment).toBe(experiment.$id)
      expect(flag.organization).toBe(org.$id)
    })
  })

  // ===========================================================================
  // 2. Entity registry completeness (35 entities)
  // ===========================================================================
  describe('entity registry completeness', () => {
    it('all 35 entities are accessible from $', () => {
      const expectedEntities = [
        'User', 'ApiKey',
        'Organization', 'Contact', 'Lead', 'Deal', 'Activity', 'Pipeline',
        'Customer', 'Product', 'Plan', 'Price', 'Subscription', 'Invoice', 'Payment',
        'Project', 'Issue', 'Comment',
        'Content', 'Asset', 'Site',
        'Ticket',
        'Event', 'Metric', 'Funnel', 'Goal',
        'Campaign', 'Segment', 'Form',
        'Experiment', 'FeatureFlag',
        'Workflow', 'Integration', 'Agent',
        'Message',
      ]

      expect(expectedEntities.length).toBe(35)

      for (const name of expectedEntities) {
        expect($[name], `Expected $.${name} to be defined`).toBeDefined()
        expect($[name].$name, `Expected $.${name}.$name to be '${name}'`).toBe(name)
      }
    })

    it('entityNames export contains exactly 35 entries', () => {
      expect(entityNames.length).toBe(35)
    })

    it('resolveEntity returns the correct entity for every name', () => {
      for (const name of entityNames) {
        const entity = resolveEntity(name)
        expect(entity, `resolveEntity('${name}') should be defined`).toBeDefined()
        expect(entity!.$name).toBe(name)
      }
    })

    it('resolveEntity returns undefined for non-existent entity', () => {
      expect(resolveEntity('Bogus')).toBeUndefined()
      expect(resolveEntity('contact')).toBeUndefined() // case-sensitive
    })

    it('every entity has CRUD verbs (except immutable Event)', () => {
      for (const name of entityNames) {
        const entity = $[name]
        expect(typeof entity.create, `${name}.create`).toBe('function')
        expect(typeof entity.get, `${name}.get`).toBe('function')
        expect(typeof entity.find, `${name}.find`).toBe('function')

        if (name === 'Event') {
          // Event disables update and delete
          expect(entity.update).toBeNull()
          expect(entity.delete).toBeNull()
        } else {
          expect(typeof entity.update, `${name}.update`).toBe('function')
          expect(typeof entity.delete, `${name}.delete`).toBe('function')
        }
      }
    })
  })

  // ===========================================================================
  // 3. Cross-domain verb hooks
  // ===========================================================================
  describe('cross-domain verb hooks', () => {
    it('Deal.closed() callback creates a Subscription via $ context', async () => {
      const contact = await $.Contact.create({ name: 'Alice', email: 'alice@acme.co' })
      const deal = await $.Deal.create({
        name: 'Acme Enterprise',
        value: 50000,
        stage: 'Negotiation',
        contact: contact.$id,
      })

      let subscriptionCreated = false
      $.Deal.closed(async (closedDeal: Record<string, unknown>, ctx: Record<string, unknown>) => {
        const sub = await (ctx as typeof $).Subscription.create({
          status: 'Active',
          customer: closedDeal.contact,
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
          startedAt: new Date().toISOString(),
        })
        subscriptionCreated = true
        expect(sub.$type).toBe('Subscription')
      })

      await $.Deal.close(deal.$id)
      expect(subscriptionCreated).toBe(true)
    })

    it('Contact.qualified() callback creates a billing Customer', async () => {
      const contact = await $.Contact.create({
        name: 'Bob',
        email: 'bob@startup.io',
        status: 'Active',
      })

      let customerCreated = false
      $.Contact.qualified(async (qualifiedContact: Record<string, unknown>) => {
        const cust = await $.Customer.create({
          name: qualifiedContact.name as string,
          email: qualifiedContact.email as string,
        })
        customerCreated = true
        expect(cust.$type).toBe('Customer')
      })

      await $.Contact.qualify(contact.$id)
      expect(customerCreated).toBe(true)
    })

    it('Issue.closed() callback can create a Message (Communication)', async () => {
      const project = await $.Project.create({ name: 'Alpha', status: 'Active' })
      const issue = await $.Issue.create({
        title: 'Ship v1',
        project: project.$id,
        status: 'Open',
        type: 'Feature',
      })

      let messageSent = false
      $.Issue.closed(async (closedIssue: Record<string, unknown>, ctx: Record<string, unknown>) => {
        const msg = await (ctx as typeof $).Message.create({
          body: `Issue "${closedIssue.title}" has been closed`,
          channel: 'Chat',
          status: 'Sent',
        })
        messageSent = true
        expect(msg.$type).toBe('Message')
      })

      await $.Issue.close(issue.$id)
      expect(messageSent).toBe(true)
    })

    it('Subscription.cancelled() callback creates a support Ticket', async () => {
      const customer = await $.Customer.create({ name: 'Churning Co', email: 'churn@test.com' })
      const sub = await $.Subscription.create({
        status: 'Active',
        customer: customer.$id,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000).toISOString(),
        startedAt: new Date().toISOString(),
      })

      let ticketCreated = false
      $.Subscription.cancelled(async (cancelledSub: Record<string, unknown>, ctx: Record<string, unknown>) => {
        const ticket = await (ctx as typeof $).Ticket.create({
          subject: 'Churn risk: subscription cancelled',
          status: 'Open',
          priority: 'High',
        })
        ticketCreated = true
        expect(ticket.$type).toBe('Ticket')
      })

      await $.Subscription.cancel(sub.$id)
      expect(ticketCreated).toBe(true)
    })
  })

  // ===========================================================================
  // 4. Domain namespace isolation
  // ===========================================================================
  describe('domain namespace isolation', () => {
    it('crm namespace contains exactly 6 entities', () => {
      const crmEntities = Object.keys(crm).filter(k => crm[k]?.$name)
      expect(crmEntities).toHaveLength(6)
      expect(crmEntities.sort()).toEqual(['Activity', 'Contact', 'Deal', 'Lead', 'Organization', 'Pipeline'])
    })

    it('billing namespace contains exactly 7 entities', () => {
      const billingEntities = Object.keys(billing).filter(k => billing[k]?.$name)
      expect(billingEntities).toHaveLength(7)
      expect(billingEntities.sort()).toEqual(['Customer', 'Invoice', 'Payment', 'Plan', 'Price', 'Product', 'Subscription'])
    })

    it('projects namespace contains exactly 3 entities', () => {
      const projEntities = Object.keys(projects).filter(k => projects[k]?.$name)
      expect(projEntities).toHaveLength(3)
      expect(projEntities.sort()).toEqual(['Comment', 'Issue', 'Project'])
    })

    it('crm.Contact and billing.Customer are distinct entity types', () => {
      expect(crm.Contact.$name).toBe('Contact')
      expect(billing.Customer.$name).toBe('Customer')
      expect(crm.Contact.$name).not.toBe(billing.Customer.$name)
    })

    it('domain entities are the same objects as $ entities', () => {
      // Accessing crm.Contact should be the exact same proxy as $.Contact
      expect(crm.Contact).toBe($.Contact)
      expect(billing.Subscription).toBe($.Subscription)
      expect(projects.Issue).toBe($.Issue)
      expect(support.Ticket).toBe($.Ticket)
      expect(analytics.Event).toBe($.Event)
      expect(marketing.Campaign).toBe($.Campaign)
      expect(experiments.Experiment).toBe($.Experiment)
      expect(platform.Workflow).toBe($.Workflow)
    })

    it('content, support, analytics, marketing, experiments, platform have correct counts', () => {
      expect(Object.keys(content).filter(k => content[k]?.$name).length).toBe(3)
      expect(Object.keys(support).filter(k => support[k]?.$name).length).toBe(1)
      expect(Object.keys(analytics).filter(k => analytics[k]?.$name).length).toBe(4)
      expect(Object.keys(marketing).filter(k => marketing[k]?.$name).length).toBe(3)
      expect(Object.keys(experiments).filter(k => experiments[k]?.$name).length).toBe(2)
      expect(Object.keys(platform).filter(k => platform[k]?.$name).length).toBe(3)
    })
  })

  // ===========================================================================
  // 5. Mixed-domain queries
  // ===========================================================================
  describe('mixed-domain queries', () => {
    it('find() returns entities with correct $type across domains', async () => {
      await $.Contact.create({ name: 'Alice' })
      await $.Customer.create({ name: 'Alice Corp', email: 'alice@corp.com' })
      await $.Project.create({ name: 'Alice Project', status: 'Active' })

      const contacts = await $.Contact.find()
      const customers = await $.Customer.find()
      const projectsList = await $.Project.find()

      expect(contacts.every(c => c.$type === 'Contact')).toBe(true)
      expect(customers.every(c => c.$type === 'Customer')).toBe(true)
      expect(projectsList.every(p => p.$type === 'Project')).toBe(true)
    })

    it('search with filter across CRM and Billing via shared organization', async () => {
      const org = await $.Organization.create({ name: 'SharedCo' })
      await $.Contact.create({ name: 'C1', organization: org.$id })
      await $.Contact.create({ name: 'C2', organization: org.$id })
      await $.Customer.create({ name: 'SharedCo', email: 'shared@co.io', organization: org.$id })
      await $.Deal.create({ name: 'SharedCo Deal', value: 50000, organization: org.$id })

      const orgContacts = await $.search({ type: 'Contact', filter: { organization: org.$id } })
      const orgCustomers = await $.search({ type: 'Customer', filter: { organization: org.$id } })
      const orgDeals = await $.search({ type: 'Deal', filter: { organization: org.$id } })

      expect(orgContacts.length).toBe(2)
      expect(orgCustomers.length).toBe(1)
      expect(orgDeals.length).toBe(1)
    })

    it('$.fetch with include resolves Customer back-references', async () => {
      const customer = await $.Customer.create({ name: 'InvoiceCo', email: 'inv@co.io' })
      await $.Invoice.create({
        number: 'INV-001',
        customer: customer.$id,
        subtotal: 5000,
        total: 5000,
        amountDue: 5000,
        status: 'Open',
      })
      await $.Payment.create({
        amount: 5000,
        customer: customer.$id,
        status: 'Succeeded',
      })

      const customerWithRels = await $.fetch({ type: 'Customer', id: customer.$id, include: ['invoices', 'payments'] })
      expect(customerWithRels).toBeDefined()
      expect(Array.isArray(customerWithRels.invoices)).toBe(true)
      expect(customerWithRels.invoices.length).toBe(1)
      expect(Array.isArray(customerWithRels.payments)).toBe(true)
      expect(customerWithRels.payments.length).toBe(1)
    })

    it('$.fetch with include resolves Organization contacts and deals', async () => {
      const org = await $.Organization.create({ name: 'IncludeCo', type: 'Customer' })
      await $.Contact.create({ name: 'Alice', organization: org.$id })
      await $.Contact.create({ name: 'Bob', organization: org.$id })
      await $.Deal.create({ name: 'Big Deal', value: 100000, organization: org.$id })

      const orgWithRels = await $.fetch({ type: 'Organization', id: org.$id, include: ['contacts', 'deals'] })
      expect(orgWithRels.contacts).toBeDefined()
      expect(orgWithRels.contacts.length).toBe(2)
      expect(orgWithRels.deals).toBeDefined()
      expect(orgWithRels.deals.length).toBe(1)
    })

    it('$.fetch with include resolves Campaign leads (Marketing -> CRM)', async () => {
      const campaign = await $.Campaign.create({ name: 'Launch', type: 'Email', status: 'Active' })
      await $.Lead.create({ name: 'Lead 1', source: 'web', campaign: campaign.$id, status: 'New' })
      await $.Lead.create({ name: 'Lead 2', source: 'social', campaign: campaign.$id, status: 'New' })

      const campaignWithLeads = await $.fetch({ type: 'Campaign', id: campaign.$id, include: ['leads'] })
      expect(campaignWithLeads.leads).toBeDefined()
      expect(Array.isArray(campaignWithLeads.leads)).toBe(true)
      expect(campaignWithLeads.leads.length).toBe(2)
    })

    it('$.fetch with include resolves Project issues (Projects back-ref)', async () => {
      const project = await $.Project.create({ name: 'TestProj', status: 'Active' })
      await $.Issue.create({ title: 'Issue A', project: project.$id, status: 'Open', type: 'Bug' })
      await $.Issue.create({ title: 'Issue B', project: project.$id, status: 'Open', type: 'Feature' })

      const projectWithIssues = await $.fetch({ type: 'Project', id: project.$id, include: ['issues'] })
      expect(projectWithIssues.issues).toBeDefined()
      expect(projectWithIssues.issues.length).toBe(2)
    })

    it('$.do executes cross-domain pipeline with all entities in context', async () => {
      const result = await $.do(async (ctx) => {
        const org = await ctx.Organization.create({ name: 'Pipeline Co' })
        const contact = await ctx.Contact.create({ name: 'Pipeline Person', organization: org.$id })
        const customer = await ctx.Customer.create({ name: 'Pipeline Co', email: 'pipe@co.io', organization: org.$id })
        const deal = await ctx.Deal.create({ name: 'Pipeline Deal', value: 50000, contact: contact.$id })
        const project = await ctx.Project.create({ name: 'Onboarding', organization: org.$id, status: 'Active' })
        const ticket = await ctx.Ticket.create({ subject: 'Welcome', requester: contact.$id, status: 'Open' })
        return {
          orgId: org.$id,
          contactId: contact.$id,
          customerId: customer.$id,
          dealId: deal.$id,
          projectId: project.$id,
          ticketId: ticket.$id,
        }
      })

      const r = result as Record<string, string>
      expect(r.orgId).toContain('organization_')
      expect(r.contactId).toContain('contact_')
      expect(r.customerId).toContain('customer_')
      expect(r.dealId).toContain('deal_')
      expect(r.projectId).toContain('project_')
      expect(r.ticketId).toContain('ticket_')
    })

    it('Campaign metrics computed from CRM Deal values', async () => {
      const campaign = await $.Campaign.create({
        name: 'Q4 Push',
        type: 'Paid',
        status: 'Completed',
        budget: 10000,
      })
      await $.Deal.create({ name: 'Deal from Q4', value: 50000, campaign: campaign.$id, stage: 'ClosedWon' })
      await $.Deal.create({ name: 'Another Q4 Deal', value: 25000, campaign: campaign.$id, stage: 'ClosedWon' })

      const campaignDeals = await $.search({ type: 'Deal', filter: { campaign: campaign.$id } })
      expect(campaignDeals.length).toBe(2)
      const totalRevenue = campaignDeals.reduce((sum: number, d: Record<string, unknown>) => sum + (d.value as number), 0)
      expect(totalRevenue).toBe(75000)
    })
  })

  // ===========================================================================
  // 6. Relationship strings (cross-domain $schema verification)
  // ===========================================================================
  describe('relationship strings', () => {
    it('Contact.organization points to Organization (CRM -> CRM)', () => {
      const schema = $.Contact.$schema as NounSchema
      const rel = schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
      expect(rel!.backref).toBe('contacts')
    })

    it('Customer.organization points to Organization (Billing -> CRM)', () => {
      const schema = $.Customer.$schema as NounSchema
      const rel = schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
    })

    it('Subscription.customer points to Customer (Billing -> Billing)', () => {
      const schema = $.Subscription.$schema as NounSchema
      const rel = schema.relationships.get('customer')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Customer')
      expect(rel!.backref).toBe('subscriptions')
    })

    it('Subscription.organization points to Organization (Billing -> CRM)', () => {
      const schema = $.Subscription.$schema as NounSchema
      const rel = schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
      expect(rel!.backref).toBe('subscriptions')
    })

    it('Issue.project points to Project (Projects internal)', () => {
      const schema = $.Issue.$schema as NounSchema
      const rel = schema.relationships.get('project')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Project')
      expect(rel!.backref).toBe('issues')
    })

    it('Issue.assignee and Issue.reporter point to Contact (Projects -> CRM)', () => {
      const schema = $.Issue.$schema as NounSchema
      const assigneeRel = schema.relationships.get('assignee')
      expect(assigneeRel).toBeDefined()
      expect(assigneeRel!.operator).toBe('->')
      expect(assigneeRel!.targetType).toBe('Contact')

      const reporterRel = schema.relationships.get('reporter')
      expect(reporterRel).toBeDefined()
      expect(reporterRel!.operator).toBe('->')
      expect(reporterRel!.targetType).toBe('Contact')
    })

    it('Lead.campaign points to Campaign (CRM -> Marketing)', () => {
      const schema = $.Lead.$schema as NounSchema
      const rel = schema.relationships.get('campaign')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Campaign')
      expect(rel!.backref).toBe('leads')
    })

    it('Content.author points to Contact (Content -> CRM)', () => {
      const schema = $.Content.$schema as NounSchema
      const rel = schema.relationships.get('author')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Contact')
    })

    it('Ticket.requester and Ticket.assignee point to Contact (Support -> CRM)', () => {
      const schema = $.Ticket.$schema as NounSchema

      const requesterRel = schema.relationships.get('requester')
      expect(requesterRel).toBeDefined()
      expect(requesterRel!.operator).toBe('->')
      expect(requesterRel!.targetType).toBe('Contact')

      const assigneeRel = schema.relationships.get('assignee')
      expect(assigneeRel).toBeDefined()
      expect(assigneeRel!.operator).toBe('->')
      expect(assigneeRel!.targetType).toBe('Contact')
    })

    it('FeatureFlag.experiment points to Experiment (Experiments internal)', () => {
      const schema = $.FeatureFlag.$schema as NounSchema
      const rel = schema.relationships.get('experiment')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Experiment')
    })

    it('Agent.organization and Agent.owner cross CRM (Platform -> CRM)', () => {
      const schema = $.Agent.$schema as NounSchema

      const orgRel = schema.relationships.get('organization')
      expect(orgRel).toBeDefined()
      expect(orgRel!.operator).toBe('->')
      expect(orgRel!.targetType).toBe('Organization')

      const ownerRel = schema.relationships.get('owner')
      expect(ownerRel).toBeDefined()
      expect(ownerRel!.operator).toBe('->')
      expect(ownerRel!.targetType).toBe('Contact')
    })

    it('Organization back-references span CRM and Billing domains', () => {
      const schema = $.Organization.$schema as NounSchema

      // CRM back-references
      const contactsRel = schema.relationships.get('contacts')
      expect(contactsRel).toBeDefined()
      expect(contactsRel!.operator).toBe('<-')
      expect(contactsRel!.targetType).toBe('Contact')

      const dealsRel = schema.relationships.get('deals')
      expect(dealsRel).toBeDefined()
      expect(dealsRel!.operator).toBe('<-')
      expect(dealsRel!.targetType).toBe('Deal')

      // Billing back-reference
      const subsRel = schema.relationships.get('subscriptions')
      expect(subsRel).toBeDefined()
      expect(subsRel!.operator).toBe('<-')
      expect(subsRel!.targetType).toBe('Subscription')
    })
  })

  // ===========================================================================
  // 7. End-to-end cross-domain scenarios
  // ===========================================================================
  describe('end-to-end scenarios', () => {
    it('full startup lifecycle: build -> launch -> grow', async () => {
      // Build phase: create project and issues
      const org = await $.Organization.create({ name: 'NewStartup', type: 'Prospect' })
      const founder = await $.Contact.create({ name: 'Founder', email: 'founder@startup.io', organization: org.$id })
      const project = await $.Project.create({ name: 'MVP', organization: org.$id, owner: founder.$id, status: 'Active' })
      const issue = await $.Issue.create({ title: 'Build landing page', project: project.$id, assignee: founder.$id, status: 'Open', type: 'Feature' })

      // Launch phase: create campaign and content
      const site = await $.Site.create({ name: 'startup.io', status: 'Published' })
      const landingPage = await $.Content.create({ title: 'Welcome', site: site.$id, author: founder.$id, type: 'Page', status: 'Published' })
      const campaign = await $.Campaign.create({ name: 'Launch', type: 'Email', status: 'Active', owner: founder.$id })

      // Grow phase: leads come in, deals close, billing starts
      const lead = await $.Lead.create({ name: 'First Lead', contact: founder.$id, campaign: campaign.$id, source: 'website', status: 'New' })
      const deal = await $.Deal.create({ name: 'First Deal', value: 10000, organization: org.$id, contact: founder.$id, stage: 'Prospecting' })
      const customer = await $.Customer.create({ name: 'NewStartup', email: 'billing@startup.io', organization: org.$id })
      const subscription = await $.Subscription.create({
        status: 'Trialing',
        customer: customer.$id,
        organization: org.$id,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 14 * 86400000).toISOString(),
        startedAt: new Date().toISOString(),
      })

      // Verify cross-domain connectivity
      expect(project.organization).toBe(org.$id)
      expect(issue.assignee).toBe(founder.$id)
      expect(landingPage.author).toBe(founder.$id)
      expect(lead.campaign).toBe(campaign.$id)
      expect(deal.organization).toBe(org.$id)
      expect(subscription.organization).toBe(org.$id)
      expect(subscription.customer).toBe(customer.$id)
    })

    it('relationships form a connected graph (no orphan domains)', async () => {
      const org = await $.Organization.create({ name: 'Graph Test Corp' })
      const contact = await $.Contact.create({ name: 'Graph Person', organization: org.$id })
      const customer = await $.Customer.create({ name: 'Graph Customer', email: 'gc@test.com', organization: org.$id })
      const project = await $.Project.create({ name: 'Graph Project', organization: org.$id, owner: contact.$id, status: 'Active' })
      const issue = await $.Issue.create({ title: 'Graph Issue', project: project.$id, assignee: contact.$id, status: 'Open', type: 'Task' })
      const comment = await $.Comment.create({ body: 'Graph Comment', author: contact.$id, issue: issue.$id })
      const contentItem = await $.Content.create({ title: 'Graph Content', author: contact.$id, status: 'Draft', type: 'Article' })
      const ticket = await $.Ticket.create({ subject: 'Graph Ticket', requester: contact.$id, organization: org.$id, status: 'Open' })
      const campaign = await $.Campaign.create({ name: 'Graph Campaign', owner: contact.$id, type: 'Email', status: 'Draft' })
      const workflow = await $.Workflow.create({ name: 'Graph Workflow', organization: org.$id, trigger: 'test', status: 'Draft' })
      const agent = await $.Agent.create({ name: 'Graph Agent', organization: org.$id, owner: contact.$id, type: 'Assistant', status: 'Draft' })
      const experiment = await $.Experiment.create({ name: 'Graph Experiment', organization: org.$id, owner: contact.$id, status: 'Draft' })
      const event = await $.Event.create({
        name: 'graph_test',
        type: 'test',
        source: 'API',
        timestamp: new Date().toISOString(),
        organization: org.$id,
      })

      // Every entity links through Organization as the hub
      expect(contact.organization).toBe(org.$id)
      expect(customer.organization).toBe(org.$id)
      expect(project.organization).toBe(org.$id)
      expect(issue.project).toBe(project.$id)
      expect(comment.issue).toBe(issue.$id)
      expect(contentItem.author).toBe(contact.$id)
      expect(ticket.organization).toBe(org.$id)
      expect(campaign.owner).toBe(contact.$id)
      expect(workflow.organization).toBe(org.$id)
      expect(agent.organization).toBe(org.$id)
      expect(experiment.organization).toBe(org.$id)
      expect(event.organization).toBe(org.$id)
    })
  })
})
