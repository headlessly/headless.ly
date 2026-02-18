# @headlessly/crm

> Your CRM was designed for humans clicking buttons. Your agents deserve better.

```typescript
import { Contact, Deal } from '@headlessly/crm'

await Contact.create({ name: 'Alice Chen', email: 'alice@acme.co', stage: 'Lead' })
await Contact.qualify('contact_fX9bL5nRd')

// A deal closes — billing, support, and marketing react instantly
Deal.closed(async (deal, $) => {
  await $.Subscription.create({ plan: 'pro', customer: deal.contact })
  await $.Ticket.create({ subject: `Welcome ${deal.name}`, requester: deal.contact })
  await $.Campaign.create({ name: `Onboard ${deal.name}`, type: 'Email' })
})
```

No HubSpot API. No Salesforce SOQL. No webhook middleware. Contacts, deals, and the entire business graph — in one typed system your agent can operate autonomously.

## The Problem

HubSpot has 500+ API endpoints. Salesforce has SOQL, SOSL, Apex, and 40 years of enterprise baggage. Pipedrive is simpler but still human-first — built for sales reps dragging cards across a Kanban board.

None of them were built for an AI agent to operate.

Your agent doesn't need a drag-and-drop pipeline view. It needs `Deal.close()`. It doesn't need a contact record page with 47 tabs. It needs `Contact.qualify()`. It doesn't need a "workflow builder" GUI. It needs a BEFORE hook:

```typescript
Contact.qualifying((contact) => {
  if (contact.leadScore < 50) throw new Error('Score too low to qualify')
})
```

## One Typed Graph

When you close a deal in HubSpot, does your Stripe subscription activate? Does your Zendesk ticket system know? Does your analytics pipeline capture it?

Not without Zapier, webhook handlers, and a prayer.

In headless.ly, closing a deal IS activating a subscription IS tracking an event IS creating a ticket — because they're all nodes in the same graph:

```typescript
import { Deal, Contact } from '@headlessly/crm'

Deal.closed(async (deal, $) => {
  await $.Subscription.create({ plan: 'pro', customer: deal.contact })
  await $.Event.create({ type: 'deal.closed', value: deal.value })
  await $.Campaign.create({ name: `Onboard ${deal.name}`, type: 'Email' })
})

Contact.qualified(async (contact, $) => {
  await $.Deal.create({ name: `${contact.name} opportunity`, contact: contact.$id })
  await $.Activity.create({ subject: `Follow up with ${contact.name}`, type: 'Task' })
})
```

No webhooks. No Zapier. No integration tax. One graph.

## Install

```bash
npm install @headlessly/crm
```

## Entities

### Contact

People in your graph — leads, customers, partners, stakeholders.

```typescript
import { Contact } from '@headlessly/crm'

const alice = await Contact.create({
  name: 'Alice Chen',
  email: 'alice@acme.co',
  role: 'DecisionMaker',
  stage: 'Lead',
})

await Contact.qualify(alice.$id)

Contact.qualified((contact, $) => {
  $.Deal.create({ name: `${contact.name} opportunity`, contact: contact.$id })
})
```

**Verbs**: `qualify()` · `qualifying()` · `qualified()` · `qualifiedBy`

**Key fields**: name, email, phone, title, role (`DecisionMaker | Influencer | Champion | Blocker | User`), status (`Active | Inactive | Bounced | Unsubscribed`), leadScore, source

**Relationships**: → Organization, → Manager, ← Leads[], ← Activities[], ← Deals[]

### Deal

Revenue opportunities with real verbs — not status string updates.

```typescript
import { Deal } from '@headlessly/crm'

const deal = await Deal.create({
  name: 'Acme Enterprise',
  value: 50000,
  stage: 'Qualification',
  contact: 'contact_fX9bL5nRd',
  organization: 'organization_e5JhLzXc',
})

await Deal.close(deal.$id)
await Deal.win(deal.$id)
```

**Verbs**: `close()` · `win()` · `lose()` — each with full lifecycle conjugation

**Key fields**: name, value, currency, stage (`Prospecting | Qualification | Proposal | Negotiation | ClosedWon | ClosedLost`), probability, expectedCloseDate, source

**Relationships**: → Organization, → Contact, → Owner, → Campaign, ← Leads[], ← Activities[]

### Company

Organizations in your CRM graph with hierarchy support.

```typescript
import { Organization } from '@headlessly/crm'

await Organization.create({
  name: 'Acme Corp',
  type: 'Customer',
  tier: 'Startup',
  industry: 'Software',
})
```

**Key fields**: name, domain, type (`Prospect | Customer | Partner | Vendor | Competitor`), status, tier (`Enterprise | Business | Startup | SMB`), industry, employeeCount, annualRevenue

**Relationships**: → Parent, ← Subsidiaries[], ← Contacts[], ← Deals[], ← Subscriptions[]

### Lead

Inbound and outbound leads with conversion tracking.

```typescript
import { Lead } from '@headlessly/crm'

await Lead.create({ name: 'Acme Inbound', source: 'Website', contact: 'contact_fX9bL5nRd' })
await Lead.convert('lead_k7TmPvQx')
```

**Verbs**: `convert()` · `lose()` — each with full lifecycle conjugation

### Activity

Calls, emails, meetings, and tasks linked to contacts and deals.

```typescript
import { Activity } from '@headlessly/crm'

await Activity.create({
  subject: 'Discovery call with Alice',
  type: 'Call',
  contact: 'contact_fX9bL5nRd',
  deal: 'deal_k7TmPvQx',
})

await Activity.complete('activity_mN8pZwKj')
```

**Verbs**: `complete()` · `cancel()` — each with full lifecycle conjugation

### Pipeline

Named pipeline configurations for organizing deal stages.

```typescript
import { Pipeline } from '@headlessly/crm'

await Pipeline.create({
  name: 'Enterprise Sales',
  stages: 'Discovery, Qualification, Proposal, Negotiation, Closed',
})
```

## Agent-Native

Your agent connects to one MCP server. It can operate your entire CRM:

```json title="crm.headless.ly/mcp#search"
{ "type": "Contact", "filter": { "stage": "Lead", "leadScore": { "$gte": 50 } } }
```

```json title="crm.headless.ly/mcp#fetch"
{ "type": "Deal", "id": "deal_fX9bL5nRd", "include": ["contact", "organization", "activities"] }
```

```ts title="crm.headless.ly/mcp#do"
const qualified = await $.Contact.find({ stage: 'Qualified' })
for (const contact of qualified) {
  await $.Deal.create({
    name: `${contact.name} opportunity`,
    contact: contact.$id,
    stage: 'Prospecting',
  })
}
```

Three tools. Not three hundred endpoints.

## Cross-Domain Operations

Query results are standard arrays — chain operations with familiar JavaScript:

```typescript
const active = await Contact.find({ status: 'Active' })
for (const contact of active) {
  const deals = await Deal.find({ contact: contact.$id })
  const open = deals.filter((d) => d.stage !== 'ClosedWon' && d.stage !== 'ClosedLost')
  for (const deal of open) {
    await Deal.update(deal.$id, { lastContactedAt: new Date().toISOString() })
  }
}
```

## License

MIT
