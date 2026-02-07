# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ IMPORTANT: This is Generated Code

**This entire repository is auto-generated.** Do not manually edit files in this repository.

### Key Rules

1. **DO NOT** write or modify code directly in this repository
2. **DO NOT** execute code from this repository directly
3. **DO NOT** reference the source repository (it is private/closed-source)
4. All changes must be made to the source templates and regenerated

### What This Repository Contains

This repository contains generated packages and content for the headless.ly platform:

```
public/
├── src/                 # Generated SDK source
├── apps/                # Generated app packages (@headlessly/crm, etc.)
├── nouns/               # Generated TypeScript types from entity schemas
├── verbs/               # Generated action definitions
├── industries/          # Generated NAICS-based industry packages
├── occupations/         # Generated O*NET occupation packages
├── processes/           # Generated APQC process packages
├── departments/         # Generated department configurations
├── integrations/        # Generated third-party integrations
├── tasks/               # Generated task definitions
├── tech/                # Generated technology packages
├── docs/                # Generated documentation
├── tests/               # Generated test files
└── content/             # Generated content (from MDX templates)
```

### Generation Pipeline

Files are generated from:
1. **Entity schemas** in `.db/schema/*.ts` (IceType definitions)
2. **MDX templates** in `content/` (using `@mdxld/markdown`)
3. **Standards data** from `.org.ai/` (NAICS, O*NET, APQC, etc.)

### How to Make Changes

To modify any content in this repository:

1. **For schema changes**: Edit the source `.db/schema/*.ts` files
2. **For template changes**: Edit the source `content/**/*.mdx` templates
3. **Regenerate**: Run the generation script
4. **Review**: Check the generated output
5. **Commit**: The generation process will commit and push changes

### Package Structure

Each generated package follows this pattern:

```typescript
// @headlessly/{package}/index.ts
import { rpc } from 'headless.ly'
export const client = (options) => rpc('{package}', options)
```

### TypeScript Types

Types are generated from IceType schemas:

```
.db/schema/crm.ts → nouns/organization/types.d.ts
                  → nouns/contact/types.d.ts
                  → nouns/lead/types.d.ts
                  → nouns/deal/types.d.ts
```

### MCP Integration

Generated packages include MCP tool definitions via `@dotdo/mcp`:

```typescript
import { mcp } from '@dotdo/mcp'

export const tools = mcp.tools({
  // Auto-generated from RPC definitions
})
```

## Why Generated?

1. **Consistency**: All packages follow the same patterns
2. **Type Safety**: Types are derived from a single source of truth
3. **Scalability**: Generate hundreds/thousands of packages from templates
4. **Transparency**: Open-source output while keeping generation logic private

## Related

- [headless.ly](https://headless.ly) - Main platform
- [npmjs.com/package/headless.ly](https://npmjs.com/package/headless.ly) - SDK package
