import pb from '@/lib/pocketbase/client'

export interface DashboardCounts {
  solicitacoes: number
  agendamentos: number
  informativos: number
  popupEnvios: number
}

export async function getDashboardCounts(departamento: string): Promise<DashboardCounts> {
  const [sols, agends, infos, popups] = await Promise.all([
    pb.collection('solicitacoes').getList(1, 1, {
      filter: `departamento = "${departamento}"`,
    }),
    pb.collection('agendamentos').getList(1, 1, {
      filter: `departamento = "${departamento}"`,
    }),
    pb.collection('informativos').getList(1, 1, {
      filter: 'status_ativo = true',
    }),
    pb.collection('popup_envios').getList(1, 1),
  ])
  return {
    solicitacoes: sols.totalItems,
    agendamentos: agends.totalItems,
    informativos: infos.totalItems,
    popupEnvios: popups.totalItems,
  }
}
