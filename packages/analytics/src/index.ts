import { Noun } from 'digital-objects'

export const Event = Noun('Event', {
  name: 'string!',
  type: 'string!',
  data: 'string',
  source: 'Browser | Node | API | Snippet',
  sessionId: 'string',
  userId: 'string',
  anonymousId: 'string',
  organization: '-> Organization',
  timestamp: 'datetime!',
  url: 'string',
  path: 'string',
  referrer: 'string',
  properties: 'string',
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
})

export const Funnel = Noun('Funnel', {
  name: 'string!',
  description: 'string',
  steps: 'string',
  organization: '-> Organization',
  conversionRate: 'number',
  analyze: 'Analyzed',
})

export const Goal = Noun('Goal', {
  name: 'string!',
  description: 'string',
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
