import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2,
  RefreshCw,
  Trash2,
  CalendarSync,
  Database,
  Clock,
  Route,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Info,
} from 'lucide-react'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DatePicker } from '@/components/date-picker'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { toDateStr, formatDateBr, formatEventDate } from '@/lib/telemetry-utils'
import {
  getTelemetryStats,
  getSyncHistory,
  syncDay,
  clearOldData,
  type TelemetryStats,
  type SyncLogRecord,
  type SyncDayResult,
  type ClearOldDataResult,
} from '@/services/admin-telemetria-sync'

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'sucesso':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'parcial':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    case 'erro':
      return 'bg-red-100 text-red-700 border-red-200'
    case 'em_andamento':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'sucesso':
      return 'Sucesso'
    case 'parcial':
      return 'Parcial'
    case 'erro':
      return 'Erro'
    case 'em_andamento':
      return 'Em Andamento'
    default:
      return status
  }
}

export default function AdminTelemetriaSync() {
  const { user } = useAdminAuth()
  const navigate = useNavigate()
  const canAccess = user?.perfil === 'TI' || user?.perfil === 'Admin'

  const [stats, setStats] = useState<TelemetryStats | null>(null)
  const [history, setHistory] = useState<SyncLogRecord[]>([])
  const [loadingStats, setLoadingStats] = useState(true)

  const [specificDate, setSpecificDate] = useState<Date | undefined>(undefined)
  const [syncingDate, setSyncingDate] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncDayResult | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const [clearing, setClearing] = useState(false)
  const [clearResult, setClearResult] = useState<ClearOldDataResult | null>(null)
  const [clearError, setClearError] = useState<string | null>(null)

  const [resyncingDate, setResyncingDate] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoadingStats(true)
    try {
      const [s, h] = await Promise.all([getTelemetryStats(), getSyncHistory()])
      setStats(s)
      setHistory(h)
    } catch {
      /* ignore */
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    if (user && !canAccess) {
      navigate('/admin/dashboard', { replace: true })
    }
  }, [user, canAccess, navigate])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleSyncDay = async () => {
    if (!specificDate) return
    setSyncingDate(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      const result = await syncDay(toDateStr(specificDate))
      setSyncResult(result)
      await loadAll()
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Erro ao sincronizar')
    } finally {
      setSyncingDate(false)
    }
  }

  const handleClearOld = async () => {
    setClearing(true)
    setClearResult(null)
    setClearError(null)
    try {
      const result = await clearOldData()
      setClearResult(result)
      await loadAll()
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'Erro ao limpar dados')
    } finally {
      setClearing(false)
    }
  }

  const handleResync = async (date: string) => {
    setResyncingDate(date)
    try {
      await syncDay(date)
      await loadAll()
    } catch {
      /* ignore */
    } finally {
      setResyncingDate(null)
    }
  }

  if (!canAccess) return null

  const pbUrl = import.meta.env.VITE_POCKETBASE_URL || ''

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          Gestão de Sincronização - Telemetria DataBus
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Gerencie a sincronização de dados de telemetria do DataBus.
        </p>
      </div>

      {loadingStats ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Última sincronização</p>
                    <p className="font-bold text-slate-900">
                      {stats?.lastSyncDate ? formatDateBr(stats.lastSyncDate) : '-'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Database className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Dias em cache</p>
                    <p className="font-bold text-slate-900">{stats?.totalDays ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Route className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total de viagens</p>
                    <p className="font-bold text-slate-900">{stats?.totalTrips ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total de eventos</p>
                    <p className="font-bold text-slate-900">{stats?.totalEvents ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200">
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="font-bold text-lg text-slate-900">Histórico de Sincronização</h2>
                <p className="text-sm text-slate-500 mt-0.5">Últimos 30 dias</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                      <TableHead className="font-bold text-primary">Data</TableHead>
                      <TableHead className="font-bold text-primary">Status</TableHead>
                      <TableHead className="font-bold text-primary">Páginas</TableHead>
                      <TableHead className="font-bold text-primary">Trips</TableHead>
                      <TableHead className="font-bold text-primary">Eventos</TableHead>
                      <TableHead className="font-bold text-primary">Duração</TableHead>
                      <TableHead className="font-bold text-primary">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-500 py-8">
                          Nenhum registro de sincronização encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      history.map((row) => (
                        <TableRow key={row.id} className="border-slate-100 hover:bg-primary/5">
                          <TableCell className="font-medium text-slate-900 whitespace-nowrap">
                            {formatDateBr(row.data_sincronizada)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                'px-2.5 py-1 text-xs font-semibold',
                                getStatusBadgeClass(row.status),
                              )}
                            >
                              {getStatusLabel(row.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600 whitespace-nowrap">
                            {row.paginas_processadas || 0}/{row.paginas_total || 0}
                          </TableCell>
                          <TableCell className="text-slate-600 whitespace-nowrap">
                            {row.trips_processadas || 0}
                          </TableCell>
                          <TableCell className="text-slate-600 whitespace-nowrap">
                            {row.eventos_processados || 0}
                          </TableCell>
                          <TableCell className="text-slate-600 whitespace-nowrap">
                            {row.duracao_segundos ? `${row.duracao_segundos}s` : '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResync(row.data_sincronizada)}
                              disabled={resyncingDate === row.data_sincronizada}
                              className="gap-1.5"
                            >
                              {resyncingDate === row.data_sincronizada ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              Ressincronizar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CalendarSync className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">Sincronizar data específica</h2>
                    <p className="text-sm text-slate-500">Execute a sincronização para uma data</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Data</label>
                  <DatePicker
                    value={specificDate}
                    onChange={setSpecificDate}
                    placeholder="dd/mm/aaaa"
                  />
                </div>
                <Button
                  onClick={handleSyncDay}
                  disabled={!specificDate || syncingDate}
                  className="bg-primary hover:bg-primary/90 text-white w-full"
                >
                  {syncingDate ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Executar sincronização agora
                    </>
                  )}
                </Button>
                {syncingDate && specificDate && (
                  <p className="text-sm text-amber-600 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    Sincronizando dia {formatDateBr(toDateStr(specificDate))}, isso pode levar até 5
                    minutos...
                  </p>
                )}
                {syncResult && !syncingDate && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      Sincronização {syncResult.sucesso ? 'concluída' : 'com problemas'}.{' '}
                      {syncResult.trips_processadas} trips e {syncResult.eventos_processados}{' '}
                      eventos processados.
                    </AlertDescription>
                  </Alert>
                )}
                {syncError && !syncingDate && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>{syncError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">Limpar dados antigos</h2>
                    <p className="text-sm text-slate-500">
                      Remove registros com mais de 30 dias do banco local.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleClearOld}
                  disabled={clearing}
                  variant="outline"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50"
                >
                  {clearing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Limpando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Executar limpeza
                    </>
                  )}
                </Button>
                {clearResult && !clearing && (
                  <Alert className="border-green-200 bg-green-50">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <AlertDescription className="text-green-700">
                      {clearResult.trips_removidas} trips e {clearResult.eventos_removidos} eventos
                      removidos.
                    </AlertDescription>
                  </Alert>
                )}
                {clearError && !clearing && (
                  <Alert variant="destructive">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>{clearError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Configuração de disparo automático</h2>
                  <p className="text-sm text-slate-500">
                    Configure a sincronização automática diária
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Endpoint URL:</p>
                  <code className="block bg-slate-50 rounded-lg px-3 py-2 text-slate-800 border border-slate-200 break-all">
                    {pbUrl}/backend/v1/datalbus/sync-day
                  </code>
                </div>
                <div className="flex items-start gap-2 text-slate-600">
                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <p>
                    Este endpoint deve ser chamado diariamente às 3h da manhã com a data de ontem
                    (D-1) para manter os dados sincronizados. Configure um disparador externo
                    (Adapta Play, GitHub Actions, EasyCron) para executar essa chamada.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Exemplo de payload:</p>
                  <code className="block bg-slate-50 rounded-lg px-3 py-2 text-slate-800 border border-slate-200">
                    {`{ "data": "YYYY-MM-DD" }`}
                  </code>
                </div>
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Exemplo de header:</p>
                  <code className="block bg-slate-50 rounded-lg px-3 py-2 text-slate-800 border border-slate-200">
                    {`X-Sync-Token: {token_configurado_no_secret}`}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
