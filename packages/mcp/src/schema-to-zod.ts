import { z, type ZodTypeAny } from 'zod'
import type { MCPSchemaProperty } from './types.js'

/**
 * Convert an MCPSchemaProperty (JSON Schema subset) to a Zod schema.
 * Used internally to register headlessly tools on the SDK McpServer.
 */
export function schemaPropertyToZod(prop: MCPSchemaProperty): ZodTypeAny {
  if (prop.enum && prop.enum.length > 0) {
    return z.enum(prop.enum as [string, ...string[]]).describe(prop.description)
  }

  switch (prop.type) {
    case 'string':
      return z.string().describe(prop.description)
    case 'number':
    case 'integer':
      return z.number().describe(prop.description)
    case 'boolean':
      return z.boolean().describe(prop.description)
    case 'array':
      return z.array(prop.items ? schemaPropertyToZod(prop.items) : z.unknown()).describe(prop.description)
    case 'object':
      if (prop.properties) {
        const shape: Record<string, ZodTypeAny> = {}
        for (const [key, val] of Object.entries(prop.properties)) {
          shape[key] = schemaPropertyToZod(val).optional()
        }
        return z.object(shape).describe(prop.description)
      }
      return z.record(z.unknown()).describe(prop.description)
    default:
      return z.unknown().describe(prop.description)
  }
}

/**
 * Convert an MCP tool inputSchema to a Zod object schema.
 * Marks fields listed in `required` as non-optional.
 */
export function inputSchemaToZod(schema: { properties: Record<string, MCPSchemaProperty>; required?: string[] }): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {}
  const requiredSet = new Set(schema.required ?? [])

  for (const [key, prop] of Object.entries(schema.properties)) {
    const base = schemaPropertyToZod(prop)
    shape[key] = requiredSet.has(key) ? base : base.optional()
  }

  return z.object(shape)
}
