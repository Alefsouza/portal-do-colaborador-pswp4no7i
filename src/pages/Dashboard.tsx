import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import {
  Gauge,
  Receipt,
  ClipboardList,
  CalendarClock,
  Wrench,
  ArrowRight,
  Megaphone,
  Clock,
  GraduationCap,
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
]

const notices = [
  {
    title: 'Nova frota de ônibus elétricos',
    date: '15 Jul 2026',
    desc: 'A Via Sudeste inaugura 10 novos ônibus elétricos, reforçando nosso compromisso com a sustentabilidade.',
    icon: Megaphone,
  },
  {
    title: 'Horário de verão',
    date: '10 Jul 2026',
    desc: 'A partir de 01/10, os horários das linhas serão ajustados. Confira as mudanças no mural interno.',
    icon: Clock,
  },
  {
    title: 'Programa de treinamento 2026',
    date: '05 Jul 2026',
    desc: 'Inscrições abertas para o programa de capacitação profissional. Vagas limitadas por área.',
    icon: GraduationCap,
  },
]

export default function Dashboard() {
  const { user } = useAuth()
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          Olá, {user?.nome_completo || 'Colaborador'}
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

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Informativos da Empresa</h2>
        <div className="space-y-3">
          {notices.map((notice) => (
            <Card
              key={notice.title}
              className="border-slate-200 hover:shadow-subtle transition-shadow"
            >
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <notice.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-semibold text-slate-900">{notice.title}</h4>
                    <span className="text-xs text-slate-400 shrink-0">{notice.date}</span>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">{notice.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
