import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import { getSolicitacao, type Solicitacao } from '@/services/solicitacoes'
import {
  listMensagens,
  createMensagem,
  type SolicitacaoMensagem,
} from '@/services/solicitacao-mensagens'
import { ChatMessages } from '@/components/chat/ChatMessages'
import { ChatInput } from '@/components/chat/ChatInput'

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

export default function SolicitacaoChat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null)
  const [messages, setMessages] = useState<SolicitacaoMensagem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      setError(false)
      const [sol, msgs] = await Promise.all([getSolicitacao(id), listMensagens(id)])
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
      tipo_remetente: 'Colaborador',
      mensagem,
    })
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

  const isFinalizada = solicitacao.status === 'Finalizada'

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/solicitacoes')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex-1">
          {solicitacao.titulo}
        </h1>
        <StatusBadge status={solicitacao.status} />
      </div>
      <Card className="border-slate-200 flex flex-col h-[60vh]">
        <ChatMessages messages={messages} selfType="Colaborador" />
        {!isFinalizada && <ChatInput onSend={handleSend} />}
      </Card>
    </div>
  )
}
