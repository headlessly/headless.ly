import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { AuthUser, AuthSession, AuthConfig } from './index'
import { configure, getSession, login as doLogin, logout as doLogout, onAuthChange, fetchUser, reset } from './index'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: AuthUser | null
  session: AuthSession | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: { email: string; password: string } | { provider: string }) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface AuthProviderProps extends AuthConfig {
  children: ReactNode
}

export function AuthProvider({ children, ...config }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    configure(config)
    getSession()
      .then(setSession)
      .finally(() => setIsLoading(false))

    const unsub = onAuthChange(setSession)
    return unsub
  }, [config.apiUrl, config.clientId])

  const login = useCallback(async (credentials: { email: string; password: string } | { provider: string }) => {
    await doLogin(credentials)
  }, [])

  const logout = useCallback(async () => {
    await doLogout()
  }, [])

  const refresh = useCallback(async () => {
    const s = await getSession()
    setSession(s)
  }, [])

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    isLoading,
    isAuthenticated: session !== null,
    login,
    logout,
    refresh,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Access the full auth context: user, session, login/logout functions.
 * Must be used within an AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

/**
 * Access just the current user (null if not authenticated).
 */
export function useUser(): AuthUser | null {
  return useAuth().user
}

/**
 * Returns true while the initial auth check is in progress.
 */
export function useAuthLoading(): boolean {
  return useAuth().isLoading
}

export { reset }
