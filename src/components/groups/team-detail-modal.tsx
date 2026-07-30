'use client'

import { X } from 'lucide-react'
import { Flag } from '@/components/ui/flag'
import { cn } from '@/lib/utils'
import type { Match, Result } from '@/types'

interface TeamDetailModalProps {
  team: string | null
  matches: Match[]
  resultsMap: Map<string, Result>
  onClose: () => void
}

export function TeamDetailModal({ team, matches, resultsMap, onClose }: TeamDetailModalProps) {
  if (!team) return null

  const teamMatches = matches
    .filter(m => (m.home_team || m.home) === team || (m.away_team || m.away) === team)
    .map(m => {
      const isHome = (m.home_team || m.home) === team
      const opponent = (isHome ? (m.away_team || m.away) : (m.home_team || m.home)) ?? '?'
      const result = resultsMap.get(m.id)
      return { match: m, isHome, opponent, result }
    })
    .sort((a, b) => (a.match.jornada ?? 0) - (b.match.jornada ?? 0))

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-gold/30 bg-[linear-gradient(155deg,rgba(29,47,83,0.55),rgba(10,15,30,0.98)_45%,rgba(7,11,22,0.99)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 backdrop-blur-md px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Flag team={team} size="lg" />
            <h3 className="font-display text-xl tracking-wide text-cream truncate">{team}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-gold/80 mb-1">
            Resultados por jornada
          </h4>

          {teamMatches.length === 0 && (
            <p className="text-sm text-muted">Todavía no hay partidos programados para este equipo.</p>
          )}

          {teamMatches.map(({ match, isHome, opponent, result }) => {
            const jornadaLabel = match.jornada ? `Jornada ${match.jornada}` : '—'
            const homeTeam = isHome ? team : opponent
            const awayTeam = isHome ? opponent : team
            const gf = result ? (isHome ? result.home_score : result.away_score) : null
            const gc = result ? (isHome ? result.away_score : result.home_score) : null
            const outcome = gf === null || gc === null ? null : gf > gc ? 'win' : gf < gc ? 'loss' : 'draw'

            return (
              <div
                key={match.id}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
              >
                <span className="text-[11px] text-muted w-[60px] flex-shrink-0">{jornadaLabel}</span>
                <div className="flex-1 flex items-center justify-center gap-2.5 min-w-0">
                  <Flag team={homeTeam} size="sm" />
                  <span className="text-[10px] text-muted font-bold flex-shrink-0">vs</span>
                  <Flag team={awayTeam} size="sm" />
                </div>
                {result ? (
                  <>
                    <span className="font-display text-base text-cream tracking-widest flex-shrink-0">
                      {result!.home_score}-{result!.away_score}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0',
                        outcome === 'win' && 'bg-green-500/20 text-green-300',
                        outcome === 'draw' && 'bg-slate-500/20 text-slate-300',
                        outcome === 'loss' && 'bg-red-500/20 text-red-300'
                      )}
                    >
                      {outcome === 'win' ? 'G' : outcome === 'draw' ? 'E' : 'P'}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-muted flex-shrink-0">Pendiente</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
