import { useState, type FormEvent } from 'react'
import { Loader2, CalendarPlus, Info } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/date-picker'
import { createAgendamento } from '@/services/agendamentos'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { DEPARTAMENTOS_SOLICITACAO } from '@/lib/constants'

export function AgendamentosForm({ userId }: { userId: string }) {
  const [formData, setFormData] = useState({
    data: undefined as Date | undefined,
    hora: '',
    departamento: '',
    observacao: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
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
      const { format } = await import('date-fns')
      await createAgendamento({
        id_usuario: userId,
        data: format(formData.data!, 'yyyy-MM-dd'),
        hora: formData.hora,
        departamento: formData.departamento,
        observacao: formData.observacao,
      })
      setFormData({ data: undefined, hora: '', departamento: '', observacao: '' })
      toast.success('Agendamento solicitado com sucesso!')
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast.error('Erro ao solicitar agendamento. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-start gap-3 rounded-lg bg-primary/5 border border-primary/10 p-4">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600">
          O agendamento só será confirmado após análise do departamento responsável.
        </p>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                  {DEPARTAMENTOS_SOLICITACAO.map((d) => (
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                placeholder="Adicione uma observação (opcional)"
                rows={4}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CalendarPlus className="w-4 h-4" />
              )}
              Solicitar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
