import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, CalendarClock, Info } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
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
import { listAgendamentos, type Agendamento } from '@/services/agendamentos'

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

export function AgendamentosList({ userId }: { userId: string }) {
  const [items, setItems] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      setError(false)
      const data = await listAgendamentos(userId)
      setItems(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadData()
  }, [loadData])

  useRealtime('agendamentos', () => {
    loadData()
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
        <AlertDescription>Erro ao carregar agendamentos. Tente novamente.</AlertDescription>
      </Alert>
    )
  }

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <CalendarClock className="w-8 h-8 text-primary" />
          </div>
          <p className="text-slate-500">Nenhum agendamento encontrado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5 hover:bg-primary/5">
                  <TableHead className="font-bold text-primary">Departamento</TableHead>
                  <TableHead className="font-bold text-primary">Data</TableHead>
                  <TableHead className="font-bold text-primary">Hora</TableHead>
                  <TableHead className="font-bold text-primary">Observação</TableHead>
                  <TableHead className="font-bold text-primary">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="border-slate-100 hover:bg-primary/5">
                    <TableCell className="font-medium text-slate-900">
                      {item.departamento}
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {format(parseISO(item.data), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-slate-600">{item.hora}</TableCell>
                    <TableCell className="text-slate-600 max-w-xs truncate">
                      {item.observacao || '-'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="border-slate-200">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-slate-900">{item.departamento}</h3>
                <StatusBadge status={item.status} />
              </div>
              <p className="text-sm text-slate-500">
                {format(parseISO(item.data), 'dd/MM/yyyy', { locale: ptBR })} às {item.hora}
              </p>
              {item.observacao && (
                <p className="text-sm text-slate-400 line-clamp-2">{item.observacao}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-lg bg-primary/5 border border-primary/10 p-4">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600">
          O agendamento só será confirmado após análise do departamento responsável.
        </p>
      </div>
    </div>
  )
}
