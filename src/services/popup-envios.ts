import pb from '@/lib/pocketbase/client'

export interface PopupEnvio {
  id: string
  titulo: string
  conteudo: string
  id_usuario: string
  status_lido: boolean
  created: string
}

export async function getUnreadPopups(
  userId: string,
  loginTimestamp: string,
): Promise<PopupEnvio[]> {
  return (await pb.collection('popup_envios').getFullList({
    filter: `id_usuario = "${userId}" && status_lido = false && created < "${loginTimestamp}"`,
    sort: 'created',
  })) as PopupEnvio[]
}

export async function markPopupAsRead(id: string): Promise<void> {
  await pb.collection('popup_envios').update(id, { status_lido: true })
}
