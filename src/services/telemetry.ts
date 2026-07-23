export interface TelemetryRecord {
  data: string
  pontuacao: number
  infracoes: string
}

export interface TelemetryQuery {
  dataInicial: Date
  dataFinal: Date
}

const SIMULATED_DATA: TelemetryRecord[] = [
  { data: '15/09/2024', pontuacao: 85, infracoes: 'Excesso de velocidade, 3 pontos na carteira' },
  { data: '16/09/2024', pontuacao: 72, infracoes: 'Frenagem brusca em via molhada' },
  { data: '17/09/2024', pontuacao: 95, infracoes: 'Nenhuma infração registrada' },
  { data: '18/09/2024', pontuacao: 60, infracoes: 'Uso de celular durante condução, 4 pontos' },
  { data: '19/09/2024', pontuacao: 90, infracoes: 'Curva fechada em velocidade elevada' },
  {
    data: '20/09/2024',
    pontuacao: 45,
    infracoes: 'Excesso de velocidade + avanço de semáforo, 7 pontos',
  },
  { data: '21/09/2024', pontuacao: 88, infracoes: 'Aceleração brusca em via urbana' },
]

const SIMULATED_TIMEOUT = 1000

export async function fetchTelemetry(query: TelemetryQuery): Promise<TelemetryRecord[]> {
  // TODO: Replace with real API URL
  // const API_URL = 'https://api.viasudeste.com.br/telemetria'
  // TODO: Add authentication headers
  // const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  // Simulated fetch — replace with:
  // const res = await fetch(`${API_URL}?dataInicial=...&dataFinal=...`, { headers })
  // if (!res.ok) throw new Error('API error')
  // return res.json()

  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, SIMULATED_TIMEOUT)
    // Simulate ~10% failure rate for error handling demonstration
    if (Math.random() < 0.0) {
      clearTimeout(timer)
      reject(new Error('SIMULATED_NETWORK_TIMEOUT'))
    }
  })

  return SIMULATED_DATA
}
