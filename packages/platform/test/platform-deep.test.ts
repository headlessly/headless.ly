import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Workflow, Integration, Agent } from '../src/index.js'

describe('@headlessly/platform — deep coverage', () => {
  let provider: MemoryNounProvider

  beforeEach(() => {
    clearRegistry()
    provider = new MemoryNounProvider()
    setProvider(provider)
  })

  // ===========================================================================
  // 1. Workflow Noun Schema (~5 tests)
  // ===========================================================================
  describe('Workflow schema', () => {
    it('has the correct name, singular, and plural', () => {
      const schema = Workflow.$schema
      expect(schema.name).toBe('Workflow')
      expect(schema.singular).toBe('workflow')
      expect(schema.plural).toBe('workflows')
    })

    it('defines name as a required string field', () => {
      const schema = Workflow.$schema
      const nameField = schema.fields.get('name')
      expect(nameField).toBeDefined()
      expect(nameField!.kind).toBe('field')
      expect(nameField!.type).toBe('string')
      expect(nameField!.modifiers?.required).toBe(true)
    })

    it('defines trigger as a required string field', () => {
      const schema = Workflow.$schema
      const triggerField = schema.fields.get('trigger')
      expect(triggerField).toBeDefined()
      expect(triggerField!.kind).toBe('field')
      expect(triggerField!.type).toBe('string')
      expect(triggerField!.modifiers?.required).toBe(true)
    })

    it('defines status as an enum with Draft|Active|Paused|Archived', () => {
      const schema = Workflow.$schema
      const statusField = schema.fields.get('status')
      expect(statusField).toBeDefined()
      expect(statusField!.kind).toBe('enum')
      expect(statusField!.enumValues).toBeDefined()
      expect(statusField!.enumValues).toContain('Draft')
      expect(statusField!.enumValues).toContain('Active')
      expect(statusField!.enumValues).toContain('Paused')
      expect(statusField!.enumValues).toContain('Archived')
      expect(statusField!.enumValues).toHaveLength(4)
    })

    it('defines errorHandling as an enum with Stop|Continue|Fallback', () => {
      const schema = Workflow.$schema
      const errorField = schema.fields.get('errorHandling')
      expect(errorField).toBeDefined()
      expect(errorField!.kind).toBe('enum')
      expect(errorField!.enumValues).toContain('Stop')
      expect(errorField!.enumValues).toContain('Continue')
      expect(errorField!.enumValues).toContain('Fallback')
      expect(errorField!.enumValues).toHaveLength(3)
    })
  })

  // ===========================================================================
  // 2. Integration Noun Schema (~5 tests)
  // ===========================================================================
  describe('Integration schema', () => {
    it('has the correct name, singular, and plural', () => {
      const schema = Integration.$schema
      expect(schema.name).toBe('Integration')
      expect(schema.singular).toBe('integration')
      expect(schema.plural).toBe('integrations')
    })

    it('defines name as a required string field', () => {
      const schema = Integration.$schema
      const nameField = schema.fields.get('name')
      expect(nameField).toBeDefined()
      expect(nameField!.kind).toBe('field')
      expect(nameField!.type).toBe('string')
      expect(nameField!.modifiers?.required).toBe(true)
    })

    it('defines provider as a required string field', () => {
      const schema = Integration.$schema
      const providerField = schema.fields.get('provider')
      expect(providerField).toBeDefined()
      expect(providerField!.kind).toBe('field')
      expect(providerField!.type).toBe('string')
      expect(providerField!.modifiers?.required).toBe(true)
    })

    it('defines status as an enum with Available|ComingSoon|Deprecated', () => {
      const schema = Integration.$schema
      const statusField = schema.fields.get('status')
      expect(statusField).toBeDefined()
      expect(statusField!.kind).toBe('enum')
      expect(statusField!.enumValues).toBeDefined()
      expect(statusField!.enumValues).toContain('Available')
      expect(statusField!.enumValues).toContain('ComingSoon')
      expect(statusField!.enumValues).toContain('Deprecated')
      expect(statusField!.enumValues).toHaveLength(3)
    })

    it('defines category as an enum with expected payment/CRM/marketing values', () => {
      const schema = Integration.$schema
      const categoryField = schema.fields.get('category')
      expect(categoryField).toBeDefined()
      expect(categoryField!.kind).toBe('enum')
      expect(categoryField!.enumValues).toContain('Payment')
      expect(categoryField!.enumValues).toContain('CRM')
      expect(categoryField!.enumValues).toContain('Marketing')
      expect(categoryField!.enumValues).toContain('Analytics')
      expect(categoryField!.enumValues).toContain('Communication')
      expect(categoryField!.enumValues).toContain('Storage')
      expect(categoryField!.enumValues).toContain('AI')
      expect(categoryField!.enumValues).toContain('Other')
      expect(categoryField!.enumValues).toHaveLength(8)
    })
  })

  // ===========================================================================
  // 3. Agent Noun Schema (~5 tests)
  // ===========================================================================
  describe('Agent schema', () => {
    it('has the correct name, singular, and plural', () => {
      const schema = Agent.$schema
      expect(schema.name).toBe('Agent')
      expect(schema.singular).toBe('agent')
      expect(schema.plural).toBe('agents')
    })

    it('defines name as a required string field', () => {
      const schema = Agent.$schema
      const nameField = schema.fields.get('name')
      expect(nameField).toBeDefined()
      expect(nameField!.kind).toBe('field')
      expect(nameField!.type).toBe('string')
      expect(nameField!.modifiers?.required).toBe(true)
    })

    it('defines status as an enum with Draft|Active|Paused|Archived', () => {
      const schema = Agent.$schema
      const statusField = schema.fields.get('status')
      expect(statusField).toBeDefined()
      expect(statusField!.kind).toBe('enum')
      expect(statusField!.enumValues).toBeDefined()
      expect(statusField!.enumValues).toContain('Draft')
      expect(statusField!.enumValues).toContain('Active')
      expect(statusField!.enumValues).toContain('Paused')
      expect(statusField!.enumValues).toContain('Archived')
      expect(statusField!.enumValues).toHaveLength(4)
    })

    it('defines type as an enum with Assistant|Autonomous|Workflow|Specialist|Router', () => {
      const schema = Agent.$schema
      const typeField = schema.fields.get('type')
      expect(typeField).toBeDefined()
      expect(typeField!.kind).toBe('enum')
      expect(typeField!.enumValues).toContain('Assistant')
      expect(typeField!.enumValues).toContain('Autonomous')
      expect(typeField!.enumValues).toContain('Workflow')
      expect(typeField!.enumValues).toContain('Specialist')
      expect(typeField!.enumValues).toContain('Router')
      expect(typeField!.enumValues).toHaveLength(5)
    })

    it('defines memory as an enum with None|Session|Persistent', () => {
      const schema = Agent.$schema
      const memoryField = schema.fields.get('memory')
      expect(memoryField).toBeDefined()
      expect(memoryField!.kind).toBe('enum')
      expect(memoryField!.enumValues).toContain('None')
      expect(memoryField!.enumValues).toContain('Session')
      expect(memoryField!.enumValues).toContain('Persistent')
      expect(memoryField!.enumValues).toHaveLength(3)
    })
  })

  // ===========================================================================
  // 4. Workflow Verbs (~4 tests)
  // ===========================================================================
  describe('Workflow verbs', () => {
    it('has CRUD verbs on the schema (create, update, delete)', () => {
      const schema = Workflow.$schema
      const verbNames = [...schema.verbs.keys()]
      expect(verbNames).toContain('create')
      expect(verbNames).toContain('update')
      expect(verbNames).toContain('delete')
      // get and find are read operations on the proxy, not conjugated verbs in the schema
      expect(typeof Workflow.get).toBe('function')
      expect(typeof Workflow.find).toBe('function')
    })

    it('has activate verb in the schema verbs map', () => {
      const schema = Workflow.$schema
      const activateVerb = schema.verbs.get('activate')
      expect(activateVerb).toBeDefined()
      expect(activateVerb!.action).toBe('activate')
      expect(activateVerb!.activity).toBe('activating')
      expect(activateVerb!.event).toBe('activated')
    })

    it('has pause verb in the schema verbs map', () => {
      const schema = Workflow.$schema
      const pauseVerb = schema.verbs.get('pause')
      expect(pauseVerb).toBeDefined()
      expect(pauseVerb!.action).toBe('pause')
      expect(pauseVerb!.activity).toBe('pausing')
      expect(pauseVerb!.event).toBe('paused')
    })

    it('has archive verb in the schema verbs map', () => {
      const schema = Workflow.$schema
      const archiveVerb = schema.verbs.get('archive')
      expect(archiveVerb).toBeDefined()
      expect(archiveVerb!.action).toBe('archive')
      expect(archiveVerb!.activity).toBe('archiving')
      expect(archiveVerb!.event).toBe('archived')
    })
  })

  // ===========================================================================
  // 5. Integration Verbs (~4 tests)
  // ===========================================================================
  describe('Integration verbs', () => {
    it('has CRUD verbs on the schema (create, update, delete)', () => {
      const schema = Integration.$schema
      const verbNames = [...schema.verbs.keys()]
      expect(verbNames).toContain('create')
      expect(verbNames).toContain('update')
      expect(verbNames).toContain('delete')
      // get and find are read operations on the proxy, not conjugated verbs in the schema
      expect(typeof Integration.get).toBe('function')
      expect(typeof Integration.find).toBe('function')
    })

    it('has connect verb in the schema verbs map', () => {
      const schema = Integration.$schema
      const connectVerb = schema.verbs.get('connect')
      expect(connectVerb).toBeDefined()
      expect(connectVerb!.action).toBe('connect')
      expect(connectVerb!.activity).toBe('connecting')
      expect(connectVerb!.event).toBe('connected')
    })

    it('has disconnect verb in the schema verbs map', () => {
      const schema = Integration.$schema
      const disconnectVerb = schema.verbs.get('disconnect')
      expect(disconnectVerb).toBeDefined()
      expect(disconnectVerb!.action).toBe('disconnect')
      expect(disconnectVerb!.activity).toBe('disconnecting')
      expect(disconnectVerb!.event).toBe('disconnected')
    })

    it('connect and disconnect verbs have reverseBy fields', () => {
      const schema = Integration.$schema
      const connectVerb = schema.verbs.get('connect')
      const disconnectVerb = schema.verbs.get('disconnect')
      expect(connectVerb!.reverseBy).toBeDefined()
      expect(typeof connectVerb!.reverseBy).toBe('string')
      expect(disconnectVerb!.reverseBy).toBeDefined()
      expect(typeof disconnectVerb!.reverseBy).toBe('string')
    })
  })

  // ===========================================================================
  // 6. Agent Lifecycle (~5 tests)
  // ===========================================================================
  describe('Agent lifecycle', () => {
    it('creates an agent with name, model, and instructions', async () => {
      const agent = await Agent.create({
        name: 'Sales Assistant',
        model: 'claude-opus-4-6',
        instructions: 'You are a helpful sales assistant.',
      })
      expect(agent).toBeDefined()
      expect(agent.$type).toBe('Agent')
      expect(agent.name).toBe('Sales Assistant')
      expect(agent.model).toBe('claude-opus-4-6')
      expect(agent.instructions).toBe('You are a helpful sales assistant.')
    })

    it('creates an agent with tools configuration', async () => {
      const agent = await Agent.create({
        name: 'Tool Agent',
        tools: 'search,fetch,do',
        type: 'Specialist',
      })
      expect(agent).toBeDefined()
      expect(agent.tools).toBe('search,fetch,do')
      expect(agent.type).toBe('Specialist')
    })

    it('creates an agent and updates its status', async () => {
      const agent = await Agent.create({
        name: 'Lifecycle Bot',
        status: 'Draft',
      })
      expect(agent.status).toBe('Draft')

      const updated = await Agent.update(agent.$id, { status: 'Active' })
      expect(updated.status).toBe('Active')
      expect(updated.$version).toBe(2)
    })

    it('creates multiple agents and finds them', async () => {
      await Agent.create({ name: 'Agent Alpha' })
      await Agent.create({ name: 'Agent Beta' })
      await Agent.create({ name: 'Agent Gamma' })

      const agents = await Agent.find()
      expect(agents).toHaveLength(3)
    })

    it('agent schema has deploy, pause, and retire custom verbs', () => {
      const schema = Agent.$schema
      const deployVerb = schema.verbs.get('deploy')
      expect(deployVerb).toBeDefined()
      expect(deployVerb!.action).toBe('deploy')
      expect(deployVerb!.activity).toBe('deploying')
      expect(deployVerb!.event).toBe('deployed')

      const pauseVerb = schema.verbs.get('pause')
      expect(pauseVerb).toBeDefined()
      expect(pauseVerb!.action).toBe('pause')
      expect(pauseVerb!.event).toBe('paused')

      const retireVerb = schema.verbs.get('retire')
      expect(retireVerb).toBeDefined()
      expect(retireVerb!.action).toBe('retire')
      expect(retireVerb!.activity).toBe('retiring')
      expect(retireVerb!.event).toBe('retired')
    })
  })

  // ===========================================================================
  // 7. Cross-entity CRUD and schema completeness (~5 bonus tests)
  // ===========================================================================
  describe('cross-entity operations', () => {
    it('Workflow.create stores data accessible via Workflow.get', async () => {
      const workflow = await Workflow.create({
        name: 'Onboarding Flow',
        trigger: 'Contact.created',
        status: 'Draft',
      })
      const fetched = await Workflow.get(workflow.$id)
      expect(fetched).toBeDefined()
      expect(fetched!.name).toBe('Onboarding Flow')
      expect(fetched!.trigger).toBe('Contact.created')
      expect(fetched!.status).toBe('Draft')
    })

    it('Integration.create stores data accessible via Integration.get', async () => {
      const integration = await Integration.create({
        name: 'GitHub Sync',
        provider: 'github',
        category: 'Storage',
      })
      const fetched = await Integration.get(integration.$id)
      expect(fetched).toBeDefined()
      expect(fetched!.name).toBe('GitHub Sync')
      expect(fetched!.provider).toBe('github')
      expect(fetched!.category).toBe('Storage')
    })

    it('Workflow schema has organization as a relationship', () => {
      const schema = Workflow.$schema
      const orgRel = schema.relationships.get('organization')
      expect(orgRel).toBeDefined()
      expect(orgRel!.kind).toBe('relationship')
      expect(orgRel!.targetType).toBe('Organization')
    })

    it('Agent schema has organization and owner as relationships', () => {
      const schema = Agent.$schema
      const orgRel = schema.relationships.get('organization')
      expect(orgRel).toBeDefined()
      expect(orgRel!.kind).toBe('relationship')
      expect(orgRel!.targetType).toBe('Organization')

      const ownerRel = schema.relationships.get('owner')
      expect(ownerRel).toBeDefined()
      expect(ownerRel!.kind).toBe('relationship')
      expect(ownerRel!.targetType).toBe('Contact')
    })

    it('Agent schema defines visibility as an enum with Private|Team|Organization|Public', () => {
      const schema = Agent.$schema
      const visField = schema.fields.get('visibility')
      expect(visField).toBeDefined()
      expect(visField!.kind).toBe('enum')
      expect(visField!.enumValues).toContain('Private')
      expect(visField!.enumValues).toContain('Team')
      expect(visField!.enumValues).toContain('Organization')
      expect(visField!.enumValues).toContain('Public')
      expect(visField!.enumValues).toHaveLength(4)
    })
  })
})
