---
name: headlessly-cli
version: 0.1.0
description: Agent skill for headless.ly CLI
metadata:
  requires:
    bins: ['headlessly']
    env: ['HEADLESSLY_API_KEY']
---

# headlessly CLI — Agent Operating Guide

## Critical Rules

1. **Always use `--json`** for all commands. Never parse table output.
2. **Always use `--dry-run`** before mutating operations (`do create`, `do update`, `do delete`, custom verbs).
3. **Always use `--fields`** on `search` and `fetch` to limit response size. Only request fields you need.
4. **Use `--data` with JSON** for `do create` and `do update` instead of individual flags.
5. **Never construct entity IDs** — always get them from search/fetch results.
6. **Check exit codes**: 0=success, 1=usage error, 2=auth error, 3=not found, 4=server error.

## Patterns

### Search → Act → Verify

```bash
# 1. Find entities
headlessly search Contact --filter stage=Lead --fields '$id,name,stage' --json

# 2. Act on result (with dry-run first)
headlessly do qualify Contact contact_fX9bL5nRd --dry-run --json

# 3. Execute
headlessly do qualify Contact contact_fX9bL5nRd --json

# 4. Verify
headlessly fetch Contact contact_fX9bL5nRd --fields '$id,stage' --json
```

### Bulk Create with JSON

```bash
headlessly do create Contact --data '{"name":"Alice","stage":"Lead","email":"alice@acme.co"}' --json --quiet
```

### Schema Discovery

```bash
# List all entity types
headlessly schema --json

# Get full schema for a type (fields, relationships, verbs)
headlessly schema Contact --json

# Get just verbs for a type
headlessly schema Deal --verbs --json
```

### MCP Integration

```bash
# Start MCP server for agent-to-agent communication
headlessly mcp
```

## Anti-Patterns

- Do NOT parse table output with regex — use `--json`
- Do NOT guess entity IDs — search first
- Do NOT skip `--dry-run` for destructive operations
- Do NOT request all fields when you only need a few
- Do NOT use `eval` in automated pipelines (security risk)
