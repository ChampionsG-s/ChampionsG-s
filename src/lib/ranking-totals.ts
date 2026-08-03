import { calculateBreakdown } from '@/lib/scoring'
import { quizRankingBonus } from '@/lib/quiz'
import { teamRouletteSpinWon, TEAM_ROULETTE_WIN_BONUS } from '@/lib/team-roulette'
import type { Prediction, Result, Match, GiftSpin, Duel, QuizResponse, TeamRouletteSpin } from '@/types'

export interface MemberTotal {
  user_id: string
  username: string
  avatar_url?: string | null
  total: number
}

// Misma logica de puntaje que usa RankingTable (predicciones + bonus de la
// ruleta regalo + bonus/malus de duelos), extraida aca para poder mostrar
// "quien tiene cuantos puntos" tambien fuera de la pantalla de Ranking
// (p.ej. en la ventana de retos de /jornadas) sin duplicar el calculo.
export function computeMemberTotals(
  members: { user_id: string; username: string; avatar_url?: string | null }[],
  predictions: Prediction[],
  results: Result[],
  matches: Match[],
  giftSpins: GiftSpin[],
  duels: Duel[],
  quizResponses: QuizResponse[] = [],
  teamRouletteSpins: TeamRouletteSpin[] = []
): MemberTotal[] {
  const resultsMap = new Map(results.map(r => [r.match_id, r]))

  const giftBonusByUser = new Map<string, number>()
  for (const spin of giftSpins) {
    giftBonusByUser.set(spin.user_id, (giftBonusByUser.get(spin.user_id) ?? 0) + spin.delta)
  }

  const duelBonusByUser = new Map<string, number>()
  for (const duel of duels) {
    if (duel.status !== 'resolved' || !duel.winner_id) continue
    const loserId = duel.winner_id === duel.challenger_id ? duel.opponent_id : duel.challenger_id
    duelBonusByUser.set(duel.winner_id, (duelBonusByUser.get(duel.winner_id) ?? 0) + 2)
    duelBonusByUser.set(loserId, (duelBonusByUser.get(loserId) ?? 0) - 2)
  }

  const quizCorrectByUser = new Map<string, number>()
  for (const response of quizResponses) {
    if (!response.is_correct) continue
    quizCorrectByUser.set(response.user_id, (quizCorrectByUser.get(response.user_id) ?? 0) + 1)
  }

  const teamRouletteBonusByUser = new Map<string, number>()
  for (const spin of teamRouletteSpins) {
    if (!teamRouletteSpinWon(spin, results)) continue
    teamRouletteBonusByUser.set(spin.user_id, (teamRouletteBonusByUser.get(spin.user_id) ?? 0) + TEAM_ROULETTE_WIN_BONUS)
  }

  return members
    .map(member => {
      const userPreds = predictions.filter(p => p.user_id === member.user_id)
      const breakdown = calculateBreakdown(userPreds, resultsMap, matches, [], [], [], [])
      const giftBonus = giftBonusByUser.get(member.user_id) ?? 0
      const duelBonus = duelBonusByUser.get(member.user_id) ?? 0
      const quizBonus = quizRankingBonus(quizCorrectByUser.get(member.user_id) ?? 0)
      const teamRouletteBonus = teamRouletteBonusByUser.get(member.user_id) ?? 0
      return { ...member, total: breakdown.total + giftBonus + duelBonus + quizBonus + teamRouletteBonus }
    })
    .sort((a, b) => b.total - a.total)
}
