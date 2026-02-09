import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Project, Issue, Comment } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/projects -- deep-v2 coverage', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Project Lifecycle: Active -> Completed -> Archived
  // ===========================================================================
  describe('Project lifecycle transitions', () => {
    it('creates a project with default status and transitions to Completed via complete verb', async () => {
      const project = await Project.create({ name: 'MVP Launch', status: 'Active' })
      expect(project.status).toBe('Active')
      expect(project.$version).toBe(1)

      const completed = await (Project as any).complete(project.$id)
      expect(completed.status).toBe('Completed')
      expect(completed.$version).toBe(2)
    })

    it('transitions a project from Active to Archived via archive verb', async () => {
      const project = await Project.create({ name: 'Legacy System', status: 'Active' })
      const archived = await (Project as any).archive(project.$id)
      expect(archived.status).toBe('Archived')
      expect(archived.$version).toBe(2)
    })

    it('transitions a Completed project to Archived via archive verb', async () => {
      const project = await Project.create({ name: 'Done Project', status: 'Active' })
      const completed = await (Project as any).complete(project.$id)
      expect(completed.status).toBe('Completed')

      const archived = await (Project as any).archive(completed.$id)
      expect(archived.status).toBe('Archived')
      expect(archived.$version).toBe(3)
    })

    it('creates a project with all optional fields populated', async () => {
      const project = await Project.create({
        name: 'Full Project',
        slug: 'full-project',
        description: 'A project with all fields set',
        status: 'Active',
        visibility: 'Private',
        owner: 'contact_xY7zK9mR',
        startDate: '2025-01-01',
        targetDate: '2025-06-30',
        tags: 'backend,api,v2',
      })
      expect(project.name).toBe('Full Project')
      expect(project.slug).toBe('full-project')
      expect(project.description).toBe('A project with all fields set')
      expect(project.status).toBe('Active')
      expect(project.visibility).toBe('Private')
      expect(project.owner).toBe('contact_xY7zK9mR')
      expect(project.startDate).toBe('2025-01-01')
      expect(project.targetDate).toBe('2025-06-30')
      expect(project.tags).toBe('backend,api,v2')
    })
  })

  // ===========================================================================
  // 2. Issue State Machine: Open -> InProgress -> Review -> Done -> Closed
  // ===========================================================================
  describe('Issue state machine (full cycle)', () => {
    it('transitions through all five states sequentially via update', async () => {
      const issue = await Issue.create({ title: 'Auth module', status: 'Open' })
      expect(issue.status).toBe('Open')

      const ip = await Issue.update(issue.$id, { status: 'InProgress' })
      expect(ip.status).toBe('InProgress')
      expect(ip.$version).toBe(2)

      const review = await Issue.update(issue.$id, { status: 'Review' })
      expect(review.status).toBe('Review')
      expect(review.$version).toBe(3)

      const done = await Issue.update(issue.$id, { status: 'Done' })
      expect(done.status).toBe('Done')
      expect(done.$version).toBe(4)

      const closed = await (Issue as any).close(issue.$id)
      expect(closed.status).toBe('Closed')
      expect(closed.$version).toBe(5)
    })

    it('can skip states (Open directly to Done)', async () => {
      const issue = await Issue.create({ title: 'Trivial fix', status: 'Open' })
      const done = await Issue.update(issue.$id, { status: 'Done' })
      expect(done.status).toBe('Done')
    })

    it('can revert state (InProgress back to Open)', async () => {
      const issue = await Issue.create({ title: 'Blocked task', status: 'Open' })
      await Issue.update(issue.$id, { status: 'InProgress' })
      const reverted = await Issue.update(issue.$id, { status: 'Open' })
      expect(reverted.status).toBe('Open')
      expect(reverted.$version).toBe(3)
    })
  })

  // ===========================================================================
  // 3. Issue Priority and Severity
  // ===========================================================================
  describe('Issue priority management', () => {
    it('creates issues with each priority level', async () => {
      const low = await Issue.create({ title: 'Low prio', priority: 'Low' })
      const med = await Issue.create({ title: 'Med prio', priority: 'Medium' })
      const high = await Issue.create({ title: 'High prio', priority: 'High' })
      const urgent = await Issue.create({ title: 'Urgent prio', priority: 'Urgent' })

      expect(low.priority).toBe('Low')
      expect(med.priority).toBe('Medium')
      expect(high.priority).toBe('High')
      expect(urgent.priority).toBe('Urgent')
    })

    it('updates issue priority from Low to Urgent', async () => {
      const issue = await Issue.create({ title: 'Escalating issue', priority: 'Low' })
      const escalated = await Issue.update(issue.$id, { priority: 'Urgent' })
      expect(escalated.priority).toBe('Urgent')
      expect(escalated.$version).toBe(2)
    })

    it('filters issues by priority', async () => {
      await Issue.create({ title: 'A', priority: 'High', status: 'Open' })
      await Issue.create({ title: 'B', priority: 'High', status: 'Open' })
      await Issue.create({ title: 'C', priority: 'Low', status: 'Open' })

      const highPrio = await Issue.find({ priority: 'High' })
      expect(highPrio.length).toBe(2)
      for (const issue of highPrio) {
        expect(issue.priority).toBe('High')
      }
    })
  })

  // ===========================================================================
  // 4. Issue Type (Bug, Feature, Task, Epic)
  // ===========================================================================
  describe('Issue types', () => {
    it('creates issues with each type', async () => {
      const bug = await Issue.create({ title: 'Login broken', type: 'Bug', status: 'Open' })
      const feature = await Issue.create({ title: 'Dark mode', type: 'Feature', status: 'Open' })
      const task = await Issue.create({ title: 'Write docs', type: 'Task', status: 'Open' })
      const epic = await Issue.create({ title: 'V2 release', type: 'Epic', status: 'Open' })

      expect(bug.type).toBe('Bug')
      expect(feature.type).toBe('Feature')
      expect(task.type).toBe('Task')
      expect(epic.type).toBe('Epic')
    })

    it('filters issues by type', async () => {
      await Issue.create({ title: 'Bug 1', type: 'Bug', status: 'Open' })
      await Issue.create({ title: 'Bug 2', type: 'Bug', status: 'Open' })
      await Issue.create({ title: 'Feature 1', type: 'Feature', status: 'Open' })

      const bugs = await Issue.find({ type: 'Bug' })
      expect(bugs.length).toBe(2)
    })
  })

  // ===========================================================================
  // 5. Issue Assignment and Labels
  // ===========================================================================
  describe('Issue assignment and labels', () => {
    it('assigns an issue using the assign verb with additional data', async () => {
      const issue = await Issue.create({ title: 'Design homepage', status: 'Open' })
      const assigned = await (Issue as any).assign(issue.$id, { assignee: 'contact_rT5vJkQz' })
      expect(assigned.assignee).toBe('contact_rT5vJkQz')
    })

    it('reassigns an issue to a different contact', async () => {
      const issue = await Issue.create({ title: 'API design', status: 'Open', assignee: 'contact_aB3cD4eF' })
      const reassigned = await Issue.update(issue.$id, { assignee: 'contact_gH5iJ6kL' })
      expect(reassigned.assignee).toBe('contact_gH5iJ6kL')
    })

    it('creates an issue with labels', async () => {
      const issue = await Issue.create({ title: 'Perf issue', labels: 'performance,critical', status: 'Open' })
      expect(issue.labels).toBe('performance,critical')
    })

    it('updates issue labels', async () => {
      const issue = await Issue.create({ title: 'Styling', labels: 'ui', status: 'Open' })
      const updated = await Issue.update(issue.$id, { labels: 'ui,css,responsive' })
      expect(updated.labels).toBe('ui,css,responsive')
    })

    it('creates an issue with reporter and assignee both set', async () => {
      const issue = await Issue.create({
        title: 'Reported bug',
        status: 'Open',
        reporter: 'contact_mN7oP8qR',
        assignee: 'contact_sT9uV0wX',
      })
      expect(issue.reporter).toBe('contact_mN7oP8qR')
      expect(issue.assignee).toBe('contact_sT9uV0wX')
    })
  })

  // ===========================================================================
  // 6. Comment Operations
  // ===========================================================================
  describe('Comment operations', () => {
    it('creates a comment linked to an issue', async () => {
      const issue = await Issue.create({ title: 'Discuss approach', status: 'Open' })
      const comment = await Comment.create({
        body: 'I suggest we use a queue-based architecture.',
        issue: issue.$id,
        author: 'contact_yZ1aB2cD',
      })
      expect(comment.body).toBe('I suggest we use a queue-based architecture.')
      expect(comment.issue).toBe(issue.$id)
      expect(comment.author).toBe('contact_yZ1aB2cD')
    })

    it('creates multiple comments on the same issue', async () => {
      const issue = await Issue.create({ title: 'Architecture review', status: 'Open' })
      const c1 = await Comment.create({ body: 'First thought', issue: issue.$id })
      const c2 = await Comment.create({ body: 'Second thought', issue: issue.$id })
      const c3 = await Comment.create({ body: 'Third thought', issue: issue.$id })

      expect(c1.$id).not.toBe(c2.$id)
      expect(c2.$id).not.toBe(c3.$id)
      expect(c1.issue).toBe(issue.$id)
      expect(c2.issue).toBe(issue.$id)
      expect(c3.issue).toBe(issue.$id)
    })

    it('updates a comment body', async () => {
      const comment = await Comment.create({ body: 'Draft comment' })
      const updated = await Comment.update(comment.$id, { body: 'Revised comment with more detail.' })
      expect(updated.body).toBe('Revised comment with more detail.')
      expect(updated.$version).toBe(2)
    })

    it('deletes a comment', async () => {
      const comment = await Comment.create({ body: 'Temporary note' })
      const deleted = await Comment.delete(comment.$id)
      expect(deleted).toBe(true)
      const gone = await Comment.get(comment.$id)
      expect(gone).toBeNull()
    })

    it('comment body with @mention-style text preserves content', async () => {
      const comment = await Comment.create({
        body: '@alice please review this before EOD. CC @bob',
        author: 'contact_eF3gH4iJ',
      })
      expect(comment.body).toContain('@alice')
      expect(comment.body).toContain('@bob')
    })
  })

  // ===========================================================================
  // 7. Milestone and DueDate Tracking
  // ===========================================================================
  describe('Milestone and due date tracking', () => {
    it('creates an issue with milestone', async () => {
      const issue = await Issue.create({ title: 'Sprint goal', milestone: 'v1.0', status: 'Open' })
      expect(issue.milestone).toBe('v1.0')
    })

    it('updates issue milestone', async () => {
      const issue = await Issue.create({ title: 'Deferred', milestone: 'v1.0', status: 'Open' })
      const updated = await Issue.update(issue.$id, { milestone: 'v2.0' })
      expect(updated.milestone).toBe('v2.0')
    })

    it('filters issues by milestone', async () => {
      await Issue.create({ title: 'M1 task A', milestone: 'v1.0', status: 'Open' })
      await Issue.create({ title: 'M1 task B', milestone: 'v1.0', status: 'Open' })
      await Issue.create({ title: 'M2 task C', milestone: 'v2.0', status: 'Open' })

      const m1Issues = await Issue.find({ milestone: 'v1.0' })
      expect(m1Issues.length).toBe(2)
      for (const issue of m1Issues) {
        expect(issue.milestone).toBe('v1.0')
      }
    })

    it('creates an issue with a dueDate', async () => {
      const issue = await Issue.create({ title: 'Due soon', dueDate: '2025-03-15', status: 'Open' })
      expect(issue.dueDate).toBe('2025-03-15')
    })
  })

  // ===========================================================================
  // 8. Cross-entity References (Project-Issue-Comment graph)
  // ===========================================================================
  describe('Cross-entity references', () => {
    it('links multiple issues to the same project', async () => {
      const project = await Project.create({ name: 'Shared Project' })
      const issue1 = await Issue.create({ title: 'Issue 1', project: project.$id, status: 'Open' })
      const issue2 = await Issue.create({ title: 'Issue 2', project: project.$id, status: 'Open' })

      expect(issue1.project).toBe(project.$id)
      expect(issue2.project).toBe(project.$id)

      const projectIssues = await Issue.find({ project: project.$id })
      expect(projectIssues.length).toBe(2)
    })

    it('links comments to different issues in the same project', async () => {
      const project = await Project.create({ name: 'Multi-issue Project' })
      const issue1 = await Issue.create({ title: 'Issue A', project: project.$id, status: 'Open' })
      const issue2 = await Issue.create({ title: 'Issue B', project: project.$id, status: 'Open' })

      const c1 = await Comment.create({ body: 'On issue A', issue: issue1.$id })
      const c2 = await Comment.create({ body: 'On issue B', issue: issue2.$id })

      expect(c1.issue).toBe(issue1.$id)
      expect(c2.issue).toBe(issue2.$id)
    })

    it('issues from different projects are independently retrievable', async () => {
      const projectA = await Project.create({ name: 'Project Alpha' })
      const projectB = await Project.create({ name: 'Project Beta' })

      await Issue.create({ title: 'Alpha task', project: projectA.$id, status: 'Open' })
      await Issue.create({ title: 'Beta task', project: projectB.$id, status: 'Open' })

      const alphaIssues = await Issue.find({ project: projectA.$id })
      const betaIssues = await Issue.find({ project: projectB.$id })

      expect(alphaIssues.length).toBe(1)
      expect(betaIssues.length).toBe(1)
      expect(alphaIssues[0].title).toBe('Alpha task')
      expect(betaIssues[0].title).toBe('Beta task')
    })
  })

  // ===========================================================================
  // 9. Verb Hook Registration (BEFORE and AFTER hooks)
  // ===========================================================================
  describe('Verb hooks on Project and Issue', () => {
    it('registers and fires a BEFORE hook on Issue.closing', async () => {
      const closingFn = vi.fn()
      const unsub = (Issue as any).closing(closingFn)

      const issue = await Issue.create({ title: 'Hook test', status: 'Open' })
      await (Issue as any).close(issue.$id)

      expect(closingFn).toHaveBeenCalledTimes(1)
      unsub()
    })

    it('registers and fires an AFTER hook on Issue.closed', async () => {
      const closedFn = vi.fn()
      const unsub = (Issue as any).closed(closedFn)

      const issue = await Issue.create({ title: 'After hook test', status: 'Open' })
      await (Issue as any).close(issue.$id)

      expect(closedFn).toHaveBeenCalledTimes(1)
      expect(closedFn.mock.calls[0][0].$type).toBe('Issue')
      unsub()
    })

    it('unsubscribing a hook prevents it from firing', async () => {
      const fn = vi.fn()
      const unsub = (Issue as any).closed(fn)
      unsub()

      const issue = await Issue.create({ title: 'Unsub test', status: 'Open' })
      await (Issue as any).close(issue.$id)

      expect(fn).not.toHaveBeenCalled()
    })

    it('registers a BEFORE hook on Project.archiving', async () => {
      const archivingFn = vi.fn()
      const unsub = (Project as any).archiving(archivingFn)

      const project = await Project.create({ name: 'Archive Hook', status: 'Active' })
      await (Project as any).archive(project.$id)

      expect(archivingFn).toHaveBeenCalledTimes(1)
      unsub()
    })

    it('registers an AFTER hook on Project.completed', async () => {
      const completedFn = vi.fn()
      const unsub = (Project as any).completed(completedFn)

      const project = await Project.create({ name: 'Complete Hook', status: 'Active' })
      await (Project as any).complete(project.$id)

      expect(completedFn).toHaveBeenCalledTimes(1)
      expect(completedFn.mock.calls[0][0].$type).toBe('Project')
      unsub()
    })
  })

  // ===========================================================================
  // 10. Meta-field Integrity
  // ===========================================================================
  describe('Meta-field integrity', () => {
    it('$id format matches type_sqid pattern for all three entities', async () => {
      const project = await Project.create({ name: 'ID Test' })
      const issue = await Issue.create({ title: 'ID Test' })
      const comment = await Comment.create({ body: 'ID Test' })

      expect(project.$id).toMatch(/^project_[a-zA-Z0-9]{8}$/)
      expect(issue.$id).toMatch(/^issue_[a-zA-Z0-9]{8}$/)
      expect(comment.$id).toMatch(/^comment_[a-zA-Z0-9]{8}$/)
    })

    it('$type is set correctly for each entity', async () => {
      const project = await Project.create({ name: 'Type Test' })
      const issue = await Issue.create({ title: 'Type Test' })
      const comment = await Comment.create({ body: 'Type Test' })

      expect(project.$type).toBe('Project')
      expect(issue.$type).toBe('Issue')
      expect(comment.$type).toBe('Comment')
    })

    it('$version increments correctly on successive updates', async () => {
      const issue = await Issue.create({ title: 'Version test', status: 'Open' })
      expect(issue.$version).toBe(1)

      const v2 = await Issue.update(issue.$id, { status: 'InProgress' })
      expect(v2.$version).toBe(2)

      const v3 = await Issue.update(issue.$id, { status: 'Review' })
      expect(v3.$version).toBe(3)

      const v4 = await Issue.update(issue.$id, { status: 'Done' })
      expect(v4.$version).toBe(4)
    })

    it('$context is a tenant URL string', async () => {
      const project = await Project.create({ name: 'Context test' })
      expect(typeof project.$context).toBe('string')
      expect(project.$context).toMatch(/^https:\/\/headless\.ly\/~/)
    })

    it('$createdAt and $updatedAt are ISO date strings', async () => {
      const issue = await Issue.create({ title: 'Timestamp test' })
      expect(issue.$createdAt).toBeDefined()
      expect(issue.$updatedAt).toBeDefined()
      // ISO 8601 format check
      expect(new Date(issue.$createdAt as string).toISOString()).toBe(issue.$createdAt)
      expect(new Date(issue.$updatedAt as string).toISOString()).toBe(issue.$updatedAt)
    })
  })

  // ===========================================================================
  // 11. Schema Naming Conventions
  // ===========================================================================
  describe('Schema naming conventions', () => {
    it('Project schema has correct singular/plural/slug', () => {
      const schema = Project.$schema
      expect(schema.name).toBe('Project')
      expect(schema.singular).toBe('project')
      expect(schema.plural).toBe('projects')
      expect(schema.slug).toBe('project')
    })

    it('Issue schema has correct singular/plural/slug', () => {
      const schema = Issue.$schema
      expect(schema.name).toBe('Issue')
      expect(schema.singular).toBe('issue')
      expect(schema.plural).toBe('issues')
      expect(schema.slug).toBe('issue')
    })

    it('Comment schema has correct singular/plural/slug', () => {
      const schema = Comment.$schema
      expect(schema.name).toBe('Comment')
      expect(schema.singular).toBe('comment')
      expect(schema.plural).toBe('comments')
      expect(schema.slug).toBe('comment')
    })
  })

  // ===========================================================================
  // 12. Edge Cases
  // ===========================================================================
  describe('Edge cases', () => {
    it('get returns null for a nonexistent project ID', async () => {
      const result = await Project.get('project_zZzZzZzZ')
      expect(result).toBeNull()
    })

    it('get returns null for a nonexistent issue ID', async () => {
      const result = await Issue.get('issue_nOnExIsT')
      expect(result).toBeNull()
    })

    it('delete returns false for a nonexistent ID', async () => {
      const result = await Project.delete('project_nOpE1234')
      expect(result).toBe(false)
    })

    it('find returns empty array when no entities match', async () => {
      const results = await Issue.find({ status: 'InProgress' })
      expect(results).toEqual([])
    })

    it('creates a project with empty description', async () => {
      const project = await Project.create({ name: 'No Desc', description: '' })
      expect(project.description).toBe('')
    })

    it('creates an issue with very long title', async () => {
      const longTitle = 'A'.repeat(1000)
      const issue = await Issue.create({ title: longTitle })
      expect(issue.title).toBe(longTitle)
      expect(issue.title.length).toBe(1000)
    })

    it('each created entity gets a unique $id', async () => {
      const ids = new Set<string>()
      for (let i = 0; i < 20; i++) {
        const issue = await Issue.create({ title: `Issue ${i}` })
        ids.add(issue.$id)
      }
      expect(ids.size).toBe(20)
    })
  })

  // ===========================================================================
  // 13. Combined Filters
  // ===========================================================================
  describe('Combined filters', () => {
    it('filters issues by both status and priority', async () => {
      await Issue.create({ title: 'A', status: 'Open', priority: 'High' })
      await Issue.create({ title: 'B', status: 'Open', priority: 'Low' })
      await Issue.create({ title: 'C', status: 'Closed', priority: 'High' })

      const openHigh = await Issue.find({ status: 'Open', priority: 'High' })
      expect(openHigh.length).toBe(1)
      expect(openHigh[0].title).toBe('A')
    })

    it('filters issues by status and type', async () => {
      await Issue.create({ title: 'Open Bug', status: 'Open', type: 'Bug' })
      await Issue.create({ title: 'Open Feature', status: 'Open', type: 'Feature' })
      await Issue.create({ title: 'Closed Bug', status: 'Closed', type: 'Bug' })

      const openBugs = await Issue.find({ status: 'Open', type: 'Bug' })
      expect(openBugs.length).toBe(1)
      expect(openBugs[0].title).toBe('Open Bug')
    })

    it('filters issues by project and status', async () => {
      const projectA = await Project.create({ name: 'Proj A' })
      const projectB = await Project.create({ name: 'Proj B' })

      await Issue.create({ title: 'A Open', project: projectA.$id, status: 'Open' })
      await Issue.create({ title: 'A Closed', project: projectA.$id, status: 'Closed' })
      await Issue.create({ title: 'B Open', project: projectB.$id, status: 'Open' })

      const aOpen = await Issue.find({ project: projectA.$id, status: 'Open' })
      expect(aOpen.length).toBe(1)
      expect(aOpen[0].title).toBe('A Open')
    })
  })

  // ===========================================================================
  // 14. Project Organization Relationship
  // ===========================================================================
  describe('Project organization relationship', () => {
    it('Project schema has a forward relationship to Organization', () => {
      const schema = Project.$schema
      const orgRel = schema.relationships.get('organization')
      expect(orgRel).toBeDefined()
      expect(orgRel!.operator).toBe('->')
      expect(orgRel!.targetType).toBe('Organization')
    })

    it('creates a project with an organization reference', async () => {
      const project = await Project.create({
        name: 'Org Project',
        organization: 'organization_kL3mN4oP',
      })
      expect(project.organization).toBe('organization_kL3mN4oP')
    })
  })

  // ===========================================================================
  // 15. Project Visibility
  // ===========================================================================
  describe('Project visibility', () => {
    it('creates a Public project', async () => {
      const project = await Project.create({ name: 'Open Source', visibility: 'Public' })
      expect(project.visibility).toBe('Public')
    })

    it('creates a Private project', async () => {
      const project = await Project.create({ name: 'Internal Tool', visibility: 'Private' })
      expect(project.visibility).toBe('Private')
    })

    it('updates project visibility from Private to Public', async () => {
      const project = await Project.create({ name: 'Going Public', visibility: 'Private' })
      const updated = await Project.update(project.$id, { visibility: 'Public' })
      expect(updated.visibility).toBe('Public')
    })
  })

  // ===========================================================================
  // 16. Reopen Verb Behavior
  // ===========================================================================
  describe('Issue reopen verb', () => {
    it('reopen verb exists on Issue schema', () => {
      const schema = Issue.$schema
      const reopenVerb = schema.verbs.get('reopen')
      expect(reopenVerb).toBeDefined()
      expect(reopenVerb!.action).toBe('reopen')
      expect(reopenVerb!.activity).toBe('reopening')
      expect(reopenVerb!.event).toBe('reopened')
    })

    it('reopen on a closed issue bumps version', async () => {
      const issue = await Issue.create({ title: 'Reopen test', status: 'Open' })
      const closed = await (Issue as any).close(issue.$id)
      expect(closed.$version).toBe(2)

      const reopened = await (Issue as any).reopen(closed.$id)
      expect(reopened.$version).toBeGreaterThan(closed.$version)
    })

    it('registers and fires BEFORE hook on Issue.reopening', async () => {
      const reopeningFn = vi.fn()
      const unsub = (Issue as any).reopening(reopeningFn)

      const issue = await Issue.create({ title: 'Reopen hook', status: 'Open' })
      const closed = await (Issue as any).close(issue.$id)
      await (Issue as any).reopen(closed.$id)

      expect(reopeningFn).toHaveBeenCalledTimes(1)
      unsub()
    })

    it('registers and fires AFTER hook on Issue.reopened', async () => {
      const reopenedFn = vi.fn()
      const unsub = (Issue as any).reopened(reopenedFn)

      const issue = await Issue.create({ title: 'Reopened hook', status: 'Open' })
      const closed = await (Issue as any).close(issue.$id)
      await (Issue as any).reopen(closed.$id)

      expect(reopenedFn).toHaveBeenCalledTimes(1)
      unsub()
    })
  })

  // ===========================================================================
  // 17. Schema Raw Definition Access
  // ===========================================================================
  describe('Schema raw definition access', () => {
    it('Project.$schema.raw contains the original definition keys', () => {
      const raw = Project.$schema.raw
      expect(raw).toBeDefined()
      expect(raw.name).toBe('string!')
      expect(raw.slug).toBe('string##')
      expect(raw.status).toBe('Active | Archived | Completed')
      expect(raw.archive).toBe('Archived')
      expect(raw.complete).toBe('Completed')
    })

    it('Issue.$schema.raw contains the original definition keys', () => {
      const raw = Issue.$schema.raw
      expect(raw).toBeDefined()
      expect(raw.title).toBe('string!')
      expect(raw.status).toBe('Open | InProgress | Review | Done | Closed')
      expect(raw.priority).toBe('Low | Medium | High | Urgent')
      expect(raw.assign).toBe('Assigned')
      expect(raw.close).toBe('Closed')
      expect(raw.reopen).toBe('Reopened')
    })

    it('Comment.$schema.raw contains the original definition keys', () => {
      const raw = Comment.$schema.raw
      expect(raw).toBeDefined()
      expect(raw.body).toBe('string!')
      expect(raw.author).toBe('-> Contact')
      expect(raw.issue).toBe('-> Issue.comments')
    })
  })
})
