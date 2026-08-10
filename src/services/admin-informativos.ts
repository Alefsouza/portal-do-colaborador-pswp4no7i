import pb from '@/lib/pocketbase/client'
import { ensureAdminTokenInStore } from '@/services/admin-auth'

export interface Informativo {
  id: string
  titulo: string
  conteudo: string
  departamento: string
  status_ativo: boolean
  anexo: string
  created: string
  updated: string
}

export async function listInformativos(): Promise<Informativo[]> {
  ensureAdminTokenInStore()
  return (await pb.collection('informativos').getFullList({
    sort: '-created',
  })) as Informativo[]
}

export async function createInformativo(data: {
  titulo: string
  conteudo: string
  departamento: string
  status_ativo: boolean
  anexo?: File | null
}): Promise<Informativo> {
  ensureAdminTokenInStore()
  const formData = new FormData()
  formData.append('titulo', data.titulo)
  formData.append('conteudo', data.conteudo)
  formData.append('departamento', data.departamento)
  formData.append('status_ativo', String(data.status_ativo))
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
  },
): Promise<Informativo> {
  ensureAdminTokenInStore()
  const formData = new FormData()
  formData.append('titulo', data.titulo)
  formData.append('conteudo', data.conteudo)
  formData.append('departamento', data.departamento)
  formData.append('status_ativo', String(data.status_ativo))
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
