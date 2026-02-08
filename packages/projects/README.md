# @headlessly/projects

Project management entities for projects, issues, and comments — synced bidirectionally with GitHub.

## Install

```bash
npm install @headlessly/projects
```

## Entities

### Project

Top-level project containers with ownership and lifecycle tracking.

```typescript
import { Project } from '@headlessly/projects'

await Project.create({
  name: 'Launch Campaign',
  status: 'Active',
  visibility: 'Private',
})

await Project.archive('project_e5JhLzXc')
await Project.complete('project_e5JhLzXc')
```

**Fields**: `name`, `slug`, `description`, `status`, `visibility`, `startDate`, `targetDate`, `tags`

**Relationships**:
- `organization` -> Organization
- `owner` -> Contact
- `issues` <- Issue.project[]

**Verbs**: `archive()` / `archiving()` / `archived()` / `archivedBy`, `complete()` / `completing()` / `completed()` / `completedBy`

**Enums**:
- `status`: Active | Archived | Completed
- `visibility`: Public | Private

### Issue

Bugs, features, tasks, and epics within a project.

```typescript
import { Issue } from '@headlessly/projects'

await Issue.create({
  title: 'Fix login redirect loop',
  status: 'Open',
  priority: 'High',
  type: 'Bug',
  project: 'project_e5JhLzXc',
})

await Issue.assign('issue_k7TmPvQx')
await Issue.close('issue_k7TmPvQx')
await Issue.reopen('issue_k7TmPvQx')
```

**Fields**: `title`, `description`, `status`, `priority`, `type`, `labels`, `milestone`, `dueDate`

**Relationships**:
- `project` -> Project.issues
- `assignee` -> Contact
- `reporter` -> Contact
- `comments` <- Comment.issue[]

**Verbs**: `assign()` / `assigning()` / `assigned()` / `assignedBy`, `close()` / `closing()` / `closed()` / `closedBy`, `reopen()` / `reopening()` / `reopened()` / `reopenedBy`

**Enums**:
- `status`: Open | InProgress | Review | Done | Closed
- `priority`: Low | Medium | High | Urgent
- `type`: Bug | Feature | Task | Epic

### Comment

Threaded comments on issues.

```typescript
import { Comment } from '@headlessly/projects'

await Comment.create({
  body: 'Reproduced on Chrome 120. Stack trace attached.',
  author: 'contact_fX9bL5nRd',
  issue: 'issue_k7TmPvQx',
})
```

**Fields**: `body`

**Relationships**:
- `author` -> Contact
- `issue` -> Issue.comments

## Event-Driven Reactions

React to project events across the graph:

```typescript
import { Issue, Project } from '@headlessly/projects'

Issue.closed((issue, $) => {
  const open = await $.Issue.find({ project: issue.project, status: 'Open' })
  if (open.length === 0) {
    await $.Project.complete(issue.project)
  }
})

Issue.assigned((issue) => {
  console.log(`${issue.title} assigned`)
})
```

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const urgent = await Project.find({ status: 'Active' })
  .map(p => p.issues)
  .filter(i => i.priority === 'Urgent' && i.status === 'Open')
```

## License

MIT
