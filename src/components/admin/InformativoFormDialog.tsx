import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react'
import { Loader2, FileText, X, Upload } from 'lucide-react'
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

const ACCEPT_TYPES =
  '.pdf,.jpeg,.jpg,.png,.gif,.webp,application/pdf,image/jpeg,image/png,image/gif,image/webp'

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [removeExistingFile, setRemoveExistingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setSelectedFile(null)
    setRemoveExistingFile(false)
    setFieldErrors({})
  }, [open, editingItem])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setRemoveExistingFile(false)
    }
  }

  const clearSelectedFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeExistingAnexo = () => {
    setRemoveExistingFile(true)
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
        anexo: selectedFile,
        removeAnexo: removeExistingFile && !selectedFile,
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

  const showExistingFile = editingItem?.anexo && !removeExistingFile && !selectedFile

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
            <Label htmlFor="inf-conteudo">Conteúdo</Label>
            <Textarea
              id="inf-conteudo"
              rows={5}
              value={formData.conteudo}
              onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
              placeholder="Digite o conteúdo (opcional se houver anexo)"
            />
            {fieldErrors.conteudo && <p className="text-sm text-red-500">{fieldErrors.conteudo}</p>}
          </div>
          <div className="space-y-2">
            <Label>Anexo</Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ACCEPT_TYPES}
              onChange={handleFileChange}
            />
            {selectedFile || showExistingFile ? (
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-700 truncate">
                    {selectedFile ? selectedFile.name : editingItem?.anexo}
                  </span>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={selectedFile ? clearSelectedFile : removeExistingAnexo}
                  className="shrink-0 h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full gap-2 border-dashed"
              >
                <Upload className="w-4 h-4" />
                Selecionar arquivo
              </Button>
            )}
            <p className="text-xs text-slate-400">PDF, JPEG, PNG, GIF ou WebP. Máximo 10 MB.</p>
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
