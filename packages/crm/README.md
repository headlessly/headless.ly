# @headlessly/crm

CRM entities for contacts, organizations, deals, leads, activities, and pipelines — as typed Digital Objects with full verb conjugation.

## Install

```bash
npm install @headlessly/crm
```

## Entities

### Organization

Companies and organizations in your CRM graph.

```typescript
import { Organization } from '@headlessly/crm'

await Organization.create({
  name: 'Acme Corp',
  type: 'Customer',
  tier: 'Startup',
  industry: 'Software',
})
```

**Fields**: `name`, `legalName`, `slug`, `domain`, `website`, `description`, `logo`, `type`, `status`, `tier`, `source`, `industry`, `naicsCode`, `employeeCount`, `annualRevenue`, `foundedYear`, `address`, `city`, `state`, `country`, `postalCode`, `timezone`, `lifetimeValue`, `healthScore`, `npsScore`, `linkedinUrl`, `twitterHandle`

**Relationships**:

- `parent` -> Organization (self-referential hierarchy)
- `subsidiaries` <- Organization.parent[]
- `contacts` <- Contact.organization[]
- `deals` <- Deal.organization[]
- `subscriptions` <- Subscription.organization[]

**Enums**:

- `type`: Prospect | Customer | Partner | Vendor | Competitor
- `status`: Active | Inactive | Churned | Archived
- `tier`: Enterprise | Business | Startup | SMB

### Contact

People in your CRM — leads, customers, team members, stakeholders.

```typescript
import { Contact } from '@headlessly/crm'

await Contact.create({
  name: 'Alice Chen',
  email: 'alice@acme.co',
  role: 'DecisionMaker',
})

await Contact.qualify('contact_fX9bL5nRd')

// React to qualification events
Contact.qualified((contact) => {
  console.log(`${contact.name} qualified`)
})
```

**Fields**: `name`, `firstName`, `lastName`, `email`, `phone`, `mobile`, `avatar`, `title`, `department`, `role`, `status`, `source`, `leadScore`, `preferredChannel`, `timezone`, `language`, `linkedinUrl`, `twitterHandle`, `marketingConsent`, `lastEngagement`

**Relationships**:

- `organization` -> Organization.contacts
- `manager` -> Contact.reports (self-referential hierarchy)
- `reports` <- Contact.manager[]
- `leads` <- Lead.contact[]
- `activities` <- Activity.contact[]

**Verbs**: `qualify()` / `qualifying()` / `qualified()` / `qualifiedBy`

**Enums**:

- `role`: DecisionMaker | Influencer | Champion | Blocker | User
- `status`: Active | Inactive | Bounced | Unsubscribed
- `preferredChannel`: Email | Phone | SMS | Chat

### Lead

Inbound or outbound leads tied to contacts, campaigns, and deals.

```typescript
import { Lead } from '@headlessly/crm'

await Lead.create({
  name: 'Acme Inbound',
  source: 'Website',
  contact: 'contact_fX9bL5nRd',
})

await Lead.convert('lead_k7TmPvQx')
await Lead.lose('lead_z3RnWqYp')
```

**Fields**: `name`, `status`, `source`, `sourceDetail`, `score`, `budget`, `authority`, `need`, `timeline`, `convertedAt`, `lostReason`, `lostAt`, `firstTouchAt`, `lastActivityAt`

**Relationships**:

- `contact` -> Contact.leads
- `organization` -> Organization
- `owner` -> Contact
- `campaign` -> Campaign.leads
- `deal` -> Deal.leads

**Verbs**: `convert()` / `converting()` / `converted()` / `convertedBy`, `lose()` / `losing()` / `lost()` / `lostBy`

**Enums**:

- `status`: New | Contacted | Qualified | Converted | Lost

### Deal

Revenue opportunities tracked through pipeline stages.

```typescript
import { Deal } from '@headlessly/crm'

await Deal.create({
  name: 'Acme Enterprise',
  value: 50000,
  stage: 'Qualification',
  organization: 'organization_e5JhLzXc',
})

await Deal.close('deal_k7TmPvQx')
await Deal.win('deal_k7TmPvQx')
```

**Fields**: `name`, `value`, `currency`, `recurringValue`, `recurringInterval`, `stage`, `probability`, `expectedCloseDate`, `actualCloseDate`, `description`, `nextStep`, `competitorNotes`, `lostReason`, `wonReason`, `source`, `lastActivityAt`

**Relationships**:

- `organization` -> Organization.deals
- `contact` -> Contact
- `owner` -> Contact
- `campaign` -> Campaign
- `leads` <- Lead.deal[]
- `activities` <- Activity.deal[]

**Verbs**: `close()` / `closing()` / `closed()` / `closedBy`, `win()` / `winning()` / `won()` / `wonBy`, `lose()` / `losing()` / `lost()` / `lostBy`

**Enums**:

- `stage`: Prospecting | Qualification | Proposal | Negotiation | ClosedWon | ClosedLost
- `recurringInterval`: Monthly | Quarterly | Yearly

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
await Activity.cancel('activity_mN8pZwKj')
```

**Fields**: `subject`, `type`, `description`, `dueAt`, `startAt`, `endAt`, `duration`, `allDay`, `timezone`, `status`, `priority`, `completedAt`, `outcome`, `recordingUrl`, `meetingLink`, `reminderAt`

**Relationships**:

- `deal` -> Deal.activities
- `contact` -> Contact.activities
- `organization` -> Organization
- `campaign` -> Campaign
- `assignee` -> Contact
- `createdBy` -> Contact

**Verbs**: `complete()` / `completing()` / `completed()` / `completedBy`, `cancel()` / `cancelling()` / `cancelled()` / `cancelledBy`

**Enums**:

- `type`: Call | Email | Meeting | Task | Note | Demo | FollowUp
- `status`: Pending | InProgress | Completed | Cancelled
- `priority`: Low | Medium | High | Urgent

### Pipeline

Named pipeline configurations for organizing deal stages.

```typescript
import { Pipeline } from '@headlessly/crm'

await Pipeline.create({
  name: 'Enterprise Sales',
  stages: 'Discovery, Qualification, Proposal, Negotiation, Closed',
})
```

**Fields**: `name`, `slug`, `description`, `isDefault`, `stages`, `dealRotting`

## Event-Driven Reactions

Every verb fires lifecycle events you can subscribe to:

```typescript
import { Deal, Contact } from '@headlessly/crm'

Deal.closed((deal, $) => {
  $.Contact.qualify(deal.contact)
})

Contact.qualified((contact) => {
  console.log(`${contact.name} is now qualified`)
})
```

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const qualified = await Contact.find({ status: 'Active' })
  .map((c) => c.deals)
  .filter((d) => d.stage === 'Qualification')
```

## License

MIT
