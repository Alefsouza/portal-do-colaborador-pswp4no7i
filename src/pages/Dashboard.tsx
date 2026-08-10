import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  Gauge,
  Receipt,
  ClipboardList,
  CalendarClock,
  Wrench,
  Newspaper,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const cards = [
  {
    title: 'Telemetria',
    desc: 'Acompanhe a telemetria dos veículos em tempo real.',
    icon: Gauge,
    path: '/telemetria',
  },
  {
    title: 'Recibos',
    desc: 'Visualize e baixe seus recibos de pagamento.',
    icon: Receipt,
    path: '/recibos',
  },
  {
    title: 'Solicitações',
    desc: 'Abra e acompanhe solicitações administrativas.',
    icon: ClipboardList,
    path: '/solicitacoes',
  },
  {
    title: 'Agendamentos',
    desc: 'Agende reuniões, avaliações e serviços internos.',
    icon: CalendarClock,
    path: '/agendamentos',
  },
  {
    title: 'Serviços',
    desc: 'Solicite serviços e manutenções operacionais.',
    icon: Wrench,
    path: '/servicos',
  },
  {
    title: 'Newsletter',
    desc: 'Leia os informativos e comunicados da empresa.',
    icon: Newspaper,
    path: '/newsletter',
  },
]

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          Bem-vindo, {user?.nome_completo || 'Colaborador'}
        </h1>
        <p className="text-slate-500 mt-1">Bem-vindo ao Portal do Colaborador Via Sudeste.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {cards.map((card) => (
          <Link key={card.title} to={card.path} className="group">
            <Card className="h-full border-slate-200 hover:border-primary/40 hover:shadow-elevation transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <card.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-slate-900 mb-1">{card.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{card.desc}</p>
                <div className="flex items-center gap-1 text-primary text-sm font-medium mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  Acessar <ArrowRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
