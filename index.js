/**
 * headless.ly - Headless SaaS Platform for AI Agents
 * @generated
 */

// RPC client - all functionality is RPC against the backend
export { rpc, $ } from 'rpc.do'

// Convenience exports for common services
export const crm = (opts) => rpc('crm', opts)
export const sell = (opts) => rpc('sell', opts)
export const market = (opts) => rpc('market', opts)
export const erp = (opts) => rpc('erp', opts)
export const support = (opts) => rpc('support', opts)
export const analytics = (opts) => rpc('analytics', opts)
export const db = (opts) => rpc('db', opts)

// Re-export from rpc.do
import { rpc } from 'rpc.do'
