import { createContext, useContext, useState, type ReactNode } from 'react'
import { adminLogin, isTokenExpired, type AdminUser } from '@/services/admin-auth'

const TOKEN_KEY = 'admin_token'
const USER_KEY = 'admin_user'

interface AdminAuthContextType {
  user: AdminUser | null
  token: string | null
  isAuthenticated: boolean
  login: (cpf: string, senha: string) => Promise<{ error: string | null; user: AdminUser | null }>
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  return context
}

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (stored && isTokenExpired(stored)) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      return null
    }
    return stored
  })
  const [user, setUser] = useState<AdminUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const login = async (cpf: string, senha: string) => {
    try {
      const result = await adminLogin(cpf, senha)
      localStorage.setItem(TOKEN_KEY, result.token)
      localStorage.setItem(USER_KEY, JSON.stringify(result.user))
      setToken(result.token)
      setUser(result.user)
      return { error: null as string | null, user: result.user }
    } catch (err: unknown) {
      const e = err as { error?: string; message?: string }
      return { error: e?.error || e?.message || 'Erro ao fazer login', user: null }
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !isTokenExpired(token),
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}
