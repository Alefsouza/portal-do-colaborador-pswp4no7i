import pb from '@/lib/pocketbase/client'

export interface InformativoVisualizado {
  id: string
  id_usuario: string
  id_informativo: string
  created: string
  updated: string
}

export async function getVisualizados(userId: string): Promise<InformativoVisualizado[]> {
  return (await pb.collection('informativos_visualizados').getFullList({
    filter: `id_usuario = "${userId}"`,
  })) as InformativoVisualizado[]
}

export async function markAsViewed(userId: string, informativoId: string): Promise<void> {
  await pb.collection('informativos_visualizados').create({
    id_usuario: userId,
    id_informativo: informativoId,
  })
}
