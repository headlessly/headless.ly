import { Noun } from 'digital-objects'

export const Event = Noun('Event', {
  name: 'string!',
  type: 'string!',
  data: 'json',
  source: 'Browser | Node | API | Snippet',
  sessionId: 'string',
  userId: 'string',
  anonymousId: 'string',
  organization: '-> Organization',
  timestamp: 'datetime!',
  url: 'string',
  path: 'string',
  referrer: 'string',
  properties: 'json',
  update: null,
  delete: null,
})

export const Metric = Noun('Metric', {
  name: 'string!',
  value: 'number!',
  type: 'Counter | Gauge | Histogram | Summary',
  unit: 'string',
  dimensions: 'string',
  organization: '-> Organization',
  timestamp: 'datetime',
  record: 'Recorded',
  reset: 'Reset',
  snapshot: 'Snapshotted',
})

export const Funnel = Noun('Funnel', {
  name: 'string!',
  description: 'string',
  steps: 'json',
  organization: '-> Organization',
  conversionRate: 'number',
  analyze: 'Analyzed',
  activate: 'Activated',
})

export const Goal = Noun('Goal', {
  name: 'string!',
  description: 'string',
  metric: '-> Metric',
  target: 'number!',
  current: 'number',
  unit: 'string',
  period: 'Daily | Weekly | Monthly | Quarterly | Yearly',
  status: 'OnTrack | AtRisk | Behind | Achieved | Completed | Missed | Reset',
  organization: '-> Organization',
  achieve: 'Achieved',
  complete: 'Completed',
  miss: 'Missed',
  reset: 'Reset',
})
