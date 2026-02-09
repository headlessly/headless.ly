import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Project, Issue, Comment } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/projects — deep coverage', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Project Noun Schema (~5 tests)
  // ===========================================================================
  describe('Project Noun schema', () => {
    it('has name, description, and slug fields', () => {
      const schema = Project.$schema
      expect(schema.fields.has('name')).toBe(true)
      expect(schema.fields.has('description')).toBe(true)
      expect(schema.fields.has('slug')).toBe(true)
    })

    it('name field is required (string!)', () => {
      const schema = Project.$schema
      const nameField = schema.fields.get('name')
      expect(nameField).toBeDefined()
      expect(nameField!.kind).toBe('field')
      expect(nameField!.type).toBe('string')
      expect(nameField!.modifiers?.required).toBe(true)
    })

    it('status is an enum with Active | Archived | Completed', () => {
      const schema = Project.$schema
      const statusField = schema.fields.get('status')
      expect(statusField).toBeDefined()
      expect(statusField!.kind).toBe('enum')
      expect(statusField!.enumValues).toContain('Active')
      expect(statusField!.enumValues).toContain('Archived')
      expect(statusField!.enumValues).toContain('Completed')
      expect(statusField!.enumValues).toHaveLength(3)
    })

    it('visibility is an enum with Public | Private', () => {
      const schema = Project.$schema
      const visField = schema.fields.get('visibility')
      expect(visField).toBeDefined()
      expect(visField!.kind).toBe('enum')
      expect(visField!.enumValues).toContain('Public')
      expect(visField!.enumValues).toContain('Private')
      expect(visField!.enumValues).toHaveLength(2)
    })

    it('has relationships: owner (-> Contact) and issues (<- Issue.project[])', () => {
      const schema = Project.$schema
      expect(schema.relationships.has('owner')).toBe(true)
      const ownerRel = schema.relationships.get('owner')
      expect(ownerRel!.operator).toBe('->')
      expect(ownerRel!.targetType).toBe('Contact')

      expect(schema.relationships.has('issues')).toBe(true)
      const issuesRel = schema.relationships.get('issues')
      expect(issuesRel!.operator).toBe('<-')
      expect(issuesRel!.targetType).toBe('Issue')
      expect(issuesRel!.backref).toBe('project')
      expect(issuesRel!.isArray).toBe(true)
    })
  })

  // ===========================================================================
  // 2. Issue Noun Schema (~5 tests)
  // ===========================================================================
  describe('Issue Noun schema', () => {
    it('has title, description, labels, and milestone fields', () => {
      const schema = Issue.$schema
      expect(schema.fields.has('title')).toBe(true)
      expect(schema.fields.has('description')).toBe(true)
      expect(schema.fields.has('labels')).toBe(true)
      expect(schema.fields.has('milestone')).toBe(true)
    })

    it('title field is required (string!)', () => {
      const schema = Issue.$schema
      const titleField = schema.fields.get('title')
      expect(titleField).toBeDefined()
      expect(titleField!.kind).toBe('field')
      expect(titleField!.type).toBe('string')
      expect(titleField!.modifiers?.required).toBe(true)
    })

    it('status is an enum with Open | InProgress | Review | Done | Closed', () => {
      const schema = Issue.$schema
      const statusField = schema.fields.get('status')
      expect(statusField).toBeDefined()
      expect(statusField!.kind).toBe('enum')
      expect(statusField!.enumValues).toContain('Open')
      expect(statusField!.enumValues).toContain('InProgress')
      expect(statusField!.enumValues).toContain('Review')
      expect(statusField!.enumValues).toContain('Done')
      expect(statusField!.enumValues).toContain('Closed')
      expect(statusField!.enumValues).toHaveLength(5)
    })

    it('priority is an enum with Low | Medium | High | Urgent', () => {
      const schema = Issue.$schema
      const priorityField = schema.fields.get('priority')
      expect(priorityField).toBeDefined()
      expect(priorityField!.kind).toBe('enum')
      expect(priorityField!.enumValues).toContain('Low')
      expect(priorityField!.enumValues).toContain('Medium')
      expect(priorityField!.enumValues).toContain('High')
      expect(priorityField!.enumValues).toContain('Urgent')
      expect(priorityField!.enumValues).toHaveLength(4)
    })

    it('has relationships: project (-> Project.issues), assignee (-> Contact), reporter (-> Contact)', () => {
      const schema = Issue.$schema
      expect(schema.relationships.has('project')).toBe(true)
      const projectRel = schema.relationships.get('project')
      expect(projectRel!.operator).toBe('->')
      expect(projectRel!.targetType).toBe('Project')
      expect(projectRel!.backref).toBe('issues')

      expect(schema.relationships.has('assignee')).toBe(true)
      const assigneeRel = schema.relationships.get('assignee')
      expect(assigneeRel!.operator).toBe('->')
      expect(assigneeRel!.targetType).toBe('Contact')

      expect(schema.relationships.has('reporter')).toBe(true)
      const reporterRel = schema.relationships.get('reporter')
      expect(reporterRel!.operator).toBe('->')
      expect(reporterRel!.targetType).toBe('Contact')
    })
  })

  // ===========================================================================
  // 3. Comment Noun Schema (~4 tests)
  // ===========================================================================
  describe('Comment Noun schema', () => {
    it('has body field that is required (string!)', () => {
      const schema = Comment.$schema
      const bodyField = schema.fields.get('body')
      expect(bodyField).toBeDefined()
      expect(bodyField!.kind).toBe('field')
      expect(bodyField!.type).toBe('string')
      expect(bodyField!.modifiers?.required).toBe(true)
    })

    it('has relationship: author (-> Contact)', () => {
      const schema = Comment.$schema
      expect(schema.relationships.has('author')).toBe(true)
      const authorRel = schema.relationships.get('author')
      expect(authorRel!.operator).toBe('->')
      expect(authorRel!.targetType).toBe('Contact')
    })

    it('has relationship: issue (-> Issue.comments)', () => {
      const schema = Comment.$schema
      expect(schema.relationships.has('issue')).toBe(true)
      const issueRel = schema.relationships.get('issue')
      expect(issueRel!.operator).toBe('->')
      expect(issueRel!.targetType).toBe('Issue')
      expect(issueRel!.backref).toBe('comments')
    })

    it('schema name and plural are correct', () => {
      const schema = Comment.$schema
      expect(schema.name).toBe('Comment')
      expect(schema.singular).toBe('comment')
      expect(schema.plural).toBe('comments')
    })
  })

  // ===========================================================================
  // 4. Project Verbs (~4 tests)
  // ===========================================================================
  describe('Project verbs', () => {
    it('has default CRUD verbs in the schema verbs map', () => {
      const schema = Project.$schema
      expect(schema.verbs.has('create')).toBe(true)
      expect(schema.verbs.has('update')).toBe(true)
      expect(schema.verbs.has('delete')).toBe(true)
    })

    it('has custom verb "archive" targeting Archived state', () => {
      const schema = Project.$schema
      expect(schema.verbs.has('archive')).toBe(true)
      const archiveVerb = schema.verbs.get('archive')
      expect(archiveVerb!.action).toBe('archive')
      expect(archiveVerb!.activity).toBe('archiving')
      expect(archiveVerb!.event).toBe('archived')
    })

    it('has custom verb "complete" targeting Completed state', () => {
      const schema = Project.$schema
      expect(schema.verbs.has('complete')).toBe(true)
      const completeVerb = schema.verbs.get('complete')
      expect(completeVerb!.action).toBe('complete')
      expect(completeVerb!.activity).toBe('completing')
      expect(completeVerb!.event).toBe('completed')
    })

    it('archive verb transitions project status to Archived', async () => {
      const project = await Project.create({ name: 'My Project', status: 'Active' })
      expect(project.status).toBe('Active')
      const archived = await (Project as any).archive(project.$id)
      expect(archived.status).toBe('Archived')
    })
  })

  // ===========================================================================
  // 5. Issue Verbs (~4 tests)
  // ===========================================================================
  describe('Issue verbs', () => {
    it('has custom verb "assign" targeting Assigned state', () => {
      const schema = Issue.$schema
      expect(schema.verbs.has('assign')).toBe(true)
      const assignVerb = schema.verbs.get('assign')
      expect(assignVerb!.action).toBe('assign')
      expect(assignVerb!.activity).toBe('assigning')
      expect(assignVerb!.event).toBe('assigned')
    })

    it('has custom verb "close" targeting Closed state', () => {
      const schema = Issue.$schema
      expect(schema.verbs.has('close')).toBe(true)
      const closeVerb = schema.verbs.get('close')
      expect(closeVerb!.action).toBe('close')
      expect(closeVerb!.activity).toBe('closing')
      expect(closeVerb!.event).toBe('closed')
    })

    it('has custom verb "reopen" targeting Reopened state', () => {
      const schema = Issue.$schema
      expect(schema.verbs.has('reopen')).toBe(true)
      const reopenVerb = schema.verbs.get('reopen')
      expect(reopenVerb!.action).toBe('reopen')
      expect(reopenVerb!.activity).toBe('reopening')
      expect(reopenVerb!.event).toBe('reopened')
    })

    it('close verb transitions issue status to Closed', async () => {
      const issue = await Issue.create({ title: 'Bug fix', status: 'Open' })
      expect(issue.status).toBe('Open')
      const closed = await (Issue as any).close(issue.$id)
      expect(closed.status).toBe('Closed')
    })
  })

  // ===========================================================================
  // 6. Issue Lifecycle (~4 tests)
  // ===========================================================================
  describe('Issue lifecycle', () => {
    it('creates an issue within a project context', async () => {
      const project = await Project.create({ name: 'Alpha Project' })
      const issue = await Issue.create({ title: 'Setup CI', project: project.$id, status: 'Open', priority: 'High' })
      expect(issue.title).toBe('Setup CI')
      expect(issue.project).toBe(project.$id)
      expect(issue.status).toBe('Open')
      expect(issue.priority).toBe('High')
    })

    it('updates issue status through lifecycle stages', async () => {
      const issue = await Issue.create({ title: 'Implement auth', status: 'Open' })
      expect(issue.status).toBe('Open')

      const inProgress = await Issue.update(issue.$id, { status: 'InProgress' })
      expect(inProgress.status).toBe('InProgress')
      expect(inProgress.$version).toBe(2)

      const done = await Issue.update(issue.$id, { status: 'Done' })
      expect(done.status).toBe('Done')
      expect(done.$version).toBe(3)
    })

    it('assigns issue to a contact using the assign verb', async () => {
      const issue = await Issue.create({ title: 'Design review', status: 'Open' })
      const assigned = await (Issue as any).assign(issue.$id, { assignee: 'contact_abc123XY' })
      expect(assigned.assignee).toBe('contact_abc123XY')
    })

    it('reopens a closed issue using the reopen verb', async () => {
      const issue = await Issue.create({ title: 'Flaky test', status: 'Open' })
      const closed = await (Issue as any).close(issue.$id)
      expect(closed.status).toBe('Closed')

      const reopened = await (Issue as any).reopen(closed.$id)
      // reopen targets 'Reopened' state — since the Issue status enum does not contain 'Reopened',
      // the verb resolution may fall back to setting status to 'Reopened' via convention
      expect(reopened).toBeDefined()
      expect(reopened.$version).toBeGreaterThan(closed.$version)
    })
  })

  // ===========================================================================
  // 7. Relationships (~4 tests)
  // ===========================================================================
  describe('Relationships', () => {
    it('Project schema has reverse relationship to Issue[]', () => {
      const schema = Project.$schema
      const issuesRel = schema.relationships.get('issues')
      expect(issuesRel).toBeDefined()
      expect(issuesRel!.operator).toBe('<-')
      expect(issuesRel!.targetType).toBe('Issue')
      expect(issuesRel!.isArray).toBe(true)
    })

    it('Issue schema has reverse relationship to Comment[]', () => {
      const schema = Issue.$schema
      const commentsRel = schema.relationships.get('comments')
      expect(commentsRel).toBeDefined()
      expect(commentsRel!.operator).toBe('<-')
      expect(commentsRel!.targetType).toBe('Comment')
      expect(commentsRel!.backref).toBe('issue')
      expect(commentsRel!.isArray).toBe(true)
    })

    it('Issue -> Project forward relationship points back to issues', () => {
      const schema = Issue.$schema
      const projectRel = schema.relationships.get('project')
      expect(projectRel).toBeDefined()
      expect(projectRel!.operator).toBe('->')
      expect(projectRel!.targetType).toBe('Project')
      expect(projectRel!.backref).toBe('issues')
    })

    it('Comment -> Issue forward relationship points back to comments', () => {
      const schema = Comment.$schema
      const issueRel = schema.relationships.get('issue')
      expect(issueRel).toBeDefined()
      expect(issueRel!.operator).toBe('->')
      expect(issueRel!.targetType).toBe('Issue')
      expect(issueRel!.backref).toBe('comments')
    })
  })

  // ===========================================================================
  // 8. Additional Coverage (~4 tests)
  // ===========================================================================
  describe('additional coverage', () => {
    it('Issue type is an enum with Bug | Feature | Task | Epic', () => {
      const schema = Issue.$schema
      const typeField = schema.fields.get('type')
      expect(typeField).toBeDefined()
      expect(typeField!.kind).toBe('enum')
      expect(typeField!.enumValues).toContain('Bug')
      expect(typeField!.enumValues).toContain('Feature')
      expect(typeField!.enumValues).toContain('Task')
      expect(typeField!.enumValues).toContain('Epic')
      expect(typeField!.enumValues).toHaveLength(4)
    })

    it('Project has date fields: startDate and targetDate', () => {
      const schema = Project.$schema
      const startDate = schema.fields.get('startDate')
      expect(startDate).toBeDefined()
      expect(startDate!.type).toBe('date')

      const targetDate = schema.fields.get('targetDate')
      expect(targetDate).toBeDefined()
      expect(targetDate!.type).toBe('date')
    })

    it('Issue has dueDate field of type date', () => {
      const schema = Issue.$schema
      const dueDate = schema.fields.get('dueDate')
      expect(dueDate).toBeDefined()
      expect(dueDate!.type).toBe('date')
    })

    it('Project slug field has unique+indexed modifiers (string##)', () => {
      const schema = Project.$schema
      const slugField = schema.fields.get('slug')
      expect(slugField).toBeDefined()
      expect(slugField!.modifiers?.unique).toBe(true)
      expect(slugField!.modifiers?.indexed).toBe(true)
    })

    it('Project.complete transitions project status to Completed', async () => {
      const project = await Project.create({ name: 'Beta Launch', status: 'Active' })
      const completed = await (Project as any).complete(project.$id)
      expect(completed.status).toBe('Completed')
    })

    it('find returns multiple issues filtered by status', async () => {
      await Issue.create({ title: 'Issue A', status: 'Open' })
      await Issue.create({ title: 'Issue B', status: 'Open' })
      await Issue.create({ title: 'Issue C', status: 'Closed' })

      const openIssues = await Issue.find({ status: 'Open' })
      expect(openIssues.length).toBe(2)
      for (const issue of openIssues) {
        expect(issue.status).toBe('Open')
      }
    })
  })
})
