import { ClientResponseError } from 'pocketbase'
import pb from '@/lib/pocketbase/client'

export interface TelemetryEvent {
  data: string
  tipo: string
  veiculo: string
  categoria: string
  duracao: number | string
  distancia: string
  velocidade: string
}

export interface TelemetryRecord {
  eventos_direcao: TelemetryEvent[]
  eventos_tecnicos: TelemetryEvent[]
  resumo: {
    total_eventos: number
    total_eventos_direcao: number
    total_eventos_tecnicos: number
    por_tipo: Record<string, number>
  }
  metricas: {
    distancia_total: string
    velocidade_media: string
  }
}

export interface TelemetryQuery {
  data: string
  nome_completo: string
}

const FALLBACK_MESSAGE = 'Não foi possível carregar os dados de telemetria. Tente novamente.'

export async function fetchTelemetry(query: TelemetryQuery): Promise<TelemetryRecord> {
  try {
    const res = await pb.send('/backend/v1/telemetria/consulta', {
      method: 'POST',
      body: { data: query.data, nome_completo: query.nome_completo },
    })
    return res as TelemetryRecord
  } catch (err) {
    if (err instanceof ClientResponseError) {
      const response = err.response as { error?: string }
      if (response?.error) throw new Error(response.error)
    }
    throw new Error(FALLBACK_MESSAGE)
  }
}
