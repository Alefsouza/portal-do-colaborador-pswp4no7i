import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MessageSquare,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRealtime } from '@/hooks/use-realtime'
import { listSolicitacoes, type Solicitacao } from '@/services/solicitacoes'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Solicitada: 'bg-gray-100 text-gray-700 border-gray-200',
    'Em Andamento': 'bg-amber-100 text-amber-700 border-amber-200',
    Finalizada: 'bg-green-100 text-green-700 border-green-200',
  }
  return (
    <Badge variant="outline" className={colors[status] || colors.Solicitada}>
      {status}
    </Badge>
  )
}

export function SolicitacoesList({ userId }: { userId: string }) {
  const navigate = useNavigate()
  const [items, setItems] = useState<Solicitacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const loadData = useCallback(
    async (targetPage: number) => {
      if (!userId) return
      setLoading(true)
      try {
        setError(false)
        const result = await listSolicitacoes(userId, targetPage, 10)
        setItems(result.items)
        setTotalPages(result.totalPages)
        setTotalItems(result.totalItems)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    },
    [userId],
  )

  useEffect(() => {
    loadData(page)
  }, [loadData, page])

  useRealtime('solicitacoes', () => {
    loadData(page)
  })

  if (loading && items.length === 0) {
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
        <AlertDescription>Erro ao carregar solicitações. Tente novamente.</AlertDescription>
      </Alert>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <ClipboardList className="w-8 h-8 text-primary" />
        </div>
        <p className="text-slate-500">Nenhuma solicitação encontrada.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="font-bold text-primary">Título</TableHead>
                <TableHead className="font-bold text-primary">Departamento</TableHead>
                <TableHead className="font-bold text-primary">Status</TableHead>
                <TableHead className="font-bold text-primary">Data de Criação</TableHead>
                <TableHead className="font-bold text-primary w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-slate-100 hover:bg-primary/5 cursor-pointer"
                  onClick={() => navigate(`/solicitacoes/${item.id}`)}
                >
                  <TableCell className="font-medium text-slate-900">{item.titulo}</TableCell>
                  <TableCell className="text-slate-600">{item.departamento}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-slate-600 whitespace-nowrap">
                    {format(parseISO(item.created), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    <MessageSquare className="w-4 h-4" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <Card
            key={item.id}
            className="border-slate-200 cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => navigate(`/solicitacoes/${item.id}`)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-slate-900">{item.titulo}</h3>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-sm text-slate-500">{item.departamento}</p>
              <p className="text-xs text-slate-400">
                {format(parseISO(item.created), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
              <div className="flex items-center gap-1 text-primary text-xs font-medium">
                <MessageSquare className="w-3.5 h-3.5" />
                Abrir conversa
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-slate-500">
            Página {page} de {totalPages} ({totalItems}{' '}
            {totalItems === 1 ? 'registro' : 'registros'})
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
