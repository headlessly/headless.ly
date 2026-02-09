import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Project, Issue, Comment } from '../src/index.ts'
import { setupTestProvider, expectMetaFields, expectCrudVerbs, expectVerbConjugation, testCrudLifecycle } from '../../test-utils'

describe('@headlessly/projects', () => {
  setupTestProvider()

  describe('exports', () => {
    it('exports Project', () => {
      expect(Project).toBeDefined()
      expect(Project.$name).toBe('Project')
    })

    it('exports Issue', () => {
      expect(Issue).toBeDefined()
      expect(Issue.$name).toBe('Issue')
    })

    it('exports Comment', () => {
      expect(Comment).toBeDefined()
      expect(Comment.$name).toBe('Comment')
    })
  })

  describe('CRUD verbs', () => {
    it('Project has CRUD verbs', () => {
      expectCrudVerbs(Project)
    })

    it('Issue has CRUD verbs', () => {
      expectCrudVerbs(Issue)
    })

    it('Comment has CRUD verbs', () => {
      expectCrudVerbs(Comment)
    })
  })

  describe('verb conjugation', () => {
    it('Project.archive conjugation', () => {
      expectVerbConjugation(Project, 'archive', 'archiving', 'archived')
    })

    it('Project.complete conjugation', () => {
      expectVerbConjugation(Project, 'complete', 'completing', 'completed')
    })

    it('Issue.assign conjugation', () => {
      expectVerbConjugation(Issue, 'assign', 'assigning', 'assigned')
    })

    it('Issue.close conjugation', () => {
      expectVerbConjugation(Issue, 'close', 'closing', 'closed')
    })

    it('Issue.reopen conjugation', () => {
      expectVerbConjugation(Issue, 'reopen', 'reopening', 'reopened')
    })
  })

  describe('create with meta-fields', () => {
    it('creates Project with meta-fields', async () => {
      const project = await Project.create({ name: 'Website Redesign' })
      expectMetaFields(project, 'Project')
      expect(project.name).toBe('Website Redesign')
    })

    it('creates Issue with meta-fields', async () => {
      const issue = await Issue.create({ title: 'Fix login bug' })
      expectMetaFields(issue, 'Issue')
      expect(issue.title).toBe('Fix login bug')
    })

    it('creates Comment with meta-fields', async () => {
      const comment = await Comment.create({ body: 'This looks good!' })
      expectMetaFields(comment, 'Comment')
      expect(comment.body).toBe('This looks good!')
    })
  })

  describe('full CRUD lifecycle', () => {
    it('Project CRUD lifecycle', async () => {
      await testCrudLifecycle(Project, 'Project', { name: 'Website Redesign' }, { name: 'Website Redesign v2' })
    })

    it('Issue CRUD lifecycle', async () => {
      await testCrudLifecycle(Issue, 'Issue', { title: 'Fix login bug' }, { title: 'Fix login bug (urgent)' })
    })

    it('Comment CRUD lifecycle', async () => {
      await testCrudLifecycle(Comment, 'Comment', { body: 'This looks good!' }, { body: 'Updated: This looks great!' })
    })
  })
})
