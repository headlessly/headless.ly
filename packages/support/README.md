# @headlessly/support

> Zendesk was designed for humans in a browser. Your AI agent IS the support team.

```typescript
import { Ticket } from '@headlessly/support'

await Ticket.create({
  subject: 'Cannot access billing dashboard',
  priority: 'High',
  channel: 'Web',
  requester: 'contact_fX9bL5nRd',
})

// A ticket is resolved — CRM, billing, and analytics react instantly
Ticket.resolved(async (ticket, $) => {
  await $.Contact.update(ticket.requester, { lastSupportAt: new Date() })
  await $.Event.create({ type: 'ticket.resolved', value: ticket.satisfaction })
  if (ticket.category === 'billing') {
    await $.Invoice.create({ customer: ticket.organization, note: `Credit for ${ticket.$id}` })
  }
})
```

No Zendesk API. No Intercom webhooks. No Freshdesk middleware. One Ticket entity in the same graph as your CRM, billing, and analytics — operated by your agent, not a support rep in a browser tab.

## The Problem

Zendesk has 700+ API endpoints. Intercom has its own data model, its own contact system, its own messaging layer — a parallel universe to your CRM. Freshdesk built a ticket system for humans triaging in a queue, then bolted on an API as an afterthought.

None of them were built for an AI agent to operate.

Your agent doesn't need a ticket queue with drag-and-drop priority columns. It needs `Ticket.resolve()`. It doesn't need a customer lookup sidebar that shows "recent activity from 3 disconnected systems." It needs the customer's subscription status, invoice history, and deal context in the same graph. It doesn't need an escalation ruleset configured in a GUI. It needs a BEFORE hook:

```typescript
Ticket.escalating(async (ticket, $) => {
  const sub = await $.Subscription.find({ customer: ticket.organization, status: 'Active' })
  if (!sub.length) throw new Error('No active subscription — route to sales instead')
})
```

## One Typed Graph

When a ticket comes in about a billing issue, what does your Zendesk agent see? A ticket. They tab over to Stripe to check the subscription. They tab over to HubSpot to see the deal history. They tab over to Slack to ask someone if this customer is important.

In headless.ly, the ticket already knows. The customer's subscription, their deal history, their MRR, their satisfaction score — it's all the same graph:

```typescript
import { Ticket } from '@headlessly/support'

Ticket.created(async (ticket, $) => {
  const contact = await $.Contact.get(ticket.requester)
  const subs = await $.Subscription.find({ customer: ticket.organization, status: 'Active' })
  const deals = await $.Deal.find({ contact: ticket.requester })

  if (subs.some(s => s.plan === 'enterprise')) {
    await $.Ticket.update(ticket.$id, { priority: 'Urgent' })
  }

  await $.Event.create({ type: 'ticket.created', contact: contact.$id, value: ticket.priority })
})

Ticket.resolved(async (ticket, $) => {
  await $.Contact.update(ticket.requester, { stage: 'Customer' })
  await $.Metric.create({ name: 'resolution_time', value: ticket.resolvedAt - ticket.$createdAt })
})
```

No Zapier. No webhook relay. No data warehouse join query. One graph.

## Install

```bash
npm install @headlessly/support
```

## Entities

### Ticket

Support tickets with multi-channel intake, priority routing, SLA tracking, and full verb-driven lifecycle.

```typescript
import { Ticket } from '@headlessly/support'

const ticket = await Ticket.create({
  subject: 'Payment failed — cannot renew subscription',
  description: 'Getting error code E_PAYMENT_DECLINED on checkout',
  priority: 'High',
  channel: 'Web',
  category: 'billing',
  requester: 'contact_fX9bL5nRd',
  organization: 'organization_e5JhLzXc',
})

await Ticket.resolve(ticket.$id)
await Ticket.escalate(ticket.$id)
await Ticket.close(ticket.$id)
await Ticket.reopen(ticket.$id)
```

**Verbs**: `resolve()` · `escalate()` · `close()` · `reopen()` — each with full lifecycle conjugation (`resolving()` / `resolved()` / `resolvedBy`, etc.)

**Key fields**: subject, description, status (`Open | Pending | InProgress | Resolved | Closed`), priority (`Low | Medium | High | Urgent`), channel (`Email | Chat | Phone | Web | API`), category, tags, firstResponseAt, resolvedAt, satisfaction

**Relationships**: → Contact (assignee), → Contact (requester), → Organization

## Agent-Native

Your agent connects to one MCP endpoint. It can triage, resolve, and escalate your entire support queue:

```json title="support.headless.ly/mcp#search"
{ "type": "Ticket", "filter": { "priority": "Urgent", "status": "Open" } }
```

```json title="support.headless.ly/mcp#fetch"
{ "type": "Ticket", "id": "ticket_k7TmPvQx", "include": ["requester", "organization"] }
```

```ts title="support.headless.ly/mcp#do"
const open = await $.Ticket.find({ status: 'Open', priority: 'Urgent' })
for (const ticket of open) {
  const subs = await $.Subscription.find({ customer: ticket.organization, status: 'Active' })
  if (subs.some(s => s.plan === 'enterprise')) {
    await $.Ticket.escalate(ticket.$id)
  } else {
    await $.Ticket.update(ticket.$id, { status: 'InProgress', assignee: 'contact_mN8pZwKj' })
  }
}
```

Three tools. Not three hundred endpoints.

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const urgentRequesters = await Ticket.find({ priority: 'Urgent', status: 'Open' })
  .map(t => t.requester)
  .map(c => c.deals)
  .filter(d => d.stage !== 'ClosedLost')
```

## License

MIT
