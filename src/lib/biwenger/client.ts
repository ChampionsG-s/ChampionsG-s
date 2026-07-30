import type { BiwengerCompetitionData } from './types'

// Endpoint publico (no oficial, sin autenticacion) verificado en vivo.
// Aislado en este modulo para poder sustituirlo si Biwenger deja de
// funcionar o cambia de forma.
const LALIGA_DATA_URL = 'https://cf.biwenger.com/api/v2/competitions/la-liga/data?lang=es&score=2'

export async function fetchLaLigaData(): Promise<BiwengerCompetitionData> {
  const res = await fetch(LALIGA_DATA_URL, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Biwenger API respondio ${res.status}`)
  }
  const json = await res.json() as { status: number; data: BiwengerCompetitionData }
  return json.data
}
