import { describe, it, expect, beforeEach } from 'vitest'
import { clearRegistry, setProvider, MemoryNounProvider, Noun } from 'digital-objects'
import { getTools } from '../src/tools'
import { createHandlers } from '../src/handlers'

describe('@headlessly/mcp — MCP tools', () => {
  beforeEach(() => {
    clearRegistry()
    setProvider(new MemoryNounProvider())
  })

  describe('getTools', () => {
    it('returns exactly 3 tools', () => {
      const tools = getTools()
      expect(tools).toHaveLength(3)
    })

    it('includes search tool', () => {
      const tools = getTools()
      const search = tools.find((t: any) => t.name === 'search')
      expect(search).toBeDefined()
      expect(search.description).toBeDefined()
      expect(search.inputSchema).toBeDefined()
    })

    it('includes fetch tool', () => {
      const tools = getTools()
      const fetch = tools.find((t: any) => t.name === 'fetch')
      expect(fetch).toBeDefined()
    })

    it('includes do tool', () => {
      const tools = getTools()
      const doTool = tools.find((t: any) => t.name === 'do')
      expect(doTool).toBeDefined()
    })

    it('search tool has type property in schema', () => {
      const tools = getTools()
      const search = tools.find((t: any) => t.name === 'search')
      expect(search.inputSchema.properties.type).toBeDefined()
    })
  })

  describe('createHandlers', () => {
    it('returns search, fetch, and doAction handlers', () => {
      const handlers = createHandlers({ provider: new MemoryNounProvider() })
      expect(typeof handlers.search).toBe('function')
      expect(typeof handlers.fetch).toBe('function')
      expect(typeof handlers.doAction).toBe('function')
    })
  })
})
