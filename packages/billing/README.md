# @headlessly/billing

Billing entities for customers, products, plans, prices, subscriptions, invoices, and payments — backed by Stripe as the source of truth.

## Install

```bash
npm install @headlessly/billing
```

## Entities

### Customer

Billable customers linked to organizations and Stripe.

```typescript
import { Customer } from '@headlessly/billing'

await Customer.create({
  name: 'Acme Corp',
  email: 'billing@acme.co',
  currency: 'usd',
})
```

**Fields**: `name`, `email`, `stripeCustomerId`, `paymentMethod`, `currency`, `taxExempt`

**Relationships**:
- `organization` -> Organization
- `subscriptions` <- Subscription.customer[]
- `invoices` <- Invoice.customer[]
- `payments` <- Payment.customer[]

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

**Fields**: `name`, `slug`, `description`, `tagline`, `type`, `icon`, `image`, `features`, `highlights`, `status`, `visibility`, `featured`, `stripeProductId`

**Relationships**:
- `plans` <- Plan.product[]

**Enums**:
- `type`: Software | Service | Addon | Bundle
- `status`: Draft | Active | Archived
- `visibility`: Public | Private | Hidden

### Plan

Pricing plans tied to products with trial support and feature limits.

```typescript
import { Plan } from '@headlessly/billing'

await Plan.create({
  name: 'Pro Monthly',
  product: 'product_e5JhLzXc',
  trialDays: 14,
  status: 'Active',
})
```

**Fields**: `name`, `slug`, `description`, `trialDays`, `features`, `limits`, `status`, `isDefault`, `isFree`, `isEnterprise`, `badge`, `order`

**Relationships**:
- `product` -> Product.plans
- `prices` <- Price.plan[]

**Enums**:
- `status`: Draft | Active | Grandfathered | Archived

### Price

Individual price points on plans — monthly, yearly, or one-time.

```typescript
import { Price } from '@headlessly/billing'

await Price.create({
  amount: 4900,
  currency: 'usd',
  interval: 'Monthly',
  plan: 'plan_k7TmPvQx',
})
```

**Fields**: `amount`, `currency`, `interval`, `intervalCount`, `originalAmount`, `discountPercent`, `active`, `stripeId`

**Relationships**:
- `plan` -> Plan.prices

**Enums**:
- `interval`: Monthly | Quarterly | Yearly | OneTime

### Subscription

Active subscriptions with full lifecycle management — pause, cancel, upgrade, downgrade.

```typescript
import { Subscription } from '@headlessly/billing'

await Subscription.create({
  customer: 'customer_fX9bL5nRd',
  plan: 'plan_k7TmPvQx',
  currentPeriodStart: '2025-01-01T00:00:00Z',
  currentPeriodEnd: '2025-02-01T00:00:00Z',
  startedAt: '2025-01-01T00:00:00Z',
})

await Subscription.pause('subscription_mN8pZwKj')
await Subscription.cancel('subscription_mN8pZwKj')
await Subscription.reactivate('subscription_mN8pZwKj')
await Subscription.upgrade('subscription_mN8pZwKj')
await Subscription.downgrade('subscription_mN8pZwKj')
```

**Fields**: `status`, `currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`, `trialStart`, `trialEnd`, `startedAt`, `canceledAt`, `pausedAt`, `resumesAt`, `endedAt`, `cancelReason`, `cancelFeedback`, `quantity`, `paymentMethod`, `collectionMethod`, `stripeSubscriptionId`, `stripeCustomerId`

**Relationships**:
- `organization` -> Organization.subscriptions
- `customer` -> Customer.subscriptions
- `plan` -> Plan

**Verbs**: `pause()` / `pausing()` / `paused()` / `pausedBy`, `cancel()` / `cancelling()` / `cancelled()` / `cancelledBy`, `reactivate()` / `reactivating()` / `reactivated()` / `reactivatedBy`, `upgrade()` / `upgrading()` / `upgraded()` / `upgradedBy`, `downgrade()` / `downgrading()` / `downgraded()` / `downgradedBy`

**Enums**:
- `status`: Active | PastDue | Canceled | Trialing | Paused | Incomplete

### Invoice

Invoices generated from subscriptions with line items and payment tracking.

```typescript
import { Invoice } from '@headlessly/billing'

await Invoice.create({
  number: 'INV-2025-001',
  customer: 'customer_fX9bL5nRd',
  subtotal: 4900,
  total: 4900,
  amountDue: 4900,
})

await Invoice.pay('invoice_z3RnWqYp')
await Invoice.void('invoice_z3RnWqYp')
```

**Fields**: `number`, `subtotal`, `tax`, `discount`, `total`, `amountPaid`, `amountDue`, `currency`, `status`, `periodStart`, `periodEnd`, `issuedAt`, `dueAt`, `paidAt`, `voidedAt`, `lineItems`, `receiptUrl`, `pdfUrl`, `hostedUrl`, `stripeInvoiceId`

**Relationships**:
- `organization` -> Organization
- `customer` -> Customer.invoices
- `subscription` -> Subscription

**Verbs**: `pay()` / `paying()` / `paid()` / `paidBy`, `void()` / `voiding()` / `voided()` / `voidedBy`

**Enums**:
- `status`: Draft | Open | Paid | Void | Uncollectible

### Payment

Individual payment transactions tied to customers and invoices.

```typescript
import { Payment } from '@headlessly/billing'

await Payment.create({
  amount: 4900,
  currency: 'usd',
  customer: 'customer_fX9bL5nRd',
  invoice: 'invoice_z3RnWqYp',
})

await Payment.refund('payment_pQ4xLmRn')
```

**Fields**: `amount`, `currency`, `status`, `method`, `stripePaymentId`

**Relationships**:
- `customer` -> Customer.payments
- `invoice` -> Invoice

**Verbs**: `refund()` / `refunding()` / `refunded()` / `refundedBy`

**Enums**:
- `status`: Pending | Succeeded | Failed | Refunded

## Event-Driven Reactions

React to billing lifecycle events across the graph:

```typescript
import { Subscription, Invoice } from '@headlessly/billing'

Subscription.cancelled((sub, $) => {
  console.log(`Subscription ${sub.$id} cancelled: ${sub.cancelReason}`)
})

Invoice.paid((invoice) => {
  console.log(`Invoice ${invoice.number} paid`)
})

Subscription.upgraded((sub, $) => {
  $.Invoice.create({
    customer: sub.customer,
    subscription: sub.$id,
    subtotal: 0,
    total: 0,
    amountDue: 0,
  })
})
```

## Promise Pipelining

Built on [rpc.do](https://rpc.do) + capnweb — chain operations in a single round-trip:

```typescript
const revenue = await Customer.find({ currency: 'usd' })
  .map(c => c.subscriptions)
  .filter(s => s.status === 'Active')
  .map(s => s.plan)
```

## License

MIT
