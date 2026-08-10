import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRealtime } from '@/hooks/use-realtime'
import { listPopups, sendPopup, groupPopups, type PopupEnvioAdmin } from '@/services/admin-popups'
import { listUsuariosForSelect, type UsuarioSelect } from '@/services/admin-usuarios'
import { UserMultiSelect } from '@/components/admin/UserMultiSelect'
import { extractFieldErrors, getErrorMessage, type FieldErrors } from '@/lib/pocketbase/errors'

export default function AdminPopups() {
  const [items, setItems] = useState<PopupEnvioAdmin[]>([])
  const [users, setUsers] = useState<UsuarioSelect[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [recipientType, setRecipientType] = useState<'all' | 'specific'>('all')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  const grouped = useMemo(() => groupPopups(items), [items])

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
    setFieldErrors({})
    if (!titulo.trim()) {
      setFieldErrors({ titulo: 'Título é obrigatório.' })
      return
    }
    if (!conteudo.trim()) {
      setFieldErrors({ conteudo: 'Conteúdo é obrigatório.' })
      return
    }
    if (recipientType === 'specific' && selectedUserIds.length === 0) {
      setFieldErrors({ userIds: 'Selecione ao menos um colaborador.' })
      return
    }
    setSubmitting(true)
    try {
      await sendPopup({
        titulo,
        conteudo,
        recipientType,
        userIds: recipientType === 'specific' ? selectedUserIds : undefined,
      })
      toast.success('Pop-up enviado com sucesso!')
      setTitulo('')
      setConteudo('')
      setRecipientType('all')
      setSelectedUserIds([])
      setDialogOpen(false)
      loadData()
    } catch (err) {
      const fe = extractFieldErrors(err)
      if (Object.keys(fe).length > 0) setFieldErrors(fe)
      else toast.error(getErrorMessage(err))
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

      {grouped.length === 0 ? (
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
                  <TableHead className="font-bold text-primary">Destinatários</TableHead>
                  <TableHead className="font-bold text-primary">Status</TableHead>
                  <TableHead className="font-bold text-primary">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map((item) => (
                  <TableRow key={item.key} className="border-slate-100 hover:bg-primary/5">
                    <TableCell className="font-medium text-slate-900">
                      {item.titulo || '—'}
                    </TableCell>
                    <TableCell className="text-slate-500 max-w-xs truncate">
                      {item.conteudo || '—'}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {item.totalRecipients > 1 ? (
                        <span className="font-medium text-primary">Múltiplos usuários</span>
                      ) : (
                        item.firstUserName || '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          item.totalRecipients > 1
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : item.readCount === item.totalRecipients
                              ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-yellow-100 text-yellow-700 border-yellow-200'
                        }
                      >
                        {item.totalRecipients > 1
                          ? `${item.readCount}/${item.totalRecipients} lidos`
                          : item.readCount === item.totalRecipients
                            ? 'Lido'
                            : 'Não lido'}
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
              {fieldErrors.titulo && <p className="text-sm text-red-500">{fieldErrors.titulo}</p>}
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
              {fieldErrors.conteudo && (
                <p className="text-sm text-red-500">{fieldErrors.conteudo}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Destinatários *</Label>
              <RadioGroup
                value={recipientType}
                onValueChange={(v) => setRecipientType(v as 'all' | 'specific')}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="dest-all" />
                  <Label htmlFor="dest-all" className="cursor-pointer">
                    Todos os colaboradores
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="specific" id="dest-specific" />
                  <Label htmlFor="dest-specific" className="cursor-pointer">
                    Colaboradores específicos
                  </Label>
                </div>
              </RadioGroup>
            </div>
            {recipientType === 'specific' && (
              <div className="space-y-2">
                <Label>Selecionar colaboradores *</Label>
                <UserMultiSelect
                  users={users}
                  selected={selectedUserIds}
                  onChange={setSelectedUserIds}
                />
                {fieldErrors.userIds && (
                  <p className="text-sm text-red-500">{fieldErrors.userIds}</p>
                )}
              </div>
            )}
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
