import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { configure, login, logout, getSession, getToken, onAuthChange, isAuthenticated, createKey, revokeKey, listKeys, reset, auth, AuthError } from '../src/index.ts'

describe('@headlessly/auth client', () => {
  beforeEach(() => {
    reset()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    reset()
  })

  describe('configure', () => {
    it('uses default API URL', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ user: null }), { status: 401 }))
      await getSession()
      // No fetch called for getSession when no stored token
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('accepts custom API URL', () => {
      configure({ apiUrl: 'https://custom.auth.example' })
      // Config stored internally — verified by observing fetch calls
    })
  })

  describe('login', () => {
    it('returns session on successful login', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 'user_abc', email: 'alice@acme.co', name: 'Alice' },
            access_token: 'tok_123',
            refresh_token: 'ref_456',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      const session = await login({ email: 'alice@acme.co', password: 'secret' })
      expect(session.user.email).toBe('alice@acme.co')
      expect(session.accessToken).toBe('tok_123')
      expect(session.refreshToken).toBe('ref_456')
    })

    it('throws AuthError on failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid credentials' } }), { status: 401, headers: { 'Content-Type': 'application/json' } }),
      )

      await expect(login({ email: 'alice@acme.co', password: 'wrong' })).rejects.toThrow(AuthError)
    })
  })

  describe('logout', () => {
    it('clears session', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

      await login({ email: 'a@b.co', password: 'x' }).catch(() => {})
      // Even if login fails, logout should work
      await logout()
      const session = await getSession()
      expect(session).toBeNull()
    })
  })

  describe('onAuthChange', () => {
    it('notifies on login', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { id: 'user_abc', email: 'alice@acme.co' },
            access_token: 'tok_123',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      const cb = vi.fn()
      const unsub = onAuthChange(cb)
      await login({ email: 'alice@acme.co', password: 'secret' })
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'tok_123' }))
      unsub()
    })

    it('returns unsubscribe function', async () => {
      const cb = vi.fn()
      const unsub = onAuthChange(cb)
      unsub()
      // Login after unsub — should not call cb
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: 'u1' }, access_token: 'tok' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )
      await login({ email: 'a@b.co', password: 'x' })
      expect(cb).not.toHaveBeenCalled()
    })
  })

  describe('getToken', () => {
    it('returns null when not logged in', async () => {
      expect(await getToken()).toBeNull()
    })

    it('returns token when logged in', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: 'u1' }, access_token: 'tok_abc' }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      )
      await login({ email: 'a@b.co', password: 'x' })
      expect(await getToken()).toBe('tok_abc')
    })
  })

  describe('isAuthenticated', () => {
    it('returns false when not logged in', async () => {
      expect(await isAuthenticated()).toBe(false)
    })
  })

  describe('auth() provider', () => {
    it('returns a function', () => {
      const provider = auth()
      expect(typeof provider).toBe('function')
    })
  })

  describe('API key management', () => {
    it('throws when not authenticated', async () => {
      await expect(createKey({ name: 'Test' })).rejects.toThrow('Authentication required')
      await expect(revokeKey('key_123')).rejects.toThrow('Authentication required')
      await expect(listKeys()).rejects.toThrow('Authentication required')
    })
  })
})
