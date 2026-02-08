/**
 * @headlessly/js - Browser SDK
 *
 * Unified analytics, errors, and feature flags for the browser.
 *
 * @example
 * ```typescript
 * import headless from '@headlessly/js'
 *
 * headless.init({ apiKey: 'hl_xxx' })
 *
 * headless.page()
 * headless.track('signup_completed', { plan: 'pro' })
 * headless.identify('user_123', { email: 'user@example.com' })
 *
 * if (headless.isFeatureEnabled('new-checkout')) {
 *   // show new checkout
 * }
 *
 * try {
 *   doSomething()
 * } catch (err) {
 *   headless.captureException(err)
 * }
 * ```
 */

import { HeadlessClient } from './client.js'
import type { HeadlessConfig, User, Breadcrumb, WebVitals, FlagValue, FeatureFlag, Severity } from './types.js'

// Singleton instance
const headless = new HeadlessClient()

// Re-export types
export type {
  HeadlessConfig,
  AnalyticsEvent,
  ErrorEvent,
  WebVitals,
  Breadcrumb,
  User,
  FlagValue,
  FeatureFlag,
  Severity,
  EventType,
  StackFrame,
  Survey,
  SurveyQuestion,
  SurveyResponse,
} from './types.js'

export { HeadlessClient } from './client.js'

// Singleton API
export const init = (config: HeadlessConfig) => headless.init(config)
export const page = (name?: string, properties?: Record<string, unknown>) => headless.page(name, properties)
export const track = (event: string, properties?: Record<string, unknown>) => headless.track(event, properties)
export const identify = (userId: string, traits?: Record<string, unknown>) => headless.identify(userId, traits)
export const alias = (userId: string, previousId?: string) => headless.alias(userId, previousId)
export const group = (groupId: string, traits?: Record<string, unknown>) => headless.group(groupId, traits)

export const captureException = (error: Error, context?: { tags?: Record<string, string>; extra?: Record<string, unknown> }) =>
  headless.captureException(error, context)
export const captureMessage = (message: string, level?: Severity) => headless.captureMessage(message, level)

export const setUser = (user: User | null) => headless.setUser(user)
export const setTag = (key: string, value: string) => headless.setTag(key, value)
export const setTags = (tags: Record<string, string>) => headless.setTags(tags)
export const setExtra = (key: string, value: unknown) => headless.setExtra(key, value)
export const addBreadcrumb = (crumb: Breadcrumb) => headless.addBreadcrumb(crumb)

export const getFeatureFlag = (key: string) => headless.getFeatureFlag(key)
export const isFeatureEnabled = (key: string) => headless.isFeatureEnabled(key)
export const getAllFlags = () => headless.getAllFlags()
export const reloadFeatureFlags = () => headless.reloadFeatureFlags()

export const captureWebVitals = (metrics: Partial<WebVitals>) => headless.captureWebVitals(metrics)

export const optOut = () => headless.optOut()
export const optIn = () => headless.optIn()
export const hasOptedOut = () => headless.hasOptedOut()
export const reset = () => headless.reset()
export const getDistinctId = () => headless.getDistinctId()
export const getSessionId = () => headless.getSessionId()

export const flush = () => headless.flush()
export const shutdown = () => headless.shutdown()

export const getInstance = () => headless

export default {
  init,
  page,
  track,
  identify,
  alias,
  group,
  captureException,
  captureMessage,
  setUser,
  setTag,
  setTags,
  setExtra,
  addBreadcrumb,
  getFeatureFlag,
  isFeatureEnabled,
  getAllFlags,
  reloadFeatureFlags,
  captureWebVitals,
  optOut,
  optIn,
  hasOptedOut,
  reset,
  getDistinctId,
  getSessionId,
  flush,
  shutdown,
  getInstance,
}
