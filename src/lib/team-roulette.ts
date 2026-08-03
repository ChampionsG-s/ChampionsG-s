import type { Result, TeamRouletteSpin } from '@/types'

// Ruleta de equipos: comparte jornada con la ruleta regalo (ver
// isLastJornadaOfGiftBlock en lib/gift.ts). Un giro asigna un equipo al
// azar (decidido por el servidor, RPC team_roulette_spin) de entre los
// que juegan esa jornada; si ese equipo gana su partido, suma puntos.
export const TEAM_ROULETTE_WIN_BONUS = 1

// True si el equipo asignado en el giro termino ganando su partido. Si el
// partido aun no tiene resultado cargado, no cuenta (ni suma ni resta).
export function teamRouletteSpinWon(spin: TeamRouletteSpin, results: Result[]): boolean {
  const result = results.find(r => r.match_id === spin.match_id)
  if (!result) return false
  return spin.team_side === 'home'
    ? result.home_score > result.away_score
    : result.away_score > result.home_score
}
