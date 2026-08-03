'use client'

import { PlayerCard } from './player-card'
import type { EquipoWallet, EquipoMarketListing, EquipoBid, EquipoPlayer, EquipoMarketCycle } from '@/types'

interface MarketViewProps {
  currentUserId: string
  listings: EquipoMarketListing[]
  bids: EquipoBid[]
  playersById: Map<number, EquipoPlayer>
  wallet: EquipoWallet | null
  squadFull: boolean
  cycle: EquipoMarketCycle | null
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export function MarketView({ currentUserId, listings, bids, playersById, wallet, squadFull, cycle }: MarketViewProps) {
  const balance = wallet?.balance ?? 0
  const cycleEndsAt = cycle ? new Date(cycle.started_at).getTime() + TWENTY_FOUR_HOURS_MS : null

  if (listings.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-muted text-sm">No hay jugadores en el mercado ahora mismo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {cycleEndsAt && (
        <p className="text-[11px] text-muted text-center">
          Este mercado cierra el {new Date(cycleEndsAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {listings.map(listing => {
          const player = playersById.get(listing.player_id)
          if (!player) return null

          const listingBids = bids.filter(b => b.listing_id === listing.id)
          const highestBid = listingBids.length > 0 ? Math.max(...listingBids.map(b => b.amount)) : null
          const myBid = listingBids.find(b => b.user_id === currentUserId)?.amount ?? 0

          return (
            <PlayerCard
              key={listing.id}
              listing={listing}
              player={player}
              highestBid={highestBid}
              myBid={myBid}
              balance={balance}
              squadFull={squadFull}
            />
          )
        })}
      </div>
    </div>
  )
}
