'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ALL_TEAMS } from '@/lib/data/matches'
import { Flag } from '@/components/ui/flag'
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

  useEffect(() => {
    const channel = supabase
      .channel(`grupos-${poolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results', filter: `pool_id=eq.${poolId}` },
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
      <div className="card mb-2">
        <h2 className="font-black text-lg tracking-wide text-gold mb-1">📊 Clasificación</h2>
        <p className="text-xs text-muted">
          Tabla de liga actualizada automáticamente con cada resultado
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] text-muted uppercase tracking-wide border-b border-border">
              <th className="text-left pl-3 py-1.5 w-1/2">Equipo</th>
              <th className="py-1.5" title="Partidos jugados">PJ</th>
              <th className="py-1.5" title="Ganados">G</th>
              <th className="py-1.5" title="Empatados">E</th>
              <th className="py-1.5" title="Perdidos">P</th>
              <th className="py-1.5" title="Goles a favor">GF</th>
              <th className="py-1.5" title="Goles en contra">GC</th>
              <th className="py-1.5" title="Diferencia de goles">DG</th>
              <th className="pr-3 py-1.5" title="Puntos">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, i) => {
              const pos = i + 1
              return (
                <tr key={row.team} className={cn('border-b border-surface-2 last:border-0')}>
                  <td className="pl-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'font-black text-base w-4 text-center',
                        pos === 1 ? 'text-gold' : pos === 2 ? 'text-gray-400' : pos === 3 ? 'text-muted' : 'text-red-900'
                      )}>
                        {pos}
                      </span>
                      <Flag team={row.team} size="sm" />
                      <span className="font-semibold truncate">{row.team}</span>
                    </div>
                  </td>
                  <td className="text-center py-2">{row.played}</td>
                  <td className="text-center py-2">{row.won}</td>
                  <td className="text-center py-2">{row.drawn}</td>
                  <td className="text-center py-2">{row.lost}</td>
                  <td className="text-center py-2">{row.gf}</td>
                  <td className="text-center py-2">{row.gc}</td>
                  <td className="text-center py-2">
                    <span className={cn(
                      row.gd > 0 ? 'text-green-400' : row.gd < 0 ? 'text-red-400' : 'text-muted'
                    )}>
                      {row.gd > 0 ? `+${row.gd}` : row.gd}
                    </span>
                  </td>
                  <td className="text-center pr-3 py-2 font-black text-gold">{row.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
