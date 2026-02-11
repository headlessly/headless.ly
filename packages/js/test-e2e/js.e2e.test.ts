/**
 * E2E Tests for @headlessly/js — Browser SDK
 *
 * Validates exports, constructors, and API surface of the browser SDK.
 * Runs in Node.js (no real browser) so window/document-dependent features
 * are tested structurally rather than behaviourally.
 */

import { describe, it, expect } from 'vitest'
import { headlessly, HeadlessClient, createClient, track, page, identify, setUser, captureException, captureMessage } from '../src/index.js'
import type { HeadlessConfig } from '../src/index.js'

// =============================================================================
// 1. Exports exist
// =============================================================================

describe('@headlessly/js exports', () => {
  it('exports headlessly as a function', () => {
    expect(headlessly).toBeDefined()
    expect(typeof headlessly).toBe('function')
  })

  it('exports HeadlessClient as a class', () => {
    expect(HeadlessClient).toBeDefined()
    expect(typeof HeadlessClient).toBe('function')
  })

  it('exports createClient as a function', () => {
    expect(createClient).toBeDefined()
    expect(typeof createClient).toBe('function')
  })

  it('exports singleton track function', () => {
    expect(track).toBeDefined()
    expect(typeof track).toBe('function')
  })

  it('exports singleton page function', () => {
    expect(page).toBeDefined()
    expect(typeof page).toBe('function')
  })

  it('exports singleton identify function', () => {
    expect(identify).toBeDefined()
    expect(typeof identify).toBe('function')
  })

  it('exports singleton setUser function', () => {
    expect(setUser).toBeDefined()
    expect(typeof setUser).toBe('function')
  })

  it('exports singleton captureException function', () => {
    expect(captureException).toBeDefined()
    expect(typeof captureException).toBe('function')
  })

  it('exports singleton captureMessage function', () => {
    expect(captureMessage).toBeDefined()
    expect(typeof captureMessage).toBe('function')
  })
})

// =============================================================================
// 2. HeadlessClient instantiation
// =============================================================================

describe('HeadlessClient', () => {
  it('can be instantiated without config', () => {
    const client = new HeadlessClient()
    expect(client).toBeDefined()
    expect(client).toBeInstanceOf(HeadlessClient)
  })

  it('has expected analytics methods', () => {
    const client = new HeadlessClient()
    expect(typeof client.track).toBe('function')
    expect(typeof client.page).toBe('function')
    expect(typeof client.identify).toBe('function')
    expect(typeof client.alias).toBe('function')
    expect(typeof client.group).toBe('function')
  })

  it('has expected error capture methods', () => {
    const client = new HeadlessClient()
    expect(typeof client.captureException).toBe('function')
    expect(typeof client.captureMessage).toBe('function')
  })

  it('has expected context methods', () => {
    const client = new HeadlessClient()
    expect(typeof client.setUser).toBe('function')
    expect(typeof client.setTag).toBe('function')
    expect(typeof client.setTags).toBe('function')
    expect(typeof client.setExtra).toBe('function')
    expect(typeof client.addBreadcrumb).toBe('function')
  })

  it('has expected feature flag methods', () => {
    const client = new HeadlessClient()
    expect(typeof client.getFeatureFlag).toBe('function')
    expect(typeof client.isFeatureEnabled).toBe('function')
    expect(typeof client.getAllFlags).toBe('function')
    expect(typeof client.reloadFeatureFlags).toBe('function')
    expect(typeof client.onFlagChange).toBe('function')
  })

  it('has expected lifecycle methods', () => {
    const client = new HeadlessClient()
    expect(typeof client.optOut).toBe('function')
    expect(typeof client.optIn).toBe('function')
    expect(typeof client.hasOptedOut).toBe('function')
    expect(typeof client.reset).toBe('function')
    expect(typeof client.getDistinctId).toBe('function')
    expect(typeof client.getSessionId).toBe('function')
    expect(typeof client.flush).toBe('function')
    expect(typeof client.shutdown).toBe('function')
  })

  it('has expected forwarding methods', () => {
    const client = new HeadlessClient()
    expect(typeof client.addForwarder).toBe('function')
    expect(typeof client.removeForwarder).toBe('function')
    expect(typeof client.getForwarders).toBe('function')
  })

  it('has expected realtime methods', () => {
    const client = new HeadlessClient()
    expect(typeof client.subscribe).toBe('function')
    expect(typeof client.connectRealtime).toBe('function')
    expect(typeof client.disconnectRealtime).toBe('function')
  })
})

