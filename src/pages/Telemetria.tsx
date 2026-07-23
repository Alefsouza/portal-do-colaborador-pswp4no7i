import { useState, useMemo } from 'react'
import { Loader2, Search, AlertCircle, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { fetchTelemetry, type TelemetryRecord } from '@/services/telemetry'
import { cn } from '@/lib/utils'

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-600 bg-green-50'
  if (score >= 60) return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

function getScoreLabel(score: number) {
  if (score >= 80) return 'Excelente'
  if (score >= 60) return 'Médio'
  return 'Baixo'
}

export default function Telemetria() {
  const [dataInicial, setDataInicial] = useState<Date | undefined>(undefined)
  const [dataFinal, setDataFinal] = useState<Date | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<TelemetryRecord[]>([])
  const [hasConsulted, setHasConsulted] = useState(false)
  const [error, setError] = useState(false)

  const isValid = useMemo(() => {
    if (!dataInicial || !dataFinal) return false
    return dataInicial <= dataFinal
  }, [dataInicial, dataFinal])

  const handleConsult = async () => {
    if (!isValid || !dataInicial || !dataFinal) return
    setLoading(true)
    setError(false)
    setResults([])
    try {
      const data = await fetchTelemetry({ dataInicial, dataFinal })
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
                disabled={(date) => (dataFinal ? date > dataFinal : false)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Data Final</label>
              <DatePicker
                value={dataFinal}
                onChange={setDataFinal}
                placeholder="DD/MM/AAAA"
                disabled={(date) => (dataInicial ? date < dataInicial : false)}
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
          <AlertDescription>Erro ao consultar dados. Tente novamente mais tarde.</AlertDescription>
        </Alert>
      )}

      {hasConsulted && !loading && !error && (
        <Card className="border-slate-200">
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-lg text-slate-900">Resultados da Consulta</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {results.length} registro(s) encontrado(s)
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5 hover:bg-primary/5">
                    <TableHead className="font-bold text-primary">Data</TableHead>
                    <TableHead className="font-bold text-primary">Pontuação</TableHead>
                    <TableHead className="font-bold text-primary">Infrações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((record, index) => (
                    <TableRow
                      key={index}
                      className={cn(
                        'border-slate-100 transition-colors hover:bg-primary/5',
                        index % 2 === 0 ? 'bg-white' : 'bg-green-50/40',
                      )}
                    >
                      <TableCell className="font-medium text-slate-900 whitespace-nowrap">
                        {record.data}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-sm font-semibold',
                            getScoreColor(record.pontuacao),
                          )}
                        >
                          {record.pontuacao}
                          <span className="text-xs font-normal opacity-70">
                            ({getScoreLabel(record.pontuacao)})
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600">{record.infracoes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
