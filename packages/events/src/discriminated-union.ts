/**
 * Discriminated Union Event Types — auto-generated from Noun() definitions
 *
 * Every entity mutation produces a typed event. This module derives the full
 * discriminated union from the noun registry so that $subscribe handlers
 * receive strongly-typed event payloads instead of `any`.
 *
 * The union is generated at the type level via mapped types over entity names
 * and verb conjugations, and at runtime via `generateEventTypes()` which
 * reads from the noun registry.
 *
 * @packageDocumentation
 */

// =============================================================================
// Base Event Shapes
// =============================================================================

/** Common fields shared by every event in the discriminated union */
export interface BaseEntityEvent {
  /** Unique event ID (format: evt_{sqid}) */
  $id: string
  /** ISO timestamp */
  timestamp: string
  /** Entity version after this event */
  version: number
  /** Tenant context */
  context?: string
  /** Actor who triggered the event */
  actor?: string
}

/** Event produced by a 'create' verb */
export interface CreatedEvent<EntityType extends string, Data = Record<string, unknown>> extends BaseEntityEvent {
  $type: `${EntityType}.created`
  entityType: EntityType
  verb: 'create'
  data: Data
}

/** Event produced by an 'update' verb */
export interface UpdatedEvent<EntityType extends string, Data = Record<string, unknown>> extends BaseEntityEvent {
  $type: `${EntityType}.updated`
  entityType: EntityType
  verb: 'update'
  data: Partial<Data>
  previousData: Data
}

/** Event produced by a 'delete' verb */
export interface DeletedEvent<EntityType extends string> extends BaseEntityEvent {
  $type: `${EntityType}.deleted`
  entityType: EntityType
  verb: 'delete'
  entityId: string
}

/** Event produced by a custom verb (qualify, close, ship, etc.) */
export interface CustomVerbEvent<
  EntityType extends string,
  VerbEvent extends string,
  Verb extends string = string,
  Data = Record<string, unknown>,
> extends BaseEntityEvent {
  $type: `${EntityType}.${VerbEvent}`
  entityType: EntityType
  verb: Verb
  data: Data
  performedBy?: string
}

// =============================================================================
// Entity-Specific Event Types (all 35 entities)
// =============================================================================

// --- Identity ---

export type UserEvent =
  | CreatedEvent<'User'>
  | UpdatedEvent<'User'>
  | DeletedEvent<'User'>
  | CustomVerbEvent<'User', 'invited', 'invite'>
  | CustomVerbEvent<'User', 'suspended', 'suspend'>
  | CustomVerbEvent<'User', 'activated', 'activate'>

export type ApiKeyEvent =
  | CreatedEvent<'ApiKey'>
  | UpdatedEvent<'ApiKey'>
  | DeletedEvent<'ApiKey'>
  | CustomVerbEvent<'ApiKey', 'revoked', 'revoke'>

// --- CRM ---

export type OrganizationEvent =
  | CreatedEvent<'Organization'>
  | UpdatedEvent<'Organization'>
  | DeletedEvent<'Organization'>
  | CustomVerbEvent<'Organization', 'enriched', 'enrich'>
  | CustomVerbEvent<'Organization', 'scored', 'score'>

export type ContactEvent =
  | CreatedEvent<'Contact'>
  | UpdatedEvent<'Contact'>
  | DeletedEvent<'Contact'>
  | CustomVerbEvent<'Contact', 'qualified', 'qualify'>
  | CustomVerbEvent<'Contact', 'captured', 'capture'>
  | CustomVerbEvent<'Contact', 'assigned', 'assign'>
  | CustomVerbEvent<'Contact', 'merged', 'merge'>
  | CustomVerbEvent<'Contact', 'enriched', 'enrich'>

export type LeadEvent =
  | CreatedEvent<'Lead'>
  | UpdatedEvent<'Lead'>
  | DeletedEvent<'Lead'>
  | CustomVerbEvent<'Lead', 'converted', 'convert'>
  | CustomVerbEvent<'Lead', 'lost', 'lose'>

