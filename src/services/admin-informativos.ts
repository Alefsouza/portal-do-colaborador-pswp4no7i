import pb from '@/lib/pocketbase/client'
import { ensureAdminTokenInStore } from '@/services/admin-auth'

export interface Informativo {
  id: string
  titulo: string
  conteudo: string
  departamento: string
  status_ativo: boolean
  anexo: string
  data_inicio: string
  data_final: string
  recipient_type: 'Todos' | 'Especificos'
  destinatarios: string[]
  created: string
  updated: string
  expand?: {
    destinatarios?: Array<{
      id: string
      nome_completo: string
      cpf: string
      registro: string
    }>
  }
}

export async function listInformativos(): Promise<Informativo[]> {
  ensureAdminTokenInStore()
  return (await pb.collection('informativos').getFullList({
    sort: '-created',
    expand: 'destinatarios',
  })) as Informativo[]
}

export async function listInformativosForUser(userId: string): Promise<Informativo[]> {
  const all = (await pb.collection('informativos').getFullList({
    sort: '-created',
    expand: 'destinatarios',
    filter: `status_ativo = true && (recipient_type = "Todos" || destinatarios.id ?= "${userId}")`,
  })) as Informativo[]
  return all
}

export async function createInformativo(data: {
  titulo: string
  conteudo: string
  departamento: string
  status_ativo: boolean
  anexo?: File | null
  data_inicio?: string
  data_final?: string
  recipient_type: 'Todos' | 'Especificos'
  destinatarios?: string[]
}): Promise<Informativo> {
  ensureAdminTokenInStore()
  const formData = new FormData()
  formData.append('titulo', data.titulo)
  formData.append('conteudo', data.conteudo)
  formData.append('departamento', data.departamento)
  formData.append('status_ativo', String(data.status_ativo))
  formData.append('data_inicio', data.data_inicio || '')
  formData.append('data_final', data.data_final || '')
  formData.append('recipient_type', data.recipient_type)
  if (
    data.recipient_type === 'Especificos' &&
    data.destinatarios &&
    data.destinatarios.length > 0
  ) {
    for (const id of data.destinatarios) {
      formData.append('destinatarios', id)
    }
  }
  if (data.anexo) {
    formData.append('anexo', data.anexo)
  }
  return (await pb.collection('informativos').create(formData)) as Informativo
}

export async function updateInformativo(
  id: string,
  data: {
    titulo: string
    conteudo: string
    departamento: string
    status_ativo: boolean
    anexo?: File | null
    removeAnexo?: boolean
    data_inicio?: string
    data_final?: string
    recipient_type: 'Todos' | 'Especificos'
    destinatarios?: string[]
  },
): Promise<Informativo> {
  ensureAdminTokenInStore()
  const formData = new FormData()
  formData.append('titulo', data.titulo)
  formData.append('conteudo', data.conteudo)
  formData.append('departamento', data.departamento)
  formData.append('status_ativo', String(data.status_ativo))
  formData.append('data_inicio', data.data_inicio || '')
  formData.append('data_final', data.data_final || '')
  formData.append('recipient_type', data.recipient_type)
  if (
    data.recipient_type === 'Especificos' &&
    data.destinatarios &&
    data.destinatarios.length > 0
  ) {
    for (const id of data.destinatarios) {
      formData.append('destinatarios', id)
    }
  } else {
    formData.append('destinatarios', '')
  }
  if (data.anexo) {
    formData.append('anexo', data.anexo)
  } else if (data.removeAnexo) {
    formData.append('anexo', '')
  }
  return (await pb.collection('informativos').update(id, formData)) as Informativo
}

export async function deleteInformativo(id: string): Promise<void> {
  ensureAdminTokenInStore()
  await pb.collection('informativos').delete(id)
}

export function getAnexoUrl(record: Informativo): string {
  if (!record.anexo) return ''
  return pb.files.getURL(record as any, record.anexo)
}

export function isImageFile(filename: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename)
}
