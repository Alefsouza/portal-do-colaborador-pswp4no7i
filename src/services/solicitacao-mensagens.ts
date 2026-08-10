import pb from '@/lib/pocketbase/client'

export interface SolicitacaoMensagem {
  id: string
  id_solicitacao: string
  id_usuario: string
  tipo_remetente: string
  mensagem: string
  created: string
  updated: string
  expand?: {
    id_usuario?: {
      id: string
      nome_completo: string
      perfil: string
    }
  }
}

export async function listMensagens(solicitacaoId: string): Promise<SolicitacaoMensagem[]> {
  return (await pb.collection('solicitacao_mensagens').getFullList({
    filter: `id_solicitacao = "${solicitacaoId}"`,
    sort: 'created',
    expand: 'id_usuario',
  })) as SolicitacaoMensagem[]
}

export async function createMensagem(data: {
  id_solicitacao: string
  id_usuario: string
  tipo_remetente: string
  mensagem: string
}): Promise<SolicitacaoMensagem> {
  return (await pb.collection('solicitacao_mensagens').create(data)) as SolicitacaoMensagem
}
