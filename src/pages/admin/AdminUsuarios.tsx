import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import {
  Loader2,
  AlertCircle,
  Users as UsersIcon,
  Plus,
  Pencil,
  KeyRound,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useRealtime } from '@/hooks/use-realtime'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { listUsuariosAdmin, type UsuarioAdmin } from '@/services/admin-usuarios'
import { UsuarioFormDialog } from '@/components/admin/UsuarioFormDialog'
import { ResetPasswordDialog } from '@/components/admin/ResetPasswordDialog'
import { maskCpf } from '@/lib/utils'

export default function AdminUsuarios() {
  const { user } = useAdminAuth()
  const isTI = user?.perfil === 'TI'
  const [items, setItems] = useState<UsuarioAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<UsuarioAdmin | null>(null)
  const [resetUser, setResetUser] = useState<UsuarioAdmin | null>(null)

  const loadData = useCallback(
    async (targetPage: number, searchQuery: string) => {
      if (!isTI) return
      setLoading(true)
      try {
        setError(false)
        const result = await listUsuariosAdmin(targetPage, 10, searchQuery)
        setItems(result.items as UsuarioAdmin[])
        setTotalPages(result.totalPages)
        setTotalItems(result.totalItems)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    },
    [isTI],
  )

  useEffect(() => {
    if (isTI) loadData(page, search)
  }, [loadData, page, search, isTI])

  useRealtime('usuarios', () => loadData(page, search), isTI)

  if (!isTI) return <Navigate to="/admin/dashboard" replace />

  const handleSearch = () => {
    setPage(1)
    setSearch(searchInput)
  }
  const openCreate = () => {
    setEditingItem(null)
    setDialogOpen(true)
  }
  const openEdit = (item: UsuarioAdmin) => {
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
        <AlertDescription>Erro ao carregar usuários.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Gerenciar Usuários</h1>
          <p className="text-slate-500 mt-1">Cadastre e gerencie todos os colaboradores</p>
        </div>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-white gap-2">
          <Plus className="w-4 h-4" /> Criar Usuário
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Buscar por nome, CPF ou registro..."
          className="max-w-sm"
        />
        <Button variant="outline" onClick={handleSearch} className="gap-2">
          <Search className="w-4 h-4" /> Buscar
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <UsersIcon className="w-8 h-8 text-primary" />
          </div>
          <p className="text-slate-500">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <>
          <Card className="border-slate-200 hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5 hover:bg-primary/5">
                    <TableHead className="font-bold text-primary">CPF</TableHead>
                    <TableHead className="font-bold text-primary">Nome</TableHead>
                    <TableHead className="font-bold text-primary">Registro</TableHead>
                    <TableHead className="font-bold text-primary">Perfil</TableHead>
                    <TableHead className="font-bold text-primary">Depto</TableHead>
                    <TableHead className="font-bold text-primary">1º Acesso</TableHead>
                    <TableHead className="font-bold text-primary">Criação</TableHead>
                    <TableHead className="font-bold text-primary">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="border-slate-100 hover:bg-primary/5">
                      <TableCell className="font-mono text-sm">{maskCpf(item.cpf)}</TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {item.nome_completo}
                      </TableCell>
                      <TableCell className="text-slate-600">{item.registro}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            item.perfil === 'TI'
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }
                        >
                          {item.perfil}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">{item.departamento}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            item.primeiro_acesso
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : 'bg-green-100 text-green-700 border-green-200'
                          }
                        >
                          {item.primeiro_acesso ? 'Sim' : 'Não'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {format(parseISO(item.created), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                            <Pencil className="w-4 h-4 text-slate-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setResetUser(item)}>
                            <KeyRound className="w-4 h-4 text-amber-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="md:hidden space-y-3">
            {items.map((item) => (
              <Card key={item.id} className="border-slate-200">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-slate-900">{item.nome_completo}</h3>
                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                      {item.perfil}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-500 font-mono">
                    {maskCpf(item.cpf)} • {item.registro}
                  </p>
                  <p className="text-xs text-slate-400">
                    {item.departamento} •{' '}
                    {format(parseISO(item.created), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(item)}
                      className="gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setResetUser(item)}
                      className="text-amber-600 gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Redefinir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-slate-500">
                Página {page} de {totalPages} ({totalItems}{' '}
                {totalItems === 1 ? 'registro' : 'registros'})
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próximo <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <UsuarioFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingItem={editingItem}
        onSaved={() => loadData(page, search)}
      />
      <ResetPasswordDialog
        open={!!resetUser}
        onOpenChange={(o) => {
          if (!o) setResetUser(null)
        }}
        usuario={resetUser}
      />
    </div>
  )
}
