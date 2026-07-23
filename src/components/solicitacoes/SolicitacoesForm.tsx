import { useState, type FormEvent } from 'react'
import { Loader2, Send } from 'lucide-react'
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
import { createSolicitacao } from '@/services/solicitacoes'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { DEPARTAMENTOS_SOLICITACAO } from '@/lib/constants'

export function SolicitacoesForm({ userId }: { userId: string }) {
  const [formData, setFormData] = useState({ departamento: '', titulo: '', descricao: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    const errors: FieldErrors = {}
    if (!formData.departamento) errors.departamento = 'Departamento é obrigatório'
    if (!formData.titulo.trim()) errors.titulo = 'Título é obrigatório'
    if (!formData.descricao.trim()) errors.descricao = 'Descrição é obrigatória'
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    setSubmitting(true)
    try {
      await createSolicitacao({
        id_usuario: userId,
        titulo: formData.titulo,
        descricao: formData.descricao,
        departamento: formData.departamento,
      })
      setFormData({ departamento: '', titulo: '', descricao: '' })
      toast.success('Solicitação enviada com sucesso!')
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast.error('Erro ao enviar solicitação. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-slate-200 max-w-2xl">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="titulo">Título *</Label>
              <span className="text-xs text-slate-400">{formData.titulo.length}/200</span>
            </div>
            <Input
              id="titulo"
              maxLength={200}
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Digite o título da solicitação"
            />
            {fieldErrors.titulo && <p className="text-sm text-red-500">{fieldErrors.titulo}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="descricao">Descrição Detalhada *</Label>
              <span className="text-xs text-slate-400">{formData.descricao.length}/2000</span>
            </div>
            <Textarea
              id="descricao"
              maxLength={2000}
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva sua solicitação em detalhes"
              rows={5}
            />
            {fieldErrors.descricao && (
              <p className="text-sm text-red-500">{fieldErrors.descricao}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="bg-primary hover:bg-primary/90 text-white gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Enviar Solicitação
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
