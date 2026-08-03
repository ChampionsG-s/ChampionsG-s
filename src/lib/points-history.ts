import { JORNADAS } from '@/lib/data/matches'
import { jornadaLabelForMatch } from '@/lib/jornada'
import { scoreMatch } from '@/lib/scoring'
import { isLastJornadaOfGiftBlock, giftBlockForJornadaNumber } from '@/lib/gift'
import { isFirstJornadaOfQuizBlock, quizBlockForJornadaNumber, quizRankingBonus } from '@/lib/quiz'
import { teamRouletteSpinWon, TEAM_ROULETTE_WIN_BONUS } from '@/lib/team-roulette'
import type { Prediction, Result, Match, GiftSpin, Duel, QuizResponse, TeamRouletteSpin } from '@/types'

export interface GameHistoryEntry {
  icon: string
  label: string
  points: number
}

export interface JornadaHistoryEntry {
  label: string
  number: number
  matchPoints: number
  games: GameHistoryEntry[]
}

export interface DuelHistoryEntry {
  opponentUsername: string
  won: boolean
  points: number
  resolvedAt: string | null
}

export interface UserPointsHistory {
  jornadas: JornadaHistoryEntry[]
  duels: DuelHistoryEntry[]
}

interface BuildHistoryInput {
  predictions: Prediction[]
  results: Result[]
  matches: Match[]
  giftSpins: GiftSpin[]
  duels: Duel[]
  quizResponses: QuizResponse[]
  teamRouletteSpins: TeamRouletteSpin[]
  usernameByUserId: Map<string, string>
}

// Arma el "por que tengo estos puntos" de un usuario: predicciones agrupadas
// por jornada, mas cualquier mini-juego que le haya tocado esa misma
// jornada (quiz/ruleta regalo/ruleta de equipos comparten el concepto de
// bloque de 3 jornadas, ver lib/gift.ts y lib/quiz.ts), y los duelos aparte
// porque no estan atados a ninguna jornada concreta.
export function buildUserPointsHistory(userId: string, input: BuildHistoryInput): UserPointsHistory {
  const { predictions, results, matches, giftSpins, duels, quizResponses, teamRouletteSpins, usernameByUserId } = input
  const resultsMap = new Map(results.map(r => [r.match_id, r]))
  const userPreds = predictions.filter(p => p.user_id === userId)

  // El bonus del quiz se otorga cada QUIZ_CORRECT_ANSWERS_PER_BONUS aciertos
  // acumulados (ver quizRankingBonus): para mostrar "cuanto gano en ESTE
  // acierto" hay que procesar los aciertos del usuario en orden de bloque y
  // quedarse con el delta marginal de cada uno, no el bonus total.
  const userQuizResponses = quizResponses
    .filter(r => r.user_id === userId)
    .sort((a, b) => a.block_number - b.block_number)
  const quizBonusByBlock = new Map<number, number>()
  let runningCorrect = 0
  for (const response of userQuizResponses) {
    if (!response.is_correct) {
      quizBonusByBlock.set(response.block_number, 0)
      continue
    }
    const before = quizRankingBonus(runningCorrect)
    runningCorrect += 1
    const after = quizRankingBonus(runningCorrect)
    quizBonusByBlock.set(response.block_number, after - before)
  }

  const jornadas: JornadaHistoryEntry[] = []

  JORNADAS.forEach((label, i) => {
    const jornadaNumber = i + 1
    const jornadaMatches = matches.filter(m => jornadaLabelForMatch(m, matches) === label)
    if (jornadaMatches.length === 0) return

    const matchPoints = jornadaMatches.reduce((sum, m) => {
      const pred = userPreds.find(p => p.match_id === m.id)
      const result = resultsMap.get(m.id)
      return pred && result ? sum + scoreMatch(pred, result, m) : sum
    }, 0)

    const games: GameHistoryEntry[] = []

    if (isFirstJornadaOfQuizBlock(jornadaNumber)) {
      const block = quizBlockForJornadaNumber(jornadaNumber)
      const response = userQuizResponses.find(r => r.block_number === block)
      if (response) {
        games.push({
          icon: '🧠',
          label: response.is_correct ? 'Quiz (acierto)' : 'Quiz (fallo)',
          points: quizBonusByBlock.get(block) ?? 0,
        })
      }
    }

    if (isLastJornadaOfGiftBlock(jornadaNumber)) {
      const block = giftBlockForJornadaNumber(jornadaNumber)
      const spin = giftSpins.find(g => g.user_id === userId && g.block_number === block)
      if (spin) {
        games.push({ icon: '🎁', label: 'Ruleta regalo', points: spin.delta })
      }

      const teamSpin = teamRouletteSpins.find(s => s.user_id === userId && s.jornada_number === jornadaNumber)
      if (teamSpin) {
        const won = teamRouletteSpinWon(teamSpin, results)
        games.push({
          icon: '🔀',
          label: `Ruleta de equipos (${teamSpin.team_name})`,
          points: won ? TEAM_ROULETTE_WIN_BONUS : 0,
        })
      }
    }

    const hasPredictions = jornadaMatches.some(m => userPreds.some(p => p.match_id === m.id))
    if (hasPredictions || games.length > 0) {
      jornadas.push({ label, number: jornadaNumber, matchPoints, games })
    }
  })

  const duelEntries: DuelHistoryEntry[] = duels
    .filter(d => d.status === 'resolved' && d.winner_id && (d.challenger_id === userId || d.opponent_id === userId))
    .map(d => {
      const won = d.winner_id === userId
      const opponentId = d.challenger_id === userId ? d.opponent_id : d.challenger_id
      return {
        opponentUsername: usernameByUserId.get(opponentId) ?? 'Desconocido',
        won,
        points: won ? 2 : -2,
        resolvedAt: d.resolved_at,
      }
    })
    .sort((a, b) => new Date(b.resolvedAt ?? 0).getTime() - new Date(a.resolvedAt ?? 0).getTime())

  return { jornadas, duels: duelEntries }
}
