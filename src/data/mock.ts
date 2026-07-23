export const MOCK_USER = {
  name: 'Carlos Silva',
  role: 'Motorista',
  avatar: 'https://img.usecurling.com/ppl/thumbnail?gender=male&seed=1',
}

export const MOCK_NOTIFICATIONS = [
  { id: 1, title: 'Novo aviso de segurança', time: 'Há 2 horas', unread: true },
  { id: 2, title: 'Recibo de pagamento disponível', time: 'Ontem', unread: false },
]

export const MOCK_INFORMATIVOS = [
  { id: 1, title: 'Inauguração do novo terminal rodoviário – Saiba mais', tag: 'Novo' },
  { id: 2, title: 'Programa de incentivo à direção defensiva', tag: 'Aviso' },
  { id: 3, title: 'Abertura de inscrições para curso de especialização', tag: 'Oportunidade' },
]

export const MOCK_CARDS = [
  {
    id: 'telemetria',
    title: 'Telemetria',
    description: 'Acompanhe dados de rota e desempenho do veículo.',
    icon: 'MapPin',
  },
  {
    id: 'recibos',
    title: 'Recibos',
    description: 'Visualize e baixe seus comprovantes de pagamento.',
    icon: 'Receipt',
  },
  {
    id: 'solicitacoes',
    title: 'Solicitações',
    description: 'Abra e acompanhe solicitações administrativas.',
    icon: 'ClipboardList',
  },
  {
    id: 'agendamentos',
    title: 'Agendamentos',
    description: 'Agende férias, folgas e exames médicos.',
    icon: 'CalendarClock',
  },
  {
    id: 'servicos',
    title: 'Serviços',
    description: 'Solicite manutenção, uniformes e equipamentos.',
    icon: 'Wrench',
  },
]
