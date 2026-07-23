import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Megaphone } from 'lucide-react'
import { getUnreadPopups, markPopupAsRead, type PopupEnvio } from '@/services/popup-envios'

export function PopupDisplay({ userId }: { userId: string }) {
  const [popups, setPopups] = useState<PopupEnvio[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    const loginTimestamp = localStorage.getItem('loginTimestamp')
    if (!loginTimestamp) {
      setLoading(false)
      return
    }
    const sessionKey = `popups_shown_${loginTimestamp}`
    if (sessionStorage.getItem(sessionKey)) {
      setLoading(false)
      return
    }
    getUnreadPopups(userId, loginTimestamp)
      .then(setPopups)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const current = popups[currentIndex]
  const open = !!current

  const handleMarkAsRead = useCallback(() => {
    if (current) {
      markPopupAsRead(current.id).catch(() => {})
    }
    if (currentIndex < popups.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      setPopups([])
      setCurrentIndex(0)
      const loginTimestamp = localStorage.getItem('loginTimestamp')
      if (loginTimestamp) {
        sessionStorage.setItem(`popups_shown_${loginTimestamp}`, 'true')
      }
    }
  }, [current, currentIndex, popups.length])

  if (loading || !current) return null

  const hasMore = currentIndex < popups.length - 1

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleMarkAsRead()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">{current.titulo}</DialogTitle>
          </div>
          <p className="text-slate-600 whitespace-pre-wrap text-sm leading-relaxed">
            {current.conteudo}
          </p>
        </DialogHeader>
        <div className="flex justify-end mt-4 gap-2">
          {hasMore && (
            <Button onClick={handleMarkAsRead} variant="outline">
              Próximo
            </Button>
          )}
          <Button onClick={handleMarkAsRead} className="bg-primary hover:bg-primary/90 text-white">
            Marcar como lido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
