import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getTokens, setTokens } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(getTokens()))

  useEffect(() => {
    if (!getTokens()) return
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setTokens(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const onLogout = () => setUser(null)
    window.addEventListener('sweet-orders-logout', onLogout)
    return () => window.removeEventListener('sweet-orders-logout', onLogout)
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } })
    setTokens(data.tokens)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (form) => {
    const data = await api('/auth/register', { method: 'POST', body: form })
    setTokens(data.tokens)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    const tokens = getTokens()
    if (tokens?.refresh_token) await api('/auth/logout', { method: 'POST', body: { refresh_token: tokens.refresh_token } }).catch(() => {})
    setTokens(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, setUser, loading, login, register, logout, isAdmin: user?.role === 'admin' }),
    [user, loading, login, register, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
