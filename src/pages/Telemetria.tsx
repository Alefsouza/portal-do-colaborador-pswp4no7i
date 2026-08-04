import { useState, useMemo, useEffect } from 'react'
import {
  Loader2,
  Search,
  AlertCircle,
  Gauge,
  Route,
  Clock,
  MapPin,
  Terminal,
  Wrench,
  Info,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DatePicker } from '@/components/date-picker'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  fetchTelemetry,
  NeedsSyncError,
  type TelemetryRecord,
  type TelemetryEvent,
} from '@/services/telemetry'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  toDateStr,
  formatEventDate,
  formatDuration,
  formatDriveDuration,
  extractScore,
  extractDistance,
  getScoreBg,
  getScoreLabel,
  getEventBadgeClass,
} from '@/lib/telemetry-utils'

export default function Telemetria() {
  const { user } = useAuth()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<TelemetryRecord | null>(null)
  const [hasConsulted, setHasConsulted] = useState(false)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [needsSync, setNeedsSync] = useState(false)
  const [workerId, setWorkerId] = useState<string>('')
  const [showTechnicalEvents, setShowTechnicalEvents] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    pb.collection('usuarios')
      .getOne(user.id)
      .then((record) => {
        const reg = (record as Record<string, unknown>).registro as string
        if (reg) setWorkerId(String(parseInt(reg, 10)))
      })
      .catch(() => {})
  }, [user?.id])

  const isValid = useMemo(() => !!selectedDate && !!workerId, [selectedDate, workerId])

  const datePickerDisabled = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return date < thirtyDaysAgo || date > yesterday
  }

  const score = useMemo(() => extractScore(results?.pontuacao), [results])
  const distance = useMemo(() => {
    if (results?.metricas?.distancia_total_km != null) return results.metricas.distancia_total_km
    return extractDistance(results?.pontuacao)
  }, [results])
  const totalViagens = useMemo(() => results?.metricas?.total_viagens ?? 0, [results])
  const sortedDrivingEvents = useMemo(() => {
    if (!results?.eventos_direcao) return []
    return [...results.eventos_direcao].sort((a, b) => (b.data || '').localeCompare(a.data || ''))
  }, [results])
  const sortedTechnicalEvents = useMemo(() => {
    if (!results?.eventos_tecnicos) return []
    return [...results.eventos_tecnicos].sort((a, b) => (b.data || '').localeCompare(a.data || ''))
  }, [results])

  const handleConsult = async () => {
    if (!isValid || !selectedDate) return
    setLoading(true)
    setError(false)
    setErrorMessage('')
    setResults(null)
    setNeedsSync(false)
    setShowTechnicalEvents(false)
    setHasConsulted(false)

    try {
      const data = await fetchTelemetry({ data: toDateStr(selectedDate), workerId })
      setResults(data)
      setHasConsulted(true)
    } catch (err) {
      if (err instanceof NeedsSyncError) {
        setNeedsSync(true)
      } else {
        setError(true)
        const fallback = 'Não foi possível carregar os dados de telemetria. Tente novamente.'
        setErrorMessage(err instanceof Error && err.message ? err.message : fallback)
      }
    } finally {
      setLoading(false)
    }
  }

  const renderEventsTable = (events: TelemetryEvent[]) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-primary/5 hover:bg-primary/5">
            <TableHead className="font-bold text-primary">Data/Hora</TableHead>
            <TableHead className="font-bold text-primary">Tipo do Evento</TableHead>
            <TableHead className="font-bold text-primary">Veículo</TableHead>
            <TableHead className="font-bold text-primary">Duração</TableHead>
            <TableHead className="font-bold text-primary">Quantidade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event, index) => (
            <TableRow
              key={index}
              className={cn(
                'border-slate-100 transition-colors hover:bg-primary/5',
                index % 2 === 0 ? 'bg-white' : 'bg-green-50/40',
              )}
            >
              <TableCell className="font-medium text-slate-900 whitespace-nowrap">
                {formatEventDate(event.data)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    'px-2.5 py-1 text-xs font-semibold',
                    getEventBadgeClass(event.tipo),
                  )}
                >
                  {event.tipo || '-'}
                </Badge>
              </TableCell>
              <TableCell className="text-slate-600 whitespace-nowrap">
                {event.veiculo || '-'}
              </TableCell>
              <TableCell className="text-slate-600 whitespace-nowrap">
                {formatDuration(event.duracao)}
              </TableCell>
              <TableCell className="text-slate-600 whitespace-nowrap">
                {event.quantidade !== undefined && event.quantidade !== 0 ? event.quantidade : '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Gauge className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Telemetria</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Consulte os dados de telemetria dos veículos por data.
          </p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Selecione a data</label>
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                placeholder="dd/mm/aaaa"
                disabled={datePickerDisabled}
              />
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0" />
                Dados disponíveis apenas dos últimos 30 dias. Eventos de hoje ficam disponíveis a
                partir de amanhã.
              </p>
            </div>
          </div>
          <Button
            onClick={handleConsult}
            disabled={!isValid || loading}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Consultando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Consultar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-slate-700 font-medium">
              Buscando suas viagens, isso pode levar até 2 minutos...
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-5 h-5" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>
            {errorMessage || 'Não foi possível carregar os dados de telemetria. Tente novamente.'}
          </AlertDescription>
        </Alert>
      )}

      {needsSync && !loading && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="w-5 h-5 text-blue-600" />
          <AlertTitle className="text-blue-800">Aguarde</AlertTitle>
          <AlertDescription className="text-blue-700">
            Os dados desta data ainda estão sendo processados. Tente novamente em alguns minutos.
          </AlertDescription>
        </Alert>
      )}

      {hasConsulted && !loading && !error && !needsSync && results && (
        <>
          {score !== null && (
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center gap-6">
                  <div
                    className={cn(
                      'w-20 h-20 rounded-full flex items-center justify-center text-white shrink-0',
                      getScoreBg(score),
                    )}
                  >
                    <span className="text-3xl font-bold">{Math.round(score)}</span>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <h3 className="text-lg font-bold text-slate-900">Pontuação Geral</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Classificação:{' '}
                      <span className="font-semibold text-slate-700">{getScoreLabel(score)}</span>
                    </p>
                    <p className="text-sm text-slate-500">
                      {sortedDrivingEvents.length}{' '}
                      {sortedDrivingEvents.length === 1
                        ? 'evento registrado'
                        : 'eventos registrados'}{' '}
                      nesta data
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-shrink-0">
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-1">
                        <Route className="w-5 h-5 text-blue-600" />
                      </div>
                      <p className="text-xl font-bold text-slate-900">{totalViagens}</p>
                      <p className="text-xs text-slate-500">Viagens</p>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-1">
                        <MapPin className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="text-xl font-bold text-slate-900">
                        {distance !== null ? distance.toFixed(1) : '-'}
                      </p>
                      <p className="text-xs text-slate-500">km</p>
                    </div>
                    <div className="text-center col-span-2 sm:col-span-1">
                      <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-1">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <p className="text-xl font-bold text-slate-900">
                        {formatDriveDuration(results.metricas?.duracao_total || '00:00:00')}
                      </p>
                      <p className="text-xs text-slate-500">Direção</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {totalViagens > 0 &&
            results.resumo?.por_tipo &&
            Object.keys(results.resumo.por_tipo).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(results.resumo.por_tipo).map(([tipo, count]) => (
                  <Badge
                    key={tipo}
                    variant="outline"
                    className={cn('px-3 py-1.5 text-sm font-medium', getEventBadgeClass(tipo))}
                  >
                    {tipo}: {count}
                  </Badge>
                ))}
              </div>
            )}

          {totalViagens === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Nenhuma viagem encontrada para esta data.</p>
              </CardContent>
            </Card>
          ) : sortedDrivingEvents.length > 0 ? (
            <Card className="border-slate-200">
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-lg text-slate-900">Eventos de Direção</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {sortedDrivingEvents.length} registro(s) encontrado(s)
                  </p>
                </div>
                {renderEventsTable(sortedDrivingEvents)}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Nenhum evento de direção registrado nesta data.</p>
              </CardContent>
            </Card>
          )}

          {sortedTechnicalEvents.length > 0 && (
            <div>
              <Button
                variant="outline"
                onClick={() => setShowTechnicalEvents(!showTechnicalEvents)}
                className="mb-4"
              >
                <Wrench className="w-4 h-4 mr-2" />
                {showTechnicalEvents ? 'Ocultar eventos técnicos' : 'Ver eventos técnicos'}
              </Button>
              {showTechnicalEvents && (
                <Card className="border-slate-200">
                  <CardContent className="p-0">
                    <div className="px-6 py-4 border-b border-slate-100">
                      <h2 className="font-bold text-lg text-slate-900">Eventos Técnicos</h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {sortedTechnicalEvents.length} registro(s) encontrado(s)
                      </p>
                    </div>
                    {renderEventsTable(sortedTechnicalEvents)}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {results.debug && (
            <Card className="border-slate-200">
              <CardContent className="p-0">
                <Accordion type="single" collapsible>
                  <AccordionItem value="debug" className="border-0">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-slate-500" />
                        <span className="font-bold text-slate-900">Detalhes técnicos</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <span className="text-slate-600">
                            <strong>Worker ID:</strong> {results.debug.worker_id ?? '-'}
                          </span>
                          <span className="text-slate-600">
                            <strong>Data:</strong> {results.debug.data ?? '-'}
                          </span>
                          <span className="text-slate-600">
                            <strong>Status:</strong>{' '}
                            {results.debug.completo ? (
                              <span className="text-green-600 font-medium">Completo</span>
                            ) : (
                              <span className="text-amber-600 font-medium">Parcial</span>
                            )}
                          </span>
                          <span className="text-slate-600">
                            <strong>Páginas:</strong> {results.debug.paginas_processadas ?? 0} de{' '}
                            {results.debug.paginas_total ?? 0}
                          </span>
                          <span className="text-slate-600">
                            <strong>Páginas restantes:</strong>{' '}
                            {results.debug.paginas_restantes ?? 0}
                          </span>
                          <span className="text-slate-600">
                            <strong>Trips do dia:</strong> {results.debug.trips_total_dia ?? 0}
                          </span>
                          <span className="text-slate-600">
                            <strong>Trips varridas:</strong> {results.debug.trips_varridas ?? 0}
                          </span>
                          <span className="text-slate-600">
                            <strong>Trips encontradas:</strong>{' '}
                            {results.debug.trips_encontradas ?? 0}
                          </span>
                          <span className="text-slate-600">
                            <strong>Tempo:</strong>{' '}
                            {results.debug.tempo_segundos != null
                              ? `${results.debug.tempo_segundos.toFixed(1)}s`
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
