# @headlessly/platform

> Zapier connects disconnected systems with a visual canvas. Your agent doesn't need a canvas — the systems aren't disconnected.

```typescript
import { Workflow, Agent } from '@headlessly/platform'

await Workflow.create({
  name: 'New Customer Onboarding',
  trigger: 'Deal.closed',
  steps: [
    { action: 'Subscription.create', params: { plan: 'pro' } },
    { action: 'Ticket.create', params: { subject: 'Welcome aboard' } },
    { action: 'Campaign.create', params: { type: 'Email', name: 'Onboarding' } },
  ],
})

// A deal closes — the workflow receives the real Deal, not a webhook payload
Workflow.activated(async (workflow, $) => {
  await $.Agent.deploy('agent_k7TmPvQx')
  await $.Event.create({ type: 'workflow.activated', value: workflow.name })
})
```

No Zapier zaps. No Make scenarios. No n8n node wiring. Workflows operate on real typed entities in the same graph as your CRM, billing, support, and analytics. Your agent orchestrates the business — not webhook payloads.

## The Problem

Zapier has 7,000 integrations because it needs 7,000 integrations — every app is a silo that needs a bridge. Make lets you build "scenarios" that visually wire HubSpot to Stripe to Zendesk through HTTP requests and JSON transformers. n8n is self-hosted Make with more YAML.

None of them were built for an AI agent to operate.

Your agent doesn't need a drag-and-drop canvas. It needs `Workflow.activate()`. It doesn't need a trigger/action visual builder with 47 authentication screens. It needs typed entities that are already connected. It doesn't need to parse a Stripe webhook payload, map it to a HubSpot contact schema, and POST it to a Zendesk API. It needs a BEFORE hook:

```typescript
Workflow.activating(workflow => {
  if (workflow.steps.length === 0) throw new Error('Cannot activate empty workflow')
})
```

The real problem with Zapier isn't Zapier — it's that your CRM, billing, and support are three different systems. When they're the same graph, you don't need 7,000 integrations. You need zero.

## One Typed Graph

When a workflow triggers in Zapier, it receives a webhook payload — untyped JSON you pray hasn't changed since last week. You parse it, transform it, map fields, handle errors, and hope the next step's API is still accepting the same schema.

In headless.ly, a workflow triggered by `Deal.closed` receives the actual Deal — with its contact, organization, subscription, and every relationship already resolved:

```typescript
import { Workflow } from '@headlessly/platform'
import { Deal } from '@headlessly/crm'

Deal.closed(async (deal, $) => {
  await $.Subscription.create({ plan: 'pro', customer: deal.contact })
  await $.Ticket.create({ subject: `Welcome ${deal.name}`, requester: deal.contact })
  await $.Campaign.create({ name: `Onboard ${deal.name}`, type: 'Email' })
  await $.Event.create({ type: 'deal.closed', value: deal.value })
})

Workflow.activated(async (workflow, $) => {
  await $.Agent.create({
    name: `${workflow.name} executor`,
    type: 'Workflow',
    model: 'claude-opus-4-6',
    systemPrompt: `Execute the steps in workflow ${workflow.$id}`,
  })
})
```

No webhook parsing. No field mapping. No Zapier. One graph.

## Install

```bash
npm install @headlessly/platform
```

## Entities

### Workflow

Event-driven automation that operates on real entities — not webhook payloads. A workflow triggered by `Contact.qualified` receives the actual Contact with its relationships, not a JSON blob.

```typescript
import { Workflow } from '@headlessly/platform'

const workflow = await Workflow.create({
  name: 'Lead Qualification Pipeline',
  trigger: 'Contact.created',
  steps: [
    { action: 'Contact.qualify', condition: 'leadScore > 80' },
    { action: 'Deal.create', params: { stage: 'Qualification' } },
    { action: 'Agent.deploy', params: { type: 'Specialist' } },
  ],
  errorHandling: 'Continue',
  timeout: 30000,
})

await Workflow.activate(workflow.$id)
await Workflow.pause('workflow_fX9bL5nRd')
await Workflow.archive('workflow_fX9bL5nRd')

Workflow.activated((workflow) => {
  console.log(`"${workflow.name}" is live — trigger: ${workflow.trigger}`)
})
```

**Verbs**: `activate()` · `activating()` · `activated()` · `activatedBy` · `pause()` · `pausing()` · `paused()` · `pausedBy` · `archive()` · `archiving()` · `archived()` · `archivedBy`

