import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, AlertCircle, ClipboardList } from 'lucide-react'
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
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { listSolicitacoes, createSolicitacao, type Solicitacao } from '@/services/solicitacoes'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { DEPARTAMENTOS } from '@/lib/constants'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Pendente: 'bg-amber-100 text-amber-700 border-amber-200',
    'Em Andamento': 'bg-blue-100 text-blue-700 border-blue-200',
    Concluído: 'bg-green-100 text-green-700 border-green-200',
    Cancelado: 'bg-gray-100 text-gray-700 border-gray-200',
  }
  return (
    <Badge variant="outline" className={colors[status] || colors.Cancelado}>
      {status}
    </Badge>
  )
}

export default function Solicitacoes() {
  const { user } = useAuth()
  const [items, setItems] = useState<Solicitacao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({ titulo: '', descricao: '', departamento: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      setError(false)
      const data = await listSolicitacoes(user.id)
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
  useRealtime('solicitacoes', () => {
    loadData()
  })

  const handleSubmit = async () => {
    if (!user?.id) return
    setFieldErrors({})
    const errors: FieldErrors = {}
    if (!formData.titulo.trim()) errors.titulo = 'Título é obrigatório'
    if (!formData.departamento) errors.departamento = 'Departamento é obrigatório'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setSubmitting(true)
    try {
      await createSolicitacao({
        id_usuario: user.id,
        titulo: formData.titulo,
        descricao: formData.descricao,
        departamento: formData.departamento,
      })
      setDialogOpen(false)
      setFormData({ titulo: '', descricao: '', departamento: '' })
      toast.success('Solicitação criada com sucesso!')
      loadData()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast.error('Erro ao criar solicitação.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ClipboardList className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Solicitações</h1>
            <p className="text-slate-500 mt-0.5 text-sm">
              Gerencie suas solicitações administrativas.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Solicitação
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-5 h-5" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>Erro ao carregar solicitações. Tente novamente.</AlertDescription>
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
                      <TableHead className="font-bold text-primary">Título</TableHead>
                      <TableHead className="font-bold text-primary">Departamento</TableHead>
                      <TableHead className="font-bold text-primary">Status</TableHead>
                      <TableHead className="font-bold text-primary">Data</TableHead>
                      <TableHead className="font-bold text-primary">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                          Nenhuma solicitação encontrada.
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item) => (
                        <TableRow key={item.id} className="border-slate-100 hover:bg-primary/5">
                          <TableCell className="font-medium text-slate-900">
                            {item.titulo}
                          </TableCell>
                          <TableCell className="text-slate-600">{item.departamento}</TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                          <TableCell className="text-slate-600 whitespace-nowrap">
                            {format(parseISO(item.created), 'dd/MM/yyyy', { locale: ptBR })}
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
            <DialogTitle>Nova Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título *</Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Digite o título da solicitação"
              />
              {fieldErrors.titulo && <p className="text-sm text-red-500">{fieldErrors.titulo}</p>}
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
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descreva sua solicitação"
                rows={4}
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
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Criar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
