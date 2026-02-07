# AGENTS.md

Guidelines for AI agents working with this repository.

## ⚠️ Critical: Generated Code Repository

This repository contains **generated output only**. AI agents should:

### DO NOT

- ❌ Write or modify code files directly
- ❌ Execute code from this repository
- ❌ Reference or mention the private source repository
- ❌ Create new files manually
- ❌ Commit changes directly to this repository
- ❌ Install dependencies or run scripts

### DO

- ✅ Read and understand the generated code
- ✅ Answer questions about the SDK and packages
- ✅ Explain how the packages work
- ✅ Help users integrate the packages into their projects
- ✅ Provide usage examples based on the generated types

## Repository Purpose

This is the **public output** of the headless.ly package generation system:

| Directory | Contains | Generated From |
|-----------|----------|----------------|
| `src/` | SDK source code | RPC definitions |
| `apps/` | App packages | App schemas + MDX templates |
| `nouns/` | TypeScript types | IceType entity schemas |
| `verbs/` | Action definitions | Verb ontology |
| `industries/` | Industry packages | NAICS codes |
| `occupations/` | Occupation packages | O*NET codes |
| `processes/` | Process packages | APQC framework |
| `integrations/` | Integration packages | Integration schemas |
| `docs/` | Documentation | All schemas + MDX templates |

## Using the SDK

When helping users, reference the main package:

```typescript
import { rpc, db, crm } from 'headless.ly'

// Access services
const crmClient = crm({ apiKey: '...' })
const leads = await crmClient.findLeads({ status: 'qualified' })

// Access database
const database = db({ apiKey: '...' })
const orgs = await database.Organization.find({ type: 'customer' })
```

## Type Information

Types are generated from IceType schemas. Guide users to:

```typescript
import type {
  Organization,
  Contact,
  Lead,
  Deal
} from 'headless.ly'

// Or from specific noun packages
import type { Organization } from 'headless.ly/nouns/organization'
```

## MCP Tools

Packages include MCP tool definitions for AI agents:

```typescript
import { tools } from '@headlessly/crm/mcp'

// Tools are auto-generated from RPC definitions
// - crm_find_organizations
// - crm_create_lead
// - crm_update_deal_stage
// etc.
```

## Questions About Generation

If users ask how the code is generated:

1. Explain it's generated from schemas and templates
2. Point them to the public SDK documentation
3. Do NOT reference the private generation repository
4. Suggest they use the published packages as intended

## Links

- **SDK Docs**: https://headless.ly/docs
- **NPM Package**: https://npmjs.com/package/headless.ly
- **API Reference**: https://headless.ly/api
