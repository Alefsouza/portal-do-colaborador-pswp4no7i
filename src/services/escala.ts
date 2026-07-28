import { ClientResponseError } from 'pocketbase'
import pb from '@/lib/pocketbase/client'

export interface EscalaItem {
  data: string
  veiculo: string
  linha: string
  tabela: string
  inicio: string
  fim: string
  pegada: string
}

export async function fetchEscala(data?: string): Promise<EscalaItem[]> {
  try {
    const url = data ? `/backend/v1/escala?data=${encodeURIComponent(data)}` : '/backend/v1/escala'
    const res = await pb.send(url, {
      method: 'GET',
      headers: {
        ...(pb.authStore.token ? { Authorization: pb.authStore.token } : {}),
      },
    })
    return (res as { items: EscalaItem[] }).items || []
  } catch (err) {
    if (err instanceof ClientResponseError) {
      const message = (err.response as { error?: string })?.error || err.message
      throw new Error(message)
    }
    throw new Error('Erro ao buscar escala')
  }
}
