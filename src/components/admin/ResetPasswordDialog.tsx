import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { resetUsuarioSenha, type UsuarioAdmin } from '@/services/admin-usuarios'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  usuario: UsuarioAdmin | null
}

export function ResetPasswordDialog({ open, onOpenChange, usuario }: Props) {
  const [submitting, setSubmitting] = useState(false)

  const handleReset = async () => {
    if (!usuario) return
    setSubmitting(true)
    try {
      await resetUsuarioSenha(usuario.id)
      toast.success(`Senha redefinida para o registro: ${usuario.registro}`)
      onOpenChange(false)
    } catch {
      toast.error('Erro ao redefinir senha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Redefinir senha?</AlertDialogTitle>
          <AlertDialogDescription>
            A senha de <strong>{usuario?.nome_completo}</strong> será redefinida para o número de
            registro ({usuario?.registro}). O usuário precisará trocá-la no próximo acesso.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleReset()
            }}
            disabled={submitting}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Redefinir Senha
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
