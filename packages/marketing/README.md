# @headlessly/marketing

> Mailchimp was built for marketers dragging email templates. Your agent just needs `Campaign.launch()`.

```typescript
import { Campaign, Segment, Form } from '@headlessly/marketing'

await Segment.create({ name: 'Trial Users', criteria: { subscription: { status: 'Trialing' } }, isDynamic: true })
await Campaign.create({ name: 'Trial Conversion', type: 'Email', segment: 'segment_k7TmPvQx', budget: 2000 })
await Campaign.launch('campaign_fX9bL5nRd')

// A form captures a lead — CRM, deals, and analytics react instantly
Form.submitted(async (form, $) => {
  const contact = await $.Contact.create({ name: form.data.name, email: form.data.email, stage: 'Lead' })
  await $.Deal.create({ name: `${form.data.name} inbound`, contact: contact.$id, source: 'Form' })
  await $.Event.create({ type: 'form.submitted', value: form.$id })
})
```

No ActiveCampaign workflows. No HubSpot marketing portal. No CSV audience imports. Campaigns, segments, and forms — in one typed system your agent can operate autonomously.

## The Problem

Mailchimp has a drag-and-drop email builder. ActiveCampaign has a visual automation canvas. HubSpot Marketing Hub has "smart content" and 200+ settings pages. All of them were designed for a human marketer sitting in a GUI, dragging blocks and clicking "Send."

None of them were built for an AI agent to operate.

Your agent doesn't need a drag-and-drop email builder. It needs `Campaign.launch()`. It doesn't need a visual segment builder with click-to-add rules. It needs a typed criteria object. It doesn't need a form builder with pixel-perfect previews. It needs `Form.publish()` and a submission webhook that flows directly into the CRM.

And the real problem: your marketing data is an island. Campaigns live in Mailchimp. Contacts live in HubSpot. Subscriptions live in Stripe. Analytics live in Google Analytics. You spend more time syncing audiences and mapping fields than actually running campaigns:

```typescript
Campaign.launching(campaign => {
  if (campaign.budget > 10000 && !campaign.approvedBy) {
    throw new Error('Campaigns over $10k require approval')
  }
})
```

## One Typed Graph

When you launch a campaign in Mailchimp, does it know which contacts are paying customers? Does it know their subscription tier? Does it know their support ticket history?

Not without CSV exports, Zapier zaps, and a spreadsheet in the middle.

In headless.ly, campaigns know your CRM contacts, your billing subscribers, and your product analytics — because they're all nodes in the same graph:

```typescript
import { Campaign, Segment } from '@headlessly/marketing'

Campaign.completed(async (campaign, $) => {
  const leads = await $.Contact.find({ source: campaign.$id, stage: 'Lead' })
  for (const lead of leads) {
    await $.Contact.qualify(lead.$id)
    await $.Deal.create({ name: `${lead.name} from ${campaign.name}`, contact: lead.$id })
  }
  await $.Event.create({ type: 'campaign.completed', value: campaign.roi })
  await $.Metric.create({ name: 'campaign_roi', value: campaign.roi, campaign: campaign.$id })
})

// Segments built from real billing data — not imported CSV lists
await Segment.create({
  name: 'Churned Enterprise',
  criteria: {
    subscription: { status: 'Canceled' },
    organization: { tier: 'Enterprise' },
  },
  isDynamic: true,
})
```

No Zapier. No audience sync. No field mapping. One graph.

## Install

```bash
npm install @headlessly/marketing
```

## Entities

### Campaign

Multi-channel marketing campaigns with budget tracking, UTM attribution, and ROI measurement.

```typescript
import { Campaign } from '@headlessly/marketing'

const campaign = await Campaign.create({
  name: 'Product Hunt Launch',
  type: 'Social',
  budget: 5000,
  currency: 'usd',
  targetLeads: 500,
  startDate: '2026-03-01',
  endDate: '2026-03-15',
})

await Campaign.launch(campaign.$id)
await Campaign.pause(campaign.$id)
await Campaign.complete(campaign.$id)

Campaign.launched((campaign, $) => {
  $.Event.create({ type: 'campaign.launched', value: campaign.name })
})
```

**Verbs**: `launch()` · `launching()` · `launched()` · `launchedBy`, `pause()` · `pausing()` · `paused()` · `pausedBy`, `complete()` · `completing()` · `completed()` · `completedBy`

**Key fields**: name, slug, description, type (`Email | Social | Content | Event | Paid | Webinar | Referral`), status (`Draft | Scheduled | Active | Paused | Completed | Cancelled`), budget, actualCost, currency, targetLeads, actualLeads, roi, utmSource, utmMedium, utmCampaign

**Relationships**: → Segment, → Owner (Contact), ← Deals[], ← Events[]

### Segment

Dynamic or static audience segments built from real CRM and billing data — not imported CSV lists.

```typescript
import { Segment } from '@headlessly/marketing'

await Segment.create({
  name: 'Active Pro Subscribers',
  criteria: {
    subscription: { status: 'Active', plan: 'pro' },
    contact: { stage: 'Customer' },
  },
  isDynamic: true,
})

// Static segment for a one-off campaign
await Segment.create({
  name: 'Conference Attendees 2026',
  isDynamic: false,
})
```

**Key fields**: name, description, criteria, memberCount, isDynamic

**Relationships**: → Organization, ← Campaigns[]

### Form

Lead capture forms with field definitions and submission tracking — every submission flows directly into the CRM pipeline.

```typescript
import { Form } from '@headlessly/marketing'

const form = await Form.create({
  name: 'Newsletter Signup',
  fields: [
    { name: 'email', type: 'email', required: true },
    { name: 'name', type: 'text', required: false },
    { name: 'company', type: 'text', required: false },
  ],
})

await Form.publish(form.$id)
await Form.archive(form.$id)

Form.published((form, $) => {
  $.Event.create({ type: 'form.published', value: form.name })
})
```

**Verbs**: `publish()` · `publishing()` · `published()` · `publishedBy`, `archive()` · `archiving()` · `archived()` · `archivedBy`

**Key fields**: name, description, fields, status (`Draft | Active | Archived`), submissionCount

**Relationships**: → Organization, → Campaign, ← Contacts[]

## Agent-Native

Your agent connects to one MCP endpoint. It can operate your entire marketing stack:

```json title="marketing.headless.ly/mcp#search"
{ "type": "Campaign", "filter": { "status": "Active", "type": "Email" } }
```

```json title="marketing.headless.ly/mcp#fetch"
{ "type": "Campaign", "id": "campaign_fX9bL5nRd", "include": ["segment", "events"] }
```

```ts title="marketing.headless.ly/mcp#do"
const active = await $.Campaign.find({ status: 'Active' })
for (const campaign of active) {
  const leads = await $.Contact.find({ source: campaign.$id, stage: 'Lead' })
  if (leads.length > campaign.targetLeads) {
    await $.Campaign.complete(campaign.$id)
  }
}
```

Three tools. Not a 200-endpoint marketing API.

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const campaignLeads = await Campaign.find({ status: 'Completed' })
  .map(c => c.segment)
  .map(s => s.contacts)
  .filter(c => c.stage === 'Lead')
```

## License

MIT
