import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Workflow, Integration, Agent } from '../src/index.js'

describe('@headlessly/platform — deep v2', () => {
  let provider: MemoryNounProvider

  beforeEach(() => {
    clearRegistry()
    provider = new MemoryNounProvider()
    setProvider(provider)
  })

  // ===========================================================================
  // 1. Workflow field-level schema coverage
  // ===========================================================================
  describe('Workflow field-level schema', () => {
    it('defines description as a plain string field', () => {
      const field = Workflow.$schema.fields.get('description')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.required).toBe(false)
    })

    it('defines steps as a plain string field', () => {
      const field = Workflow.$schema.fields.get('steps')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('defines retryPolicy as a plain string field', () => {
      const field = Workflow.$schema.fields.get('retryPolicy')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
    })

    it('defines timeout as a number field', () => {
      const field = Workflow.$schema.fields.get('timeout')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('number')
    })

    it('defines version, runCount, successCount, failureCount as number fields', () => {
      for (const name of ['version', 'runCount', 'successCount', 'failureCount']) {
        const field = Workflow.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.kind).toBe('field')
        expect(field!.type).toBe('number')
      }
    })

    it('defines lastRunAt as a datetime field', () => {
      const field = Workflow.$schema.fields.get('lastRunAt')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('datetime')
    })

    it('has the correct slug derived from name', () => {
      const schema = Workflow.$schema
      expect(schema.slug).toBe('workflow')
    })
  })

  // ===========================================================================
  // 2. Integration field-level schema coverage
  // ===========================================================================
  describe('Integration field-level schema', () => {
    it('defines slug as a string with unique+indexed modifiers', () => {
      const field = Integration.$schema.fields.get('slug')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.unique).toBe(true)
      expect(field!.modifiers?.indexed).toBe(true)
    })

    it('defines authType enum with OAuth2|ApiKey|Basic|Custom', () => {
      const field = Integration.$schema.fields.get('authType')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['OAuth2', 'ApiKey', 'Basic', 'Custom'])
    })

    it('defines providerUrl, providerLogo, oauthScopes, configSchema, apiBaseUrl as string fields', () => {
      for (const name of ['providerUrl', 'providerLogo', 'oauthScopes', 'configSchema', 'apiBaseUrl']) {
        const field = Integration.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.kind).toBe('field')
        expect(field!.type).toBe('string')
      }
    })

    it('defines webhookSupport and featured as string fields', () => {
      for (const name of ['webhookSupport', 'featured']) {
        const field = Integration.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.kind).toBe('field')
        expect(field!.type).toBe('string')
      }
    })

    it('has the correct slug derived from name', () => {
      expect(Integration.$schema.slug).toBe('integration')
    })
  })

  // ===========================================================================
  // 3. Agent field-level schema coverage
  // ===========================================================================
  describe('Agent field-level schema', () => {
    it('defines slug as unique+indexed string', () => {
      const field = Agent.$schema.fields.get('slug')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers?.unique).toBe(true)
      expect(field!.modifiers?.indexed).toBe(true)
    })

    it('defines model, systemPrompt, instructions, persona as string fields', () => {
      for (const name of ['model', 'systemPrompt', 'instructions', 'persona']) {
        const field = Agent.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.kind).toBe('field')
        expect(field!.type).toBe('string')
      }
    })

    it('defines temperature, maxTokens, totalTokens, totalCost, averageLatency as number fields', () => {
      for (const name of ['temperature', 'maxTokens', 'totalTokens', 'totalCost', 'averageLatency']) {
        const field = Agent.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.kind).toBe('field')
        expect(field!.type).toBe('number')
      }
    })

    it('defines successRate, rating, ratingCount, version, memoryWindow as number fields', () => {
      for (const name of ['successRate', 'rating', 'ratingCount', 'version', 'memoryWindow']) {
        const field = Agent.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.kind).toBe('field')
        expect(field!.type).toBe('number')
      }
    })

    it('defines publishedAt as a datetime field', () => {
      const field = Agent.$schema.fields.get('publishedAt')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('datetime')
    })

    it('defines avatar, tools, functions, knowledgeBases, tags as string fields', () => {
      for (const name of ['avatar', 'tools', 'functions', 'knowledgeBases', 'tags']) {
        const field = Agent.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.kind).toBe('field')
        expect(field!.type).toBe('string')
      }
    })

    it('has the correct slug derived from name', () => {
      expect(Agent.$schema.slug).toBe('agent')
    })
  })

  // ===========================================================================
  // 4. Custom verb execution — Workflow
  // ===========================================================================
  describe('Workflow custom verb execution', () => {
    it('activate sets status to Activated on an existing workflow', async () => {
      const wf = await Workflow.create({ name: 'Test Flow', trigger: 'Contact.created', status: 'Draft' })
      const activated = await Workflow.activate(wf.$id)
      expect(activated).toBeDefined()
      expect(activated.status).toBe('Activated')
    })

    it('pause sets status to Paused on an existing workflow', async () => {
      const wf = await Workflow.create({ name: 'Active Flow', trigger: 'Deal.closed', status: 'Active' })
      const paused = await Workflow.pause(wf.$id)
      expect(paused).toBeDefined()
      expect(paused.status).toBe('Paused')
    })

    it('archive sets status to Archived on an existing workflow', async () => {
      const wf = await Workflow.create({ name: 'Old Flow', trigger: 'Ticket.resolved', status: 'Active' })
      const archived = await Workflow.archive(wf.$id)
      expect(archived).toBeDefined()
      expect(archived.status).toBe('Archived')
    })
  })

  // ===========================================================================
  // 5. Custom verb execution — Integration
  // ===========================================================================
  describe('Integration custom verb execution', () => {
    it('connect sets status to Connected on an existing integration', async () => {
      const int = await Integration.create({ name: 'Stripe', provider: 'stripe', status: 'Available' })
      const connected = await Integration.connect(int.$id)
      expect(connected).toBeDefined()
      expect(connected.status).toBe('Connected')
    })

    it('disconnect sets status to Disconnected on an existing integration', async () => {
      const int = await Integration.create({ name: 'HubSpot', provider: 'hubspot', status: 'Available' })
      const disconnected = await Integration.disconnect(int.$id)
      expect(disconnected).toBeDefined()
      expect(disconnected.status).toBe('Disconnected')
    })
  })

  // ===========================================================================
  // 6. Custom verb execution — Agent
  // ===========================================================================
  describe('Agent custom verb execution', () => {
    it('deploy sets status to Deployed on an existing agent', async () => {
      const agent = await Agent.create({ name: 'Sales Bot', status: 'Draft' })
      const deployed = await Agent.deploy(agent.$id)
      expect(deployed).toBeDefined()
      expect(deployed.status).toBe('Deployed')
    })

    it('retire sets status to Retired on an existing agent', async () => {
      const agent = await Agent.create({ name: 'Old Bot', status: 'Active' })
      const retired = await Agent.retire(agent.$id)
      expect(retired).toBeDefined()
      expect(retired.status).toBe('Retired')
    })
  })

  // ===========================================================================
  // 7. BEFORE hook registration and execution
  // ===========================================================================
  describe('BEFORE hooks', () => {
    it('Workflow.activating registers a BEFORE hook and returns unsubscribe', () => {
      const handler = vi.fn()
      const unsub = Workflow.activating(handler)
      expect(typeof unsub).toBe('function')
    })

    it('Integration.connecting fires BEFORE hook when connect is called', async () => {
      const handler = vi.fn()
      Integration.connecting(handler)

      const int = await Integration.create({ name: 'Slack', provider: 'slack' })
      await Integration.connect(int.$id)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('Agent.deploying fires BEFORE hook when deploy is called', async () => {
      const handler = vi.fn()
      Agent.deploying(handler)

      const agent = await Agent.create({ name: 'Deploy Agent' })
      await Agent.deploy(agent.$id)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // 8. AFTER hook registration and execution
  // ===========================================================================
  describe('AFTER hooks', () => {
    it('Workflow.activated fires AFTER hook when activate completes', async () => {
      const handler = vi.fn()
      Workflow.activated(handler)

      const wf = await Workflow.create({ name: 'Hook Flow', trigger: 'Contact.created', status: 'Draft' })
      await Workflow.activate(wf.$id)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0]).toHaveProperty('$type', 'Workflow')
    })

    it('Integration.connected fires AFTER hook with the integration instance', async () => {
      const handler = vi.fn()
      Integration.connected(handler)

      const int = await Integration.create({ name: 'GitHub', provider: 'github' })
      await Integration.connect(int.$id)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].name).toBe('GitHub')
    })

    it('Agent.deployed fires AFTER hook with the agent instance', async () => {
      const handler = vi.fn()
      Agent.deployed(handler)

      const agent = await Agent.create({ name: 'Deployed Bot' })
      await Agent.deploy(agent.$id)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].name).toBe('Deployed Bot')
    })

    it('Agent.retired fires AFTER hook when retire completes', async () => {
      const handler = vi.fn()
      Agent.retired(handler)

      const agent = await Agent.create({ name: 'Retiring Bot', status: 'Active' })
      await Agent.retire(agent.$id)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // 9. Hook unsubscribe
  // ===========================================================================
  describe('hook unsubscribe', () => {
    it('unsubscribed AFTER hook is not called on subsequent verb executions', async () => {
      const handler = vi.fn()
      const unsub = Workflow.activated(handler)

      const wf1 = await Workflow.create({ name: 'Flow 1', trigger: 'test', status: 'Draft' })
      await Workflow.activate(wf1.$id)
      expect(handler).toHaveBeenCalledTimes(1)

      unsub()

      const wf2 = await Workflow.create({ name: 'Flow 2', trigger: 'test', status: 'Draft' })
      await Workflow.activate(wf2.$id)
      expect(handler).toHaveBeenCalledTimes(1) // still 1 — not called again
    })

    it('unsubscribed BEFORE hook is not called on subsequent verb executions', async () => {
      const handler = vi.fn()
      const unsub = Agent.deploying(handler)

      const a1 = await Agent.create({ name: 'Agent 1' })
      await Agent.deploy(a1.$id)
      expect(handler).toHaveBeenCalledTimes(1)

      unsub()

      const a2 = await Agent.create({ name: 'Agent 2' })
      await Agent.deploy(a2.$id)
      expect(handler).toHaveBeenCalledTimes(1) // still 1
    })
  })

  // ===========================================================================
  // 10. Find with filters and MongoDB-style operators
  // ===========================================================================
  describe('find with filters', () => {
    it('finds workflows by status', async () => {
      await Workflow.create({ name: 'Draft Flow', trigger: 'a', status: 'Draft' })
      await Workflow.create({ name: 'Active Flow 1', trigger: 'b', status: 'Active' })
      await Workflow.create({ name: 'Active Flow 2', trigger: 'c', status: 'Active' })
      await Workflow.create({ name: 'Paused Flow', trigger: 'd', status: 'Paused' })

      const active = await Workflow.find({ status: 'Active' })
      expect(active).toHaveLength(2)
      expect(active.every((w: any) => w.status === 'Active')).toBe(true)
    })

    it('finds agents by type', async () => {
      await Agent.create({ name: 'A1', type: 'Specialist' })
      await Agent.create({ name: 'A2', type: 'Router' })
      await Agent.create({ name: 'A3', type: 'Specialist' })

      const specialists = await Agent.find({ type: 'Specialist' })
      expect(specialists).toHaveLength(2)
    })

    it('finds integrations by category', async () => {
      await Integration.create({ name: 'Stripe', provider: 'stripe', category: 'Payment' })
      await Integration.create({ name: 'Twilio', provider: 'twilio', category: 'Communication' })
      await Integration.create({ name: 'PayPal', provider: 'paypal', category: 'Payment' })

      const payments = await Integration.find({ category: 'Payment' })
      expect(payments).toHaveLength(2)
    })

    it('finds agents using $in operator on type field', async () => {
      await Agent.create({ name: 'A1', type: 'Specialist' })
      await Agent.create({ name: 'A2', type: 'Router' })
      await Agent.create({ name: 'A3', type: 'Assistant' })
      await Agent.create({ name: 'A4', type: 'Autonomous' })

      const subset = await Agent.find({ type: { $in: ['Specialist', 'Router'] } })
      expect(subset).toHaveLength(2)
    })

    it('finds agents using $regex on name', async () => {
      await Agent.create({ name: 'Sales Bot Alpha' })
      await Agent.create({ name: 'Sales Bot Beta' })
      await Agent.create({ name: 'Support Agent' })

      const salesBots = await Agent.find({ name: { $regex: '^Sales Bot' } })
      expect(salesBots).toHaveLength(2)
    })

    it('find returns empty array when nothing matches', async () => {
      await Workflow.create({ name: 'Only One', trigger: 'x', status: 'Draft' })

      const result = await Workflow.find({ status: 'Archived' })
      expect(result).toEqual([])
    })
  })

  // ===========================================================================
  // 11. Workflow full data scenario
  // ===========================================================================
  describe('Workflow full data scenario', () => {
    it('creates a workflow with all fields populated', async () => {
      const steps = JSON.stringify([
        { action: 'Contact.qualify', condition: 'leadScore > 80' },
        { action: 'Deal.create', params: { stage: 'Qualification' } },
      ])
      const wf = await Workflow.create({
        name: 'Lead Qualification Pipeline',
        description: 'Automatically qualify high-scoring leads',
        trigger: 'Contact.created',
        steps,
        retryPolicy: JSON.stringify({ maxRetries: 3, backoff: 'exponential' }),
        errorHandling: 'Continue',
        timeout: 30000,
        status: 'Draft',
        version: 1,
        runCount: 0,
        successCount: 0,
        failureCount: 0,
      })

      expect(wf.name).toBe('Lead Qualification Pipeline')
      expect(wf.description).toBe('Automatically qualify high-scoring leads')
      expect(wf.trigger).toBe('Contact.created')
      expect(wf.steps).toBe(steps)
      expect(wf.errorHandling).toBe('Continue')
      expect(wf.timeout).toBe(30000)
      expect(wf.status).toBe('Draft')
      expect(wf.version).toBe(1)
      expect(wf.runCount).toBe(0)
    })

    it('increments version on successive updates', async () => {
      const wf = await Workflow.create({ name: 'V Test', trigger: 't' })
      expect(wf.$version).toBe(1)

      const v2 = await Workflow.update(wf.$id, { runCount: 1 })
      expect(v2.$version).toBe(2)

      const v3 = await Workflow.update(wf.$id, { runCount: 2 })
      expect(v3.$version).toBe(3)
    })
  })

  // ===========================================================================
  // 12. Integration full data scenario
  // ===========================================================================
  describe('Integration full data scenario', () => {
    it('creates an integration with all fields populated', async () => {
      const int = await Integration.create({
        name: 'Stripe Payments',
        slug: 'stripe',
        description: 'Payment processing via Stripe',
        provider: 'stripe',
        providerUrl: 'https://stripe.com',
        providerLogo: 'https://stripe.com/logo.svg',
        category: 'Payment',
        authType: 'OAuth2',
        oauthScopes: 'read_write',
        configSchema: JSON.stringify({ apiKey: 'string', webhookSecret: 'string' }),
        status: 'Available',
        featured: 'true',
        apiBaseUrl: 'https://api.stripe.com/v1',
        webhookSupport: 'true',
      })

      expect(int.name).toBe('Stripe Payments')
      expect(int.slug).toBe('stripe')
      expect(int.providerUrl).toBe('https://stripe.com')
      expect(int.category).toBe('Payment')
      expect(int.authType).toBe('OAuth2')
      expect(int.webhookSupport).toBe('true')
    })
  })

  // ===========================================================================
  // 13. Agent full data scenario
  // ===========================================================================
  describe('Agent full data scenario', () => {
    it('creates an agent with comprehensive configuration', async () => {
      const agent = await Agent.create({
        name: 'Sales Qualifier',
        slug: 'sales-qualifier',
        description: 'Qualifies inbound leads by analyzing engagement signals',
        avatar: 'https://example.com/avatar.png',
        model: 'claude-opus-4-6',
        systemPrompt: 'You are a sales qualification agent.',
        instructions: 'Analyze company fit and engagement signals.',
        persona: 'Professional and data-driven',
        type: 'Specialist',
        status: 'Draft',
        visibility: 'Team',
        temperature: 0.7,
        maxTokens: 4096,
        tools: 'search,fetch,do',
        functions: JSON.stringify(['qualify_lead', 'score_engagement']),
        knowledgeBases: 'sales-playbook,product-docs',
        memory: 'Persistent',
        memoryWindow: 50,
        totalTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        successRate: 0,
        rating: 0,
        ratingCount: 0,
        version: 1,
        tags: 'sales,qualification,ai',
      })

      expect(agent.name).toBe('Sales Qualifier')
      expect(agent.slug).toBe('sales-qualifier')
      expect(agent.model).toBe('claude-opus-4-6')
      expect(agent.type).toBe('Specialist')
      expect(agent.visibility).toBe('Team')
      expect(agent.temperature).toBe(0.7)
      expect(agent.maxTokens).toBe(4096)
      expect(agent.memory).toBe('Persistent')
      expect(agent.memoryWindow).toBe(50)
      expect(agent.tools).toBe('search,fetch,do')
      expect(agent.tags).toBe('sales,qualification,ai')
    })
  })

  // ===========================================================================
  // 14. Delete and verify
  // ===========================================================================
  describe('delete and verify', () => {
    it('deletes a workflow and confirms it is gone', async () => {
      const wf = await Workflow.create({ name: 'Deletable', trigger: 'test' })
      const deleted = await Workflow.delete(wf.$id)
      expect(deleted).toBe(true)

      const gone = await Workflow.get(wf.$id)
      expect(gone).toBeNull()
    })

    it('deletes an integration and confirms it is gone', async () => {
      const int = await Integration.create({ name: 'Deletable', provider: 'test' })
      const deleted = await Integration.delete(int.$id)
      expect(deleted).toBe(true)

      const gone = await Integration.get(int.$id)
      expect(gone).toBeNull()
    })

    it('deletes an agent and confirms it is gone', async () => {
      const agent = await Agent.create({ name: 'Deletable' })
      const deleted = await Agent.delete(agent.$id)
      expect(deleted).toBe(true)

      const gone = await Agent.get(agent.$id)
      expect(gone).toBeNull()
    })
  })

  // ===========================================================================
  // 15. Schema raw definition access
  // ===========================================================================
  describe('schema raw definition', () => {
    it('Workflow raw definition preserves all original property strings', () => {
      const raw = Workflow.$schema.raw
      expect(raw.name).toBe('string!')
      expect(raw.trigger).toBe('string!')
      expect(raw.status).toBe('Draft | Active | Paused | Archived')
      expect(raw.errorHandling).toBe('Stop | Continue | Fallback')
      expect(raw.activate).toBe('Activated')
      expect(raw.pause).toBe('Paused')
      expect(raw.archive).toBe('Archived')
    })

    it('Integration raw definition preserves original property strings', () => {
      const raw = Integration.$schema.raw
      expect(raw.name).toBe('string!')
      expect(raw.slug).toBe('string##')
      expect(raw.provider).toBe('string!')
      expect(raw.connect).toBe('Connected')
      expect(raw.disconnect).toBe('Disconnected')
    })

    it('Agent raw definition preserves original property strings', () => {
      const raw = Agent.$schema.raw
      expect(raw.name).toBe('string!')
      expect(raw.slug).toBe('string##')
      expect(raw.deploy).toBe('Deployed')
      expect(raw.pause).toBe('Paused')
      expect(raw.retire).toBe('Retired')
      expect(raw.memory).toBe('None | Session | Persistent')
    })
  })

  // ===========================================================================
  // 16. Entity ID format
  // ===========================================================================
  describe('entity ID format', () => {
    it('Workflow IDs have the format workflow_{8chars}', async () => {
      const wf = await Workflow.create({ name: 'ID Test', trigger: 'x' })
      expect(wf.$id).toMatch(/^workflow_[a-zA-Z0-9]{8}$/)
    })

    it('Integration IDs have the format integration_{8chars}', async () => {
      const int = await Integration.create({ name: 'ID Test', provider: 'x' })
      expect(int.$id).toMatch(/^integration_[a-zA-Z0-9]{8}$/)
    })

    it('Agent IDs have the format agent_{8chars}', async () => {
      const agent = await Agent.create({ name: 'ID Test' })
      expect(agent.$id).toMatch(/^agent_[a-zA-Z0-9]{8}$/)
    })
  })

  // ===========================================================================
  // 17. Cross-entity workflow scenario
  // ===========================================================================
  describe('cross-entity platform scenario', () => {
    it('creates a workflow, integration, and agent and retrieves all three', async () => {
      const wf = await Workflow.create({ name: 'Onboarding', trigger: 'Contact.created', status: 'Active' })
      const int = await Integration.create({ name: 'Stripe', provider: 'stripe', category: 'Payment' })
      const agent = await Agent.create({ name: 'Onboarding Bot', type: 'Workflow', status: 'Active' })

      const fetchedWf = await Workflow.get(wf.$id)
      const fetchedInt = await Integration.get(int.$id)
      const fetchedAgent = await Agent.get(agent.$id)

      expect(fetchedWf).not.toBeNull()
      expect(fetchedWf!.name).toBe('Onboarding')
      expect(fetchedInt).not.toBeNull()
      expect(fetchedInt!.name).toBe('Stripe')
      expect(fetchedAgent).not.toBeNull()
      expect(fetchedAgent!.name).toBe('Onboarding Bot')
    })

    it('find all entities of each type independently', async () => {
      await Workflow.create({ name: 'WF1', trigger: 'a' })
      await Workflow.create({ name: 'WF2', trigger: 'b' })
      await Integration.create({ name: 'Int1', provider: 'p1' })
      await Agent.create({ name: 'Ag1' })
      await Agent.create({ name: 'Ag2' })
      await Agent.create({ name: 'Ag3' })

      const workflows = await Workflow.find()
      const integrations = await Integration.find()
      const agents = await Agent.find()

      expect(workflows).toHaveLength(2)
      expect(integrations).toHaveLength(1)
      expect(agents).toHaveLength(3)
    })
  })
})
