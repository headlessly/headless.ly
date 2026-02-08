# @headlessly/support

Support ticket entity with resolution, escalation, and satisfaction tracking — a headless help desk as a typed Digital Object.

## Install

```bash
npm install @headlessly/support
```

## Entities

### Ticket

Support tickets with multi-channel intake, priority routing, and lifecycle management.

```typescript
import { Ticket } from '@headlessly/support'

await Ticket.create({
  subject: 'Cannot access billing dashboard',
  description: 'Getting a 403 error when navigating to /billing',
  priority: 'High',
  channel: 'Web',
  requester: 'contact_fX9bL5nRd',
  organization: 'organization_e5JhLzXc',
})

await Ticket.resolve('ticket_k7TmPvQx')
await Ticket.escalate('ticket_k7TmPvQx')
await Ticket.close('ticket_k7TmPvQx')
await Ticket.reopen('ticket_k7TmPvQx')
```

**Fields**: `subject`, `description`, `status`, `priority`, `category`, `channel`, `tags`, `firstResponseAt`, `resolvedAt`, `satisfaction`

**Relationships**:
- `assignee` -> Contact
- `requester` -> Contact
- `organization` -> Organization

**Verbs**: `resolve()` / `resolving()` / `resolved()` / `resolvedBy`, `escalate()` / `escalating()` / `escalated()` / `escalatedBy`, `close()` / `closing()` / `closed()` / `closedBy`, `reopen()` / `reopening()` / `reopened()` / `reopenedBy`

**Enums**:
- `status`: Open | Pending | InProgress | Resolved | Closed
- `priority`: Low | Medium | High | Urgent
- `channel`: Email | Chat | Phone | Web | API

## Event-Driven Reactions

React to support events across the graph:

```typescript
import { Ticket } from '@headlessly/support'

Ticket.escalated((ticket) => {
  console.log(`Ticket "${ticket.subject}" escalated — priority: ${ticket.priority}`)
})

Ticket.resolved((ticket) => {
  console.log(`Ticket "${ticket.subject}" resolved in ${ticket.resolvedAt}`)
})

Ticket.reopened((ticket, $) => {
  // Auto-assign reopened tickets
  await $.Ticket.update(ticket.$id, { status: 'InProgress' })
})
```

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const urgent = await Ticket.find({ priority: 'Urgent' })
  .filter(t => t.status === 'Open')
```

## License

MIT
