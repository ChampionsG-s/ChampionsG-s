'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Flag } from '@/components/ui/flag'
import { PlayerPhoto } from './player-photo'
import { cn } from '@/lib/utils'
import type { EquipoRoster, EquipoPlayer, EquipoWallet, EquipoFormation } from '@/types'

const SELL_RATIO = 0.65
const BENCH_SIZE = 3
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

  const gks = byPos(1)
  const defs = byPos(2)
  const meds = byPos(3)
  const dels = byPos(4)

  const starterIds = new Set([
    ...gks.slice(0, 1).map(x => x.roster.id),
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

  const renderSlots = (count: number, items: Entry[], emptyLabel: string) => (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {Array.from({ length: count }).map((_, i) => {
        const entry = items[i]
        if (!entry) {
          return (
            <div
              key={i}
              className="w-[76px] h-[104px] rounded-xl border-2 border-dashed border-white/25 bg-white/[0.03] flex items-center justify-center text-[10px] text-cream/50 text-center px-1"
            >
              {emptyLabel}
            </div>
          )
        }
        const { roster: r, player } = entry
        const sellPrice = Math.round(r.purchase_price * SELL_RATIO)
        return (
          <div key={r.id} className="w-[76px] flex flex-col items-center gap-1 rounded-xl border border-gold/50 bg-black/40 backdrop-blur-[1px] p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.4)]">
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

      {/* Medio campo de futbol */}
      <div className="relative overflow-hidden rounded-2xl border border-green-900/70 bg-[linear-gradient(180deg,#1d5533,#153f26_55%,#0e2c1a)] p-4 pt-9 pb-5 space-y-5 shadow-[0_16px_40px_rgba(0,0,0,0.4)]">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* Linea de medio campo + circulo central cortado */}
          <div className="absolute top-0 left-0 right-0 h-px bg-white/25" />
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-white/20" />
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/30" />
          {/* Area y area pequena frente a la porteria */}
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-44 h-20 border-2 border-b-0 border-white/20 rounded-t-md" />
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 w-24 h-9 border-2 border-b-0 border-white/20 rounded-t-md" />
          {/* Banda lateral y esquinas */}
          <div className="absolute inset-x-0 bottom-0 top-0 border-x border-white/10" />
          <div className="absolute bottom-0 left-0 w-5 h-5 border-2 border-white/20 rounded-tr-full" style={{ borderLeft: 0, borderBottom: 0 }} />
          <div className="absolute bottom-0 right-0 w-5 h-5 border-2 border-white/20 rounded-tl-full" style={{ borderRight: 0, borderBottom: 0 }} />
        </div>

        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Delanteros</p>
          {renderSlots(shape.del, dels, 'Vacío')}
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Centrocampistas</p>
          {renderSlots(shape.med, meds, 'Vacío')}
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Defensas</p>
          {renderSlots(shape.def, defs, 'Vacío')}
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Portero</p>
          {renderSlots(1, gks, 'Vacío')}
        </div>
      </div>

      {/* Banquillo */}
      <div>
        <p className="text-[11px] text-muted uppercase tracking-wide font-bold mb-2 px-1">
          Banquillo ({bench.length}/{BENCH_SIZE})
        </p>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(160deg,rgba(51,65,85,0.35),rgba(15,23,42,0.9))] p-4">
          <div aria-hidden className="pointer-events-none absolute inset-x-3 top-2 h-px bg-white/10" />
          {renderSlots(BENCH_SIZE, bench, 'Banquillo')}
        </div>
      </div>
    </div>
  )
}
