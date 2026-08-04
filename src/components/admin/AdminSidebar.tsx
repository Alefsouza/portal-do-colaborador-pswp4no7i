import { useLocation, Link } from 'react-router-dom'
import type { ElementType } from 'react'
import {
  Bus,
  LayoutDashboard,
  ClipboardList,
  CalendarClock,
  Megaphone,
  Bell,
  LogOut,
  Users,
  RefreshCw,
} from 'lucide-react'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface NavItemProps {
  to: string
  label: string
  icon: ElementType
  onNavigate?: () => void
}

function NavItem({ to, label, icon: Icon, onNavigate }: NavItemProps) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-white/15 text-white shadow-sm'
          : 'text-green-100/80 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {label}
    </Link>
  )
}

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { logout, user } = useAdminAuth()
  const navigate = useNavigate()

  const adminNav = [
    { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Solicitações', to: '/admin/solicitacoes', icon: ClipboardList },
    { label: 'Agendamentos', to: '/admin/agendamentos', icon: CalendarClock },
    { label: 'Informativos', to: '/admin/informativos', icon: Megaphone },
    { label: 'Pop-ups', to: '/admin/popups', icon: Bell },
    ...(user?.perfil === 'TI' || user?.perfil === 'Admin'
      ? [
          {
            label: 'Sincronização Telemetria',
            to: '/admin/telemetria/sincronizacao',
            icon: RefreshCw,
          },
        ]
      : []),
    ...(user?.perfil === 'TI'
      ? [{ label: 'Gerenciar Usuários', to: '/admin/usuarios', icon: Users }]
      : []),
  ]

  const handleLogout = () => {
    logout()
    navigate('/admin')
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0f5132] to-[#06422b]">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
          <Bus className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-none">Via Sudeste</p>
          <p className="text-green-100/70 text-xs mt-1">Área Administrativa</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-green-100/50 text-xs font-semibold uppercase tracking-wider px-3 mb-2">
          Menu
        </p>
        {adminNav.map((item) => (
          <NavItem key={item.label} {...item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-200/80 hover:bg-red-500/20 hover:text-red-100 transition-all duration-200 w-full"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          Sair
        </button>
      </div>
    </div>
  )
}
