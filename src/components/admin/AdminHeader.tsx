import { Menu, Bell, Bus, LogOut, ChevronDown, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { useAdminAuth } from '@/hooks/use-admin-auth'

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function AdminHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const navigate = useNavigate()
  const { setSession } = useAuth()
  const { user, token, logout } = useAdminAuth()

  const nome = user?.nome_completo || 'Administrador'

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

  const handleLogout = () => {
    logout()
    navigate('/admin')
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

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 cursor-pointer">
              <Avatar className="w-9 h-9">
                <AvatarImage
                  src={`https://img.usecurling.com/ppl/thumbnail?gender=male&seed=${encodeURIComponent(nome)}`}
                />
                <AvatarFallback>{getInitials(nome)}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-slate-900 leading-none">{nome}</p>
                <p className="text-xs text-slate-500 mt-0.5">{user?.perfil || 'Administrador'}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{nome}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSwitchToPortal} className="cursor-pointer">
              <UserRound className="w-4 h-4 mr-2" />
              Ver como Colaborador
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
