/**
 * @headlessly/objects — DO-backed NounProvider for digital-objects
 *
 * Bridges the Noun() factory proxy to Durable Object storage layers.
 *
 * Providers:
 * - DONounProvider: Routes operations via HTTP fetch to a DO endpoint
 * - LocalNounProvider: In-process storage with event emission (for local dev)
 *
 * Utilities:
 * - createEventBridge: In-memory event emitter for verb lifecycle events
 * - executeVerb: Verb execution with event emission
 *
 * @packageDocumentation
 */

// Providers
export { DONounProvider, DOProviderError } from './do-provider.js'
export type { DONounProviderOptions } from './do-provider.js'

export { LocalNounProvider } from './local-provider.js'
export type { LocalNounProviderOptions } from './local-provider.js'

// Event bridge
export { createEventBridge } from './event-bridge.js'
export type { NounEvent, EventHandler, EventEmitter, EventQueryOptions } from './event-bridge.js'

// Verb executor
export { executeVerb } from './verb-executor.js'
export type { VerbExecution, VerbExecutorOptions } from './verb-executor.js'

// ID generation utilities
export { generateSqid, generateEntityId, generateEventId } from './id.js'
