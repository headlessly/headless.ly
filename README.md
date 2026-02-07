# headless.ly

Headless SaaS Platform for AI Agents.

## Installation

```bash
npm install headless.ly
```

## Quick Start

```javascript
import { rpc } from 'headless.ly'

// Create a client for any service
const crm = rpc('crm', { apiKey: process.env.HEADLESSLY_API_KEY })

// Make RPC calls
const leads = await crm.call('leads.find', { status: 'qualified' })
const org = await crm.call('organizations.create', { name: 'Acme Corp' })
```

## Services

| Service | Domain | Description |
|---------|--------|-------------|
| crm | crm.headless.ly | Customer Relationship Management |
| sell | sell.headless.ly | Sales Automation |
| market | market.headless.ly | Marketing Automation |
| erp | erp.headless.ly | Enterprise Resource Planning |
| support | support.headless.ly | Customer Support |
| analytics | analytics.headless.ly | Business Analytics |
| db | db.headless.ly | Database Access |

## Convenience Exports

```javascript
import { crm, sell, market, db } from 'headless.ly'

const crmClient = crm({ apiKey: '...' })
const dbClient = db({ apiKey: '...' })
```

## Types

```typescript
import type { Organization, Contact, Lead, Deal } from 'headless.ly'
```

## CLI

```bash
# Install globally
npm install -g headless.ly

# Authenticate
headlessly login

# Make RPC calls
headlessly call crm leads.find '{"status":"qualified"}'

# Start MCP server
headlessly mcp
```

## Architecture

```
+-------------+     +----------+     +-----------------+
| headless.ly |---->|  rpc.do  |---->| *.headless.ly   |
|   (types)   |     |(transport)|    |   (backend)     |
+-------------+     +----------+     +-----------------+
       |
       +-- oauth.do (auth)
       +-- cli.do (CLI)
       +-- mcp.do (AI tools)
```

## License

MIT
