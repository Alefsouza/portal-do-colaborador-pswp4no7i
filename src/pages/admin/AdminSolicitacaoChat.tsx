import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, CheckCircle2, UserCheck, Forward } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useRealtime } from '@/hooks/use-realtime'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import {
  getAdminSolicitacao,
  updateSolicitacaoStatus,
  transferSolicitacao,
  type AdminSolicitacao,
} from '@/services/admin-solicitacoes'
import {
  listMensagens,
  createMensagem,
  type SolicitacaoMensagem,
} from '@/services/solicitacao-mensagens'
import { ChatMessages } from '@/components/chat/ChatMessages'
import { ChatInput } from '@/components/chat/ChatInput'
import { TransferirDialog } from '@/components/admin/TransferirDialog'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Solicitada: 'bg-gray-100 text-gray-700 border-gray-200',
    'Em Andamento': 'bg-amber-100 text-amber-700 border-amber-200',
    Finalizada: 'bg-green-100 text-green-700 border-green-200',
  }
  return (
    <Badge variant="outline" className={colors[status] || colors.Solicitada}>
      {status}
    </Badge>
  )
}

export default function AdminSolicitacaoChat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAdminAuth()
  const [solicitacao, setSolicitacao] = useState<AdminSolicitacao | null>(null)
  const [messages, setMessages] = useState<SolicitacaoMensagem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      setError(false)
      const [sol, msgs] = await Promise.all([getAdminSolicitacao(id), listMensagens(id)])
      setSolicitacao(sol)
      setMessages(msgs)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('solicitacao_mensagens', () => {
    loadData()
  })
  useRealtime('solicitacoes', () => {
    loadData()
  })

  const handleSend = async (mensagem: string) => {
    if (!id || !user) return
    await createMensagem({
      id_solicitacao: id,
      id_usuario: user.id,
      tipo_remetente: 'Admin',
      mensagem,
    })
  }

  const handleFinalizar = async () => {
    if (!id) return
    try {
      await updateSolicitacaoStatus(id, 'Finalizada')
      toast.success('Solicitação finalizada com sucesso!')
      loadData()
    } catch {
      toast.error('Erro ao finalizar solicitação.')
    }
  }

  const handleAssumir = async () => {
    if (!id || !user) return
    try {
      await transferSolicitacao(id, user.id)
      toast.success('Solicitação assumida com sucesso!')
      loadData()
    } catch {
      toast.error('Erro ao assumir solicitação.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }
  if (error || !solicitacao) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>Erro ao carregar solicitação.</AlertDescription>
      </Alert>
    )
  }

  const isOwner = solicitacao.id_proprietario === user?.id
  const isFinalizada = solicitacao.status === 'Finalizada'

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/solicitacoes')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex-1">
          {solicitacao.titulo}
        </h1>
        <StatusBadge status={solicitacao.status} />
        {!isOwner && !isFinalizada && (
          <Button variant="outline" size="sm" onClick={handleAssumir} className="gap-1.5">
            <UserCheck className="w-4 h-4" /> Assumir
          </Button>
        )}
        {!isFinalizada && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTransfer(true)}
              className="gap-1.5"
            >
              <Forward className="w-4 h-4" /> Transferir
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="default" size="sm" className="gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Finalizar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Finalizar solicitação?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. A solicitação será marcada como finalizada.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleFinalizar}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
      <p className="text-sm text-slate-500">
        Colaborador: {solicitacao.expand?.id_usuario?.nome_completo || '—'}
        {solicitacao.expand?.id_proprietario &&
          ` • Proprietário: ${solicitacao.expand.id_proprietario.nome_completo}`}
      </p>
      <Card className="border-slate-200 flex flex-col h-[60vh]">
        <ChatMessages messages={messages} selfType="Admin" />
        {!isFinalizada && <ChatInput onSend={handleSend} />}
      </Card>
      {id && solicitacao && (
        <TransferirDialog
          open={showTransfer}
          onOpenChange={setShowTransfer}
          solicitacaoId={id}
          currentDepartamento={solicitacao.departamento}
          onTransferred={() => {
            loadData()
          }}
        />
      )}
    </div>
  )
}
