import pb from '@/lib/pocketbase/client'

export interface AdminUser {
  id: string
  nome_completo: string
  cpf: string
  registro: string
  perfil: string
  departamento: string
  primeiro_acesso: boolean
}

export interface AdminLoginResponse {
  token: string
  user: AdminUser
}

const ADMIN_TOKEN_KEY = 'admin_token'
const ADMIN_USER_KEY = 'admin_user'

export function parseJwt(token: string): Record<string, any> | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token)
  if (!payload || !payload.exp) return true
  return Date.now() >= payload.exp * 1000
}

export async function adminLogin(cpf: string, senha: string): Promise<AdminLoginResponse> {
  const res = (await pb.send('/backend/v1/admin/login', {
    method: 'POST',
    body: JSON.stringify({ cpf, senha }),
    headers: { 'Content-Type': 'application/json' },
  })) as AdminLoginResponse

  localStorage.setItem(ADMIN_TOKEN_KEY, res.token)
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(res.user))
  pb.authStore.save(res.token, null)

  return res
}

export function getStoredAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}

export function getStoredAdminUser(): AdminUser | null {
  const raw = localStorage.getItem(ADMIN_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AdminUser
  } catch {
    return null
  }
}

export function clearAdminAuth(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
  localStorage.removeItem(ADMIN_USER_KEY)
  pb.authStore.clear()
}

export function ensureAdminTokenInStore(): void {
  if (pb.authStore.token) return
  const token = getStoredAdminToken()
  if (token) {
    pb.authStore.save(token, null)
  }
}
