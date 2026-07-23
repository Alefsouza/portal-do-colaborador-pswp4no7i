import {
  LayoutDashboard,
  Activity,
  Receipt,
  ClipboardList,
  CalendarClock,
  Wrench,
} from 'lucide-react'

export const userMock = {
  name: 'Carlos Silva',
  avatar: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=1',
  role: 'Motorista',
}

export const navigationMenu = [
  { name: 'Dashboard (Início)', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Telemetria', href: '/telemetria', icon: Activity },
  { name: 'Recibos', href: '/recibos', icon: Receipt },
  { name: 'Solicitações', href: '/solicitacoes', icon: ClipboardList },
  { name: 'Agendamentos', href: '/agendamentos', icon: CalendarClock },
  { name: 'Serviços', href: '/servicos', icon: Wrench },
]

export const dashboardCards = [
  {
    id: 'telemetria',
    title: 'Telemetria',
    description: 'Acompanhe dados de rota e desempenho do veículo.',
    icon: Activity,
    href: '/telemetria',
  },
  {
    id: 'recibos',
    title: 'Recibos',
    description: 'Visualize e baixe seus comprovantes de pagamento.',
    icon: Receipt,
    href: '/recibos',
  },
  {
    id: 'solicitacoes',
    title: 'Solicitações',
    description: 'Abra e acompanhe solicitações administrativas.',
    icon: ClipboardList,
    href: '/solicitacoes',
  },
  {
    id: 'agendamentos',
    title: 'Agendamentos',
    description: 'Agende férias, folgas e exames médicos.',
    icon: CalendarClock,
    href: '/agendamentos',
  },
  {
    id: 'servicos',
    title: 'Serviços',
    description: 'Solicite manutenção, uniformes e equipamentos.',
    icon: Wrench,
    href: '/servicos',
  },
]

export const informativos = [
  {
    id: 1,
    title: 'Inauguração do novo terminal rodoviário',
    linkText: 'Saiba mais',
  },
  {
    id: 2,
    title: 'Programa de incentivo à direção defensiva',
    linkText: 'Participe',
  },
  {
    id: 3,
    title: 'Abertura de inscrições para curso de especialização',
    linkText: 'Inscreva-se',
  },
]

export const notifications = [
  { id: 1, text: 'Novo aviso de segurança' },
  { id: 2, text: 'Recibo de pagamento disponível' },
]
