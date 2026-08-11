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
  const brMatch = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (brMatch) {
    const time = timePart ? timePart.substring(0, 5) : '00:00'
    return `${datePart} ${time}`.trim()
  }
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return dateStr
  const time = timePart ? timePart.substring(0, 5) : '00:00'
  return `${d}/${m}/${y} ${time}`.trim()
}

export function formatDuration(duracao: number | string | undefined): string {
  if (duracao === undefined || duracao === null || duracao === '') return '-'
  const str = String(duracao).trim()
  if (str.includes(':')) {
    const parts = str.split(':')
    if (parts.length === 3) {
      const h = parseInt(parts[0], 10) || 0
      const m = parseInt(parts[1], 10) || 0
      const s = parseInt(parts[2], 10) || 0
      if (h > 0) return `${h}h ${m}m`
      if (m > 0) return `${m}m ${s}s`
      return `${s}s`
    }
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10) || 0
      const s = parseInt(parts[1], 10) || 0
      if (m > 0) return `${m}m ${s}s`
      return `${s}s`
    }
  }
  const seconds = typeof duracao === 'string' ? parseInt(str, 10) : duracao
  if (isNaN(seconds) || seconds <= 0) return '-'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

export function getEventBadgeClass(tipo: string): string {
  const l = (tipo || '').toLowerCase()
  if (l.includes('velocidade')) return 'bg-red-100 text-red-700 border-red-200'
  if (l.includes('freada') || l.includes('frenagem'))
    return 'bg-orange-100 text-orange-700 border-orange-200'
  if (l.includes('acelera')) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  if (l.includes('celular')) return 'bg-purple-100 text-purple-700 border-purple-200'
  if (l.includes('curva') || l.includes('desconforto'))
    return 'bg-blue-100 text-blue-700 border-blue-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}
