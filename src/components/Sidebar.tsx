import { useLocation, Link } from 'react-router-dom'
import type { ElementType } from 'react'
import {
  Bus,
  Home,
  Gauge,
  Receipt,
  ClipboardList,
  CalendarClock,
  Wrench,
  User,
  Settings,
} from 'lucide-react'
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

const mainNav = [
  { label: 'Início', path: '/dashboard', icon: Home },
  { label: 'Telemetria', path: '/telemetria', icon: Gauge },
  { label: 'Recibos', path: '/recibos', icon: Receipt },
  { label: 'Solicitações', path: '/solicitacoes', icon: ClipboardList },
  { label: 'Agendamentos', path: '/agendamentos', icon: CalendarClock },
  { label: 'Serviços', path: '/servicos', icon: Wrench },
]

const bottomNav = [
  { label: 'Perfil', path: '/dashboard', icon: User },
  { label: 'Configurações', path: '/dashboard', icon: Settings },
]

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0f5132] to-[#06422b]">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center shrink-0">
          <Bus className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-none">Via Sudeste</p>
          <p className="text-green-100/70 text-xs mt-1">Portal do Colaborador</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-green-100/50 text-xs font-semibold uppercase tracking-wider px-3 mb-2">
          Menu
        </p>
        {mainNav.map((item) => (
          <NavItem key={item.label} {...item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        {bottomNav.map((item) => (
          <NavItem key={item.label} {...item} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  )
}
