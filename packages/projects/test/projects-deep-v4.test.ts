import { describe, it, expect, vi } from 'vitest'
import { Project, Issue, Comment } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/projects -- deep-v4 coverage', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Per-field schema detail: Project fields
  // ===========================================================================
  describe('Project field-level schema details', () => {
    it('name field: kind=field, type=string, required=true, indexed=false, unique=false, array=false', () => {
      const f = Project.$schema.fields.get('name')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(true)
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
      expect(f.modifiers!.array).toBe(false)
      expect(f.modifiers!.optional).toBe(false)
    })

    it('slug field: kind=field, type=string, unique=true, indexed=true, required=false', () => {
      const f = Project.$schema.fields.get('slug')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.unique).toBe(true)
      expect(f.modifiers!.indexed).toBe(true)
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.optional).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })

    it('description field: kind=field, type=string, no modifiers set', () => {
      const f = Project.$schema.fields.get('description')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.optional).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
    })

    it('startDate field: kind=field, type=date', () => {
      const f = Project.$schema.fields.get('startDate')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('date')
      expect(f.modifiers!.required).toBe(false)
    })

    it('targetDate field: kind=field, type=date', () => {
      const f = Project.$schema.fields.get('targetDate')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('date')
      expect(f.modifiers!.required).toBe(false)
    })

    it('tags field: kind=field, type=string, all modifiers false', () => {
      const f = Project.$schema.fields.get('tags')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(false)
      expect(f.modifiers!.optional).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })

    it('status field: kind=enum with exactly 3 values in correct order', () => {
      const f = Project.$schema.fields.get('status')!
      expect(f.kind).toBe('enum')
      expect(f.enumValues).toEqual(['Active', 'Archived', 'Completed'])
    })

    it('visibility field: kind=enum with exactly 2 values in correct order', () => {
      const f = Project.$schema.fields.get('visibility')!
      expect(f.kind).toBe('enum')
      expect(f.enumValues).toEqual(['Public', 'Private'])
    })
  })

  // ===========================================================================
  // 2. Per-field schema detail: Issue fields
  // ===========================================================================
  describe('Issue field-level schema details', () => {
    it('title field: kind=field, type=string, required=true', () => {
      const f = Issue.$schema.fields.get('title')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(true)
      expect(f.modifiers!.optional).toBe(false)
    })

    it('description field: kind=field, type=string, not required', () => {
      const f = Issue.$schema.fields.get('description')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(false)
    })

    it('status field: kind=enum with 5 values in correct order', () => {
      const f = Issue.$schema.fields.get('status')!
      expect(f.kind).toBe('enum')
      expect(f.enumValues).toEqual(['Open', 'InProgress', 'Review', 'Done', 'Closed'])
    })

    it('priority field: kind=enum with 4 values in correct order', () => {
      const f = Issue.$schema.fields.get('priority')!
      expect(f.kind).toBe('enum')
      expect(f.enumValues).toEqual(['Low', 'Medium', 'High', 'Urgent'])
    })

    it('type field: kind=enum with 4 values in correct order', () => {
      const f = Issue.$schema.fields.get('type')!
      expect(f.kind).toBe('enum')
      expect(f.enumValues).toEqual(['Bug', 'Feature', 'Task', 'Epic'])
    })

    it('labels field: kind=field, type=string, no special modifiers', () => {
      const f = Issue.$schema.fields.get('labels')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.unique).toBe(false)
    })

    it('milestone field: kind=field, type=string', () => {
      const f = Issue.$schema.fields.get('milestone')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
    })

    it('dueDate field: kind=field, type=date', () => {
      const f = Issue.$schema.fields.get('dueDate')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('date')
    })
  })

  // ===========================================================================
  // 3. Per-field schema detail: Comment fields
  // ===========================================================================
  describe('Comment field-level schema details', () => {
    it('body field: kind=field, type=string, required=true, all other modifiers false', () => {
      const f = Comment.$schema.fields.get('body')!
      expect(f.kind).toBe('field')
      expect(f.type).toBe('string')
      expect(f.modifiers!.required).toBe(true)
      expect(f.modifiers!.optional).toBe(false)
      expect(f.modifiers!.indexed).toBe(false)
      expect(f.modifiers!.unique).toBe(false)
      expect(f.modifiers!.array).toBe(false)
    })
  })

  // ===========================================================================
  // 4. Relationship schema: isArray and backref for all forward relationships
  // ===========================================================================
  describe('Relationship isArray and backref details', () => {
    it('Project.organization: forward, no backref, not array', () => {
      const r = Project.$schema.relationships.get('organization')!
      expect(r.operator).toBe('->')
      expect(r.targetType).toBe('Organization')
      expect(r.backref).toBeUndefined()
      expect(r.isArray).toBe(false)
    })

    it('Project.owner: forward to Contact, no backref, not array', () => {
      const r = Project.$schema.relationships.get('owner')!
      expect(r.operator).toBe('->')
      expect(r.targetType).toBe('Contact')
      expect(r.backref).toBeUndefined()
      expect(r.isArray).toBe(false)
    })

    it('Project.issues: reverse from Issue, backref=project, isArray=true', () => {
      const r = Project.$schema.relationships.get('issues')!
      expect(r.operator).toBe('<-')
      expect(r.targetType).toBe('Issue')
      expect(r.backref).toBe('project')
      expect(r.isArray).toBe(true)
    })

    it('Issue.project: forward to Project, backref=issues, not array', () => {
      const r = Issue.$schema.relationships.get('project')!
      expect(r.operator).toBe('->')
      expect(r.targetType).toBe('Project')
      expect(r.backref).toBe('issues')
      expect(r.isArray).toBe(false)
    })

    it('Issue.assignee: forward to Contact, no backref, not array', () => {
      const r = Issue.$schema.relationships.get('assignee')!
      expect(r.operator).toBe('->')
      expect(r.targetType).toBe('Contact')
      expect(r.backref).toBeUndefined()
      expect(r.isArray).toBe(false)
    })

    it('Issue.reporter: forward to Contact, no backref, not array', () => {
      const r = Issue.$schema.relationships.get('reporter')!
      expect(r.operator).toBe('->')
      expect(r.targetType).toBe('Contact')
      expect(r.backref).toBeUndefined()
      expect(r.isArray).toBe(false)
    })

    it('Issue.comments: reverse from Comment, backref=issue, isArray=true', () => {
      const r = Issue.$schema.relationships.get('comments')!
      expect(r.operator).toBe('<-')
      expect(r.targetType).toBe('Comment')
      expect(r.backref).toBe('issue')
      expect(r.isArray).toBe(true)
    })

    it('Comment.author: forward to Contact, no backref, not array', () => {
      const r = Comment.$schema.relationships.get('author')!
      expect(r.operator).toBe('->')
      expect(r.targetType).toBe('Contact')
      expect(r.backref).toBeUndefined()
      expect(r.isArray).toBe(false)
    })

    it('Comment.issue: forward to Issue, backref=comments, not array', () => {
      const r = Comment.$schema.relationships.get('issue')!
      expect(r.operator).toBe('->')
      expect(r.targetType).toBe('Issue')
      expect(r.backref).toBe('comments')
      expect(r.isArray).toBe(false)
    })
  })

  // ===========================================================================
  // 5. Verb conjugation: act (3rd person) and reverseBy/reverseAt values
  // ===========================================================================
  describe('Verb conjugation: act, reverseBy, reverseAt values', () => {
    it('archive verb: action=archive, activity=archiving, event=archived, reverseBy=archivedBy, reverseAt=archivedAt', () => {
      const v = Project.$schema.verbs.get('archive')!
      expect(v.action).toBe('archive')
      expect(v.activity).toBe('archiving')
      expect(v.event).toBe('archived')
      expect(v.reverseBy).toMatch(/archivedBy/)
      expect(v.reverseAt).toMatch(/archivedAt/)
    })

    it('complete verb: action=complete, activity=completing, event=completed, reverseBy=completedBy, reverseAt=completedAt', () => {
      const v = Project.$schema.verbs.get('complete')!
      expect(v.action).toBe('complete')
      expect(v.activity).toBe('completing')
      expect(v.event).toBe('completed')
      expect(v.reverseBy).toMatch(/completedBy/)
      expect(v.reverseAt).toMatch(/completedAt/)
    })

    it('assign verb: reverseBy=assignedBy, reverseAt=assignedAt', () => {
      const v = Issue.$schema.verbs.get('assign')!
      expect(v.reverseBy).toMatch(/assignedBy/)
      expect(v.reverseAt).toMatch(/assignedAt/)
    })

    it('reopen verb: reverseBy=reopenedBy, reverseAt=reopenedAt', () => {
      const v = Issue.$schema.verbs.get('reopen')!
      expect(v.reverseBy).toMatch(/reopenedBy/)
      expect(v.reverseAt).toMatch(/reopenedAt/)
    })

    it('CRUD create verb: reverseBy=createdBy, reverseAt=createdAt', () => {
      const v = Comment.$schema.verbs.get('create')!
      expect(v.reverseBy).toMatch(/createdBy/)
      expect(v.reverseAt).toMatch(/createdAt/)
    })

    it('CRUD delete verb: reverseBy=deletedBy, reverseAt=deletedAt', () => {
      const v = Comment.$schema.verbs.get('delete')!
      expect(v.reverseBy).toMatch(/deletedBy/)
      expect(v.reverseAt).toMatch(/deletedAt/)
    })
  })

  // ===========================================================================
  // 6. Comment body edge cases: markdown, code blocks, unicode, multiline
  // ===========================================================================
  describe('Comment body content edge cases', () => {
    it('preserves markdown with headings and lists', async () => {
      const md = '# Title\n\n- item 1\n- item 2\n\n**bold** and *italic*'
      const comment = await Comment.create({ body: md })
      expect(comment.body).toBe(md)
    })

    it('preserves fenced code blocks with backticks', async () => {
      const code = '```typescript\nconst x = 42\nconsole.log(x)\n```'
      const comment = await Comment.create({ body: code })
      expect(comment.body).toBe(code)
    })

    it('preserves unicode and emoji content', async () => {
      const unicode = 'Bug in Japanese: \u30D0\u30B0 \u2014 priority: \u2605\u2605\u2605'
      const comment = await Comment.create({ body: unicode })
      expect(comment.body).toBe(unicode)
    })

    it('preserves multiline content with blank lines', async () => {
      const multiline = 'Line 1\n\nLine 3\n\n\nLine 6'
      const comment = await Comment.create({ body: multiline })
      expect(comment.body).toBe(multiline)
    })

    it('preserves content with inline code and special characters', async () => {
      const special = "Use `Contact.find({ stage: 'Lead' })` to query. See <https://docs.headless.ly>"
      const comment = await Comment.create({ body: special })
      expect(comment.body).toBe(special)
    })

    it('handles very long body content (10000 chars)', async () => {
      const longBody = 'x'.repeat(10000)
      const comment = await Comment.create({ body: longBody })
      expect(comment.body).toBe(longBody)
      expect((comment.body as string).length).toBe(10000)
    })
  })

  // ===========================================================================
  // 7. Issue assignment with label+milestone combinations
  // ===========================================================================
  describe('Issue assign verb with label and milestone combos', () => {
    it('assign verb sets assignee while preserving existing labels and milestone', async () => {
      const issue = await Issue.create({
        title: 'Combo test',
        status: 'Open',
        labels: 'bug,urgent',
        milestone: 'v1.0',
      })
      const assigned = await (Issue as any).assign(issue.$id, { assignee: 'contact_xY7zK9mR' })
      expect(assigned.assignee).toBe('contact_xY7zK9mR')
      expect(assigned.labels).toBe('bug,urgent')
      expect(assigned.milestone).toBe('v1.0')
    })

    it('assign verb with simultaneous label update', async () => {
      const issue = await Issue.create({ title: 'Assign+label', status: 'Open' })
      const assigned = await (Issue as any).assign(issue.$id, {
        assignee: 'contact_aB3cD4eF',
        labels: 'reviewed',
      })
      expect(assigned.assignee).toBe('contact_aB3cD4eF')
      expect(assigned.labels).toBe('reviewed')
    })

    it('assign verb with simultaneous milestone update', async () => {
      const issue = await Issue.create({ title: 'Assign+milestone', status: 'Open' })
      const assigned = await (Issue as any).assign(issue.$id, {
        assignee: 'contact_gH5iJ6kL',
        milestone: 'v2.0',
      })
      expect(assigned.assignee).toBe('contact_gH5iJ6kL')
      expect(assigned.milestone).toBe('v2.0')
    })
  })

  // ===========================================================================
  // 8. Project archived/completed state transitions with hook tracking
  // ===========================================================================
  describe('Project state transitions with hook tracking per step', () => {
    it('Active -> Completed -> Archived fires completing, completed, archiving, archived in order', async () => {
      const events: string[] = []
      const u1 = (Project as any).completing(() => events.push('completing'))
      const u2 = (Project as any).completed(() => events.push('completed'))
      const u3 = (Project as any).archiving(() => events.push('archiving'))
      const u4 = (Project as any).archived(() => events.push('archived'))

      const project = await Project.create({ name: 'Track hooks', status: 'Active' })
      await (Project as any).complete(project.$id)
      await (Project as any).archive(project.$id)

      expect(events).toEqual(['completing', 'completed', 'archiving', 'archived'])
      u1()
      u2()
      u3()
      u4()
    })

    it('archive fires ONLY archiving+archived, not completing/completed', async () => {
      const events: string[] = []
      const u1 = (Project as any).completing(() => events.push('completing'))
      const u2 = (Project as any).completed(() => events.push('completed'))
      const u3 = (Project as any).archiving(() => events.push('archiving'))
      const u4 = (Project as any).archived(() => events.push('archived'))

      const project = await Project.create({ name: 'Direct archive', status: 'Active' })
      await (Project as any).archive(project.$id)

      expect(events).toEqual(['archiving', 'archived'])
      expect(events).not.toContain('completing')
      u1()
      u2()
      u3()
      u4()
    })
  })

  // ===========================================================================
  // 9. CRUD hook data transformation chains (multiple BEFORE hooks chained)
  // ===========================================================================
  describe('BEFORE hook transformation chains', () => {
    it('two BEFORE hooks on creating chain transformations sequentially', async () => {
      const unsub1 = (Issue as any).creating((data: Record<string, unknown>) => {
        return { ...data, labels: (data.labels || '') + 'auto,' }
      })
      const unsub2 = (Issue as any).creating((data: Record<string, unknown>) => {
        return { ...data, labels: (data.labels || '') + 'processed' }
      })

      const issue = await Issue.create({ title: 'Chain test', status: 'Open' })
      expect(issue.labels).toBe('auto,processed')
      unsub1()
      unsub2()
    })

    it('BEFORE hook on updating transforms priority field', async () => {
      const unsub = (Issue as any).updating((data: Record<string, unknown>) => {
        if (data.priority === 'Low') {
          return { ...data, priority: 'Medium' }
        }
        return data
      })

      const issue = await Issue.create({ title: 'Priority guard', priority: 'High' })
      const updated = await Issue.update(issue.$id, { priority: 'Low' })
      expect(updated.priority).toBe('Medium')
      unsub()
    })

    it('three BEFORE hooks chain transforms on Issue create', async () => {
      const unsub1 = (Issue as any).creating((data: Record<string, unknown>) => {
        return { ...data, step1: true }
      })
      const unsub2 = (Issue as any).creating((data: Record<string, unknown>) => {
        return { ...data, step2: true }
      })
      const unsub3 = (Issue as any).creating((data: Record<string, unknown>) => {
        return { ...data, step3: true }
      })

      const issue = await Issue.create({ title: 'Triple chain' })
      expect(issue.step1).toBe(true)
      expect(issue.step2).toBe(true)
      expect(issue.step3).toBe(true)
      unsub1()
      unsub2()
      unsub3()
    })
  })

  // ===========================================================================
  // 10. Concurrent cross-entity operations (Issue+Comment in parallel)
  // ===========================================================================
  describe('Concurrent cross-entity operations', () => {
    it('creates Issue and Comment in parallel then links them via update', async () => {
      const [issue, comment] = await Promise.all([Issue.create({ title: 'Parallel link', status: 'Open' }), Comment.create({ body: 'Will link later' })])

      expect(issue.$type).toBe('Issue')
      expect(comment.$type).toBe('Comment')

      const linked = await Comment.update(comment.$id, { issue: issue.$id })
      expect(linked.issue).toBe(issue.$id)
    })

    it('creates 5 Issues and 5 Comments in parallel, all unique IDs', async () => {
      const ops = [
        ...Array.from({ length: 5 }, (_, i) => Issue.create({ title: `Issue ${i}` })),
        ...Array.from({ length: 5 }, (_, i) => Comment.create({ body: `Comment ${i}` })),
      ]
      const results = await Promise.all(ops)
      expect(results.length).toBe(10)
      const ids = new Set(results.map((r) => r.$id))
      expect(ids.size).toBe(10)
      // First 5 are Issues, last 5 are Comments
      for (let i = 0; i < 5; i++) {
        expect(results[i].$type).toBe('Issue')
      }
      for (let i = 5; i < 10; i++) {
        expect(results[i].$type).toBe('Comment')
      }
    })

    it('parallel verb execution and comment creation on same issue', async () => {
      const issue = await Issue.create({ title: 'Parallel verb', status: 'Open' })
      const [closed, comment] = await Promise.all([(Issue as any).close(issue.$id), Comment.create({ body: 'Racing comment', issue: issue.$id })])
      expect(closed.status).toBe('Closed')
      expect(comment.issue).toBe(issue.$id)
    })
  })

  // ===========================================================================
  // 11. Schema raw definition: verb values are PascalCase target states
  // ===========================================================================
  describe('Schema raw definition verb values', () => {
    it('Project raw archive value is "Archived"', () => {
      expect(Project.$schema.raw.archive).toBe('Archived')
    })

    it('Project raw complete value is "Completed"', () => {
      expect(Project.$schema.raw.complete).toBe('Completed')
    })

    it('Issue raw assign value is "Assigned"', () => {
      expect(Issue.$schema.raw.assign).toBe('Assigned')
    })

    it('Issue raw close value is "Closed"', () => {
      expect(Issue.$schema.raw.close).toBe('Closed')
    })

    it('Issue raw reopen value is "Reopened"', () => {
      expect(Issue.$schema.raw.reopen).toBe('Reopened')
    })

    it('Issue raw type value is the full pipe-separated enum string', () => {
      expect(Issue.$schema.raw.type).toBe('Bug | Feature | Task | Epic')
    })

    it('Project raw visibility value is the full pipe-separated enum string', () => {
      expect(Project.$schema.raw.visibility).toBe('Public | Private')
    })
  })

  // ===========================================================================
  // 12. Find after delete confirms entity absent from results
  // ===========================================================================
  describe('Find after delete confirms removal', () => {
    it('deleted issue does not appear in find results', async () => {
      const i1 = await Issue.create({ title: 'Keep', status: 'Open' })
      const i2 = await Issue.create({ title: 'Remove', status: 'Open' })
      await Issue.delete(i2.$id)

      const results = await Issue.find({ status: 'Open' })
      expect(results.length).toBe(1)
      expect(results[0].$id).toBe(i1.$id)
    })

    it('deleted project does not appear in find results', async () => {
      const p1 = await Project.create({ name: 'Survive' })
      const p2 = await Project.create({ name: 'Die' })
      await Project.delete(p2.$id)

      const results = await Project.find()
      expect(results.length).toBe(1)
      expect(results[0].$id).toBe(p1.$id)
    })

    it('deleted comment does not appear in find results by issue', async () => {
      const issue = await Issue.create({ title: 'Parent' })
      const c1 = await Comment.create({ body: 'Stay', issue: issue.$id })
      const c2 = await Comment.create({ body: 'Go', issue: issue.$id })
      await Comment.delete(c2.$id)

      const results = await Comment.find({ issue: issue.$id })
      expect(results.length).toBe(1)
      expect(results[0].$id).toBe(c1.$id)
    })
  })

  // ===========================================================================
  // 13. Issue enum field cycling: update to each valid enum value
  // ===========================================================================
  describe('Issue enum field cycling through all values', () => {
    it('status cycles through all 5 valid values via update', async () => {
      const issue = await Issue.create({ title: 'Status cycle', status: 'Open' })
      const statuses = ['InProgress', 'Review', 'Done', 'Closed', 'Open']
      for (const status of statuses) {
        const updated = await Issue.update(issue.$id, { status })
        expect(updated.status).toBe(status)
      }
    })

    it('priority cycles through all 4 valid values via update', async () => {
      const issue = await Issue.create({ title: 'Priority cycle', priority: 'Low' })
      const priorities = ['Medium', 'High', 'Urgent', 'Low']
      for (const priority of priorities) {
        const updated = await Issue.update(issue.$id, { priority })
        expect(updated.priority).toBe(priority)
      }
    })

    it('type cycles through all 4 valid values via update', async () => {
      const issue = await Issue.create({ title: 'Type cycle', type: 'Bug' })
      const types = ['Feature', 'Task', 'Epic', 'Bug']
      for (const t of types) {
        const updated = await Issue.update(issue.$id, { type: t })
        expect(updated.type).toBe(t)
      }
    })
  })

  // ===========================================================================
  // 14. Issue with all fields populated simultaneously
  // ===========================================================================
  describe('Issue with all fields populated at creation', () => {
    it('creates an issue with every single field set', async () => {
      const issue = await Issue.create({
        title: 'Full Issue',
        description: 'A comprehensive issue with all fields',
        status: 'InProgress',
        priority: 'High',
        type: 'Feature',
        project: 'project_xY7zK9mR',
        assignee: 'contact_aB3cD4eF',
        reporter: 'contact_gH5iJ6kL',
        labels: 'frontend,ux,priority',
        milestone: 'v3.0-beta',
        dueDate: '2026-06-15',
      })

      expect(issue.title).toBe('Full Issue')
      expect(issue.description).toBe('A comprehensive issue with all fields')
      expect(issue.status).toBe('InProgress')
      expect(issue.priority).toBe('High')
      expect(issue.type).toBe('Feature')
      expect(issue.project).toBe('project_xY7zK9mR')
      expect(issue.assignee).toBe('contact_aB3cD4eF')
      expect(issue.reporter).toBe('contact_gH5iJ6kL')
      expect(issue.labels).toBe('frontend,ux,priority')
      expect(issue.milestone).toBe('v3.0-beta')
      expect(issue.dueDate).toBe('2026-06-15')
      expect(issue.$type).toBe('Issue')
      expect(issue.$version).toBe(1)
    })
  })

  // ===========================================================================
  // 15. AFTER hook receives the entity instance with correct $type and fields
  // ===========================================================================
  describe('AFTER hook entity instance details', () => {
    it('Issue.closed hook receives instance with status=Closed and all meta-fields', async () => {
      let received: Record<string, unknown> | null = null
      const unsub = (Issue as any).closed((instance: any) => {
        received = instance
      })

      const issue = await Issue.create({ title: 'After details', status: 'Open', priority: 'High' })
      await (Issue as any).close(issue.$id)

      expect(received).not.toBeNull()
      expect(received!.$type).toBe('Issue')
      expect(received!.$id).toBe(issue.$id)
      expect(received!.status).toBe('Closed')
      expect(received!.priority).toBe('High')
      expect(received!.$version).toBe(2)
      expect(received!.$createdAt).toBeDefined()
      expect(received!.$updatedAt).toBeDefined()
      unsub()
    })

    it('Project.archived hook receives instance with status=Archived', async () => {
      let received: Record<string, unknown> | null = null
      const unsub = (Project as any).archived((instance: any) => {
        received = instance
      })

      const project = await Project.create({ name: 'Archive details', status: 'Active', visibility: 'Private' })
      await (Project as any).archive(project.$id)

      expect(received).not.toBeNull()
      expect(received!.$type).toBe('Project')
      expect(received!.status).toBe('Archived')
      expect(received!.visibility).toBe('Private')
      expect(received!.name).toBe('Archive details')
      unsub()
    })

    it('Comment.created hook receives instance with body and author', async () => {
      let received: Record<string, unknown> | null = null
      const unsub = (Comment as any).created((instance: any) => {
        received = instance
      })

      const comment = await Comment.create({ body: 'Hook body test', author: 'contact_xY7zK9mR' })

      expect(received).not.toBeNull()
      expect(received!.$type).toBe('Comment')
      expect(received!.body).toBe('Hook body test')
      expect(received!.author).toBe('contact_xY7zK9mR')
      expect(received!.$id).toBe(comment.$id)
      unsub()
    })
  })

  // ===========================================================================
  // 16. Hook interaction between CRUD and custom verbs
  // ===========================================================================
  describe('Hook interaction: CRUD hooks fire alongside custom verb hooks', () => {
    it('Issue.close fires closing+closed but NOT updating+updated', async () => {
      const events: string[] = []
      const u1 = (Issue as any).updating(() => events.push('updating'))
      const u2 = (Issue as any).updated(() => events.push('updated'))
      const u3 = (Issue as any).closing(() => events.push('closing'))
      const u4 = (Issue as any).closed(() => events.push('closed'))

      const issue = await Issue.create({ title: 'Hook isolation', status: 'Open' })
      await (Issue as any).close(issue.$id)

      expect(events).toContain('closing')
      expect(events).toContain('closed')
      expect(events).not.toContain('updating')
      expect(events).not.toContain('updated')
      u1()
      u2()
      u3()
      u4()
    })

    it('Issue.update fires updating+updated but NOT closing+closed', async () => {
      const events: string[] = []
      const u1 = (Issue as any).updating(() => events.push('updating'))
      const u2 = (Issue as any).updated(() => events.push('updated'))
      const u3 = (Issue as any).closing(() => events.push('closing'))
      const u4 = (Issue as any).closed(() => events.push('closed'))

      const issue = await Issue.create({ title: 'Update isolation', status: 'Open' })
      await Issue.update(issue.$id, { status: 'InProgress' })

      expect(events).toContain('updating')
      expect(events).toContain('updated')
      expect(events).not.toContain('closing')
      expect(events).not.toContain('closed')
      u1()
      u2()
      u3()
      u4()
    })
  })

  // ===========================================================================
  // 17. MongoDB-style numeric operators ($gt, $gte, $lt, $lte)
  // ===========================================================================
  describe('MongoDB-style numeric operators', () => {
    it('$gt filters issues with numeric field greater than threshold', async () => {
      await Issue.create({ title: 'Low val', customNum: 10 })
      await Issue.create({ title: 'Mid val', customNum: 50 })
      await Issue.create({ title: 'High val', customNum: 90 })

      const results = await Issue.find({ customNum: { $gt: 50 } })
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('High val')
    })

    it('$gte filters issues with numeric field >= threshold', async () => {
      await Issue.create({ title: 'Below', customNum: 49 })
      await Issue.create({ title: 'Equal', customNum: 50 })
      await Issue.create({ title: 'Above', customNum: 51 })

      const results = await Issue.find({ customNum: { $gte: 50 } })
      expect(results.length).toBe(2)
      const titles = results.map((r: any) => r.title).sort()
      expect(titles).toEqual(['Above', 'Equal'])
    })

    it('$lt filters issues with numeric field < threshold', async () => {
      await Issue.create({ title: 'Small', customNum: 5 })
      await Issue.create({ title: 'Big', customNum: 100 })

      const results = await Issue.find({ customNum: { $lt: 50 } })
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('Small')
    })

    it('$lte filters issues with numeric field <= threshold', async () => {
      await Issue.create({ title: 'Exact', customNum: 50 })
      await Issue.create({ title: 'Over', customNum: 51 })

      const results = await Issue.find({ customNum: { $lte: 50 } })
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('Exact')
    })

    it('combined $gte and $lte for range query', async () => {
      await Issue.create({ title: 'Below range', customNum: 5 })
      await Issue.create({ title: 'In range', customNum: 50 })
      await Issue.create({ title: 'Above range', customNum: 95 })

      const results = await Issue.find({ customNum: { $gte: 10, $lte: 80 } })
      expect(results.length).toBe(1)
      expect(results[0].title).toBe('In range')
    })
  })

  // ===========================================================================
  // 18. Multiple sequential verb transitions with complete version tracking
  // ===========================================================================
  describe('Sequential verb transitions with version tracking', () => {
    it('Issue: create(v1) -> assign(v2) -> close(v3) -> reopen(v4) -> close(v5)', async () => {
      const issue = await Issue.create({ title: 'Full lifecycle', status: 'Open' })
      expect(issue.$version).toBe(1)

      const v2 = await (Issue as any).assign(issue.$id, { assignee: 'contact_aB3cD4eF' })
      expect(v2.$version).toBe(2)
      expect(v2.assignee).toBe('contact_aB3cD4eF')

      const v3 = await (Issue as any).close(v2.$id)
      expect(v3.$version).toBe(3)
      expect(v3.status).toBe('Closed')

      const v4 = await (Issue as any).reopen(v3.$id)
      expect(v4.$version).toBe(4)

      const v5 = await (Issue as any).close(v4.$id)
      expect(v5.$version).toBe(5)
      expect(v5.status).toBe('Closed')
    })
  })

  // ===========================================================================
  // 19. Schema relationship kind is 'relationship' for all relationships
  // ===========================================================================
  describe('Relationship kind is consistently "relationship"', () => {
    it('all Project relationships have kind=relationship', () => {
      for (const [, rel] of Project.$schema.relationships) {
        expect(rel.kind).toBe('relationship')
      }
    })

    it('all Issue relationships have kind=relationship', () => {
      for (const [, rel] of Issue.$schema.relationships) {
        expect(rel.kind).toBe('relationship')
      }
    })

    it('all Comment relationships have kind=relationship', () => {
      for (const [, rel] of Comment.$schema.relationships) {
        expect(rel.kind).toBe('relationship')
      }
    })
  })

  // ===========================================================================
  // 20. Verb declaration properties are NOT in fields or relationships
  // ===========================================================================
  describe('Verb declarations are not fields or relationships', () => {
    it('Project "archive" is not in fields map', () => {
      expect(Project.$schema.fields.has('archive')).toBe(false)
    })

    it('Project "complete" is not in fields map', () => {
      expect(Project.$schema.fields.has('complete')).toBe(false)
    })

    it('Issue "assign" is not in fields map', () => {
      expect(Issue.$schema.fields.has('assign')).toBe(false)
    })

    it('Issue "close" is not in fields map', () => {
      expect(Issue.$schema.fields.has('close')).toBe(false)
    })

    it('Issue "reopen" is not in fields map', () => {
      expect(Issue.$schema.fields.has('reopen')).toBe(false)
    })

    it('verb keys are not in relationships map', () => {
      expect(Project.$schema.relationships.has('archive')).toBe(false)
      expect(Project.$schema.relationships.has('complete')).toBe(false)
      expect(Issue.$schema.relationships.has('assign')).toBe(false)
      expect(Issue.$schema.relationships.has('close')).toBe(false)
      expect(Issue.$schema.relationships.has('reopen')).toBe(false)
    })
  })
})
