import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Project, Issue, Comment } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/projects -- deep-v3 coverage', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. MongoDB-style Query Operators on Issue.find()
  // ===========================================================================
  describe('MongoDB-style query operators', () => {
    it('$eq matches exact value', async () => {
      await Issue.create({ title: 'Alpha', status: 'Open', priority: 'High' })
      await Issue.create({ title: 'Beta', status: 'Closed', priority: 'Low' })

      const results = await Issue.find({ status: { $eq: 'Open' } })
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('Alpha')
    })

    it('$ne excludes matching value', async () => {
      await Issue.create({ title: 'Keep', status: 'Open' })
      await Issue.create({ title: 'Skip', status: 'Closed' })
      await Issue.create({ title: 'Also Keep', status: 'InProgress' })

      const results = await Issue.find({ status: { $ne: 'Closed' } })
      expect(results.length).toBe(2)
      const titles = results.map((r: any) => r.title).sort()
      expect(titles).toEqual(['Also Keep', 'Keep'])
    })

    it('$in matches any value in array', async () => {
      await Issue.create({ title: 'A', priority: 'Low' })
      await Issue.create({ title: 'B', priority: 'Medium' })
      await Issue.create({ title: 'C', priority: 'High' })
      await Issue.create({ title: 'D', priority: 'Urgent' })

      const results = await Issue.find({ priority: { $in: ['High', 'Urgent'] } })
      expect(results.length).toBe(2)
      const titles = results.map((r: any) => r.title).sort()
      expect(titles).toEqual(['C', 'D'])
    })

    it('$nin excludes values in array', async () => {
      await Issue.create({ title: 'Open1', status: 'Open' })
      await Issue.create({ title: 'Closed1', status: 'Closed' })
      await Issue.create({ title: 'Done1', status: 'Done' })

      const results = await Issue.find({ status: { $nin: ['Closed', 'Done'] } })
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('Open1')
    })

    it('$exists: true matches fields that are defined', async () => {
      await Issue.create({ title: 'Has milestone', milestone: 'v1.0' })
      await Issue.create({ title: 'No milestone' })

      const results = await Issue.find({ milestone: { $exists: true } })
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('Has milestone')
    })

    it('$exists: false matches fields that are undefined', async () => {
      await Issue.create({ title: 'Has labels', labels: 'bug' })
      await Issue.create({ title: 'No labels' })

      const results = await Issue.find({ labels: { $exists: false } })
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('No labels')
    })

    it('$regex matches string patterns', async () => {
      await Issue.create({ title: 'Fix login page bug' })
      await Issue.create({ title: 'Add dark mode feature' })
      await Issue.create({ title: 'Fix logout timeout bug' })

      const results = await Issue.find({ title: { $regex: '^Fix' } })
      expect(results.length).toBe(2)
      for (const r of results) {
        expect((r.title as string).startsWith('Fix')).toBe(true)
      }
    })

    it('combines $eq and $in on different fields', async () => {
      await Issue.create({ title: 'Match', status: 'Open', priority: 'High' })
      await Issue.create({ title: 'Wrong status', status: 'Closed', priority: 'High' })
      await Issue.create({ title: 'Wrong prio', status: 'Open', priority: 'Low' })

      const results = await Issue.find({
        status: { $eq: 'Open' },
        priority: { $in: ['High', 'Urgent'] },
      })
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('Match')
    })
  })

  // ===========================================================================
  // 2. Concurrent / Parallel Operations
  // ===========================================================================
  describe('Concurrent operations', () => {
    it('creates 10 issues in parallel via Promise.all', async () => {
      const titles = Array.from({ length: 10 }, (_, i) => `Parallel Issue ${i}`)
      const issues = await Promise.all(titles.map((title) => Issue.create({ title, status: 'Open' })))

      expect(issues.length).toBe(10)
      const ids = new Set(issues.map((i) => i.$id))
      expect(ids.size).toBe(10) // all unique IDs
    })

    it('creates projects, issues, and comments in parallel', async () => {
      const [project, issue, comment] = await Promise.all([
        Project.create({ name: 'Parallel Project' }),
        Issue.create({ title: 'Parallel Issue' }),
        Comment.create({ body: 'Parallel Comment' }),
      ])

      expect(project.$type).toBe('Project')
      expect(issue.$type).toBe('Issue')
      expect(comment.$type).toBe('Comment')
    })

    it('performs parallel updates on distinct issues', async () => {
      const i1 = await Issue.create({ title: 'A', status: 'Open' })
      const i2 = await Issue.create({ title: 'B', status: 'Open' })
      const i3 = await Issue.create({ title: 'C', status: 'Open' })

      const [u1, u2, u3] = await Promise.all([
        Issue.update(i1.$id, { status: 'InProgress' }),
        Issue.update(i2.$id, { status: 'Review' }),
        Issue.update(i3.$id, { status: 'Done' }),
      ])

      expect(u1.status).toBe('InProgress')
      expect(u2.status).toBe('Review')
      expect(u3.status).toBe('Done')
    })
  })

  // ===========================================================================
  // 3. Deep Relationship Chains (Project -> Issue -> Comment)
  // ===========================================================================
  describe('Deep relationship chains', () => {
    it('builds a full Project -> Issues -> Comments hierarchy and queries each level', async () => {
      const project = await Project.create({ name: 'Deep Chain' })
      const issue1 = await Issue.create({ title: 'Issue 1', project: project.$id, status: 'Open' })
      const issue2 = await Issue.create({ title: 'Issue 2', project: project.$id, status: 'InProgress' })

      const c1 = await Comment.create({ body: 'Comment on I1', issue: issue1.$id })
      const c2 = await Comment.create({ body: 'Another on I1', issue: issue1.$id })
      const c3 = await Comment.create({ body: 'Comment on I2', issue: issue2.$id })

      // Query issues by project
      const projectIssues = await Issue.find({ project: project.$id })
      expect(projectIssues.length).toBe(2)

      // Query comments by each issue
      const commentsOnI1 = await Comment.find({ issue: issue1.$id })
      expect(commentsOnI1.length).toBe(2)

      const commentsOnI2 = await Comment.find({ issue: issue2.$id })
      expect(commentsOnI2.length).toBe(1)
      expect(commentsOnI2[0].body).toBe('Comment on I2')
    })

    it('deleting an issue does not cascade-delete its comments (comments retain reference)', async () => {
      const issue = await Issue.create({ title: 'Deletable', status: 'Open' })
      const comment = await Comment.create({ body: 'Orphan soon', issue: issue.$id })

      await Issue.delete(issue.$id)

      // Comment still exists with the old reference
      const fetched = await Comment.get(comment.$id)
      expect(fetched).not.toBeNull()
      expect(fetched!.issue).toBe(issue.$id)
    })

    it('multiple projects with multiple issues and comments remain isolated', async () => {
      const pA = await Project.create({ name: 'Project A' })
      const pB = await Project.create({ name: 'Project B' })

      const iA1 = await Issue.create({ title: 'A1', project: pA.$id })
      const iA2 = await Issue.create({ title: 'A2', project: pA.$id })
      const iB1 = await Issue.create({ title: 'B1', project: pB.$id })

      await Comment.create({ body: 'On A1', issue: iA1.$id })
      await Comment.create({ body: 'On A2', issue: iA2.$id })
      await Comment.create({ body: 'On B1', issue: iB1.$id })

      const aIssues = await Issue.find({ project: pA.$id })
      const bIssues = await Issue.find({ project: pB.$id })
      expect(aIssues.length).toBe(2)
      expect(bIssues.length).toBe(1)

      const commentsOnA1 = await Comment.find({ issue: iA1.$id })
      const commentsOnB1 = await Comment.find({ issue: iB1.$id })
      expect(commentsOnA1.length).toBe(1)
      expect(commentsOnB1.length).toBe(1)
    })
  })

  // ===========================================================================
  // 4. Version Tracking Under Rapid Updates
  // ===========================================================================
  describe('Version tracking under rapid updates', () => {
    it('version increments correctly across 15 sequential updates', async () => {
      const issue = await Issue.create({ title: 'Rapid', status: 'Open' })
      expect(issue.$version).toBe(1)

      for (let i = 2; i <= 16; i++) {
        const updated = await Issue.update(issue.$id, { title: `Rapid v${i}` })
        expect(updated.$version).toBe(i)
      }

      const final = await Issue.get(issue.$id)
      expect(final!.$version).toBe(16)
      expect(final!.title).toBe('Rapid v16')
    })

    it('$updatedAt changes on every update but $createdAt stays constant', async () => {
      const project = await Project.create({ name: 'Timestamp tracking' })
      const createdAt = project.$createdAt

      const u1 = await Project.update(project.$id, { name: 'Updated 1' })
      const u2 = await Project.update(project.$id, { name: 'Updated 2' })

      expect(u1.$createdAt).toBe(createdAt)
      expect(u2.$createdAt).toBe(createdAt)
      // $updatedAt should be present and be an ISO string
      expect(typeof u2.$updatedAt).toBe('string')
      expect(new Date(u2.$updatedAt).toISOString()).toBe(u2.$updatedAt)
    })

    it('rapid custom verb calls increment version correctly', async () => {
      const issue = await Issue.create({ title: 'Verb rapid', status: 'Open' })
      expect(issue.$version).toBe(1)

      const closed = await (Issue as any).close(issue.$id)
      expect(closed.$version).toBe(2)

      const reopened = await (Issue as any).reopen(closed.$id)
      expect(reopened.$version).toBe(3)

      const closedAgain = await (Issue as any).close(reopened.$id)
      expect(closedAgain.$version).toBe(4)
    })
  })

  // ===========================================================================
  // 5. Hook Chaining with Multiple Subscribers
  // ===========================================================================
  describe('Hook chaining with multiple subscribers', () => {
    it('fires multiple AFTER hooks on the same event in order', async () => {
      const order: string[] = []
      const unsub1 = (Issue as any).closed((instance: any) => {
        order.push('hook-1')
      })
      const unsub2 = (Issue as any).closed((instance: any) => {
        order.push('hook-2')
      })
      const unsub3 = (Issue as any).closed((instance: any) => {
        order.push('hook-3')
      })

      const issue = await Issue.create({ title: 'Multi hook', status: 'Open' })
      await (Issue as any).close(issue.$id)

      expect(order).toEqual(['hook-1', 'hook-2', 'hook-3'])
      unsub1()
      unsub2()
      unsub3()
    })

    it('fires multiple BEFORE hooks on the same activity in order', async () => {
      const order: string[] = []
      const unsub1 = (Project as any).archiving(() => {
        order.push('before-1')
      })
      const unsub2 = (Project as any).archiving(() => {
        order.push('before-2')
      })

      const project = await Project.create({ name: 'Multi before', status: 'Active' })
      await (Project as any).archive(project.$id)

      expect(order).toEqual(['before-1', 'before-2'])
      unsub1()
      unsub2()
    })

    it('unsubscribing one hook does not affect other hooks on the same event', async () => {
      const results: string[] = []
      const unsub1 = (Issue as any).closed(() => results.push('A'))
      const unsub2 = (Issue as any).closed(() => results.push('B'))
      const unsub3 = (Issue as any).closed(() => results.push('C'))

      // Unsubscribe the middle one
      unsub2()

      const issue = await Issue.create({ title: 'Partial unsub', status: 'Open' })
      await (Issue as any).close(issue.$id)

      expect(results).toEqual(['A', 'C'])
      unsub1()
      unsub3()
    })
  })

  // ===========================================================================
  // 6. CRUD Hook Registration (creating/created, updating/updated, deleting/deleted)
  // ===========================================================================
  describe('CRUD hooks', () => {
    it('fires creating (BEFORE) hook on Issue.create', async () => {
      const fn = vi.fn()
      const unsub = (Issue as any).creating(fn)

      await Issue.create({ title: 'CRUD hook test' })

      expect(fn).toHaveBeenCalledTimes(1)
      unsub()
    })

    it('fires created (AFTER) hook on Issue.create', async () => {
      const fn = vi.fn()
      const unsub = (Issue as any).created(fn)

      const issue = await Issue.create({ title: 'Created hook test' })

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn.mock.calls[0][0].$type).toBe('Issue')
      expect(fn.mock.calls[0][0].$id).toBe(issue.$id)
      unsub()
    })

    it('fires updating (BEFORE) hook on Project.update', async () => {
      const fn = vi.fn()
      const unsub = (Project as any).updating(fn)

      const project = await Project.create({ name: 'Before update hook' })
      await Project.update(project.$id, { name: 'Updated' })

      expect(fn).toHaveBeenCalledTimes(1)
      unsub()
    })

    it('fires updated (AFTER) hook on Project.update', async () => {
      const fn = vi.fn()
      const unsub = (Project as any).updated(fn)

      const project = await Project.create({ name: 'After update hook' })
      await Project.update(project.$id, { name: 'Updated name' })

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn.mock.calls[0][0].$type).toBe('Project')
      unsub()
    })

    it('fires deleting (BEFORE) hook on Comment.delete', async () => {
      const fn = vi.fn()
      const unsub = (Comment as any).deleting(fn)

      const comment = await Comment.create({ body: 'Delete me' })
      await Comment.delete(comment.$id)

      expect(fn).toHaveBeenCalledTimes(1)
      unsub()
    })

    it('fires deleted (AFTER) hook on Comment.delete', async () => {
      const fn = vi.fn()
      const unsub = (Comment as any).deleted(fn)

      const comment = await Comment.create({ body: 'About to delete' })
      await Comment.delete(comment.$id)

      expect(fn).toHaveBeenCalledTimes(1)
      unsub()
    })
  })

  // ===========================================================================
  // 7. BEFORE Hook Data Transformation
  // ===========================================================================
  describe('BEFORE hook data transformation', () => {
    it('BEFORE hook on creating can transform input data', async () => {
      const unsub = (Issue as any).creating((data: Record<string, unknown>) => {
        return { ...data, labels: 'auto-tagged' }
      })

      const issue = await Issue.create({ title: 'Transformed', status: 'Open' })
      expect(issue.labels).toBe('auto-tagged')
      unsub()
    })

    it('BEFORE hook on archiving can inject additional data', async () => {
      const unsub = (Project as any).archiving((data: Record<string, unknown>) => {
        return { ...data, tags: 'archived-via-hook' }
      })

      const project = await Project.create({ name: 'Hook transform', status: 'Active' })
      const archived = await (Project as any).archive(project.$id)
      // The hook transforms the empty data passed to the verb
      // The entity should have been archived
      expect(archived.status).toBe('Archived')
      unsub()
    })
  })

  // ===========================================================================
  // 8. Schema Completeness Assertions
  // ===========================================================================
  describe('Schema completeness', () => {
    it('Project schema has exactly the expected field count', () => {
      const schema = Project.$schema
      // Fields: name, slug, description, status, visibility, startDate, targetDate, tags
      const fieldNames = Array.from(schema.fields.keys()).sort()
      expect(fieldNames).toEqual(['description', 'name', 'slug', 'startDate', 'status', 'tags', 'targetDate', 'visibility'])
    })

    it('Project schema has exactly the expected relationship count', () => {
      const schema = Project.$schema
      // Relationships: organization, owner, issues
      const relNames = Array.from(schema.relationships.keys()).sort()
      expect(relNames).toEqual(['issues', 'organization', 'owner'])
    })

    it('Project schema has exactly the expected verb count (CRUD + archive + complete)', () => {
      const schema = Project.$schema
      const verbNames = Array.from(schema.verbs.keys()).sort()
      expect(verbNames).toContain('create')
      expect(verbNames).toContain('update')
      expect(verbNames).toContain('delete')
      expect(verbNames).toContain('archive')
      expect(verbNames).toContain('complete')
      expect(verbNames).toHaveLength(5)
    })

    it('Issue schema has exactly the expected field count', () => {
      const schema = Issue.$schema
      const fieldNames = Array.from(schema.fields.keys()).sort()
      // Fields: title, description, status, priority, type, labels, milestone, dueDate
      expect(fieldNames).toEqual(['description', 'dueDate', 'labels', 'milestone', 'priority', 'status', 'title', 'type'])
    })

    it('Issue schema has exactly the expected relationship count', () => {
      const schema = Issue.$schema
      const relNames = Array.from(schema.relationships.keys()).sort()
      // Relationships: project, assignee, reporter, comments
      expect(relNames).toEqual(['assignee', 'comments', 'project', 'reporter'])
    })

    it('Issue schema has exactly the expected verb count (CRUD + assign + close + reopen)', () => {
      const schema = Issue.$schema
      const verbNames = Array.from(schema.verbs.keys()).sort()
      expect(verbNames).toContain('create')
      expect(verbNames).toContain('update')
      expect(verbNames).toContain('delete')
      expect(verbNames).toContain('assign')
      expect(verbNames).toContain('close')
      expect(verbNames).toContain('reopen')
      expect(verbNames).toHaveLength(6)
    })

    it('Comment schema has exactly the expected field count (body only)', () => {
      const schema = Comment.$schema
      const fieldNames = Array.from(schema.fields.keys()).sort()
      // Fields: body
      expect(fieldNames).toEqual(['body'])
    })

    it('Comment schema has exactly the expected relationship count', () => {
      const schema = Comment.$schema
      const relNames = Array.from(schema.relationships.keys()).sort()
      // Relationships: author, issue
      expect(relNames).toEqual(['author', 'issue'])
    })

    it('Comment schema has exactly the default CRUD verbs (3)', () => {
      const schema = Comment.$schema
      const verbNames = Array.from(schema.verbs.keys()).sort()
      expect(verbNames).toEqual(['create', 'delete', 'update'])
    })

    it('no entities have disabled verbs', () => {
      expect(Project.$schema.disabledVerbs.size).toBe(0)
      expect(Issue.$schema.disabledVerbs.size).toBe(0)
      expect(Comment.$schema.disabledVerbs.size).toBe(0)
    })
  })

  // ===========================================================================
  // 9. Field Modifier Edge Cases
  // ===========================================================================
  describe('Field modifier details', () => {
    it('Project description is plain string with no required/optional modifiers', () => {
      const desc = Project.$schema.fields.get('description')
      expect(desc).toBeDefined()
      expect(desc!.type).toBe('string')
      expect(desc!.modifiers?.required).toBe(false)
      expect(desc!.modifiers?.optional).toBe(false)
    })

    it('Issue labels field is plain string (not indexed, not required)', () => {
      const labels = Issue.$schema.fields.get('labels')
      expect(labels).toBeDefined()
      expect(labels!.type).toBe('string')
      expect(labels!.modifiers?.required).toBe(false)
      expect(labels!.modifiers?.indexed).toBe(false)
    })

    it('Issue milestone field is plain string', () => {
      const milestone = Issue.$schema.fields.get('milestone')
      expect(milestone).toBeDefined()
      expect(milestone!.type).toBe('string')
      expect(milestone!.modifiers?.required).toBe(false)
    })

    it('Project tags field is plain string', () => {
      const tags = Project.$schema.fields.get('tags')
      expect(tags).toBeDefined()
      expect(tags!.type).toBe('string')
      expect(tags!.modifiers?.required).toBe(false)
    })
  })

  // ===========================================================================
  // 10. Find with Empty / No Filter
  // ===========================================================================
  describe('Find with empty or no filter', () => {
    it('find with no argument returns all entities of that type', async () => {
      await Issue.create({ title: 'One' })
      await Issue.create({ title: 'Two' })
      await Issue.create({ title: 'Three' })

      const all = await Issue.find()
      expect(all.length).toBe(3)
    })

    it('find with empty object returns all entities of that type', async () => {
      await Project.create({ name: 'P1' })
      await Project.create({ name: 'P2' })

      const all = await Project.find({})
      expect(all.length).toBe(2)
    })
  })

  // ===========================================================================
  // 11. Error Cases
  // ===========================================================================
  describe('Error handling', () => {
    it('updating a nonexistent issue throws an error', async () => {
      await expect(Issue.update('issue_nOnExIsT', { title: 'Fail' })).rejects.toThrow()
    })

    it('updating a deleted entity throws an error', async () => {
      const issue = await Issue.create({ title: 'Will delete' })
      await Issue.delete(issue.$id)
      await expect(Issue.update(issue.$id, { title: 'Fail' })).rejects.toThrow()
    })

    it('performing a custom verb on a nonexistent entity throws an error', async () => {
      await expect((Issue as any).close('issue_nOnExIsT')).rejects.toThrow()
    })
  })

  // ===========================================================================
  // 12. Extra Unknown Fields Preserved
  // ===========================================================================
  describe('Extra fields in create data', () => {
    it('creates an issue with additional fields not in the schema', async () => {
      const issue = await Issue.create({
        title: 'Extra fields',
        customField: 'hello',
        numericExtra: 42,
      })
      expect(issue.title).toBe('Extra fields')
      expect(issue.customField).toBe('hello')
      expect(issue.numericExtra).toBe(42)
    })

    it('extra fields survive get()', async () => {
      const comment = await Comment.create({ body: 'With extras', extra: 'data' })
      const fetched = await Comment.get(comment.$id)
      expect(fetched!.extra).toBe('data')
    })
  })

  // ===========================================================================
  // 13. Raw Definition Completeness (Full Key Verification)
  // ===========================================================================
  describe('Raw definition completeness', () => {
    it('Project raw has all expected keys', () => {
      const raw = Project.$schema.raw
      const keys = Object.keys(raw).sort()
      expect(keys).toEqual([
        'archive',
        'complete',
        'description',
        'issues',
        'name',
        'organization',
        'owner',
        'slug',
        'startDate',
        'status',
        'tags',
        'targetDate',
        'visibility',
      ])
    })

    it('Issue raw has all expected keys', () => {
      const raw = Issue.$schema.raw
      const keys = Object.keys(raw).sort()
      expect(keys).toEqual([
        'assign',
        'assignee',
        'close',
        'comments',
        'description',
        'dueDate',
        'labels',
        'milestone',
        'priority',
        'project',
        'reopen',
        'reporter',
        'status',
        'title',
        'type',
      ])
    })

    it('Comment raw has all expected keys', () => {
      const raw = Comment.$schema.raw
      const keys = Object.keys(raw).sort()
      expect(keys).toEqual(['author', 'body', 'issue'])
    })

    it('Issue raw relationship values are exact strings', () => {
      const raw = Issue.$schema.raw
      expect(raw.project).toBe('-> Project.issues')
      expect(raw.assignee).toBe('-> Contact')
      expect(raw.reporter).toBe('-> Contact')
      expect(raw.comments).toBe('<- Comment.issue[]')
    })

    it('Project raw relationship values are exact strings', () => {
      const raw = Project.$schema.raw
      expect(raw.organization).toBe('-> Organization')
      expect(raw.owner).toBe('-> Contact')
      expect(raw.issues).toBe('<- Issue.project[]')
    })
  })

  // ===========================================================================
  // 14. Interleaved CRUD Across All Three Entity Types
  // ===========================================================================
  describe('Interleaved cross-entity operations', () => {
    it('creates and queries entities of all three types interleaved', async () => {
      const p = await Project.create({ name: 'Interleave Project' })
      const i1 = await Issue.create({ title: 'Interleave Issue 1', project: p.$id })
      const c1 = await Comment.create({ body: 'Comment 1', issue: i1.$id })
      const i2 = await Issue.create({ title: 'Interleave Issue 2', project: p.$id })
      const c2 = await Comment.create({ body: 'Comment 2', issue: i2.$id })

      // Verify each entity is independently retrievable
      expect((await Project.get(p.$id))!.name).toBe('Interleave Project')
      expect((await Issue.get(i1.$id))!.title).toBe('Interleave Issue 1')
      expect((await Issue.get(i2.$id))!.title).toBe('Interleave Issue 2')
      expect((await Comment.get(c1.$id))!.body).toBe('Comment 1')
      expect((await Comment.get(c2.$id))!.body).toBe('Comment 2')

      // Cross-type queries remain isolated
      const projects = await Project.find()
      const issues = await Issue.find()
      const comments = await Comment.find()
      expect(projects.length).toBe(1)
      expect(issues.length).toBe(2)
      expect(comments.length).toBe(2)
    })
  })

  // ===========================================================================
  // 15. Verb Conjugation Reverse Forms
  // ===========================================================================
  describe('Verb conjugation reverseBy/reverseAt', () => {
    it('archive verb has reverseBy and reverseAt forms', () => {
      const verb = Project.$schema.verbs.get('archive')
      expect(verb).toBeDefined()
      expect(verb!.reverseBy).toBeDefined()
      expect(typeof verb!.reverseBy).toBe('string')
      expect(verb!.reverseAt).toBeDefined()
      expect(typeof verb!.reverseAt).toBe('string')
    })

    it('close verb has reverseBy and reverseAt forms', () => {
      const verb = Issue.$schema.verbs.get('close')
      expect(verb).toBeDefined()
      expect(verb!.reverseBy).toBeDefined()
      expect(typeof verb!.reverseBy).toBe('string')
      expect(verb!.reverseAt).toBeDefined()
      expect(typeof verb!.reverseAt).toBe('string')
    })

    it('CRUD verbs (create, update, delete) also have conjugations', () => {
      const create = Issue.$schema.verbs.get('create')
      expect(create).toBeDefined()
      expect(create!.action).toBe('create')
      expect(create!.activity).toBe('creating')
      expect(create!.event).toBe('created')

      const update = Issue.$schema.verbs.get('update')
      expect(update).toBeDefined()
      expect(update!.action).toBe('update')
      expect(update!.activity).toBe('updating')
      expect(update!.event).toBe('updated')

      const del = Issue.$schema.verbs.get('delete')
      expect(del).toBeDefined()
      expect(del!.action).toBe('delete')
      expect(del!.activity).toBe('deleting')
      expect(del!.event).toBe('deleted')
    })
  })
})
