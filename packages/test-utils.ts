/**
 * Shared test utilities for all @headlessly/* packages
 */
import { beforeEach, expect } from 'vitest'
import { setProvider, clearRegistry } from 'digital-objects'
import type { NounInstance, NounEntity } from 'digital-objects'
import { LocalNounProvider } from '@headlessly/objects'

/**
 * Set up a fresh LocalNounProvider before each test.
 * Call this in a describe() block to get automatic cleanup.
 *
 * Returns the provider for direct access when needed.
 */
export function setupTestProvider(): { provider: LocalNounProvider } {
  const state = { provider: new LocalNounProvider() }

  beforeEach(() => {
    clearRegistry()
    state.provider = new LocalNounProvider()
    setProvider(state.provider)
  })

  return state
}

/**
 * Validate that an entity instance has all required meta-fields
 */
export function expectMetaFields(instance: NounInstance, type: string) {
  expect(instance.$id).toBeDefined()
  expect(instance.$id).toMatch(new RegExp(`^${type.toLowerCase()}_[a-zA-Z0-9]{8}$`))
  expect(instance.$type).toBe(type)
  expect(instance.$context).toBeDefined()
  expect(typeof instance.$context).toBe('string')
  expect(instance.$version).toBe(1)
  expect(instance.$createdAt).toBeDefined()
  expect(instance.$updatedAt).toBeDefined()
}

/**
 * Validate that an entity has standard CRUD verbs
 */
export function expectCrudVerbs(entity: NounEntity) {
  expect(typeof entity.create).toBe('function')
  expect(typeof entity.get).toBe('function')
  expect(typeof entity.find).toBe('function')
  expect(typeof entity.update).toBe('function')
  expect(typeof entity.delete).toBe('function')
}

/**
 * Validate a custom verb's conjugation forms exist on the entity proxy.
 *
 * @param entity - The Noun entity proxy
 * @param action - Action form (e.g., 'qualify')
 * @param activity - Activity/BEFORE form (e.g., 'qualifying')
 * @param event - Event/AFTER form (e.g., 'qualified')
 */
export function expectVerbConjugation(entity: NounEntity, action: string, activity: string, event: string) {
  expect(typeof entity[action]).toBe('function')
  expect(typeof entity[activity]).toBe('function')
  expect(typeof entity[event]).toBe('function')
}

/**
 * Run a full CRUD lifecycle test for an entity.
 *
 * Creates an entity, retrieves it, updates it, verifies version increment,
 * deletes it, and confirms it's gone.
 *
 * @param entity - The Noun entity proxy
 * @param type - Entity type name (e.g., 'Contact')
 * @param createData - Data to create the entity with
 * @param updateData - Data to update the entity with
 */
export async function testCrudLifecycle(entity: NounEntity, type: string, createData: Record<string, unknown>, updateData: Record<string, unknown>) {
  // Create
  const created = await entity.create(createData)
  expectMetaFields(created, type)
  for (const [key, value] of Object.entries(createData)) {
    expect(created[key]).toBe(value)
  }

  // Get
  const fetched = await entity.get(created.$id)
  expect(fetched).toBeDefined()
  expect(fetched!.$id).toBe(created.$id)

  // Update
  const updated = await entity.update(created.$id, updateData)
  expect(updated.$version).toBe(2)
  for (const [key, value] of Object.entries(updateData)) {
    expect(updated[key]).toBe(value)
  }

  // Delete
  const deleted = await entity.delete(created.$id)
  expect(deleted).toBe(true)

  // Verify gone
  const gone = await entity.get(created.$id)
  expect(gone).toBeNull()
}
