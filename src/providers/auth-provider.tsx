import * as React from 'react'

import { db } from '@/db/database'
import { authApi, onUnauthorized, type AuthUser } from '@/sync/api'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  justRegistered: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

const SYNC_USER_KEY = 'mindora:sync-user'

async function resetLocalCache(): Promise<void> {
  await db.open().catch(() => undefined)
  const previousSettings = await db.settings.get('app').catch(() => undefined)
  await db.delete()
  await db.open()
  if (previousSettings) {
    await db.settings.put(previousSettings)
  }
  localStorage.removeItem(SYNC_USER_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [justRegistered, setJustRegistered] = React.useState(false)

  React.useEffect(() => {
    let active = true
    authApi
      .me()
      .then((result) => {
        if (active) setUser(result.user)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  React.useEffect(
    () =>
      onUnauthorized(() => {
        setUser(null)
        setJustRegistered(false)
      }),
    [],
  )

  const prepareAccount = async (nextUser: AuthUser, forceReset: boolean) => {
    const previousUser = localStorage.getItem(SYNC_USER_KEY)
    if (forceReset || previousUser !== nextUser.id) {
      await resetLocalCache()
    }
  }

  const login = async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    await prepareAccount(result.user, false)
    setJustRegistered(false)
    setUser(result.user)
  }

  const register = async (email: string, password: string) => {
    const result = await authApi.register(email, password)
    await resetLocalCache()
    setJustRegistered(true)
    setUser(result.user)
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch {
      // Local sign-out still proceeds if the network is unavailable.
    }
    await resetLocalCache()
    setJustRegistered(false)
    setUser(null)
  }

  const deleteAccount = async () => {
    await authApi.deleteAccount()
    await resetLocalCache()
    setJustRegistered(false)
    setUser(null)
  }

  const value: AuthContextValue = {
    user,
    loading,
    justRegistered,
    login,
    register,
    logout,
    deleteAccount,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = React.useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