export type DealEvent =
  | CreatedEvent<'Deal'>
  | UpdatedEvent<'Deal'>
  | DeletedEvent<'Deal'>
  | CustomVerbEvent<'Deal', 'closed', 'close'>
  | CustomVerbEvent<'Deal', 'won', 'win'>
  | CustomVerbEvent<'Deal', 'lost', 'lose'>
  | CustomVerbEvent<'Deal', 'advanced', 'advance'>
  | CustomVerbEvent<'Deal', 'reopened', 'reopen'>

export type ActivityEvent =
  | CreatedEvent<'Activity'>
  | UpdatedEvent<'Activity'>
  | DeletedEvent<'Activity'>
  | CustomVerbEvent<'Activity', 'completed', 'complete'>
  | CustomVerbEvent<'Activity', 'cancelled', 'cancel'>
  | CustomVerbEvent<'Activity', 'logged', 'log'>

export type PipelineEvent =
  | CreatedEvent<'Pipeline'>
  | UpdatedEvent<'Pipeline'>
  | DeletedEvent<'Pipeline'>

// --- Billing ---

export type CustomerEvent =
  | CreatedEvent<'Customer'>
  | UpdatedEvent<'Customer'>
  | DeletedEvent<'Customer'>

export type ProductEvent =
  | CreatedEvent<'Product'>
  | UpdatedEvent<'Product'>
  | DeletedEvent<'Product'>

export type PlanEvent =
  | CreatedEvent<'Plan'>
  | UpdatedEvent<'Plan'>
  | DeletedEvent<'Plan'>

export type PriceEvent =
  | CreatedEvent<'Price'>
  | UpdatedEvent<'Price'>
  | DeletedEvent<'Price'>

export type SubscriptionEvent =
  | CreatedEvent<'Subscription'>
  | UpdatedEvent<'Subscription'>
  | DeletedEvent<'Subscription'>
  | CustomVerbEvent<'Subscription', 'paused', 'pause'>
  | CustomVerbEvent<'Subscription', 'cancelled', 'cancel'>
  | CustomVerbEvent<'Subscription', 'reactivated', 'reactivate'>
  | CustomVerbEvent<'Subscription', 'upgraded', 'upgrade'>
  | CustomVerbEvent<'Subscription', 'downgraded', 'downgrade'>
  | CustomVerbEvent<'Subscription', 'activated', 'activate'>
  | CustomVerbEvent<'Subscription', 'renewed', 'renew'>

export type InvoiceEvent =
  | CreatedEvent<'Invoice'>
  | UpdatedEvent<'Invoice'>
  | DeletedEvent<'Invoice'>
  | CustomVerbEvent<'Invoice', 'paid', 'pay'>
  | CustomVerbEvent<'Invoice', 'voided', 'void'>
  | CustomVerbEvent<'Invoice', 'finalized', 'finalize'>

export type PaymentEvent =
  | CreatedEvent<'Payment'>
  | UpdatedEvent<'Payment'>
  | DeletedEvent<'Payment'>
  | CustomVerbEvent<'Payment', 'refunded', 'refund'>
  | CustomVerbEvent<'Payment', 'captured', 'capture'>

// --- Projects ---

export type ProjectEvent =
  | CreatedEvent<'Project'>
  | UpdatedEvent<'Project'>
  | DeletedEvent<'Project'>
  | CustomVerbEvent<'Project', 'archived', 'archive'>
  | CustomVerbEvent<'Project', 'completed', 'complete'>
  | CustomVerbEvent<'Project', 'activated', 'activate'>

export type IssueEvent =
  | CreatedEvent<'Issue'>
  | UpdatedEvent<'Issue'>
  | DeletedEvent<'Issue'>
  | CustomVerbEvent<'Issue', 'assigned', 'assign'>
  | CustomVerbEvent<'Issue', 'closed', 'close'>
  | CustomVerbEvent<'Issue', 'reopened', 'reopen'>

export type CommentEvent =
  | CreatedEvent<'Comment'>
  | UpdatedEvent<'Comment'>
  | DeletedEvent<'Comment'>
  | CustomVerbEvent<'Comment', 'resolved', 'resolve'>

