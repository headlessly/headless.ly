import { Noun } from 'digital-objects'

export const Campaign = Noun('Campaign', {
  name: 'string!',
  slug: 'string##',
  description: 'string',
  type: 'Email | Social | Content | Event | Paid | Webinar | Referral',
  status: 'Draft | Scheduled | Active | Paused | Completed | Cancelled',
  startDate: 'date',
  endDate: 'date',
  launchedAt: 'datetime',
  budget: 'number',
  actualCost: 'number',
  currency: 'string',
  targetLeads: 'number',
  targetRevenue: 'number',
  leads: '<- Lead.campaign[]',
  actualLeads: 'number',
  actualRevenue: 'number',
  roi: 'number',
  landingPageUrl: 'string',
  utmSource: 'string',
  utmMedium: 'string',
  utmCampaign: 'string',
  owner: '-> Contact',
  launch: 'Launched',
  pause: 'Paused',
  complete: 'Completed',
})

export const Segment = Noun('Segment', {
  name: 'string!',
  description: 'string',
  criteria: 'string',
  organization: '-> Organization',
  memberCount: 'number',
  isDynamic: 'string',
})

export const Form = Noun('Form', {
  name: 'string!',
  description: 'string',
  fields: 'string',
  organization: '-> Organization',
  status: 'Draft | Active | Archived',
  submissionCount: 'number',
  publish: 'Published',
  archive: 'Archived',
})
