/**
 * headless.ly SDK tests
 * @generated
 */

import { describe, it, expect } from 'vitest'

describe('headless.ly', () => {
  it('should export rpc client', async () => {
    const { rpc } = await import('../src')
    expect(rpc).toBeDefined()
    expect(typeof rpc).toBe('function')
  })

  it('should export db client', async () => {
    const { db } = await import('../src')
    expect(db).toBeDefined()
  })

  it('should export CRM client', async () => {
    const { crm, CRMClient } = await import('../src')
    expect(crm).toBeDefined()
    expect(CRMClient).toBeDefined()
  })
})