// --- Content ---

export type ContentEvent =
  | CreatedEvent<'Content'>
  | UpdatedEvent<'Content'>
  | DeletedEvent<'Content'>
  | CustomVerbEvent<'Content', 'published', 'publish'>
  | CustomVerbEvent<'Content', 'archived', 'archive'>
  | CustomVerbEvent<'Content', 'scheduled', 'schedule'>

export type AssetEvent =
  | CreatedEvent<'Asset'>
  | UpdatedEvent<'Asset'>
  | DeletedEvent<'Asset'>
  | CustomVerbEvent<'Asset', 'processed', 'process'>

export type SiteEvent =
  | CreatedEvent<'Site'>
  | UpdatedEvent<'Site'>
  | DeletedEvent<'Site'>

// --- Support ---

export type TicketEvent =
  | CreatedEvent<'Ticket'>
  | UpdatedEvent<'Ticket'>
  | DeletedEvent<'Ticket'>
  | CustomVerbEvent<'Ticket', 'assigned', 'assign'>
  | CustomVerbEvent<'Ticket', 'resolved', 'resolve'>
  | CustomVerbEvent<'Ticket', 'escalated', 'escalate'>
  | CustomVerbEvent<'Ticket', 'closed', 'close'>
  | CustomVerbEvent<'Ticket', 'reopened', 'reopen'>

// --- Analytics ---

export type AnalyticsEventEvent =
  | CreatedEvent<'Event'>

export type MetricEvent =
  | CreatedEvent<'Metric'>
  | UpdatedEvent<'Metric'>
  | DeletedEvent<'Metric'>
  | CustomVerbEvent<'Metric', 'recorded', 'record'>
  | CustomVerbEvent<'Metric', 'reset', 'reset'>
  | CustomVerbEvent<'Metric', 'snapshotted', 'snapshot'>

export type FunnelEvent =
  | CreatedEvent<'Funnel'>
  | UpdatedEvent<'Funnel'>
  | DeletedEvent<'Funnel'>
  | CustomVerbEvent<'Funnel', 'analyzed', 'analyze'>
  | CustomVerbEvent<'Funnel', 'activated', 'activate'>

export type GoalEvent =
  | CreatedEvent<'Goal'>
  | UpdatedEvent<'Goal'>
  | DeletedEvent<'Goal'>
  | CustomVerbEvent<'Goal', 'achieved', 'achieve'>
  | CustomVerbEvent<'Goal', 'completed', 'complete'>
  | CustomVerbEvent<'Goal', 'missed', 'miss'>
  | CustomVerbEvent<'Goal', 'reset', 'reset'>

// --- Marketing ---

export type CampaignEvent =
  | CreatedEvent<'Campaign'>
  | UpdatedEvent<'Campaign'>
  | DeletedEvent<'Campaign'>
  | CustomVerbEvent<'Campaign', 'launched', 'launch'>
  | CustomVerbEvent<'Campaign', 'paused', 'pause'>
  | CustomVerbEvent<'Campaign', 'completed', 'complete'>

export type SegmentEvent =
  | CreatedEvent<'Segment'>
  | UpdatedEvent<'Segment'>
  | DeletedEvent<'Segment'>
  | CustomVerbEvent<'Segment', 'refreshed', 'refresh'>

export type FormEvent =
  | CreatedEvent<'Form'>
  | UpdatedEvent<'Form'>
  | DeletedEvent<'Form'>
  | CustomVerbEvent<'Form', 'published', 'publish'>
  | CustomVerbEvent<'Form', 'archived', 'archive'>
  | CustomVerbEvent<'Form', 'submitted', 'submit'>

// --- Experiments ---

export type ExperimentEvent =
  | CreatedEvent<'Experiment'>
  | UpdatedEvent<'Experiment'>
  | DeletedEvent<'Experiment'>
  | CustomVerbEvent<'Experiment', 'started', 'start'>
  | CustomVerbEvent<'Experiment', 'concluded', 'conclude'>
  | CustomVerbEvent<'Experiment', 'paused', 'pause'>
  | CustomVerbEvent<'Experiment', 'stopped', 'stop'>

