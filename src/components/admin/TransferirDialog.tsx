import { useState } from 'react'
import { Loader2, Shuffle } from 'lucide-react'
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
import { DEPARTAMENTOS_SOLICITACAO } from '@/lib/constants'
import { transferToDepartment } from '@/services/admin-solicitacoes'

interface TransferirDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  solicitacaoId: string
  currentDepartamento: string
  onTransferred: (newDepartamento: string) => void
}

export function TransferirDialog({
  open,
  onOpenChange,
  solicitacaoId,
  currentDepartamento,
  onTransferred,
}: TransferirDialogProps) {
  const [selectedDept, setSelectedDept] = useState('')
  const [loading, setLoading] = useState(false)

  const handleTransfer = async () => {
    if (!selectedDept) return
    setLoading(true)
    try {
      await transferToDepartment(solicitacaoId, selectedDept)
      toast.success('Solicitação transferida com sucesso!')
      onOpenChange(false)
      onTransferred(selectedDept)
    } catch {
      toast.error('Erro ao transferir solicitação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shuffle className="w-5 h-5 text-primary" />
            Transferir Solicitação
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">
          Selecione o departamento de destino. O proprietário atual será removido.
        </p>
        <Select value={selectedDept} onValueChange={setSelectedDept}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um departamento" />
          </SelectTrigger>
          <SelectContent>
            {DEPARTAMENTOS_SOLICITACAO.map((dept) => (
              <SelectItem key={dept} value={dept} disabled={dept === currentDepartamento}>
                {dept}
                {dept === currentDepartamento && ' (atual)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleTransfer} disabled={!selectedDept || loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
