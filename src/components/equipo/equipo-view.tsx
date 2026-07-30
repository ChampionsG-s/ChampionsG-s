'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MarketView } from './market-view'
import { SquadView } from './squad-view'
import { EquipoRankingView } from './equipo-ranking-view'
import type {
  EquipoWallet,
  EquipoMarketCycle,
  EquipoMarketListing,
  EquipoBid,
  EquipoRoster,
  EquipoPlayer,
  PoolMember,
} from '@/types'

type Tab = 'market' | 'squad' | 'ranking'

interface EquipoViewProps {
  poolId: string
  currentUserId: string
  currentJornada: number
  members: (PoolMember & { username: string; avatar_url?: string | null })[]
  wallet: EquipoWallet | null
  wallets: EquipoWallet[]
  cycle: EquipoMarketCycle | null
  listings: EquipoMarketListing[]
  bids: EquipoBid[]
  roster: EquipoRoster[]
  players: EquipoPlayer[]
}

export function EquipoView({
  poolId,
  currentUserId,
  currentJornada,
  members,
  wallet,
  wallets,
  cycle,
  listings,
  bids,
  roster,
  players,
}: EquipoViewProps) {
  const [tab, setTab] = useState<Tab>('market')
  const playersById = new Map(players.map(p => [p.id, p]))
  const myRoster = roster.filter(r => r.user_id === currentUserId)
  const ownedCount = myRoster.filter(r => r.status === 'owned').length

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-gold/45 bg-[linear-gradient(160deg,rgba(212,160,23,0.16),rgba(10,14,24,0.94)_42%,rgba(7,11,22,0.96)_100%)] px-4 py-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(255,255,255,0.16),transparent_40%)]" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gold/80 uppercase tracking-wide font-bold">Saldo</p>
            <p className="font-display text-2xl text-gold">{(wallet?.balance ?? 0).toLocaleString('es-ES')} 🪙</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted uppercase tracking-wide font-bold">Plantilla</p>
            <p className="font-display text-2xl text-cream">{ownedCount}/9</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5">
        {([
          ['market', 'Mercado'],
          ['squad', 'Mi plantilla'],
          ['ranking', 'Ranking'],
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

      {tab === 'market' ? (
        <MarketView
          currentUserId={currentUserId}
          listings={listings}
          bids={bids}
          playersById={playersById}
          wallet={wallet}
          squadFull={ownedCount >= 9}
          cycle={cycle}
        />
      ) : tab === 'squad' ? (
        <SquadView poolId={poolId} roster={myRoster} playersById={playersById} wallet={wallet} />
      ) : (
        <EquipoRankingView
          currentUserId={currentUserId}
          currentJornada={currentJornada}
          members={members}
          roster={roster}
          players={players}
          playersById={playersById}
          wallets={wallets}
        />
      )}
    </div>
  )
}
