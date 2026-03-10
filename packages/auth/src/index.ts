import { Noun } from 'digital-objects'

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export const User = Noun('User', {
  name: 'string!',
  email: 'string!##',
  avatar: 'string',
  role: 'Admin | Member | Viewer',
  status: 'Active | Suspended | Invited',
  invite: 'Invited',
  suspend: 'Suspended',
  activate: 'Activated',
})

export const Member = Noun('Member', {
  user: '-> User',
  organization: 'string!#',
  role: 'Owner | Admin | Member | Viewer | Agent',
  status: 'Active | Invited | Suspended | Removed',
  invite: 'Invited',
  suspend: 'Suspended',
  remove: 'Removed',
  activate: 'Activated',
})

export const ApiKey = Noun('ApiKey', {
  name: 'string!',
  keyPrefix: 'string!##',
  scopes: 'string',
  status: 'Active | Revoked | Expired',
  revoke: 'Revoked',
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string
  email?: string
  name?: string
  organizationId?: string
  roles?: string[]
  permissions?: string[]
}

export interface AuthSession {
  user: AuthUser
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export interface AuthConfig {
  /** API endpoint for auth requests (default: https://id.org.ai) */
  apiUrl?: string
  /** Client ID for OAuth flows */
  clientId?: string
  /** Callback URL after authentication */
  redirectUri?: string
  /** Storage backend for tokens */
  storage?: TokenStorage
}

export interface TokenStorage {
  getToken(): Promise<string | null>
  setToken(token: string): Promise<void>
  removeToken(): Promise<void>
  getTokenData?(): Promise<StoredTokenData | null>
  setTokenData?(data: StoredTokenData): Promise<void>
}

export interface StoredTokenData {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export type AuthLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4'

export type AuthChangeCallback = (session: AuthSession | null) => void

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_API_URL = 'https://id.org.ai'
const REFRESH_BUFFER_MS = 30_000

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

let _config: Required<Pick<AuthConfig, 'apiUrl'>> & AuthConfig = { apiUrl: DEFAULT_API_URL }
let _session: AuthSession | null = null
let _listeners: Set<AuthChangeCallback> = new Set()
let _refreshPromise: Promise<AuthSession | null> | null = null

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export function configure(config: AuthConfig): void {
  _config = { ..._config, ...config }
}

// ---------------------------------------------------------------------------
// Core auth functions
// ---------------------------------------------------------------------------

/**
 * Login with email/password or redirect to OAuth provider.
 */
export async function login(credentials: { email: string; password: string } | { provider: string }): Promise<AuthSession> {
  const res = await fetch(`${_config.apiUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new AuthError((body as { error?: { message?: string } }).error?.message || 'Login failed', res.status)
  }
  const data = (await res.json()) as { user: AuthUser; access_token: string; refresh_token?: string; expires_in?: number }
  const session: AuthSession = {
    user: data.user,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  }
  await _setSession(session)
  return session
}

/**
 * Logout and clear the current session.
 */
export async function logout(): Promise<void> {
  const token = _session?.accessToken
  if (token) {
    await fetch(`${_config.apiUrl}/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    }).catch(() => {})
  }
  await _setSession(null)
}

/**
 * Get the current session, refreshing if needed.
 */
export async function getSession(): Promise<AuthSession | null> {
  if (_session && _session.expiresAt && _session.expiresAt - Date.now() < REFRESH_BUFFER_MS) {
    return refreshSession()
  }
  if (!_session && _config.storage) {
    const data = await _config.storage.getTokenData?.()
    if (data?.accessToken) {
      const user = await fetchUser(data.accessToken)
      if (user) {
        _session = { user, accessToken: data.accessToken, refreshToken: data.refreshToken, expiresAt: data.expiresAt }
      }
    }
  }
  return _session
}

/**
 * Get the current access token, refreshing if needed.
 */
export async function getToken(): Promise<string | null> {
  const session = await getSession()
  return session?.accessToken ?? null
}

/**
 * Refresh the current session token.
 */
export async function refreshSession(): Promise<AuthSession | null> {
  if (_refreshPromise) return _refreshPromise
  _refreshPromise = _doRefresh().finally(() => {
    _refreshPromise = null
  })
  return _refreshPromise
}

/**
 * Subscribe to auth state changes. Returns an unsubscribe function.
 */
export function onAuthChange(callback: AuthChangeCallback): () => void {
  _listeners.add(callback)
  return () => _listeners.delete(callback)
}

/**
 * Check if the user is currently authenticated.
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

/**
 * Fetch the current user from the auth server.
 */
export async function fetchUser(token?: string): Promise<AuthUser | null> {
  const accessToken = token || _session?.accessToken
  if (!accessToken) return null
  const res = await fetch(`${_config.apiUrl}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    credentials: 'include',
  })
  if (!res.ok) return null
  const data = (await res.json()) as { user?: AuthUser } & AuthUser
  return data.user || data
}

// ---------------------------------------------------------------------------
// API key management
// ---------------------------------------------------------------------------

/**
 * Create a new API key.
 */
export async function createKey(options: { name: string; scopes?: string[] }): Promise<{ key: string; keyPrefix: string; id: string }> {
  const token = _session?.accessToken
  if (!token) throw new AuthError('Authentication required', 401)
  const res = await fetch(`${_config.apiUrl}/api-keys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new AuthError((body as { error?: { message?: string } }).error?.message || 'Failed to create API key', res.status)
  }
  return res.json() as Promise<{ key: string; keyPrefix: string; id: string }>
}

/**
 * Rotate an API key (create new, revoke old after grace period).
 */
export async function rotateKey(keyId: string): Promise<{ key: string; keyPrefix: string; id: string }> {
  const token = _session?.accessToken
  if (!token) throw new AuthError('Authentication required', 401)
  const res = await fetch(`${_config.apiUrl}/api-keys/${keyId}/rotate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new AuthError((body as { error?: { message?: string } }).error?.message || 'Failed to rotate API key', res.status)
  }
  return res.json() as Promise<{ key: string; keyPrefix: string; id: string }>
}

/**
 * Revoke an API key immediately.
 */
export async function revokeKey(keyId: string): Promise<void> {
  const token = _session?.accessToken
  if (!token) throw new AuthError('Authentication required', 401)
  const res = await fetch(`${_config.apiUrl}/api-keys/${keyId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new AuthError((body as { error?: { message?: string } }).error?.message || 'Failed to revoke API key', res.status)
  }
}

/**
 * List API keys for the current user.
 */
export async function listKeys(): Promise<Array<{ id: string; name: string; keyPrefix: string; scopes: string[]; status: string; createdAt: string }>> {
  const token = _session?.accessToken
  if (!token) throw new AuthError('Authentication required', 401)
  const res = await fetch(`${_config.apiUrl}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { keys?: Array<{ id: string; name: string; keyPrefix: string; scopes: string[]; status: string; createdAt: string }> }
  return data.keys || []
}

// ---------------------------------------------------------------------------
// Team management
// ---------------------------------------------------------------------------

export interface TeamMember {
  id: string
  userId: string
  email?: string
  name?: string
  role: string
  status: string
  joinedAt: string
}

/**
 * Invite a user to the current organization.
 */
export async function inviteMember(options: { email: string; role?: string }): Promise<TeamMember> {
  const token = _session?.accessToken
  if (!token) throw new AuthError('Authentication required', 401)
  const res = await fetch(`${_config.apiUrl}/members`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: options.email, role: options.role || 'Member' }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new AuthError((body as { error?: { message?: string } }).error?.message || 'Failed to invite member', res.status)
  }
  return res.json() as Promise<TeamMember>
}

/**
 * Remove a member from the organization.
 */
export async function removeMember(memberId: string): Promise<void> {
  const token = _session?.accessToken
  if (!token) throw new AuthError('Authentication required', 401)
  const res = await fetch(`${_config.apiUrl}/members/${memberId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new AuthError((body as { error?: { message?: string } }).error?.message || 'Failed to remove member', res.status)
  }
}

/**
 * List members of the current organization.
 */
export async function listMembers(): Promise<TeamMember[]> {
  const token = _session?.accessToken
  if (!token) throw new AuthError('Authentication required', 401)
  const res = await fetch(`${_config.apiUrl}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = (await res.json()) as { members?: TeamMember[] }
  return data.members || []
}

/**
 * Update a member's role in the organization.
 */
export async function updateMemberRole(memberId: string, role: string): Promise<TeamMember> {
  const token = _session?.accessToken
  if (!token) throw new AuthError('Authentication required', 401)
  const res = await fetch(`${_config.apiUrl}/members/${memberId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new AuthError((body as { error?: { message?: string } }).error?.message || 'Failed to update member role', res.status)
  }
  return res.json() as Promise<TeamMember>
}

// ---------------------------------------------------------------------------
// Auth provider (for SDK integration)
// ---------------------------------------------------------------------------

/**
 * Returns a token-provider function compatible with headlessly() factory.
 * Automatically refreshes tokens before expiry.
 */
export function auth(): () => Promise<string | null> {
  return getToken
}

// ---------------------------------------------------------------------------
// Reset (for testing)
// ---------------------------------------------------------------------------

export function reset(): void {
  _session = null
  _listeners.clear()
  _refreshPromise = null
  _config = { apiUrl: DEFAULT_API_URL }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function _doRefresh(): Promise<AuthSession | null> {
  const refreshToken = _session?.refreshToken
  if (!refreshToken) return null

  const res = await fetch(`${_config.apiUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    await _setSession(null)
    return null
  }

  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number; user?: AuthUser }
  const user = data.user || _session?.user
  if (!user) {
    await _setSession(null)
    return null
  }

  const session: AuthSession = {
    user,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
  }
  await _setSession(session)
  return session
}

async function _setSession(session: AuthSession | null): Promise<void> {
  _session = session
  if (_config.storage) {
    if (session) {
      if (_config.storage.setTokenData) {
        await _config.storage.setTokenData({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
        })
      } else {
        await _config.storage.setToken(session.accessToken)
      }
    } else {
      await _config.storage.removeToken()
    }
  }
  for (const listener of _listeners) {
    try {
      listener(session)
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}
