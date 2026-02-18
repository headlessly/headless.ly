# @headlessly/projects

> Jira has 10,000 settings. Your agent needs `Issue.close()`.

```typescript
import { Issue } from '@headlessly/projects'

await Issue.create({ title: 'Fix login redirect loop', type: 'Bug', priority: 'High', project: 'project_e5JhLzXc' })
await Issue.close('issue_k7TmPvQx')

// An issue closes — the deal progresses, support links, marketing knows
Issue.closed(async (issue, $) => {
  await $.Deal.update(issue.assignee, { stage: 'Negotiation' })
  await $.Event.create({ type: 'issue.closed', value: issue.title })
  const open = await $.Issue.find({ project: issue.project, status: 'Open' })
  if (open.length === 0) {
    await $.Project.complete(issue.project)
  }
})
```

No Jira JQL. No Linear GraphQL. No Asana webhook plumbing. Projects, issues, and the entire business graph — in one typed system your agent can operate autonomously. Synced bidirectionally with GitHub.

## The Problem

Jira has 10,000 configuration options, a query language nobody memorized, and 200+ API endpoints designed for enterprise PMs who file tickets in their sleep. Linear is cleaner but still human-first — built for engineers dragging cards across a board. Asana is a task list with a marketing budget.

None of them were built for an AI agent to operate.

Your agent doesn't need a sprint board. It needs `Issue.close()`. It doesn't need a backlog grooming UI. It needs `Issue.assign()`. It doesn't need a "workflow automation" GUI with drag-and-drop triggers. It needs a BEFORE hook:

```typescript
Issue.closing((issue) => {
  if (!issue.assignee) throw new Error('Cannot close unassigned issue')
})
```

And none of them connect to the rest of your business. When a bug closes in Jira, does your CRM know the deal can move forward? Does your support system close the related ticket? Does your marketing team know a feature shipped?

Not without Zapier, webhook handlers, and a prayer.

## One Typed Graph

When an issue closes in headless.ly, your CRM already knows. Your billing system already knows. Your support queue already knows. Because they're the same system:

```typescript
import { Issue, Project } from '@headlessly/projects'

Issue.closed(async (issue, $) => {
  await $.Ticket.update(issue.$id, { status: 'Resolved' })
  await $.Event.create({ type: 'issue.closed', value: issue.title })
  await $.Campaign.create({ name: `${issue.title} shipped`, type: 'Announcement' })
})

Issue.created(async (issue, $) => {
  if (issue.type === 'Bug') {
    await $.Ticket.create({ subject: `Bug: ${issue.title}`, priority: issue.priority })
  }
})

Project.completed(async (project, $) => {
  await $.Deal.update(project.owner, { stage: 'ClosedWon' })
  await $.Event.create({ type: 'project.completed', value: project.name })
})
```

No webhooks. No Zapier. No integration tax. One graph.

## Install

```bash
npm install @headlessly/projects
```

## Entities

### Project

Top-level containers with ownership, lifecycle, and full GitHub repo sync.

```typescript
import { Project } from '@headlessly/projects'

const project = await Project.create({
  name: 'Launch Campaign',
  status: 'Active',
  visibility: 'Private',
  owner: 'contact_fX9bL5nRd',
})

await Project.archive(project.$id)
await Project.complete(project.$id)

Project.completed((project, $) => {
  $.Deal.update(project.owner, { stage: 'ClosedWon' })
})
```

**Verbs**: `archive()` · `archiving()` · `archived()` · `archivedBy` · `complete()` · `completing()` · `completed()` · `completedBy`

**Key fields**: name, slug, description, status (`Active | Archived | Completed`), visibility (`Public | Private`), startDate, targetDate, tags

**Relationships**: → Organization, → Owner (Contact), ← Issues[]

### Issue

Bugs, features, tasks, and epics — synced bidirectionally with GitHub Issues.

```typescript
import { Issue } from '@headlessly/projects'

const issue = await Issue.create({
  title: 'Fix login redirect loop',
  status: 'Open',
  priority: 'High',
  type: 'Bug',
  project: 'project_e5JhLzXc',
})

await Issue.assign('issue_k7TmPvQx')
await Issue.close('issue_k7TmPvQx')
await Issue.reopen('issue_k7TmPvQx')

Issue.assigned((issue) => {
  console.log(`${issue.title} assigned to ${issue.assignee}`)
})
```

**Verbs**: `assign()` · `assigning()` · `assigned()` · `assignedBy` · `close()` · `closing()` · `closed()` · `closedBy` · `reopen()` · `reopening()` · `reopened()` · `reopenedBy`

**Key fields**: title, description, status (`Open | InProgress | Review | Done | Closed`), priority (`Low | Medium | High | Urgent`), type (`Bug | Feature | Task | Epic`), labels, milestone, dueDate

**Relationships**: → Project, → Assignee (Contact), → Reporter (Contact), ← Comments[]

### Comment

Threaded comments on issues — synced with GitHub issue comments.

```typescript
import { Comment } from '@headlessly/projects'

await Comment.create({
  body: 'Reproduced on Chrome 120. Stack trace attached.',
  author: 'contact_fX9bL5nRd',
  issue: 'issue_k7TmPvQx',
})
```

**Key fields**: body

**Relationships**: → Author (Contact), → Issue

## Agent-Native

Your agent connects to one MCP endpoint. It can operate your entire project management stack:

```json title="projects.headless.ly/mcp#search"
{ "type": "Issue", "filter": { "priority": "Urgent", "status": "Open" } }
```

```json title="projects.headless.ly/mcp#fetch"
{ "type": "Issue", "id": "issue_k7TmPvQx", "include": ["project", "assignee", "comments"] }
```

```ts title="projects.headless.ly/mcp#do"
const unassigned = await $.Issue.find({ status: 'Open', assignee: { $exists: false } })
for (const issue of unassigned) {
  await $.Issue.assign(issue.$id)
  await $.Comment.create({
    body: 'Auto-assigned by triage agent',
    issue: issue.$id,
    author: 'contact_mN8pZwKj',
  })
}
```

Three tools. Not three hundred endpoints.

## Cross-Domain Operations

Query results are standard arrays — chain operations with familiar JavaScript:

```typescript
const projects = await Project.find({ status: 'Active' })
for (const project of projects) {
  const bugs = await Issue.find({
    project: project.$id,
    priority: 'Urgent',
    type: 'Bug',
    status: 'Open',
  })
  for (const bug of bugs) {
    await Issue.assign(bug.$id)
  }
}
```

## License

MIT