export type FeatureFlagEvent =
  | CreatedEvent<'FeatureFlag'>
  | UpdatedEvent<'FeatureFlag'>
  | DeletedEvent<'FeatureFlag'>
  | CustomVerbEvent<'FeatureFlag', 'rolledOut', 'rollout'>
  | CustomVerbEvent<'FeatureFlag', 'enabled', 'enable'>
  | CustomVerbEvent<'FeatureFlag', 'disabled', 'disable'>

// --- Platform ---

export type WorkflowEvent =
  | CreatedEvent<'Workflow'>
  | UpdatedEvent<'Workflow'>
  | DeletedEvent<'Workflow'>
  | CustomVerbEvent<'Workflow', 'activated', 'activate'>
  | CustomVerbEvent<'Workflow', 'paused', 'pause'>
  | CustomVerbEvent<'Workflow', 'triggered', 'trigger'>
  | CustomVerbEvent<'Workflow', 'archived', 'archive'>

export type IntegrationEvent =
  | CreatedEvent<'Integration'>
  | UpdatedEvent<'Integration'>
  | DeletedEvent<'Integration'>
  | CustomVerbEvent<'Integration', 'connected', 'connect'>
  | CustomVerbEvent<'Integration', 'disconnected', 'disconnect'>
  | CustomVerbEvent<'Integration', 'synced', 'sync'>

export type AgentEvent =
  | CreatedEvent<'Agent'>
  | UpdatedEvent<'Agent'>
  | DeletedEvent<'Agent'>
  | CustomVerbEvent<'Agent', 'done', 'do'>
  | CustomVerbEvent<'Agent', 'asked', 'ask'>
  | CustomVerbEvent<'Agent', 'decided', 'decide'>
  | CustomVerbEvent<'Agent', 'approved', 'approve'>
  | CustomVerbEvent<'Agent', 'notified', 'notify'>
  | CustomVerbEvent<'Agent', 'delegated', 'delegate'>
  | CustomVerbEvent<'Agent', 'escalated', 'escalate'>
  | CustomVerbEvent<'Agent', 'learned', 'learn'>
  | CustomVerbEvent<'Agent', 'reflected', 'reflect'>
  | CustomVerbEvent<'Agent', 'invoked', 'invoke'>
  | CustomVerbEvent<'Agent', 'deployed', 'deploy'>
  | CustomVerbEvent<'Agent', 'paused', 'pause'>
  | CustomVerbEvent<'Agent', 'stopped', 'stop'>
  | CustomVerbEvent<'Agent', 'retired', 'retire'>

// --- Communication ---

export type MessageEvent =
  | CreatedEvent<'Message'>
  | UpdatedEvent<'Message'>
  | DeletedEvent<'Message'>
  | CustomVerbEvent<'Message', 'sent', 'send'>
  | CustomVerbEvent<'Message', 'delivered', 'deliver'>
  | CustomVerbEvent<'Message', 'read', 'read'>

// =============================================================================
// The Master Discriminated Union
// =============================================================================

/**
 * EntityEvent — the full discriminated union of all entity events.
 *
 * Switch on `$type` (e.g. 'Contact.qualified') or `entityType` + `verb`
 * to narrow to a specific event shape:
 *
 * ```typescript
 * function handleEvent(event: EntityEvent) {
 *   switch (event.$type) {
 *     case 'Contact.qualified':
 *       // event is CustomVerbEvent<'Contact', 'qualified', 'qualify'>
 *       break
 *     case 'Deal.closed':
 *       // event is CustomVerbEvent<'Deal', 'closed', 'close'>
 *       break
 *   }
 * }
 * ```
 */
