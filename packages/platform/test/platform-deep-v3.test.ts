import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Workflow, Integration, Agent } from '../src/index.js'

describe('@headlessly/platform — deep v3', () => {
  let provider: MemoryNounProvider

  beforeEach(() => {
    clearRegistry()
    provider = new MemoryNounProvider()
    setProvider(provider)
  })

  // ===========================================================================
  // 1. Workflow step sequencing and validation (6 tests)
  // ===========================================================================
  describe('Workflow step sequencing and validation', () => {
    it('creates a workflow with multi-step JSON pipeline', async () => {
      const steps = JSON.stringify([
        { order: 1, action: 'Contact.qualify', condition: 'leadScore > 80' },
        { order: 2, action: 'Deal.create', params: { stage: 'Qualification' } },
        { order: 3, action: 'Agent.notify', params: { channel: 'slack' } },
      ])
      const wf = await Workflow.create({ name: 'Multi-Step Pipeline', trigger: 'Contact.created', steps })
      const parsed = JSON.parse(wf.steps as string)
      expect(parsed).toHaveLength(3)
      expect(parsed[0].order).toBe(1)
      expect(parsed[2].action).toBe('Agent.notify')
    })

    it('updates workflow steps without losing trigger or name', async () => {
      const wf = await Workflow.create({
        name: 'Evolving Flow',
        trigger: 'Deal.closed',
        steps: JSON.stringify([{ action: 'Invoice.create' }]),
      })
      const newSteps = JSON.stringify([
        { action: 'Invoice.create' },
        { action: 'Payment.request' },
      ])
      const updated = await Workflow.update(wf.$id, { steps: newSteps })
      expect(updated.name).toBe('Evolving Flow')
      expect(updated.trigger).toBe('Deal.closed')
      const parsed = JSON.parse(updated.steps as string)
      expect(parsed).toHaveLength(2)
    })

    it('creates a workflow with conditional branching steps', async () => {
      const steps = JSON.stringify({
        type: 'conditional',
        branches: [
          { condition: 'deal.value > 10000', action: 'Agent.escalate' },
          { condition: 'deal.value <= 10000', action: 'Agent.autoClose' },
        ],
      })
      const wf = await Workflow.create({ name: 'Branching Flow', trigger: 'Deal.updated', steps })
      const parsed = JSON.parse(wf.steps as string)
      expect(parsed.type).toBe('conditional')
      expect(parsed.branches).toHaveLength(2)
    })

    it('creates a workflow with retry policy configuration', async () => {
      const retryPolicy = JSON.stringify({
        maxRetries: 5,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 60000,
      })
      const wf = await Workflow.create({
        name: 'Retry Flow',
        trigger: 'Webhook.received',
        retryPolicy,
        errorHandling: 'Fallback',
      })
      const parsed = JSON.parse(wf.retryPolicy as string)
      expect(parsed.maxRetries).toBe(5)
      expect(parsed.backoff).toBe('exponential')
      expect(wf.errorHandling).toBe('Fallback')
    })

    it('tracks workflow run statistics through updates', async () => {
      const wf = await Workflow.create({
        name: 'Stats Flow',
        trigger: 'Event.tracked',
        runCount: 0,
        successCount: 0,
        failureCount: 0,
      })
      const after10 = await Workflow.update(wf.$id, { runCount: 10, successCount: 8, failureCount: 2 })
      expect(after10.runCount).toBe(10)
      expect(after10.successCount).toBe(8)
      expect(after10.failureCount).toBe(2)
    })

    it('stores timeout as a numeric millisecond value', async () => {
      const wf = await Workflow.create({ name: 'Timeout Flow', trigger: 'api.call', timeout: 120000 })
      expect(wf.timeout).toBe(120000)
      expect(typeof wf.timeout).toBe('number')
    })
  })

  // ===========================================================================
  // 2. Integration config schema validation (5 tests)
  // ===========================================================================
  describe('Integration config schema validation', () => {
    it('stores OAuth2 integration with scopes and config schema', async () => {
      const configSchema = JSON.stringify({
        required: ['apiKey', 'webhookSecret'],
        properties: {
          apiKey: { type: 'string', description: 'API Key' },
          webhookSecret: { type: 'string', description: 'Webhook signing secret' },
        },
      })
      const int = await Integration.create({
        name: 'Stripe Full',
        provider: 'stripe',
        authType: 'OAuth2',
        oauthScopes: 'read_write charges:create',
        configSchema,
      })
      expect(int.authType).toBe('OAuth2')
      const parsed = JSON.parse(int.configSchema as string)
      expect(parsed.required).toContain('apiKey')
    })

    it('creates ApiKey-type integration with base URL', async () => {
      const int = await Integration.create({
        name: 'SendGrid',
        provider: 'sendgrid',
        authType: 'ApiKey',
        apiBaseUrl: 'https://api.sendgrid.com/v3',
        category: 'Communication',
      })
      expect(int.authType).toBe('ApiKey')
      expect(int.apiBaseUrl).toBe('https://api.sendgrid.com/v3')
    })

    it('creates Basic auth integration', async () => {
      const int = await Integration.create({
        name: 'Legacy API',
        provider: 'legacy',
        authType: 'Basic',
        category: 'Other',
      })
      expect(int.authType).toBe('Basic')
      expect(int.category).toBe('Other')
    })

    it('creates Custom auth integration with webhook support', async () => {
      const int = await Integration.create({
        name: 'Custom Webhook',
        provider: 'custom',
        authType: 'Custom',
        webhookSupport: 'true',
        configSchema: JSON.stringify({ hmacSecret: 'string' }),
      })
      expect(int.authType).toBe('Custom')
      expect(int.webhookSupport).toBe('true')
    })

    it('stores provider metadata (URL, logo) on integration', async () => {
      const int = await Integration.create({
        name: 'GitHub Integration',
        provider: 'github',
        providerUrl: 'https://github.com',
        providerLogo: 'https://github.com/favicon.ico',
        category: 'Storage',
        featured: 'true',
      })
      expect(int.providerUrl).toBe('https://github.com')
      expect(int.providerLogo).toBe('https://github.com/favicon.ico')
      expect(int.featured).toBe('true')
    })
  })

  // ===========================================================================
  // 3. Agent capability definitions (6 tests)
  // ===========================================================================
  describe('Agent capability definitions', () => {
    it('creates an autonomous agent with persistent memory', async () => {
      const agent = await Agent.create({
        name: 'Autonomous Sales Bot',
        type: 'Autonomous',
        memory: 'Persistent',
        memoryWindow: 100,
        model: 'claude-opus-4-6',
        temperature: 0.3,
        maxTokens: 8192,
      })
      expect(agent.type).toBe('Autonomous')
      expect(agent.memory).toBe('Persistent')
      expect(agent.memoryWindow).toBe(100)
      expect(agent.temperature).toBe(0.3)
    })

    it('creates a router agent with multiple tools', async () => {
      const agent = await Agent.create({
        name: 'Request Router',
        type: 'Router',
        tools: 'search,fetch,do,classify',
        functions: JSON.stringify(['route_request', 'classify_intent', 'escalate']),
        visibility: 'Organization',
      })
      expect(agent.type).toBe('Router')
      expect(agent.tools).toBe('search,fetch,do,classify')
      expect(agent.visibility).toBe('Organization')
      const fns = JSON.parse(agent.functions as string)
      expect(fns).toContain('route_request')
    })

    it('creates a workflow agent with knowledge bases', async () => {
      const agent = await Agent.create({
        name: 'Workflow Runner',
        type: 'Workflow',
        knowledgeBases: 'product-docs,api-reference,faq',
        memory: 'Session',
        systemPrompt: 'Execute workflow steps precisely.',
      })
      expect(agent.type).toBe('Workflow')
      expect(agent.knowledgeBases).toBe('product-docs,api-reference,faq')
      expect(agent.memory).toBe('Session')
    })

    it('creates an assistant agent with public visibility', async () => {
      const agent = await Agent.create({
        name: 'Public Helper',
        type: 'Assistant',
        visibility: 'Public',
        persona: 'Friendly and concise',
        tags: 'public,helper,general',
      })
      expect(agent.visibility).toBe('Public')
      expect(agent.persona).toBe('Friendly and concise')
      expect(agent.tags).toBe('public,helper,general')
    })

    it('creates a specialist agent with rating metrics', async () => {
      const agent = await Agent.create({ name: 'Expert Agent', type: 'Specialist' })
      const updated = await Agent.update(agent.$id, {
        rating: 4.8,
        ratingCount: 150,
        successRate: 0.95,
        totalTokens: 1500000,
        totalCost: 45.50,
        averageLatency: 1200,
      })
      expect(updated.rating).toBe(4.8)
      expect(updated.ratingCount).toBe(150)
      expect(updated.successRate).toBe(0.95)
      expect(updated.totalTokens).toBe(1500000)
      expect(updated.totalCost).toBe(45.50)
      expect(updated.averageLatency).toBe(1200)
    })

    it('updates agent version and publishedAt for deployment', async () => {
      const agent = await Agent.create({ name: 'Versioned Agent', version: 1 })
      const published = await Agent.update(agent.$id, {
        version: 2,
        publishedAt: '2025-06-15T12:00:00Z',
        status: 'Active',
      })
      expect(published.version).toBe(2)
      expect(published.publishedAt).toBe('2025-06-15T12:00:00Z')
      expect(published.status).toBe('Active')
    })
  })

  // ===========================================================================
  // 4. Cross-entity operations (7 tests)
  // ===========================================================================
  describe('Cross-entity operations', () => {
    it('workflow trigger references integration entity events', async () => {
      const int = await Integration.create({ name: 'Stripe', provider: 'stripe', category: 'Payment' })
      const wf = await Workflow.create({
        name: 'Payment Handler',
        trigger: `Integration.connected:${int.$id}`,
        steps: JSON.stringify([{ action: 'Customer.sync' }]),
      })
      expect(wf.trigger).toContain(int.$id)
    })

    it('agent executes workflow by referencing workflow ID in tools', async () => {
      const wf = await Workflow.create({ name: 'Onboarding Flow', trigger: 'Contact.created', status: 'Active' })
      const agent = await Agent.create({
        name: 'Onboarding Agent',
        type: 'Workflow',
        tools: `workflow:${wf.$id}`,
        instructions: `Execute workflow ${wf.$id} for new contacts`,
      })
      expect(agent.tools).toContain(wf.$id)
      expect(agent.instructions).toContain(wf.$id)
    })

    it('agent and workflow share the same organization reference', async () => {
      const orgId = 'organization_AbCdEfGh'
      const wf = await Workflow.create({ name: 'Org Flow', trigger: 'test', organization: orgId })
      const agent = await Agent.create({ name: 'Org Agent', organization: orgId })
      expect(wf.organization).toBe(orgId)
      expect(agent.organization).toBe(orgId)
    })

    it('fires workflow activated hook after activating a workflow referenced by agent', async () => {
      const handler = vi.fn()
      Workflow.activated(handler)

      const wf = await Workflow.create({ name: 'Agent Flow', trigger: 'Agent.deployed', status: 'Draft' })
      await Workflow.activate(wf.$id)

      expect(handler).toHaveBeenCalledTimes(1)
      const instance = handler.mock.calls[0][0]
      expect(instance.$type).toBe('Workflow')
      expect(instance.status).toBe('Activated')
    })

    it('creates all three entity types and retrieves them independently', async () => {
      const wf = await Workflow.create({ name: 'Cross WF', trigger: 'test' })
      const int = await Integration.create({ name: 'Cross Int', provider: 'test' })
      const agent = await Agent.create({ name: 'Cross Agent' })

      const allWorkflows = await Workflow.find()
      const allIntegrations = await Integration.find()
      const allAgents = await Agent.find()

      expect(allWorkflows).toHaveLength(1)
      expect(allIntegrations).toHaveLength(1)
      expect(allAgents).toHaveLength(1)
      expect(allWorkflows[0].$id).toBe(wf.$id)
      expect(allIntegrations[0].$id).toBe(int.$id)
      expect(allAgents[0].$id).toBe(agent.$id)
    })

    it('entities of different types have isolated namespaces', async () => {
      await Workflow.create({ name: 'Same Name', trigger: 'test' })
      await Integration.create({ name: 'Same Name', provider: 'test' })
      await Agent.create({ name: 'Same Name' })

      const workflows = await Workflow.find({ name: 'Same Name' })
      const integrations = await Integration.find({ name: 'Same Name' })
      const agents = await Agent.find({ name: 'Same Name' })

      expect(workflows).toHaveLength(1)
      expect(integrations).toHaveLength(1)
      expect(agents).toHaveLength(1)
      expect(workflows[0].$type).toBe('Workflow')
      expect(integrations[0].$type).toBe('Integration')
      expect(agents[0].$type).toBe('Agent')
    })

    it('AFTER hook on integration connect triggers workflow creation', async () => {
      const createdWorkflows: string[] = []
      Integration.connected(async (instance) => {
        const wf = await Workflow.create({
          name: `Sync for ${instance.name}`,
          trigger: `Integration.connected:${instance.$id}`,
        })
        createdWorkflows.push(wf.$id)
      })

      const int = await Integration.create({ name: 'HubSpot', provider: 'hubspot' })
      await Integration.connect(int.$id)

      expect(createdWorkflows).toHaveLength(1)
      const wf = await Workflow.get(createdWorkflows[0])
      expect(wf).not.toBeNull()
      expect(wf!.name).toBe('Sync for HubSpot')
    })
  })

  // ===========================================================================
  // 5. Concurrent operations (5 tests)
  // ===========================================================================
  describe('Concurrent operations', () => {
    it('creates multiple workflows concurrently with Promise.all', async () => {
      const results = await Promise.all([
        Workflow.create({ name: 'Concurrent WF 1', trigger: 'a' }),
        Workflow.create({ name: 'Concurrent WF 2', trigger: 'b' }),
        Workflow.create({ name: 'Concurrent WF 3', trigger: 'c' }),
        Workflow.create({ name: 'Concurrent WF 4', trigger: 'd' }),
        Workflow.create({ name: 'Concurrent WF 5', trigger: 'e' }),
      ])
      expect(results).toHaveLength(5)
      const ids = results.map((r) => r.$id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(5)
    })

    it('creates entities of all three types concurrently', async () => {
      const [wf, int, agent] = await Promise.all([
        Workflow.create({ name: 'Parallel WF', trigger: 'test' }),
        Integration.create({ name: 'Parallel Int', provider: 'test' }),
        Agent.create({ name: 'Parallel Agent' }),
      ])
      expect(wf.$type).toBe('Workflow')
      expect(int.$type).toBe('Integration')
      expect(agent.$type).toBe('Agent')
    })

    it('concurrent reads after writes return consistent data', async () => {
      const wf1 = await Workflow.create({ name: 'Read Test 1', trigger: 'a' })
      const wf2 = await Workflow.create({ name: 'Read Test 2', trigger: 'b' })
      const wf3 = await Workflow.create({ name: 'Read Test 3', trigger: 'c' })

      const [r1, r2, r3] = await Promise.all([Workflow.get(wf1.$id), Workflow.get(wf2.$id), Workflow.get(wf3.$id)])
      expect(r1!.name).toBe('Read Test 1')
      expect(r2!.name).toBe('Read Test 2')
      expect(r3!.name).toBe('Read Test 3')
    })

    it('concurrent updates to different entities succeed independently', async () => {
      const wf = await Workflow.create({ name: 'Update WF', trigger: 'test', runCount: 0 })
      const agent = await Agent.create({ name: 'Update Agent', totalTokens: 0 })

      const [updatedWf, updatedAgent] = await Promise.all([
        Workflow.update(wf.$id, { runCount: 42 }),
        Agent.update(agent.$id, { totalTokens: 5000 }),
      ])
      expect(updatedWf.runCount).toBe(42)
      expect(updatedAgent.totalTokens).toBe(5000)
    })

    it('concurrent find operations return correct filtered results', async () => {
      await Promise.all([
        Agent.create({ name: 'Spec 1', type: 'Specialist' }),
        Agent.create({ name: 'Spec 2', type: 'Specialist' }),
        Agent.create({ name: 'Router 1', type: 'Router' }),
        Agent.create({ name: 'Assist 1', type: 'Assistant' }),
      ])

      const [specialists, routers, assistants] = await Promise.all([
        Agent.find({ type: 'Specialist' }),
        Agent.find({ type: 'Router' }),
        Agent.find({ type: 'Assistant' }),
      ])
      expect(specialists).toHaveLength(2)
      expect(routers).toHaveLength(1)
      expect(assistants).toHaveLength(1)
    })
  })

  // ===========================================================================
  // 6. Bulk CRUD operations (5 tests)
  // ===========================================================================
  describe('Bulk CRUD operations', () => {
    it('creates 10 workflows and finds them all', async () => {
      for (let i = 0; i < 10; i++) {
        await Workflow.create({ name: `Bulk WF ${i}`, trigger: `trigger_${i}` })
      }
      const all = await Workflow.find()
      expect(all).toHaveLength(10)
    })

    it('creates 10 agents, deletes 5, and verifies remaining count', async () => {
      const agents = []
      for (let i = 0; i < 10; i++) {
        agents.push(await Agent.create({ name: `Bulk Agent ${i}` }))
      }
      for (let i = 0; i < 5; i++) {
        await Agent.delete(agents[i].$id)
      }
      const remaining = await Agent.find()
      expect(remaining).toHaveLength(5)
      expect(remaining.every((a: any) => Number(a.name.replace('Bulk Agent ', '')) >= 5)).toBe(true)
    })

    it('creates many integrations and filters by category', async () => {
      const categories = ['Payment', 'CRM', 'Marketing', 'Analytics', 'Communication', 'Storage', 'AI', 'Other']
      for (const cat of categories) {
        await Integration.create({ name: `${cat} Integration`, provider: cat.toLowerCase(), category: cat })
      }
      const all = await Integration.find()
      expect(all).toHaveLength(8)

      const payments = await Integration.find({ category: 'Payment' })
      expect(payments).toHaveLength(1)
    })

    it('updates all workflows in a batch loop', async () => {
      const workflows = []
      for (let i = 0; i < 5; i++) {
        workflows.push(await Workflow.create({ name: `Batch WF ${i}`, trigger: 'test', status: 'Draft' }))
      }
      for (const wf of workflows) {
        await Workflow.update(wf.$id, { status: 'Active' })
      }
      const active = await Workflow.find({ status: 'Active' })
      expect(active).toHaveLength(5)
    })

    it('generates unique IDs across many entities', async () => {
      const ids = new Set<string>()
      for (let i = 0; i < 20; i++) {
        const agent = await Agent.create({ name: `ID Agent ${i}` })
        ids.add(agent.$id)
      }
      expect(ids.size).toBe(20)
    })
  })

  // ===========================================================================
  // 7. Advanced filtering with MongoDB operators (8 tests)
  // ===========================================================================
  describe('Advanced filtering with MongoDB operators', () => {
    it('finds workflows using $ne to exclude a status', async () => {
      await Workflow.create({ name: 'Draft WF', trigger: 'a', status: 'Draft' })
      await Workflow.create({ name: 'Active WF', trigger: 'b', status: 'Active' })
      await Workflow.create({ name: 'Paused WF', trigger: 'c', status: 'Paused' })

      const notDraft = await Workflow.find({ status: { $ne: 'Draft' } })
      expect(notDraft).toHaveLength(2)
      expect(notDraft.every((w: any) => w.status !== 'Draft')).toBe(true)
    })

    it('finds agents using $nin to exclude multiple types', async () => {
      await Agent.create({ name: 'A1', type: 'Specialist' })
      await Agent.create({ name: 'A2', type: 'Router' })
      await Agent.create({ name: 'A3', type: 'Assistant' })
      await Agent.create({ name: 'A4', type: 'Autonomous' })
      await Agent.create({ name: 'A5', type: 'Workflow' })

      const excluded = await Agent.find({ type: { $nin: ['Specialist', 'Router'] } })
      expect(excluded).toHaveLength(3)
      expect(excluded.every((a: any) => a.type !== 'Specialist' && a.type !== 'Router')).toBe(true)
    })

    it('finds workflows using $gt on runCount', async () => {
      await Workflow.create({ name: 'Low', trigger: 'a', runCount: 5 })
      await Workflow.create({ name: 'Med', trigger: 'b', runCount: 50 })
      await Workflow.create({ name: 'High', trigger: 'c', runCount: 500 })

      const highRunners = await Workflow.find({ runCount: { $gt: 10 } })
      expect(highRunners).toHaveLength(2)
    })

    it('finds agents using $gte on rating', async () => {
      await Agent.create({ name: 'Low Rated', rating: 3.0 })
      await Agent.create({ name: 'Mid Rated', rating: 4.0 })
      await Agent.create({ name: 'High Rated', rating: 4.5 })
      await Agent.create({ name: 'Top Rated', rating: 5.0 })

      const goodAgents = await Agent.find({ rating: { $gte: 4.0 } })
      expect(goodAgents).toHaveLength(3)
    })

    it('finds workflows using $lt on timeout', async () => {
      await Workflow.create({ name: 'Fast', trigger: 'a', timeout: 5000 })
      await Workflow.create({ name: 'Medium', trigger: 'b', timeout: 30000 })
      await Workflow.create({ name: 'Slow', trigger: 'c', timeout: 120000 })

      const quickOnes = await Workflow.find({ timeout: { $lt: 30000 } })
      expect(quickOnes).toHaveLength(1)
      expect(quickOnes[0].name).toBe('Fast')
    })

    it('finds agents using $lte on totalCost', async () => {
      await Agent.create({ name: 'Cheap', totalCost: 10 })
      await Agent.create({ name: 'Moderate', totalCost: 50 })
      await Agent.create({ name: 'Expensive', totalCost: 100 })

      const affordable = await Agent.find({ totalCost: { $lte: 50 } })
      expect(affordable).toHaveLength(2)
    })

    it('finds entities using $exists to check for optional fields', async () => {
      await Workflow.create({ name: 'With Desc', trigger: 'a', description: 'has one' })
      await Workflow.create({ name: 'No Desc', trigger: 'b' })

      const withDesc = await Workflow.find({ description: { $exists: true } })
      expect(withDesc.length).toBeGreaterThanOrEqual(1)
      expect(withDesc.some((w: any) => w.name === 'With Desc')).toBe(true)
    })

    it('finds integrations using $regex for partial name match', async () => {
      await Integration.create({ name: 'Stripe Payments', provider: 'stripe' })
      await Integration.create({ name: 'Stripe Billing', provider: 'stripe' })
      await Integration.create({ name: 'PayPal Payments', provider: 'paypal' })

      const stripeIntegrations = await Integration.find({ name: { $regex: 'Stripe' } })
      expect(stripeIntegrations).toHaveLength(2)
    })
  })

  // ===========================================================================
  // 8. Error recovery patterns (6 tests)
  // ===========================================================================
  describe('Error recovery patterns', () => {
    it('Workflow.get returns null for non-existent ID', async () => {
      const result = await Workflow.get('workflow_notExist')
      expect(result).toBeNull()
    })

    it('Integration.get returns null for non-existent ID', async () => {
      const result = await Integration.get('integration_notExist')
      expect(result).toBeNull()
    })

    it('Agent.get returns null for non-existent ID', async () => {
      const result = await Agent.get('agent_notExist')
      expect(result).toBeNull()
    })

    it('Workflow.find with no matches returns empty array', async () => {
      const result = await Workflow.find({ name: 'does not exist' })
      expect(result).toEqual([])
    })

    it('Workflow.find with no data returns empty array', async () => {
      const result = await Workflow.find()
      expect(result).toEqual([])
    })

    it('Agent.delete returns true after successful deletion', async () => {
      const agent = await Agent.create({ name: 'To Delete' })
      const result = await Agent.delete(agent.$id)
      expect(result).toBe(true)
    })
  })

  // ===========================================================================
  // 9. Multiple hooks on same verb (4 tests)
  // ===========================================================================
  describe('Multiple hooks on same verb', () => {
    it('multiple AFTER hooks on Workflow.activated all fire', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      Workflow.activated(handler1)
      Workflow.activated(handler2)
      Workflow.activated(handler3)

      const wf = await Workflow.create({ name: 'Multi Hook WF', trigger: 'test', status: 'Draft' })
      await Workflow.activate(wf.$id)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(handler3).toHaveBeenCalledTimes(1)
    })

    it('multiple BEFORE hooks on Agent.deploying all fire', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      Agent.deploying(handler1)
      Agent.deploying(handler2)

      const agent = await Agent.create({ name: 'Multi Before Agent' })
      await Agent.deploy(agent.$id)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('unsubscribing one hook does not affect other hooks on same verb', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      const unsub1 = Integration.connected(handler1)
      Integration.connected(handler2)

      const int1 = await Integration.create({ name: 'Hook Int 1', provider: 'test' })
      await Integration.connect(int1.$id)
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)

      unsub1()

      const int2 = await Integration.create({ name: 'Hook Int 2', provider: 'test' })
      await Integration.connect(int2.$id)
      expect(handler1).toHaveBeenCalledTimes(1) // unchanged
      expect(handler2).toHaveBeenCalledTimes(2) // still fires
    })

    it('CRUD created hook fires when creating entities', async () => {
      const handler = vi.fn()
      Workflow.created(handler)

      await Workflow.create({ name: 'CRUD Hook WF', trigger: 'test' })
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].$type).toBe('Workflow')
    })
  })

  // ===========================================================================
  // 10. Timestamp and version behavior (4 tests)
  // ===========================================================================
  describe('Timestamp and version behavior', () => {
    it('$createdAt is an ISO datetime string on create', async () => {
      const wf = await Workflow.create({ name: 'Timestamp WF', trigger: 'test' })
      expect(typeof wf.$createdAt).toBe('string')
      const date = new Date(wf.$createdAt)
      expect(date.getTime()).not.toBeNaN()
    })

    it('$updatedAt is an ISO datetime string on create', async () => {
      const agent = await Agent.create({ name: 'Timestamp Agent' })
      expect(typeof agent.$updatedAt).toBe('string')
      const date = new Date(agent.$updatedAt)
      expect(date.getTime()).not.toBeNaN()
    })

    it('$version starts at 1 and increments on each update', async () => {
      const int = await Integration.create({ name: 'Version Int', provider: 'test' })
      expect(int.$version).toBe(1)

      const v2 = await Integration.update(int.$id, { description: 'v2' })
      expect(v2.$version).toBe(2)

      const v3 = await Integration.update(int.$id, { description: 'v3' })
      expect(v3.$version).toBe(3)

      const v4 = await Integration.update(int.$id, { description: 'v4' })
      expect(v4.$version).toBe(4)
    })

    it('$context is set on every newly created entity', async () => {
      const wf = await Workflow.create({ name: 'Context WF', trigger: 'test' })
      const int = await Integration.create({ name: 'Context Int', provider: 'test' })
      const agent = await Agent.create({ name: 'Context Agent' })

      expect(typeof wf.$context).toBe('string')
      expect(typeof int.$context).toBe('string')
      expect(typeof agent.$context).toBe('string')
    })
  })

  // ===========================================================================
  // 11. Schema completeness and registry (5 tests)
  // ===========================================================================
  describe('Schema completeness and registry', () => {
    it('Workflow schema contains all expected field names', () => {
      const fieldNames = [...Workflow.$schema.fields.keys()]
      const expected = ['name', 'description', 'trigger', 'steps', 'retryPolicy', 'timeout', 'status', 'errorHandling', 'version', 'lastRunAt', 'runCount', 'successCount', 'failureCount']
      for (const name of expected) {
        expect(fieldNames).toContain(name)
      }
    })

    it('Integration schema contains all expected field names', () => {
      const fieldNames = [...Integration.$schema.fields.keys()]
      const expected = ['name', 'slug', 'description', 'provider', 'providerUrl', 'providerLogo', 'category', 'authType', 'oauthScopes', 'configSchema', 'status', 'featured', 'apiBaseUrl', 'webhookSupport']
      for (const name of expected) {
        expect(fieldNames).toContain(name)
      }
    })

    it('Agent schema contains all expected field names', () => {
      const fieldNames = [...Agent.$schema.fields.keys()]
      const expected = [
        'name', 'slug', 'description', 'avatar', 'model', 'systemPrompt', 'instructions',
        'persona', 'type', 'status', 'visibility', 'temperature', 'maxTokens', 'tools',
        'functions', 'knowledgeBases', 'memory', 'memoryWindow', 'totalTokens', 'totalCost',
        'averageLatency', 'successRate', 'rating', 'ratingCount', 'version', 'publishedAt', 'tags',
      ]
      for (const name of expected) {
        expect(fieldNames).toContain(name)
      }
    })

    it('Workflow $name returns the correct entity name', () => {
      expect(Workflow.$name).toBe('Workflow')
    })

    it('all three entities expose $schema with correct names via proxy', () => {
      expect(Workflow.$schema.name).toBe('Workflow')
      expect(Integration.$schema.name).toBe('Integration')
      expect(Agent.$schema.name).toBe('Agent')

      const allNames = [Workflow.$name, Integration.$name, Agent.$name]
      expect(allNames).toContain('Workflow')
      expect(allNames).toContain('Integration')
      expect(allNames).toContain('Agent')
    })
  })

  // ===========================================================================
  // 12. CRUD hook lifecycle (creating/created, updating/updated, deleting/deleted) (4 tests)
  // ===========================================================================
  describe('CRUD hook lifecycle', () => {
    it('creating (BEFORE) hook fires before create completes', async () => {
      const order: string[] = []
      Workflow.creating(() => { order.push('before') })
      Workflow.created(() => { order.push('after') })

      await Workflow.create({ name: 'Order Test', trigger: 'test' })
      expect(order).toEqual(['before', 'after'])
    })

    it('updated (AFTER) hook fires on update with correct data', async () => {
      const handler = vi.fn()
      Agent.updated(handler)

      const agent = await Agent.create({ name: 'Update Hook Agent' })
      await Agent.update(agent.$id, { name: 'Renamed Agent' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0][0].name).toBe('Renamed Agent')
    })

    it('deleted (AFTER) hook fires on delete', async () => {
      const handler = vi.fn()
      Integration.deleted(handler)

      const int = await Integration.create({ name: 'Delete Hook Int', provider: 'test' })
      await Integration.delete(int.$id)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('updating (BEFORE) hook fires before update completes', async () => {
      const handler = vi.fn()
      Workflow.updating(handler)

      const wf = await Workflow.create({ name: 'Before Update WF', trigger: 'test' })
      await Workflow.update(wf.$id, { runCount: 1 })

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})
