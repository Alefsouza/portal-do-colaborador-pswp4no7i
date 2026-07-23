export interface Recibo {
  id: string
  data: string
  descricao: string
  valor: number
}

export interface ReciboQuery {
  dataInicial: Date
  dataFinal: Date
}

const SIMULATED_RECIBOS: Recibo[] = [
  { id: '1', data: '2024-09-30', descricao: 'Salário Setembro 2024', valor: 4500.0 },
  { id: '2', data: '2024-08-31', descricao: 'Salário Agosto 2024', valor: 4500.0 },
  { id: '3', data: '2024-07-31', descricao: 'Salário Julho 2024', valor: 4500.0 },
  { id: '4', data: '2024-07-15', descricao: 'Vale Transporte Julho', valor: 350.0 },
  { id: '5', data: '2024-06-30', descricao: 'Salário Junho 2024', valor: 4500.0 },
  { id: '6', data: '2024-06-15', descricao: 'Vale Refeição Junho', valor: 500.0 },
  { id: '7', data: '2024-05-31', descricao: 'Salário Maio 2024', valor: 4500.0 },
  { id: '8', data: '2024-05-15', descricao: 'Vale Transporte Maio', valor: 350.0 },
]

export async function fetchRecibos(query: ReciboQuery): Promise<Recibo[]> {
  // TODO: Replace with real API endpoint
  // const API_URL = 'https://api.viasudeste.com.br/recibos'
  // TODO: Add authentication headers
  // const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  // const res = await fetch(`${API_URL}?dataInicial=...&dataFinal=...`, { headers })
  // if (!res.ok) throw new Error('API error')
  // return res.json()

  await new Promise((resolve) => setTimeout(resolve, 800))

  const inicio = query.dataInicial.toISOString().split('T')[0]
  const fim = query.dataFinal.toISOString().split('T')[0]

  return SIMULATED_RECIBOS.filter((r) => r.data >= inicio && r.data <= fim)
}
