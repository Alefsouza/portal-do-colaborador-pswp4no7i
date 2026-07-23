import { useState } from 'react'
import { Loader2, Receipt, FileText, AlertCircle, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { getDocumento, TIPOS_DOCUMENTO, MESES, type DocumentoData } from '@/services/recibos'

export default function Recibos() {
  const { user } = useAuth()
  const [tipo, setTipo] = useState('')
  const [mes, setMes] = useState('')
  const [ano, setAno] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [documento, setDocumento] = useState<DocumentoData | null>(null)

  const isValid = !!tipo && !!mes && !!ano
  const anoAtual = new Date().getFullYear()
  const anos = [anoAtual, anoAtual - 1, anoAtual - 2]

  const handleGerar = async () => {
    if (!isValid) return
    setLoading(true)
    setError(false)
    setDocumento(null)
    try {
      const data = await getDocumento(tipo, Number(mes), Number(ano), user?.id || '1')
      setDocumento(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-green-600/10 flex items-center justify-center">
          <Receipt className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Recibos</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Gere e visualize seus documentos.</p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Tipo de Documento *</label>
              <Select
                value={tipo}
                onValueChange={(v) => {
                  setTipo(v)
                  setMes('')
                  setAno('')
                  setDocumento(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_DOCUMENTO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tipo && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Mês *</label>
                  <Select
                    value={mes}
                    onValueChange={(v) => {
                      setMes(v)
                      setDocumento(null)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Ano *</label>
                  <Select
                    value={ano}
                    onValueChange={(v) => {
                      setAno(v)
                      setDocumento(null)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {anos.map((a) => (
                        <SelectItem key={a} value={String(a)}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <Button
            onClick={handleGerar}
            disabled={!isValid || loading}
            className="mt-5 bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Gerar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-5 h-5" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>Erro ao gerar documento. Tente novamente mais tarde.</AlertDescription>
        </Alert>
      )}

      {loading && (
        <Card className="border-slate-200">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      )}

      {documento && !loading && !error && (
        <Card className="border-slate-200 shadow-lg overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8" />
                  <div>
                    <p className="text-lg font-bold">Via Sudeste Transportes</p>
                    <p className="text-green-100 text-sm">{documento.tipo}</p>
                  </div>
                </div>
                <FileText className="w-10 h-10 text-green-200" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-green-200 text-xs">Colaborador</p>
                  <p className="font-semibold">{documento.colaborador.nome}</p>
                </div>
                <div>
                  <p className="text-green-200 text-xs">CPF</p>
                  <p className="font-semibold">{documento.colaborador.cpf}</p>
                </div>
                <div>
                  <p className="text-green-200 text-xs">Departamento</p>
                  <p className="font-semibold">{documento.colaborador.departamento}</p>
                </div>
                <div>
                  <p className="text-green-200 text-xs">Período</p>
                  <p className="font-semibold">
                    {MESES[documento.mes - 1]} / {documento.ano}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {documento.secoes.map((secao, i) => (
                <div key={i}>
                  <h3 className="text-sm font-bold text-green-700 border-b border-green-100 pb-1.5 mb-3">
                    {secao.titulo}
                  </h3>
                  <div className="space-y-2">
                    {secao.itens.map((item, j) => (
                      <div key={j} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600">{item.label}</span>
                        <span className="font-medium text-slate-900">{item.valor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {documento.totalLabel && documento.totalValor && (
                <div className="flex justify-between items-center pt-3 border-t-2 border-green-600">
                  <span className="font-bold text-green-700">{documento.totalLabel}</span>
                  <span className="font-bold text-lg text-green-700">{documento.totalValor}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                Documento gerado em {documento.dataEmissao} • Via Sudeste Portal do Colaborador
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
