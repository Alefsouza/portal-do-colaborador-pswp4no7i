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
  [key: string]: unknown
}

export interface TelemetryResumo {
  total_eventos_direcao: number
  total_eventos?: number
  por_tipo: Record<string, number>
}

export interface TelemetryMetricas {
  total_viagens: number
  distancia_total_km: number
  distancia_total?: string
  duracao_total: string
}

export interface TelemetryDebug {
  worker_id: number | string
  data: string
  paginas_total: number
  paginas_processadas: number
  paginas_restantes: number
  trips_total_dia: number
  trips_varridas: number
  trips_encontradas: number
  tempo_segundos: number
  completo: boolean
  aviso?: string
}

export interface TelemetryRecord {
  sincronizado?: boolean
  mensagem?: string
  pontuacao: TelemetryScore | number | null
  eventos_direcao: TelemetryEvent[]
  eventos_tecnicos: TelemetryEvent[]
  resumo: TelemetryResumo
  metricas: TelemetryMetricas
  debug?: TelemetryDebug
}

export interface TelemetryQuery {
  data: string
  workerId: string
}

export interface SyncInitResponse {
  total_pages: number
  total_trips: number
  current_page: number
  sync_id: string
}

export interface SyncChunkResponse {
  processed_pages: number[]
  next_page: number
  has_more: boolean
  trips_processed: number
}

export interface SyncStatus {
  id: string
  date: string
  total_pages: number
  pages_processed: number[]
  status: 'in_progress' | 'completed' | 'failed' | 'trips_downloaded' | 'processing_events'
}

export interface SyncEventsResponse {
  sucesso: boolean
  trips_processadas: number
  eventos_processados: number
  trips_restantes: number
  completo: boolean
}

export class NeedsSyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NeedsSyncError'
  }
}

const FALLBACK_MESSAGE = 'Não foi possível carregar os dados de telemetria. Tente novamente.'

export const TELEMETRY_TIMEOUT_MS = 180000

export async function fetchTelemetry(query: TelemetryQuery): Promise<TelemetryRecord> {
  try {
    const res = await pb.send('/backend/v1/datalbus/telemetria', {
      method: 'POST',
      body: { data: query.data, worker_id: query.workerId },
    })
    if (res && res.sincronizado === false) {
      throw new NeedsSyncError(res.mensagem || 'Esta data precisa ser sincronizada.')
    }
    return res as TelemetryRecord
  } catch (err) {
    if (err instanceof NeedsSyncError) throw err
    if (err instanceof ClientResponseError) {
      const response = err.response as { error?: string; erro?: string }
      const msg = response?.error || response?.erro
      if (msg) throw new Error(msg)
    }
    throw new Error(FALLBACK_MESSAGE)
  }
}

export async function syncInit(date: string): Promise<SyncInitResponse> {
  const res = await pb.send('/backend/v1/datalbus/sync-init', {
    method: 'POST',
    body: { date },
  })
  return res as SyncInitResponse
}

export async function syncChunk(
  date: string,
  startPage: number,
  chunkSize: number = 3,
): Promise<SyncChunkResponse> {
  const res = await pb.send('/backend/v1/datalbus/sync-chunk', {
    method: 'POST',
    body: { date, start_page: startPage, chunk_size: chunkSize },
  })
  return res as SyncChunkResponse
}

export async function syncEvents(date: string): Promise<SyncEventsResponse> {
  const res = await pb.send('/backend/v1/datalbus/sync-events', {
    method: 'POST',
    body: { date },
  })
  return res as SyncEventsResponse
}

export async function getSyncStatus(date: string): Promise<SyncStatus | null> {
  try {
    const record = await pb.collection('datalbus_sync_status').getFirstListItem(`date = "${date}"`)
    const rawPages = record.pages_processed
    const pagesProcessed =
      typeof rawPages === 'string' ? JSON.parse(rawPages || '[]') : rawPages || []
    return {
      id: record.id,
      date: record.date,
      total_pages: record.total_pages || 0,
      pages_processed: Array.isArray(pagesProcessed) ? pagesProcessed : [],
      status: record.status || 'in_progress',
    }
  } catch {
    return null
  }
}
