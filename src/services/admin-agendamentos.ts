import pb from '@/lib/pocketbase/client'

export interface AdminAgendamento {
  id: string
  id_usuario: string
  departamento: string
  data: string
  hora: string
  observacao: string
  status: string
  created: string
  expand?: {
    id_usuario?: {
      id: string
      nome_completo: string
      cpf: string
    }
  }
}

export async function listAdminAgendamentos(departamento: string): Promise<AdminAgendamento[]> {
  return (await pb.collection('agendamentos').getFullList({
    filter: `departamento = "${departamento}"`,
    sort: '-created',
    expand: 'id_usuario',
  })) as AdminAgendamento[]
}

export async function updateAgendamentoStatus(id: string, status: string): Promise<void> {
  await pb.collection('agendamentos').update(id, { status })
}