export type EntityEvent =
  // Identity
  | UserEvent
  | ApiKeyEvent
  // CRM
  | OrganizationEvent
  | ContactEvent
  | LeadEvent
  | DealEvent
  | ActivityEvent
  | PipelineEvent
  // Billing
  | CustomerEvent
  | ProductEvent
  | PlanEvent
  | PriceEvent
  | SubscriptionEvent
  | InvoiceEvent
  | PaymentEvent
  // Projects
  | ProjectEvent
  | IssueEvent
  | CommentEvent
  // Content
  | ContentEvent
  | AssetEvent
  | SiteEvent
  // Support
  | TicketEvent
  // Analytics
  | AnalyticsEventEvent
  | MetricEvent
  | FunnelEvent
  | GoalEvent
  // Marketing
  | CampaignEvent
  | SegmentEvent
  | FormEvent
  // Experiments
  | ExperimentEvent
  | FeatureFlagEvent
  // Platform
  | WorkflowEvent
  | IntegrationEvent
  | AgentEvent
  // Communication
  | MessageEvent

// =============================================================================
// Entity Name Type
// =============================================================================

/** All entity type names */
export type EntityTypeName =
  | 'User' | 'ApiKey'
  | 'Organization' | 'Contact' | 'Lead' | 'Deal' | 'Activity' | 'Pipeline'
  | 'Customer' | 'Product' | 'Plan' | 'Price' | 'Subscription' | 'Invoice' | 'Payment'
  | 'Project' | 'Issue' | 'Comment'
  | 'Content' | 'Asset' | 'Site'
  | 'Ticket'
  | 'Event' | 'Metric' | 'Funnel' | 'Goal'
  | 'Campaign' | 'Segment' | 'Form'
  | 'Experiment' | 'FeatureFlag'
  | 'Workflow' | 'Integration' | 'Agent'
  | 'Message'

// =============================================================================
// Event Type String Union (all possible $type values)
// =============================================================================

/** Extract all possible $type values from the EntityEvent union */
export type EntityEventType = EntityEvent['$type']

// =============================================================================
// Typed Event Extraction
// =============================================================================

/**
 * Extract events for a specific entity type from the union.
 *
 * @example
 * type ContactEvents = EventsFor<'Contact'>
 * // = ContactEvent union members only
 */
export type EventsFor<T extends EntityTypeName> = Extract<EntityEvent, { entityType: T }>

/**
 * Extract a specific event by its $type discriminator.
 *
 * @example
 * type QualifiedEvent = EventByType<'Contact.qualified'>
 * // = CustomVerbEvent<'Contact', 'qualified', 'qualify'>
 */
export type EventByType<T extends EntityEventType> = Extract<EntityEvent, { $type: T }>

// =============================================================================
// Typed Subscribe Handler
// =============================================================================

/**
 * Typed event handler that narrows the event based on the pattern string.
 *
 * When subscribing with a specific pattern like 'Contact.qualified',
 * the handler receives the narrowed event type automatically.
 */
export type TypedEventHandler<T extends EntityEventType> = (event: EventByType<T>) => void | Promise<void>

/**
 * Handler for all events of a specific entity type.
 */
export type EntityEventHandler<T extends EntityTypeName> = (event: EventsFor<T>) => void | Promise<void>

/**
 * Handler for any entity event (no narrowing).
 */
export type AnyEventHandler = (event: EntityEvent) => void | Promise<void>

// =============================================================================
// Typed Subscribe Overloads
// =============================================================================

/**
 * Typed $subscribe interface — provides type narrowing based on pattern.
 *
 * ```typescript
 * // Exact event type — fully narrowed
 * org.$subscribe('Contact.qualified', (event) => {
 *   // event: CustomVerbEvent<'Contact', 'qualified', 'qualify'>
 * })
 *
 * // All events for an entity type
 * org.$subscribe('Contact.*', (event) => {
 *   // event: ContactEvent
 * })
 *
 * // All events
 * org.$subscribe('*', (event) => {
 *   // event: EntityEvent
 * })
 * ```
 */
