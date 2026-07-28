import { ClientResponseError } from 'pocketbase'
import pb from '@/lib/pocketbase/client'

export interface TelemetryEvent {
  data: string
  tipo: string
  localizacao: string
  veiculo: string
  gravidade: string
}

export interface TelemetryScore {
  score?: number
  pontuacao?: number
  total?: number
  valor?: number
  nota?: number
  overall_score?: number
  total_score?: number
  [key: string]: unknown
}

export interface TelemetryResponse {
  pontuacao: TelemetryScore
  eventos: TelemetryEvent[]
  resumo: Record<string, number>
}

export interface TelemetryQuery {
  dataInicial: string
  dataFinal: string
  driverId: string
}

export async function fetchTelemetry(query: TelemetryQuery): Promise<TelemetryResponse> {
  try {
    const res = await pb.send('/backend/v1/datalbus/telemetria', {
      method: 'POST',
      body: JSON.stringify({
        data_inicial: query.dataInicial,
        data_final: query.dataFinal,
        driver_id: query.driverId,
      }),
      headers: {
        'Content-Type': 'application/json',
        ...(pb.authStore.token ? { Authorization: pb.authStore.token } : {}),
      },
    })
    return res as TelemetryResponse
  } catch (err) {
    if (err instanceof ClientResponseError) {
      const message = (err.response as { error?: string })?.error || err.message
      throw new Error(message)
    }
    throw new Error('Erro ao buscar dados de telemetria')
  }
}
