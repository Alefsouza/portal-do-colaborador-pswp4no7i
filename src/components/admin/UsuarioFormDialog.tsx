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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createUsuario, updateUsuarioAdmin, type UsuarioAdmin } from '@/services/admin-usuarios'
import { DEPARTAMENTOS, PERFIIS } from '@/lib/constants'
import { maskCpf } from '@/lib/utils'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingItem: UsuarioAdmin | null
  onSaved: () => void
}

export function UsuarioFormDialog({ open, onOpenChange, editingItem, onSaved }: Props) {
  const [formData, setFormData] = useState({
    cpf: '',
    nome_completo: '',
    registro: '',
    senha: '',
    perfil: '',
    departamento: '',
    primeiro_acesso: true,
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setFieldErrors({})
    if (editingItem) {
      setFormData({
        cpf: editingItem.cpf,
        nome_completo: editingItem.nome_completo,
        registro: editingItem.registro,
        senha: '',
        perfil: editingItem.perfil,
        departamento: editingItem.departamento,
        primeiro_acesso: editingItem.primeiro_acesso,
      })
    } else {
      setFormData({
        cpf: '',
        nome_completo: '',
        registro: '',
        senha: '',
        perfil: '',
        departamento: '',
        primeiro_acesso: true,
      })
    }
  }, [open, editingItem])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setSubmitting(true)
    try {
      if (editingItem) {
        await updateUsuarioAdmin(editingItem.id, {
          nome_completo: formData.nome_completo,
          perfil: formData.perfil,
          departamento: formData.departamento,
          primeiro_acesso: formData.primeiro_acesso,
        })
        toast.success('Usuário atualizado com sucesso!')
      } else {
        await createUsuario(formData)
        toast.success('Usuário criado com sucesso!')
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setFieldErrors(extractFieldErrors(err))
      toast.error('Erro ao salvar usuário.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Editar Usuário' : 'Criar Usuário'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="usr-cpf">CPF *</Label>
            <Input
              id="usr-cpf"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: maskCpf(e.target.value) })}
              placeholder="000.000.000-00"
              disabled={!!editingItem}
              readOnly={!!editingItem}
            />
            {fieldErrors.cpf && <p className="text-sm text-red-500">{fieldErrors.cpf}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="usr-nome">Nome Completo *</Label>
            <Input
              id="usr-nome"
              value={formData.nome_completo}
              onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
              placeholder="Digite o nome completo"
            />
            {fieldErrors.nome_completo && (
              <p className="text-sm text-red-500">{fieldErrors.nome_completo}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="usr-registro">Registro *</Label>
            <Input
              id="usr-registro"
              value={formData.registro}
              onChange={(e) => setFormData({ ...formData, registro: e.target.value })}
              placeholder="Digite o registro"
              disabled={!!editingItem}
              readOnly={!!editingItem}
            />
            {fieldErrors.registro && <p className="text-sm text-red-500">{fieldErrors.registro}</p>}
          </div>
          {!editingItem && (
            <div className="space-y-2">
              <Label htmlFor="usr-senha">Senha *</Label>
              <Input
                id="usr-senha"
                type="password"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                placeholder="Mínimo 8 caracteres"
              />
              {fieldErrors.senha && <p className="text-sm text-red-500">{fieldErrors.senha}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Perfil *</Label>
              <Select
                value={formData.perfil}
                onValueChange={(v) => setFormData({ ...formData, perfil: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PERFIIS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.perfil && <p className="text-sm text-red-500">{fieldErrors.perfil}</p>}
            </div>
            <div className="space-y-2">
              <Label>Departamento *</Label>
              <Select
                value={formData.departamento}
                onValueChange={(v) => setFormData({ ...formData, departamento: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={formData.primeiro_acesso}
              onCheckedChange={(v) => setFormData({ ...formData, primeiro_acesso: v })}
            />
            <Label>Primeiro Acesso</Label>
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
