import { Noun } from 'digital-objects'

export const Ticket = Noun('Ticket', {
  subject: 'string!',
  description: 'string',
  status: 'Open | Pending | InProgress | Resolved | Closed',
  priority: 'Low | Medium | High | Urgent',
  category: 'string',
  assignee: '-> Contact',
  requester: '-> Contact',
  organization: '-> Organization',
  channel: 'Email | Chat | Phone | Web | API',
  tags: 'string',
  firstResponseAt: 'datetime',
  resolvedAt: 'datetime',
  satisfaction: 'number',
  resolve: 'Resolved',
  escalate: 'Escalated',
  close: 'Closed',
  reopen: 'Reopened',
})
