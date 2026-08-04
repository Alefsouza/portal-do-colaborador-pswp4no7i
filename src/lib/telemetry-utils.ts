import type { TelemetryRecord } from '@/services/telemetry'

export function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDateBr(dateStr: string): string {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

export function formatEventDate(dateStr: string): string {
  if (!dateStr) return '-'
  const cleaned = dateStr.replace('T', ' ')
  const [datePart, timePart] = cleaned.split(' ')
  if (!datePart) return dateStr
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return dateStr
  const time = timePart ? timePart.substring(0, 5) : '00:00'
  return `${d}/${m}/${y} ${time}`
}

export function formatDuration(duracao: number | string | undefined): string {
  if (duracao === undefined || duracao === null || duracao === '') return '-'
  const seconds = typeof duracao === 'string' ? parseInt(duracao, 10) : duracao
  if (isNaN(seconds) || seconds <= 0) return '-'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

export function formatDriveDuration(durationStr: string): string {
  if (!durationStr || durationStr === '00:00:00') return '-'
  const parts = durationStr.split(':')
  if (parts.length !== 3) return durationStr
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function extractScore(p: TelemetryRecord['pontuacao']): number | null {
  if (typeof p === 'number') return p
  if (!p || typeof p !== 'object') return null
  const keys = ['score', 'pontuacao', 'total', 'valor', 'nota', 'overall_score', 'total_score']
  for (const k of keys) {
    if (typeof p[k] === 'number') return p[k] as number
  }
  for (const v of Object.values(p)) {
    if (typeof v === 'number' && v >= 0 && v <= 100) return v
  }
  return null
}

export function extractDistance(p: TelemetryRecord['pontuacao']): number | null {
  if (!p || typeof p !== 'object') return null
  const keys = [
    'distance',
    'distancia',
    'km',
    'total_distance',
    'km_rodado',
    'total_km',
    'kilometers',
  ]
  for (const k of keys) {
    const v = p[k]
    if (typeof v === 'number' && v > 0) return v
    if (typeof v === 'string') {
      const parsed = parseFloat(v)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  }
  return null
}

export function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excelente'
  if (score >= 60) return 'Médio'
  return 'Baixo'
}

export function getEventBadgeClass(tipo: string): string {
  const l = tipo.toLowerCase()
  if (l.includes('velocidade')) return 'bg-red-100 text-red-700 border-red-200'
  if (l.includes('freada') || l.includes('frenagem'))
    return 'bg-orange-100 text-orange-700 border-orange-200'
  if (l.includes('acelera')) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  if (l.includes('celular')) return 'bg-purple-100 text-purple-700 border-purple-200'
  if (l.includes('curva') || l.includes('desconforto'))
    return 'bg-blue-100 text-blue-700 border-blue-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}
