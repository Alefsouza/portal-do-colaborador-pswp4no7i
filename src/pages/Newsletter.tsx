import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, Newspaper, FileText, Building2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useRealtime } from '@/hooks/use-realtime'
import {
  listInformativosForUser,
  getAnexoUrl,
  type Informativo,
} from '@/services/admin-informativos'
import { useAuth } from '@/hooks/use-auth'

export default function Newsletter() {
  const { user } = useAuth()
  const [items, setItems] = useState<Informativo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [failedPdfs, setFailedPdfs] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    try {
      setError(false)
      const userId = user?.id || ''
      const data = userId
        ? await listInformativosForUser(userId)
        : await listInformativosForUser('')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      setItems(
        data.filter((n) => {
          if (!n.status_ativo) return false
          if (!n.data_inicio && !n.data_final) return true
          if (n.data_inicio) {
            const inicio = parseISO(n.data_inicio)
            inicio.setHours(0, 0, 0, 0)
            if (inicio > today) return false
          }
          if (n.data_final) {
            const final = parseISO(n.data_final)
            final.setHours(0, 0, 0, 0)
            if (final < today) return false
          }
          return true
        }),
      )
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData, user?.id])

  useRealtime('informativos', () => {
    loadData()
  })

  const handlePdfError = (id: string) => {
    setFailedPdfs((prev) => new Set(prev).add(id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-5 h-5" />
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>Erro ao carregar informativos.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Newsletter</h1>
        <p className="text-slate-500 mt-1">Informativos e comunicados da empresa</p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Newspaper className="w-8 h-8 text-primary" />
          </div>
          <p className="text-slate-500">Nenhum informativo disponível no momento.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => {
            const pdfUrl = item.anexo ? getAnexoUrl(item) : ''
            const hasFailed = failedPdfs.has(item.id)

            return (
              <Card key={item.id} className="border-slate-200 overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Newspaper className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-lg text-slate-900">{item.titulo}</h3>
                        <span className="text-xs text-slate-400 shrink-0 mt-1">
                          {format(parseISO(item.created), 'dd MMM yyyy', { locale: ptBR })}
                        </span>
                      </div>
                      {item.conteudo && (
                        <p className="text-sm text-slate-500 leading-relaxed mb-2">
                          {item.conteudo}
                        </p>
                      )}
                      {item.departamento && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <Badge
                            variant="outline"
                            className="bg-slate-50 text-slate-600 border-slate-200"
                          >
                            {item.departamento}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  {pdfUrl && !hasFailed ? (
                    <div className="w-full rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                      <object
                        data={pdfUrl}
                        type="application/pdf"
                        className="w-full h-[600px]"
                        onError={() => handlePdfError(item.id)}
                      >
                        <iframe
                          src={pdfUrl}
                          className="w-full h-[600px] border-0"
                          title={item.titulo}
                          onError={() => handlePdfError(item.id)}
                        />
                      </object>
                    </div>
                  ) : hasFailed ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                      <AlertCircle className="w-8 h-8 text-amber-500 mb-2" />
                      <p className="text-sm text-slate-500">
                        Não foi possível carregar o documento. Tente novamente mais tarde.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                      <FileText className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-sm text-slate-400">
                        Nenhum documento anexado a este informativo.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
