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
  const result = await importCsvBatch(csvContent, () => {})
  return result.aggregated
}

export interface BatchImportResult {
  aggregated: CsvImportResult
  chunksTotal: number
  chunksSucceeded: number
  chunksFailed: number
  errors: string[]
}

export async function importCsvBatch(
  csvContent: string,
  onProgress: (completed: number, total: number) => void,
  chunkSize = 200,
): Promise<BatchImportResult> {
  const token = getAdminToken()
  if (!token) throw new Error('Sessão expirada. Faça login novamente.')

  let text = csvContent
  if (text.charCodeAt(0) === 0xfeff) text = text.substring(1)

  const allLines = text.split('\n')
  if (allLines.length < 2) {
    throw new Error('CSV sem dados.')
  }

  const header = allLines[0]
  const dataLines = allLines.slice(1).filter((l) => l.trim() !== '')

  if (dataLines.length === 0) {
    throw new Error('CSV sem dados.')
  }

  const chunks: string[] = []
  for (let i = 0; i < dataLines.length; i += chunkSize) {
    const slice = dataLines.slice(i, i + chunkSize)
    chunks.push(header + '\n' + slice.join('\n'))
  }

  const aggregated: CsvImportResult = {
    total_linhas: 0,
    eventos_direcao: 0,
    eventos_tecnicos: 0,
    motoristas_encontrados: 0,
    motoristas_nao_encontrados: 0,
  }

  let chunksSucceeded = 0
  let chunksFailed = 0
  const errors: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    try {
      const res = await fetch(`${PB_URL}/backend/v1/telemetria/csv-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ csv: chunks[i] }),
      })

      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        throw new Error(`Erro ${res.status}`)
      }

      if (!res.ok) {
        throw new Error((data.error as string) || `Erro ${res.status}`)
      }

      const chunkResult = data as unknown as CsvImportResult
      aggregated.total_linhas += chunkResult.total_linhas || 0
      aggregated.eventos_direcao += chunkResult.eventos_direcao || 0
      aggregated.eventos_tecnicos += chunkResult.eventos_tecnicos || 0
      aggregated.motoristas_encontrados += chunkResult.motoristas_encontrados || 0
      aggregated.motoristas_nao_encontrados += chunkResult.motoristas_nao_encontrados || 0
      chunksSucceeded++
    } catch (err) {
      const friendlyErr = friendlyNetworkError(err)
      chunksFailed++
      errors.push(`Chunk ${i + 1}/${chunks.length}: ${friendlyErr.message}`)
    }

    onProgress(i + 1, chunks.length)
  }

  return {
    aggregated,
    chunksTotal: chunks.length,
    chunksSucceeded,
    chunksFailed,
    errors,
  }
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
