import { ClipboardList, CalendarClock, Megaphone, Bell } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { getDashboardCards } from '@/lib/admin/mockData'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import type { ComponentType } from 'react'

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  ClipboardList,
  CalendarClock,
  Megaphone,
  Bell,
}

export default function AdminDashboard() {
  const { user } = useAdminAuth()
  const cards = getDashboardCards()

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
                <p className="text-3xl font-bold text-slate-900">{card.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
