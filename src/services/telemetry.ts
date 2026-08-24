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
  metricas_viagens: {
    quantidade_viagens: number
    km_rodado: string
    horas_dirigidas: string
  }
}

export interface TelemetryQuery {
  data: string
  nome_completo: string
}

export interface SyncStatus {
  date: string
  total_pages: number
  pages_processed: number[]
  status: string
  updated_at: string
}

export async function getSyncStatus(date: string): Promise<SyncStatus | null> {
  try {
    const records = await pb.collection('datalbus_sync_status').getFullList({
      filter: `date = "${date}"`,
    })
    return (records[0] as unknown as SyncStatus) || null
  } catch {
    return null
  }
}

export async function syncInit(date: string): Promise<{ total_pages: number }> {
  const res = await pb.send('/backend/v1/telemetria/sync-init', {
    method: 'POST',
    body: { date },
  })
  return res as { total_pages: number }
}

export async function syncChunk(
  date: string,
  page: number,
  limit?: number,
): Promise<{ next_page: number; has_more: boolean }> {
  const res = await pb.send('/backend/v1/telemetria/sync-chunk', {
    method: 'POST',
    body: { date, page, limit },
  })
  return res as { next_page: number; has_more: boolean }
}

export async function syncEvents(
  date: string,
): Promise<{ eventos_processados: number; trips_restantes: number; completo: boolean }> {
  const res = await pb.send('/backend/v1/telemetria/sync-events', {
    method: 'POST',
    body: { date },
  })
  return res as { eventos_processados: number; trips_restantes: number; completo: boolean }
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
