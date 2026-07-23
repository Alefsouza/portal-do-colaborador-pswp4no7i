import { useState, useEffect, useCallback } from 'react'
import { Loader2, User, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'
import { getUsuario, updateUsuario, type Usuario } from '@/services/usuarios'

export default function Perfil() {
  const { user, updateUser } = useAuth()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nomeCompleto, setNomeCompleto] = useState('')

  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      const data = await getUsuario(user.id)
      setUsuario(data)
      setNomeCompleto(data.nome_completo)
    } catch {
      toast.error('Erro ao carregar dados do perfil.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSave = async () => {
    if (!user?.id) return
    setSaving(true)
    try {
      await updateUsuario(user.id, { nome_completo: nomeCompleto })
      updateUser({ nome_completo: nomeCompleto })
      toast.success('Perfil atualizado com sucesso!')
    } catch {
      toast.error('Erro ao atualizar perfil.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Perfil</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Visualize e atualize seus dados cadastrais.
          </p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-500 text-sm">CPF</Label>
              <p className="font-semibold text-slate-900">{usuario?.cpf || '-'}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-500 text-sm">Registro</Label>
              <p className="font-semibold text-slate-900">{usuario?.registro || '-'}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-500 text-sm">Departamento</Label>
              <p className="font-semibold text-slate-900">{usuario?.departamento || '-'}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-500 text-sm">Perfil</Label>
              <p className="font-semibold text-slate-900">{usuario?.perfil || '-'}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="space-y-2">
              <Label htmlFor="nome_completo">Nome Completo</Label>
              <Input
                id="nome_completo"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-white gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
