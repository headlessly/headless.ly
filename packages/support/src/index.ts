import { Noun } from 'digital-objects'

export const Ticket = Noun('Ticket', {
  subject: 'string!',
  description: 'string',
  status: 'Open | Pending | InProgress | Resolved | Escalated | Closed | Reopened',
  priority: 'Low | Medium | High | Urgent',
  category: 'string',
  assignee: '-> Contact',
  requester: '-> Contact',
  organization: '-> Organization',
  deal: '-> Deal',
  channel: 'Email | Chat | Phone | Web | API',
  tags: 'string',
  firstResponseAt: 'datetime',
  resolvedAt: 'datetime',
  satisfaction: 'number',
  assign: 'Assigned',
  resolve: 'Resolved',
  escalate: 'Escalated',
  close: 'Closed',
  reopen: 'Reopened',
})
