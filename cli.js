#!/usr/bin/env node
/**
 * headless.ly CLI
 * @generated
 *
 * Proxies to cli.do, mcp.do, and oauth.do for functionality
 */

import { cli } from 'cli.do'

// Auth commands -> oauth.do
cli.command('login', 'Authenticate with headless.ly', async () => {
  const { login } = await import('oauth.do/node')
  await login({ service: 'headless.ly' })
})

cli.command('logout', 'Log out from headless.ly', async () => {
  const { logout } = await import('oauth.do/node')
  await logout({ service: 'headless.ly' })
})

cli.command('whoami', 'Show current user', async () => {
  const { whoami } = await import('oauth.do/node')
  const user = await whoami({ service: 'headless.ly' })
  console.log(user ? `Logged in as ${user.email}` : 'Not logged in')
})

// MCP server -> mcp.do
cli.command('mcp', 'Start MCP server for AI agents', async () => {
  const { serve } = await import('mcp.do')
  await serve({
    name: 'headless.ly',
    tools: await import('./mcp-tools.js')
  })
})

// RPC commands -> rpc.do
cli.command('call <service> <method> [params]', 'Make RPC call', async (service, method, params) => {
  const { ensureLoggedIn } = await import('oauth.do/node')
  const { apiKey } = await ensureLoggedIn({ service: 'headless.ly' })
  const { rpc } = await import('rpc.do')

  const client = rpc(service, { apiKey })
  const result = await client.call(method, params ? JSON.parse(params) : {})
  console.log(JSON.stringify(result, null, 2))
})

cli.run()
