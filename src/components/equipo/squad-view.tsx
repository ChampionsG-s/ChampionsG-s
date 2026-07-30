'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Flag } from '@/components/ui/flag'
import { PlayerPhoto } from './player-photo'
import type { EquipoRoster, EquipoPlayer } from '@/types'

const POSITION_LABEL: Record<number, string> = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' }
const SELL_RATIO = 0.65

interface SquadViewProps {
  roster: EquipoRoster[]
  playersById: Map<number, EquipoPlayer>
}

export function SquadView({ roster, playersById }: SquadViewProps) {
  const supabase = createClient()
  const router = useRouter()
  const [sellingId, setSellingId] = useState<string | null>(null)

  const owned = roster.filter(r => r.status === 'owned')

  const handleSell = async (rosterId: string, playerName: string, sellPrice: number) => {
    if (!confirm(`¿Vender a ${playerName} por ${sellPrice.toLocaleString('es-ES')} monedas?`)) return
    setSellingId(rosterId)
    const { error } = await supabase.rpc('equipo_sell_player', { target_roster_id: rosterId })
    setSellingId(null)
    if (error) {
      alert(error.message)
      return
    }
    router.refresh()
  }

  if (owned.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-muted text-sm">Aún no has fichado a ningún jugador. Ve al mercado para empezar tu plantilla.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {owned.map(r => {
        const player = playersById.get(r.player_id)
        if (!player) return null
        const currentPoints = Math.max(0, player.season_points - r.points_at_acquisition)
        const sellPrice = Math.round(r.purchase_price * SELL_RATIO)
        const busy = sellingId === r.id

        return (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-2xl border border-slate-700/80 bg-[linear-gradient(155deg,rgba(29,47,83,0.42),rgba(10,15,30,0.95)_45%,rgba(7,11,22,0.95)_100%)] p-3"
          >
            <PlayerPhoto name={player.name} photoUrl={player.photo_url} heroPhotoUrl={player.hero_photo_url} size="md" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-cream truncate">{player.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Flag team={player.team_name} size="sm" />
                <span className="text-[11px] text-muted truncate">{player.team_name}</span>
                <span className="badge bg-surface-2 border border-border text-muted text-[9px]">
                  {POSITION_LABEL[player.position] ?? '?'}
                </span>
              </div>
              <p className="text-[10px] text-gold/80 mt-1">{currentPoints} pts contigo</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleSell(r.id, player.name, sellPrice)}
              className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border border-red-800 text-red-300 hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {busy ? '...' : `Vender · ${sellPrice.toLocaleString('es-ES')}`}
            </button>
          </div>
        )
      })}
    </div>
  )
}
