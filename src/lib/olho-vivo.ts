export interface VehiclePosition {
  lat: number
  lng: number
}

const FIXED_LOCATION: VehiclePosition = {
  lat: -23.55052,
  lng: -46.633308,
}

// Placeholder: Olho Vivo API integration point
// const OLHO_VIVO_API_BASE_URL = 'https://api.olhovivo.sptrans.com.br/v2.1/'
// Real implementation will require:
//   1. An API key (token) passed via POST /Login/Autenticar?token={apiKey}
//   2. A cookie-based session returned by the auth call
//   3. A GET /Posicao request that returns all vehicles with their GPS coordinates
//   4. Filter the response by the vehicle prefix (field `p` -> prefixo)

export async function fetchVehiclePosition(prefixo: string): Promise<VehiclePosition> {
  await new Promise((resolve) => setTimeout(resolve, 800))
  // Placeholder: returns fixed São Paulo city center coordinates
  // In production, filter the /Posicao response where vehicle prefix matches `prefixo`
  void prefixo
  return { ...FIXED_LOCATION }
}
