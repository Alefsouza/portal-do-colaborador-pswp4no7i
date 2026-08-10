import { useState, useEffect } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listAdminsForTransfer, type UsuarioAdmin } from '@/services/admin-usuarios'
import { transferSolicitacao } from '@/services/admin-solicitacoes'

interface TransferirDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  solicitacaoId: string
  departamento: string
  perfil: string
  currentAdminId: string
  onTransferred: () => void
}

export function TransferirDialog({
  open,
  onOpenChange,
  solicitacaoId,
  departamento,
  perfil,
  currentAdminId,
  onTransferred,
}: TransferirDialogProps) {
  const [admins, setAdmins] = useState<UsuarioAdmin[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSelectedId('')
    listAdminsForTransfer(departamento, perfil, currentAdminId)
      .then(setAdmins)
      .catch(() => toast.error('Erro ao carregar administradores.'))
      .finally(() => setLoading(false))
  }, [open, departamento, perfil, currentAdminId])

  const handleTransfer = async () => {
    if (!selectedId) return
    try {
      await transferSolicitacao(solicitacaoId, selectedId)
      toast.success('Solicitação transferida com sucesso!')
      onOpenChange(false)
      onTransferred()
    } catch {
      toast.error('Erro ao transferir solicitação.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir Solicitação</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            Nenhum administrador disponível para transferência.
          </p>
        ) : (
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um administrador" />
            </SelectTrigger>
            <SelectContent>
              {admins.map((admin) => (
                <SelectItem key={admin.id} value={admin.id}>
                  {admin.nome_completo} ({admin.perfil})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleTransfer} disabled={!selectedId || loading}>
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
