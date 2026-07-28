import { useState, useEffect, useCallback, useRef } from 'react'
import { Bell, Megaphone, FileText, Loader2, AlertCircle, RefreshCw, Download } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import { listInformativos, getAnexoUrl, type Informativo } from '@/services/admin-informativos'
import { getVisualizados, markAsViewed } from '@/services/informativos-visualizados'
import { getAllPopups, type PopupEnvio } from '@/services/popup-envios'
import { cn } from '@/lib/utils'

function formatDate(iso: string) {
  return format(parseISO(iso), "dd 'de' MMM 'de' yyyy", { locale: ptBR })
}

export function NotificationBell() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [informativos, setInformativos] = useState<Informativo[]>([])
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set())
  const [popups, setPopups] = useState<PopupEnvio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [detail, setDetail] = useState<{
    type: 'info' | 'popup'
    data: Informativo | PopupEnvio
  } | null>(null)
  const [shouldShake, setShouldShake] = useState(false)
  const prevBadge = useRef(0)

  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      setError(false)
      const [all, visualizados, userPopups] = await Promise.all([
        listInformativos(),
        getVisualizados(user.id),
        getAllPopups(user.id),
      ])
      setInformativos(all.filter((i) => i.status_ativo))
      setViewedIds(new Set(visualizados.map((v) => v.id_informativo)))
      setPopups(userPopups)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('informativos', () => {
    loadData()
  })
  useRealtime('popup_envios', () => {
    loadData()
  })

  const unviewed = informativos.filter((i) => !viewedIds.has(i.id))
  const badgeCount = unviewed.length

  useEffect(() => {
    if (badgeCount > prevBadge.current) {
      setShouldShake(true)
      const t = setTimeout(() => setShouldShake(false), 600)
      prevBadge.current = badgeCount
      return () => clearTimeout(t)
    }
    prevBadge.current = badgeCount
  }, [badgeCount])

  const handleInformativoClick = async (item: Informativo) => {
    setViewedIds((prev) => new Set(prev).add(item.id))
    setOpen(false)
    setDetail({ type: 'info', data: item })
    try {
      await markAsViewed(user!.id, item.id)
    } catch {
      setViewedIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      toast({ title: 'Erro ao marcar como lido', variant: 'destructive' })
    }
  }

  const handlePopupClick = (popup: PopupEnvio) => {
    setOpen(false)
    setDetail({ type: 'popup', data: popup })
  }

  const hasContent = unviewed.length > 0 || popups.length > 0
  const infoDetail = detail?.type === 'info' ? (detail.data as Informativo) : null
  const popupDetail = detail?.type === 'popup' ? (detail.data as PopupEnvio) : null

  return (
    <>
      <style>{`@keyframes bell-shake{0%,100%{transform:rotate(0)}15%{transform:rotate(-14deg)}30%{transform:rotate(14deg)}45%{transform:rotate(-10deg)}60%{transform:rotate(10deg)}75%{transform:rotate(-6deg)}90%{transform:rotate(6deg)}}.bell-shake{animation:bell-shake .6s ease-in-out}`}</style>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (o) loadData()
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <span className={cn(shouldShake && 'bell-shake')}>
              <Bell className="w-5 h-5 text-slate-600" />
            </span>
            {badgeCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {badgeCount > 9 ? '9+' : badgeCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 sm:w-96 p-0" align="end">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Carregando...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <AlertCircle className="w-6 h-6 text-destructive" />
              <p className="text-sm text-slate-500 text-center px-4">
                Não foi possível carregar notificações
              </p>
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Tentar novamente
              </Button>
            </div>
          ) : !hasContent ? (
            <div className="flex items-center justify-center py-12 text-sm text-slate-400">
              Nenhuma notificação
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              {unviewed.length > 0 && (
                <div className="border-b border-slate-100">
                  <h3 className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50/50">
                    Informativos novos
                  </h3>
                  {unviewed.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleInformativoClick(item)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left cursor-pointer border-b border-slate-50 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Megaphone className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{item.titulo}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(item.created)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {popups.length > 0 && (
                <div>
                  <h3 className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide bg-slate-50/50">
                    POP-UPs anteriores
                  </h3>
                  {popups.map((popup) => (
                    <button
                      key={popup.id}
                      onClick={() => handlePopupClick(popup)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left cursor-pointer border-b border-slate-50 last:border-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {popup.titulo}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatDate(popup.created)}</p>
                      </div>
                      {!popup.status_lido && (
                        <span className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          )}
        </PopoverContent>
      </Popover>

      <Dialog
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-primary" />
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {infoDetail?.titulo ?? popupDetail?.titulo}
              </DialogTitle>
            </div>
            <p className="text-slate-600 whitespace-pre-wrap text-sm leading-relaxed">
              {infoDetail?.conteudo ?? popupDetail?.conteudo}
            </p>
          </DialogHeader>
          {infoDetail?.anexo && (
            <a
              href={getAnexoUrl(infoDetail)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-2 hover:underline"
            >
              <Download className="w-4 h-4" />
              Baixar anexo
            </a>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
