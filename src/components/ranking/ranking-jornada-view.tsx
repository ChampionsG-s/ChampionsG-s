'use client'

import { useMemo, useState } from 'react'
import { scoreMatch, signFromScores } from '@/lib/scoring'
import { allJornadaLabels, jornadaLabelForMatch, isJornadaOpen } from '@/lib/jornada'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Flag } from '@/components/ui/flag'
import { ChevronDown } from 'lucide-react'
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
              onClick={() => { setSelected(label); setExpandedId(null) }}
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
      ) : (
        <div className="space-y-2.5">
          {ranking.map(({ member, total }, i) => {
            const isExpanded = expandedId === member.id

            return (
              <div key={member.id} className="card !p-0 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : member.id)}
                  className="w-full flex items-center gap-3 px-4 py-3"
                >
                  <span className="w-5 text-center flex-shrink-0">
                    {medals[i] ? <span className="text-base leading-none">{medals[i]}</span> : <span className="text-muted font-bold text-xs">{i + 1}</span>}
                  </span>
                  <Avatar username={member.username} avatarUrl={member.avatar_url} size="md" />
                  <span className="font-bold text-sm flex-1 text-left flex items-center gap-1.5 flex-wrap">
                    {member.username}
                    {member.role === 'admin' && <span className="badge badge-admin">ADMIN</span>}
                  </span>
                  <span className="font-display text-xl text-gold">{total}pts</span>
                  <ChevronDown size={16} className={cn('text-muted transition-transform flex-shrink-0', isExpanded && 'rotate-180')} />
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-3 border-t border-border space-y-1.5">
                    {jornadaMatches.length === 0 ? (
                      <p className="text-xs text-muted text-center py-2">Sin partidos en esta jornada.</p>
                    ) : (
                      jornadaMatches.map(match => {
                        const prediction = predictions.find(p => p.user_id === member.user_id && p.match_id === match.id)
                        const result = resultsMap.get(match.id)
                        const pts = prediction && result ? scoreMatch(prediction, result, match) : null
                        const ptsExactValue = match.pts_exact ?? 3
                        const isFullHit = pts !== null && (match.is_bonus ? pts === ptsExactValue : pts > 0)
                        const displayHome = match.home_team || match.home || '?'
                        const displayAway = match.away_team || match.away || '?'

                        return (
                          <div key={match.id} className="bg-background border border-border rounded-lg px-2.5 py-2">
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                <Flag team={displayHome} size="sm" />
                                <span className="truncate">{displayHome}</span>
                              </div>
                              <div className="flex flex-col items-center gap-0.5 min-w-[70px]">
                                {result && (
                                  <span className="font-black text-sm text-gold">
                                    {result.home_score}–{result.away_score}
                                  </span>
                                )}
                                <span className="font-bold text-muted">
                                  {!prediction
                                    ? '—'
                                    : match.is_bonus
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
                              <div className="flex items-center gap-1.5 flex-row-reverse overflow-hidden">
                                <Flag team={displayAway} size="sm" />
                                <span className="truncate text-right">{displayAway}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
