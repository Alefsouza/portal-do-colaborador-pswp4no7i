import { useState, useEffect, useCallback } from 'react'
import {
  Loader2,
  AlertCircle,
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Download,
  FileText,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useRealtime } from '@/hooks/use-realtime'
import {
  listInformativos,
  deleteInformativo,
  getAnexoUrl,
  isImageFile,
  type Informativo,
} from '@/services/admin-informativos'
import { InformativoFormDialog } from '@/components/admin/InformativoFormDialog'

export default function AdminInformativos() {
  const [items, setItems] = useState<Informativo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Informativo | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      setError(false)
      setItems(await listInformativos())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])
  useRealtime('informativos', () => {
    loadData()
  })

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteInformativo(deleteId)
      toast.success('Informativo excluído.')
    } catch {
      toast.error('Erro ao excluir.')
    } finally {
      setDeleteId(null)
    }
  }

  const openCreate = () => {
    setEditingItem(null)
    setDialogOpen(true)
  }
  const openEdit = (item: Informativo) => {
    setEditingItem(item)
    setDialogOpen(true)
  }

  if (loading && items.length === 0) {
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
        <AlertDescription>Erro ao carregar informativos.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Informativos</h1>
          <p className="text-slate-500 mt-1">Gerencie noticias e comunicados</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-white gap-2">
          <Plus className="w-4 h-4" />
          Criar Informativo
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Megaphone className="w-8 h-8 text-primary" />
          </div>
          <p className="text-slate-500">Nenhum informativo encontrado.</p>
        </div>
      ) : (
        <Card className="border-slate-200 hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5 hover:bg-primary/5">
                  <TableHead className="font-bold text-primary">Título</TableHead>
                  <TableHead className="font-bold text-primary">Conteúdo</TableHead>
                  <TableHead className="font-bold text-primary">Departamento</TableHead>
                  <TableHead className="font-bold text-primary">Status</TableHead>
                  <TableHead className="font-bold text-primary">Data</TableHead>
                  <TableHead className="font-bold text-primary">Anexo</TableHead>
                  <TableHead className="font-bold text-primary">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="border-slate-100 hover:bg-primary/5">
                    <TableCell className="font-medium text-slate-900">{item.titulo}</TableCell>
                    <TableCell className="text-slate-500 max-w-xs truncate">
                      {item.conteudo}
                    </TableCell>
                    <TableCell className="text-slate-600">{item.departamento || 'Todos'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          item.status_ativo
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }
                      >
                        {item.status_ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {format(parseISO(item.created), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {item.anexo ? (
                        <a
                          href={getAnexoUrl(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          {isImageFile(item.anexo) ? (
                            <img
                              src={getAnexoUrl(item)}
                              alt={item.titulo}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              Anexo
                            </>
                          )}
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                          <Pencil className="w-4 h-4 text-slate-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(item.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="border-slate-200">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-slate-900">{item.titulo}</h3>
                <Badge
                  variant="outline"
                  className={
                    item.status_ativo
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }
                >
                  {item.status_ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 line-clamp-2">{item.conteudo}</p>
              <p className="text-xs text-slate-400">
                {item.departamento || 'Todos'} •{' '}
                {format(parseISO(item.created), 'dd/MM/yyyy', { locale: ptBR })}
              </p>
              {item.anexo && (
                <a
                  href={getAnexoUrl(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary text-sm hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Baixar anexo
                </a>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(item)}
                  className="gap-1"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteId(item.id)}
                  className="text-red-600 gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <InformativoFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        onSaved={loadData}
      />
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => {
          if (!o) setDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir informativo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
