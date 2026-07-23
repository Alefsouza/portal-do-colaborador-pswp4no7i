import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react'
import { Loader2, User, Camera, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/hooks/use-auth'
import { getUsuario, type Usuario } from '@/services/usuarios'
import { validateAvatarFile, uploadAvatar } from '@/services/avatar'
import { getErrorMessage } from '@/lib/pocketbase/errors'

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export default function Perfil() {
  const { user, token, updateUser } = useAuth()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    if (!user?.id) return
    try {
      const data = await getUsuario(user.id)
      setUsuario(data)
    } catch {
      toast.error('Erro ao carregar dados do perfil.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const nome = user?.nome_completo || 'Colaborador'
    setAvatarUrl(
      user?.avatar ||
        `https://img.usecurling.com/ppl/thumbnail?gender=male&seed=${encodeURIComponent(nome)}`,
    )
  }, [user?.avatar, user?.nome_completo])

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const error = validateAvatarFile(file)
    if (error) {
      toast.error(error)
      return
    }

    if (!token) {
      toast.error('Sessão inválida. Faça login novamente.')
      return
    }

    setUploading(true)
    try {
      const newAvatarUrl = await uploadAvatar(token, file)
      setAvatarUrl(newAvatarUrl)
      updateUser({ avatar: newAvatarUrl })
      toast.success('Foto atualizada com sucesso!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const nome = user?.nome_completo || 'Colaborador'

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Perfil</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Visualize seus dados cadastrais e atualize sua foto.
          </p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardContent className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative group">
              <Avatar className="w-20 h-20">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="text-lg">{getInitials(nome)}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer disabled:cursor-not-allowed"
                aria-label="Trocar foto"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            <div className="flex-1">
              <p className="text-xl font-bold text-slate-900">{nome}</p>
              <p className="text-sm text-slate-500">{user?.perfil || 'Colaborador'}</p>
              {user?.email && <p className="text-sm text-slate-500 mt-0.5">{user.email}</p>}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Trocar foto
            </Button>
          </div>

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
              <Label className="text-slate-500 text-sm">E-mail</Label>
              <p className="font-semibold text-slate-900">{user?.email || '-'}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <div className="space-y-2">
              <Label htmlFor="nome_completo">Nome Completo</Label>
              <Input
                id="nome_completo"
                value={user?.nome_completo || ''}
                readOnly
                disabled
                className="h-11 bg-slate-50 text-slate-600 cursor-not-allowed"
              />
              <p className="text-xs text-slate-400">
                O nome completo não pode ser alterado pelo portal.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
