import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  adminLogin,
  getStoredAdminToken,
  getStoredAdminUser,
  isTokenExpired,
  clearAdminAuth,
  type AdminUser,
} from '@/services/admin-auth'

interface AdminAuthContextType {
  user: AdminUser | null
  isAuthenticated: boolean
  signIn: (cpf: string, senha: string) => Promise<{ error: any }>
  signOut: () => void
  loading: boolean
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext)
  if (!context) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return context
}

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AdminUser | null>(() => getStoredAdminUser())
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const token = getStoredAdminToken()
    return !!token && !isTokenExpired(token)
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getStoredAdminToken()
    if (token && !isTokenExpired(token)) {
      pb.authStore.save(token, null)
      setUser(getStoredAdminUser())
      setIsAuthenticated(true)
    } else {
      clearAdminAuth()
      setUser(null)
      setIsAuthenticated(false)
    }
    setLoading(false)
  }, [])

  const signIn = async (cpf: string, senha: string) => {
    try {
      const res = await adminLogin(cpf, senha)
      setUser(res.user)
      setIsAuthenticated(true)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const signOut = () => {
    clearAdminAuth()
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AdminAuthContext.Provider value={{ user, isAuthenticated, signIn, signOut, loading }}>
      {children}
    </AdminAuthContext.Provider>
  )
}
