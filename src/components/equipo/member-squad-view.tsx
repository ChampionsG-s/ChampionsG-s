'use client'

import { useState } from 'react'
import { PitchShell } from './pitch-shell'
import { SlotGrid } from './slot-grid'
import { PlayerDetailModal } from './player-detail-modal'
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

// Vista de solo-fichaje de la plantilla de OTRO miembro: cada carta se
// puede pulsar para abrir su ficha (igual que en el mercado) y ficharlo
// por su precio de compra directa si lleva al menos 2 jornadas con su
// dueno actual; si no, la ficha lo muestra bloqueado con el precio que
// costara en cuanto se desbloquee.
export function MemberSquadView({ roster, playersById, formation, currentJornada }: MemberSquadViewProps) {
  const [selectedEntry, setSelectedEntry] = useState<EquipoEntry | null>(null)
  const slots = splitFormation(roster, playersById, formation)

  const priceLabel = (entry: EquipoEntry) => {
    const price = poachPrice(entry.player.coin_price)
    const remaining = jornadasUntilPoachable(entry.roster.acquired_jornada, currentJornada)

    if (remaining > 0) {
      return (
        <span className="text-[9px] font-bold text-muted text-center leading-tight">
          Bloqueado ({remaining}j)
        </span>
      )
    }

    return <span className="text-[9px] font-bold text-gold text-center leading-tight">{price.toLocaleString('es-ES')}</span>
  }

  return (
    <div className="space-y-3">
      <PitchShell>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Delanteros</p>
          <SlotGrid count={FORMATIONS[formation].del} items={slots.del} emptyLabel="Vacío" renderFooter={priceLabel} onCardClick={setSelectedEntry} />
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Centrocampistas</p>
          <SlotGrid count={FORMATIONS[formation].med} items={slots.med} emptyLabel="Vacío" renderFooter={priceLabel} onCardClick={setSelectedEntry} />
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Defensas</p>
          <SlotGrid count={FORMATIONS[formation].def} items={slots.def} emptyLabel="Vacío" renderFooter={priceLabel} onCardClick={setSelectedEntry} />
        </div>
        <div className="relative">
          <p className="text-center text-[10px] text-white/60 uppercase tracking-widest font-bold mb-2">Portero</p>
          <SlotGrid count={1} items={slots.gk} emptyLabel="Vacío" renderFooter={priceLabel} onCardClick={setSelectedEntry} />
        </div>
      </PitchShell>

      {slots.bench.length > 0 && (
        <div>
          <p className="text-[11px] text-muted uppercase tracking-wide font-bold mb-2 px-1">Banquillo</p>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(160deg,rgba(51,65,85,0.35),rgba(15,23,42,0.9))] p-4">
            <SlotGrid count={BENCH_SIZE} items={slots.bench} emptyLabel="Banquillo" renderFooter={priceLabel} onCardClick={setSelectedEntry} />
          </div>
        </div>
      )}

      <PlayerDetailModal
        entry={selectedEntry}
        currentJornada={currentJornada}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  )
}
