import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react'
import { Loader2, FileText, X, Upload } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
import { DatePicker } from '@/components/date-picker'
import {
  createInformativo,
  updateInformativo,
  type Informativo,
} from '@/services/admin-informativos'
import { getDistinctDepartamentos } from '@/services/admin-usuarios'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: Informativo | null
  onSaved: () => void
}

const ACCEPT_TYPES =
  '.pdf,.jpeg,.jpg,.png,.gif,.webp,application/pdf,image/jpeg,image/png,image/gif,image/webp'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export function InformativoFormDialog({ open, onOpenChange, editingItem, onSaved }: Props) {
  const [formData, setFormData] = useState({
    titulo: '',
    conteudo: '',
    departamento: 'none',
    status_ativo: true,
  })
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined)
  const [dataFinal, setDataFinal] = useState<Date | undefined>(undefined)
  const [departments, setDepartments] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [removeExistingFile, setRemoveExistingFile] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
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
      setDataInicio(editingItem.data_inicio ? parseISO(editingItem.data_inicio) : undefined)
      setDataFinal(editingItem.data_final ? parseISO(editingItem.data_final) : undefined)
    } else {
      setFormData({ titulo: '', conteudo: '', departamento: 'none', status_ativo: true })
      setDataInicio(undefined)
      setDataFinal(undefined)
    }
    setSelectedFile(null)
    setRemoveExistingFile(false)
    setFieldErrors({})
    setFileError(null)
  }, [open, editingItem])

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'O arquivo excede o tamanho máximo de 10 MB.'
    }
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const allowedExtensions = /\.(pdf|jpe?g|png|gif|webp)$/i
    if (!allowedTypes.includes(file.type) && !allowedExtensions.test(file.name)) {
      return 'Tipo de arquivo não permitido. Use PDF, JPEG, PNG, GIF ou WebP.'
    }
    return null
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const error = validateFile(file)
      if (error) {
        setFileError(error)
        setSelectedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
      setFileError(null)
      setSelectedFile(file)
      setRemoveExistingFile(false)
    }
  }

  const clearSelectedFile = () => {
    setSelectedFile(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeExistingAnexo = () => {
    setRemoveExistingFile(true)
    setSelectedFile(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setFileError(null)

    if (!formData.titulo.trim()) {
      setFieldErrors({ titulo: 'O título é obrigatório.' })
      return
    }

    setSubmitting(true)
    try {
      const data = {
        titulo: formData.titulo,
        conteudo: formData.conteudo,
        departamento: formData.departamento === 'none' ? '' : formData.departamento,
        status_ativo: formData.status_ativo,
        anexo: selectedFile,
        removeAnexo: removeExistingFile && !selectedFile,
        data_inicio: dataInicio ? format(dataInicio, 'yyyy-MM-dd') : '',
        data_final: dataFinal ? format(dataFinal, 'yyyy-MM-dd') : '',
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
      const errors = extractFieldErrors(err)
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors)
      }
      if (errors.anexo) {
        setFileError(errors.anexo)
      }
      const errorMsg = getErrorMessage(err)
      toast.error(errorMsg || 'Erro ao salvar informativo.')
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de Início</Label>
              <DatePicker value={dataInicio} onChange={setDataInicio} placeholder="Opcional" />
              {fieldErrors.data_inicio && (
                <p className="text-sm text-red-500">{fieldErrors.data_inicio}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <DatePicker value={dataFinal} onChange={setDataFinal} placeholder="Opcional" />
              {fieldErrors.data_final && (
                <p className="text-sm text-red-500">{fieldErrors.data_final}</p>
              )}
            </div>
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
            {fileError && <p className="text-sm text-red-500">{fileError}</p>}
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
            {fieldErrors.departamento && (
              <p className="text-sm text-red-500">{fieldErrors.departamento}</p>
            )}
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
