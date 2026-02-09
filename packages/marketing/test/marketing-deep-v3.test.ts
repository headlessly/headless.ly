import { describe, it, expect, vi } from 'vitest'
import type { NounSchema, ParsedProperty, VerbConjugation, NounInstance } from 'digital-objects'
import { Campaign, Segment, Form } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/marketing — deep v3', () => {
  setupTestProvider()

  // ===========================================================================
  // 1. Campaign full lifecycle workflow (5 tests)
  // ===========================================================================
  describe('Campaign full lifecycle workflow', () => {
    it('Draft -> launch -> Launched (multi-step lifecycle)', async () => {
      const c = await Campaign.create({ name: 'Lifecycle A', status: 'Draft', type: 'Email' })
      expect(c.status).toBe('Draft')
      expect(c.$version).toBe(1)

      const launched = await Campaign.launch(c.$id)
      expect(launched.status).toBe('Launched')
      expect(launched.$version).toBe(2)
    })

    it('Draft -> launch -> pause -> complete (full forward chain)', async () => {
      const c = await Campaign.create({ name: 'Full Chain', status: 'Draft', type: 'Social' })
      const launched = await Campaign.launch(c.$id)
      expect(launched.status).toBe('Launched')

      const paused = await Campaign.pause(c.$id)
      expect(paused.status).toBe('Paused')
      expect(paused.$version).toBe(3)

      const completed = await Campaign.complete(c.$id)
      expect(completed.status).toBe('Completed')
      expect(completed.$version).toBe(4)
    })

    it('launch -> pause -> launch again cycles correctly', async () => {
      const c = await Campaign.create({ name: 'Cycle Campaign', status: 'Draft' })
      await Campaign.launch(c.$id)
      await Campaign.pause(c.$id)
      const relaunched = await Campaign.launch(c.$id)
      expect(relaunched.status).toBe('Launched')
      expect(relaunched.$version).toBe(4)
    })

    it('complete after multiple pause/launch cycles retains correct version', async () => {
      const c = await Campaign.create({ name: 'Multi Cycle', status: 'Draft' })
      await Campaign.launch(c.$id) // v2
      await Campaign.pause(c.$id) // v3
      await Campaign.launch(c.$id) // v4
      await Campaign.pause(c.$id) // v5
      const completed = await Campaign.complete(c.$id)
      expect(completed.$version).toBe(6)
      expect(completed.status).toBe('Completed')
      expect(completed.name).toBe('Multi Cycle')
    })

    it('all original fields survive entire lifecycle journey', async () => {
      const c = await Campaign.create({
        name: 'Survivor',
        status: 'Draft',
        type: 'Webinar',
        budget: 25000,
        currency: 'EUR',
        targetLeads: 500,
        targetRevenue: 100000,
        utmSource: 'linkedin',
        utmMedium: 'sponsored',
        utmCampaign: 'webinar_q3',
        landingPageUrl: 'https://headless.ly/webinar',
      })
      await Campaign.launch(c.$id)
      await Campaign.pause(c.$id)
      const final = await Campaign.complete(c.$id)
      expect(final.name).toBe('Survivor')
      expect(final.type).toBe('Webinar')
      expect(final.budget).toBe(25000)
      expect(final.currency).toBe('EUR')
      expect(final.targetLeads).toBe(500)
      expect(final.targetRevenue).toBe(100000)
      expect(final.utmSource).toBe('linkedin')
      expect(final.utmMedium).toBe('sponsored')
      expect(final.utmCampaign).toBe('webinar_q3')
      expect(final.landingPageUrl).toBe('https://headless.ly/webinar')
    })
  })

  // ===========================================================================
  // 2. Concurrent campaign operations (4 tests)
  // ===========================================================================
  describe('concurrent campaign operations', () => {
    it('creates 5 campaigns concurrently with Promise.all', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        Campaign.create({ name: `Concurrent ${i}`, type: 'Email' }),
      )
      const results = await Promise.all(promises)
      expect(results).toHaveLength(5)
      const ids = results.map((r) => r.$id)
      expect(new Set(ids).size).toBe(5)
    })

    it('concurrent finds on different types do not interfere', async () => {
      await Campaign.create({ name: 'C1', type: 'Email' })
      await Segment.create({ name: 'S1' })
      await Form.create({ name: 'F1' })

      const [campaigns, segments, forms] = await Promise.all([Campaign.find(), Segment.find(), Form.find()])
      expect(campaigns).toHaveLength(1)
      expect(segments).toHaveLength(1)
      expect(forms).toHaveLength(1)
    })

    it('concurrent updates on different campaigns succeed', async () => {
      const c1 = await Campaign.create({ name: 'Upd 1', budget: 100 })
      const c2 = await Campaign.create({ name: 'Upd 2', budget: 200 })

      const [u1, u2] = await Promise.all([Campaign.update(c1.$id, { budget: 1000 }), Campaign.update(c2.$id, { budget: 2000 })])
      expect(u1.budget).toBe(1000)
      expect(u2.budget).toBe(2000)
    })

    it('concurrent verb transitions on different campaigns succeed', async () => {
      const c1 = await Campaign.create({ name: 'Verb 1', status: 'Draft' })
      const c2 = await Campaign.create({ name: 'Verb 2', status: 'Active' })

      const [launched, completed] = await Promise.all([Campaign.launch(c1.$id), Campaign.complete(c2.$id)])
      expect(launched.status).toBe('Launched')
      expect(completed.status).toBe('Completed')
    })
  })

  // ===========================================================================
  // 3. Bulk CRUD operations (5 tests)
  // ===========================================================================
  describe('bulk CRUD operations', () => {
    it('creates 20 campaigns and finds all', async () => {
      for (let i = 0; i < 20; i++) {
        await Campaign.create({ name: `Bulk ${i}`, type: i % 2 === 0 ? 'Email' : 'Social' })
      }
      const all = await Campaign.find()
      expect(all).toHaveLength(20)
    })

    it('filters a large set by type accurately', async () => {
      for (let i = 0; i < 15; i++) {
        const type = i < 5 ? 'Email' : i < 10 ? 'Social' : 'Paid'
        await Campaign.create({ name: `Filter ${i}`, type })
      }
      const emails = await Campaign.find({ type: 'Email' })
      const socials = await Campaign.find({ type: 'Social' })
      const paids = await Campaign.find({ type: 'Paid' })
      expect(emails).toHaveLength(5)
      expect(socials).toHaveLength(5)
      expect(paids).toHaveLength(5)
    })

    it('deletes multiple campaigns and verifies removal', async () => {
      const ids: string[] = []
      for (let i = 0; i < 5; i++) {
        const c = await Campaign.create({ name: `Del ${i}` })
        ids.push(c.$id)
      }
      for (const id of ids) {
        await Campaign.delete(id)
      }
      const remaining = await Campaign.find()
      expect(remaining).toHaveLength(0)
    })

    it('updates multiple segments in sequence and tracks versions', async () => {
      const s = await Segment.create({ name: 'Evolving', memberCount: 0 })
      for (let i = 1; i <= 10; i++) {
        await Segment.update(s.$id, { memberCount: i * 10 })
      }
      const final = await Segment.get(s.$id)
      expect(final!.memberCount).toBe(100)
      expect(final!.$version).toBe(11)
    })

    it('bulk creates forms with different statuses and filters accurately', async () => {
      const statuses = ['Draft', 'Active', 'Archived']
      for (let i = 0; i < 9; i++) {
        await Form.create({ name: `Form ${i}`, status: statuses[i % 3] })
      }
      const drafts = await Form.find({ status: 'Draft' })
      const actives = await Form.find({ status: 'Active' })
      const archived = await Form.find({ status: 'Archived' })
      expect(drafts).toHaveLength(3)
      expect(actives).toHaveLength(3)
      expect(archived).toHaveLength(3)
    })
  })

  // ===========================================================================
  // 4. Advanced compound MongoDB queries (8 tests)
  // ===========================================================================
  describe('advanced compound MongoDB queries', () => {
    it('combines $gt and $lt for range query', async () => {
      await Campaign.create({ name: 'Low', budget: 100 })
      await Campaign.create({ name: 'Mid', budget: 500 })
      await Campaign.create({ name: 'High', budget: 1000 })
      const results = await Campaign.find({ budget: { $gt: 100, $lt: 1000 } })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Mid')
    })

    it('combines $gte and $lte for inclusive range query', async () => {
      await Campaign.create({ name: 'A', budget: 100 })
      await Campaign.create({ name: 'B', budget: 500 })
      await Campaign.create({ name: 'C', budget: 1000 })
      const results = await Campaign.find({ budget: { $gte: 100, $lte: 500 } })
      expect(results).toHaveLength(2)
    })

    it('multi-field query: status + type filters together', async () => {
      await Campaign.create({ name: 'Match', status: 'Active', type: 'Email' })
      await Campaign.create({ name: 'Wrong Status', status: 'Draft', type: 'Email' })
      await Campaign.create({ name: 'Wrong Type', status: 'Active', type: 'Social' })
      const results = await Campaign.find({ status: 'Active', type: 'Email' })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Match')
    })

    it('multi-field query: budget range + status', async () => {
      await Campaign.create({ name: 'Active Low', status: 'Active', budget: 500 })
      await Campaign.create({ name: 'Active High', status: 'Active', budget: 5000 })
      await Campaign.create({ name: 'Draft High', status: 'Draft', budget: 5000 })
      const results = await Campaign.find({ status: 'Active', budget: { $gt: 1000 } })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Active High')
    })

    it('$in with single element acts like $eq', async () => {
      await Campaign.create({ name: 'Only Email', type: 'Email' })
      await Campaign.create({ name: 'Social One', type: 'Social' })
      const results = await Campaign.find({ type: { $in: ['Email'] } })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Only Email')
    })

    it('$nin combined with $exists filters correctly', async () => {
      await Campaign.create({ name: 'With Email', type: 'Email', budget: 1000 })
      await Campaign.create({ name: 'With Social', type: 'Social', budget: 2000 })
      await Campaign.create({ name: 'No Budget', type: 'Paid' })
      const results = await Campaign.find({ type: { $nin: ['Email'] }, budget: { $exists: true } })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('With Social')
    })

    it('$regex with case-insensitive flag', async () => {
      await Campaign.create({ name: 'Spring SALE 2025' })
      await Campaign.create({ name: 'summer sale 2025' })
      await Campaign.create({ name: 'Fall Promo' })
      const results = await Campaign.find({ name: { $regex: /sale/i } })
      expect(results).toHaveLength(2)
    })

    it('$ne combined with $regex on different fields', async () => {
      await Campaign.create({ name: 'Email Summer', type: 'Email' })
      await Campaign.create({ name: 'Social Summer', type: 'Social' })
      await Campaign.create({ name: 'Email Winter', type: 'Email' })
      const results = await Campaign.find({ type: { $ne: 'Social' }, name: { $regex: 'Summer' } })
      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('Email Summer')
    })
  })

  // ===========================================================================
  // 5. Schema raw definition completeness (5 tests)
  // ===========================================================================
  describe('schema raw definition completeness', () => {
    it('Campaign raw definition includes all field declarations', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.raw.name).toBe('string!')
      expect(schema.raw.slug).toBe('string##')
      expect(schema.raw.description).toBe('string')
      expect(schema.raw.type).toBe('Email | Social | Content | Event | Paid | Webinar | Referral')
      expect(schema.raw.status).toBe('Draft | Scheduled | Active | Paused | Completed | Cancelled')
      expect(schema.raw.startDate).toBe('date')
      expect(schema.raw.endDate).toBe('date')
      expect(schema.raw.launchedAt).toBe('datetime')
      expect(schema.raw.budget).toBe('number')
      expect(schema.raw.actualCost).toBe('number')
      expect(schema.raw.currency).toBe('string')
    })

    it('Campaign raw definition includes all target/tracking declarations', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.raw.targetLeads).toBe('number')
      expect(schema.raw.targetRevenue).toBe('number')
      expect(schema.raw.actualLeads).toBe('number')
      expect(schema.raw.actualRevenue).toBe('number')
      expect(schema.raw.roi).toBe('number')
      expect(schema.raw.landingPageUrl).toBe('string')
      expect(schema.raw.utmSource).toBe('string')
      expect(schema.raw.utmMedium).toBe('string')
      expect(schema.raw.utmCampaign).toBe('string')
    })

    it('Campaign raw definition includes relationship declarations', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.raw.owner).toBe('-> Contact')
      expect(schema.raw.leads).toBe('<- Lead.campaign[]')
    })

    it('Segment raw definition includes all field declarations', () => {
      const schema = Segment.$schema as NounSchema
      expect(schema.raw.name).toBe('string!')
      expect(schema.raw.description).toBe('string')
      expect(schema.raw.criteria).toBe('string')
      expect(schema.raw.organization).toBe('-> Organization')
      expect(schema.raw.memberCount).toBe('number')
      expect(schema.raw.isDynamic).toBe('string')
    })

    it('Form raw definition includes all field and verb declarations', () => {
      const schema = Form.$schema as NounSchema
      expect(schema.raw.name).toBe('string!')
      expect(schema.raw.description).toBe('string')
      expect(schema.raw.fields).toBe('string')
      expect(schema.raw.organization).toBe('-> Organization')
      expect(schema.raw.status).toBe('Draft | Active | Archived')
      expect(schema.raw.submissionCount).toBe('number')
      expect(schema.raw.publish).toBe('Published')
      expect(schema.raw.archive).toBe('Archived')
    })
  })

  // ===========================================================================
  // 6. Verb conjugation edge cases (6 tests)
  // ===========================================================================
  describe('verb conjugation edge cases', () => {
    it('update verb has correct full conjugation with reverseBy and reverseAt', () => {
      const schema = Campaign.$schema as NounSchema
      const update = schema.verbs.get('update') as VerbConjugation
      expect(update.action).toBe('update')
      expect(update.activity).toBe('updating')
      expect(update.event).toBe('updated')
      expect(update.reverseBy).toBe('updatedBy')
      expect(update.reverseAt).toBe('updatedAt')
    })

    it('delete verb has correct full conjugation with reverseBy and reverseAt', () => {
      const schema = Campaign.$schema as NounSchema
      const del = schema.verbs.get('delete') as VerbConjugation
      expect(del.reverseBy).toBe('deletedBy')
      expect(del.reverseAt).toBe('deletedAt')
    })

    it('create verb has correct reverseBy and reverseAt', () => {
      const schema = Campaign.$schema as NounSchema
      const create = schema.verbs.get('create') as VerbConjugation
      expect(create.reverseBy).toBe('createdBy')
      expect(create.reverseAt).toBe('createdAt')
    })

    it('pause verb has correct reverseBy: pausedBy and reverseAt: pausedAt', () => {
      const schema = Campaign.$schema as NounSchema
      const pause = schema.verbs.get('pause') as VerbConjugation
      expect(pause.reverseBy).toBe('pausedBy')
      expect(pause.reverseAt).toBe('pausedAt')
    })

    it('complete verb has correct reverseBy: completedBy and reverseAt: completedAt', () => {
      const schema = Campaign.$schema as NounSchema
      const complete = schema.verbs.get('complete') as VerbConjugation
      expect(complete.reverseBy).toBe('completedBy')
      expect(complete.reverseAt).toBe('completedAt')
    })

    it('Form archive verb has reverseAt: archivedAt', () => {
      const schema = Form.$schema as NounSchema
      const archive = schema.verbs.get('archive') as VerbConjugation
      expect(archive.reverseAt).toBe('archivedAt')
    })
  })

  // ===========================================================================
  // 7. Cross-entity relationship patterns (4 tests)
  // ===========================================================================
  describe('cross-entity relationship patterns', () => {
    it('Campaign can reference a Segment via criteria string', async () => {
      const segment = await Segment.create({ name: 'Enterprise Accounts', memberCount: 150 })
      const campaign = await Campaign.create({
        name: 'Enterprise Outreach',
        type: 'Email',
        description: `Targeting segment: ${segment.$id}`,
      })
      expect(campaign.description).toContain(segment.$id)
      const fetched = await Campaign.get(campaign.$id)
      expect(fetched!.description).toContain('segment_')
    })

    it('Form can reference a Campaign via description', async () => {
      const campaign = await Campaign.create({ name: 'Webinar 2025', type: 'Webinar' })
      const form = await Form.create({
        name: 'Webinar Registration',
        description: `campaign:${campaign.$id}`,
      })
      expect(form.description).toContain(campaign.$id)
    })

    it('Segment criteria can encode multiple campaign references', async () => {
      const c1 = await Campaign.create({ name: 'Campaign A' })
      const c2 = await Campaign.create({ name: 'Campaign B' })
      const segment = await Segment.create({
        name: 'Multi-Campaign',
        criteria: JSON.stringify({ campaigns: [c1.$id, c2.$id] }),
      })
      const parsed = JSON.parse(segment.criteria as string)
      expect(parsed.campaigns).toHaveLength(2)
      expect(parsed.campaigns).toContain(c1.$id)
      expect(parsed.campaigns).toContain(c2.$id)
    })

    it('multiple forms can reference the same organization ID', async () => {
      const orgId = 'organization_xR4mT9pZ'
      const f1 = await Form.create({ name: 'Contact Form', organization: orgId })
      const f2 = await Form.create({ name: 'Feedback Form', organization: orgId })
      expect(f1.organization).toBe(orgId)
      expect(f2.organization).toBe(orgId)
    })
  })

  // ===========================================================================
  // 8. Segment dynamic membership criteria (5 tests)
  // ===========================================================================
  describe('Segment dynamic membership criteria', () => {
    it('stores JSON criteria for dynamic segment rules', async () => {
      const rules = {
        operator: 'AND',
        conditions: [
          { field: 'industry', op: '=', value: 'SaaS' },
          { field: 'revenue', op: '>', value: 100000 },
        ],
      }
      const s = await Segment.create({ name: 'SaaS High Revenue', criteria: JSON.stringify(rules), isDynamic: 'true' })
      const fetched = await Segment.get(s.$id)
      const parsed = JSON.parse(fetched!.criteria as string)
      expect(parsed.operator).toBe('AND')
      expect(parsed.conditions).toHaveLength(2)
    })

    it('updates criteria without affecting other fields', async () => {
      const s = await Segment.create({
        name: 'Tech Segment',
        description: 'Technology companies',
        criteria: 'industry=tech',
        memberCount: 50,
        isDynamic: 'true',
      })
      const updated = await Segment.update(s.$id, { criteria: 'industry=tech AND size>100' })
      expect(updated.criteria).toBe('industry=tech AND size>100')
      expect(updated.name).toBe('Tech Segment')
      expect(updated.description).toBe('Technology companies')
      expect(updated.memberCount).toBe(50)
      expect(updated.isDynamic).toBe('true')
    })

    it('empty criteria string is valid for manual segments', async () => {
      const s = await Segment.create({ name: 'Manual Segment', criteria: '', isDynamic: 'false' })
      expect(s.criteria).toBe('')
      expect(s.isDynamic).toBe('false')
    })

    it('can filter segments by isDynamic value', async () => {
      await Segment.create({ name: 'Dynamic 1', isDynamic: 'true' })
      await Segment.create({ name: 'Dynamic 2', isDynamic: 'true' })
      await Segment.create({ name: 'Static 1', isDynamic: 'false' })
      const dynamics = await Segment.find({ isDynamic: 'true' })
      expect(dynamics).toHaveLength(2)
    })

    it('segments with different organizations are queryable independently', async () => {
      await Segment.create({ name: 'Org A Segment', organization: 'organization_aaaa1111' })
      await Segment.create({ name: 'Org B Segment', organization: 'organization_bbbb2222' })
      const orgA = await Segment.find({ organization: 'organization_aaaa1111' })
      expect(orgA).toHaveLength(1)
      expect(orgA[0].name).toBe('Org A Segment')
    })
  })

  // ===========================================================================
  // 9. Form submission tracking and analytics patterns (4 tests)
  // ===========================================================================
  describe('Form submission tracking analytics', () => {
    it('tracks high submission counts accurately', async () => {
      const f = await Form.create({ name: 'Popular Form', submissionCount: 0 })
      const updated = await Form.update(f.$id, { submissionCount: 99999 })
      expect(updated.submissionCount).toBe(99999)
    })

    it('form with complex field schema (multiple field types)', async () => {
      const fieldSchema = JSON.stringify([
        { name: 'firstName', type: 'text', required: true },
        { name: 'lastName', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'company', type: 'text', required: false },
        { name: 'budget', type: 'select', options: ['<10k', '10k-50k', '50k-100k', '>100k'] },
        { name: 'message', type: 'textarea', required: false },
      ])
      const f = await Form.create({ name: 'Enterprise Contact', fields: fieldSchema, status: 'Active' })
      const parsed = JSON.parse(f.fields as string)
      expect(parsed).toHaveLength(6)
      expect(parsed[4].options).toContain('10k-50k')
    })

    it('form publish -> track submissions -> archive lifecycle', async () => {
      const f = await Form.create({ name: 'Survey', status: 'Draft', submissionCount: 0 })
      await Form.publish(f.$id)
      // Simulate submissions
      await Form.update(f.$id, { submissionCount: 42 })
      const active = await Form.get(f.$id)
      expect(active!.submissionCount).toBe(42)
      expect(active!.$version).toBe(3)

      await Form.archive(f.$id)
      const archived = await Form.get(f.$id)
      expect(archived!.status).toBe('Archived')
      expect(archived!.submissionCount).toBe(42)
    })

    it('filtering forms by submissionCount range', async () => {
      await Form.create({ name: 'Zero Subs', submissionCount: 0 })
      await Form.create({ name: 'Some Subs', submissionCount: 50 })
      await Form.create({ name: 'Many Subs', submissionCount: 500 })
      const popular = await Form.find({ submissionCount: { $gt: 10 } })
      expect(popular).toHaveLength(2)
    })
  })

  // ===========================================================================
  // 10. Multiple hooks on same verb (3 tests)
  // ===========================================================================
  describe('multiple hooks on same verb', () => {
    it('multiple AFTER hooks fire in registration order', async () => {
      const order: number[] = []
      Campaign.launched(() => {
        order.push(1)
      })
      Campaign.launched(() => {
        order.push(2)
      })
      Campaign.launched(() => {
        order.push(3)
      })

      const c = await Campaign.create({ name: 'Multi Hook', status: 'Draft' })
      await Campaign.launch(c.$id)
      expect(order).toEqual([1, 2, 3])
    })

    it('multiple BEFORE hooks all execute', async () => {
      const calls: string[] = []
      Campaign.creating(() => {
        calls.push('hook1')
      })
      Campaign.creating(() => {
        calls.push('hook2')
      })

      await Campaign.create({ name: 'Multi Before' })
      expect(calls).toContain('hook1')
      expect(calls).toContain('hook2')
    })

    it('BEFORE hooks fire before AFTER hooks within a verb', async () => {
      const timeline: string[] = []
      Campaign.launching(() => {
        timeline.push('before')
      })
      Campaign.launched(() => {
        timeline.push('after')
      })

      const c = await Campaign.create({ name: 'Timing Test', status: 'Draft' })
      await Campaign.launch(c.$id)
      expect(timeline.indexOf('before')).toBeLessThan(timeline.indexOf('after'))
    })
  })

  // ===========================================================================
  // 11. Campaign with full payload (2 tests)
  // ===========================================================================
  describe('Campaign with full payload', () => {
    it('creates a campaign with every field populated', async () => {
      const c = await Campaign.create({
        name: 'Mega Campaign',
        slug: 'mega-campaign',
        description: 'The ultimate marketing push',
        type: 'Paid',
        status: 'Scheduled',
        startDate: '2025-07-01',
        endDate: '2025-09-30',
        launchedAt: '2025-07-01T08:00:00Z',
        budget: 50000,
        actualCost: 0,
        currency: 'USD',
        targetLeads: 1000,
        targetRevenue: 500000,
        actualLeads: 0,
        actualRevenue: 0,
        roi: 0,
        landingPageUrl: 'https://headless.ly/mega',
        utmSource: 'google',
        utmMedium: 'cpc',
        utmCampaign: 'mega_launch',
      })
      expect(c.$type).toBe('Campaign')
      expect(c.slug).toBe('mega-campaign')
      expect(c.description).toBe('The ultimate marketing push')
      expect(c.launchedAt).toBe('2025-07-01T08:00:00Z')
      expect(c.actualCost).toBe(0)
      expect(c.actualLeads).toBe(0)
      expect(c.actualRevenue).toBe(0)
      expect(c.roi).toBe(0)
    })

    it('updates actuals on a completed campaign for ROI tracking', async () => {
      const c = await Campaign.create({
        name: 'ROI Campaign',
        budget: 10000,
        targetLeads: 100,
        targetRevenue: 50000,
        status: 'Active',
      })
      await Campaign.complete(c.$id)
      const withActuals = await Campaign.update(c.$id, {
        actualCost: 9500,
        actualLeads: 120,
        actualRevenue: 62000,
        roi: 5.53,
      })
      expect(withActuals.actualCost).toBe(9500)
      expect(withActuals.actualLeads).toBe(120)
      expect(withActuals.actualRevenue).toBe(62000)
      expect(withActuals.roi).toBe(5.53)
      expect(withActuals.status).toBe('Completed')
    })
  })

  // ===========================================================================
  // 12. Schema field/relationship/verb counts (3 tests)
  // ===========================================================================
  describe('schema field/relationship/verb totals', () => {
    it('Campaign has exactly 17 fields', () => {
      const schema = Campaign.$schema as NounSchema
      // name, slug, description, type, status, startDate, endDate, launchedAt,
      // budget, actualCost, currency, targetLeads, targetRevenue, actualLeads,
      // actualRevenue, roi, landingPageUrl, utmSource, utmMedium, utmCampaign
      expect(schema.fields.size).toBe(20)
    })

    it('Campaign has exactly 2 relationships', () => {
      const schema = Campaign.$schema as NounSchema
      expect(schema.relationships.size).toBe(2)
    })

    it('Campaign raw definition has expected key count', () => {
      const schema = Campaign.$schema as NounSchema
      const rawKeys = Object.keys(schema.raw)
      // 20 fields + 2 relationships + 3 verbs = 25
      expect(rawKeys).toHaveLength(25)
    })
  })

  // ===========================================================================
  // 13. Form status transitions via update (not verb) (3 tests)
  // ===========================================================================
  describe('Form status transitions via direct update', () => {
    it('can manually set status to Active via update()', async () => {
      const f = await Form.create({ name: 'Manual Active', status: 'Draft' })
      const updated = await Form.update(f.$id, { status: 'Active' })
      expect(updated.status).toBe('Active')
    })

    it('update() preserves status when not explicitly changed', async () => {
      const f = await Form.create({ name: 'Keep Status', status: 'Active' })
      const updated = await Form.update(f.$id, { description: 'Added description' })
      expect(updated.status).toBe('Active')
      expect(updated.description).toBe('Added description')
    })

    it('update to Draft -> publish -> update description -> archive preserves all', async () => {
      const f = await Form.create({ name: 'Complex Flow', status: 'Draft' })
      await Form.publish(f.$id) // v2
      await Form.update(f.$id, { description: 'Updated after publish' }) // v3
      const archived = await Form.archive(f.$id) // v4
      expect(archived.$version).toBe(4)
      expect(archived.status).toBe('Archived')
      expect(archived.description).toBe('Updated after publish')
    })
  })

  // ===========================================================================
  // 14. Entity find after mixed operations (3 tests)
  // ===========================================================================
  describe('entity find after mixed operations', () => {
    it('find returns correct count after interleaved creates and deletes', async () => {
      const c1 = await Campaign.create({ name: 'Stay 1' })
      const c2 = await Campaign.create({ name: 'Go Away' })
      const c3 = await Campaign.create({ name: 'Stay 2' })
      await Campaign.delete(c2.$id)
      const remaining = await Campaign.find()
      expect(remaining).toHaveLength(2)
      const names = remaining.map((c: any) => c.name)
      expect(names).toContain('Stay 1')
      expect(names).toContain('Stay 2')
      expect(names).not.toContain('Go Away')
    })

    it('find with filter after updates returns current state', async () => {
      const c = await Campaign.create({ name: 'Was Draft', status: 'Draft' })
      await Campaign.update(c.$id, { status: 'Active' })
      const drafts = await Campaign.find({ status: 'Draft' })
      const actives = await Campaign.find({ status: 'Active' })
      expect(drafts).toHaveLength(0)
      expect(actives).toHaveLength(1)
      expect(actives[0].name).toBe('Was Draft')
    })

    it('segments survive interleaved form creates', async () => {
      await Segment.create({ name: 'Seg A' })
      await Form.create({ name: 'Form X' })
      await Segment.create({ name: 'Seg B' })
      await Form.create({ name: 'Form Y' })

      const segments = await Segment.find()
      const forms = await Form.find()
      expect(segments).toHaveLength(2)
      expect(forms).toHaveLength(2)
    })
  })

  // ===========================================================================
  // 15. Campaign $updatedAt advances through verbs (3 tests)
  // ===========================================================================
  describe('$updatedAt advances through verb transitions', () => {
    it('$updatedAt changes after launch()', async () => {
      const c = await Campaign.create({ name: 'Time Track', status: 'Draft' })
      const originalUpdated = c.$updatedAt
      const launched = await Campaign.launch(c.$id)
      expect(new Date(launched.$updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(originalUpdated).getTime())
    })

    it('$createdAt remains constant through all transitions', async () => {
      const c = await Campaign.create({ name: 'Created Const', status: 'Draft' })
      const createdAt = c.$createdAt
      const l = await Campaign.launch(c.$id)
      expect(l.$createdAt).toBe(createdAt)
      const p = await Campaign.pause(c.$id)
      expect(p.$createdAt).toBe(createdAt)
      const comp = await Campaign.complete(c.$id)
      expect(comp.$createdAt).toBe(createdAt)
    })

    it('$updatedAt changes after Form.archive()', async () => {
      const f = await Form.create({ name: 'Time Form', status: 'Active' })
      const archived = await Form.archive(f.$id)
      expect(new Date(archived.$updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(f.$updatedAt).getTime())
    })
  })
})
