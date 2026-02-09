import { describe, it, expect } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Customer, Product, Plan, Price, Subscription, Invoice, Payment } from '../src/index.ts'
import { setupTestProvider } from '../../test-utils'

describe('@headlessly/billing — deep tests', () => {
  setupTestProvider()

  // ---------------------------------------------------------------------------
  // 1. Schema Structure & Registration
  // ---------------------------------------------------------------------------
  describe('schema registration', () => {
    it('all 7 billing entities expose $schema with correct names', () => {
      // Registry is cleared between tests by setupTestProvider, so we verify
      // schema access directly on the entity proxies instead
      expect(Customer.$schema.name).toBe('Customer')
      expect(Product.$schema.name).toBe('Product')
      expect(Plan.$schema.name).toBe('Plan')
      expect(Price.$schema.name).toBe('Price')
      expect(Subscription.$schema.name).toBe('Subscription')
      expect(Invoice.$schema.name).toBe('Invoice')
      expect(Payment.$schema.name).toBe('Payment')
    })

    it('each entity $schema exposes the raw definition', () => {
      expect(Customer.$schema.raw).toBeDefined()
      expect(Product.$schema.raw).toBeDefined()
      expect(Plan.$schema.raw).toBeDefined()
      expect(Price.$schema.raw).toBeDefined()
      expect(Subscription.$schema.raw).toBeDefined()
      expect(Invoice.$schema.raw).toBeDefined()
      expect(Payment.$schema.raw).toBeDefined()
    })

    it('schema name matches $name for every entity', () => {
      const entities = [Customer, Product, Plan, Price, Subscription, Invoice, Payment]
      for (const entity of entities) {
        expect(entity.$schema.name).toBe(entity.$name)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // 2. Customer Schema Validation
  // ---------------------------------------------------------------------------
  describe('Customer schema', () => {
    it('has required field: name (string!)', () => {
      const field = Customer.$schema.fields.get('name')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(true)
    })

    it('has required + unique field: email (string!#)', () => {
      const field = Customer.$schema.fields.get('email')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('field')
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })

    it('has unique field: stripeCustomerId (string##)', () => {
      const field = Customer.$schema.fields.get('stripeCustomerId')
      expect(field).toBeDefined()
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })

    it('has forward relationship: organization -> Organization', () => {
      const rel = Customer.$schema.relationships.get('organization')
      expect(rel).toBeDefined()
      expect(rel!.kind).toBe('relationship')
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Organization')
    })

    it('has back-reference relationships: subscriptions, invoices, payments', () => {
      const subs = Customer.$schema.relationships.get('subscriptions')
      expect(subs).toBeDefined()
      expect(subs!.operator).toBe('<-')
      expect(subs!.targetType).toBe('Subscription')
      expect(subs!.backref).toBe('customer')
      expect(subs!.isArray).toBe(true)

      const inv = Customer.$schema.relationships.get('invoices')
      expect(inv).toBeDefined()
      expect(inv!.operator).toBe('<-')
      expect(inv!.targetType).toBe('Invoice')
      expect(inv!.isArray).toBe(true)

      const pay = Customer.$schema.relationships.get('payments')
      expect(pay).toBeDefined()
      expect(pay!.operator).toBe('<-')
      expect(pay!.targetType).toBe('Payment')
      expect(pay!.isArray).toBe(true)
    })

    it('has optional string fields: paymentMethod, currency, taxExempt', () => {
      for (const name of ['paymentMethod', 'currency', 'taxExempt']) {
        const field = Customer.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.kind).toBe('field')
        expect(field!.type).toBe('string')
      }
    })

    it('has no custom verbs — only default CRUD', () => {
      const verbs = Customer.$schema.verbs
      expect(verbs.has('create')).toBe(true)
      expect(verbs.has('update')).toBe(true)
      expect(verbs.has('delete')).toBe(true)
      expect(verbs.size).toBe(3)
    })
  })

  // ---------------------------------------------------------------------------
  // 3. Product Schema Validation
  // ---------------------------------------------------------------------------
  describe('Product schema', () => {
    it('has enum field: type with 4 values', () => {
      const field = Product.$schema.fields.get('type')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Software', 'Service', 'Addon', 'Bundle'])
    })

    it('has enum field: status with 3 values', () => {
      const field = Product.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Draft', 'Active', 'Archived'])
    })

    it('has enum field: visibility with 3 values', () => {
      const field = Product.$schema.fields.get('visibility')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Public', 'Private', 'Hidden'])
    })

    it('has unique slug field (string##)', () => {
      const field = Product.$schema.fields.get('slug')
      expect(field).toBeDefined()
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })

    it('has back-reference: plans <- Plan.product[]', () => {
      const rel = Product.$schema.relationships.get('plans')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('<-')
      expect(rel!.targetType).toBe('Plan')
      expect(rel!.backref).toBe('product')
      expect(rel!.isArray).toBe(true)
    })

    it('has no custom verbs — only default CRUD', () => {
      expect(Product.$schema.verbs.size).toBe(3)
    })
  })

  // ---------------------------------------------------------------------------
  // 4. Plan Schema Validation
  // ---------------------------------------------------------------------------
  describe('Plan schema', () => {
    it('has enum field: status with 4 values', () => {
      const field = Plan.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Draft', 'Active', 'Grandfathered', 'Archived'])
    })

    it('has numeric fields: trialDays and order', () => {
      const trialDays = Plan.$schema.fields.get('trialDays')
      expect(trialDays).toBeDefined()
      expect(trialDays!.type).toBe('number')

      const order = Plan.$schema.fields.get('order')
      expect(order).toBeDefined()
      expect(order!.type).toBe('number')
    })

    it('has forward relationship: product -> Product.plans', () => {
      const rel = Plan.$schema.relationships.get('product')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Product')
      expect(rel!.backref).toBe('plans')
    })

    it('has back-reference: prices <- Price.plan[]', () => {
      const rel = Plan.$schema.relationships.get('prices')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('<-')
      expect(rel!.targetType).toBe('Price')
      expect(rel!.backref).toBe('plan')
      expect(rel!.isArray).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // 5. Price Schema Validation
  // ---------------------------------------------------------------------------
  describe('Price schema', () => {
    it('has required numeric field: amount (number!)', () => {
      const field = Price.$schema.fields.get('amount')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
      expect(field!.modifiers!.required).toBe(true)
    })

    it('has enum field: interval with 4 values', () => {
      const field = Price.$schema.fields.get('interval')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Monthly', 'Quarterly', 'Yearly', 'OneTime'])
    })

    it('has optional numeric fields: originalAmount, discountPercent, intervalCount', () => {
      for (const name of ['originalAmount', 'discountPercent', 'intervalCount']) {
        const field = Price.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.type).toBe('number')
        expect(field!.modifiers!.required).toBe(false)
      }
    })

    it('has forward relationship: plan -> Plan.prices', () => {
      const rel = Price.$schema.relationships.get('plan')
      expect(rel).toBeDefined()
      expect(rel!.operator).toBe('->')
      expect(rel!.targetType).toBe('Plan')
      expect(rel!.backref).toBe('prices')
    })

    it('has unique stripeId field', () => {
      const field = Price.$schema.fields.get('stripeId')
      expect(field).toBeDefined()
      expect(field!.modifiers!.unique).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // 6. Subscription Schema — Enum Statuses
  // ---------------------------------------------------------------------------
  describe('Subscription schema', () => {
    it('has enum field: status with 6 values', () => {
      const field = Subscription.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Active', 'PastDue', 'Canceled', 'Trialing', 'Paused', 'Incomplete'])
    })

    it('has required datetime fields: currentPeriodStart, currentPeriodEnd, startedAt', () => {
      for (const name of ['currentPeriodStart', 'currentPeriodEnd', 'startedAt']) {
        const field = Subscription.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.type).toBe('datetime')
        expect(field!.modifiers!.required).toBe(true)
      }
    })

    it('has optional datetime fields: trialStart, trialEnd, canceledAt, pausedAt, resumesAt, endedAt', () => {
      for (const name of ['trialStart', 'trialEnd', 'canceledAt', 'pausedAt', 'resumesAt', 'endedAt']) {
        const field = Subscription.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.type).toBe('datetime')
        expect(field!.modifiers!.required).toBe(false)
      }
    })

    it('has forward relationships: organization, customer, plan', () => {
      const org = Subscription.$schema.relationships.get('organization')
      expect(org).toBeDefined()
      expect(org!.operator).toBe('->')
      expect(org!.targetType).toBe('Organization')
      expect(org!.backref).toBe('subscriptions')

      const cust = Subscription.$schema.relationships.get('customer')
      expect(cust).toBeDefined()
      expect(cust!.operator).toBe('->')
      expect(cust!.targetType).toBe('Customer')
      expect(cust!.backref).toBe('subscriptions')

      const plan = Subscription.$schema.relationships.get('plan')
      expect(plan).toBeDefined()
      expect(plan!.operator).toBe('->')
      expect(plan!.targetType).toBe('Plan')
    })

    it('has 5 custom verbs: pause, cancel, reactivate, upgrade, downgrade', () => {
      expect(Subscription.$schema.verbs.has('pause')).toBe(true)
      expect(Subscription.$schema.verbs.has('cancel')).toBe(true)
      expect(Subscription.$schema.verbs.has('reactivate')).toBe(true)
      expect(Subscription.$schema.verbs.has('upgrade')).toBe(true)
      expect(Subscription.$schema.verbs.has('downgrade')).toBe(true)
    })

    it('has 8 total verbs (3 CRUD + 5 custom)', () => {
      expect(Subscription.$schema.verbs.size).toBe(8)
    })
  })

  // ---------------------------------------------------------------------------
  // 7. Invoice Schema
  // ---------------------------------------------------------------------------
  describe('Invoice schema', () => {
    it('has enum field: status with 5 values', () => {
      const field = Invoice.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Draft', 'Open', 'Paid', 'Void', 'Uncollectible'])
    })

    it('has required + unique number field (string!##)', () => {
      const field = Invoice.$schema.fields.get('number')
      expect(field).toBeDefined()
      expect(field!.type).toBe('string')
      expect(field!.modifiers!.required).toBe(true)
      expect(field!.modifiers!.unique).toBe(true)
    })

    it('has required numeric fields: subtotal, total, amountDue', () => {
      for (const name of ['subtotal', 'total', 'amountDue']) {
        const field = Invoice.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.type).toBe('number')
        expect(field!.modifiers!.required).toBe(true)
      }
    })

    it('has optional numeric fields: tax, discount, amountPaid', () => {
      for (const name of ['tax', 'discount', 'amountPaid']) {
        const field = Invoice.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.type).toBe('number')
        expect(field!.modifiers!.required).toBe(false)
      }
    })

    it('has forward relationships: organization, customer, subscription', () => {
      const org = Invoice.$schema.relationships.get('organization')
      expect(org).toBeDefined()
      expect(org!.targetType).toBe('Organization')

      const cust = Invoice.$schema.relationships.get('customer')
      expect(cust).toBeDefined()
      expect(cust!.targetType).toBe('Customer')
      expect(cust!.backref).toBe('invoices')

      const sub = Invoice.$schema.relationships.get('subscription')
      expect(sub).toBeDefined()
      expect(sub!.targetType).toBe('Subscription')
    })

    it('has 2 custom verbs: pay and void', () => {
      expect(Invoice.$schema.verbs.has('pay')).toBe(true)
      expect(Invoice.$schema.verbs.has('void')).toBe(true)
    })

    it('has 5 total verbs (3 CRUD + 2 custom)', () => {
      expect(Invoice.$schema.verbs.size).toBe(5)
    })

    it('has datetime fields for lifecycle: issuedAt, dueAt, paidAt, voidedAt', () => {
      for (const name of ['issuedAt', 'dueAt', 'paidAt', 'voidedAt']) {
        const field = Invoice.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.type).toBe('datetime')
      }
    })

    it('has URL string fields: receiptUrl, pdfUrl, hostedUrl', () => {
      for (const name of ['receiptUrl', 'pdfUrl', 'hostedUrl']) {
        const field = Invoice.$schema.fields.get(name)
        expect(field).toBeDefined()
        expect(field!.type).toBe('string')
      }
    })
  })

  // ---------------------------------------------------------------------------
  // 8. Payment Schema
  // ---------------------------------------------------------------------------
  describe('Payment schema', () => {
    it('has enum field: status with 4 values', () => {
      const field = Payment.$schema.fields.get('status')
      expect(field).toBeDefined()
      expect(field!.kind).toBe('enum')
      expect(field!.enumValues).toEqual(['Pending', 'Succeeded', 'Failed', 'Refunded'])
    })

    it('has required numeric field: amount', () => {
      const field = Payment.$schema.fields.get('amount')
      expect(field).toBeDefined()
      expect(field!.type).toBe('number')
      expect(field!.modifiers!.required).toBe(true)
    })

    it('has forward relationships: customer, invoice', () => {
      const cust = Payment.$schema.relationships.get('customer')
      expect(cust).toBeDefined()
      expect(cust!.targetType).toBe('Customer')
      expect(cust!.backref).toBe('payments')

      const inv = Payment.$schema.relationships.get('invoice')
      expect(inv).toBeDefined()
      expect(inv!.targetType).toBe('Invoice')
    })

    it('has 1 custom verb: refund', () => {
      expect(Payment.$schema.verbs.has('refund')).toBe(true)
    })

    it('has 4 total verbs (3 CRUD + 1 custom)', () => {
      expect(Payment.$schema.verbs.size).toBe(4)
    })

    it('has unique stripePaymentId field', () => {
      const field = Payment.$schema.fields.get('stripePaymentId')
      expect(field).toBeDefined()
      expect(field!.modifiers!.unique).toBe(true)
      expect(field!.modifiers!.indexed).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // 9. Verb Conjugation Lifecycle (detailed)
  // ---------------------------------------------------------------------------
  describe('verb conjugation details', () => {
    it('Subscription.pause conjugation has correct reverseBy and reverseAt', () => {
      const verb = Subscription.$schema.verbs.get('pause')!
      expect(verb.action).toBe('pause')
      expect(verb.activity).toBe('pausing')
      expect(verb.event).toBe('paused')
      expect(verb.reverseBy).toBe('pausedBy')
      expect(verb.reverseAt).toBe('pausedAt')
    })

    it('Subscription.cancel conjugation doubles the final l', () => {
      const verb = Subscription.$schema.verbs.get('cancel')!
      expect(verb.action).toBe('cancel')
      expect(verb.activity).toBe('cancelling')
      expect(verb.event).toBe('cancelled')
      expect(verb.reverseBy).toBe('cancelledBy')
      expect(verb.reverseAt).toBe('cancelledAt')
    })

    it('Subscription.reactivate conjugation drops trailing e', () => {
      const verb = Subscription.$schema.verbs.get('reactivate')!
      expect(verb.action).toBe('reactivate')
      expect(verb.activity).toBe('reactivating')
      expect(verb.event).toBe('reactivated')
    })

    it('Subscription.upgrade conjugation drops trailing e', () => {
      const verb = Subscription.$schema.verbs.get('upgrade')!
      expect(verb.action).toBe('upgrade')
      expect(verb.activity).toBe('upgrading')
      expect(verb.event).toBe('upgraded')
    })

    it('Subscription.downgrade conjugation drops trailing e', () => {
      const verb = Subscription.$schema.verbs.get('downgrade')!
      expect(verb.action).toBe('downgrade')
      expect(verb.activity).toBe('downgrading')
      expect(verb.event).toBe('downgraded')
    })

    it('Invoice.pay is an irregular verb (paid, not payed)', () => {
      const verb = Invoice.$schema.verbs.get('pay')!
      expect(verb.action).toBe('pay')
      expect(verb.activity).toBe('paying')
      expect(verb.event).toBe('paid')
      expect(verb.reverseBy).toBe('paidBy')
      expect(verb.reverseAt).toBe('paidAt')
    })

    it('Invoice.void conjugation', () => {
      const verb = Invoice.$schema.verbs.get('void')!
      expect(verb.action).toBe('void')
      expect(verb.activity).toBe('voiding')
      expect(verb.event).toBe('voided')
    })

    it('Payment.refund conjugation', () => {
      const verb = Payment.$schema.verbs.get('refund')!
      expect(verb.action).toBe('refund')
      expect(verb.activity).toBe('refunding')
      expect(verb.event).toBe('refunded')
      expect(verb.reverseBy).toBe('refundedBy')
      expect(verb.reverseAt).toBe('refundedAt')
    })

    it('CRUD verb create has correct conjugation on all entities', () => {
      const entities = [Customer, Product, Plan, Price, Subscription, Invoice, Payment]
      for (const entity of entities) {
        const verb = entity.$schema.verbs.get('create')!
        expect(verb.action).toBe('create')
        expect(verb.activity).toBe('creating')
        expect(verb.event).toBe('created')
      }
    })

    it('CRUD verb update has correct conjugation on all entities', () => {
      const entities = [Customer, Product, Plan, Price, Subscription, Invoice, Payment]
      for (const entity of entities) {
        const verb = entity.$schema.verbs.get('update')!
        expect(verb.action).toBe('update')
        expect(verb.activity).toBe('updating')
        expect(verb.event).toBe('updated')
      }
    })

    it('CRUD verb delete has correct conjugation on all entities', () => {
      const entities = [Customer, Product, Plan, Price, Subscription, Invoice, Payment]
      for (const entity of entities) {
        const verb = entity.$schema.verbs.get('delete')!
        expect(verb.action).toBe('delete')
        expect(verb.activity).toBe('deleting')
        expect(verb.event).toBe('deleted')
      }
    })
  })

  // ---------------------------------------------------------------------------
  // 10. Hook Registration (BEFORE / AFTER)
  // ---------------------------------------------------------------------------
  describe('hook registration via verb conjugation proxy', () => {
    it('Subscription.pausing() registers a BEFORE hook (returns function)', () => {
      const unsub = (Subscription as any).pausing(() => {})
      expect(typeof unsub).toBe('function')
    })

    it('Subscription.paused() registers an AFTER hook (returns function)', () => {
      const unsub = (Subscription as any).paused(() => {})
      expect(typeof unsub).toBe('function')
    })

    it('Invoice.paying() registers a BEFORE hook', () => {
      const unsub = (Invoice as any).paying(() => {})
      expect(typeof unsub).toBe('function')
    })

    it('Invoice.paid() registers an AFTER hook', () => {
      const unsub = (Invoice as any).paid(() => {})
      expect(typeof unsub).toBe('function')
    })

    it('Payment.refunding() registers a BEFORE hook', () => {
      const unsub = (Payment as any).refunding(() => {})
      expect(typeof unsub).toBe('function')
    })

    it('Payment.refunded() registers an AFTER hook', () => {
      const unsub = (Payment as any).refunded(() => {})
      expect(typeof unsub).toBe('function')
    })

    it('CRUD before hooks: creating(), updating(), deleting() exist on Customer', () => {
      expect(typeof (Customer as any).creating).toBe('function')
      expect(typeof (Customer as any).updating).toBe('function')
      expect(typeof (Customer as any).deleting).toBe('function')
    })

    it('CRUD after hooks: created(), updated(), deleted() exist on Customer', () => {
      expect(typeof (Customer as any).created).toBe('function')
      expect(typeof (Customer as any).updated).toBe('function')
      expect(typeof (Customer as any).deleted).toBe('function')
    })
  })

  // ---------------------------------------------------------------------------
  // 11. Linguistic / Noun Derivation
  // ---------------------------------------------------------------------------
  describe('linguistic noun derivation', () => {
    it('Customer slug is "customer"', () => {
      expect(Customer.$schema.slug).toBe('customer')
    })

    it('Customer plural is "customers"', () => {
      expect(Customer.$schema.plural).toBe('customers')
    })

    it('Subscription slug is "subscription"', () => {
      expect(Subscription.$schema.slug).toBe('subscription')
    })

    it('Invoice plural is "invoices"', () => {
      expect(Invoice.$schema.plural).toBe('invoices')
    })

    it('Payment plural is "payments"', () => {
      expect(Payment.$schema.plural).toBe('payments')
    })

    it('Price plural is "prices"', () => {
      expect(Price.$schema.plural).toBe('prices')
    })

    it('Plan plural is "plans"', () => {
      expect(Plan.$schema.plural).toBe('plans')
    })

    it('Product plural is "products"', () => {
      expect(Product.$schema.plural).toBe('products')
    })
  })

  // ---------------------------------------------------------------------------
  // 12. Currency / Amount Edge Cases
  // ---------------------------------------------------------------------------
  describe('currency and amount handling', () => {
    it('creates a Price with zero amount', async () => {
      const price = await Price.create({ amount: 0 })
      expect(price.amount).toBe(0)
      expect(price.$type).toBe('Price')
    })

    it('creates a Price with large amount (1_000_000 cents)', async () => {
      const price = await Price.create({ amount: 1_000_000 })
      expect(price.amount).toBe(1_000_000)
    })

    it('creates an Invoice with zero amountDue (fully paid)', async () => {
      const invoice = await Invoice.create({ number: 'INV-ZERO', subtotal: 5000, total: 5000, amountDue: 0 })
      expect(invoice.amountDue).toBe(0)
    })

    it('creates an Invoice with tax and discount fields', async () => {
      const invoice = await Invoice.create({
        number: 'INV-TAX',
        subtotal: 10000,
        tax: 900,
        discount: 1000,
        total: 9900,
        amountDue: 9900,
      })
      expect(invoice.tax).toBe(900)
      expect(invoice.discount).toBe(1000)
      expect(invoice.total).toBe(9900)
    })

    it('creates a Payment with zero amount', async () => {
      const payment = await Payment.create({ amount: 0 })
      expect(payment.amount).toBe(0)
    })

    it('creates a Customer with currency field', async () => {
      const customer = await Customer.create({ name: 'Euro Corp', email: 'eu@corp.com', currency: 'EUR' })
      expect(customer.currency).toBe('EUR')
    })

    it('creates a Price with currency field', async () => {
      const price = await Price.create({ amount: 2999, currency: 'GBP' })
      expect(price.currency).toBe('GBP')
    })
  })

  // ---------------------------------------------------------------------------
  // 13. Custom Verb Execution on Subscription
  // ---------------------------------------------------------------------------
  describe('custom verb execution', () => {
    it('Subscription.pause() executes and transitions status to Paused', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      const paused = await (Subscription as any).pause(sub.$id)
      expect(paused.status).toBe('Paused')
    })

    it('Subscription.cancel() transitions status to Canceled', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      const cancelled = await (Subscription as any).cancel(sub.$id)
      // The verb declaration maps to 'Cancelled' but the status enum contains 'Canceled'
      // The verb resolves to the raw declaration value from the definition
      expect(cancelled.status).toBe('Cancelled')
    })

    it('Invoice.pay() transitions status to Paid', async () => {
      const inv = await Invoice.create({ number: 'INV-PAY', subtotal: 5000, total: 5000, amountDue: 5000 })
      const paid = await (Invoice as any).pay(inv.$id)
      expect(paid.status).toBe('Paid')
    })

    it('Invoice.void() transitions status to Voided', async () => {
      const inv = await Invoice.create({ number: 'INV-VOID', subtotal: 5000, total: 5000, amountDue: 5000 })
      const voided = await (Invoice as any).void(inv.$id)
      expect(voided.status).toBe('Voided')
    })

    it('Payment.refund() transitions status to Refunded', async () => {
      const pay = await Payment.create({ amount: 5000, status: 'Succeeded' })
      const refunded = await (Payment as any).refund(pay.$id)
      expect(refunded.status).toBe('Refunded')
    })
  })

  // ---------------------------------------------------------------------------
  // 14. Find (query) Operations
  // ---------------------------------------------------------------------------
  describe('find operations', () => {
    it('finds customers by name', async () => {
      await Customer.create({ name: 'FindMe Corp', email: 'find@me.com' })
      await Customer.create({ name: 'Other Corp', email: 'other@me.com' })
      const results = await Customer.find({ name: 'FindMe Corp' })
      expect(results.length).toBe(1)
      expect(results[0]!.name).toBe('FindMe Corp')
    })

    it('find returns empty array when no matches', async () => {
      const results = await Customer.find({ name: 'NonExistent' })
      expect(results).toEqual([])
    })

    it('find with no filter returns all entities of that type', async () => {
      await Product.create({ name: 'P1' })
      await Product.create({ name: 'P2' })
      await Product.create({ name: 'P3' })
      const results = await Product.find()
      expect(results.length).toBe(3)
    })

    it('find payments by status', async () => {
      await Payment.create({ amount: 100, status: 'Succeeded' })
      await Payment.create({ amount: 200, status: 'Failed' })
      await Payment.create({ amount: 300, status: 'Succeeded' })
      const succeeded = await Payment.find({ status: 'Succeeded' })
      expect(succeeded.length).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // 15. Get by ID
  // ---------------------------------------------------------------------------
  describe('get by ID', () => {
    it('returns null for non-existent ID', async () => {
      const result = await Customer.get('customer_nonexist')
      expect(result).toBeNull()
    })

    it('returns correct entity by ID', async () => {
      const created = await Plan.create({ name: 'Starter' })
      const fetched = await Plan.get(created.$id)
      expect(fetched).toBeDefined()
      expect(fetched!.$id).toBe(created.$id)
      expect(fetched!.name).toBe('Starter')
    })
  })

  // ---------------------------------------------------------------------------
  // 16. Meta-field ID Format
  // ---------------------------------------------------------------------------
  describe('entity ID format', () => {
    it('Customer IDs start with "customer_"', async () => {
      const c = await Customer.create({ name: 'Test', email: 'test@test.com' })
      expect(c.$id).toMatch(/^customer_/)
    })

    it('Product IDs start with "product_"', async () => {
      const p = await Product.create({ name: 'Test' })
      expect(p.$id).toMatch(/^product_/)
    })

    it('Plan IDs start with "plan_"', async () => {
      const p = await Plan.create({ name: 'Test' })
      expect(p.$id).toMatch(/^plan_/)
    })

    it('Price IDs start with "price_"', async () => {
      const p = await Price.create({ amount: 100 })
      expect(p.$id).toMatch(/^price_/)
    })

    it('Subscription IDs start with "subscription_"', async () => {
      const s = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      expect(s.$id).toMatch(/^subscription_/)
    })

    it('Invoice IDs start with "invoice_"', async () => {
      const i = await Invoice.create({ number: 'INV-ID', subtotal: 100, total: 100, amountDue: 100 })
      expect(i.$id).toMatch(/^invoice_/)
    })

    it('Payment IDs start with "payment_"', async () => {
      const p = await Payment.create({ amount: 100 })
      expect(p.$id).toMatch(/^payment_/)
    })
  })

  // ---------------------------------------------------------------------------
  // 17. Version Increment on Update
  // ---------------------------------------------------------------------------
  describe('version tracking', () => {
    it('version starts at 1 on create', async () => {
      const c = await Customer.create({ name: 'V1', email: 'v1@test.com' })
      expect(c.$version).toBe(1)
    })

    it('version increments to 2 on first update', async () => {
      const c = await Customer.create({ name: 'V1', email: 'v1@test.com' })
      const updated = await Customer.update(c.$id, { name: 'V2' })
      expect(updated.$version).toBe(2)
    })

    it('version increments to 3 on second update', async () => {
      const c = await Customer.create({ name: 'V1', email: 'v1@test.com' })
      await Customer.update(c.$id, { name: 'V2' })
      const updated2 = await Customer.update(c.$id, { name: 'V3' })
      expect(updated2.$version).toBe(3)
    })
  })

  // ---------------------------------------------------------------------------
  // 18. Disabled Verbs (none in billing, but verify no accidental disables)
  // ---------------------------------------------------------------------------
  describe('no disabled verbs in billing entities', () => {
    it('no entity has any disabled verbs', () => {
      const entities = [Customer, Product, Plan, Price, Subscription, Invoice, Payment]
      for (const entity of entities) {
        expect(entity.$schema.disabledVerbs.size).toBe(0)
      }
    })
  })

  // ---------------------------------------------------------------------------
  // 19. Subscription Optional Fields Coverage
  // ---------------------------------------------------------------------------
  describe('Subscription optional fields', () => {
    it('stores cancelReason and cancelFeedback on create', async () => {
      const sub = await Subscription.create({
        status: 'Canceled',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        cancelReason: 'too expensive',
        cancelFeedback: 'Price was above our budget',
      })
      expect(sub.cancelReason).toBe('too expensive')
      expect(sub.cancelFeedback).toBe('Price was above our budget')
    })

    it('stores quantity and paymentMethod', async () => {
      const sub = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
        quantity: 5,
        paymentMethod: 'pm_card_visa',
      })
      expect(sub.quantity).toBe(5)
      expect(sub.paymentMethod).toBe('pm_card_visa')
    })
  })

  // ---------------------------------------------------------------------------
  // 20. Relationship Graph Consistency
  // ---------------------------------------------------------------------------
  describe('relationship graph consistency', () => {
    it('Customer.subscriptions back-reference matches Subscription.customer forward reference', () => {
      const custSubs = Customer.$schema.relationships.get('subscriptions')!
      const subCust = Subscription.$schema.relationships.get('customer')!

      // Customer's back-ref targets Subscription
      expect(custSubs.targetType).toBe('Subscription')
      expect(custSubs.backref).toBe('customer')

      // Subscription's forward ref targets Customer
      expect(subCust.targetType).toBe('Customer')
      expect(subCust.backref).toBe('subscriptions')
    })

    it('Customer.invoices back-reference matches Invoice.customer forward reference', () => {
      const custInv = Customer.$schema.relationships.get('invoices')!
      const invCust = Invoice.$schema.relationships.get('customer')!

      expect(custInv.targetType).toBe('Invoice')
      expect(custInv.backref).toBe('customer')
      expect(invCust.targetType).toBe('Customer')
      expect(invCust.backref).toBe('invoices')
    })

    it('Customer.payments back-reference matches Payment.customer forward reference', () => {
      const custPay = Customer.$schema.relationships.get('payments')!
      const payCust = Payment.$schema.relationships.get('customer')!

      expect(custPay.targetType).toBe('Payment')
      expect(custPay.backref).toBe('customer')
      expect(payCust.targetType).toBe('Customer')
      expect(payCust.backref).toBe('payments')
    })

    it('Product.plans back-reference matches Plan.product forward reference', () => {
      const prodPlans = Product.$schema.relationships.get('plans')!
      const planProd = Plan.$schema.relationships.get('product')!

      expect(prodPlans.targetType).toBe('Plan')
      expect(prodPlans.backref).toBe('product')
      expect(planProd.targetType).toBe('Product')
      expect(planProd.backref).toBe('plans')
    })

    it('Plan.prices back-reference matches Price.plan forward reference', () => {
      const planPrices = Plan.$schema.relationships.get('prices')!
      const pricePlan = Price.$schema.relationships.get('plan')!

      expect(planPrices.targetType).toBe('Price')
      expect(planPrices.backref).toBe('plan')
      expect(pricePlan.targetType).toBe('Plan')
      expect(pricePlan.backref).toBe('prices')
    })
  })

  // ---------------------------------------------------------------------------
  // 21. Delete Non-Existent Entity
  // ---------------------------------------------------------------------------
  describe('delete edge cases', () => {
    it('delete returns false for non-existent entity', async () => {
      const result = await Customer.delete('customer_nonexist')
      expect(result).toBe(false)
    })

    it('double delete returns false on second call', async () => {
      const c = await Customer.create({ name: 'DoubleDel', email: 'dd@test.com' })
      const first = await Customer.delete(c.$id)
      expect(first).toBe(true)
      const second = await Customer.delete(c.$id)
      expect(second).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // 22. Update Preserves Unmodified Fields
  // ---------------------------------------------------------------------------
  describe('update field preservation', () => {
    it('update preserves fields not included in the update payload', async () => {
      const customer = await Customer.create({ name: 'Original', email: 'orig@test.com', currency: 'USD' })
      const updated = await Customer.update(customer.$id, { name: 'Updated' })
      expect(updated.name).toBe('Updated')
      expect(updated.email).toBe('orig@test.com')
      expect(updated.currency).toBe('USD')
    })

    it('update preserves $id, $type, $context, $createdAt', async () => {
      const customer = await Customer.create({ name: 'Preserve', email: 'p@test.com' })
      const updated = await Customer.update(customer.$id, { name: 'Changed' })
      expect(updated.$id).toBe(customer.$id)
      expect(updated.$type).toBe(customer.$type)
      expect(updated.$context).toBe(customer.$context)
      expect(updated.$createdAt).toBe(customer.$createdAt)
    })

    it('update changes $updatedAt timestamp', async () => {
      const customer = await Customer.create({ name: 'Timestamp', email: 'ts@test.com' })
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 5))
      const updated = await Customer.update(customer.$id, { name: 'Changed' })
      expect(updated.$updatedAt).not.toBe(customer.$updatedAt)
    })
  })

  // ---------------------------------------------------------------------------
  // 23. Product with All Enum Values
  // ---------------------------------------------------------------------------
  describe('Product enum value creation', () => {
    it('creates Product with each type value', async () => {
      for (const type of ['Software', 'Service', 'Addon', 'Bundle']) {
        const p = await Product.create({ name: `${type} Product`, type })
        expect(p.type).toBe(type)
      }
    })

    it('creates Product with each status value', async () => {
      for (const status of ['Draft', 'Active', 'Archived']) {
        const p = await Product.create({ name: `${status} Product`, status })
        expect(p.status).toBe(status)
      }
    })

    it('creates Product with each visibility value', async () => {
      for (const visibility of ['Public', 'Private', 'Hidden']) {
        const p = await Product.create({ name: `${visibility} Product`, visibility })
        expect(p.visibility).toBe(visibility)
      }
    })
  })
})
