import type { MCPTool, MCPContext } from './types.js'
import { getAllNouns } from 'digital-objects'

/**
 * Generate the three MCP tool definitions.
 * Tool schemas are dynamically generated from registered nouns.
 */
export function getTools(context?: MCPContext): MCPTool[] {
  const nouns = getAllNouns()
  const entityTypes = [...nouns.keys()]

  return [
    {
      name: 'search',
      description:
        'Search for entities across the headless.ly graph. Find contacts, deals, subscriptions, projects, and more. Returns matching entities with their current state.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            description: `Entity type to search. Available: ${entityTypes.join(', ')}. Omit to search all types.`,
            enum: entityTypes,
          },
          query: {
            type: 'string',
            description: 'Full-text search query across entity fields',
          },
          filter: {
            type: 'object',
            description: 'Filter criteria. Keys are field names, values are exact matches. Use $gt, $lt, $gte, $lte, $ne, $in for comparisons.',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 20, max: 100)',
          },
          sort: {
            type: 'object',
            description: 'Sort specification. Keys are field names, values are "asc" or "desc".',
          },
        },
      },
    },
    {
      name: 'fetch',
      description: 'Fetch a specific entity, schema definition, events, or metrics from headless.ly. Use for precise lookups.',
      inputSchema: {
        type: 'object',
        properties: {
          resource: {
            type: 'string',
            description: 'What to fetch',
            enum: ['entity', 'schema', 'events', 'metrics', 'state'],
          },
          type: {
            type: 'string',
            description: 'Entity type',
            enum: entityTypes,
          },
          id: {
            type: 'string',
            description: 'Entity ID (for entity/events/state resources)',
          },
          asOf: {
            type: 'string',
            description: 'ISO timestamp for time-travel queries (get state at a point in time)',
          },
          noun: {
            type: 'string',
            description: 'Noun name for schema fetch. Omit to get all schemas.',
          },
        },
        required: ['resource'],
      },
    },
    {
      name: 'do',
      description: 'Execute an action on headless.ly. Create entities, execute verbs (qualify, close, pause), run workflows, or evaluate TypeScript code.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Action to execute: "create", "update", "delete", a verb name (e.g., "qualify", "close", "pause"), or "eval" for code execution',
          },
          type: {
            type: 'string',
            description: 'Entity type for the action',
            enum: entityTypes,
          },
          id: {
            type: 'string',
            description: 'Entity ID (required for update/delete/verb execution)',
          },
          data: {
            type: 'object',
            description: 'Data payload for the action',
          },
          code: {
            type: 'string',
            description: 'TypeScript code to evaluate (when action is "eval"). Has access to $ context with all entities.',
          },
        },
        required: ['action'],
      },
    },
  ]
}
