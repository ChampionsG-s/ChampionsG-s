'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { PitchShell } from './pitch-shell'
import { SlotGrid } from './slot-grid'
import { splitFormation, SELL_RATIO, BENCH_SIZE, FORMATIONS } from '@/lib/equipo/formation'
import type { EquipoRoster, EquipoPlayer, EquipoWallet, EquipoFormation } from '@/types'

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
  const slots = splitFormation(roster, playersById, formationKey)

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

  const sellFooter = (entry: { roster: EquipoRoster; player: EquipoPlayer }) => {
    const sellPrice = Math.round(entry.roster.purchase_price * SELL_RATIO)
    return (
      <button
        type="button"
        disabled={sellingId === entry.roster.id}
        onClick={() => handleSell(entry.roster.id, entry.player.name, sellPrice)}
        className="text-[9px] font-bold text-red-300 hover:text-red-200 disabled:opacity-50"
      >
        {sellingId === entry.roster.id ? '...' : `Vender ${sellPrice}`}
      </button>
    )
  }

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

      <PitchShell>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Delanteros</p>
          <SlotGrid count={FORMATIONS[formationKey].del} items={slots.del} emptyLabel="Vacío" renderFooter={sellFooter} />
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Centrocampistas</p>
          <SlotGrid count={FORMATIONS[formationKey].med} items={slots.med} emptyLabel="Vacío" renderFooter={sellFooter} />
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Defensas</p>
          <SlotGrid count={FORMATIONS[formationKey].def} items={slots.def} emptyLabel="Vacío" renderFooter={sellFooter} />
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Portero</p>
          <SlotGrid count={1} items={slots.gk} emptyLabel="Vacío" renderFooter={sellFooter} />
        </div>
      </PitchShell>

      <div>
        <p className="text-[11px] text-muted uppercase tracking-wide font-bold mb-2 px-1">
          Banquillo ({slots.bench.length}/{BENCH_SIZE})
        </p>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(160deg,rgba(51,65,85,0.35),rgba(15,23,42,0.9))] p-4">
          <div aria-hidden className="pointer-events-none absolute inset-x-3 top-2 h-px bg-white/10" />
          <SlotGrid count={BENCH_SIZE} items={slots.bench} emptyLabel="Banquillo" renderFooter={sellFooter} />
        </div>
      </div>
    </div>
  )
}
