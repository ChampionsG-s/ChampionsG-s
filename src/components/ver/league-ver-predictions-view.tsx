'use client'

import { useState } from 'react'
import { scoreMatch, signFromScores } from '@/lib/scoring'
import { allJornadaLabels, jornadaLabelForMatch, isJornadaOpen } from '@/lib/jornada'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { Flag } from '@/components/ui/flag'
import type { PoolMember, Match, Result, Prediction, PoolMatchTeams } from '@/types'

interface LeagueVerPredictionsViewProps {
  currentUserId: string
  members: (PoolMember & { username: string })[]
  matches: Match[]
  results: Result[]
  predictions: Prediction[]
  matchTeams: PoolMatchTeams[]
}

export function LeagueVerPredictionsView({
  currentUserId,
  members,
  matches,
  results,
  predictions,
  matchTeams,
}: LeagueVerPredictionsViewProps) {
  // Las apuestas de una jornada solo se revelan a los demás una vez que ha
  // pasado su fecha límite — la misma regla que cierra las predicciones.
  const closedJornadas = allJornadaLabels(matches).filter(label => !isJornadaOpen(matches, label))

  if (closedJornadas.length === 0) {
    return (
      <div className="card border-red-900">
        <h2 className="font-black text-lg text-red-300 mb-2">🔒 Aún no hay nada que ver</h2>
        <p className="text-sm text-muted">Las apuestas de una jornada se revelan cuando llega su fecha límite.</p>
      </div>
    )
  }

  const others = members.filter(member => member.user_id !== currentUserId)

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-black text-lg tracking-wide text-gold mb-1">👁 Apuestas de la jornada</h2>
        <p className="text-xs text-muted">Se muestran las jornadas cuya fecha límite ya ha pasado.</p>
      </div>

      {others.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted text-sm">Aún no hay más jugadores en esta quiniela.</p>
        </div>
      ) : (
        others.map(member => (
          <UserPredictionsCard
            key={member.id}
            member={member}
            matches={matches}
            results={results}
            predictions={predictions.filter(prediction => prediction.user_id === member.user_id)}
            matchTeams={matchTeams}
            visibleJornadas={closedJornadas}
          />
        ))
      )}
    </div>
  )
}

interface UserPredictionsCardProps {
  member: PoolMember & { username: string }
  matches: Match[]
  results: Result[]
  predictions: Prediction[]
  matchTeams: PoolMatchTeams[]
  visibleJornadas: string[]
}

function UserPredictionsCard({ member, matches, results, predictions, matchTeams, visibleJornadas }: UserPredictionsCardProps) {
  const [open, setOpen] = useState(false)
  const resultsMap = new Map(results.map(result => [result.match_id, result]))
  const matchTeamsMap = new Map(matchTeams.map(item => [item.match_id, item]))
  const jornadaLabel = (match: Match) => jornadaLabelForMatch(match, matches)

  const jornadas = visibleJornadas

  const total = predictions.reduce((sum, prediction) => {
    const match = matches.find(item => item.id === prediction.match_id)
    const result = resultsMap.get(prediction.match_id)
    return sum + (match && result ? scoreMatch(prediction, result, match) : 0)
  }, 0)

  return (
    <div className="card">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2">
        <span className="font-bold text-sm flex-1 text-left flex items-center gap-1.5">
          {member.username}
          {member.role === 'admin' && <span className="badge badge-admin">ADMIN</span>}
        </span>
        <span className="font-black text-xl text-gold">{total}pts</span>
        <ChevronDown size={16} className={cn('text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {jornadas.map(label => {
            const jornadaMatches = matches.filter(match => jornadaLabel(match) === label)
            const jornadaPredictions = jornadaMatches.filter(match => predictions.some(prediction => prediction.match_id === match.id))

            if (jornadaPredictions.length === 0) return null

            return (
              <div key={label} className="border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2.5 bg-surface-2 text-xs font-bold flex items-center justify-between">
                  <span>{label}</span>
                  <span className="text-gold">
                    {jornadaPredictions.reduce((sum, match) => {
                      const prediction = predictions.find(item => item.match_id === match.id)
                      const result = resultsMap.get(match.id)
                      return sum + (prediction && result ? scoreMatch(prediction, result, match) : 0)
                    }, 0)}pts
                  </span>
                </div>
                <div className="p-2 space-y-1.5">
                  {jornadaPredictions.map(match => {
                    const prediction = predictions.find(item => item.match_id === match.id)!
                    const result = resultsMap.get(match.id)
                    const pts = result ? scoreMatch(prediction, result, match) : null
                    const realTeams = matchTeamsMap.get(match.id)
                    const displayHome = realTeams?.real_home || match.home_team || match.home || '?'
                    const displayAway = realTeams?.real_away || match.away_team || match.away || '?'
                    const ptsExactValue = match.pts_exact ?? 3
                    const isFullHit = pts !== null && (match.is_bonus ? pts === ptsExactValue : pts > 0)

                    return (
                      <div key={match.id} className="bg-background border border-border rounded-lg px-2.5 py-2">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Flag team={displayHome} size="sm" />
                            <span className="truncate">{displayHome}</span>
                          </div>
                          <div className="flex flex-col items-center gap-0.5 min-w-[70px]">
                            {result && <span className="font-black text-sm text-gold">{result.home_score}–{result.away_score}</span>}
                            <span className="font-bold text-muted">
                              {match.is_bonus
                                ? `${prediction.home_score}–${prediction.away_score}`
                                : signFromScores(prediction.home_score, prediction.away_score)}
                            </span>
                            {pts !== null && (
                              <span className={cn(
                                'text-[10px] font-bold px-1.5 rounded-full',
                                isFullHit ? 'bg-green-900 text-green-300' : pts > 0 ? 'bg-amber-900 text-amber-300' : 'bg-red-900 text-red-300'
                              )}>
                                {pts}pts
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-row-reverse">
                            <Flag team={displayAway} size="sm" />
                            <span className="truncate text-right">{displayAway}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}