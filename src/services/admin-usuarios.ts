import pb from '@/lib/pocketbase/client'

export interface UsuarioSelect {
  id: string
  nome_completo: string
  cpf: string
  departamento: string
}

export async function getDistinctDepartamentos(): Promise<string[]> {
  const usuarios = (await pb.collection('usuarios').getFullList()) as UsuarioSelect[]
  const set = new Set<string>()
  for (const u of usuarios) {
    if (u.departamento) set.add(u.departamento)
  }
  return Array.from(set).sort()
}

export async function listUsuariosForSelect(): Promise<UsuarioSelect[]> {
  return (await pb.collection('usuarios').getFullList({
    sort: 'nome_completo',
  })) as UsuarioSelect[]
}
