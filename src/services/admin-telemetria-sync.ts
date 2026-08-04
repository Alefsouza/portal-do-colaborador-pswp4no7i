import pb from '@/lib/pocketbase/client'

const SYNC_TOKEN = import.meta.env.VITE_DATALBUS_SYNC_TOKEN || ''
const PB_URL = import.meta.env.VITE_POCKETBASE_URL || ''

export interface SyncLogRecord {
  id: string
  data_sincronizada: string
  status: string
  iniciado_em: string
  concluido_em: string
  duracao_segundos: number
  paginas_total: number
  paginas_processadas: number
  trips_processadas: number
  eventos_processados: number
  motoristas_encontrados: number
  mensagem_erro: string
  tentativa: number
  created: string
  updated: string
}

export interface TelemetryStats {
  lastSyncDate: string | null
  lastSyncConcluido: string | null
  totalDays: number
  totalTrips: number
  totalEvents: number
}

export interface SyncDayResult {
  sucesso: boolean
  status: string
  trips_processadas: number
  eventos_processados: number
  duracao_segundos: number
  paginas_total: number
  paginas_processadas: number
  error?: string
}

export interface ClearOldDataResult {
  trips_removidas: number
  eventos_removidos: number
  data_corte: string
}

export async function getTelemetryStats(): Promise<TelemetryStats> {
  let lastSyncDate: string | null = null
  let lastSyncConcluido: string | null = null
  let totalDays = 0

  try {
    const lastSync = await pb
      .collection('telemetria_sync_log')
      .getFirstListItem('status = "sucesso"', { sort: '-created' })
    lastSyncDate = (lastSync as Record<string, unknown>).data_sincronizada as string
    lastSyncConcluido = (lastSync as Record<string, unknown>).concluido_em as string
  } catch {
    /* no successful sync yet */
  }

  try {
    const successRecords = await pb.collection('telemetria_sync_log').getFullList({
      filter: 'status = "sucesso"',
    })
    const distinctDates = new Set(
      successRecords.map((r) => (r as Record<string, unknown>).data_sincronizada as string),
    )
    totalDays = distinctDates.size
  } catch {
    /* ignore */
  }

  let totalTrips = 0
  try {
    const result = await pb.collection('telemetria_trips').getList(1, 1)
    totalTrips = result.totalItems
  } catch {
    /* ignore */
  }

  let totalEvents = 0
  try {
    const result = await pb.collection('telemetria_eventos').getList(1, 1)
    totalEvents = result.totalItems
  } catch {
    /* ignore */
  }

  return { lastSyncDate, lastSyncConcluido, totalDays, totalTrips, totalEvents }
}

export async function getSyncHistory(): Promise<SyncLogRecord[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  try {
    const records = await pb.collection('telemetria_sync_log').getFullList({
      filter: `data_sincronizada >= "${cutoffStr}"`,
      sort: '-created',
    })
    return records as unknown as SyncLogRecord[]
  } catch {
    return []
  }
}

export async function syncDay(date: string): Promise<SyncDayResult> {
  const res = await fetch(`${PB_URL}/backend/v1/datalbus/sync-day`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Token': SYNC_TOKEN,
    },
    body: JSON.stringify({ data: date }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error || data?.erro || `Erro ${res.status}`)
  }
  return data as SyncDayResult
}

export async function clearOldData(): Promise<ClearOldDataResult> {
  const res = await fetch(`${PB_URL}/backend/v1/datalbus/limpar-antigos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sync-Token': SYNC_TOKEN,
    },
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error || `Erro ${res.status}`)
  }
  return data as ClearOldDataResult
}
