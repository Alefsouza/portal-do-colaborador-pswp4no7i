import { useState, useMemo, useEffect } from 'react'
import {
  Loader2,
  Search,
  AlertCircle,
  AlertTriangle,
  Gauge,
  Route,
  Clock,
  MapPin,
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
import { fetchTelemetry, type TelemetryRecord, type TelemetryScore } from '@/services/telemetry'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatEventDate(dateStr: string): string {
  if (!dateStr) return '-'
  const cleaned = dateStr.replace('T', ' ')
  const [datePart, timePart] = cleaned.split(' ')
  if (!datePart) return dateStr
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return dateStr
  const time = timePart ? timePart.substring(0, 5) : '00:00'
  return `${d}/${m}/${y} ${time}`
}

function formatDuration(duracao: number | string | undefined): string {
  if (duracao === undefined || duracao === null || duracao === '') return '-'
  const seconds = typeof duracao === 'string' ? parseInt(duracao, 10) : duracao
  if (isNaN(seconds) || seconds <= 0) return '-'
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

function formatDriveDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '-'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function extractScore(p: TelemetryScore | number | null | undefined): number | null {
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

function extractDistance(p: TelemetryScore | number | null | undefined): number | null {
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
  for (const nestedKey of ['metricas', 'totais', 'data']) {
    const nested = p[nestedKey]
    if (nested && typeof nested === 'object') {
      for (const k of keys) {
        const v = (nested as Record<string, unknown>)[k]
        if (typeof v === 'number' && v > 0) return v
      }
    }
  }
  return null
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excelente'
  if (score >= 60) return 'Médio'
  return 'Baixo'
}

function getEventBadgeClass(tipo: string): string {
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

function formatCounter(tipo: string, count: number): string {
  const l = tipo.toLowerCase()
  if (l.includes('velocidade'))
    return `${count} ${count === 1 ? 'Excesso' : 'Excessos'} de velocidade`
  if (l.includes('freada') || l.includes('frenagem'))
    return `${count} ${count === 1 ? 'Freada' : 'Freadas'} brusca${count === 1 ? '' : 's'}`
  if (l.includes('acelera'))
    return `${count} ${count === 1 ? 'Aceleração' : 'Acelerações'} brusca${count === 1 ? '' : 's'}`
  if (l.includes('celular')) return `${count} ${count === 1 ? 'Uso' : 'Usos'} de celular`
  if (l.includes('curva') || l.includes('desconforto'))
    return `${count} ${count === 1 ? 'Desconforto' : 'Desconfortos'} em curva`
  return `${count} ${tipo}`
}

const KNOWN_EVENT_TYPES = [
  'Desconforto em curva',
  'Excesso de velocidade',
  'Freada brusca',
  'Aceleração brusca',
  'Curva perigosa',
  'Uso de celular',
]

export default function Telemetria() {
  const { user } = useAuth()
  const [dataInicial, setDataInicial] = useState<Date | undefined>(undefined)
  const [dataFinal, setDataFinal] = useState<Date | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<TelemetryRecord | null>(null)
  const [hasConsulted, setHasConsulted] = useState(false)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [workerId, setWorkerId] = useState<string>('')

  useEffect(() => {
    if (!user?.id) return
    pb.collection('usuarios')
      .getOne(user.id)
      .then((record) => {
        const reg = (record as Record<string, unknown>).registro as string
        if (reg) {
          setWorkerId(String(parseInt(reg, 10)))
        }
      })
      .catch(() => {})
  }, [user?.id])

  const isValid = useMemo(() => {
    if (!dataInicial || !dataFinal) return false
    if (!workerId) return false
    return dataInicial <= dataFinal
  }, [dataInicial, dataFinal, workerId])

  const score = useMemo(() => extractScore(results?.pontuacao), [results])
  const distance = useMemo(() => {
    if (results?.metricas?.distancia_total) return results.metricas.distancia_total
    return extractDistance(results?.pontuacao)
  }, [results])
  const totalViagens = useMemo(() => results?.total_viagens ?? 0, [results])
  const duracaoTotal = useMemo(() => results?.metricas?.duracao_total ?? 0, [results])
  const sortedEvents = useMemo(() => {
    if (!results?.eventos) return []
    return [...results.eventos].sort((a, b) => (b.data || '').localeCompare(a.data || ''))
  }, [results])

  const allResumoKeys = useMemo(() => {
    const keys = Object.keys(results?.resumo || {})
    const known = KNOWN_EVENT_TYPES.filter((k) => !keys.includes(k))
    return [...keys, ...known]
  }, [results])

  const handleConsult = async () => {
    if (!isValid || !dataInicial || !dataFinal) return
    setLoading(true)
    setError(false)
    setErrorMessage('')
    setResults(null)
    try {
      const data = await fetchTelemetry({
        dataInicial: toDateStr(dataInicial),
        dataFinal: toDateStr(dataFinal),
        workerId,
      })
      setResults(data)
      setHasConsulted(true)
    } catch (err) {
      setError(true)
      const fallback =
        'Não foi possível carregar os dados de telemetria. Tente novamente em instantes.'
      if (err instanceof Error && err.message) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage(fallback)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Gauge className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Telemetria</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Consulte os dados de telemetria dos veículos por período.
          </p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Data Inicial</label>
              <DatePicker
                value={dataInicial}
                onChange={setDataInicial}
                placeholder="DD/MM/AAAA"
                disabled={(date: Date) => (dataFinal ? date > dataFinal : false)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Data Final</label>
              <DatePicker
                value={dataFinal}
                onChange={setDataFinal}
                placeholder="DD/MM/AAAA"
                disabled={(date: Date) => (dataInicial ? date < dataInicial : false)}
              />
            </div>
          </div>

          {dataInicial && dataFinal && dataInicial > dataFinal && (
            <p className="text-sm text-red-500 mb-4">
              A Data Inicial deve ser anterior ou igual à Data Final.
            </p>
          )}

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

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-5 h-5" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>
            {errorMessage ||
              'Não foi possível carregar os dados de telemetria. Tente novamente em instantes.'}
          </AlertDescription>
        </Alert>
      )}

      {hasConsulted && !loading && !error && results && (
        <>
          {results.partialData && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <AlertTitle className="text-amber-800">Dados Parciais</AlertTitle>
              <AlertDescription className="text-amber-700">
                O processamento foi limitado para evitar timeout.{' '}
                {results.errors && results.errors.length > 0
                  ? `${results.errors.length} viagem(ões) não puderam ser processada(s).`
                  : 'Apenas as viagens mais recentes foram processadas.'}
              </AlertDescription>
            </Alert>
          )}
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
                      {sortedEvents.length}{' '}
                      {sortedEvents.length === 1 ? 'evento registrado' : 'eventos registrados'} no
                      período
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
                        {formatDriveDuration(duracaoTotal)}
                      </p>
                      <p className="text-xs text-slate-500">Direção</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {allResumoKeys.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allResumoKeys.map((tipo) => (
                <Badge
                  key={tipo}
                  variant="outline"
                  className={cn('px-3 py-1.5 text-sm font-medium', getEventBadgeClass(tipo))}
                >
                  {formatCounter(tipo, results.resumo[tipo] || 0)}
                </Badge>
              ))}
            </div>
          )}

          {sortedEvents.length > 0 ? (
            <Card className="border-slate-200">
              <CardContent className="p-0">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-lg text-slate-900">Eventos Registrados</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {sortedEvents.length} registro(s) encontrado(s)
                  </p>
                </div>
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
                      {sortedEvents.map((event, index) => (
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
                            {event.quantidade !== undefined && event.quantidade !== 0
                              ? event.quantidade
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200">
              <CardContent className="py-12 text-center">
                <p className="text-slate-500">
                  Nenhum evento de <strong>direção</strong> registrado neste período.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
