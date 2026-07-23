import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, ClipboardList } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRealtime } from '@/hooks/use-realtime'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import {
  listAdminSolicitacoes,
  listAllAdminSolicitacoes,
  updateSolicitacaoStatus,
  type AdminSolicitacao,
} from '@/services/admin-solicitacoes'

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

export default function AdminSolicitacoes() {
  const { user } = useAdminAuth()
  const [items, setItems] = useState<AdminSolicitacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    if (!user) return
    if (user.perfil !== 'TI' && !user.departamento) return
    setLoading(true)
    try {
      setError(false)
      const items =
        user.perfil === 'TI'
          ? await listAllAdminSolicitacoes()
          : await listAdminSolicitacoes(user.departamento)
      setItems(items)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.departamento, user?.perfil])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('solicitacoes', () => {
    loadData()
  })

  const handleStatusChange = async (id: string, status: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
    try {
      await updateSolicitacaoStatus(id, status)
      toast.success('Status atualizado com sucesso!')
    } catch {
      toast.error('Erro ao atualizar status.')
      loadData()
    }
  }

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
        <AlertDescription>Erro ao carregar solicitações.</AlertDescription>
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
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Solicitações</h1>
        <p className="text-slate-500 mt-1">
          {user?.perfil === 'TI'
            ? 'Gerencie as solicitações de todos os departamentos'
            : 'Gerencie as solicitações do departamento'}
        </p>
      </div>
      <Card className="border-slate-200 hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="font-bold text-primary">Colaborador</TableHead>
                <TableHead className="font-bold text-primary">Título</TableHead>
                <TableHead className="font-bold text-primary">Descrição</TableHead>
                <TableHead className="font-bold text-primary">Status</TableHead>
                <TableHead className="font-bold text-primary">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="border-slate-100 hover:bg-primary/5">
                  <TableCell className="font-medium text-slate-900">
                    {item.expand?.id_usuario?.nome_completo || '—'}
                  </TableCell>
                  <TableCell className="text-slate-700">{item.titulo}</TableCell>
                  <TableCell className="text-slate-500 max-w-xs truncate">
                    {item.descricao || '—'}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={item.status}
                      onValueChange={(v) => handleStatusChange(item.id, v)}
                    >
                      <SelectTrigger className="w-36 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Solicitada">Solicitada</SelectItem>
                        <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                        <SelectItem value="Finalizada">Finalizada</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-slate-600 whitespace-nowrap">
                    {format(parseISO(item.created), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="border-slate-200">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-slate-900">{item.titulo}</h3>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-sm text-slate-500">
                {item.expand?.id_usuario?.nome_completo || '—'}
              </p>
              <p className="text-sm text-slate-400">
                {format(parseISO(item.created), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
              <Select value={item.status} onValueChange={(v) => handleStatusChange(item.id, v)}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Solicitada">Solicitada</SelectItem>
                  <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                  <SelectItem value="Finalizada">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
