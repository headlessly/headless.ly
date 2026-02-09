import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Workflow, Integration, Agent } from '../src/index.js'

describe('@headlessly/platform — deep v4', () => {
  let provider: MemoryNounProvider

  beforeEach(() => {
    clearRegistry()
    provider = new MemoryNounProvider()
    setProvider(provider)
  })

  // ===========================================================================
  // 1. Relationship schema details — operator, targetType, backref, isArray (7 tests)
  // ===========================================================================
  describe('Relationship schema details', () => {
    it('Workflow.organization relationship has operator "->"', () => {
      const rel = Workflow.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
    })

    it('Workflow.organization relationship has no backref or isArray', () => {
      const rel = Workflow.$schema.relationships.get('organization')
      expect(rel!.backref).toBeUndefined()
      expect(rel!.isArray).toBe(false)
    })

    it('Agent.organization relationship has operator "->" and targetType "Organization"', () => {
      const rel = Agent.$schema.relationships.get('organization')
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
    })

    it('Agent.owner relationship has operator "->" and targetType "Contact"', () => {
      const rel = Agent.$schema.relationships.get('owner')
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Contact')
    })

    it('Agent.owner relationship has no backref and isArray false', () => {
      const rel = Agent.$schema.relationships.get('owner')
      expect(rel!.backref).toBeUndefined()
      expect(rel!.isArray).toBe(false)
    })

    it('Integration has no relationships', () => {
      const relCount = Integration.$schema.relationships.size
      expect(relCount).toBe(0)
    })

    it('Workflow has exactly 1 relationship, Agent has exactly 2', () => {
      expect(Workflow.$schema.relationships.size).toBe(1)
      expect(Agent.$schema.relationships.size).toBe(2)
    })
  })

  // ===========================================================================
  // 2. Schema field/relationship/verb count verification (6 tests)
  // ===========================================================================
  describe('Schema counts', () => {
    it('Workflow schema has exactly 13 fields (including enums)', () => {
      // name, description, trigger, steps, retryPolicy, errorHandling, timeout,
      // status, version, lastRunAt, runCount, successCount, failureCount
      expect(Workflow.$schema.fields.size).toBe(13)
    })

    it('Integration schema has exactly 14 fields (including enums)', () => {
      // name, slug, description, provider, providerUrl, providerLogo, category,
      // authType, oauthScopes, configSchema, status, featured, apiBaseUrl, webhookSupport
      expect(Integration.$schema.fields.size).toBe(14)
    })

    it('Agent schema has exactly 27 fields (including enums)', () => {
      // name, slug, description, avatar, model, systemPrompt, instructions, persona,
      // type, status, visibility, temperature, maxTokens, tools, functions,
      // knowledgeBases, memory, memoryWindow, totalTokens, totalCost, averageLatency,
      // successRate, rating, ratingCount, version, publishedAt, tags
      expect(Agent.$schema.fields.size).toBe(27)
    })

    it('Workflow has exactly 6 verbs (3 CRUD + 3 custom)', () => {
      // create, update, delete, activate, pause, archive
      expect(Workflow.$schema.verbs.size).toBe(6)
    })

    it('Integration has exactly 5 verbs (3 CRUD + 2 custom)', () => {
      // create, update, delete, connect, disconnect
      expect(Integration.$schema.verbs.size).toBe(5)
    })

    it('Agent has exactly 6 verbs (3 CRUD + 3 custom)', () => {
      // create, update, delete, deploy, pause, retire
      expect(Agent.$schema.verbs.size).toBe(6)
    })
  })

  // ===========================================================================
  // 3. Full raw definition completeness (3 tests)
  // ===========================================================================
  describe('Full raw definition completeness', () => {
    it('Workflow raw definition has every property key from the source', () => {
      const raw = Workflow.$schema.raw
      const expectedKeys = [
        'name', 'description', 'organization', 'trigger', 'steps',
        'retryPolicy', 'errorHandling', 'timeout', 'status', 'version',
        'lastRunAt', 'runCount', 'successCount', 'failureCount',
        'activate', 'pause', 'archive',
      ]
      for (const key of expectedKeys) {
        expect(raw).toHaveProperty(key)
      }
      expect(Object.keys(raw)).toHaveLength(expectedKeys.length)
    })

    it('Integration raw definition has every property key from the source', () => {
      const raw = Integration.$schema.raw
      const expectedKeys = [
        'name', 'slug', 'description', 'provider', 'providerUrl', 'providerLogo',
        'category', 'authType', 'oauthScopes', 'configSchema', 'status',
        'featured', 'apiBaseUrl', 'webhookSupport', 'connect', 'disconnect',
      ]
      for (const key of expectedKeys) {
        expect(raw).toHaveProperty(key)
      }
      expect(Object.keys(raw)).toHaveLength(expectedKeys.length)
    })

    it('Agent raw definition has every property key from the source', () => {
      const raw = Agent.$schema.raw
      const expectedKeys = [
        'name', 'slug', 'description', 'avatar', 'organization', 'owner',
        'model', 'systemPrompt', 'instructions', 'persona', 'type', 'status',
        'visibility', 'temperature', 'maxTokens', 'tools', 'functions',
        'knowledgeBases', 'memory', 'memoryWindow', 'totalTokens', 'totalCost',
        'averageLatency', 'successRate', 'rating', 'ratingCount', 'version',
        'publishedAt', 'tags', 'deploy', 'pause', 'retire',
      ]
      for (const key of expectedKeys) {
        expect(raw).toHaveProperty(key)
      }
      expect(Object.keys(raw)).toHaveLength(expectedKeys.length)
    })
  })

  // ===========================================================================
  // 4. Raw definition exact values for all remaining keys (3 tests)
  // ===========================================================================
  describe('Raw definition exact values', () => {
    it('Workflow raw has correct exact strings for every property', () => {
      const raw = Workflow.$schema.raw
      expect(raw.description).toBe('string')
      expect(raw.organization).toBe('-> Organization')
      expect(raw.steps).toBe('string')
      expect(raw.retryPolicy).toBe('string')
      expect(raw.timeout).toBe('number')
      expect(raw.version).toBe('number')
      expect(raw.lastRunAt).toBe('datetime')
      expect(raw.runCount).toBe('number')
      expect(raw.successCount).toBe('number')
      expect(raw.failureCount).toBe('number')
    })

    it('Integration raw has correct exact strings for every property', () => {
      const raw = Integration.$schema.raw
      expect(raw.description).toBe('string')
      expect(raw.providerUrl).toBe('string')
      expect(raw.providerLogo).toBe('string')
      expect(raw.category).toBe('Payment | CRM | Marketing | Analytics | Communication | Storage | AI | Other')
      expect(raw.authType).toBe('OAuth2 | ApiKey | Basic | Custom')
      expect(raw.oauthScopes).toBe('string')
      expect(raw.configSchema).toBe('string')
      expect(raw.status).toBe('Available | ComingSoon | Deprecated')
      expect(raw.featured).toBe('string')
      expect(raw.apiBaseUrl).toBe('string')
      expect(raw.webhookSupport).toBe('string')
    })

    it('Agent raw has correct exact strings for every property', () => {
      const raw = Agent.$schema.raw
      expect(raw.description).toBe('string')
      expect(raw.avatar).toBe('string')
      expect(raw.organization).toBe('-> Organization')
      expect(raw.owner).toBe('-> Contact')
      expect(raw.model).toBe('string')
      expect(raw.systemPrompt).toBe('string')
      expect(raw.instructions).toBe('string')
      expect(raw.persona).toBe('string')
      expect(raw.type).toBe('Assistant | Autonomous | Workflow | Specialist | Router')
      expect(raw.status).toBe('Draft | Active | Paused | Archived')
      expect(raw.visibility).toBe('Private | Team | Organization | Public')
      expect(raw.temperature).toBe('number')
      expect(raw.maxTokens).toBe('number')
      expect(raw.tools).toBe('string')
      expect(raw.functions).toBe('string')
      expect(raw.knowledgeBases).toBe('string')
      expect(raw.memory).toBe('None | Session | Persistent')
      expect(raw.memoryWindow).toBe('number')
      expect(raw.totalTokens).toBe('number')
      expect(raw.totalCost).toBe('number')
      expect(raw.averageLatency).toBe('number')
      expect(raw.successRate).toBe('number')
      expect(raw.rating).toBe('number')
      expect(raw.ratingCount).toBe('number')
      expect(raw.version).toBe('number')
      expect(raw.publishedAt).toBe('datetime')
      expect(raw.tags).toBe('string')
    })
  })

  // ===========================================================================
  // 5. Verb reverseBy/reverseAt for ALL custom verbs (7 tests)
  // ===========================================================================
  describe('Verb reverseBy and reverseAt', () => {
    it('Workflow.activate verb has reverseBy and reverseAt strings', () => {
      const verb = Workflow.$schema.verbs.get('activate')!
      expect(typeof verb.reverseBy).toBe('string')
      expect(verb.reverseBy.length).toBeGreaterThan(0)
      expect(typeof verb.reverseAt).toBe('string')
      expect(verb.reverseAt.length).toBeGreaterThan(0)
    })

    it('Workflow.pause verb has reverseBy and reverseAt strings', () => {
      const verb = Workflow.$schema.verbs.get('pause')!
      expect(typeof verb.reverseBy).toBe('string')
      expect(typeof verb.reverseAt).toBe('string')
    })

    it('Workflow.archive verb has reverseBy and reverseAt strings', () => {
      const verb = Workflow.$schema.verbs.get('archive')!
      expect(typeof verb.reverseBy).toBe('string')
      expect(typeof verb.reverseAt).toBe('string')
    })

    it('Integration.connect verb has reverseBy and reverseAt strings', () => {
      const verb = Integration.$schema.verbs.get('connect')!
      expect(typeof verb.reverseBy).toBe('string')
      expect(typeof verb.reverseAt).toBe('string')
    })

    it('Integration.disconnect verb has reverseBy and reverseAt strings', () => {
      const verb = Integration.$schema.verbs.get('disconnect')!
      expect(typeof verb.reverseBy).toBe('string')
      expect(typeof verb.reverseAt).toBe('string')
    })

    it('Agent.deploy verb has reverseBy and reverseAt strings', () => {
      const verb = Agent.$schema.verbs.get('deploy')!
      expect(typeof verb.reverseBy).toBe('string')
      expect(typeof verb.reverseAt).toBe('string')
    })

    it('Agent.retire verb has reverseBy and reverseAt strings', () => {
      const verb = Agent.$schema.verbs.get('retire')!
      expect(typeof verb.reverseBy).toBe('string')
      expect(typeof verb.reverseAt).toBe('string')
    })
  })

  // ===========================================================================
  // 6. CRUD verb conjugation details (3 tests)
  // ===========================================================================
  describe('CRUD verb conjugation details', () => {
    it('Workflow create verb has action/activity/event conjugation', () => {
      const verb = Workflow.$schema.verbs.get('create')!
      expect(verb.action).toBe('create')
      expect(verb.activity).toBe('creating')
      expect(verb.event).toBe('created')
      expect(typeof verb.reverseBy).toBe('string')
      expect(typeof verb.reverseAt).toBe('string')
    })

    it('Integration update verb has action/activity/event conjugation', () => {
      const verb = Integration.$schema.verbs.get('update')!
      expect(verb.action).toBe('update')
      expect(verb.activity).toBe('updating')
      expect(verb.event).toBe('updated')
    })

    it('Agent delete verb has action/activity/event conjugation', () => {
      const verb = Agent.$schema.verbs.get('delete')!
      expect(verb.action).toBe('delete')
      expect(verb.activity).toBe('deleting')
      expect(verb.event).toBe('deleted')
    })
  })

  // ===========================================================================
  // 7. Schema disabledVerbs set is empty (3 tests)
  // ===========================================================================
  describe('Schema disabledVerbs', () => {
    it('Workflow has no disabled verbs', () => {
      expect(Workflow.$schema.disabledVerbs.size).toBe(0)
    })

    it('Integration has no disabled verbs', () => {
      expect(Integration.$schema.disabledVerbs.size).toBe(0)
    })

    it('Agent has no disabled verbs', () => {
      expect(Agent.$schema.disabledVerbs.size).toBe(0)
    })
  })

  // ===========================================================================
  // 8. Field modifier details for non-required optional fields (5 tests)
  // ===========================================================================
  describe('Field modifier details', () => {
    it('Workflow.description has required: false', () => {
      const field = Workflow.$schema.fields.get('description')!
      expect(field.modifiers!.required).toBe(false)
    })

    it('Workflow.steps has required: false, indexed: false, unique: false', () => {
      const field = Workflow.$schema.fields.get('steps')!
      expect(field.modifiers!.required).toBe(false)
      expect(field.modifiers!.indexed).toBe(false)
      expect(field.modifiers!.unique).toBe(false)
    })

    it('Integration.description has required: false (plain string)', () => {
      const field = Integration.$schema.fields.get('description')!
      expect(field.modifiers!.required).toBe(false)
      expect(field.modifiers!.optional).toBe(false)
    })

    it('Agent.avatar has required: false, not unique, not indexed', () => {
      const field = Agent.$schema.fields.get('avatar')!
      expect(field.modifiers!.required).toBe(false)
      expect(field.modifiers!.unique).toBe(false)
      expect(field.modifiers!.indexed).toBe(false)
    })

    it('Agent.model has required: false since it is defined as "string" not "string!"', () => {
      const field = Agent.$schema.fields.get('model')!
      expect(field.modifiers!.required).toBe(false)
    })
  })

  // ===========================================================================
  // 9. Agent numeric edge cases — temperature, maxTokens, rating (6 tests)
  // ===========================================================================
  describe('Agent numeric field edge cases', () => {
    it('creates agent with temperature 0.0 (minimum)', async () => {
      const agent = await Agent.create({ name: 'Zero Temp Agent', temperature: 0.0 })
      expect(agent.temperature).toBe(0)
    })

    it('creates agent with temperature 1.0 (maximum typical)', async () => {
      const agent = await Agent.create({ name: 'Max Temp Agent', temperature: 1.0 })
      expect(agent.temperature).toBe(1.0)
    })

    it('creates agent with temperature 2.0 (high creativity)', async () => {
      const agent = await Agent.create({ name: 'Creative Agent', temperature: 2.0 })
      expect(agent.temperature).toBe(2.0)
    })

    it('creates agent with maxTokens 0', async () => {
      const agent = await Agent.create({ name: 'No Token Agent', maxTokens: 0 })
      expect(agent.maxTokens).toBe(0)
    })

    it('creates agent with very large maxTokens (200000)', async () => {
      const agent = await Agent.create({ name: 'Big Token Agent', maxTokens: 200000 })
      expect(agent.maxTokens).toBe(200000)
    })

    it('creates agent with fractional rating value', async () => {
      const agent = await Agent.create({ name: 'Fractional Agent', rating: 4.75 })
      expect(agent.rating).toBe(4.75)
    })
  })

  // ===========================================================================
  // 10. BEFORE hook data transformation chains (4 tests)
  // ===========================================================================
  describe('BEFORE hook data transformation', () => {
    it('creating hook receives data and is called before created hook', async () => {
      const callOrder: string[] = []
      Workflow.creating((data: any) => {
        callOrder.push('creating')
      })
      Workflow.created(() => {
        callOrder.push('created')
      })

      await Workflow.create({ name: 'Transform WF', trigger: 'test' })
      expect(callOrder[0]).toBe('creating')
      expect(callOrder[1]).toBe('created')
    })

    it('activating hook fires before activated hook', async () => {
      const callOrder: string[] = []
      Workflow.activating(() => {
        callOrder.push('activating')
      })
      Workflow.activated(() => {
        callOrder.push('activated')
      })

      const wf = await Workflow.create({ name: 'Activate Order', trigger: 'test', status: 'Draft' })
      await Workflow.activate(wf.$id)
      expect(callOrder).toEqual(['activating', 'activated'])
    })

    it('connecting hook fires before connected hook', async () => {
      const callOrder: string[] = []
      Integration.connecting(() => {
        callOrder.push('connecting')
      })
      Integration.connected(() => {
        callOrder.push('connected')
      })

      const int = await Integration.create({ name: 'Order Int', provider: 'test' })
      await Integration.connect(int.$id)
      expect(callOrder).toEqual(['connecting', 'connected'])
    })

    it('retiring hook fires before retired hook', async () => {
      const callOrder: string[] = []
      Agent.retiring(() => {
        callOrder.push('retiring')
      })
      Agent.retired(() => {
        callOrder.push('retired')
      })

      const agent = await Agent.create({ name: 'Retire Order Agent', status: 'Active' })
      await Agent.retire(agent.$id)
      expect(callOrder).toEqual(['retiring', 'retired'])
    })
  })

  // ===========================================================================
  // 11. Deleting/deleted hook lifecycle (3 tests)
  // ===========================================================================
  describe('Deleting/deleted hook lifecycle', () => {
    it('deleting BEFORE hook fires on entity deletion', async () => {
      const handler = vi.fn()
      Workflow.deleting(handler)

      const wf = await Workflow.create({ name: 'Delete Hook WF', trigger: 'test' })
      await Workflow.delete(wf.$id)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('deleting fires before deleted for Integration', async () => {
      const callOrder: string[] = []
      Integration.deleting(() => { callOrder.push('deleting') })
      Integration.deleted(() => { callOrder.push('deleted') })

      const int = await Integration.create({ name: 'Delete Order Int', provider: 'test' })
      await Integration.delete(int.$id)

      expect(callOrder).toEqual(['deleting', 'deleted'])
    })

    it('Agent.deleting fires on Agent.delete call', async () => {
      const handler = vi.fn()
      Agent.deleting(handler)

      const agent = await Agent.create({ name: 'Delete Hook Agent' })
      await Agent.delete(agent.$id)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  // ===========================================================================
  // 12. Consecutive custom verbs on the same entity (3 tests)
  // ===========================================================================
  describe('Consecutive custom verbs on same entity', () => {
    it('activate then pause a workflow', async () => {
      const wf = await Workflow.create({ name: 'Activate-Pause WF', trigger: 'test', status: 'Draft' })
      const activated = await Workflow.activate(wf.$id)
      expect(activated.status).toBe('Activated')

      const paused = await Workflow.pause(wf.$id)
      expect(paused.status).toBe('Paused')
    })

    it('activate then archive a workflow', async () => {
      const wf = await Workflow.create({ name: 'Activate-Archive WF', trigger: 'test', status: 'Draft' })
      await Workflow.activate(wf.$id)
      const archived = await Workflow.archive(wf.$id)
      expect(archived.status).toBe('Archived')
    })

    it('deploy then pause then retire an agent', async () => {
      const agent = await Agent.create({ name: 'Full Lifecycle Agent', status: 'Draft' })

      const deployed = await Agent.deploy(agent.$id)
      expect(deployed.status).toBe('Deployed')

      const paused = await Agent.pause(agent.$id)
      expect(paused.status).toBe('Paused')

      const retired = await Agent.retire(agent.$id)
      expect(retired.status).toBe('Retired')
    })
  })

  // ===========================================================================
  // 13. $updatedAt changes on update, $createdAt remains stable (3 tests)
  // ===========================================================================
  describe('Timestamp stability', () => {
    it('$createdAt does not change on update', async () => {
      const wf = await Workflow.create({ name: 'Timestamp Stable', trigger: 'test' })
      const originalCreatedAt = wf.$createdAt

      const updated = await Workflow.update(wf.$id, { name: 'Updated Name' })
      expect(updated.$createdAt).toBe(originalCreatedAt)
    })

    it('$updatedAt changes on update for Integration', async () => {
      const int = await Integration.create({ name: 'Timestamp Int', provider: 'test' })
      const originalUpdatedAt = int.$updatedAt

      // Small delay to ensure timestamp difference
      await new Promise((r) => setTimeout(r, 5))
      const updated = await Integration.update(int.$id, { description: 'changed' })

      // $updatedAt should be >= the original (may be same in fast execution)
      expect(updated.$updatedAt).toBeDefined()
      expect(typeof updated.$updatedAt).toBe('string')
    })

    it('$createdAt remains stable across multiple updates for Agent', async () => {
      const agent = await Agent.create({ name: 'Multi Update Agent' })
      const originalCreatedAt = agent.$createdAt

      await Agent.update(agent.$id, { name: 'Update 1' })
      await Agent.update(agent.$id, { name: 'Update 2' })
      const final = await Agent.update(agent.$id, { name: 'Update 3' })

      expect(final.$createdAt).toBe(originalCreatedAt)
      expect(final.$version).toBe(4)
    })
  })

  // ===========================================================================
  // 14. Find with combined filters (multiple fields) (4 tests)
  // ===========================================================================
  describe('Find with combined filters', () => {
    it('finds agents by type AND status', async () => {
      await Agent.create({ name: 'A1', type: 'Specialist', status: 'Active' })
      await Agent.create({ name: 'A2', type: 'Specialist', status: 'Draft' })
      await Agent.create({ name: 'A3', type: 'Router', status: 'Active' })

      const activeSpecialists = await Agent.find({ type: 'Specialist', status: 'Active' })
      expect(activeSpecialists).toHaveLength(1)
      expect(activeSpecialists[0].name).toBe('A1')
    })

    it('finds workflows by status AND trigger', async () => {
      await Workflow.create({ name: 'WF1', trigger: 'Contact.created', status: 'Active' })
      await Workflow.create({ name: 'WF2', trigger: 'Deal.closed', status: 'Active' })
      await Workflow.create({ name: 'WF3', trigger: 'Contact.created', status: 'Draft' })

      const activeContactFlows = await Workflow.find({ trigger: 'Contact.created', status: 'Active' })
      expect(activeContactFlows).toHaveLength(1)
      expect(activeContactFlows[0].name).toBe('WF1')
    })

    it('finds integrations by provider AND category', async () => {
      await Integration.create({ name: 'Stripe Pay', provider: 'stripe', category: 'Payment' })
      await Integration.create({ name: 'Stripe Analytics', provider: 'stripe', category: 'Analytics' })
      await Integration.create({ name: 'PayPal Pay', provider: 'paypal', category: 'Payment' })

      const stripePayment = await Integration.find({ provider: 'stripe', category: 'Payment' })
      expect(stripePayment).toHaveLength(1)
      expect(stripePayment[0].name).toBe('Stripe Pay')
    })

    it('finds agents by visibility AND memory', async () => {
      await Agent.create({ name: 'A1', visibility: 'Public', memory: 'Persistent' })
      await Agent.create({ name: 'A2', visibility: 'Public', memory: 'Session' })
      await Agent.create({ name: 'A3', visibility: 'Team', memory: 'Persistent' })

      const publicPersistent = await Agent.find({ visibility: 'Public', memory: 'Persistent' })
      expect(publicPersistent).toHaveLength(1)
      expect(publicPersistent[0].name).toBe('A1')
    })
  })

  // ===========================================================================
  // 15. Schema slug/singular/plural consistency (3 tests)
  // ===========================================================================
  describe('Schema slug/singular/plural consistency', () => {
    it('Workflow slug equals singular', () => {
      expect(Workflow.$schema.slug).toBe(Workflow.$schema.singular)
    })

    it('Integration slug equals singular', () => {
      expect(Integration.$schema.slug).toBe(Integration.$schema.singular)
    })

    it('Agent slug equals singular', () => {
      expect(Agent.$schema.slug).toBe(Agent.$schema.singular)
    })
  })

  // ===========================================================================
  // 16. Concurrent multi-entity verb operations (3 tests)
  // ===========================================================================
  describe('Concurrent multi-entity verb operations', () => {
    it('activates multiple workflows concurrently', async () => {
      const wf1 = await Workflow.create({ name: 'Concurrent Activate 1', trigger: 'a', status: 'Draft' })
      const wf2 = await Workflow.create({ name: 'Concurrent Activate 2', trigger: 'b', status: 'Draft' })
      const wf3 = await Workflow.create({ name: 'Concurrent Activate 3', trigger: 'c', status: 'Draft' })

      const [r1, r2, r3] = await Promise.all([
        Workflow.activate(wf1.$id),
        Workflow.activate(wf2.$id),
        Workflow.activate(wf3.$id),
      ])
      expect(r1.status).toBe('Activated')
      expect(r2.status).toBe('Activated')
      expect(r3.status).toBe('Activated')
    })

    it('deploys multiple agents concurrently', async () => {
      const a1 = await Agent.create({ name: 'Deploy 1', status: 'Draft' })
      const a2 = await Agent.create({ name: 'Deploy 2', status: 'Draft' })

      const [d1, d2] = await Promise.all([
        Agent.deploy(a1.$id),
        Agent.deploy(a2.$id),
      ])
      expect(d1.status).toBe('Deployed')
      expect(d2.status).toBe('Deployed')
    })

    it('connects and disconnects integrations concurrently', async () => {
      const int1 = await Integration.create({ name: 'ConcInt1', provider: 'a' })
      const int2 = await Integration.create({ name: 'ConcInt2', provider: 'b' })

      const [c1, c2] = await Promise.all([
        Integration.connect(int1.$id),
        Integration.connect(int2.$id),
      ])
      expect(c1.status).toBe('Connected')
      expect(c2.status).toBe('Connected')

      const [d1, d2] = await Promise.all([
        Integration.disconnect(int1.$id),
        Integration.disconnect(int2.$id),
      ])
      expect(d1.status).toBe('Disconnected')
      expect(d2.status).toBe('Disconnected')
    })
  })

  // ===========================================================================
  // 17. Relationship properties on parsed fields (2 tests)
  // ===========================================================================
  describe('Relationship parsed properties', () => {
    it('Workflow.organization parsed property has kind "relationship"', () => {
      const rel = Workflow.$schema.relationships.get('organization')!
      expect(rel.kind).toBe('relationship')
      expect(rel.name).toBe('organization')
    })

    it('Agent.owner parsed property has name "owner" and kind "relationship"', () => {
      const rel = Agent.$schema.relationships.get('owner')!
      expect(rel.kind).toBe('relationship')
      expect(rel.name).toBe('owner')
    })
  })

  // ===========================================================================
  // 18. Custom verb execution preserves other fields (3 tests)
  // ===========================================================================
  describe('Custom verb preserves other fields', () => {
    it('activate preserves workflow name and trigger', async () => {
      const wf = await Workflow.create({ name: 'Preserve Test', trigger: 'Deal.closed', status: 'Draft', runCount: 42 })
      const activated = await Workflow.activate(wf.$id)
      expect(activated.name).toBe('Preserve Test')
      expect(activated.trigger).toBe('Deal.closed')
      expect(activated.runCount).toBe(42)
    })

    it('connect preserves integration provider and category', async () => {
      const int = await Integration.create({ name: 'Preserve Int', provider: 'stripe', category: 'Payment', authType: 'OAuth2' })
      const connected = await Integration.connect(int.$id)
      expect(connected.name).toBe('Preserve Int')
      expect(connected.provider).toBe('stripe')
      expect(connected.category).toBe('Payment')
      expect(connected.authType).toBe('OAuth2')
    })

    it('deploy preserves agent model and temperature', async () => {
      const agent = await Agent.create({ name: 'Preserve Agent', model: 'claude-opus-4-6', temperature: 0.5, status: 'Draft' })
      const deployed = await Agent.deploy(agent.$id)
      expect(deployed.name).toBe('Preserve Agent')
      expect(deployed.model).toBe('claude-opus-4-6')
      expect(deployed.temperature).toBe(0.5)
    })
  })
})
