import { describe, it, expect } from 'vitest'
import { User, Member, ApiKey } from '../src/index.ts'
import { setupTestProvider, expectMetaFields, expectCrudVerbs, expectVerbConjugation, testCrudLifecycle } from '../../test-utils'

describe('@headlessly/auth', () => {
  setupTestProvider()

  describe('exports', () => {
    it('exports User', () => {
      expect(User).toBeDefined()
      expect(User.$name).toBe('User')
    })

    it('exports Member', () => {
      expect(Member).toBeDefined()
      expect(Member.$name).toBe('Member')
    })

    it('exports ApiKey', () => {
      expect(ApiKey).toBeDefined()
      expect(ApiKey.$name).toBe('ApiKey')
    })
  })

  describe('CRUD verbs', () => {
    it('User has CRUD verbs', () => {
      expectCrudVerbs(User)
    })

    it('Member has CRUD verbs', () => {
      expectCrudVerbs(Member)
    })

    it('ApiKey has CRUD verbs', () => {
      expectCrudVerbs(ApiKey)
    })
  })

  describe('verb conjugation', () => {
    it('User.invite conjugation', () => {
      expectVerbConjugation(User, 'invite', 'inviting', 'invited')
    })

    it('User.suspend conjugation', () => {
      expectVerbConjugation(User, 'suspend', 'suspending', 'suspended')
    })

    it('User.activate conjugation', () => {
      expectVerbConjugation(User, 'activate', 'activating', 'activated')
    })

    it('Member.invite conjugation', () => {
      expectVerbConjugation(Member, 'invite', 'inviting', 'invited')
    })

    it('Member.suspend conjugation', () => {
      expectVerbConjugation(Member, 'suspend', 'suspending', 'suspended')
    })

    it('Member.remove conjugation', () => {
      expectVerbConjugation(Member, 'remove', 'removing', 'removed')
    })

    it('Member.activate conjugation', () => {
      expectVerbConjugation(Member, 'activate', 'activating', 'activated')
    })

    it('ApiKey.revoke conjugation', () => {
      expectVerbConjugation(ApiKey, 'revoke', 'revoking', 'revoked')
    })
  })

  describe('create with meta-fields', () => {
    it('creates User with meta-fields', async () => {
      const user = await User.create({ name: 'Alice Chen', email: 'alice@acme.co' })
      expectMetaFields(user, 'User')
      expect(user.name).toBe('Alice Chen')
      expect(user.email).toBe('alice@acme.co')
    })

    it('creates Member with meta-fields', async () => {
      const member = await Member.create({ organization: 'org_fX9bL5nRd', role: 'Member' })
      expectMetaFields(member, 'Member')
      expect(member.organization).toBe('org_fX9bL5nRd')
      expect(member.role).toBe('Member')
    })

    it('creates ApiKey with meta-fields', async () => {
      const key = await ApiKey.create({ name: 'Production', keyPrefix: 'hly_sk_abc' })
      expectMetaFields(key, 'ApiKey')
      expect(key.name).toBe('Production')
    })
  })

  describe('full CRUD lifecycle', () => {
    it('User CRUD lifecycle', async () => {
      await testCrudLifecycle(User, 'User', { name: 'Alice Chen', email: 'alice@acme.co' }, { name: 'Alice Smith' })
    })

    it('Member CRUD lifecycle', async () => {
      await testCrudLifecycle(Member, 'Member', { organization: 'org_fX9bL5nRd', role: 'Member' }, { role: 'Admin' })
    })

    it('ApiKey CRUD lifecycle', async () => {
      await testCrudLifecycle(ApiKey, 'ApiKey', { name: 'Test Key', keyPrefix: 'hly_sk_test' }, { name: 'Renamed Key' })
    })
  })
})
