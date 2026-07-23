import { Menu, Bus, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useAdminAuth } from '@/hooks/use-admin-auth'

export function AdminHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const { user, token } = useAdminAuth()

  const handleSwitchToPortal = () => {
    if (!token || !user) return
    setSession(token, {
      id: user.id,
      nome_completo: user.nome_completo,
      primeiro_acesso: false,
      departamento: user.departamento,
      perfil: user.perfil,
    })
    navigate('/dashboard')
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 md:hidden">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Bus className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-900">Via Sudeste</span>
        </div>
        <p className="hidden md:block text-sm text-slate-500">Área Administrativa</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSwitchToPortal}
        className="cursor-pointer hover:bg-primary/5 hover:border-primary/40 transition-all duration-200"
      >
        <UserRound className="w-4 h-4 mr-2" />
        Ver como Colaborador
      </Button>
    </header>
  )
}
