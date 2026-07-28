import { useState, useMemo, useEffect } from 'react'
import { Loader2, Search, AlertCircle, Gauge } from 'lucide-react'
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
import { fetchTelemetry, type TelemetryResponse, type TelemetryScore } from '@/services/telemetry'
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

function extractScore(p: TelemetryScore | null | undefined): number | null {
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
  return `${count} ${tipo}`
}

export default function Telemetria() {
  const { user } = useAuth()
  const [dataInicial, setDataInicial] = useState<Date | undefined>(undefined)
  const [dataFinal, setDataFinal] = useState<Date | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<TelemetryResponse | null>(null)
  const [hasConsulted, setHasConsulted] = useState(false)
  const [error, setError] = useState(false)
  const [driverId, setDriverId] = useState<string>('')

  useEffect(() => {
    if (!user?.id) return
    pb.collection('usuarios')
      .getOne(user.id)
      .then((record) => {
        const reg = (record as Record<string, unknown>).registro as string
        const cpf = (record as Record<string, unknown>).cpf as string
        setDriverId(reg || cpf || '')
      })
      .catch(() => {})
  }, [user?.id])

  const isValid = useMemo(() => {
    if (!dataInicial || !dataFinal) return false
    if (!driverId) return false
    return dataInicial <= dataFinal
  }, [dataInicial, dataFinal, driverId])

  const score = useMemo(() => extractScore(results?.pontuacao), [results])
  const sortedEvents = useMemo(() => {
    if (!results?.eventos) return []
    return [...results.eventos].sort((a, b) => (b.data || '').localeCompare(a.data || ''))
  }, [results])

  const handleConsult = async () => {
    if (!isValid || !dataInicial || !dataFinal) return
    setLoading(true)
    setError(false)
    setResults(null)
    try {
      const data = await fetchTelemetry({
        dataInicial: toDateStr(dataInicial),
        dataFinal: toDateStr(dataFinal),
        driverId,
      })
      setResults(data)
      setHasConsulted(true)
    } catch {
      setError(true)
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
            Não foi possível carregar os dados de telemetria. Tente novamente em instantes.
          </AlertDescription>
        </Alert>
      )}

      {hasConsulted && !loading && !error && results && (
        <>
          {score !== null && (
            <Card className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <div
                    className={cn(
                      'w-20 h-20 rounded-full flex items-center justify-center text-white shrink-0',
                      getScoreBg(score),
                    )}
                  >
                    <span className="text-3xl font-bold">{Math.round(score)}</span>
                  </div>
                  <div>
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
                </div>
              </CardContent>
            </Card>
          )}

          {Object.keys(results.resumo).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(results.resumo).map(([tipo, count]) => (
                <Badge
                  key={tipo}
                  variant="outline"
                  className={cn('px-3 py-1.5 text-sm font-medium', getEventBadgeClass(tipo))}
                >
                  {formatCounter(tipo, count)}
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
                        <TableHead className="font-bold text-primary">Tipo</TableHead>
                        <TableHead className="font-bold text-primary">Veículo</TableHead>
                        <TableHead className="font-bold text-primary">Descrição</TableHead>
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
                          <TableCell className="text-slate-600">
                            {[event.localizacao, event.gravidade].filter(Boolean).join(' — ') ||
                              '-'}
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
                <p className="text-slate-500">Nenhum evento registrado neste período.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
