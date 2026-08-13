import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Info,
  Settings,
  Users,
  TrendingUp,
  Route,
} from 'lucide-react'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  importCsvBatch,
  clearOldTelemetryData,
  type BatchImportResult,
  importTripsCsvBatch,
  type BatchTripsImportResult,
} from '@/services/admin-telemetria-import'

export default function AdminTelemetriaImportacao() {
  const { user } = useAdminAuth()
  const navigate = useNavigate()
  const canAccess = user?.perfil === 'TI' || user?.perfil === 'Admin'

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<BatchImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [progressValue, setProgressValue] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')

  const [tripsFile, setTripsFile] = useState<File | null>(null)
  const [tripsImporting, setTripsImporting] = useState(false)
  const [tripsResult, setTripsResult] = useState<BatchTripsImportResult | null>(null)
  const [tripsError, setTripsError] = useState<string | null>(null)
  const [tripsProgressValue, setTripsProgressValue] = useState(0)
  const [tripsProgressLabel, setTripsProgressLabel] = useState('')

  const [clearing, setClearing] = useState(false)
  const [clearResult, setClearResult] = useState<{
    eventos_removidos: number
    data_corte: string
  } | null>(null)
  const [clearError, setClearError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const tripsFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user && !canAccess) {
      navigate('/admin/dashboard', { replace: true })
    }
  }, [user, canAccess, navigate])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const validExtensions = ['.csv', '.txt']
      const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      if (!validExtensions.includes(fileExtension)) {
        toast.error('Formato de arquivo não suportado. Selecione um arquivo .csv ou .txt.')
        e.target.value = ''
        return
      }
      setSelectedFile(file)
      setImportResult(null)
      setImportError(null)
    }
  }, [])

  const handleTripsFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const validExtensions = ['.csv', '.txt']
      const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      if (!validExtensions.includes(fileExtension)) {
        toast.error('Formato de arquivo não suportado. Selecione um arquivo .csv ou .txt.')
        e.target.value = ''
        return
      }
      setTripsFile(file)
      setTripsResult(null)
      setTripsError(null)
    }
  }, [])

  const handleImport = async () => {
    if (!selectedFile) return
    setImporting(true)
    setImportResult(null)
    setImportError(null)
    setProgressValue(0)
    setProgressLabel('')
    try {
      const csvContent = await selectedFile.text()
      const result = await importCsvBatch(csvContent, (completed, total) => {
        const pct = Math.round((completed / total) * 100)
        setProgressValue(pct)
        setProgressLabel(`${completed} / ${total} chunks`)
      })
      setImportResult(result)
      if (result.chunksFailed > 0) {
        toast.warning(
          `Importação concluída com ${result.chunksFailed} chunk(s) com falha de ${result.chunksTotal}.`,
        )
      } else {
        toast.success('Importação concluída com sucesso!')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar o CSV.'
      setImportError(msg)
      toast.error(msg)
    } finally {
      setImporting(false)
    }
  }

  const handleTripsImport = async () => {
    if (!tripsFile) return
    setTripsImporting(true)
    setTripsResult(null)
    setTripsError(null)
    setTripsProgressValue(0)
    setTripsProgressLabel('')
    try {
      const csvContent = await tripsFile.text()
      const result = await importTripsCsvBatch(csvContent, (completed, total) => {
        const pct = Math.round((completed / total) * 100)
        setTripsProgressValue(pct)
        setTripsProgressLabel(`${completed} / ${total} chunks`)
      })
      setTripsResult(result)
      if (result.chunksFailed > 0) {
        toast.warning(
          `Importação concluída com ${result.chunksFailed} chunk(s) com falha de ${result.chunksTotal}.`,
        )
      } else {
        toast.success('Importação de Trips concluída com sucesso!')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar o CSV de Trips.'
      setTripsError(msg)
      toast.error(msg)
    } finally {
      setTripsImporting(false)
    }
  }

  const handleClearOld = async () => {
    setClearing(true)
    setClearResult(null)
    setClearError(null)
    try {
      const result = await clearOldTelemetryData()
      setClearResult(result)
      toast.success(`${result.eventos_removidos} eventos antigos removidos.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao limpar dados antigos.'
      setClearError(msg)
      toast.error(msg)
    } finally {
      setClearing(false)
    }
  }

  if (!canAccess) return null

  const pbUrl = import.meta.env.VITE_POCKETBASE_URL || ''

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          Importação de Telemetria - Kontrow
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Importe arquivos CSV ou TXT do Kontrow para processar eventos e viagens de telemetria.
        </p>
      </div>

      <Tabs defaultValue="eventos">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          <TabsTrigger value="trips">Trips</TabsTrigger>
        </TabsList>

        <TabsContent value="eventos" className="mt-6 space-y-6">
          <Card className="border-slate-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Importar arquivo CSV/TXT - Eventos</h2>
                  <p className="text-sm text-slate-500">
                    Selecione um arquivo CSV ou TXT exportado do Kontrow e processe os dados de
                    eventos.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    {selectedFile ? selectedFile.name : 'Selecionar arquivo CSV ou TXT'}
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!selectedFile || importing}
                    className="bg-primary hover:bg-primary/90 text-white flex-1"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Processar
                      </>
                    )}
                  </Button>
                </div>
                {selectedFile && (
                  <p className="text-xs text-slate-500">
                    Arquivo selecionado: {selectedFile.name} (
                    {(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {importing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Processando em lotes...</span>
                    <span className="font-medium">{progressLabel}</span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
                </div>
              )}

              {importResult && !importing && (
                <Alert
                  className={
                    importResult.chunksFailed > 0
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-green-200 bg-green-50'
                  }
                >
                  <CheckCircle2
                    className={
                      importResult.chunksFailed > 0
                        ? 'w-4 h-4 text-amber-600'
                        : 'w-4 h-4 text-green-600'
                    }
                  />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p
                        className={
                          importResult.chunksFailed > 0
                            ? 'font-semibold text-amber-800'
                            : 'font-semibold text-green-800'
                        }
                      >
                        Importação concluída! ({importResult.chunksSucceeded}/
                        {importResult.chunksTotal} chunks processados com sucesso)
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp
                            className={
                              importResult.chunksFailed > 0
                                ? 'w-4 h-4 text-amber-600'
                                : 'w-4 h-4 text-green-600'
                            }
                          />
                          <span
                            className={
                              importResult.chunksFailed > 0 ? 'text-amber-700' : 'text-green-700'
                            }
                          >
                            Total de linhas: <strong>{importResult.aggregated.total_linhas}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span
                            className={
                              importResult.chunksFailed > 0 ? 'text-amber-700' : 'text-green-700'
                            }
                          >
                            Eventos de direção:{' '}
                            <strong>{importResult.aggregated.eventos_direcao}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span
                            className={
                              importResult.chunksFailed > 0 ? 'text-amber-700' : 'text-green-700'
                            }
                          >
                            Eventos técnicos:{' '}
                            <strong>{importResult.aggregated.eventos_tecnicos}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users
                            className={
                              importResult.chunksFailed > 0
                                ? 'w-4 h-4 text-amber-600'
                                : 'w-4 h-4 text-green-600'
                            }
                          />
                          <span
                            className={
                              importResult.chunksFailed > 0 ? 'text-amber-700' : 'text-green-700'
                            }
                          >
                            Motoristas encontrados:{' '}
                            <strong>{importResult.aggregated.motoristas_encontrados}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span
                            className={
                              importResult.chunksFailed > 0 ? 'text-amber-700' : 'text-green-700'
                            }
                          >
                            Motoristas não encontrados:{' '}
                            <strong>{importResult.aggregated.motoristas_nao_encontrados}</strong>
                          </span>
                        </div>
                      </div>
                      {importResult.chunksFailed > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="font-semibold text-amber-800 text-xs">
                            {importResult.chunksFailed} chunk(s) com falha:
                          </p>
                          {importResult.errors.map((err, idx) => (
                            <p key={idx} className="text-xs text-amber-700">
                              {err}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {importError && !importing && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{importError}</AlertDescription>
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
                    Remove registros de telemetria com mais de 30 dias do banco local.
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
                    {clearResult.eventos_removidos} eventos removidos. Data de corte:{' '}
                    {clearResult.data_corte}.
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
        </TabsContent>

        <TabsContent value="trips" className="mt-6 space-y-6">
          <Card className="border-slate-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Route className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Importar arquivo CSV/TXT - Trips</h2>
                  <p className="text-sm text-slate-500">
                    Selecione um arquivo CSV ou TXT com dados de viagens (Trips) e processe os
                    dados.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <input
                  ref={tripsFileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleTripsFileSelect}
                  className="hidden"
                />
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={() => tripsFileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    {tripsFile ? tripsFile.name : 'Selecionar arquivo CSV ou TXT'}
                  </Button>
                  <Button
                    onClick={handleTripsImport}
                    disabled={!tripsFile || tripsImporting}
                    className="bg-primary hover:bg-primary/90 text-white flex-1"
                  >
                    {tripsImporting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Processar
                      </>
                    )}
                  </Button>
                </div>
                {tripsFile && (
                  <p className="text-xs text-slate-500">
                    Arquivo selecionado: {tripsFile.name} ({(tripsFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {tripsImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>Processando em lotes...</span>
                    <span className="font-medium">{tripsProgressLabel}</span>
                  </div>
                  <Progress value={tripsProgressValue} className="h-2" />
                </div>
              )}

              {tripsResult && !tripsImporting && (
                <Alert
                  className={
                    tripsResult.chunksFailed > 0
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-green-200 bg-green-50'
                  }
                >
                  <CheckCircle2
                    className={
                      tripsResult.chunksFailed > 0
                        ? 'w-4 h-4 text-amber-600'
                        : 'w-4 h-4 text-green-600'
                    }
                  />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p
                        className={
                          tripsResult.chunksFailed > 0
                            ? 'font-semibold text-amber-800'
                            : 'font-semibold text-green-800'
                        }
                      >
                        Importação concluída! ({tripsResult.chunksSucceeded}/
                        {tripsResult.chunksTotal} chunks processados com sucesso)
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp
                            className={
                              tripsResult.chunksFailed > 0
                                ? 'w-4 h-4 text-amber-600'
                                : 'w-4 h-4 text-green-600'
                            }
                          />
                          <span
                            className={
                              tripsResult.chunksFailed > 0 ? 'text-amber-700' : 'text-green-700'
                            }
                          >
                            Total de linhas: <strong>{tripsResult.aggregated.total_linhas}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Route
                            className={
                              tripsResult.chunksFailed > 0
                                ? 'w-4 h-4 text-amber-600'
                                : 'w-4 h-4 text-green-600'
                            }
                          />
                          <span
                            className={
                              tripsResult.chunksFailed > 0 ? 'text-amber-700' : 'text-green-700'
                            }
                          >
                            Trips encontrados:{' '}
                            <strong>{tripsResult.aggregated.trips_encontrados}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users
                            className={
                              tripsResult.chunksFailed > 0
                                ? 'w-4 h-4 text-amber-600'
                                : 'w-4 h-4 text-green-600'
                            }
                          />
                          <span
                            className={
                              tripsResult.chunksFailed > 0 ? 'text-amber-700' : 'text-green-700'
                            }
                          >
                            Motoristas encontrados:{' '}
                            <strong>{tripsResult.aggregated.motoristas_encontrados}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span
                            className={
                              tripsResult.chunksFailed > 0 ? 'text-amber-700' : 'text-green-700'
                            }
                          >
                            Motoristas não encontrados:{' '}
                            <strong>{tripsResult.aggregated.motoristas_nao_encontrados}</strong>
                          </span>
                        </div>
                      </div>
                      {tripsResult.chunksFailed > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="font-semibold text-amber-800 text-xs">
                            {tripsResult.chunksFailed} chunk(s) com falha:
                          </p>
                          {tripsResult.errors.map((err, idx) => (
                            <p key={idx} className="text-xs text-amber-700">
                              {err}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {tripsError && !tripsImporting && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>{tripsError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-slate-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Configuração de importação automática</h2>
              <p className="text-sm text-slate-500">
                Configure a importação automática via agendador externo
              </p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-slate-700 mb-1">Endpoint de Eventos:</p>
              <code className="block bg-slate-50 rounded-lg px-3 py-2 text-slate-800 border border-slate-200 break-all">
                {pbUrl}/backend/v1/telemetria/csv-import
              </code>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">Endpoint de Trips:</p>
              <code className="block bg-slate-50 rounded-lg px-3 py-2 text-slate-800 border border-slate-200 break-all">
                {pbUrl}/backend/v1/telemetria/trips-import
              </code>
            </div>
            <div className="flex items-start gap-2 text-slate-600">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p>
                Estes endpoints recebem o conteúdo do CSV como texto no campo{' '}
                <code className="bg-slate-100 px-1 rounded">csv</code> do body JSON. Podem ser
                chamados via agendador externo (GitHub Actions, EasyCron, etc.) para automatizar a
                importação. O header <code className="bg-slate-100 px-1 rounded">X-Sync-Token</code>{' '}
                pode ser usado para autenticação automática.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">Exemplo de payload:</p>
              <code className="block bg-slate-50 rounded-lg px-3 py-2 text-slate-800 border border-slate-200">
                {`{ "csv": "Motorista,Grupo do motorista,Frota/Placa,..." }`}
              </code>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">Exemplo de header:</p>
              <code className="block bg-slate-50 rounded-lg px-3 py-2 text-slate-800 border border-slate-200">
                {`X-Sync-Token: {token_configurado_no_secret}`}
              </code>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-1">Endpoint de limpeza automática:</p>
              <code className="block bg-slate-50 rounded-lg px-3 py-2 text-slate-800 border border-slate-200 break-all">
                {pbUrl}/backend/v1/telemetria/limpar-antigos
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
