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
    if (!userId) return
    getUnreadPopups(userId)
      .then(setPopups)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const current = popups[currentIndex]
  const open = !!current?.expand?.id_informativo

  const handleClose = useCallback(async () => {
    if (current) {
      try {
        await markPopupAsRead(current.id)
      } catch {
        /* intentionally ignored */
      }
    }
    setPopups([])
    setCurrentIndex(0)
  }, [current])

  const handleNext = useCallback(async () => {
    if (current) {
      try {
        await markPopupAsRead(current.id)
      } catch {
        /* intentionally ignored */
      }
    }
    setCurrentIndex((i) => i + 1)
  }, [current])

  if (loading || !current?.expand?.id_informativo) return null

  const info = current.expand.id_informativo
  const hasMore = currentIndex < popups.length - 1

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">{info.titulo}</DialogTitle>
          </div>
          <p className="text-slate-600 whitespace-pre-wrap text-sm leading-relaxed">
            {info.conteudo}
          </p>
        </DialogHeader>
        {hasMore && (
          <div className="flex justify-end mt-4">
            <Button onClick={handleNext} variant="outline" className="gap-2">
              Próximo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
