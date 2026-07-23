import pb from '@/lib/pocketbase/client'

export interface Informativo {
  id: string
  titulo: string
  conteudo: string
  departamento: string
  status_ativo: boolean
  created: string
  updated: string
}

export async function listInformativos(): Promise<Informativo[]> {
  return (await pb.collection('informativos').getFullList({
    sort: '-created',
  })) as Informativo[]
}

export async function createInformativo(data: {
  titulo: string
  conteudo: string
  departamento: string
  status_ativo: boolean
}): Promise<Informativo> {
  return (await pb.collection('informativos').create(data)) as Informativo
}

export async function updateInformativo(
  id: string,
  data: { titulo: string; conteudo: string; departamento: string; status_ativo: boolean },
): Promise<Informativo> {
  return (await pb.collection('informativos').update(id, data)) as Informativo
}

export async function deleteInformativo(id: string): Promise<void> {
  await pb.collection('informativos').delete(id)
}
