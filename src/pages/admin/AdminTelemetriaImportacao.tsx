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
} from 'lucide-react'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  importCsvData,
  clearOldTelemetryData,
  type CsvImportResult,
} from '@/services/admin-telemetria-import'

export default function AdminTelemetriaImportacao() {
  const { user } = useAdminAuth()
  const navigate = useNavigate()
  const canAccess = user?.perfil === 'TI' || user?.perfil === 'Admin'

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<CsvImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const [clearing, setClearing] = useState(false)
  const [clearResult, setClearResult] = useState<{
    eventos_removidos: number
    data_corte: string
  } | null>(null)
  const [clearError, setClearError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user && !canAccess) {
      navigate('/admin/dashboard', { replace: true })
    }
  }, [user, canAccess, navigate])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setImportResult(null)
      setImportError(null)
    }
  }, [])

  const handleImport = async () => {
    if (!selectedFile) return
    setImporting(true)
    setImportResult(null)
    setImportError(null)
    try {
      const csvContent = await selectedFile.text()
      const result = await importCsvData(csvContent)
      setImportResult(result)
      toast.success('Importação concluída com sucesso!')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar o CSV.'
      setImportError(msg)
      toast.error(msg)
    } finally {
      setImporting(false)
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
          Importação de Telemetria - Kontrow CSV
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Importe arquivos CSV do Kontrow para processar eventos de telemetria.
        </p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Importar arquivo CSV</h2>
              <p className="text-sm text-slate-500">
                Selecione um arquivo CSV exportado do Kontrow e processe os dados.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
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
                {selectedFile ? selectedFile.name : 'Selecionar arquivo CSV'}
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
                Arquivo selecionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)}{' '}
                KB)
              </p>
            )}
          </div>

          {importResult && !importing && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold text-green-800">Importação concluída!</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-green-700">
                        Total de linhas: <strong>{importResult.total_linhas}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-green-700">
                        Eventos de direção: <strong>{importResult.eventos_direcao}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      <span className="text-green-700">
                        Eventos técnicos: <strong>{importResult.eventos_tecnicos}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-600" />
                      <span className="text-green-700">
                        Motoristas encontrados:{' '}
                        <strong>{importResult.motoristas_encontrados}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-green-700">
                        Motoristas não encontrados:{' '}
                        <strong>{importResult.motoristas_nao_encontrados}</strong>
                      </span>
                    </div>
                  </div>
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
              <p className="font-semibold text-slate-700 mb-1">Endpoint URL:</p>
              <code className="block bg-slate-50 rounded-lg px-3 py-2 text-slate-800 border border-slate-200 break-all">
                {pbUrl}/backend/v1/telemetria/csv-import
              </code>
            </div>
            <div className="flex items-start gap-2 text-slate-600">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p>
                Este endpoint recebe o conteúdo do CSV como texto no campo{' '}
                <code className="bg-slate-100 px-1 rounded">csv</code> do body JSON. Pode ser
                chamado via agendador externo (GitHub Actions, EasyCron, etc.) para automatizar a
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
