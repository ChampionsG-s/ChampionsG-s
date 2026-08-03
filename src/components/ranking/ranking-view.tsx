'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { RankingTable } from './ranking-table'
import { RankingJornadaView } from './ranking-jornada-view'
import type { PoolMember, Prediction, Result, Match, GiftSpin, Duel, QuizResponse, TeamRouletteSpin } from '@/types'

type Tab = 'total' | 'jornada'

interface RankingViewProps {
  poolId: string
  members: (PoolMember & { username: string; avatar_url?: string | null })[]
  predictions: Prediction[]
  results: Result[]
  matches: Match[]
  giftSpins: GiftSpin[]
  duels: Duel[]
  quizResponses: QuizResponse[]
  teamRouletteSpins: TeamRouletteSpin[]
  currentUserId: string
}

export function RankingView({ poolId, members, predictions, results, matches, giftSpins, duels, quizResponses, teamRouletteSpins, currentUserId }: RankingViewProps) {
  const [tab, setTab] = useState<Tab>('total')

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {([
          ['total', 'Total'],
          ['jornada', 'Por jornada'],
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
          giftSpins={giftSpins}
          duels={duels}
          quizResponses={quizResponses}
          teamRouletteSpins={teamRouletteSpins}
          currentUserId={currentUserId}
        />
      ) : (
        <RankingJornadaView
          members={members}
          matches={matches}
          results={results}
          predictions={predictions}
        />
      )}
    </div>
  )
}
