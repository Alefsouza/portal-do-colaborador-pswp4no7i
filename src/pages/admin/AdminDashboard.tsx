import { useState, useEffect } from 'react'
import { ClipboardList, CalendarClock, Megaphone, Bell, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { getDashboardCounts, type DashboardCounts } from '@/services/admin-data'
import type { ComponentType } from 'react'

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  ClipboardList,
  CalendarClock,
  Megaphone,
  Bell,
}

const cards = [
  {
    id: 'solicitacoes',
    label: 'Solicitações',
    icon: 'ClipboardList',
    key: 'solicitacoes' as const,
  },
  {
    id: 'agendamentos',
    label: 'Agendamentos',
    icon: 'CalendarClock',
    key: 'agendamentos' as const,
  },
  {
    id: 'informativos',
    label: 'Informativos Ativos',
    icon: 'Megaphone',
    key: 'informativos' as const,
  },
  { id: 'popups', label: 'Pop-ups Enviados', icon: 'Bell', key: 'popupEnvios' as const },
]

export default function AdminDashboard() {
  const { user } = useAdminAuth()
  const [counts, setCounts] = useState<DashboardCounts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.departamento) return
    getDashboardCounts(user.departamento)
      .then(setCounts)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.departamento])

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Painel Administrativo</h1>
        <p className="text-slate-500 mt-1">
          Bem-vindo, {user?.nome_completo || 'Administrador'} — {user?.perfil || ''}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {cards.map((card) => {
          const Icon = iconMap[card.icon] || ClipboardList
          return (
            <Card
              key={card.id}
              className="border-slate-200 hover:border-primary/40 hover:shadow-elevation transition-all duration-300 hover:-translate-y-1"
            >
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm text-slate-500 font-medium mb-1">{card.label}</p>
                <p className="text-3xl font-bold text-slate-900">
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  ) : (
                    (counts?.[card.key] ?? 0)
                  )}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
