import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function maskCpf(value: string) {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1')
}

export function getInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function formatBrazilianDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  const trimmed = dateStr.trim()
  if (!trimmed) return '—'

  // Match YYYY-MM-DD (e.g. 2026-08-27 -> 27/08/2026)
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch
    return `${d}/${m}/${y}`
  }

  // If already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed
  }

  // If DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch
    return `${d}/${m}/${y}`
  }

  // Handle ISO string or date parse
  const date = new Date(trimmed)
  if (!isNaN(date.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    // Check if it was an ISO date without time to avoid UTC shift
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const parts = trimmed.split('T')[0].split('-')
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`
      }
    }
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
  }

  return trimmed
}

export function formatBrazilianDateTime(iso: string | undefined | null): string {
  if (!iso) return 'Data indisponível'
  const date = new Date(iso)
  if (isNaN(date.getTime())) return 'Data indisponível'
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = pad(date.getDate())
  const month = pad(date.getMonth() + 1)
  const year = date.getFullYear()
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  return `${day}/${month}/${year} - ${hours}:${minutes}:${seconds}`
}
