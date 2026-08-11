const PB_URL = import.meta.env.VITE_POCKETBASE_URL || ''

function getAdminToken(): string {
  return localStorage.getItem('admin_token') || ''
}

function friendlyNetworkError(err: unknown): Error {
  if (err instanceof TypeError) {
    return new Error('Não foi possível conectar ao servidor. Tente novamente.')
  }
  if (err instanceof Error) {
    if (err.message === 'Failed to fetch' || err.message.includes('HTTP N/A')) {
      return new Error('Não foi possível conectar ao servidor. Tente novamente.')
    }
    return err
  }
  return new Error('Ocorreu um erro inesperado. Tente novamente.')
}

export interface CsvImportResult {
  total_linhas: number
  eventos_direcao: number
  eventos_tecnicos: number
  motoristas_encontrados: number
  motoristas_nao_encontrados: number
}

export interface ClearOldResult {
  eventos_removidos: number
  data_corte: string
}

export async function importCsvData(csvContent: string): Promise<CsvImportResult> {
  const token = getAdminToken()
  if (!token) throw new Error('Sessão expirada. Faça login novamente.')

  let res: Response
  try {
    res = await fetch(`${PB_URL}/backend/v1/telemetria/csv-import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ csv: csvContent }),
    })
  } catch (err) {
    throw friendlyNetworkError(err)
  }

  let data: Record<string, unknown>
  try {
    data = await res.json()
  } catch {
    throw new Error(`Erro ${res.status}`)
  }

  if (!res.ok) {
    throw new Error((data.error as string) || `Erro ${res.status}`)
  }

  return data as unknown as CsvImportResult
}

export async function clearOldTelemetryData(): Promise<ClearOldResult> {
  const token = getAdminToken()
  if (!token) throw new Error('Sessão expirada. Faça login novamente.')

  let res: Response
  try {
    res = await fetch(`${PB_URL}/backend/v1/telemetria/limpar-antigos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
  } catch (err) {
    throw friendlyNetworkError(err)
  }

  let data: Record<string, unknown>
  try {
    data = await res.json()
  } catch {
    throw new Error(`Erro ${res.status}`)
  }

  if (!res.ok) {
    throw new Error((data.error as string) || `Erro ${res.status}`)
  }

  return data as unknown as ClearOldResult
}
