# @headlessly/code

> Your agent can write and run code. Safely.

```typescript
import { createCodeClient } from '@headlessly/code'

const code = createCodeClient({ apiKey: 'key_...' })

// Spin up an isolated Linux sandbox
const sandbox = await code.createSandbox()

// Run TypeScript with full entity access
const result = await code.runCode(
  sandbox.id,
  `
  const leads = await $.Contact.find({ stage: 'Lead', leadScore: { $gte: 80 } })
  for (const lead of leads) {
    await $.Contact.qualify(lead.$id)
  }
  return { qualified: leads.length }
`,
  { language: 'typescript' },
)

console.log(result.output) // { qualified: 12 }

await code.destroySandbox(sandbox.id)
```

The `do` MCP tool executes arbitrary TypeScript with full entity access. This package is the client SDK for the sandboxed execution environment -- Linux containers on Cloudflare, isolated per request. This is how agents go beyond CRUD to truly autonomous operations.

## The Problem

AI agents that can only call predefined API endpoints hit a ceiling fast. "Search contacts, fetch a deal, update a field" -- that's useful but limited. Real autonomy means writing and executing logic:

- "Analyze all deals closing this month, group by rep, flag any with probability below 50% that haven't been updated in two weeks"
- "Import this CSV, clean the data, create contacts for each row, skip duplicates"
- "Run a Python script that generates a churn prediction model from our subscription data"

You can't express that as a REST call. You need code execution. And you need it to be safe -- isolated from your production environment, resource-limited, and auditable.

## Sandbox Lifecycle

Every execution runs in an isolated Linux container. Create, use, destroy:

```typescript
import { createCodeClient } from '@headlessly/code'

const code = createCodeClient({ apiKey: 'key_...' })

// Create
const sandbox = await code.createSandbox()
console.log(sandbox.id, sandbox.status) // 'sandbox_fX9bL5nRd', 'running'

// Use
const info = await code.getSandbox(sandbox.id)

// Destroy
await code.destroySandbox(sandbox.id)
```

## Command Execution

Run any shell command inside the sandbox:

```typescript
const result = await code.exec(sandbox.id, 'echo hello world')
console.log(result.stdout) // 'hello world\n'
console.log(result.exitCode) // 0
```

### Streaming

For long-running commands, stream stdout/stderr in real time:

```typescript
for await (const event of await code.execStream(sandbox.id, 'npm install')) {
  if (event.type === 'stdout') process.stdout.write(event.data)
  if (event.type === 'stderr') process.stderr.write(event.data)
  if (event.type === 'exit') console.log('Done:', event.code)
}
```

### Low-Level SSE Parsing

Parse streaming responses from the raw HTTP API:

```typescript
import { parseExecStream } from '@headlessly/code'

const response = await fetch('https://code.headless.ly/exec/stream', {
  method: 'POST',
  body: JSON.stringify({ sandboxId: sandbox.id, command: 'npm test' }),
})

for await (const event of parseExecStream(response.body)) {
  switch (event.type) {
    case 'stdout':
      process.stdout.write(event.data)
      break
    case 'stderr':
      process.stderr.write(event.data)
      break
    case 'exit':
      console.log('Exit code:', event.code)
      break
  }
}
```

## File Operations

Read, write, list, check, and delete files inside the sandbox:

```typescript
await code.writeFile(
  sandbox.id,
  '/app/index.ts',
  `
  import { Contact } from '@headlessly/crm'
  const leads = await Contact.find({ stage: 'Lead' })
  console.log(leads.length)
`,
)

const content = await code.readFile(sandbox.id, '/app/index.ts')
const files = await code.listFiles(sandbox.id, '/app')
const exists = await code.fileExists(sandbox.id, '/app/index.ts')
await code.deleteFile(sandbox.id, '/app/index.ts')
```

## Multi-Language Code Execution

Run code in JavaScript, TypeScript, Python, Ruby, or Bash:

```typescript
// TypeScript
const ts = await code.runCode(
  sandbox.id,
  `
  const contacts = await $.Contact.find({ stage: 'Customer' })
  return contacts.map(c => c.name)
`,
  { language: 'typescript' },
)

// Python
const py = await code.runCode(
  sandbox.id,
  `
import json
data = [{"name": "Alice", "score": 85}, {"name": "Bob", "score": 42}]
qualified = [d for d in data if d["score"] >= 50]
print(json.dumps(qualified))
`,
  { language: 'python' },
)

// Bash
const sh = await code.runCode(
  sandbox.id,
  `
  curl -s https://api.github.com/repos/headlessly/sdk | jq .stargazers_count
`,
  { language: 'bash' },
)
```

## Install

```bash
npm install @headlessly/code
```

## API

### `createCodeClient(config)`

Create a code execution client.

| Option     | Type     | Default                      | Description                |
| ---------- | -------- | ---------------------------- | -------------------------- |
| `apiKey`   | `string` | required                     | API key for authentication |
| `endpoint` | `string` | `'https://code.headless.ly'` | Service endpoint           |

### Sandbox Management

- **`createSandbox(options?)`** -- create a new isolated sandbox, returns `SandboxInfo`
- **`getSandbox(id)`** -- get sandbox info and status
- **`destroySandbox(id)`** -- destroy a sandbox and free resources

### Command Execution

- **`exec(sandboxId, command, options?)`** -- execute a command, returns `ExecResult` with stdout, stderr, and exit code
- **`execStream(sandboxId, command, options?)`** -- execute with SSE streaming, returns async iterable of `ExecEvent`

### File Operations

- **`writeFile(sandboxId, path, content, options?)`** -- write a file
- **`readFile(sandboxId, path, options?)`** -- read a file
- **`listFiles(sandboxId, path)`** -- list files in a directory
- **`fileExists(sandboxId, path)`** -- check if a file exists
- **`deleteFile(sandboxId, path)`** -- delete a file

### Code Interpreter

- **`runCode(sandboxId, code, options?)`** -- run code in JavaScript, TypeScript, Python, Ruby, or Bash

### `parseExecStream(body)`

Parse an SSE response body into an async iterable of `ExecEvent` objects.

### Types

- `CodeClient`, `CodeClientConfig`
- `CreateSandboxOptions`, `SandboxInfo`
- `ExecOptions`, `ExecResult`, `ExecEvent`
- `WriteFileOptions`, `ReadFileOptions`, `FileInfo`
- `RunCodeOptions`, `ExecutionResult`, `ExecutionOutput`

## License

MIT
