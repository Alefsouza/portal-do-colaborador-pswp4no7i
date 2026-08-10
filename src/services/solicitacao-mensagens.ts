import pb from '@/lib/pocketbase/client'

export interface SolicitacaoMensagem {
  id: string
  id_solicitacao: string
  id_usuario: string
  tipo_remetente: string
  mensagem: string
  anexo: string
  created: string
  updated: string
  expand?: {
    id_usuario?: {
      id: string
      nome_completo: string
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

export async function sendMensagem(data: {
  id_solicitacao: string
  id_usuario: string
  tipo_remetente: string
  mensagem: string
  anexo?: File | null
}): Promise<SolicitacaoMensagem> {
  const formData = new FormData()
  formData.append('id_solicitacao', data.id_solicitacao)
  formData.append('id_usuario', data.id_usuario)
  formData.append('tipo_remetente', data.tipo_remetente)
  formData.append('mensagem', data.mensagem)
  if (data.anexo) {
    formData.append('anexo', data.anexo)
  }
  return (await pb.collection('solicitacao_mensagens').create(formData)) as SolicitacaoMensagem
}

export function getAnexoUrl(record: SolicitacaoMensagem): string {
  if (!record.anexo) return ''
  return pb.files.getURL(record as any, record.anexo)
}
