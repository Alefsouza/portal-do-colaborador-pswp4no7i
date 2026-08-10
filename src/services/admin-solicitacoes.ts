import pb from '@/lib/pocketbase/client'

export interface AdminSolicitacao {
  id: string
  id_usuario: string
  id_proprietario: string
  titulo: string
  descricao: string
  status: string
  created: string
  updated: string
  expand?: {
    id_usuario?: {
      id: string
      nome_completo: string
      cpf: string
    }
    id_proprietario?: {
      id: string
      nome_completo: string
    }
  }
}

export async function listAdminSolicitacoes(departamento: string): Promise<AdminSolicitacao[]> {
  return (await pb.collection('solicitacoes').getFullList({
    filter: `departamento = "${departamento}"`,
    sort: '-created',
    expand: 'id_usuario,id_proprietario',
  })) as AdminSolicitacao[]
}

export async function listAllAdminSolicitacoes(): Promise<AdminSolicitacao[]> {
  return (await pb.collection('solicitacoes').getFullList({
    sort: '-created',
    expand: 'id_usuario,id_proprietario',
  })) as AdminSolicitacao[]
}

export async function getAdminSolicitacao(id: string): Promise<AdminSolicitacao> {
  return (await pb.collection('solicitacoes').getOne(id, {
    expand: 'id_usuario,id_proprietario',
  })) as AdminSolicitacao
}

export async function updateSolicitacaoStatus(id: string, status: string): Promise<void> {
  await pb.collection('solicitacoes').update(id, { status })
}

export async function transferSolicitacao(id: string, idProprietario: string): Promise<void> {
  await pb.collection('solicitacoes').update(id, { id_proprietario: idProprietario })
}
