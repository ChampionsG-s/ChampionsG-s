'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { RankingTable } from './ranking-table'
import { VerApuestasView } from '@/components/ver/ver-apuestas-view'
import type { PoolMember, Prediction, Result, Match } from '@/types'

type Tab = 'ranking' | 'ver'

interface RankingViewProps {
  poolId: string
  members: (PoolMember & { username: string; avatar_url?: string | null })[]
  predictions: Prediction[]
  results: Result[]
  matches: Match[]
  currentUserId: string
}

export function RankingView({ poolId, members, predictions, results, matches, currentUserId }: RankingViewProps) {
  const [tab, setTab] = useState<Tab>('ranking')

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {([
          ['ranking', '🏆 Ranking'],
          ['ver', '👁 Ver apuestas'],
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

      {tab === 'ranking' ? (
        <RankingTable
          poolId={poolId}
          members={members}
          predictions={predictions}
          results={results}
          matches={matches}
          currentUserId={currentUserId}
        />
      ) : (
        <VerApuestasView
          members={members}
          matches={matches}
          results={results}
          predictions={predictions}
        />
      )}
    </div>
  )
}
