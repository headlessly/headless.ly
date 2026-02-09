# @headlessly/platform

Platform entities for workflows, integrations, and agents — the automation and orchestration layer as typed Digital Objects.

## Install

```bash
npm install @headlessly/platform
```

## Entities

### Workflow

Event-driven automation workflows with step definitions, retry policies, and execution tracking.

```typescript
import { Workflow } from '@headlessly/platform'

await Workflow.create({
  name: 'Lead Qualification',
  trigger: 'Contact.created',
  steps: JSON.stringify([
    { action: 'Contact.qualify', condition: 'leadScore > 80' },
    { action: 'Deal.create', params: { stage: 'Qualification' } },
    { action: 'Activity.create', params: { type: 'Task', subject: 'Follow up' } },
  ]),
  errorHandling: 'Continue',
  timeout: 30000,
  organization: 'organization_e5JhLzXc',
})

await Workflow.activate('workflow_fX9bL5nRd')
await Workflow.pause('workflow_fX9bL5nRd')
await Workflow.archive('workflow_fX9bL5nRd')
```

**Fields**: `name`, `description`, `trigger`, `steps`, `retryPolicy`, `errorHandling`, `timeout`, `status`, `version`, `lastRunAt`, `runCount`, `successCount`, `failureCount`

**Relationships**:

- `organization` -> Organization

**Verbs**: `activate()` / `activating()` / `activated()` / `activatedBy`, `pause()` / `pausing()` / `paused()` / `pausedBy`, `archive()` / `archiving()` / `archived()` / `archivedBy`

**Enums**:

- `errorHandling`: Stop | Continue | Fallback
- `status`: Draft | Active | Paused | Archived

### Integration

Third-party service connections with OAuth, API key, and webhook support.

```typescript
import { Integration } from '@headlessly/platform'

await Integration.create({
  name: 'Stripe',
  slug: 'stripe',
  provider: 'stripe',
  providerUrl: 'https://stripe.com',
  category: 'Payment',
  authType: 'OAuth2',
  status: 'Available',
})

await Integration.connect('integration_k7TmPvQx')
await Integration.disconnect('integration_k7TmPvQx')
```

**Fields**: `name`, `slug`, `description`, `provider`, `providerUrl`, `providerLogo`, `category`, `authType`, `oauthScopes`, `configSchema`, `status`, `featured`, `apiBaseUrl`, `webhookSupport`

**Verbs**: `connect()` / `connecting()` / `connected()` / `connectedBy`, `disconnect()` / `disconnecting()` / `disconnected()` / `disconnectedBy`

**Enums**:

- `category`: Payment | CRM | Marketing | Analytics | Communication | Storage | AI | Other
- `authType`: OAuth2 | ApiKey | Basic | Custom
- `status`: Available | ComingSoon | Deprecated

### Agent

AI agents with configurable models, tools, memory, and deployment lifecycle.

```typescript
import { Agent } from '@headlessly/platform'

await Agent.create({
  name: 'Sales Assistant',
  slug: 'sales-assistant',
  type: 'Specialist',
  model: 'claude-opus-4-6',
  systemPrompt: 'You are a sales assistant that helps qualify leads and manage deals.',
  tools: JSON.stringify(['search', 'fetch', 'do']),
  memory: 'Persistent',
  visibility: 'Team',
  organization: 'organization_e5JhLzXc',
})

await Agent.deploy('agent_mN8pZwKj')
await Agent.pause('agent_mN8pZwKj')
await Agent.retire('agent_mN8pZwKj')
```

**Fields**: `name`, `slug`, `description`, `avatar`, `model`, `systemPrompt`, `instructions`, `persona`, `type`, `status`, `visibility`, `temperature`, `maxTokens`, `tools`, `functions`, `knowledgeBases`, `memory`, `memoryWindow`, `totalTokens`, `totalCost`, `averageLatency`, `successRate`, `rating`, `ratingCount`, `version`, `publishedAt`, `tags`

**Relationships**:

- `organization` -> Organization
- `owner` -> Contact

**Verbs**: `deploy()` / `deploying()` / `deployed()` / `deployedBy`, `pause()` / `pausing()` / `paused()` / `pausedBy`, `retire()` / `retiring()` / `retired()` / `retiredBy`

**Enums**:

- `type`: Assistant | Autonomous | Workflow | Specialist | Router
- `status`: Draft | Active | Paused | Archived
- `visibility`: Private | Team | Organization | Public
- `memory`: None | Session | Persistent

## Event-Driven Reactions

React to platform lifecycle events:

```typescript
import { Workflow, Agent, Integration } from '@headlessly/platform'

Workflow.activated((workflow) => {
  console.log(`Workflow "${workflow.name}" activated — trigger: ${workflow.trigger}`)
})

Agent.deployed((agent) => {
  console.log(`Agent "${agent.name}" deployed with model ${agent.model}`)
})

Integration.connected((integration) => {
  console.log(`Integration "${integration.name}" connected via ${integration.authType}`)
})
```

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const active = await Agent.find({ status: 'Active' }).filter((a) => a.type === 'Specialist')
```

## License

MIT
