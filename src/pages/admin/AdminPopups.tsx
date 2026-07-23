import { useState, useEffect, type FormEvent } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { sendPopup } from '@/services/admin-popups'
import {
  getDistinctDepartamentos,
  listUsuariosForSelect,
  type UsuarioSelect,
} from '@/services/admin-usuarios'
import { UserMultiSelect } from '@/components/admin/UserMultiSelect'

type RecipientType = 'all' | 'department' | 'specific'

export default function AdminPopups() {
  const { token } = useAdminAuth()
  const [titulo, setTitulo] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [recipientType, setRecipientType] = useState<RecipientType>('all')
  const [departamento, setDepartamento] = useState('')
  const [userIds, setUserIds] = useState<string[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [users, setUsers] = useState<UsuarioSelect[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getDistinctDepartamentos()
      .then(setDepartments)
      .catch(() => {})
    listUsuariosForSelect()
      .then(setUsers)
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (!titulo.trim() || !conteudo.trim()) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    if (recipientType === 'department' && !departamento) {
      toast.error('Selecione um departamento.')
      return
    }
    if (recipientType === 'specific' && userIds.length === 0) {
      toast.error('Selecione ao menos um colaborador.')
      return
    }
    setSubmitting(true)
    try {
      const result = await sendPopup(token, {
        titulo,
        conteudo,
        recipientType,
        departamento: recipientType === 'department' ? departamento : undefined,
        userIds: recipientType === 'specific' ? userIds : undefined,
      })
      toast.success(`Pop-up enviado para ${result.recipients} colaborador(es)!`)
      setTitulo('')
      setConteudo('')
      setRecipientType('all')
      setDepartamento('')
      setUserIds([])
    } catch {
      toast.error('Erro ao enviar pop-up.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Pop-ups</h1>
        <p className="text-slate-500 mt-1">Envie notificações para os colaboradores</p>
      </div>
      <Card className="border-slate-200 max-w-2xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                rows={5}
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
                placeholder="Digite o conteúdo da mensagem"
              />
            </div>
            <div className="space-y-2">
              <Label>Destinatários *</Label>
              <RadioGroup
                value={recipientType}
                onValueChange={(v) => setRecipientType(v as RecipientType)}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="r-all" />
                  <Label htmlFor="r-all">Todos os colaboradores</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="department" id="r-dept" />
                  <Label htmlFor="r-dept">Por departamento</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="specific" id="r-spec" />
                  <Label htmlFor="r-spec">Colaboradores específicos</Label>
                </div>
              </RadioGroup>
            </div>
            {recipientType === 'department' && (
              <div className="space-y-2">
                <Label>Departamento *</Label>
                <Select value={departamento} onValueChange={setDepartamento}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {recipientType === 'specific' && (
              <div className="space-y-2">
                <Label>Colaboradores *</Label>
                <UserMultiSelect users={users} selected={userIds} onChange={setUserIds} />
              </div>
            )}
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar Pop-up
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
