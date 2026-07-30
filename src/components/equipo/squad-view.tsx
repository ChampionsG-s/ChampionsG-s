'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Flag } from '@/components/ui/flag'
import { PlayerPhoto } from './player-photo'
import { cn } from '@/lib/utils'
import type { EquipoRoster, EquipoPlayer, EquipoWallet, EquipoFormation } from '@/types'

const SELL_RATIO = 0.65
const FORMATIONS: Record<EquipoFormation, { def: number; med: number; del: number }> = {
  '1-2-2': { def: 1, med: 2, del: 2 },
  '2-1-2': { def: 2, med: 1, del: 2 },
}

type Entry = { roster: EquipoRoster; player: EquipoPlayer }

interface SquadViewProps {
  poolId: string
  roster: EquipoRoster[]
  playersById: Map<number, EquipoPlayer>
  wallet: EquipoWallet | null
}

export function SquadView({ poolId, roster, playersById, wallet }: SquadViewProps) {
  const supabase = createClient()
  const router = useRouter()
  const [sellingId, setSellingId] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  const formationKey: EquipoFormation = wallet?.formation ?? '1-2-2'
  const shape = FORMATIONS[formationKey]

  const withPlayer: Entry[] = roster
    .filter(r => r.status === 'owned')
    .map(r => ({ roster: r, player: playersById.get(r.player_id) }))
    .filter((x): x is Entry => !!x.player)

  const byPos = (pos: number) =>
    withPlayer.filter(x => x.player.position === pos).sort((a, b) => b.player.coin_price - a.player.coin_price)

  const defs = byPos(2)
  const meds = byPos(3)
  const dels = byPos(4)

  const starterIds = new Set([
    ...defs.slice(0, shape.def).map(x => x.roster.id),
    ...meds.slice(0, shape.med).map(x => x.roster.id),
    ...dels.slice(0, shape.del).map(x => x.roster.id),
  ])
  const bench = withPlayer.filter(x => !starterIds.has(x.roster.id))

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

  const handleFormationChange = async (formation: EquipoFormation) => {
    if (formation === formationKey || switching) return
    setSwitching(true)
    const { error } = await supabase.rpc('equipo_set_formation', { target_pool: poolId, target_formation: formation })
    setSwitching(false)
    if (error) {
      alert(error.message)
      return
    }
    router.refresh()
  }

  const renderRow = (count: number, items: Entry[]) => (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {Array.from({ length: count }).map((_, i) => {
        const entry = items[i]
        if (!entry) {
          return (
            <div
              key={i}
              className="w-[76px] h-[104px] rounded-xl border-2 border-dashed border-white/20 flex items-center justify-center text-[10px] text-muted text-center px-1"
            >
              Vacío
            </div>
          )
        }
        const { roster: r, player } = entry
        const sellPrice = Math.round(r.purchase_price * SELL_RATIO)
        return (
          <div key={r.id} className="w-[76px] flex flex-col items-center gap-1 rounded-xl border border-gold/40 bg-black/30 p-1.5">
            <PlayerPhoto name={player.name} photoUrl={player.photo_url} heroPhotoUrl={player.hero_photo_url} size="md" />
            <p className="text-[10px] font-bold text-cream text-center leading-tight truncate w-full">{player.name}</p>
            <Flag team={player.team_name} size="sm" />
            <button
              type="button"
              disabled={sellingId === r.id}
              onClick={() => handleSell(r.id, player.name, sellPrice)}
              className="text-[9px] font-bold text-red-300 hover:text-red-200 disabled:opacity-50"
            >
              {sellingId === r.id ? '...' : `Vender ${sellPrice}`}
            </button>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        {(Object.keys(FORMATIONS) as EquipoFormation[]).map(key => (
          <button
            key={key}
            disabled={switching}
            onClick={() => handleFormationChange(key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-bold transition-all disabled:opacity-50',
              key === formationKey ? 'bg-gold text-background' : 'border border-border text-muted hover:border-gold hover:text-gold'
            )}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-green-900/60 bg-[linear-gradient(180deg,rgba(20,60,30,0.55),rgba(10,30,15,0.9))] p-4 space-y-4">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="relative">
          <p className="text-center text-[10px] text-green-200/70 uppercase tracking-widest font-bold mb-2">Delanteros</p>
          {renderRow(shape.del, dels)}
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-green-200/70 uppercase tracking-widest font-bold mb-2">Centrocampistas</p>
          {renderRow(shape.med, meds)}
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-green-200/70 uppercase tracking-widest font-bold mb-2">Defensas</p>
          {renderRow(shape.def, defs)}
        </div>
      </div>

      <div>
        <p className="text-[11px] text-muted uppercase tracking-wide font-bold mb-2 px-1">Banquillo ({bench.length}/3)</p>
        {bench.length === 0 ? (
          <div className="card text-center py-6">
            <p className="text-muted text-sm">Ficha jugadores en el mercado para llenar el banquillo.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bench.map(({ roster: r, player }) => {
              const sellPrice = Math.round(r.purchase_price * SELL_RATIO)
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
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={sellingId === r.id}
                    onClick={() => handleSell(r.id, player.name, sellPrice)}
                    className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border border-red-800 text-red-300 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    {sellingId === r.id ? '...' : `Vender · ${sellPrice.toLocaleString('es-ES')}`}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
