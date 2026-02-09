/**
 * TDD RED phase — Cross-domain entity relationship tests
 *
 * Tests that entities from different domains can reference each other,
 * that cross-domain verb hooks fire correctly, and that the full entity
 * graph is connected.
 *
 * These tests will FAIL until cross-domain relationship resolution,
 * verb-triggered side effects, and graph traversal are implemented.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { $, crm, billing, projects, content, support, analytics, marketing, experiments, platform } from '../src/index'

describe('@headlessly/sdk — cross-domain relationships', () => {
  beforeEach(() => {
    clearRegistry()
    setProvider(new MemoryNounProvider())
  })

  // ===========================================================================
  // 1. CRM <-> Billing Relationships
  // ===========================================================================
  describe('CRM <-> Billing', () => {
    it('Contact can be linked to a Customer via organization reference', async () => {
      const org = await $.Organization.create({ name: 'Acme Corp', type: 'Customer' })
      const contact = await $.Contact.create({ name: 'Alice', organization: org.$id })
      const customer = await $.Customer.create({ name: 'Acme Corp', email: 'billing@acme.co', organization: org.$id })

      // Both contact and customer should resolve their shared organization
      const contactOrg = await $.Organization.get(contact.organization as string)
      const customerOrg = await $.Organization.get(customer.organization as string)
      expect(contactOrg).toBeDefined()
      expect(contactOrg.$id).toBe(customerOrg.$id)
    })

    it('Deal.close triggers Subscription creation via cross-domain verb hook', async () => {
      const contact = await $.Contact.create({ name: 'Alice', email: 'alice@acme.co' })
      const deal = await $.Deal.create({
        name: 'Acme Enterprise',
        value: 50000,
        stage: 'Negotiation',
        contact: contact.$id,
      })

      // Register a cross-domain after hook: when a deal is closed, create a subscription
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

      // Close the deal — this should fire the after hook with $ context
      await $.Deal.close(deal.$id)

      expect(subscriptionCreated).toBe(true)
    })

    it('Customer has related Invoices and Payments via back-references', async () => {
      const customer = await $.Customer.create({ name: 'Acme', email: 'acme@test.com' })
      const invoice = await $.Invoice.create({
        number: 'INV-001',
        customer: customer.$id,
        subtotal: 5000,
        total: 5000,
        amountDue: 5000,
        status: 'Open',
      })
      const payment = await $.Payment.create({
        amount: 5000,
        customer: customer.$id,
        invoice: invoice.$id,
        status: 'Succeeded',
      })

      // Fetch customer with expanded relationships
      const customerWithRels = await $.fetch({ type: 'Customer', id: customer.$id, include: ['invoices', 'payments'] })
      expect(customerWithRels).toBeDefined()
      // The include param should populate related invoices and payments
      expect(customerWithRels.invoices).toBeDefined()
      expect(Array.isArray(customerWithRels.invoices)).toBe(true)
      expect(customerWithRels.invoices.length).toBeGreaterThanOrEqual(1)
      expect(customerWithRels.payments).toBeDefined()
      expect(Array.isArray(customerWithRels.payments)).toBe(true)
    })

    it('Contact.qualify triggers CRM -> Billing pipeline', async () => {
      const contact = await $.Contact.create({
        name: 'Bob',
        email: 'bob@startup.io',
        status: 'Active',
      })

      let customerCreated = false
      // When a contact is qualified, create a billing Customer
      $.Contact.qualified(async (qualifiedContact: Record<string, unknown>) => {
        const cust = await $.Customer.create({
          name: qualifiedContact.name as string,
          email: qualifiedContact.email as string,
          organization: qualifiedContact.organization as string,
        })
        customerCreated = true
        expect(cust.$type).toBe('Customer')
      })

      await $.Contact.qualify(contact.$id)
      expect(customerCreated).toBe(true)
    })

    it('Company has related Contacts and Deals (Organization back-references)', async () => {
      const org = await $.Organization.create({ name: 'TechCo', type: 'Customer' })
      await $.Contact.create({ name: 'Alice', organization: org.$id })
      await $.Contact.create({ name: 'Bob', organization: org.$id })
      await $.Deal.create({ name: 'Big Deal', value: 100000, organization: org.$id })

      // Fetching organization with includes should resolve back-references
      const orgWithRels = await $.fetch({ type: 'Organization', id: org.$id, include: ['contacts', 'deals'] })
      expect(orgWithRels).toBeDefined()
      expect(orgWithRels.contacts).toBeDefined()
      expect(Array.isArray(orgWithRels.contacts)).toBe(true)
      expect(orgWithRels.contacts.length).toBe(2)
      expect(orgWithRels.deals).toBeDefined()
      expect(orgWithRels.deals.length).toBe(1)
    })

    it('Billing Customer references CRM Contact through shared organization', async () => {
      const org = await $.Organization.create({ name: 'StartupCo' })
      const contact = await $.Contact.create({ name: 'Founder', email: 'founder@startup.co', organization: org.$id })
      const customer = await $.Customer.create({ name: 'StartupCo', email: 'billing@startup.co', organization: org.$id })

      // The customer and contact share an organization — search should find them via the link
      const orgContacts = await $.search({ type: 'Contact', filter: { organization: org.$id } })
      const orgCustomers = await $.search({ type: 'Customer', filter: { organization: org.$id } })
      expect(orgContacts.length).toBe(1)
      expect(orgContacts[0].$id).toBe(contact.$id)
      expect(orgCustomers.length).toBe(1)
      expect(orgCustomers[0].$id).toBe(customer.$id)
    })
  })

  // ===========================================================================
  // 2. CRM <-> Projects Relationships
  // ===========================================================================
  describe('CRM <-> Projects', () => {
    it('Issue.assignee references a CRM Contact', async () => {
      const contact = await $.Contact.create({ name: 'Dev Alice', email: 'alice@dev.io' })
      const project = await $.Project.create({ name: 'Platform Rewrite', status: 'Active' })
      const issue = await $.Issue.create({
        title: 'Fix auth bug',
        project: project.$id,
        assignee: contact.$id,
        status: 'Open',
        priority: 'High',
        type: 'Bug',
      })

      // Issue assignee should resolve to the CRM Contact
      const assignee = await $.Contact.get(issue.assignee as string)
      expect(assignee).toBeDefined()
      expect(assignee.$id).toBe(contact.$id)
      expect(assignee.name).toBe('Dev Alice')
    })

    it('Deal can be linked to a Project via shared organization', async () => {
      const org = await $.Organization.create({ name: 'ClientCo' })
      const deal = await $.Deal.create({ name: 'ClientCo Implementation', value: 75000, organization: org.$id })
      const project = await $.Project.create({ name: 'ClientCo Onboarding', organization: org.$id, status: 'Active' })

      // Both deal and project reference the same organization
      expect(deal.organization).toBe(project.organization)

      // Search by organization should return both
      const orgDeals = await $.search({ type: 'Deal', filter: { organization: org.$id } })
      const orgProjects = await $.search({ type: 'Project', filter: { organization: org.$id } })
      expect(orgDeals.length).toBe(1)
      expect(orgProjects.length).toBe(1)
    })

    it('Comment.author references a CRM Contact', async () => {
      const contact = await $.Contact.create({ name: 'Reviewer Bob' })
      const project = await $.Project.create({ name: 'SDK', status: 'Active' })
      const issue = await $.Issue.create({ title: 'Add tests', project: project.$id, status: 'Open', type: 'Task' })
      const comment = await $.Comment.create({
        body: 'LGTM! Ship it.',
        author: contact.$id,
        issue: issue.$id,
      })

      const author = await $.Contact.get(comment.author as string)
      expect(author).toBeDefined()
      expect(author.$id).toBe(contact.$id)
    })

    it('Issue.assign verb links a Contact to an Issue', async () => {
      const contact = await $.Contact.create({ name: 'Engineer' })
      const project = await $.Project.create({ name: 'Backend', status: 'Active' })
      const issue = await $.Issue.create({
        title: 'Implement API',
        project: project.$id,
        status: 'Open',
        type: 'Feature',
      })

      // Assign the issue to the contact
      const assigned = await $.Issue.assign(issue.$id, { assignee: contact.$id })
      expect(assigned.status).toBe('Assigned')
      expect(assigned.assignee).toBe(contact.$id)
    })

    it('Project has related Issues and Comments through back-references', async () => {
      const project = await $.Project.create({ name: 'Frontend', status: 'Active' })
      const issue1 = await $.Issue.create({ title: 'Bug 1', project: project.$id, status: 'Open', type: 'Bug' })
      const issue2 = await $.Issue.create({ title: 'Feature 1', project: project.$id, status: 'Open', type: 'Feature' })
      await $.Comment.create({ body: 'On it', issue: issue1.$id, author: 'contact_test' })

      const projectWithIssues = await $.fetch({ type: 'Project', id: project.$id, include: ['issues'] })
      expect(projectWithIssues).toBeDefined()
      expect(projectWithIssues.issues).toBeDefined()
      expect(Array.isArray(projectWithIssues.issues)).toBe(true)
      expect(projectWithIssues.issues.length).toBe(2)
    })
  })

  // ===========================================================================
  // 3. Marketing <-> CRM Relationships
  // ===========================================================================
  describe('Marketing <-> CRM', () => {
    it('Campaign targets a Segment which filters Contacts', async () => {
      const segment = await $.Segment.create({
        name: 'Enterprise Leads',
        criteria: JSON.stringify({ leadScore: { $gte: 80 } }),
        isDynamic: 'true',
      })
      const campaign = await $.Campaign.create({
        name: 'Enterprise Outreach',
        type: 'Email',
        status: 'Draft',
      })

      // The segment criteria should be usable as a Contact filter
      const criteria = JSON.parse(segment.criteria as string)
      expect(criteria).toBeDefined()
      expect(criteria.leadScore).toBeDefined()

      // Contacts matching segment criteria
      await $.Contact.create({ name: 'Enterprise Lead', leadScore: 90 })
      await $.Contact.create({ name: 'Small Lead', leadScore: 30 })
      const matchingContacts = await $.search({ type: 'Contact', filter: { leadScore: { $gte: 80 } } })
      expect(matchingContacts.length).toBe(1)
      expect(matchingContacts[0].name).toBe('Enterprise Lead')
    })

    it('Form submission creates a CRM Contact and Lead', async () => {
      const form = await $.Form.create({
        name: 'Website Signup',
        status: 'Active',
        fields: JSON.stringify(['name', 'email', 'company']),
      })

      // Simulate form submission creating a contact and lead
      const contact = await $.Contact.create({ name: 'Signup User', email: 'user@example.com', source: `form_${form.$id}` })
      const lead = await $.Lead.create({
        name: 'Signup User',
        contact: contact.$id,
        source: `form_${form.$id}`,
        status: 'New',
      })

      expect(lead.source).toBe(`form_${form.$id}`)
      expect(lead.contact).toBe(contact.$id)
    })

    it('Campaign.leads back-reference resolves Lead entities', async () => {
      const campaign = await $.Campaign.create({ name: 'Launch Campaign', type: 'Email', status: 'Active' })
      await $.Lead.create({ name: 'Lead 1', source: 'website', campaign: campaign.$id, status: 'New' })
      await $.Lead.create({ name: 'Lead 2', source: 'social', campaign: campaign.$id, status: 'New' })

      const campaignWithLeads = await $.fetch({ type: 'Campaign', id: campaign.$id, include: ['leads'] })
      expect(campaignWithLeads).toBeDefined()
      expect(campaignWithLeads.leads).toBeDefined()
      expect(Array.isArray(campaignWithLeads.leads)).toBe(true)
      expect(campaignWithLeads.leads.length).toBe(2)
    })

    it('Campaign metrics reference CRM Deal values', async () => {
      const campaign = await $.Campaign.create({
        name: 'Q4 Push',
        type: 'Paid',
        status: 'Completed',
        budget: 10000,
      })
      await $.Deal.create({ name: 'Deal from Q4', value: 50000, campaign: campaign.$id, stage: 'ClosedWon' })
      await $.Deal.create({ name: 'Another Q4 Deal', value: 25000, campaign: campaign.$id, stage: 'ClosedWon' })

      // Search deals attributed to this campaign
      const campaignDeals = await $.search({ type: 'Deal', filter: { campaign: campaign.$id } })
      expect(campaignDeals.length).toBe(2)
      const totalRevenue = campaignDeals.reduce((sum: number, d: Record<string, unknown>) => sum + (d.value as number), 0)
      expect(totalRevenue).toBe(75000)
    })

    it('Marketing funnel stages map to CRM Lead stages', async () => {
      const funnel = await $.Funnel.create({
        name: 'Lead-to-Customer Funnel',
        steps: JSON.stringify([
          { name: 'New Lead', entityType: 'Lead', filter: { status: 'New' } },
          { name: 'Contacted', entityType: 'Lead', filter: { status: 'Contacted' } },
          { name: 'Qualified', entityType: 'Lead', filter: { status: 'Qualified' } },
          { name: 'Customer', entityType: 'Customer', filter: {} },
        ]),
      })

      const steps = JSON.parse(funnel.steps as string)
      expect(steps.length).toBe(4)
      // First three stages reference Lead entity, last references Customer (Billing domain)
      expect(steps[0].entityType).toBe('Lead')
      expect(steps[3].entityType).toBe('Customer')
    })
  })

  // ===========================================================================
  // 4. Analytics Cross-Domain
  // ===========================================================================
  describe('Analytics cross-domain', () => {
    it('Event can reference any entity type via userId and data', async () => {
      const contact = await $.Contact.create({ name: 'Tracked User' })
      const event = await $.Event.create({
        name: 'page_view',
        type: 'track',
        userId: contact.$id,
        data: JSON.stringify({ entityType: 'Contact', entityId: contact.$id }),
        source: 'Browser',
        timestamp: new Date().toISOString(),
      })

      expect(event.userId).toBe(contact.$id)
      const eventData = JSON.parse(event.data as string)
      expect(eventData.entityType).toBe('Contact')
      expect(eventData.entityId).toBe(contact.$id)
    })

    it('Metric aggregates across domains (CRM + Billing)', async () => {
      // MRR metric derived from Billing domain
      const mrrMetric = await $.Metric.create({
        name: 'MRR',
        value: 50000,
        type: 'Gauge',
        unit: 'USD',
        dimensions: JSON.stringify({ domain: 'billing', source: 'Subscription' }),
      })

      // Pipeline value metric from CRM domain
      const pipelineMetric = await $.Metric.create({
        name: 'Pipeline Value',
        value: 250000,
        type: 'Gauge',
        unit: 'USD',
        dimensions: JSON.stringify({ domain: 'crm', source: 'Deal' }),
      })

      const allMetrics = await $.Metric.find()
      expect(allMetrics.length).toBeGreaterThanOrEqual(2)

      // Metrics from different domains coexist
      const domains = allMetrics.map((m: Record<string, unknown>) => JSON.parse(m.dimensions as string).domain)
      expect(domains).toContain('billing')
      expect(domains).toContain('crm')
    })

    it('Funnel stages span CRM + Billing entities', async () => {
      const funnel = await $.Funnel.create({
        name: 'Revenue Funnel',
        steps: JSON.stringify([
          { name: 'Lead', entityType: 'Lead', domain: 'crm' },
          { name: 'Deal', entityType: 'Deal', domain: 'crm' },
          { name: 'Customer', entityType: 'Customer', domain: 'billing' },
          { name: 'Subscription', entityType: 'Subscription', domain: 'billing' },
        ]),
      })

      const steps = JSON.parse(funnel.steps as string)
      const uniqueDomains = [...new Set(steps.map((s: Record<string, string>) => s.domain))]
      expect(uniqueDomains).toContain('crm')
      expect(uniqueDomains).toContain('billing')
    })

    it('Goal references cross-domain metrics', async () => {
      const goal = await $.Goal.create({
        name: 'Reach 100 customers',
        target: 100,
        current: 45,
        unit: 'customers',
        period: 'Quarterly',
        status: 'OnTrack',
      })

      // Goal tracking should work with cross-domain entity counts
      const customers = await $.Customer.find()
      const updatedGoal = await $.Goal.update(goal.$id, { current: customers.length })
      expect(updatedGoal.current).toBe(customers.length)
    })

    it('Event enrichment adds entity context from any domain', async () => {
      const deal = await $.Deal.create({ name: 'Important Deal', value: 100000, stage: 'Proposal' })
      const event = await $.Event.create({
        name: 'deal_updated',
        type: 'entity',
        source: 'API',
        timestamp: new Date().toISOString(),
        data: JSON.stringify({
          entityType: 'Deal',
          entityId: deal.$id,
          domain: 'crm',
          changes: { stage: { from: 'Qualification', to: 'Proposal' } },
        }),
      })

      const eventData = JSON.parse(event.data as string)
      // Event should reference a CRM entity with full context
      expect(eventData.entityType).toBe('Deal')
      expect(eventData.domain).toBe('crm')
      expect(eventData.changes.stage.to).toBe('Proposal')

      // Verify the referenced deal exists
      const referencedDeal = await $.Deal.get(eventData.entityId)
      expect(referencedDeal).toBeDefined()
      expect(referencedDeal.$id).toBe(deal.$id)
    })
  })

  // ===========================================================================
  // 5. Platform <-> All Domains
  // ===========================================================================
  describe('Platform <-> all domains', () => {
    it('Workflow can trigger actions across any domain', async () => {
      const workflow = await $.Workflow.create({
        name: 'New Customer Onboarding',
        trigger: 'Customer.created',
        status: 'Active',
        steps: JSON.stringify([
          { action: 'Project.create', data: { name: 'Onboarding: {{customer.name}}' } },
          { action: 'Issue.create', data: { title: 'Setup billing', type: 'Task' } },
          { action: 'Message.create', data: { body: 'Welcome!', channel: 'Email' } },
          { action: 'Campaign.create', data: { name: 'Drip: {{customer.name}}', type: 'Email' } },
        ]),
      })

      const steps = JSON.parse(workflow.steps as string)
      expect(steps.length).toBe(4)
      // Steps reference entities from 4 different domains
      const entityTypes = steps.map((s: Record<string, string>) => s.action.split('.')[0])
      expect(entityTypes).toContain('Project')   // projects domain
      expect(entityTypes).toContain('Issue')      // projects domain
      expect(entityTypes).toContain('Message')    // communication
      expect(entityTypes).toContain('Campaign')   // marketing domain
    })

    it('Integration maps external entities to internal ones', async () => {
      const stripeIntegration = await $.Integration.create({
        name: 'Stripe',
        slug: 'stripe',
        provider: 'stripe',
        category: 'Payment',
        status: 'Available',
        authType: 'ApiKey',
        configSchema: JSON.stringify({
          entityMapping: {
            'stripe.customer': 'Customer',
            'stripe.subscription': 'Subscription',
            'stripe.invoice': 'Invoice',
            'stripe.payment_intent': 'Payment',
            'stripe.product': 'Product',
            'stripe.price': 'Price',
          },
        }),
      })

      const config = JSON.parse(stripeIntegration.configSchema as string)
      const mapping = config.entityMapping
      // External Stripe entities map to internal Billing entities
      expect(mapping['stripe.customer']).toBe('Customer')
      expect(mapping['stripe.subscription']).toBe('Subscription')
      expect(mapping['stripe.invoice']).toBe('Invoice')
      expect(mapping['stripe.payment_intent']).toBe('Payment')
    })

    it('Agent can operate on any entity type via $.do', async () => {
      const agent = await $.Agent.create({
        name: 'Sales Agent',
        type: 'Autonomous',
        status: 'Active',
        tools: JSON.stringify(['Contact.create', 'Deal.create', 'Subscription.create', 'Message.create']),
      })

      // Agent uses $.do to operate across domains
      const result = await $.do(async (ctx) => {
        const contact = await ctx.Contact.create({ name: 'Agent-created Contact' })
        const deal = await ctx.Deal.create({ name: 'Agent Deal', value: 25000, contact: contact.$id })
        const message = await ctx.Message.create({ body: 'Follow up', channel: 'Email', recipient: contact.$id })
        return { contact: contact.$id, deal: deal.$id, message: message.$id }
      })

      expect(result).toBeDefined()
      const r = result as { contact: string; deal: string; message: string }
      expect(r.contact).toContain('contact_')
      expect(r.deal).toContain('deal_')
      expect(r.message).toContain('message_')
    })

    it('Workflow step references entities from different domains', async () => {
      const org = await $.Organization.create({ name: 'TenantCo' })
      const workflow = await $.Workflow.create({
        name: 'Churn Prevention',
        trigger: 'Subscription.canceled',
        status: 'Active',
        organization: org.$id,
        steps: JSON.stringify([
          { action: 'Ticket.create', domain: 'support', data: { subject: 'Churn risk' } },
          { action: 'Contact.update', domain: 'crm', data: { status: 'AtRisk' } },
          { action: 'Campaign.create', domain: 'marketing', data: { name: 'Win-back', type: 'Email' } },
        ]),
      })

      const steps = JSON.parse(workflow.steps as string)
      const domains = steps.map((s: Record<string, string>) => s.domain)
      expect(domains).toContain('support')
      expect(domains).toContain('crm')
      expect(domains).toContain('marketing')
    })

    it('Integration sync maps across entity types bidirectionally', async () => {
      const ghIntegration = await $.Integration.create({
        name: 'GitHub',
        slug: 'github',
        provider: 'github',
        category: 'CRM',
        status: 'Available',
        authType: 'OAuth2',
        configSchema: JSON.stringify({
          syncRules: [
            { external: 'github.issue', internal: 'Issue', direction: 'bidirectional' },
            { external: 'github.pull_request', internal: 'Issue', direction: 'inbound', filter: { type: 'Feature' } },
            { external: 'github.comment', internal: 'Comment', direction: 'bidirectional' },
          ],
        }),
      })

      const config = JSON.parse(ghIntegration.configSchema as string)
      expect(config.syncRules.length).toBe(3)
      expect(config.syncRules[0].direction).toBe('bidirectional')
      expect(config.syncRules[1].internal).toBe('Issue')
    })
  })

  // ===========================================================================
  // 6. Full Entity Graph
  // ===========================================================================
  describe('Full entity graph', () => {
    it('all entities are accessible from $', () => {
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

      for (const name of expectedEntities) {
        expect($[name], `Expected $.${name} to be defined`).toBeDefined()
        expect($[name].$name, `Expected $.${name}.$name to be '${name}'`).toBe(name)
      }
    })

    it('domain namespaces contain correct entities', () => {
      // CRM: Organization, Contact, Lead, Deal, Activity, Pipeline
      expect(crm.Organization.$name).toBe('Organization')
      expect(crm.Contact.$name).toBe('Contact')
      expect(crm.Lead.$name).toBe('Lead')
      expect(crm.Deal.$name).toBe('Deal')
      expect(crm.Activity.$name).toBe('Activity')
      expect(crm.Pipeline.$name).toBe('Pipeline')

      // Billing: Customer, Product, Plan, Price, Subscription, Invoice, Payment
      expect(billing.Customer.$name).toBe('Customer')
      expect(billing.Product.$name).toBe('Product')
      expect(billing.Plan.$name).toBe('Plan')
      expect(billing.Price.$name).toBe('Price')
      expect(billing.Subscription.$name).toBe('Subscription')
      expect(billing.Invoice.$name).toBe('Invoice')
      expect(billing.Payment.$name).toBe('Payment')

      // Projects: Project, Issue, Comment
      expect(projects.Project.$name).toBe('Project')
      expect(projects.Issue.$name).toBe('Issue')
      expect(projects.Comment.$name).toBe('Comment')

      // Content: Content, Asset, Site
      expect(content.Content.$name).toBe('Content')
      expect(content.Asset.$name).toBe('Asset')
      expect(content.Site.$name).toBe('Site')

      // Support: Ticket
      expect(support.Ticket.$name).toBe('Ticket')

      // Analytics: Event, Metric, Funnel, Goal
      expect(analytics.Event.$name).toBe('Event')
      expect(analytics.Metric.$name).toBe('Metric')
      expect(analytics.Funnel.$name).toBe('Funnel')
      expect(analytics.Goal.$name).toBe('Goal')

      // Marketing: Campaign, Segment, Form
      expect(marketing.Campaign.$name).toBe('Campaign')
      expect(marketing.Segment.$name).toBe('Segment')
      expect(marketing.Form.$name).toBe('Form')

      // Experiments: Experiment, FeatureFlag
      expect(experiments.Experiment.$name).toBe('Experiment')
      expect(experiments.FeatureFlag.$name).toBe('FeatureFlag')

      // Platform: Workflow, Integration, Agent
      expect(platform.Workflow.$name).toBe('Workflow')
      expect(platform.Integration.$name).toBe('Integration')
      expect(platform.Agent.$name).toBe('Agent')
    })

    it('entity count per domain matches spec', () => {
      // CRM: 6 entities (Organization, Contact, Lead, Deal, Activity, Pipeline)
      expect(Object.keys(crm).filter(k => crm[k]?.$name).length).toBe(6)

      // Billing: 7 entities (Customer, Product, Plan, Price, Subscription, Invoice, Payment)
      expect(Object.keys(billing).filter(k => billing[k]?.$name).length).toBe(7)

      // Projects: 3 entities
      expect(Object.keys(projects).filter(k => projects[k]?.$name).length).toBe(3)

      // Content: 3 entities
      expect(Object.keys(content).filter(k => content[k]?.$name).length).toBe(3)

      // Support: 1 entity
      expect(Object.keys(support).filter(k => support[k]?.$name).length).toBe(1)

      // Analytics: 4 entities
      expect(Object.keys(analytics).filter(k => analytics[k]?.$name).length).toBe(4)

      // Marketing: 3 entities
      expect(Object.keys(marketing).filter(k => marketing[k]?.$name).length).toBe(3)

      // Experiments: 2 entities
      expect(Object.keys(experiments).filter(k => experiments[k]?.$name).length).toBe(2)

      // Platform: 3 entities
      expect(Object.keys(platform).filter(k => platform[k]?.$name).length).toBe(3)
    })

    it('relationships form a connected graph (no orphan domains)', async () => {
      // Create one entity per domain and link them through cross-domain references
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

      // Every entity was created with a cross-domain reference
      // The organization ID serves as the graph hub connecting all domains
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
