// Formas minimas de la respuesta publica (no oficial) de la API de Biwenger
// para LaLiga. Solo se tipan los campos que realmente usamos.

export interface BiwengerPlayer {
  id: number
  name: string
  slug: string
  teamID: number
  position: number
  price: number
  status?: string
  iconHero?: string
  points: number
}

export interface BiwengerTeam {
  id: number
  name: string
  slug: string
}

export interface BiwengerCompetitionData {
  players: Record<string, BiwengerPlayer>
  teams: Record<string, BiwengerTeam>
}
