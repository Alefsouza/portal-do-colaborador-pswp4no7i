import pb from '@/lib/pocketbase/client'

export interface Solicitacao {
  id: string
  id_usuario: string
  departamento: string
  titulo: string
  descricao: string
  status: string
  created: string
  updated: string
}

export async function listSolicitacoes(userId: string): Promise<Solicitacao[]> {
  return (await pb.collection('solicitacoes').getFullList({
    filter: `id_usuario = "${userId}"`,
    sort: '-created',
  })) as Solicitacao[]
}

export async function createSolicitacao(data: {
  id_usuario: string
  departamento: string
  titulo: string
  descricao: string
}): Promise<Solicitacao> {
  return (await pb.collection('solicitacoes').create({
    ...data,
    status: 'Pendente',
  })) as Solicitacao
}
