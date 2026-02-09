import { describe, it, expect, beforeEach } from 'vitest'
import { setProvider, MemoryNounProvider, clearRegistry } from 'digital-objects'
import { Customer, Product, Plan, Price, Subscription, Invoice, Payment } from '../src/index.ts'
import { setupTestProvider, expectMetaFields, expectCrudVerbs, expectVerbConjugation, testCrudLifecycle } from '../../test-utils'

describe('@headlessly/billing', () => {
  setupTestProvider()

  describe('exports', () => {
    it('exports Customer', () => {
      expect(Customer).toBeDefined()
      expect(Customer.$name).toBe('Customer')
    })

    it('exports Product', () => {
      expect(Product).toBeDefined()
      expect(Product.$name).toBe('Product')
    })

    it('exports Plan', () => {
      expect(Plan).toBeDefined()
      expect(Plan.$name).toBe('Plan')
    })

    it('exports Price', () => {
      expect(Price).toBeDefined()
      expect(Price.$name).toBe('Price')
    })

    it('exports Subscription', () => {
      expect(Subscription).toBeDefined()
      expect(Subscription.$name).toBe('Subscription')
    })

    it('exports Invoice', () => {
      expect(Invoice).toBeDefined()
      expect(Invoice.$name).toBe('Invoice')
    })

    it('exports Payment', () => {
      expect(Payment).toBeDefined()
      expect(Payment.$name).toBe('Payment')
    })
  })

  describe('CRUD verbs', () => {
    it('Customer has CRUD verbs', () => {
      expectCrudVerbs(Customer)
    })

    it('Product has CRUD verbs', () => {
      expectCrudVerbs(Product)
    })

    it('Plan has CRUD verbs', () => {
      expectCrudVerbs(Plan)
    })

    it('Price has CRUD verbs', () => {
      expectCrudVerbs(Price)
    })

    it('Subscription has CRUD verbs', () => {
      expectCrudVerbs(Subscription)
    })

    it('Invoice has CRUD verbs', () => {
      expectCrudVerbs(Invoice)
    })

    it('Payment has CRUD verbs', () => {
      expectCrudVerbs(Payment)
    })
  })

  describe('verb conjugation', () => {
    it('Subscription.pause conjugation', () => {
      expectVerbConjugation(Subscription, 'pause', 'pausing', 'paused')
    })

    it('Subscription.cancel conjugation', () => {
      expectVerbConjugation(Subscription, 'cancel', 'cancelling', 'cancelled')
    })

    it('Subscription.reactivate conjugation', () => {
      expectVerbConjugation(Subscription, 'reactivate', 'reactivating', 'reactivated')
    })

    it('Subscription.upgrade conjugation', () => {
      expectVerbConjugation(Subscription, 'upgrade', 'upgrading', 'upgraded')
    })

    it('Subscription.downgrade conjugation', () => {
      expectVerbConjugation(Subscription, 'downgrade', 'downgrading', 'downgraded')
    })

    it('Invoice.pay conjugation', () => {
      expectVerbConjugation(Invoice, 'pay', 'paying', 'payed')
    })

    it('Invoice.void conjugation', () => {
      expectVerbConjugation(Invoice, 'void', 'voiding', 'voided')
    })

    it('Payment.refund conjugation', () => {
      expectVerbConjugation(Payment, 'refund', 'refunding', 'refunded')
    })
  })

  describe('create with meta-fields', () => {
    it('creates Customer with meta-fields', async () => {
      const customer = await Customer.create({ name: 'Acme Corp', email: 'billing@acme.co' })
      expectMetaFields(customer, 'Customer')
      expect(customer.name).toBe('Acme Corp')
      expect(customer.email).toBe('billing@acme.co')
    })

    it('creates Product with meta-fields', async () => {
      const product = await Product.create({ name: 'Pro Plan' })
      expectMetaFields(product, 'Product')
      expect(product.name).toBe('Pro Plan')
    })

    it('creates Plan with meta-fields', async () => {
      const plan = await Plan.create({ name: 'Monthly Pro' })
      expectMetaFields(plan, 'Plan')
      expect(plan.name).toBe('Monthly Pro')
    })

    it('creates Price with meta-fields', async () => {
      const price = await Price.create({ amount: 4900 })
      expectMetaFields(price, 'Price')
      expect(price.amount).toBe(4900)
    })

    it('creates Subscription with meta-fields', async () => {
      const subscription = await Subscription.create({
        status: 'Active',
        currentPeriodStart: '2024-01-01T00:00:00Z',
        currentPeriodEnd: '2024-02-01T00:00:00Z',
        startedAt: '2024-01-01T00:00:00Z',
      })
      expectMetaFields(subscription, 'Subscription')
      expect(subscription.status).toBe('Active')
      expect(subscription.currentPeriodStart).toBe('2024-01-01T00:00:00Z')
      expect(subscription.currentPeriodEnd).toBe('2024-02-01T00:00:00Z')
      expect(subscription.startedAt).toBe('2024-01-01T00:00:00Z')
    })

    it('creates Invoice with meta-fields', async () => {
      const invoice = await Invoice.create({ number: 'INV-001', subtotal: 4900, total: 4900, amountDue: 4900 })
      expectMetaFields(invoice, 'Invoice')
      expect(invoice.number).toBe('INV-001')
      expect(invoice.subtotal).toBe(4900)
      expect(invoice.total).toBe(4900)
      expect(invoice.amountDue).toBe(4900)
    })

    it('creates Payment with meta-fields', async () => {
      const payment = await Payment.create({ amount: 4900 })
      expectMetaFields(payment, 'Payment')
      expect(payment.amount).toBe(4900)
    })
  })

  describe('full CRUD lifecycle', () => {
    it('Customer CRUD lifecycle', async () => {
      await testCrudLifecycle(Customer, 'Customer', { name: 'Acme Corp', email: 'billing@acme.co' }, { name: 'Acme Inc' })
    })

    it('Product CRUD lifecycle', async () => {
      await testCrudLifecycle(Product, 'Product', { name: 'Pro Plan' }, { name: 'Enterprise Plan' })
    })

    it('Plan CRUD lifecycle', async () => {
      await testCrudLifecycle(Plan, 'Plan', { name: 'Monthly Pro' }, { name: 'Monthly Enterprise' })
    })

    it('Price CRUD lifecycle', async () => {
      await testCrudLifecycle(Price, 'Price', { amount: 4900 }, { amount: 9900 })
    })

    it('Subscription CRUD lifecycle', async () => {
      await testCrudLifecycle(
        Subscription,
        'Subscription',
        { status: 'Active', currentPeriodStart: '2024-01-01T00:00:00Z', currentPeriodEnd: '2024-02-01T00:00:00Z', startedAt: '2024-01-01T00:00:00Z' },
        { status: 'PastDue' },
      )
    })

    it('Invoice CRUD lifecycle', async () => {
      await testCrudLifecycle(Invoice, 'Invoice', { number: 'INV-001', subtotal: 4900, total: 4900, amountDue: 4900 }, { amountDue: 0 })
    })

    it('Payment CRUD lifecycle', async () => {
      await testCrudLifecycle(Payment, 'Payment', { amount: 4900 }, { amount: 5900 })
    })
  })
})
