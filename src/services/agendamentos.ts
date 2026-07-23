import pb from '@/lib/pocketbase/client'

export interface Agendamento {
  id: string
  id_usuario: string
  departamento: string
  data: string
  hora: string
  observacao: string
  status: string
  created: string
  updated: string
}

export async function listAgendamentos(userId: string): Promise<Agendamento[]> {
  return (await pb.collection('agendamentos').getFullList({
    filter: `id_usuario = "${userId}"`,
    sort: '-created',
  })) as Agendamento[]
}

export async function createAgendamento(data: {
  id_usuario: string
  departamento: string
  data: string
  hora: string
  observacao: string
}): Promise<Agendamento> {
  return (await pb.collection('agendamentos').create({
    ...data,
    status: 'Pendente',
  })) as Agendamento
}
