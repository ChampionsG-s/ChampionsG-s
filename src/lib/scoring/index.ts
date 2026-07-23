import type { Prediction, Result, Match, AwardPrediction, AwardResult, SpainPrediction, SpainResult, ScoreBreakdown } from '@/types'
import { AWARDS, SPAIN_FIELDS } from '@/lib/data/matches'

export function scoreMatch(
  pred: Pick<Prediction, 'home_score' | 'away_score'> | null | undefined,
  result: Pick<Result, 'home_score' | 'away_score'> | null | undefined,
  match?: Partial<{ pts_exact: number; pts_winner: number }> | null
): number {
  if (!pred || !result) return 0

  const { home_score: ph, away_score: pa } = pred
  const { home_score: rh, away_score: ra } = result
  
  // Use provided values or defaults (3 for exact, 1 for winner)
  const ptsExact = match?.pts_exact ?? 3
  const ptsWinner = match?.pts_winner ?? 1

  if (ph === rh && pa === ra) return ptsExact
  if (Math.sign(ph - pa) === Math.sign(rh - ra)) return ptsWinner
  return 0
}

export function scoreAwards(
  predictions: AwardPrediction[],
  results: AwardResult[]
): number {
  let total = 0
  const resultsMap = new Map(results.map(r => [r.award_id, r.value]))

  for (const pred of predictions) {
    const official = resultsMap.get(pred.award_id)
    if (!official) continue
    const award = AWARDS.find(a => a.id === pred.award_id)
    if (!award) continue
    if (pred.value.trim().toLowerCase() === official.trim().toLowerCase()) {
      total += award.pts
    }
  }
  return total
}

export function scoreSpain(
  predictions: SpainPrediction[],
  results: SpainResult[]
): number {
  let total = 0
  const resultsMap = new Map(results.map(r => [r.field_id, r.value]))

  for (const pred of predictions) {
    const official = resultsMap.get(pred.field_id)
    if (!official) continue
    const field = SPAIN_FIELDS.find(f => f.id === pred.field_id)
    if (!field) continue
    if (pred.value.toString().trim().toLowerCase() === official.toString().trim().toLowerCase()) {
      total += field.pts
    }
  }
  return total
}

export function calculateBreakdown(
  matchPredictions: Prediction[],
  results: Map<string, Result>,
  matches: Match[],
  awardPredictions: AwardPrediction[],
  awardResults: AwardResult[],
  spainPredictions: SpainPrediction[],
  spainResults: SpainResult[]
): ScoreBreakdown {
  let matchPoints = 0

  for (const pred of matchPredictions) {
    const result = results.get(pred.match_id)
    const match = matches.find(m => m.id === pred.match_id)
    if (result && match) {
      matchPoints += scoreMatch(pred, result, match)
    }
  }

  const awardPoints = scoreAwards(awardPredictions, awardResults)
  const spainPoints = scoreSpain(spainPredictions, spainResults)

  return {
    matchPoints,
    awardPoints,
    spainPoints,
    total: matchPoints + awardPoints + spainPoints,
  }
}
