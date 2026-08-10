import { ClientResponseError } from 'pocketbase'
import pb from '@/lib/pocketbase/client'

const PB_URL = import.meta.env.VITE_POCKETBASE_URL

function getAdminToken(): string {
  return localStorage.getItem('admin_token') || ''
}

export interface PopupEnvioAdmin {
  id: string
  titulo: string
  conteudo: string
  id_usuario: string
  status_lido: boolean
  created: string
  expand?: {
    id_usuario?: {
      id: string
      nome_completo: string
      departamento: string
    }
  }
}

export interface GroupedPopup {
  key: string
  titulo: string
  conteudo: string
  created: string
  totalRecipients: number
  readCount: number
  firstUserName?: string
}

export async function listPopups(): Promise<PopupEnvioAdmin[]> {
  return await pb.collection('popup_envios').getFullList({
    sort: '-created',
    expand: 'id_usuario',
  })
}

export async function sendPopup(data: {
  titulo: string
  conteudo: string
  recipientType: 'all' | 'specific'
  userIds?: string[]
}): Promise<{ success: boolean; recipients: number }> {
  const res = await fetch(`${PB_URL}/backend/v1/popups/send`, {
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
      url: `${PB_URL}/backend/v1/popups/send`,
      status: res.status,
      response: body,
      isAbort: false,
      originalError: null,
    })
  }
  return body
}

export async function createPopup(data: {
  titulo: string
  conteudo: string
  id_usuario: string
}): Promise<PopupEnvioAdmin> {
  return await pb.collection('popup_envios').create({
    titulo: data.titulo,
    conteudo: data.conteudo,
    id_usuario: data.id_usuario,
    status_lido: false,
  })
}

export async function deletePopup(id: string): Promise<void> {
  await pb.collection('popup_envios').delete(id)
}

export function groupPopups(popups: PopupEnvioAdmin[]): GroupedPopup[] {
  const groups = new Map<string, PopupEnvioAdmin[]>()
  for (const p of popups) {
    const key = `${p.titulo}||${p.conteudo}`
    const arr = groups.get(key) || []
    arr.push(p)
    groups.set(key, arr)
  }
  return Array.from(groups.values()).map((group) => ({
    key: group[0].id,
    titulo: group[0].titulo,
    conteudo: group[0].conteudo,
    created: group[0].created,
    totalRecipients: group.length,
    readCount: group.filter((p) => p.status_lido).length,
    firstUserName: group[0].expand?.id_usuario?.nome_completo,
  }))
}
