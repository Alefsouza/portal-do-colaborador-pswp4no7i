import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, CalendarClock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
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
import { useAdminAuth } from '@/hooks/use-admin-auth'
import {
  listAdminAgendamentos,
  updateAgendamentoStatus,
  type AdminAgendamento,
} from '@/services/admin-agendamentos'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Pendente: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Confirmado: 'bg-green-100 text-green-700 border-green-200',
    Cancelado: 'bg-red-100 text-red-700 border-red-200',
    Realizado: 'bg-blue-100 text-blue-700 border-blue-200',
  }
  return (
    <Badge variant="outline" className={colors[status] || colors.Pendente}>
      {status}
    </Badge>
  )
}

export default function AdminAgendamentos() {
  const { user } = useAdminAuth()
  const [items, setItems] = useState<AdminAgendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    if (!user?.departamento) return
    setLoading(true)
    try {
      setError(false)
      setItems(await listAdminAgendamentos(user.departamento))
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.departamento])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('agendamentos', () => {
    loadData()
  })

  const handleStatusChange = async (id: string, status: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
    try {
      await updateAgendamentoStatus(id, status)
      toast.success(`Agendamento ${status === 'Confirmado' ? 'confirmado' : 'cancelado'}.`)
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
        <AlertDescription>Erro ao carregar agendamentos.</AlertDescription>
      </Alert>
    )
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <CalendarClock className="w-8 h-8 text-primary" />
        </div>
        <p className="text-slate-500">Nenhum agendamento encontrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Agendamentos</h1>
        <p className="text-slate-500 mt-1">Gerencie os agendamentos do departamento</p>
      </div>
      <Card className="border-slate-200 hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="font-bold text-primary">Colaborador</TableHead>
                <TableHead className="font-bold text-primary">Data</TableHead>
                <TableHead className="font-bold text-primary">Hora</TableHead>
                <TableHead className="font-bold text-primary">Observação</TableHead>
                <TableHead className="font-bold text-primary">Status</TableHead>
                <TableHead className="font-bold text-primary">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="border-slate-100 hover:bg-primary/5">
                  <TableCell className="font-medium text-slate-900">
                    {item.expand?.id_usuario?.nome_completo || '—'}
                  </TableCell>
                  <TableCell className="text-slate-600 whitespace-nowrap">
                    {format(parseISO(item.data), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-slate-600">{item.hora}</TableCell>
                  <TableCell className="text-slate-600 max-w-xs truncate">
                    {item.observacao || '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={item.status === 'Confirmado' || item.status === 'Cancelado'}
                        onClick={() => handleStatusChange(item.id, 'Confirmado')}
                        className="text-green-700 border-green-200 hover:bg-green-50"
                      >
                        Confirmar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={item.status === 'Cancelado'}
                        onClick={() => handleStatusChange(item.id, 'Cancelado')}
                        className="text-red-700 border-red-200 hover:bg-red-50"
                      >
                        Cancelar
                      </Button>
                    </div>
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
                <h3 className="font-medium text-slate-900">
                  {item.expand?.id_usuario?.nome_completo || '—'}
                </h3>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-sm text-slate-500">
                {format(parseISO(item.data), 'dd/MM/yyyy', { locale: ptBR })} às {item.hora}
              </p>
              {item.observacao && (
                <p className="text-sm text-slate-400 line-clamp-2">{item.observacao}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={item.status === 'Confirmado' || item.status === 'Cancelado'}
                  onClick={() => handleStatusChange(item.id, 'Confirmado')}
                  className="text-green-700 border-green-200 hover:bg-green-50"
                >
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={item.status === 'Cancelado'}
                  onClick={() => handleStatusChange(item.id, 'Cancelado')}
                  className="text-red-700 border-red-200 hover:bg-red-50"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
