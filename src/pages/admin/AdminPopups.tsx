import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { Loader2, Plus, Send, Megaphone } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRealtime } from '@/hooks/use-realtime'
import { listPopups, createPopup, type PopupEnvioAdmin } from '@/services/admin-popups'
import { listUsuariosForSelect, type UsuarioSelect } from '@/services/admin-usuarios'

export default function AdminPopups() {
  const [items, setItems] = useState<PopupEnvioAdmin[]>([])
  const [users, setUsers] = useState<UsuarioSelect[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [userId, setUserId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await listPopups())
    } catch {
      /* ignored */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    listUsuariosForSelect()
      .then(setUsers)
      .catch(() => {})
  }, [loadData])

  useRealtime('popup_envios', () => {
    loadData()
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() || !conteudo.trim() || !userId) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    setSubmitting(true)
    try {
      await createPopup({ titulo, conteudo, id_usuario: userId })
      toast.success('Pop-up enviado com sucesso!')
      setTitulo('')
      setConteudo('')
      setUserId('')
      setDialogOpen(false)
      loadData()
    } catch {
      toast.error('Erro ao criar pop-up.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Pop-ups</h1>
          <p className="text-slate-500 mt-1">Envie notificações para os colaboradores</p>
        </div>
        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          Criar Pop-up
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Megaphone className="w-8 h-8 text-primary" />
          </div>
          <p className="text-slate-500">Nenhum pop-up enviado.</p>
        </div>
      ) : (
        <Card className="border-slate-200">
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5 hover:bg-primary/5">
                  <TableHead className="font-bold text-primary">Título</TableHead>
                  <TableHead className="font-bold text-primary">Conteúdo</TableHead>
                  <TableHead className="font-bold text-primary">Usuário</TableHead>
                  <TableHead className="font-bold text-primary">Status</TableHead>
                  <TableHead className="font-bold text-primary">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="border-slate-100 hover:bg-primary/5">
                    <TableCell className="font-medium text-slate-900">
                      {item.titulo || '—'}
                    </TableCell>
                    <TableCell className="text-slate-500 max-w-xs truncate">
                      {item.conteudo || '—'}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {item.expand?.id_usuario?.nome_completo || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          item.status_lido
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        }
                      >
                        {item.status_lido ? 'Lido' : 'Não lido'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {format(parseISO(item.created), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Criar Pop-up</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="popup-titulo">Título *</Label>
              <Input
                id="popup-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Digite o título do pop-up"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="popup-conteudo">Conteúdo *</Label>
              <Textarea
                id="popup-conteudo"
                rows={4}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Digite o conteúdo da mensagem"
              />
            </div>
            <div className="space-y-2">
              <Label>Usuário *</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione o usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-white gap-2 w-full"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar Pop-up
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
