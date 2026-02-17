import { Noun } from 'digital-objects'

export const Project = Noun('Project', {
  name: 'string!',
  slug: 'string##',
  description: 'string',
  organization: '-> Organization',
  status: 'Active | Archived | Completed',
  visibility: 'Public | Private',
  owner: '-> Contact',
  startDate: 'date',
  targetDate: 'date',
  issues: '<- Issue.project[]',
  tags: 'string',
  archive: 'Archived',
  complete: 'Completed',
  activate: 'Activated',
})

export const Issue = Noun('Issue', {
  title: 'string!',
  description: 'string',
  status: 'Open | Assigned | InProgress | Review | Done | Closed | Reopened',
  priority: 'Low | Medium | High | Urgent',
  type: 'Bug | Feature | Task | Epic',
  project: '-> Project.issues',
  assignee: '-> Contact',
  reporter: '-> Contact',
  labels: 'string',
  milestone: 'string',
  dueDate: 'date',
  comments: '<- Comment.issue[]',
  assign: 'Assigned',
  close: 'Closed',
  reopen: 'Reopened',
})

export const Comment = Noun('Comment', {
  body: 'string!',
  author: '-> Contact',
  issue: '-> Issue.comments',
  resolve: 'Resolved',
})
