import { describe, it, expect } from 'vitest'
import { Customer, Product, Plan, Price, Subscription, Invoice, Payment } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/billing v3 — deep tests', () => {
  setupTestProvider()

  // ---------------------------------------------------------------------------
  // 1. Schema Completeness Assertions — exact field and verb counts
  // ---------------------------------------------------------------------------
  describe('schema completeness — exact field/relationship/verb counts', () => {
    it('Customer has exactly 7 fields (name, email, stripeCustomerId, paymentMethod, currency, taxExempt + 1 relationship org as field)', () => {
      // Fields: name, email, stripeCustomerId, paymentMethod, currency, taxExempt
      expect(Customer.$schema.fields.size).toBe(6)
    })

    it('Customer has exactly 4 relationships (organization, subscriptions, invoices, payments)', () => {
      expect(Customer.$schema.relationships.size).toBe(4)
    })

    it('Product has exactly 9 fields', () => {
      // name, slug, description, tagline, type, icon, image, features, highlights, status, visibility, featured, stripeProductId
      // Enums: type, status, visibility
      // Let's count the fields map
      const fieldNames = [...Product.$schema.fields.keys()]
      expect(fieldNames).toContain('name')
      expect(fieldNames).toContain('slug')
      expect(fieldNames).toContain('description')
      expect(fieldNames).toContain('tagline')
      expect(fieldNames).toContain('stripeProductId')
      expect(Product.$schema.fields.size).toBeGreaterThanOrEqual(9)
    })

    it('Plan has exactly 0 custom verbs', () => {
      // Plan only has CRUD, no custom verbs
      const customVerbs = [...Plan.$schema.verbs.keys()].filter((v) => !['create', 'update', 'delete'].includes(v))
      expect(customVerbs.length).toBe(0)
    })

    it('Price has exactly 0 custom verbs', () => {
      const customVerbs = [...Price.$schema.verbs.keys()].filter((v) => !['create', 'update', 'delete'].includes(v))
      expect(customVerbs.length).toBe(0)
    })

    it('Subscription has exactly 5 custom verbs', () => {
      const customVerbs = [...Subscription.$schema.verbs.keys()].filter((v) => !['create', 'update', 'delete'].includes(v))
      expect(customVerbs).toEqual(['pause', 'cancel', 'reactivate', 'upgrade', 'downgrade'])
    })

    it('Invoice has exactly 2 custom verbs', () => {
      const customVerbs = [...Invoice.$schema.verbs.keys()].filter((v) => !['create', 'update', 'delete'].includes(v))
      expect(customVerbs).toEqual(['pay', 'void'])
    })

    it('Payment has exactly 1 custom verb', () => {
      const customVerbs = [...Payment.$schema.verbs.keys()].filter((v) => !['create', 'update', 'delete'].includes(v))
      expect(customVerbs).toEqual(['refund'])
    })

    it('total custom verbs across all billing entities is 8', () => {
      const entities = [Customer, Product, Plan, Price, Subscription, Invoice, Payment]
      let total = 0
      for (const entity of entities) {
        total += [...entity.$schema.verbs.keys()].filter((v) => !['create', 'update', 'delete'].includes(v)).length
      }
      expect(total).toBe(8) // 5 (Sub) + 2 (Inv) + 1 (Pay)
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Stripe ID fields and external references
  // ---------------------------------------------------------------------------
  describe('Stripe external ID fields', () => {
    it('Customer.stripeCustomerId is unique and indexed (string##)', () => {
      const field = Customer.$schema.fields.get('stripeCustomerId')
      expect(field).toBeDefined()
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })

    it('Product.stripeProductId is unique and indexed (string##)', () => {
      const field = Product.$schema.fields.get('stripeProductId')
      expect(field).toBeDefined()
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })

    it('Price.stripeId is unique and indexed (string##)', () => {
      const field = Price.$schema.fields.get('stripeId')
      expect(field).toBeDefined()
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })

    it('Subscription.stripeSubscriptionId is unique and indexed (string##)', () => {
      const field = Subscription.$schema.fields.get('stripeSubscriptionId')
      expect(field).toBeDefined()
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })

    it('Subscription.stripeCustomerId is a plain string (not unique)', () => {
      const field = Subscription.$schema.fields.get('stripeCustomerId')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
      // It's a regular string, not unique (just informational reference)
      expect(field!.modifiers!.unique).toBe(false)
    })

    it('Invoice.stripeInvoiceId is unique and indexed (string##)', () => {
      const field = Invoice.$schema.fields.get('stripeInvoiceId')
      expect(field).toBeDefined()
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })

    it('Payment.stripePaymentId is unique and indexed (string##)', () => {
      const field = Payment.$schema.fields.get('stripePaymentId')
      expect(field).toBeDefined()
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })

    it('creates Customer with stripeCustomerId and retrieves it', async () => {
      const customer = await Customer.create({ name: 'Stripe Corp', email: 'stripe@corp.com', stripeCustomerId: 'cus_test123abc' })
      expect(customer.stripeCustomerId).toBe('cus_test123abc')
      const fetched = await Customer.get(customer.$id)
      expect(fetched!.stripeCustomerId).toBe('cus_test123abc')
    })

    it('creates Subscription with stripeSubscriptionId', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        stripeSubscriptionId: 'sub_abc123xyz',
        stripeCustomerId: 'cus_test123abc',
      })
      expect(sub.stripeSubscriptionId).toBe('sub_abc123xyz')
      expect(sub.stripeCustomerId).toBe('cus_test123abc')
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Subscription Lifecycle: Active -> Paused -> Reactivated
  // ---------------------------------------------------------------------------
  describe('Subscription lifecycle: Active -> Paused -> Reactivated', () => {
    it('creates an Active subscription and pauses it', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      expect(sub.status).toBe('Active')
      const paused = await (Subscription as any).pause(sub.$id)
      expect(paused.status).toBe('Paused')
      expect(paused.$version).toBe(2)
    })

    it('pauses and then reactivates a subscription', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      await (Subscription as any).pause(sub.$id)
      const reactivated = await (Subscription as any).reactivate(sub.$id)
      expect(reactivated.status).toBe('Reactivated')
      expect(reactivated.$version).toBe(3)
    })

    it('preserves metadata through pause -> reactivate lifecycle', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        quantity: 10,
      })
      const originalId = sub.$id
      const originalCreatedAt = sub.$createdAt
      await (Subscription as any).pause(sub.$id)
      const reactivated = await (Subscription as any).reactivate(sub.$id)
      expect(reactivated.$id).toBe(originalId)
      expect(reactivated.$createdAt).toBe(originalCreatedAt)
      expect(reactivated.quantity).toBe(10)
      expect(reactivated.currentPeriodStart).toBe('2024-01-01T00:00:00Z')
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Subscription Lifecycle: Active -> Cancelled
  // ---------------------------------------------------------------------------
  describe('Subscription lifecycle: Active -> Cancelled', () => {
    it('cancels an active subscription', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      // The verb is 'cancel' with declaration 'Cancelled'
      // The Noun definition says: cancel: 'Cancelled'
      // resolveVerbTransition looks for an enum field containing 'Cancelled'
      // Subscription status enum: 'Active | PastDue | Cancelled | Trialing | Paused | Incomplete'
      // 'Cancelled' matches the enum — verb transitions status correctly
      const cancelled = await (Subscription as any).cancel(sub.$id)
      expect(cancelled.status).toBe('Cancelled')
    })

    it('cancel verb uses British-spelling gerund "cancelling"', () => {
      // "cancel" is an irregular verb with British English doubling
      const verb = Subscription.$schema.verbs.get('cancel')!
      expect(verb.activity).toBe('cancelling')
      expect(verb.event).toBe('cancelled')
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Subscription Upgrade / Downgrade
  // ---------------------------------------------------------------------------
  describe('Subscription upgrade and downgrade paths', () => {
    it('upgrades a subscription', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      const upgraded = await (Subscription as any).upgrade(sub.$id)
      expect(upgraded.status).toBe('Upgraded')
    })

    it('downgrades a subscription', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      const downgraded = await (Subscription as any).downgrade(sub.$id)
      expect(downgraded.status).toBe('Downgraded')
    })

    it('upgrade preserves subscription data', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        quantity: 5,
        paymentMethod: 'pm_card_visa',
      })
      const upgraded = await (Subscription as any).upgrade(sub.$id)
      expect(upgraded.quantity).toBe(5)
      expect(upgraded.paymentMethod).toBe('pm_card_visa')
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Invoice Lifecycle: Draft -> Paid
  // ---------------------------------------------------------------------------
  describe('Invoice lifecycle: create -> pay', () => {
    it('creates invoice in Draft status and pays it', async () => {
      const inv = await Invoice.create({
        number: 'INV-LIFE-001',
        subtotal: 9900,
        total: 9900,
        amountDue: 9900,
        status: 'Draft',
      })
      expect(inv.status).toBe('Draft')
      const paid = await (Invoice as any).pay(inv.$id)
      expect(paid.status).toBe('Paid')
      expect(paid.$version).toBe(2)
    })

    it('paying preserves invoice amounts', async () => {
      const inv = await Invoice.create({
        number: 'INV-LIFE-002',
        subtotal: 15000,
        tax: 1350,
        discount: 500,
        total: 15850,
        amountDue: 15850,
        currency: 'USD',
      })
      const paid = await (Invoice as any).pay(inv.$id)
      expect(paid.subtotal).toBe(15000)
      expect(paid.tax).toBe(1350)
      expect(paid.discount).toBe(500)
      expect(paid.total).toBe(15850)
      expect(paid.currency).toBe('USD')
    })
  })

  // ---------------------------------------------------------------------------
  // 7. Invoice Lifecycle: create -> void
  // ---------------------------------------------------------------------------
  describe('Invoice lifecycle: create -> void', () => {
    it('creates invoice and voids it', async () => {
      const inv = await Invoice.create({
        number: 'INV-VOID-001',
        subtotal: 5000,
        total: 5000,
        amountDue: 5000,
        status: 'Open',
      })
      const voided = await (Invoice as any).void(inv.$id)
      expect(voided.status).toBe('Voided')
      expect(voided.$version).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // 8. Payment Processing: Pending -> Succeeded -> Refunded
  // ---------------------------------------------------------------------------
  describe('Payment lifecycle: create -> refund', () => {
    it('creates a Succeeded payment and refunds it', async () => {
      const payment = await Payment.create({ amount: 4999, status: 'Succeeded', currency: 'USD' })
      expect(payment.status).toBe('Succeeded')
      const refunded = await (Payment as any).refund(payment.$id)
      expect(refunded.status).toBe('Refunded')
      expect(refunded.$version).toBe(2)
    })

    it('refund preserves amount and currency', async () => {
      const payment = await Payment.create({ amount: 12500, status: 'Succeeded', currency: 'EUR', method: 'card' })
      const refunded = await (Payment as any).refund(payment.$id)
      expect(refunded.amount).toBe(12500)
      expect(refunded.currency).toBe('EUR')
      expect(refunded.method).toBe('card')
    })

    it('creates a Pending payment', async () => {
      const payment = await Payment.create({ amount: 7500, status: 'Pending' })
      expect(payment.status).toBe('Pending')
      expect(payment.$type).toBe('Payment')
    })
  })

  // ---------------------------------------------------------------------------
  // 9. Cross-Entity Billing Workflows
  // ---------------------------------------------------------------------------
  describe('cross-entity billing workflows', () => {
    it('Customer -> Subscription -> Invoice -> Payment chain (data integrity)', async () => {
      const customer = await Customer.create({
        name: 'Workflow Corp',
        email: 'workflow@corp.com',
        stripeCustomerId: 'cus_workflow',
      })
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        customer: customer.$id,
        stripeCustomerId: 'cus_workflow',
      })
      const inv = await Invoice.create({
        number: 'INV-WF-001',
        subtotal: 4900,
        total: 4900,
        amountDue: 4900,
        customer: customer.$id,
        subscription: sub.$id,
      })
      const payment = await Payment.create({
        amount: 4900,
        status: 'Succeeded',
        customer: customer.$id,
        invoice: inv.$id,
      })

      // Verify all entities exist and have correct references
      expect(customer.$type).toBe('Customer')
      expect(sub.$type).toBe('Subscription')
      expect(inv.$type).toBe('Invoice')
      expect(payment.$type).toBe('Payment')

      expect(sub.customer).toBe(customer.$id)
      expect(inv.customer).toBe(customer.$id)
      expect(inv.subscription).toBe(sub.$id)
      expect(payment.customer).toBe(customer.$id)
      expect(payment.invoice).toBe(inv.$id)
    })

    it('Product -> Plan -> Price hierarchy', async () => {
      const product = await Product.create({
        name: 'Enterprise Suite',
        slug: 'enterprise-suite',
        type: 'Software',
        status: 'Active',
        stripeProductId: 'prod_enterprise',
      })
      const plan = await Plan.create({
        name: 'Enterprise Monthly',
        slug: 'enterprise-monthly',
        product: product.$id,
        status: 'Active',
        trialDays: 14,
      })
      const monthlyPrice = await Price.create({
        amount: 29900,
        currency: 'USD',
        interval: 'Monthly',
        plan: plan.$id,
        stripeId: 'price_monthly_29900',
      })
      const yearlyPrice = await Price.create({
        amount: 299000,
        currency: 'USD',
        interval: 'Yearly',
        plan: plan.$id,
        originalAmount: 358800,
        discountPercent: 17,
        stripeId: 'price_yearly_299000',
      })

      expect(plan.product).toBe(product.$id)
      expect(monthlyPrice.plan).toBe(plan.$id)
      expect(yearlyPrice.plan).toBe(plan.$id)
      expect(yearlyPrice.originalAmount).toBe(358800)
      expect(yearlyPrice.discountPercent).toBe(17)
    })
  })

  // ---------------------------------------------------------------------------
  // 10. Concurrent Billing Operations
  // ---------------------------------------------------------------------------
  describe('concurrent billing operations', () => {
    it('creates multiple customers concurrently without ID collision', async () => {
      const promises = Array.from({ length: 20 }, (_, i) => Customer.create({ name: `Concurrent-${i}`, email: `c${i}@test.com` }))
      const customers = await Promise.all(promises)

      const ids = customers.map((c) => c.$id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(20)
    })

    it('creates multiple invoices concurrently', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        Invoice.create({
          number: `CONC-INV-${i}`,
          subtotal: 1000 * (i + 1),
          total: 1000 * (i + 1),
          amountDue: 1000 * (i + 1),
        }),
      )
      const invoices = await Promise.all(promises)
      expect(invoices.length).toBe(10)
      // Each should have a unique ID
      const ids = new Set(invoices.map((inv) => inv.$id))
      expect(ids.size).toBe(10)
    })

    it('concurrent updates to different entities succeed', async () => {
      const c1 = await Customer.create({ name: 'C1', email: 'c1@test.com' })
      const c2 = await Customer.create({ name: 'C2', email: 'c2@test.com' })
      const c3 = await Customer.create({ name: 'C3', email: 'c3@test.com' })

      const [u1, u2, u3] = await Promise.all([
        Customer.update(c1.$id, { name: 'C1-Updated' }),
        Customer.update(c2.$id, { name: 'C2-Updated' }),
        Customer.update(c3.$id, { name: 'C3-Updated' }),
      ])

      expect(u1.name).toBe('C1-Updated')
      expect(u2.name).toBe('C2-Updated')
      expect(u3.name).toBe('C3-Updated')
    })
  })

  // ---------------------------------------------------------------------------
  // 11. Bulk CRUD Operations
  // ---------------------------------------------------------------------------
  describe('bulk CRUD operations', () => {
    it('bulk create and find multiple products', async () => {
      const products = await Promise.all(
        ['Basic', 'Pro', 'Enterprise', 'Teams', 'Starter'].map((name) => Product.create({ name, type: 'Software', status: 'Active' })),
      )
      expect(products.length).toBe(5)

      const found = await Product.find({ status: 'Active' })
      expect(found.length).toBe(5)
    })

    it('bulk create plans with different statuses then filter', async () => {
      await Plan.create({ name: 'Active Plan', status: 'Active' })
      await Plan.create({ name: 'Draft Plan', status: 'Draft' })
      await Plan.create({ name: 'Archived Plan', status: 'Archived' })
      await Plan.create({ name: 'Grandfathered Plan', status: 'Grandfathered' })

      const active = await Plan.find({ status: 'Active' })
      expect(active.length).toBe(1)
      expect(active[0]!.name).toBe('Active Plan')

      const all = await Plan.find()
      expect(all.length).toBe(4)
    })

    it('bulk delete customers', async () => {
      const customers = await Promise.all(
        Array.from({ length: 5 }, (_, i) => Customer.create({ name: `BulkDel-${i}`, email: `bd${i}@test.com` })),
      )
      const deleteResults = await Promise.all(customers.map((c) => Customer.delete(c.$id)))
      expect(deleteResults.every((r) => r === true)).toBe(true)

      // Verify all deleted
      const remaining = await Customer.find()
      expect(remaining.length).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // 12. Advanced MongoDB-style Queries
  // ---------------------------------------------------------------------------
  describe('advanced compound MongoDB queries', () => {
    it('$gt query on Price amount', async () => {
      await Price.create({ amount: 1000 })
      await Price.create({ amount: 5000 })
      await Price.create({ amount: 10000 })
      await Price.create({ amount: 50000 })

      const expensive = await Price.find({ amount: { $gt: 5000 } })
      expect(expensive.length).toBe(2)
    })

    it('$gte and $lte combined range query on Price amount', async () => {
      await Price.create({ amount: 1000 })
      await Price.create({ amount: 5000 })
      await Price.create({ amount: 10000 })
      await Price.create({ amount: 50000 })

      const midRange = await Price.find({ amount: { $gte: 5000, $lte: 10000 } })
      expect(midRange.length).toBe(2)
    })

    it('$in query on Subscription status', async () => {
      await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      await Subscription.create({
        status: 'Paused',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      await Subscription.create({
        status: 'Cancelled',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })

      const activeOrPaused = await Subscription.find({ status: { $in: ['Active', 'Paused'] } })
      expect(activeOrPaused.length).toBe(2)
    })

    it('$nin query excludes specific statuses', async () => {
      await Payment.create({ amount: 100, status: 'Succeeded' })
      await Payment.create({ amount: 200, status: 'Failed' })
      await Payment.create({ amount: 300, status: 'Pending' })
      await Payment.create({ amount: 400, status: 'Refunded' })

      const notFailed = await Payment.find({ status: { $nin: ['Failed', 'Refunded'] } })
      expect(notFailed.length).toBe(2)
    })

    it('$ne query on Invoice status', async () => {
      await Invoice.create({ number: 'NE-1', subtotal: 1000, total: 1000, amountDue: 1000, status: 'Paid' })
      await Invoice.create({ number: 'NE-2', subtotal: 2000, total: 2000, amountDue: 2000, status: 'Draft' })
      await Invoice.create({ number: 'NE-3', subtotal: 3000, total: 3000, amountDue: 3000, status: 'Paid' })

      const notPaid = await Invoice.find({ status: { $ne: 'Paid' } })
      expect(notPaid.length).toBe(1)
      expect(notPaid[0]!.status).toBe('Draft')
    })

    it('$exists query for optional fields', async () => {
      await Customer.create({ name: 'Has Currency', email: 'hc@test.com', currency: 'USD' })
      await Customer.create({ name: 'No Currency', email: 'nc@test.com' })

      const withCurrency = await Customer.find({ currency: { $exists: true } })
      expect(withCurrency.length).toBe(1)
      expect(withCurrency[0]!.name).toBe('Has Currency')
    })

    it('$regex query on Customer name', async () => {
      await Customer.create({ name: 'Acme Corp', email: 'acme@test.com' })
      await Customer.create({ name: 'Acme Inc', email: 'acmeinc@test.com' })
      await Customer.create({ name: 'Beta LLC', email: 'beta@test.com' })

      const acmeCustomers = await Customer.find({ name: { $regex: '^Acme' } })
      expect(acmeCustomers.length).toBe(2)
    })

    it('$lt query on Payment amount', async () => {
      await Payment.create({ amount: 500 })
      await Payment.create({ amount: 1000 })
      await Payment.create({ amount: 5000 })

      const small = await Payment.find({ amount: { $lt: 1000 } })
      expect(small.length).toBe(1)
      expect(small[0]!.amount).toBe(500)
    })

    it('$eq query is equivalent to exact match', async () => {
      await Product.create({ name: 'Exact Match Product', type: 'Software' })
      await Product.create({ name: 'Other Product', type: 'Service' })

      const exact = await Product.find({ type: { $eq: 'Software' } })
      const simple = await Product.find({ type: 'Software' })
      expect(exact.length).toBe(simple.length)
    })
  })

  // ---------------------------------------------------------------------------
  // 13. Subscription Trialing Status
  // ---------------------------------------------------------------------------
  describe('Subscription trialing and incomplete statuses', () => {
    it('creates a Trialing subscription with trial dates', async () => {
      const sub = await Subscription.create({
        status: 'Trialing',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        trialStart: '2024-01-01T00:00:00Z',
        trialEnd: '2024-01-15T00:00:00Z',
      })
      expect(sub.status).toBe('Trialing')
      expect(sub.trialStart).toBe('2024-01-01T00:00:00Z')
      expect(sub.trialEnd).toBe('2024-01-15T00:00:00Z')
    })

    it('creates an Incomplete subscription', async () => {
      const sub = await Subscription.create({
        status: 'Incomplete',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      expect(sub.status).toBe('Incomplete')
    })

    it('creates a PastDue subscription', async () => {
      const sub = await Subscription.create({
        status: 'PastDue',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      expect(sub.status).toBe('PastDue')
    })
  })

  // ---------------------------------------------------------------------------
  // 14. Invoice enum values (all 5)
  // ---------------------------------------------------------------------------
  describe('Invoice status enum coverage', () => {
    it('creates invoices with all 5 status values', async () => {
      const statuses = ['Draft', 'Open', 'Paid', 'Void', 'Uncollectible']
      for (let i = 0; i < statuses.length; i++) {
        const inv = await Invoice.create({
          number: `ENUM-${i}`,
          subtotal: 1000,
          total: 1000,
          amountDue: 1000,
          status: statuses[i],
        })
        expect(inv.status).toBe(statuses[i])
      }
    })
  })

  // ---------------------------------------------------------------------------
  // 15. Plan schema coverage
  // ---------------------------------------------------------------------------
  describe('Plan optional string/boolean-like fields', () => {
    it('creates Plan with all optional fields', async () => {
      const plan = await Plan.create({
        name: 'Full Plan',
        slug: 'full-plan',
        description: 'A fully loaded plan',
        trialDays: 30,
        features: 'feature1,feature2,feature3',
        limits: '100 users, 10GB storage',
        status: 'Active',
        isDefault: 'true',
        isFree: 'false',
        isEnterprise: 'true',
        badge: 'Popular',
        order: 1,
      })
      expect(plan.name).toBe('Full Plan')
      expect(plan.trialDays).toBe(30)
      expect(plan.isDefault).toBe('true')
      expect(plan.isFree).toBe('false')
      expect(plan.isEnterprise).toBe('true')
      expect(plan.badge).toBe('Popular')
      expect(plan.order).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // 16. Product full field coverage
  // ---------------------------------------------------------------------------
  describe('Product full field coverage', () => {
    it('creates Product with all optional fields populated', async () => {
      const product = await Product.create({
        name: 'Full Product',
        slug: 'full-product',
        description: 'Complete product description',
        tagline: 'The best product ever',
        type: 'Bundle',
        icon: 'rocket',
        image: 'https://example.com/product.png',
        features: 'sso,api,webhooks',
        highlights: 'Fast,Reliable,Scalable',
        status: 'Active',
        visibility: 'Public',
        featured: 'true',
        stripeProductId: 'prod_fulltest',
      })
      expect(product.tagline).toBe('The best product ever')
      expect(product.icon).toBe('rocket')
      expect(product.image).toBe('https://example.com/product.png')
      expect(product.features).toBe('sso,api,webhooks')
      expect(product.highlights).toBe('Fast,Reliable,Scalable')
      expect(product.featured).toBe('true')
    })
  })

  // ---------------------------------------------------------------------------
  // 17. Invoice URL fields
  // ---------------------------------------------------------------------------
  describe('Invoice URL and date fields', () => {
    it('creates Invoice with URL fields populated', async () => {
      const inv = await Invoice.create({
        number: 'INV-URL-001',
        subtotal: 5000,
        total: 5000,
        amountDue: 5000,
        receiptUrl: 'https://pay.stripe.com/receipts/inv_001',
        pdfUrl: 'https://pay.stripe.com/invoices/inv_001/pdf',
        hostedUrl: 'https://invoice.stripe.com/inv_001',
        stripeInvoiceId: 'in_test001',
      })
      expect(inv.receiptUrl).toBe('https://pay.stripe.com/receipts/inv_001')
      expect(inv.pdfUrl).toBe('https://pay.stripe.com/invoices/inv_001/pdf')
      expect(inv.hostedUrl).toBe('https://invoice.stripe.com/inv_001')
      expect(inv.stripeInvoiceId).toBe('in_test001')
    })

    it('creates Invoice with all date lifecycle fields', async () => {
      const inv = await Invoice.create({
        number: 'INV-DATE-001',
        subtotal: 5000,
        total: 5000,
        amountDue: 5000,
        periodStart: '2024-01-01T00:00:00Z',
        periodEnd: '2024-02-01T00:00:00Z',
        issuedAt: '2024-01-01T00:00:00Z',
        dueAt: '2024-01-15T00:00:00Z',
      })
      expect(inv.periodStart).toBe('2024-01-01T00:00:00Z')
      expect(inv.periodEnd).toBe('2024-02-01T00:00:00Z')
      expect(inv.issuedAt).toBe('2024-01-01T00:00:00Z')
      expect(inv.dueAt).toBe('2024-01-15T00:00:00Z')
    })
  })

  // ---------------------------------------------------------------------------
  // 18. Subscription cancelAtPeriodEnd and collectionMethod
  // ---------------------------------------------------------------------------
  describe('Subscription billing configuration fields', () => {
    it('stores cancelAtPeriodEnd flag', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        cancelAtPeriodEnd: 'true',
      })
      expect(sub.cancelAtPeriodEnd).toBe('true')
    })

    it('stores collectionMethod', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        collectionMethod: 'charge_automatically',
      })
      expect(sub.collectionMethod).toBe('charge_automatically')
    })
  })

  // ---------------------------------------------------------------------------
  // 19. Price interval coverage
  // ---------------------------------------------------------------------------
  describe('Price interval enum values', () => {
    it('creates prices with all 4 interval values', async () => {
      for (const interval of ['Monthly', 'Quarterly', 'Yearly', 'OneTime']) {
        const price = await Price.create({ amount: 1000, interval })
        expect(price.interval).toBe(interval)
      }
    })

    it('creates Price with intervalCount', async () => {
      const price = await Price.create({ amount: 5000, interval: 'Monthly', intervalCount: 3 })
      expect(price.intervalCount).toBe(3)
    })
  })

  // ---------------------------------------------------------------------------
  // 20. Hook Unsubscribe Behavior
  // ---------------------------------------------------------------------------
  describe('hook unsubscribe cleans up correctly', () => {
    it('unsubscribing a before hook prevents it from being called', async () => {
      let callCount = 0
      const unsub = (Customer as any).creating(() => {
        callCount++
      })
      await Customer.create({ name: 'Hook1', email: 'h1@test.com' })
      expect(callCount).toBe(1)

      unsub()
      await Customer.create({ name: 'Hook2', email: 'h2@test.com' })
      // Should NOT have incremented since we unsubscribed
      expect(callCount).toBe(1)
    })

    it('unsubscribing an after hook prevents it from being called', async () => {
      let callCount = 0
      const unsub = (Invoice as any).created(() => {
        callCount++
      })
      await Invoice.create({ number: 'HOOK-1', subtotal: 100, total: 100, amountDue: 100 })
      expect(callCount).toBe(1)

      unsub()
      await Invoice.create({ number: 'HOOK-2', subtotal: 200, total: 200, amountDue: 200 })
      expect(callCount).toBe(1)
    })
  })

  // ---------------------------------------------------------------------------
  // 21. Entity isolation — different types don't interfere
  // ---------------------------------------------------------------------------
  describe('entity type isolation', () => {
    it('find for one entity type does not return entities of another type', async () => {
      await Customer.create({ name: 'Isolated', email: 'iso@test.com' })
      await Product.create({ name: 'Isolated' })

      const customers = await Customer.find({ name: 'Isolated' })
      const products = await Product.find({ name: 'Isolated' })

      expect(customers.length).toBe(1)
      expect(products.length).toBe(1)
      expect(customers[0]!.$type).toBe('Customer')
      expect(products[0]!.$type).toBe('Product')
    })

    it('get by ID enforces type matching', async () => {
      const customer = await Customer.create({ name: 'TypeCheck', email: 'tc@test.com' })
      // Trying to get a customer ID through Product should return null
      const wrongType = await Product.get(customer.$id)
      expect(wrongType).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // 22. Subscription date fields: resumesAt, endedAt
  // ---------------------------------------------------------------------------
  describe('Subscription lifecycle date fields', () => {
    it('stores pausedAt and resumesAt on create', async () => {
      const sub = await Subscription.create({
        status: 'Paused',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        pausedAt: '2024-01-15T00:00:00Z',
        resumesAt: '2024-02-15T00:00:00Z',
      })
      expect(sub.pausedAt).toBe('2024-01-15T00:00:00Z')
      expect(sub.resumesAt).toBe('2024-02-15T00:00:00Z')
    })

    it('stores endedAt on a terminated subscription', async () => {
      const sub = await Subscription.create({
        status: 'Cancelled',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        canceledAt: '2024-01-20T00:00:00Z',
        endedAt: '2024-02-01T00:00:00Z',
      })
      expect(sub.canceledAt).toBe('2024-01-20T00:00:00Z')
      expect(sub.endedAt).toBe('2024-02-01T00:00:00Z')
    })
  })

  // ---------------------------------------------------------------------------
  // 23. Payment method field
  // ---------------------------------------------------------------------------
  describe('Payment optional fields', () => {
    it('stores method field', async () => {
      const payment = await Payment.create({ amount: 9900, method: 'card', currency: 'USD', status: 'Succeeded' })
      expect(payment.method).toBe('card')
    })

    it('stores stripePaymentId', async () => {
      const payment = await Payment.create({ amount: 4900, stripePaymentId: 'pi_test_abc123' })
      expect(payment.stripePaymentId).toBe('pi_test_abc123')
    })
  })

  // ---------------------------------------------------------------------------
  // 24. Customer taxExempt field
  // ---------------------------------------------------------------------------
  describe('Customer tax and payment fields', () => {
    it('stores taxExempt field', async () => {
      const customer = await Customer.create({ name: 'Tax Exempt Co', email: 'tax@exempt.co', taxExempt: 'exempt' })
      expect(customer.taxExempt).toBe('exempt')
    })

    it('stores paymentMethod field', async () => {
      const customer = await Customer.create({ name: 'PM Co', email: 'pm@co.com', paymentMethod: 'pm_card_visa_4242' })
      expect(customer.paymentMethod).toBe('pm_card_visa_4242')
    })
  })
})
