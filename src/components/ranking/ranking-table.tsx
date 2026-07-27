'use client'

import { useMemo, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateBreakdown } from '@/lib/scoring'
import { cn } from '@/lib/utils'
import type { PoolMember, Prediction, Result, Match } from '@/types'

interface RankingTableProps {
  poolId: string
  members: (PoolMember & { username: string })[]
  predictions: Prediction[]
  results: Result[]
  matches: Match[]
  currentUserId: string
}

export function RankingTable({
  poolId,
  members,
  predictions,
  results: initialResults,
  matches,
  currentUserId,
}: RankingTableProps) {
  const supabase = createClient()
  const [results, setResults] = useState(initialResults)

  useEffect(() => {
    const channel = supabase
      .channel(`ranking-${poolId}`)
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

  const ranking = useMemo(() => {
    return members
      .map(member => {
        const userPreds = predictions.filter(p => p.user_id === member.user_id)

        const breakdown = calculateBreakdown(
          userPreds, resultsMap, matches,
          [], [],
          [], []
        )

        return { member, ...breakdown }
      })
      .sort((a, b) => b.total - a.total)
  }, [members, predictions, resultsMap, matches])

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-4">
      <div className="card !p-0 overflow-hidden">
        <h2 className="font-display text-2xl tracking-wide text-gold px-4 pt-4 pb-3">🏆 RANKING</h2>

        {ranking.length === 0 ? (
          <p className="text-muted text-sm px-4 pb-4">Sin jugadores aún.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {ranking.map((entry, i) => {
              const isMe = entry.member.user_id === currentUserId
              const top3 = i < 3
              return (
                <div
                  key={entry.member.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors',
                    isMe && 'bg-gold/[0.06]',
                    top3 && 'bg-gradient-to-r from-gold/[0.04] to-transparent'
                  )}
                >
                  <div className="w-7 text-center flex-shrink-0">
                    {medals[i]
                      ? <span className="text-lg leading-none">{medals[i]}</span>
                      : <span className="text-muted font-bold text-sm">{i + 1}</span>}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-surface-2 border border-border flex items-center justify-center flex-shrink-0">
                    <span className="font-display text-base text-gold leading-none">
                      {entry.member.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm flex items-center gap-1.5 flex-wrap truncate">
                      {entry.member.username}
                      {entry.member.role === 'admin' && <span className="badge badge-admin">ADMIN</span>}
                      {isMe && <span className="text-muted text-xs font-normal">(tú)</span>}
                    </div>
                  </div>
                  <div className="font-display text-2xl text-gold flex-shrink-0">{entry.total}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="font-bold text-sm text-gold mb-3">Sistema de puntos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {[
            ['1pt', 'Signo acertado (1 / X / 2) en partido normal'],
            ['⭐ 3 / 1pts', 'Partido bonus: exacto / solo signo'],
            ['0pts', 'Fallo'],
            ['Cierre', 'Cada jornada se cierra sola al llegar la fecha de su primer partido'],
            ['Ver', 'Las apuestas de una jornada se revelan cuando cierra'],
          ].map(([pts, label]) => (
            <div key={label} className="flex gap-2.5 items-start">
              <span className="font-bold text-gold min-w-[64px] shrink-0">{pts}</span>
              <span className="text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