**Key fields**: name, trigger, steps, retryPolicy, errorHandling (`Stop | Continue | Fallback`), timeout, status (`Draft | Active | Paused | Archived`), lastRunAt, runCount, successCount, failureCount

**Relationships**: -> Organization, <- Agents[]

### Integration

External systems connected into the graph — not bolted on through middleware. When Stripe connects as an integration, its data becomes native entities in the same graph.

```typescript
import { Integration } from '@headlessly/platform'

const stripe = await Integration.create({
  name: 'Stripe',
  slug: 'stripe',
  provider: 'stripe',
  category: 'Payment',
  authType: 'OAuth2',
  status: 'Available',
})

await Integration.connect(stripe.$id)
await Integration.disconnect('integration_k7TmPvQx')

Integration.connected((integration) => {
  console.log(`${integration.name} connected via ${integration.authType}`)
})
```

**Verbs**: `connect()` · `connecting()` · `connected()` · `connectedBy` · `disconnect()` · `disconnecting()` · `disconnected()` · `disconnectedBy`

**Key fields**: name, slug, provider, providerUrl, category (`Payment | CRM | Marketing | Analytics | Communication | Storage | AI | Other`), authType (`OAuth2 | ApiKey | Basic | Custom`), status (`Available | ComingSoon | Deprecated`), oauthScopes, configSchema, webhookSupport

### Agent

First-class entities in the graph — not black-box API calls. Agents can be deployed, paused, retired, monitored, and composed into workflows. They have memory, tools, and a full lifecycle.

```typescript
import { Agent } from '@headlessly/platform'

const agent = await Agent.create({
  name: 'Sales Qualifier',
  type: 'Specialist',
  model: 'claude-opus-4-6',
  systemPrompt: 'Qualify inbound leads by analyzing company fit and engagement signals.',
  tools: ['search', 'fetch', 'do'],
  memory: 'Persistent',
  visibility: 'Team',
})

await Agent.deploy(agent.$id)
await Agent.pause('agent_k7TmPvQx')
await Agent.retire('agent_k7TmPvQx')

Agent.deployed(async (agent, $) => {
  await $.Event.create({ type: 'agent.deployed', value: agent.name })
  await $.Workflow.create({
    name: `${agent.name} monitoring`,
    trigger: 'Agent.retired',
  })
})
```

**Verbs**: `deploy()` · `deploying()` · `deployed()` · `deployedBy` · `pause()` · `pausing()` · `paused()` · `pausedBy` · `retire()` · `retiring()` · `retired()` · `retiredBy`

**Key fields**: name, slug, model, systemPrompt, type (`Assistant | Autonomous | Workflow | Specialist | Router`), status (`Draft | Active | Paused | Archived`), visibility (`Private | Team | Organization | Public`), memory (`None | Session | Persistent`), tools, temperature, maxTokens, totalTokens, totalCost, successRate

**Relationships**: -> Organization, -> Owner (Contact), <- Workflows[]

## Agent-Native

Your agent connects to one MCP endpoint. It can orchestrate your entire automation layer:

```json title="platform.headless.ly/mcp#search"
{ "type": "Workflow", "filter": { "status": "Active", "trigger": "Deal.closed" } }
```

```json title="platform.headless.ly/mcp#fetch"
{ "type": "Agent", "id": "agent_k7TmPvQx", "include": ["organization", "workflows"] }
```

```ts title="platform.headless.ly/mcp#do"
const stale = await $.Workflow.find({ status: 'Active', lastRunAt: { '$lt': '2026-01-01' } })
for (const workflow of stale) {
  await $.Workflow.pause(workflow.$id)
  await $.Event.create({ type: 'workflow.stale', value: workflow.name })
}

const idle = await $.Agent.find({ status: 'Active', successRate: { '$lt': 0.5 } })
for (const agent of idle) {
  await $.Agent.retire(agent.$id)
  await $.Ticket.create({
    subject: `Low-performing agent: ${agent.name}`,
    priority: 'High',
  })
}
```

Three tools. Not seven thousand zaps.

## Cross-Domain Operations

Query results are standard arrays — chain operations with familiar JavaScript:

```typescript
const workflows = await Workflow.find({ status: 'Active' })
for (const workflow of workflows) {
  const agents = await Agent.find({ workflow: workflow.$id, status: 'Active', type: 'Specialist' })
  for (const agent of agents) {
    if (agent.successRate < 0.5) {
      await Agent.retire(agent.$id)
      await Ticket.create({ subject: `Low-performing agent: ${agent.name}`, priority: 'High' })
    }
  }
}
```

## License

MIT
