/**
 * Test fixture: MCP server over stdio.
 * Spawned as a child process by sdk-integration.test.ts.
 */
import { clearRegistry, setProvider, MemoryNounProvider, Noun } from 'digital-objects'
import { MCPServer } from '../../src/server.js'
import { connectStdio } from '../../src/stdio.js'

// Set up test nouns
clearRegistry()
const provider = new MemoryNounProvider()
setProvider(provider)

Noun('Contact', {
  name: 'string!',
  email: 'string?#',
  stage: 'Lead | Qualified | Customer | Churned',
  qualify: 'Qualified',
})

Noun('Deal', {
  title: 'string!',
  value: 'number?',
  stage: 'Open | Won | Lost',
  contact: '-> Contact.deals',
  close: 'Won',
})

const server = new MCPServer({ provider })

// Signal ready on stderr, then connect stdio (anon mode — no oauth.do needed for tests)
process.stderr.write('ready\n')
await connectStdio(server, { authMode: 'anon' })
