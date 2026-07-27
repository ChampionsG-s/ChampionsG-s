'use client'

import { useMemo, useState } from 'react'
import { scoreMatch, signFromScores } from '@/lib/scoring'
import { allJornadaLabels, jornadaLabelForMatch, isJornadaOpen } from '@/lib/jornada'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Flag } from '@/components/ui/flag'
import type { PoolMember, Match, Result, Prediction } from '@/types'

interface RankingJornadaViewProps {
  members: (PoolMember & { username: string; avatar_url?: string | null })[]
  matches: Match[]
  results: Result[]
  predictions: Prediction[]
}

const medals = ['🥇', '🥈', '🥉']

export function RankingJornadaView({ members, matches, results, predictions }: RankingJornadaViewProps) {
  const jornadas = useMemo(() => allJornadaLabels(matches), [matches])
  const [selected, setSelected] = useState(jornadas[0] ?? '')

  const currentJornada = selected || jornadas[0] || ''
  // Las apuestas de una jornada solo se revelan una vez que ha cerrado
  // (isJornadaOpen === false), la misma regla que cierra las predicciones.
  const revealed = currentJornada ? !isJornadaOpen(matches, currentJornada) : false

  const resultsMap = useMemo(() => new Map(results.map(r => [r.match_id, r])), [results])
  const jornadaMatches = useMemo(
    () => matches.filter(m => jornadaLabelForMatch(m, matches) === currentJornada),
    [matches, currentJornada]
  )

  const ranking = useMemo(() => {
    return members
      .map(member => {
        const memberPreds = predictions.filter(
          p => p.user_id === member.user_id && jornadaMatches.some(m => m.id === p.match_id)
        )
        const total = memberPreds.reduce((sum, p) => {
          const match = jornadaMatches.find(m => m.id === p.match_id)
          const result = resultsMap.get(p.match_id)
          return sum + (match && result ? scoreMatch(p, result, match) : 0)
        }, 0)
        return { member, total }
      })
      .sort((a, b) => b.total - a.total)
  }, [members, predictions, jornadaMatches, resultsMap])

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 py-0.5 snap-x scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {jornadas.map(label => {
          const isOpen = isJornadaOpen(matches, label)
          const num = label.match(/^Jornada (\d+)$/)?.[1] ?? label
          const active = currentJornada === label
          return (
            <button
              key={label}
              onClick={() => setSelected(label)}
              className={cn(
                'snap-start flex-shrink-0 px-3.5 py-2 rounded-full text-xs font-bold transition-all',
                active
                  ? 'bg-gradient-to-b from-gold-2 to-gold text-background shadow-md shadow-gold/20'
                  : isOpen
                    ? 'border border-border text-muted hover:border-gold hover:text-gold'
                    : 'border border-border text-border cursor-not-allowed opacity-50'
              )}
            >
              {num} {!isOpen && '🔒'}
            </button>
          )
        })}
      </div>

      {!revealed ? (
        <div className="card border-red-900 text-center py-8">
          <p className="font-bold text-red-300 mb-1">🔒 Aún no se puede ver</p>
          <p className="text-sm text-muted">Las apuestas de esta jornada se revelan cuando llega su fecha límite.</p>
        </div>
      ) : members.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted text-sm">Aún no hay jugadores en esta quiniela.</p>
        </div>
      ) : jornadaMatches.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted text-sm">Sin partidos en esta jornada.</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left align-bottom border-b border-border">
                  Jugador
                </th>
                {jornadaMatches.map(match => {
                  const result = resultsMap.get(match.id)
                  const displayHome = match.home_team || match.home || '?'
                  const displayAway = match.away_team || match.away || '?'
                  return (
                    <th key={match.id} className="px-1.5 py-2 align-bottom border-b border-border min-w-[52px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <Flag team={displayHome} size="sm" />
                        <span className="text-[9px] text-muted font-bold leading-none">vs</span>
                        <Flag team={displayAway} size="sm" />
                        {result ? (
                          <span className="mt-0.5 font-black text-[10px] text-gold whitespace-nowrap">
                            {result.home_score}–{result.away_score}
                          </span>
                        ) : (
                          <span className="mt-0.5 text-[10px] text-muted">—</span>
                        )}
                        {match.is_bonus && <span className="text-[9px] leading-none">⭐</span>}
                      </div>
                    </th>
                  )
                })}
                <th className="px-3 py-2 text-right align-bottom border-b border-border">Total</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(({ member, total }, i) => (
                <tr key={member.id} className={cn(i % 2 === 1 && 'bg-background/40')}>
                  <td className="px-3 py-2 border-b border-border/60">
                    <div className="flex items-center gap-2 min-w-[140px] whitespace-nowrap">
                      <span className="w-5 text-center flex-shrink-0">
                        {medals[i] ? <span className="text-sm leading-none">{medals[i]}</span> : <span className="text-muted font-bold text-[11px]">{i + 1}</span>}
                      </span>
                      <Avatar username={member.username} avatarUrl={member.avatar_url} size="sm" />
                      <span className="font-bold text-xs flex items-center gap-1 flex-wrap">
                        {member.username}
                        {member.role === 'admin' && <span className="badge badge-admin">ADMIN</span>}
                      </span>
                    </div>
                  </td>
                  {jornadaMatches.map(match => {
                    const prediction = predictions.find(p => p.user_id === member.user_id && p.match_id === match.id)
                    const result = resultsMap.get(match.id)
                    const pts = prediction && result ? scoreMatch(prediction, result, match) : null
                    const ptsExactValue = match.pts_exact ?? 3
                    const isFullHit = pts !== null && (match.is_bonus ? pts === ptsExactValue : pts > 0)

                    return (
                      <td key={match.id} className="px-1.5 py-2 text-center border-b border-border/60">
                        {!prediction ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span
                            className={cn(
                              'inline-flex items-center justify-center rounded-full px-2 py-0.5 font-bold text-[11px] min-w-[28px]',
                              pts === null
                                ? 'text-muted'
                                : isFullHit
                                  ? 'bg-green-900 text-green-300'
                                  : pts > 0
                                    ? 'bg-amber-900 text-amber-300'
                                    : 'bg-red-900 text-red-300'
                            )}
                          >
                            {match.is_bonus
                              ? `${prediction.home_score}–${prediction.away_score}`
                              : signFromScores(prediction.home_score, prediction.away_score)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-right border-b border-border/60">
                    <span className="font-display text-base text-gold">{total}pts</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
