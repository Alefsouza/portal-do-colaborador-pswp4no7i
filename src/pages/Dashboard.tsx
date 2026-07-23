import { useState, useEffect } from 'react'
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
  Download,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { listInformativos, getAnexoUrl, type Informativo } from '@/services/admin-informativos'

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

export default function Dashboard() {
  const { user } = useAuth()
  const [notices, setNotices] = useState<Informativo[]>([])

  useEffect(() => {
    listInformativos()
      .then((data) => setNotices(data.filter((n) => n.status_ativo)))
      .catch(() => {})
  }, [])

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

      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">Informativos da Empresa</h2>
        <div className="space-y-3">
          {notices.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="p-6 text-center text-slate-400">
                Nenhum informativo disponível no momento.
              </CardContent>
            </Card>
          ) : (
            notices.map((notice) => (
              <Card
                key={notice.id}
                className="border-slate-200 hover:shadow-subtle transition-shadow"
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Megaphone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">{notice.titulo}</h4>
                      <span className="text-xs text-slate-400 shrink-0">
                        {format(parseISO(notice.created), 'dd MMM yyyy', { locale: ptBR })}
                      </span>
                    </div>
                    {notice.conteudo && (
                      <p className="text-sm text-slate-500 leading-relaxed">{notice.conteudo}</p>
                    )}
                    {notice.anexo && (
                      <a
                        href={getAnexoUrl(notice)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-2 hover:underline"
                      >
                        <Download className="w-4 h-4" />
                        Baixar anexo
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
