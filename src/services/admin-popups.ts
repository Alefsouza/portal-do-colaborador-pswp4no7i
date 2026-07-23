import pb from '@/lib/pocketbase/client'

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

export async function listPopups(): Promise<PopupEnvioAdmin[]> {
  return await pb.collection('popup_envios').getFullList({
    sort: '-created',
    expand: 'id_usuario',
  })
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
