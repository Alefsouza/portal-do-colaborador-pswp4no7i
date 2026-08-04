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
  total_viagens?: number
}

export interface TelemetryError {
  tripId?: string
  error: string
  detail?: string
}

export interface TelemetryDebugCall {
  endpoint: string
  statusCode: number
  responsePreview: string
}

export interface TelemetryFilterTest {
  name: string
  url: string
  statusCode: number
  tripsReturned: number
  matchedTrips: number
  worked: boolean
  error?: string
}

export interface TelemetryDebug {
  calls: TelemetryDebugCall[]
  errors: TelemetryError[]
  filter_tests?: TelemetryFilterTest[]
  variation_used?: string
  total_trips_scanned?: number
  trips_found?: number
  pages_processed?: number
  pages_traversed?: number
  data_source?: string
  processing_time_seconds?: number
  worker_id?: string | number
}

export interface TelemetryRecord {
  message?: string
  pontuacao: TelemetryScore | number | null
  eventos: TelemetryEvent[]
  resumo: Record<string, number>
  total_viagens: number
  metricas: TelemetryMetricas
  partialData?: boolean
  errors?: TelemetryError[]
  debug?: TelemetryDebug
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
