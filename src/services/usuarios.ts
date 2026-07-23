import pb from '@/lib/pocketbase/client'

export interface Usuario {
  id: string
  cpf: string
  nome_completo: string
  registro: string
  perfil: string
  departamento: string
  primeiro_acesso: boolean
}

export async function getUsuario(id: string): Promise<Usuario> {
  return (await pb.collection('usuarios').getOne(id)) as Usuario
}

export async function updateUsuario(
  id: string,
  data: Partial<Pick<Usuario, 'nome_completo'>>,
): Promise<Usuario> {
  return (await pb.collection('usuarios').update(id, data)) as Usuario
}
