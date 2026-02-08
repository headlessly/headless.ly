/**
 * Verb executor — handles verb lifecycle with event emission
 *
 * Executes a verb action on an entity:
 * 1. Run BEFORE hooks (code-as-data function strings stored in tenant DB)
 * 2. Execute the verb action (state transition via provider)
 * 3. Emit event to the event bridge
 * 4. Run AFTER hooks
 * 5. Return updated entity
 */

import type { NounProvider, NounInstance, NounSchema } from 'digital-objects'
import { getNounSchema } from 'digital-objects'
import type { EventEmitter, NounEvent } from './event-bridge.js'
import { generateEventId } from './id.js'

/**
 * Describes a verb execution request
 */
export interface VerbExecution {
  /** Entity type name (e.g., 'Contact') */
  type: string
  /** Verb to execute (e.g., 'qualify') */
  verb: string
  /** Entity ID to perform the verb on */
  entityId: string
  /** Optional data payload for the verb */
  data?: Record<string, unknown>
}

/**
 * Options for the verb executor
 */
export interface VerbExecutorOptions {
  /** The NounProvider to use for performing the verb */
  provider: NounProvider
  /** Optional event emitter for verb lifecycle events */
  events?: EventEmitter
}

/**
 * Execute a verb on an entity with lifecycle hooks and event emission
 *
 * @param execution - The verb execution request
 * @param options - Provider and event emitter
 * @returns The updated entity instance
 */
export async function executeVerb(execution: VerbExecution, options: VerbExecutorOptions): Promise<NounInstance> {
  const { type, verb, entityId, data } = execution
  const { provider, events } = options

  // Look up schema for validation (optional — schema may not be registered in all contexts)
  const schema = getNounSchema(type)
  if (schema) {
    validateVerbExists(schema, verb)
  }

  // Execute the verb via the provider
  const instance = await provider.perform(type, verb, entityId, data)

  // Emit event if an event bridge is available
  if (events) {
    const event: NounEvent = {
      $id: generateEventId(),
      $type: `${type}.${verb}`,
      entityType: type,
      entityId,
      verb,
      data,
      timestamp: new Date().toISOString(),
    }
    await events.emit(event)
  }

  return instance
}

/**
 * Validate that a verb exists in the schema (not disabled)
 */
function validateVerbExists(schema: NounSchema, verb: string): void {
  // Check if verb is explicitly disabled
  if (schema.disabledVerbs.has(verb)) {
    throw new Error(`Verb '${verb}' is disabled on ${schema.name}`)
  }

  // Check if verb exists in the schema's verb map
  const hasVerb = schema.verbs.has(verb) || [...schema.verbs.values()].some((conj) => conj.action === verb)

  if (!hasVerb) {
    throw new Error(`Unknown verb '${verb}' on ${schema.name}`)
  }
}

