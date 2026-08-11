import { useState, useMemo } from 'react'
import {
  Loader2,
  Search,
  AlertCircle,
  Gauge,
  Route,
  Clock,
  TrendingUp,
  Wrench,
  Info,
} from 'lucide-react'
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
import { fetchTelemetry, type TelemetryRecord, type TelemetryEvent } from '@/services/telemetry'
import { cn } from '@/lib/utils'
import {
  toDateStr,
  formatEventDate,
  formatDuration,
  getEventBadgeClass,
} from '@/lib/telemetry-utils'

export default function Telemetria() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<TelemetryRecord | null>(null)
  const [hasConsulted, setHasConsulted] = useState(false)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showTechnicalEvents, setShowTechnicalEvents] = useState(false)

  const isValid = useMemo(() => !!selectedDate, [selectedDate])

  const datePickerDisabled = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return date < thirtyDaysAgo || date > yesterday
  }

  const totalEventos = useMemo(() => results?.resumo?.total_eventos ?? 0, [results])
  const distanciaTotal = useMemo(() => results?.metricas?.distancia_total ?? '0', [results])
  const velocidadeMedia = useMemo(() => results?.metricas?.velocidade_media ?? '0', [results])
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
    setShowTechnicalEvents(false)
    setHasConsulted(false)

    try {
      const data = await fetchTelemetry({ data: toDateStr(selectedDate) })
      setResults(data)
      setHasConsulted(true)
    } catch (err) {
      setError(true)
      const fallback = 'Não foi possível carregar os dados de telemetria. Tente novamente.'
      setErrorMessage(err instanceof Error && err.message ? err.message : fallback)
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
            <TableHead className="font-bold text-primary">Distância</TableHead>
            <TableHead className="font-bold text-primary">Velocidade</TableHead>
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
                {event.distancia || '-'}
              </TableCell>
              <TableCell className="text-slate-600 whitespace-nowrap">
                {event.velocidade || '-'}
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
            <p className="text-slate-700 font-medium">Buscando seus dados de telemetria...</p>
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

      {hasConsulted && !loading && !error && results && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total de eventos</p>
                    <p className="font-bold text-2xl text-slate-900">{totalEventos}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                    <Route className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Distância total</p>
                    <p className="font-bold text-2xl text-slate-900">
                      {distanciaTotal}
                      <span className="text-sm font-normal text-slate-500 ml-1">km</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Velocidade média</p>
                    <p className="font-bold text-2xl text-slate-900">
                      {velocidadeMedia}
                      <span className="text-sm font-normal text-slate-500 ml-1">km/h</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {totalEventos > 0 &&
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

          {totalEventos === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">Nenhum dado encontrado para esta data.</p>
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
        </>
      )}
    </div>
  )
}
