const API_URL = import.meta.env.VITE_POCKETBASE_URL

export interface SendPopupData {
  titulo: string
  conteudo: string
  recipientType: 'all' | 'department' | 'specific'
  departamento?: string
  userIds?: string[]
}

export interface SendPopupResult {
  success: boolean
  informativoId: string
  recipients: number
}

export async function sendPopup(token: string, data: SendPopupData): Promise<SendPopupResult> {
  const res = await fetch(`${API_URL}/backend/v1/popups/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  const result = await res.json()
  if (!res.ok) throw result
  return result as SendPopupResult
}
