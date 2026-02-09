# @headlessly/billing

> Stripe is the payment rail. This is the billing system your agent operates.

```typescript
import { Subscription, Invoice } from '@headlessly/billing'

await Subscription.create({ customer: 'customer_fX9bL5nRd', plan: 'plan_k7TmPvQx' })
await Subscription.upgrade('subscription_mN8pZwKj')

// A subscription cancels — CRM, support, and analytics react instantly
Subscription.cancelled(async (sub, $) => {
  await $.Contact.update(sub.customer, { stage: 'Churned' })
  await $.Ticket.create({ subject: 'Cancellation follow-up', requester: sub.customer })
  await $.Event.create({ type: 'churn', value: sub.plan })
})
```

Stripe handles payments. headless.ly gives your agent the full billing lifecycle — subscriptions, invoices, plans, upgrades, downgrades — as typed entities in the same graph as your CRM, support, and analytics.

## The Problem

You integrated Stripe. Congratulations — you can charge credit cards.

Now build the rest: subscription lifecycle management, plan-based access control, invoice generation, payment failure handling, MRR calculation, churn tracking, upgrade/downgrade logic.

Wire it to your CRM so sales knows when a deal converts to a paying customer. Wire it to support so tickets appear when payments fail. Wire it to analytics so you can track conversion funnels.

That's not a Stripe problem. That's an integration problem. Your billing data lives in Stripe, your CRM data lives in HubSpot, your support data lives in Zendesk, and none of them share a graph.

## One Typed Graph

When a subscription cancels in headless.ly, your CRM already knows. Your support system already knows. Your analytics already know. Because they're the same system:

```typescript
import { Subscription, Invoice } from '@headlessly/billing'

Subscription.cancelled(async (sub, $) => {
  await $.Contact.update(sub.customer, { stage: 'Churned' })
  await $.Ticket.create({ subject: 'Win-back opportunity', requester: sub.customer, priority: 'High' })
  await $.Event.create({ type: 'churn', value: sub.plan })
})

Invoice.voided(async (invoice, $) => {
  await $.Activity.create({
    subject: `Payment failed: ${invoice.number}`,
    type: 'Task',
    priority: 'Urgent',
  })
})
```

No webhook relay. No Zapier. No data mapping. One graph.

## Install

```bash
npm install @headlessly/billing
```

## Entities

### Customer

Billable customers backed by Stripe — linked to your CRM organizations.

```typescript
import { Customer } from '@headlessly/billing'

await Customer.create({ name: 'Acme Corp', email: 'billing@acme.co', currency: 'usd' })
```

**Key fields**: name, email, stripeCustomerId, paymentMethod, currency, taxExempt

**Relationships**: → Organization, ← Subscriptions[], ← Invoices[], ← Payments[]

### Product

Software products, services, addons, and bundles.

```typescript
import { Product } from '@headlessly/billing'

await Product.create({
  name: 'Headlessly Pro',
  type: 'Software',
  status: 'Active',
  visibility: 'Public',
})
```

**Key fields**: name, tagline, type (`Software | Service | Addon | Bundle`), status (`Draft | Active | Archived`), visibility (`Public | Private | Hidden`), features, stripeProductId

### Plan

Pricing plans with trial support and feature limits.

```typescript
import { Plan } from '@headlessly/billing'

await Plan.create({
  name: 'Pro Monthly',
  product: 'product_e5JhLzXc',
  trialDays: 14,
  status: 'Active',
})
```

**Key fields**: name, trialDays, features, limits, status (`Draft | Active | Grandfathered | Archived`), isFree, isEnterprise

**Relationships**: → Product, ← Prices[]

### Price

Individual price points — monthly, yearly, or one-time.

```typescript
import { Price } from '@headlessly/billing'

await Price.create({ amount: 4900, currency: 'usd', interval: 'Monthly', plan: 'plan_k7TmPvQx' })
```

**Key fields**: amount, currency, interval (`Monthly | Quarterly | Yearly | OneTime`), active, stripeId

### Subscription

The full lifecycle — create, pause, cancel, reactivate, upgrade, downgrade.

```typescript
import { Subscription } from '@headlessly/billing'

await Subscription.create({ customer: 'customer_fX9bL5nRd', plan: 'plan_k7TmPvQx' })

await Subscription.pause('subscription_mN8pZwKj')
await Subscription.cancel('subscription_mN8pZwKj')
await Subscription.reactivate('subscription_mN8pZwKj')
await Subscription.upgrade('subscription_mN8pZwKj')
await Subscription.downgrade('subscription_mN8pZwKj')
```

**Verbs**: `pause()` · `cancel()` · `reactivate()` · `upgrade()` · `downgrade()` — each with full lifecycle conjugation

**Key fields**: status (`Active | PastDue | Canceled | Trialing | Paused | Incomplete`), currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, trialStart, trialEnd, cancelReason

**Relationships**: → Customer, → Plan, → Organization

### Invoice

Invoices with line items, payment tracking, and Stripe sync.

```typescript
import { Invoice } from '@headlessly/billing'

await Invoice.create({
  number: 'INV-2026-001',
  customer: 'customer_fX9bL5nRd',
  total: 4900,
  amountDue: 4900,
})

await Invoice.pay('invoice_z3RnWqYp')
await Invoice.void('invoice_z3RnWqYp')
```

**Verbs**: `pay()` · `void()` — each with full lifecycle conjugation

**Key fields**: number, subtotal, tax, total, amountDue, status (`Draft | Open | Paid | Void | Uncollectible`), lineItems, stripeInvoiceId

### Payment

Individual payment transactions.

```typescript
import { Payment } from '@headlessly/billing'

await Payment.create({ amount: 4900, currency: 'usd', customer: 'customer_fX9bL5nRd' })
await Payment.refund('payment_pQ4xLmRn')
```

**Verbs**: `refund()` — with full lifecycle conjugation

**Key fields**: amount, currency, status (`Pending | Succeeded | Failed | Refunded`), stripePaymentId

## Agent-Native

Your agent connects to one MCP endpoint. It can manage your entire billing stack:

```json title="billing.headless.ly/mcp#search"
{ "type": "Subscription", "filter": { "status": "Active" } }
```

```json title="billing.headless.ly/mcp#fetch"
{ "type": "Customer", "id": "customer_fX9bL5nRd", "include": ["subscriptions", "invoices"] }
```

```ts title="billing.headless.ly/mcp#do"
const pastDue = await $.Subscription.find({ status: 'PastDue' })
for (const sub of pastDue) {
  await $.Ticket.create({
    subject: `Payment issue: ${sub.$id}`,
    requester: sub.customer,
    priority: 'Urgent',
  })
}
```

## Cross-Domain Operations

Query results are standard arrays — chain operations with familiar JavaScript:

```typescript
const customers = await Customer.find({ currency: 'usd' })
for (const customer of customers) {
  const subs = await Subscription.find({ customer: customer.$id, status: 'Active' })
  for (const sub of subs) {
    await Invoice.create({ customer: customer.$id, subscription: sub.$id })
  }
}
```

## License

MIT
