'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Flag } from '@/components/ui/flag'
import { PlayerPhoto } from './player-photo'
import { ConfirmModal } from './confirm-modal'
import type { EquipoPlayer, EquipoMarketListing } from '@/types'

const POSITION_LABEL: Record<number, string> = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' }

interface PlayerCardProps {
  listing: EquipoMarketListing
  player: EquipoPlayer
  highestBid: number | null
  myBid: number
  balance: number
}

export function PlayerCard({ listing, player, highestBid, myBid, balance }: PlayerCardProps) {
  const supabase = createClient()
  const router = useRouter()
  const minNextBid = highestBid !== null ? highestBid + 10 : listing.starting_price
  const [bidValue, setBidValue] = useState<string>(String(minNextBid))
  const [loading, setLoading] = useState<'bid' | 'cancel' | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const handleBid = async () => {
    const amount = parseInt(bidValue, 10)
    if (!Number.isFinite(amount) || amount < minNextBid) {
      toast.warning(`La puja debe ser de al menos ${minNextBid.toLocaleString('es-ES')}`)
      return
    }
    if (amount - myBid > balance) {
      toast.warning('No tienes saldo suficiente para esa puja')
      return
    }
    setLoading('bid')
    const { error } = await supabase.rpc('equipo_place_bid', { target_listing: listing.id, target_amount: amount })
    setLoading(null)
    if (error) {
      toast.error(error.message)
      return
    }
    router.refresh()
  }

  const handleCancelBidConfirmed = async () => {
    setLoading('cancel')
    const { error } = await supabase.rpc('equipo_cancel_bid', { target_listing: listing.id })
    setLoading(null)
    setConfirmingCancel(false)
    if (error) {
      toast.error(error.message)
      return
    }
    router.refresh()
  }

  const busy = loading !== null

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/80 bg-[linear-gradient(155deg,rgba(29,47,83,0.42),rgba(10,15,30,0.95)_45%,rgba(7,11,22,0.95)_100%)] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex items-center gap-3">
        <PlayerPhoto name={player.name} photoUrl={player.photo_url} heroPhotoUrl={player.hero_photo_url} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-cream truncate">{player.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Flag team={player.team_name} size="sm" />
            <span className="text-[11px] text-muted truncate">{player.team_name}</span>
            <span className="badge bg-surface-2 border border-border text-muted text-[9px]">
              {POSITION_LABEL[player.position] ?? '?'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-black/25 border border-white/10 py-1.5 text-center">
        <p className="text-[9px] text-muted uppercase tracking-wide">
          {highestBid !== null ? 'Puja actual' : 'Precio de salida'}
        </p>
        <p className="font-display text-base text-gold">
          {(highestBid ?? listing.starting_price).toLocaleString('es-ES')}
        </p>
      </div>

      {myBid > 0 && (
        <div className="flex items-center justify-center gap-2 mt-1.5">
          <p className="text-[10px] text-gold/80">Tu puja: {myBid.toLocaleString('es-ES')}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmingCancel(true)}
            className="text-[10px] font-bold text-red-300 hover:text-red-200 disabled:opacity-50"
          >
            {loading === 'cancel' ? '...' : 'Retirar puja'}
          </button>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <input
          type="number"
          min={minNextBid}
          step={10}
          value={bidValue}
          onChange={(e) => setBidValue(e.target.value)}
          disabled={busy}
          className="w-full rounded-xl bg-surface border border-border text-cream text-sm text-center py-2 outline-none focus:border-gold disabled:opacity-50"
        />
        <button
          type="button"
          disabled={busy}
          onClick={handleBid}
          className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border border-gold text-gold hover:bg-gold/10 transition-colors disabled:opacity-50"
        >
          {loading === 'bid' ? '...' : 'Pujar'}
        </button>
      </div>

      {confirmingCancel && (
        <ConfirmModal
          title="¿Seguro?"
          message={`Vas a retirar tu puja de ${myBid.toLocaleString('es-ES')} monedas por ${player.name}. Se te devolverá el dinero.`}
          confirmLabel="Retirar puja"
          loading={loading === 'cancel'}
          onConfirm={handleCancelBidConfirmed}
          onCancel={() => setConfirmingCancel(false)}
        />
      )}
    </div>
  )
}
