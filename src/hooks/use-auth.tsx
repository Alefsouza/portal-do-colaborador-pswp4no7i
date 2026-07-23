import { createContext, useContext, useState, type ReactNode } from 'react'
import {
  login as loginApi,
  changePassword as changePasswordApi,
  type AuthUser,
} from '@/services/auth'

const TOKEN_KEY = 'portal_token'
const USER_KEY = 'portal_user'

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  needsPasswordChange: boolean
  login: (cpf: string, senha: string) => Promise<{ error: string | null; user: AuthUser | null }>
  changePassword: (novaSenha: string) => Promise<{ error: string | null }>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))

  const login = async (cpf: string, senha: string) => {
    try {
      const result = await loginApi(cpf, senha)
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

  const changePassword = async (novaSenha: string) => {
    if (!token) return { error: 'Sessão inválida' }
    try {
      await changePasswordApi(token, novaSenha)
      const updatedUser = user ? { ...user, primeiro_acesso: false } : null
      if (updatedUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser))
        setUser(updatedUser)
      }
      return { error: null as string | null }
    } catch (err: unknown) {
      const e = err as { error?: string; message?: string }
      return { error: e?.error || e?.message || 'Erro ao alterar senha' }
    }
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        needsPasswordChange: !!user?.primeiro_acesso,
        login,
        changePassword,
        logout,
        loading: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
