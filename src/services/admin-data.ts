import pb from '@/lib/pocketbase/client'

export interface DashboardCounts {
  solicitacoes: number
  agendamentos: number
  informativos: number
  popupEnvios: number
}

export async function getDashboardCounts(departamento: string): Promise<DashboardCounts> {
  const deptFilter = `departamento = "${departamento}"`

  const [solicitacoes, agendamentos, informativos, popupEnvios] = await Promise.all([
    pb.collection('solicitacoes').getList(1, 1, { filter: deptFilter }),
    pb.collection('agendamentos').getList(1, 1, { filter: deptFilter }),
    pb.collection('informativos').getList(1, 1, { filter: 'status_ativo = true' }),
    pb.collection('popup_envios').getList(1, 1),
  ])

  return {
    solicitacoes: solicitacoes.totalItems,
    agendamentos: agendamentos.totalItems,
    informativos: informativos.totalItems,
    popupEnvios: popupEnvios.totalItems,
  }
}
