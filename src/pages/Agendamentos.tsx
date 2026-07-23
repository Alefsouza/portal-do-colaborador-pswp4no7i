import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, AlertCircle, CalendarClock } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/date-picker'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { listAgendamentos, createAgendamento, type Agendamento } from '@/services/agendamentos'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { DEPARTAMENTOS } from '@/lib/constants'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Agendado: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Confirmado: 'bg-green-100 text-green-700 border-green-200',
    Cancelado: 'bg-red-100 text-red-700 border-red-200',
    Realizado: 'bg-blue-100 text-blue-700 border-blue-200',
  }
  return (
    <Badge variant="outline" className={colors[status] || colors.Agendado}>
      {status}
    </Badge>
  )
}

export default function Agendamentos() {
  const { user } = useAuth()
  const [items, setItems] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    data: undefined as Date | undefined,
    hora: '',
    departamento: '',
    observacao: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      setError(false)
      const data = await listAgendamentos(user.id)
      setItems(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('agendamentos', () => {
    loadData()
  })

  const handleSubmit = async () => {
    if (!user?.id) return
    setFieldErrors({})
    const errors: FieldErrors = {}
    if (!formData.data) errors.data = 'Data é obrigatória'
    if (!formData.hora) errors.hora = 'Hora é obrigatória'
    if (!formData.departamento) errors.departamento = 'Departamento é obrigatório'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setSubmitting(true)
    try {
      await createAgendamento({
        id_usuario: user.id,
        data: format(formData.data!, 'yyyy-MM-dd'),
        hora: formData.hora,
        departamento: formData.departamento,
        observacao: formData.observacao,
      })
      setDialogOpen(false)
      setFormData({ data: undefined, hora: '', departamento: '', observacao: '' })
      toast.success('Agendamento criado com sucesso!')
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast.error('Erro ao criar agendamento.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <CalendarClock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Agendamentos</h1>
            <p className="text-slate-500 mt-0.5 text-sm">Gerencie seus agendamentos e serviços.</p>
          </div>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-5 h-5" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>Erro ao carregar agendamentos. Tente novamente.</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        !error && (
          <Card className="border-slate-200">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                      <TableHead className="font-bold text-primary">Data</TableHead>
                      <TableHead className="font-bold text-primary">Hora</TableHead>
                      <TableHead className="font-bold text-primary">Departamento</TableHead>
                      <TableHead className="font-bold text-primary">Observação</TableHead>
                      <TableHead className="font-bold text-primary">Status</TableHead>
                      <TableHead className="font-bold text-primary">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                          Nenhum agendamento encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.id} className="border-slate-100 hover:bg-primary/5">
                          <TableCell className="font-medium text-slate-900 whitespace-nowrap">
                            {format(parseISO(item.data), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-slate-600">{item.hora}</TableCell>
                          <TableCell className="text-slate-600">{item.departamento}</TableCell>
                          <TableCell className="text-slate-600 max-w-xs truncate">
                            {item.observacao || '-'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toast.info('Detalhes em breve')}
                            >
                              Ver
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Data *</Label>
              <DatePicker
                value={formData.data}
                onChange={(d) => setFormData({ ...formData, data: d })}
                placeholder="DD/MM/AAAA"
              />
              {fieldErrors.data && <p className="text-sm text-red-500">{fieldErrors.data}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora">Hora *</Label>
              <Input
                id="hora"
                type="time"
                value={formData.hora}
                onChange={(e) => setFormData({ ...formData, hora: e.target.value })}
                className="h-11"
              />
              {fieldErrors.hora && <p className="text-sm text-red-500">{fieldErrors.hora}</p>}
            </div>
            <div className="space-y-2">
              <Label>Departamento *</Label>
              <Select
                value={formData.departamento}
                onValueChange={(v) => setFormData({ ...formData, departamento: v })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione o departamento" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTAMENTOS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.departamento && (
                <p className="text-sm text-red-500">{fieldErrors.departamento}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                placeholder="Adicione uma observação (opcional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Criar Agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
