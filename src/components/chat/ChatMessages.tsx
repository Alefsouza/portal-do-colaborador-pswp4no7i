import { useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { SolicitacaoMensagem } from '@/services/solicitacao-mensagens'

interface ChatMessagesProps {
  messages: SolicitacaoMensagem[]
  selfType: 'Admin' | 'Colaborador'
}

function getSenderName(msg: SolicitacaoMensagem): string {
  const name = msg.expand?.id_usuario?.nome_completo
  if (name) return name
  return msg.tipo_remetente === 'Admin' ? 'Admin' : 'Colaborador'
}

export function ChatMessages({ messages, selfType }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        Nenhuma mensagem ainda. Inicie a conversa.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {messages.map((msg) => {
        const isSelf = msg.tipo_remetente === selfType
        return (
          <div key={msg.id} className={cn('flex flex-col', isSelf ? 'items-end' : 'items-start')}>
            <span
              className={cn('text-xs font-medium mb-1', isSelf ? 'text-primary' : 'text-slate-500')}
            >
              {getSenderName(msg)}
            </span>
            <div
              className={cn(
                'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm break-words',
                isSelf
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-slate-100 text-slate-800 rounded-bl-sm',
              )}
            >
              {msg.mensagem}
            </div>
            <span className="text-xs text-slate-400 mt-1">
              {format(parseISO(msg.created), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
            </span>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
