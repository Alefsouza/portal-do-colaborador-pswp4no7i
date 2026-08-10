import pb from '@/lib/pocketbase/client'
import { ClientResponseError } from 'pocketbase'

const PB_URL = import.meta.env.VITE_POCKETBASE_URL

export interface UsuarioSelect {
  id: string
  nome_completo: string
  cpf: string
  departamento: string
}

export interface UsuarioAdmin {
  id: string
  cpf: string
  nome_completo: string
  registro: string
  perfil: string
  departamento: string
  primeiro_acesso: boolean
  data_criacao: string
  created: string
  updated: string
}

export interface CreateUsuarioData {
  cpf: string
  nome_completo: string
  registro: string
  senha: string
  perfil: string
  departamento: string
  primeiro_acesso: boolean
}

export interface UpdateUsuarioData {
  nome_completo: string
  perfil: string
  departamento: string
  primeiro_acesso: boolean
}

function getAdminToken(): string {
  return localStorage.getItem('admin_token') || ''
}

export async function getDistinctDepartamentos(): Promise<string[]> {
  const usuarios = (await pb.collection('usuarios').getFullList()) as UsuarioSelect[]
  const set = new Set<string>()
  for (const u of usuarios) {
    if (u.departamento) set.add(u.departamento)
  }
  return Array.from(set).sort()
}

export async function listUsuariosForSelect(): Promise<UsuarioSelect[]> {
  return (await pb.collection('usuarios').getFullList({
    sort: 'nome_completo',
  })) as UsuarioSelect[]
}

export async function listUsuariosAdmin(page = 1, perPage = 10, search = '') {
  const filter = search
    ? `nome_completo ~ "${search}" || cpf ~ "${search}" || registro ~ "${search}"`
    : ''
  return pb.collection('usuarios').getList<UsuarioAdmin>(page, perPage, {
    ...(filter ? { filter } : {}),
    sort: 'nome_completo',
  })
}

export async function createUsuario(data: CreateUsuarioData): Promise<UsuarioAdmin> {
  const res = await fetch(`${PB_URL}/backend/v1/usuarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken()}`,
    },
    body: JSON.stringify(data),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ClientResponseError({
      url: `${PB_URL}/backend/v1/usuarios`,
      status: res.status,
      response: body,
      isAbort: false,
      originalError: null,
    })
  }
  return body as UsuarioAdmin
}

export async function updateUsuarioAdmin(
  id: string,
  data: UpdateUsuarioData,
): Promise<UsuarioAdmin> {
  return (await pb.collection('usuarios').update(id, data)) as UsuarioAdmin
}

export async function listAdminsForTransfer(
  departamento: string,
  perfil: string,
  excludeId: string,
): Promise<UsuarioAdmin[]> {
  const adminProfiles = ['Administrador', 'RH', 'TI', 'Financeiro', 'Gerente']
  const perfilFilter = adminProfiles.map((p) => `perfil = "${p}"`).join(' || ')
  const filter =
    perfil === 'TI'
      ? `(${perfilFilter}) && id != "${excludeId}"`
      : `(${perfilFilter}) && departamento = "${departamento}" && id != "${excludeId}"`
  return (await pb.collection('usuarios').getFullList({
    filter,
    sort: 'nome_completo',
  })) as UsuarioAdmin[]
}

export async function resetUsuarioSenha(id: string): Promise<void> {
  const res = await fetch(`${PB_URL}/backend/v1/usuarios/${id}/reset-senha`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken()}`,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Erro ao redefinir senha')
  }
}
