# headless.ly Documentation

> ⚠️ This documentation is auto-generated. Do not edit directly.

## Packages

### Core SDK

- [headless.ly](https://npmjs.com/package/headless.ly) - Main SDK package

### App Packages

- [@headlessly/crm](./apps/crm/) - Customer Relationship Management
- [@headlessly/sell](./apps/sell/) - Sales Automation
- [@headlessly/market](./apps/market/) - Marketing Automation
- [@headlessly/erp](./apps/erp/) - Enterprise Resource Planning
- [@headlessly/support](./apps/support/) - Customer Support
- [@headlessly/analytics](./apps/analytics/) - Business Analytics

### Entity Types

See [nouns/](../nouns/) for all entity type definitions.

### Actions

See [verbs/](../verbs/) for action verb definitions.

## API Reference

- [CRM API](https://crm.headless.ly/docs)
- [Database API](https://db.headless.ly/docs)

## Getting Started

```typescript
import { rpc, db } from 'headless.ly'

// Access RPC services
const crmClient = rpc('crm', { apiKey: process.env.HEADLESSLY_API_KEY })
const leads = await crmClient.call('leads.find', { status: 'qualified' })

// Access database
const database = db({
  mode: 'remote',
  endpoint: 'https://db.headless.ly',
  apiKey: process.env.HEADLESSLY_API_KEY
})
const orgs = await database.Organization.find({ type: 'customer' })
```
