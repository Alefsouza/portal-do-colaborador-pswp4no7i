import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Send,
  Paperclip,
  Loader2,
  Download,
  FileText,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useRealtime } from '@/hooks/use-realtime'
import {
  listMensagens,
  sendMensagem,
  getAnexoUrl,
  type SolicitacaoMensagem,
} from '@/services/solicitacao-mensagens'
import {
  listAllAdminSolicitacoes,
  updateSolicitacaoStatus,
  assumirSolicitacao,
  type AdminSolicitacao,
} from '@/services/admin-solicitacoes'
import { extractFieldErrors, type FieldErrors } from '@/lib/pocketbase/errors'
import { cn } from '@/lib/utils'

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

function MessageBubble({ msg, adminUserId }: { msg: SolicitacaoMensagem; adminUserId: string }) {
  const isOwn = msg.tipo_remetente === 'Admin'
  const anexoUrl = getAnexoUrl(msg)
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.anexo || '')
  const senderName = isOwn
    ? msg.expand?.id_usuario?.nome_completo || 'Admin'
    : msg.expand?.id_usuario?.nome_completo || 'Colaborador'

  return (
    <div className={cn('flex flex-col gap-1', isOwn ? 'items-end' : 'items-start')}>
      <div className={cn('flex items-center gap-2 px-1', isOwn && 'flex-row-reverse')}>
        <span className={cn('text-xs font-semibold', isOwn ? 'text-amber-600' : 'text-primary')}>
          {senderName}
        </span>
        <span className="text-xs text-slate-400">
          {format(parseISO(msg.created), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
        </span>
      </div>
      <div
        className={cn(
          'rounded-2xl px-4 py-2.5 max-w-[80%] md:max-w-[60%] break-words',
          isOwn
            ? 'bg-amber-500 text-white rounded-br-md'
            : 'bg-slate-100 text-slate-800 rounded-bl-md',
        )}
      >
        <p className="text-sm whitespace-pre-wrap">{msg.mensagem}</p>
        {anexoUrl && (
          <a
            href={anexoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'mt-2 flex items-center gap-2 text-xs underline rounded-lg p-1.5',
              isOwn ? 'text-white/80 hover:text-white' : 'text-primary hover:text-primary/80',
            )}
          >
            {isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            <span className="truncate max-w-[180px]">{msg.anexo}</span>
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
          </a>
        )}
      </div>
    </div>
  )
}

export function AdminSolicitacaoChat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAdminAuth()
  const [mensagens, setMensagens] = useState<SolicitacaoMensagem[]>([])
  const [solicitacao, setSolicitacao] = useState<AdminSolicitacao | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [finalizing, setFinalizing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const autoAssignRef = useRef(false)
  const userIdRef = useRef<string | undefined>(user?.id)
  userIdRef.current = user?.id

  const loadData = useCallback(async () => {
    if (!id) return
    try {
      setError(false)
      const [msgs, allSols] = await Promise.all([listMensagens(id), listAllAdminSolicitacoes()])
      setMensagens(msgs)
      const sol = allSols.find((s) => s.id === id)
      if (sol) {
        setSolicitacao(sol)
        if (!sol.id_proprietario && userIdRef.current && !autoAssignRef.current) {
          autoAssignRef.current = true
          try {
            await assumirSolicitacao(id, userIdRef.current)
          } catch {
            autoAssignRef.current = false
          }
        }
      }
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

  useRealtime('solicitacoes', (e) => {
    if (solicitacao && e.record.id === solicitacao.id) {
      const rec = e.record as Record<string, unknown>
      setSolicitacao((prev) =>
        prev
          ? {
              ...prev,
              status: rec.status as string,
              id_proprietario: rec.id_proprietario as string,
            }
          : prev,
      )
    }
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const handleSend = async () => {
    if (!id || !user?.id) return
    if (!text.trim() && !file) return
    setSending(true)
    setFieldErrors({})
    try {
      await sendMensagem({
        id_solicitacao: id,
        id_usuario: user.id,
        tipo_remetente: 'Admin',
        mensagem: text.trim(),
        anexo: file,
      })
      setText('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      const errors = extractFieldErrors(err)
      setFieldErrors(errors)
      if (Object.keys(errors).length > 0) {
        toast.error(Object.values(errors).join(' '))
      } else {
        toast.error('Erro ao enviar mensagem.')
      }
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFinalize = async () => {
    if (!id || !solicitacao) return
    setFinalizing(true)
    try {
      await updateSolicitacaoStatus(id, 'Finalizada')
      setSolicitacao((prev) => (prev ? { ...prev, status: 'Finalizada' } : prev))
      toast.success('Solicitação finalizada com sucesso.')
    } catch {
      toast.error('Erro ao finalizar solicitação. Tente novamente.')
    } finally {
      setFinalizing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-5 h-5" />
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>Erro ao carregar mensagens. Tente novamente.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/solicitacoes')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            {solicitacao?.titulo || 'Solicitação'}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            {solicitacao?.status && <StatusBadge status={solicitacao.status} />}
            <span className="text-slate-500 text-sm">
              {solicitacao?.expand?.id_usuario?.nome_completo || '—'}
            </span>
          </div>
        </div>
        {solicitacao?.status !== 'Finalizada' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={finalizing}
                className="gap-2 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800"
              >
                {finalizing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Finalizar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Finalizar solicitação</AlertDialogTitle>
                <AlertDialogDescription>
                  Deseja realmente finalizar esta solicitação? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={finalizing}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {finalizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      Finalizando...
                    </>
                  ) : (
                    'Sim, finalizar'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Card className="border-slate-200 flex flex-col h-[60vh] md:h-[65vh]">
        <CardContent className="p-4 flex-1 overflow-y-auto space-y-4">
          {mensagens.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              Nenhuma mensagem ainda. Inicie a conversa.
            </div>
          ) : (
            mensagens.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} adminUserId={user?.id || ''} />
            ))
          )}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardContent className="p-3">
          {file && (
            <div className="mb-2 flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
              <Paperclip className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-600 truncate flex-1">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  setFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
              >
                Remover
              </Button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              disabled={sending}
            />
            <Button
              onClick={handleSend}
              disabled={sending || (!text.trim() && !file)}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          {fieldErrors.mensagem && (
            <p className="text-sm text-red-500 mt-1">{fieldErrors.mensagem}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
