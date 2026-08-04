import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { syncInit, syncChunk, syncEvents, getSyncStatus } from '@/services/telemetry'

interface SyncModalProps {
  open: boolean
  date: string
  onClose: () => void
  onSyncComplete: () => void
}

const CHUNK_TIMEOUT_MS = 70000
const MAX_RETRIES = 3
const MAX_EVENTS_RETRIES = 5

function formatDateBr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function findNextPage(processed: number[], total: number): number {
  for (let i = 1; i <= total; i++) {
    if (!processed.includes(i)) return i
  }
  return total + 1
}

type SyncPhase = 'downloading_trips' | 'processing_events'

export function SyncModal({ open, date, onClose, onSyncComplete }: SyncModalProps) {
  const [progress, setProgress] = useState(0)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [phase, setPhase] = useState<'syncing' | 'completed' | 'error'>('syncing')
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('downloading_trips')
  const [eventsProcessed, setEventsProcessed] = useState(0)
  const [tripsRemaining, setTripsRemaining] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [errorPage, setErrorPage] = useState(0)
  const cancelRef = useRef(false)
  const retryCountRef = useRef(0)
  const [retryKey, setRetryKey] = useState(0)

  const runSync = useCallback(async () => {
    cancelRef.current = false
    retryCountRef.current = 0
    setPhase('syncing')
    setProgress(0)
    setErrorMessage('')
    setErrorPage(0)
    setEventsProcessed(0)
    setTripsRemaining(0)
    setSyncPhase('downloading_trips')

    try {
      const existing = await getSyncStatus(date)
      let startPage = 2
      let total = 0
      let skipTrips = false

      if (existing && existing.status === 'completed') {
        setPhase('completed')
        setProgress(100)
        setTimeout(() => onSyncComplete(), 800)
        return
      }

      if (
        existing &&
        (existing.status === 'trips_downloaded' || existing.status === 'processing_events')
      ) {
        skipTrips = true
        total = existing.total_pages
        setTotalPages(total)
        setSyncPhase('processing_events')
        setProgress(50)
      } else if (existing && (existing.status === 'in_progress' || existing.status === 'failed')) {
        total = existing.total_pages
        const processed = existing.pages_processed || []
        startPage = findNextPage(processed, total)
        setTotalPages(total)
        setCurrentPage(processed.length)
        setProgress(total > 0 ? Math.round((processed.length / total) * 50) : 0)
      } else {
        const initResult = await syncInit(date)
        total = initResult.total_pages
        startPage = 2
        setTotalPages(total)
        setCurrentPage(1)
        setProgress(total > 0 ? Math.round((1 / total) * 50) : 50)
      }

      if (!skipTrips && startPage <= total) {
        let nextPage = startPage
        while (nextPage <= total && !cancelRef.current) {
          let chunkResult = null
          try {
            chunkResult = await Promise.race([
              syncChunk(date, nextPage, 3),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), CHUNK_TIMEOUT_MS),
              ),
            ])
            retryCountRef.current = 0
          } catch {
            retryCountRef.current++
            if (retryCountRef.current >= MAX_RETRIES) {
              setPhase('error')
              setErrorPage(nextPage)
              setErrorMessage(
                `Não foi possível sincronizar a página ${nextPage}. Clique em Tentar Novamente.`,
              )
              return
            }
            await new Promise((r) => setTimeout(r, 1500))
            continue
          }

          if (!chunkResult) continue
          setCurrentPage(chunkResult.next_page - 1)
          setProgress(Math.round(((chunkResult.next_page - 1) / total) * 50))
          nextPage = chunkResult.next_page
          if (!chunkResult.has_more) break
        }

        if (cancelRef.current) {
          onClose()
          return
        }
      }

      setSyncPhase('processing_events')
      setProgress(55)

      let eventsComplete = false
      let eventsRetries = 0
      let initialRemaining: number | null = null

      while (!eventsComplete && !cancelRef.current) {
        let eventsResult = null
        try {
          eventsResult = await Promise.race([
            syncEvents(date),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), CHUNK_TIMEOUT_MS),
            ),
          ])
          eventsRetries = 0
        } catch {
          eventsRetries++
          if (eventsRetries >= MAX_EVENTS_RETRIES) {
            setPhase('error')
            setErrorMessage('Não foi possível processar os eventos. Tente novamente.')
            return
          }
          await new Promise((r) => setTimeout(r, 2000))
          continue
        }

        if (!eventsResult) continue

        setEventsProcessed((prev) => prev + eventsResult.eventos_processados)
        setTripsRemaining(eventsResult.trips_restantes)

        if (initialRemaining === null && eventsResult.trips_restantes > 0) {
          initialRemaining = eventsResult.trips_restantes
        }

        if (eventsResult.completo) {
          eventsComplete = true
        } else {
          if (initialRemaining && initialRemaining > 0) {
            const doneRatio = 1 - eventsResult.trips_restantes / initialRemaining
            setProgress(55 + Math.round(doneRatio * 40))
          } else {
            setProgress(70)
          }
          await new Promise((r) => setTimeout(r, 1000))
        }
      }

      if (cancelRef.current) {
        onClose()
        return
      }

      setPhase('completed')
      setProgress(100)
      setTimeout(() => onSyncComplete(), 1500)
    } catch (err) {
      setPhase('error')
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao sincronizar dados.')
    }
  }, [date, onClose, onSyncComplete])

  useEffect(() => {
    if (open && date) {
      runSync()
    }
  }, [open, date, retryKey, runSync])

  const handleRetry = () => {
    retryCountRef.current = 0
    setRetryKey((k) => k + 1)
  }

  const handleCancel = () => {
    cancelRef.current = true
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleCancel()}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900">
            Preparando seus dados
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Estamos sincronizando os dados do dia {formatDateBr(date)}. Isso pode levar alguns
            minutos na primeira consulta.
          </DialogDescription>
        </DialogHeader>

        {phase === 'syncing' && (
          <div className="space-y-4 py-2">
            <Progress value={progress} className="h-3 w-full [&>div]:bg-green-500" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 font-medium">
                {syncPhase === 'downloading_trips'
                  ? `Processando página ${currentPage} de ${totalPages}...`
                  : `Processando eventos...${tripsRemaining > 0 ? ` (${tripsRemaining} restantes)` : ''}`}
              </span>
              <span className="text-green-600 font-bold">{progress}%</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin text-green-600" />
              <span>
                {syncPhase === 'downloading_trips'
                  ? 'Baixando viagens...'
                  : `${eventsProcessed} eventos processados...`}
              </span>
            </div>
            <Button variant="outline" onClick={handleCancel} className="w-full">
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
          </div>
        )}

        {phase === 'completed' && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-slate-700 font-medium text-center">
                Sincronização concluída! Buscando seus eventos...
              </p>
              <Loader2 className="w-5 h-5 animate-spin text-green-600" />
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <p className="text-slate-700 text-center text-sm">{errorMessage}</p>
            </div>
            <Button
              onClick={handleRetry}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Tentar Novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
