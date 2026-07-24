import { ClientResponseError } from 'pocketbase'
import pb from '@/lib/pocketbase/client'

export interface VehiclePosition {
  prefixo: string
  latitude: number
  longitude: number
  letreiro: string
  sentido: number
  horario: string
  acessivel: boolean
}

export async function fetchVehiclePosition(prefixo: string): Promise<VehiclePosition> {
  try {
    const res = await pb.send('/backend/v1/olho-vivo/buscar-veiculo', {
      method: 'POST',
      body: JSON.stringify({ prefixo }),
      headers: {
        'Content-Type': 'application/json',
        ...(pb.authStore.token ? { Authorization: pb.authStore.token } : {}),
      },
    })
    return res as VehiclePosition
  } catch (err) {
    if (err instanceof ClientResponseError) {
      const message = (err.response as { error?: string })?.error || err.message
      throw new Error(message)
    }
    throw new Error('Erro ao buscar veículo')
  }
}