export interface TypedSubscribe {
  /** Subscribe to a specific event type */
  <T extends EntityEventType>(pattern: T, handler: TypedEventHandler<T>): () => void
  /** Subscribe to all events for an entity type (pattern: '{EntityType}.*') */
  <T extends EntityTypeName>(pattern: `${T}.*`, handler: EntityEventHandler<T>): () => void
  /** Subscribe to all events matching a wildcard verb (pattern: '*.{verb}') */
  (pattern: `*.${string}`, handler: AnyEventHandler): () => void
  /** Subscribe to all events */
  (pattern: '*', handler: AnyEventHandler): () => void
  /** Subscribe with any pattern string (fallback) */
  (pattern: string, handler: AnyEventHandler): () => void
}

// =============================================================================
// Runtime: Generate Event Type Metadata from Noun Registry
// =============================================================================

/** Runtime event type descriptor (for introspection, not type narrowing) */
export interface EventTypeDescriptor {
  /** The $type string, e.g. 'Contact.qualified' */
  type: string
  /** The entity type name, e.g. 'Contact' */
  entityType: string
  /** The verb action, e.g. 'qualify' */
  verb: string
  /** The verb event form (past tense), e.g. 'qualified' */
  verbEvent: string
  /** Whether this is a CRUD verb */
  isCrud: boolean
}

/**
 * Generate event type descriptors from the noun registry at runtime.
 *
 * Reads all registered Noun schemas and enumerates their verbs to produce
 * a complete list of event type strings and metadata. This is the runtime
 * counterpart to the static discriminated union types.
 *
 * @param nounRegistry - Map of noun name to schema (from getAllNouns())
 * @returns Array of event type descriptors
 *
 * @example
 * ```typescript
 * import { getAllNouns } from 'digital-objects'
 * import { generateEventTypes } from '@headlessly/events'
 *
 * const descriptors = generateEventTypes(getAllNouns())
 * // [
 * //   { type: 'Contact.created', entityType: 'Contact', verb: 'create', verbEvent: 'created', isCrud: true },
 * //   { type: 'Contact.updated', entityType: 'Contact', verb: 'update', verbEvent: 'updated', isCrud: true },
 * //   { type: 'Contact.deleted', entityType: 'Contact', verb: 'delete', verbEvent: 'deleted', isCrud: true },
 * //   { type: 'Contact.qualified', entityType: 'Contact', verb: 'qualify', verbEvent: 'qualified', isCrud: false },
 * //   ...
 * // ]
 * ```
 */
export function generateEventTypes(
  nounRegistry: Map<string, { name: string; verbs: Map<string, { action: string; event: string }> }>,
): EventTypeDescriptor[] {
  const CRUD_VERBS = new Set(['create', 'update', 'delete'])
  const descriptors: EventTypeDescriptor[] = []

  for (const [, schema] of nounRegistry) {
    for (const [, conjugation] of schema.verbs) {
      descriptors.push({
        type: `${schema.name}.${conjugation.event}`,
        entityType: schema.name,
        verb: conjugation.action,
        verbEvent: conjugation.event,
        isCrud: CRUD_VERBS.has(conjugation.action),
      })
    }
  }

  return descriptors
}

/**
 * Generate all possible event type strings from the noun registry.
 *
 * Convenience wrapper around generateEventTypes() that returns just the
 * type strings (e.g. 'Contact.qualified', 'Deal.closed').
 */
export function generateEventTypeStrings(
  nounRegistry: Map<string, { name: string; verbs: Map<string, { action: string; event: string }> }>,
): string[] {
  return generateEventTypes(nounRegistry).map((d) => d.type)
}

/**
 * Validate that an event $type string is a known event type.
 *
 * Uses the noun registry to check whether the type corresponds to
 * a registered entity + verb combination.
 */
export function isValidEventType(
  type: string,
  nounRegistry: Map<string, { name: string; verbs: Map<string, { action: string; event: string }> }>,
): boolean {
  const [entityType, verbEvent] = type.split('.')
  if (!entityType || !verbEvent) return false

  const schema = nounRegistry.get(entityType)
  if (!schema) return false

  for (const [, conjugation] of schema.verbs) {
    if (conjugation.event === verbEvent) return true
  }

  return false
}
