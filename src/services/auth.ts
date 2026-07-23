import pb from '@/lib/pocketbase/client'

export interface AuthUser {
  id: string
  nome_completo: string
  primeiro_acesso: boolean
  departamento: string
  perfil: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

const API_URL = import.meta.env.VITE_POCKETBASE_URL

export async function login(registro: string, senha: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/backend/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registro, senha }),
  })
  const data = await res.json()
  if (!res.ok) throw data
  return data as LoginResponse
}

export async function changePassword(token: string, novaSenha: string): Promise<void> {
  const res = await fetch(`${API_URL}/backend/v1/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ nova_senha: novaSenha }),
  })
  const data = await res.json()
  if (!res.ok) throw data
}
