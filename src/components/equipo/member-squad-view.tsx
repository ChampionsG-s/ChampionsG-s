'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PitchShell } from './pitch-shell'
import { SlotGrid } from './slot-grid'
import {
  splitFormation,
  FORMATIONS,
  BENCH_SIZE,
  poachPrice,
  jornadasUntilPoachable,
  type EquipoEntry,
} from '@/lib/equipo/formation'
import type { EquipoRoster, EquipoPlayer, EquipoFormation } from '@/types'

interface MemberSquadViewProps {
  roster: EquipoRoster[]
  playersById: Map<number, EquipoPlayer>
  formation: EquipoFormation
  currentJornada: number
}

// Vista de solo-fichaje de la plantilla de OTRO miembro: cada jugador se
// puede fichar por su precio de compra directa si lleva al menos 2
// jornadas con su dueno actual; si no, se muestra bloqueado.
export function MemberSquadView({ roster, playersById, formation, currentJornada }: MemberSquadViewProps) {
  const supabase = createClient()
  const router = useRouter()
  const [buyingId, setBuyingId] = useState<string | null>(null)

  const slots = splitFormation(roster, playersById, formation)

  const handlePoach = async (rosterId: string, playerName: string, price: number) => {
    if (!confirm(`¿Fichar a ${playerName} por ${price.toLocaleString('es-ES')} monedas?`)) return
    setBuyingId(rosterId)
    const { error } = await supabase.rpc('equipo_poach_player', { target_roster_id: rosterId })
    setBuyingId(null)
    if (error) {
      alert(error.message)
      return
    }
    router.refresh()
  }

  const poachFooter = (entry: EquipoEntry) => {
    const price = poachPrice(entry.player.coin_price)
    const remaining = jornadasUntilPoachable(entry.roster.acquired_jornada, currentJornada)

    if (remaining > 0) {
      return (
        <span className="text-[9px] font-bold text-muted text-center leading-tight">
          Bloqueado ({remaining}j)
        </span>
      )
    }

    return (
      <button
        type="button"
        disabled={buyingId === entry.roster.id}
        onClick={() => handlePoach(entry.roster.id, entry.player.name, price)}
        className="text-[9px] font-bold text-gold hover:text-gold/80 disabled:opacity-50"
      >
        {buyingId === entry.roster.id ? '...' : `Fichar ${price}`}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <PitchShell>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Delanteros</p>
          <SlotGrid count={FORMATIONS[formation].del} items={slots.del} emptyLabel="Vacío" renderFooter={poachFooter} />
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Centrocampistas</p>
          <SlotGrid count={FORMATIONS[formation].med} items={slots.med} emptyLabel="Vacío" renderFooter={poachFooter} />
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Defensas</p>
          <SlotGrid count={FORMATIONS[formation].def} items={slots.def} emptyLabel="Vacío" renderFooter={poachFooter} />
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Portero</p>
          <SlotGrid count={1} items={slots.gk} emptyLabel="Vacío" renderFooter={poachFooter} />
        </div>
      </PitchShell>

      {slots.bench.length > 0 && (
        <div>
          <p className="text-[11px] text-muted uppercase tracking-wide font-bold mb-2 px-1">Banquillo</p>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(160deg,rgba(51,65,85,0.35),rgba(15,23,42,0.9))] p-4">
            <SlotGrid count={BENCH_SIZE} items={slots.bench} emptyLabel="Banquillo" renderFooter={poachFooter} />
          </div>
        </div>
      )}
    </div>
  )
}
