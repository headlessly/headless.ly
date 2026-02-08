# @headlessly/marketing

Marketing entities for campaigns, audience segments, and lead capture forms — typed Digital Objects for the full marketing lifecycle.

## Install

```bash
npm install @headlessly/marketing
```

## Entities

### Campaign

Multi-channel marketing campaigns with budget tracking, UTM attribution, and ROI measurement.

```typescript
import { Campaign } from '@headlessly/marketing'

await Campaign.create({
  name: 'Product Hunt Launch',
  type: 'Social',
  budget: 5000,
  currency: 'usd',
  targetLeads: 500,
  startDate: '2025-03-01',
  endDate: '2025-03-15',
})

await Campaign.launch('campaign_fX9bL5nRd')
await Campaign.pause('campaign_fX9bL5nRd')
await Campaign.complete('campaign_fX9bL5nRd')
```

**Fields**: `name`, `slug`, `description`, `type`, `status`, `startDate`, `endDate`, `launchedAt`, `budget`, `actualCost`, `currency`, `targetLeads`, `targetRevenue`, `actualLeads`, `actualRevenue`, `roi`, `landingPageUrl`, `utmSource`, `utmMedium`, `utmCampaign`

**Relationships**:
- `leads` <- Lead.campaign[]
- `owner` -> Contact

**Verbs**: `launch()` / `launching()` / `launched()` / `launchedBy`, `pause()` / `pausing()` / `paused()` / `pausedBy`, `complete()` / `completing()` / `completed()` / `completedBy`

**Enums**:
- `type`: Email | Social | Content | Event | Paid | Webinar | Referral
- `status`: Draft | Scheduled | Active | Paused | Completed | Cancelled

### Segment

Dynamic or static audience segments defined by criteria filters.

```typescript
import { Segment } from '@headlessly/marketing'

await Segment.create({
  name: 'Active Trial Users',
  description: 'Users currently in a trial period',
  criteria: JSON.stringify({
    subscription: { status: 'Trialing' },
    lastEngagement: { $gte: '2025-01-01' },
  }),
  isDynamic: 'true',
  organization: 'organization_e5JhLzXc',
})
```

**Fields**: `name`, `description`, `criteria`, `memberCount`, `isDynamic`

**Relationships**:
- `organization` -> Organization

### Form

Lead capture forms with field definitions and submission tracking.

```typescript
import { Form } from '@headlessly/marketing'

await Form.create({
  name: 'Newsletter Signup',
  fields: JSON.stringify([
    { name: 'email', type: 'email', required: true },
    { name: 'name', type: 'text', required: false },
  ]),
  status: 'Active',
  organization: 'organization_e5JhLzXc',
})

await Form.publish('form_k7TmPvQx')
await Form.archive('form_k7TmPvQx')
```

**Fields**: `name`, `description`, `fields`, `status`, `submissionCount`

**Relationships**:
- `organization` -> Organization

**Verbs**: `publish()` / `publishing()` / `published()` / `publishedBy`, `archive()` / `archiving()` / `archived()` / `archivedBy`

**Enums**:
- `status`: Draft | Active | Archived

## Event-Driven Reactions

React to marketing lifecycle events:

```typescript
import { Campaign, Form } from '@headlessly/marketing'

Campaign.launched((campaign) => {
  console.log(`Campaign "${campaign.name}" is now live`)
})

Campaign.completed((campaign) => {
  console.log(`Campaign "${campaign.name}" ROI: ${campaign.roi}%`)
})

Form.published((form) => {
  console.log(`Form "${form.name}" is now accepting submissions`)
})
```

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const active = await Campaign.find({ status: 'Active' })
  .map(c => c.leads)
  .filter(l => l.status === 'Qualified')
```

## License

MIT
