import { useState, useEffect, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createInformativo,
  updateInformativo,
  type Informativo,
} from '@/services/admin-informativos'
import { getDistinctDepartamentos } from '@/services/admin-usuarios'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: Informativo | null
  onSaved: () => void
}

export function InformativoFormDialog({ open, onOpenChange, editingItem, onSaved }: Props) {
  const [formData, setFormData] = useState({
    titulo: '',
    conteudo: '',
    departamento: 'none',
    status_ativo: true,
  })
  const [departments, setDepartments] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    getDistinctDepartamentos()
      .then(setDepartments)
      .catch(() => {})
    if (editingItem) {
      setFormData({
        titulo: editingItem.titulo,
        conteudo: editingItem.conteudo,
        departamento: editingItem.departamento || 'none',
        status_ativo: editingItem.status_ativo,
      })
    } else {
      setFormData({ titulo: '', conteudo: '', departamento: 'none', status_ativo: true })
    }
    setFieldErrors({})
  }, [open, editingItem])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setSubmitting(true)
    try {
      const data = {
        titulo: formData.titulo,
        conteudo: formData.conteudo,
        departamento: formData.departamento === 'none' ? '' : formData.departamento,
        status_ativo: formData.status_ativo,
      }
      if (editingItem) {
        await updateInformativo(editingItem.id, data)
        toast.success('Informativo atualizado com sucesso!')
      } else {
        await createInformativo(data)
        toast.success('Informativo criado com sucesso!')
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast.error('Erro ao salvar informativo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Editar Informativo' : 'Criar Informativo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inf-titulo">Título *</Label>
            <Input
              id="inf-titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Digite o título"
            />
            {fieldErrors.titulo && <p className="text-sm text-red-500">{fieldErrors.titulo}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="inf-conteudo">Conteúdo *</Label>
            <Textarea
              id="inf-conteudo"
              rows={5}
              value={formData.conteudo}
              onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
              placeholder="Digite o conteúdo"
            />
            {fieldErrors.conteudo && <p className="text-sm text-red-500">{fieldErrors.conteudo}</p>}
          </div>
          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select
              value={formData.departamento}
              onValueChange={(v) => setFormData({ ...formData, departamento: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os departamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Todos os departamentos</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={formData.status_ativo}
              onCheckedChange={(v) => setFormData({ ...formData, status_ativo: v })}
            />
            <Label>Ativo</Label>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
