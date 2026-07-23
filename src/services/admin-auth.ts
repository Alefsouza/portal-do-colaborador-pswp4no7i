export interface AdminUser {
  id: string
  nome_completo: string
  perfil: string
  departamento: string
}

export interface AdminLoginResponse {
  token: string
  user: AdminUser
}

const API_URL = import.meta.env.VITE_POCKETBASE_URL

export async function adminLogin(cpf: string, senha: string): Promise<AdminLoginResponse> {
  const res = await fetch(`${API_URL}/backend/v1/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf, senha }),
  })
  const data = await res.json()
  if (!res.ok) throw data
  return data as AdminLoginResponse
}

export function parseJwt(token: string): { id: string; admin: boolean; exp?: number } | null {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload))
    return decoded
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJwt(token)
  if (!payload?.exp) return false
  return Date.now() >= payload.exp * 1000
}
