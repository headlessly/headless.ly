# @headlessly/code

Code execution client SDK for headless.ly -- sandboxed Linux environments for AI agent code execution.

## Install

```bash
npm install @headlessly/code
```

## Usage

```typescript
import { createCodeClient } from '@headlessly/code'

const code = createCodeClient({ apiKey: 'key_...' })

// Create a sandbox
const sandbox = await code.createSandbox()

// Execute commands
const result = await code.exec(sandbox.id, 'echo hello world')
console.log(result.stdout) // 'hello world\n'

// Stream command output
for await (const event of await code.execStream(sandbox.id, 'npm install')) {
  if (event.type === 'stdout') process.stdout.write(event.data)
  if (event.type === 'stderr') process.stderr.write(event.data)
}

// File operations
await code.writeFile(sandbox.id, '/app/index.js', 'console.log("hi")')
const content = await code.readFile(sandbox.id, '/app/index.js')
const files = await code.listFiles(sandbox.id, '/app')
const exists = await code.fileExists(sandbox.id, '/app/index.js')
await code.deleteFile(sandbox.id, '/app/index.js')

// Code interpreter (multi-language)
const output = await code.runCode(sandbox.id, 'print(1 + 1)', { language: 'python' })
const jsOutput = await code.runCode(sandbox.id, 'console.log(1 + 1)', { language: 'javascript' })

// Clean up
await code.destroySandbox(sandbox.id)
```

### Streaming

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

## API

### `createCodeClient(config)`

Create a code execution client.

**Config:**

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
