export interface DashboardCardData {
  id: string
  label: string
  value: number
  icon: string
}

export function getDashboardCards(): DashboardCardData[] {
  return [
    { id: 'solicitacoes', label: 'Solicitações Recebidas', value: 12, icon: 'ClipboardList' },
    { id: 'agendamentos', label: 'Agendamentos Pendentes', value: 5, icon: 'CalendarClock' },
    { id: 'informativos', label: 'Informativos', value: 8, icon: 'Megaphone' },
    { id: 'popups', label: 'Pop-ups', value: 3, icon: 'Bell' },
  ]
}
