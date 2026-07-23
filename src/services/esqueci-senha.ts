const API_URL = import.meta.env.VITE_POCKETBASE_URL

export async function verificarIdentidade(cpf: string, nomeCompleto: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/backend/v1/esqueci-senha/verificar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf, nome_completo: nomeCompleto }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Erro ao verificar identidade')
  return data.exists === true
}

export async function redefinirSenha(
  cpf: string,
  nomeCompleto: string,
  novaSenha: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/backend/v1/esqueci-senha/redefinir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf, nome_completo: nomeCompleto, nova_senha: novaSenha }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Erro ao redefinir senha')
}