// =============================================================================
// 3. createClient factory
// =============================================================================

describe('createClient()', () => {
  it('returns a HeadlessClient instance', () => {
    const client = createClient({ apiKey: 'hl_test_e2e_js' })
    expect(client).toBeInstanceOf(HeadlessClient)
  })

  it('returned client has track/page/identify methods', () => {
    const client = createClient({ apiKey: 'hl_test_e2e_js' })
    expect(typeof client.track).toBe('function')
    expect(typeof client.page).toBe('function')
    expect(typeof client.identify).toBe('function')
    expect(typeof client.setUser).toBe('function')
    expect(typeof client.captureException).toBe('function')
  })

  it('accepts persistence option', () => {
    // memory persistence avoids localStorage/sessionStorage in Node
    const client = createClient({ apiKey: 'hl_test_e2e_js', persistence: 'memory' })
    expect(client).toBeInstanceOf(HeadlessClient)
  })
})

// =============================================================================
// 4. Client initialization with config
// =============================================================================

describe('client initialization', () => {
  it('init() throws when apiKey is missing', () => {
    const client = new HeadlessClient()
    expect(() => client.init({} as HeadlessConfig)).toThrow('apiKey is required')
  })

  it('init() succeeds with apiKey and memory persistence', () => {
    const client = new HeadlessClient()
    expect(() => client.init({ apiKey: 'hl_test_key', persistence: 'memory' })).not.toThrow()
  })

  it('tracks opt-out state', () => {
    const client = createClient({ apiKey: 'hl_test_key', persistence: 'memory' })
    expect(client.hasOptedOut()).toBe(false)
    client.optOut()
    expect(client.hasOptedOut()).toBe(true)
    client.optIn()
    expect(client.hasOptedOut()).toBe(false)
  })

  it('generates distinct and session IDs', () => {
    const client = createClient({ apiKey: 'hl_test_key', persistence: 'memory' })
    const distinctId = client.getDistinctId()
    const sessionId = client.getSessionId()
    expect(typeof distinctId).toBe('string')
    expect(distinctId.length).toBeGreaterThan(0)
    expect(typeof sessionId).toBe('string')
    expect(sessionId.length).toBeGreaterThan(0)
  })

  it('reset clears state', async () => {
    const client = createClient({ apiKey: 'hl_test_key', persistence: 'memory' })
    const id1 = client.getDistinctId()
    client.reset()
    const id2 = client.getDistinctId()
    // After reset, a new anonymous ID is generated
    expect(id2).not.toBe(id1)
  })

  it('getAllFlags returns empty object before any flags load', () => {
    const client = createClient({ apiKey: 'hl_test_key', persistence: 'memory' })
    const flags = client.getAllFlags()
    expect(flags).toBeDefined()
    expect(typeof flags).toBe('object')
  })

  it('getForwarders returns empty array initially', () => {
    const client = createClient({ apiKey: 'hl_test_key', persistence: 'memory' })
    const forwarders = client.getForwarders()
    expect(Array.isArray(forwarders)).toBe(true)
    expect(forwarders).toHaveLength(0)
  })

  it('shutdown resolves cleanly', async () => {
    const client = createClient({ apiKey: 'hl_test_key', persistence: 'memory' })
    await expect(client.shutdown()).resolves.toBeUndefined()
  })
})
