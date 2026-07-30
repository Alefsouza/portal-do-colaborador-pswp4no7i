import { ClientResponseError } from 'pocketbase'
import pb from '@/lib/pocketbase/client'

export interface TelemetryEvent {
  data: string
  tipo: string
  veiculo: string
  descricao: string
  duracao: number | string
  latitude: number | string
  longitude: number | string
  quantidade: number | string
}

export interface TelemetryScore {
  score?: number
  pontuacao?: number
  total?: number
  valor?: number
  nota?: number
  overall_score?: number
  total_score?: number
  distance?: number
  distancia?: number
  metricas?: Record<string, unknown>
  totais?: Record<string, unknown>
  [key: string]: unknown
}

export interface TelemetryMetricas {
  distancia_total: number
  duracao_total: number
}

export interface TelemetryError {
  tripId: string
  error: string
}

export interface TelemetryRecord {
  pontuacao: TelemetryScore | number
  eventos: TelemetryEvent[]
  resumo: Record<string, number>
  total_viagens: number
  metricas: TelemetryMetricas
  partialData?: boolean
  errors?: TelemetryError[]
}

export interface TelemetryQuery {
  dataInicial: string
  dataFinal: string
  workerId: string
}

const FALLBACK_MESSAGE =
  'Não foi possível carregar os dados de telemetria. Tente novamente em instantes.'

export async function fetchTelemetry(query: TelemetryQuery): Promise<TelemetryRecord> {
  try {
    const res = await pb.send('/backend/v1/datalbus/telemetria', {
      method: 'POST',
      body: {
        data_inicial: query.dataInicial,
        data_final: query.dataFinal,
        worker_id: query.workerId,
      },
    })
    return res as TelemetryRecord
  } catch (err) {
    if (err instanceof ClientResponseError) {
      const response = err.response as { error?: string }
      if (response?.error) {
        throw new Error(response.error)
      }
      if (err.status === 0 || err.isAbort) {
        throw new Error(FALLBACK_MESSAGE)
      }
    }
    throw new Error(FALLBACK_MESSAGE)
  }
}
