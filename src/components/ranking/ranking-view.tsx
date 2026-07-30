'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { RankingTable } from './ranking-table'
import { RankingJornadaView } from './ranking-jornada-view'
import { RankingEquipoView } from './ranking-equipo-view'
import type { PoolMember, Prediction, Result, Match, EquipoRoster, EquipoPlayer } from '@/types'

type Tab = 'total' | 'jornada' | 'equipo'

interface RankingViewProps {
  poolId: string
  members: (PoolMember & { username: string; avatar_url?: string | null })[]
  predictions: Prediction[]
  results: Result[]
  matches: Match[]
  currentUserId: string
  equipoRoster: EquipoRoster[]
  equipoPlayers: EquipoPlayer[]
}

export function RankingView({
  poolId,
  members,
  predictions,
  results,
  matches,
  currentUserId,
  equipoRoster,
  equipoPlayers,
}: RankingViewProps) {
  const [tab, setTab] = useState<Tab>('total')

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {([
          ['total', '🏆 Total'],
          ['jornada', '📅 Por jornada'],
          ['equipo', '👕 Equipo'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-3.5 py-2 rounded-full text-xs font-bold transition-all',
              tab === key ? 'bg-gold text-background' : 'border border-border text-muted hover:border-gold hover:text-gold'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'total' ? (
        <RankingTable
          poolId={poolId}
          members={members}
          predictions={predictions}
          results={results}
          matches={matches}
          currentUserId={currentUserId}
        />
      ) : tab === 'jornada' ? (
        <RankingJornadaView
          members={members}
          matches={matches}
          results={results}
          predictions={predictions}
        />
      ) : (
        <RankingEquipoView
          members={members}
          roster={equipoRoster}
          players={equipoPlayers}
        />
      )}
    </div>
  )
}
