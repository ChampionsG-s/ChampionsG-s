'use client'

import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ALL_TEAMS } from '@/lib/data/matches'
import { Flag } from '@/components/ui/flag'
import { TeamDetailModal } from '@/components/groups/team-detail-modal'
import { cn } from '@/lib/utils'
import type { Match, Result } from '@/types'

interface GroupStandingsProps {
  poolId: string
  matches: Match[]
  results: Result[]
}

interface StandingRow {
  team: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  gc: number
  gd: number
  points: number
}

function calcStandings(_groupKey: string, groupMatches: Match[], resultsMap: Map<string, Result>): StandingRow[] {
  const teams = ALL_TEAMS
  const table = new Map<string, StandingRow>()
  teams.forEach(t => table.set(t, { team: t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, gc: 0, gd: 0, points: 0 }))

  groupMatches.forEach(m => {
    const r = resultsMap.get(m.id)
    if (!r) return

    const homeTeam = m.home_team || m.home
    const awayTeam = m.away_team || m.away
    if (!homeTeam || !awayTeam) return

    const home = table.get(homeTeam)
    const away = table.get(awayTeam)
    if (!home || !away) return

    home.played++; away.played++
    home.gf += r.home_score; home.gc += r.away_score
    away.gf += r.away_score; away.gc += r.home_score

    if (r.home_score > r.away_score) {
      home.won++; home.points += 3
      away.lost++
    } else if (r.home_score < r.away_score) {
      away.won++; away.points += 3
      home.lost++
    } else {
      home.drawn++; home.points++
      away.drawn++; away.points++
    }
  })

  return Array.from(table.values())
    .map(row => ({ ...row, gd: row.gf - row.gc }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team))
}

export function GroupStandings({ poolId, matches, results: initialResults }: GroupStandingsProps) {
  const supabase = createClient()
  const [results, setResults] = useState(initialResults)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel(`grupos-${poolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' },
        (payload) => {
          setResults(prev => {
            const filtered = prev.filter(r => r.id !== (payload.new as Result)?.id)
            return payload.eventType === 'DELETE' ? filtered : [...filtered, payload.new as Result]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, poolId])

  const resultsMap = useMemo(() => new Map(results.map(r => [r.match_id, r])), [results])

  const standings = useMemo(() => calcStandings('league', matches, resultsMap), [matches, resultsMap])

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-gold/45 bg-[linear-gradient(160deg,rgba(212,160,23,0.16),rgba(10,14,24,0.94)_42%,rgba(7,11,22,0.96)_100%)] px-4 py-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(255,255,255,0.16),transparent_40%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/75 to-transparent" />
        <h2 className="flex w-full items-center justify-center leading-none">
          <Image
            src="/logos/laliga-logo-trimmed.png"
            alt="LaLiga"
            width={465}
            height={110}
            className="h-14 sm:h-20 w-auto object-contain"
            unoptimized
          />
        </h2>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-[linear-gradient(155deg,rgba(29,47,83,0.40),rgba(10,15,30,0.95)_45%,rgba(7,11,22,0.95)_100%)] shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(255,255,255,0.10),transparent_36%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[320px] sm:min-w-[420px]">
          <thead>
            <tr className="text-[10px] text-gold/80 uppercase tracking-wide border-b border-white/10 bg-black/25">
              <th className="text-left pl-2 sm:pl-3 py-2 w-1/2">Equipo</th>
              <th className="py-1.5 px-0.5" title="Partidos jugados">PJ</th>
              <th className="py-1.5 px-0.5" title="Ganados">G</th>
              <th className="py-1.5 px-0.5" title="Empatados">E</th>
              <th className="py-1.5 px-0.5" title="Perdidos">P</th>
              <th className="py-1.5 px-0.5" title="Goles a favor">GF</th>
              <th className="py-1.5 px-0.5" title="Goles en contra">GC</th>
              <th className="py-1.5 px-0.5" title="Diferencia de goles">DG</th>
              <th className="pr-2 sm:pr-3 py-2 px-0.5" title="Puntos">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const pos = i + 1
              const totalTeams = standings.length
              const isFirst = pos === 1
              const isChampions = pos >= 2 && pos <= 4
              const isEuropa = pos === 5
              const isConference = pos === 6
              const isRelegation = pos > totalTeams - 3
              const isHighlighted = isFirst || isChampions || isEuropa || isConference || isRelegation

              const rowAccentClass = isFirst
                ? 'bg-[linear-gradient(90deg,rgba(212,160,23,0.09),rgba(212,160,23,0.02))]'
                : isChampions
                  ? 'bg-[linear-gradient(90deg,rgba(59,130,246,0.08),rgba(59,130,246,0.02))]'
                  : isEuropa
                    ? 'bg-[linear-gradient(90deg,rgba(249,115,22,0.10),rgba(249,115,22,0.03))]'
                    : isConference
                      ? 'bg-[linear-gradient(90deg,rgba(34,197,94,0.08),rgba(34,197,94,0.02))]'
                      : isRelegation
                        ? 'bg-[linear-gradient(90deg,rgba(239,68,68,0.12),rgba(239,68,68,0.03))]'
                        : 'bg-black/10'

              return (
                <tr
                  key={row.team}
                  onClick={() => setSelectedTeam(row.team)}
                  className={cn(
                    'border-b border-white/10 last:border-0 cursor-pointer hover:bg-white/5 transition-colors',
                    rowAccentClass
                  )}
                >
                  <td className="pl-2 sm:pl-3 py-2.5">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="font-black text-base w-4 text-center text-cream flex-shrink-0">
                        {pos}
                      </span>
                      <Flag team={row.team} size="md" className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)] flex-shrink-0" />
                      <span className={cn('font-semibold truncate', isHighlighted && 'text-cream')}>{row.team}</span>
                    </div>
                  </td>
                  <td className="text-center py-2.5 px-0.5 text-cream/90">{row.played}</td>
                  <td className="text-center py-2.5 px-0.5 text-cream/90">{row.won}</td>
                  <td className="text-center py-2.5 px-0.5 text-cream/90">{row.drawn}</td>
                  <td className="text-center py-2.5 px-0.5 text-cream/90">{row.lost}</td>
                  <td className="text-center py-2.5 px-0.5 text-cream/90">{row.gf}</td>
                  <td className="text-center py-2.5 px-0.5 text-cream/90">{row.gc}</td>
                  <td className="text-center py-2.5 px-0.5 text-cream/90">
                    {row.gd > 0 ? `+${row.gd}` : row.gd}
                  </td>
                  <td className="text-center pr-2 sm:pr-3 py-2.5 px-0.5 font-black text-cream">
                    {row.points}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </div>

      <TeamDetailModal
        team={selectedTeam}
        matches={matches}
        resultsMap={resultsMap}
        onClose={() => setSelectedTeam(null)}
      />
    </div>
  )
}
