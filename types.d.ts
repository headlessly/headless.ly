/**
 * headless.ly - Headless SaaS Platform for AI Agents
 * @generated from .db/ schemas
 */

import type { RPCClient } from 'rpc.do'

// RPC exports
export { rpc, $ } from 'rpc.do'

// Service clients
export declare function crm(options?: { apiKey?: string }): RPCClient
export declare function sell(options?: { apiKey?: string }): RPCClient
export declare function market(options?: { apiKey?: string }): RPCClient
export declare function erp(options?: { apiKey?: string }): RPCClient
export declare function support(options?: { apiKey?: string }): RPCClient
export declare function analytics(options?: { apiKey?: string }): RPCClient
export declare function db(options?: { apiKey?: string }): RPCClient

// ============================================================================
// Entity Types (generated from .db/schema/)
// ============================================================================

// TODO: Generate from .db/schema/*.ts

// ============================================================================
// RPC Method Types
// ============================================================================

// TODO: Generate from RPC definitions
