'use client'

import { Flag } from '@/components/ui/flag'
import { PlayerPhoto } from './player-photo'
import type { EquipoEntry } from '@/lib/equipo/formation'

interface SlotGridProps {
  count: number
  items: EquipoEntry[]
  emptyLabel: string
  renderFooter: (entry: EquipoEntry) => React.ReactNode
}

export function SlotGrid({ count, items, emptyLabel, renderFooter }: SlotGridProps) {
  return (
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
        const { player } = entry
        return (
          <div
            key={entry.roster.id}
            className="w-[76px] flex flex-col items-center gap-1 rounded-xl border border-gold/50 bg-black/40 backdrop-blur-[1px] p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.4)]"
          >
            <PlayerPhoto name={player.name} photoUrl={player.photo_url} heroPhotoUrl={player.hero_photo_url} size="md" />
            <p className="text-[10px] font-bold text-cream text-center leading-tight truncate w-full">{player.name}</p>
            <Flag team={player.team_name} size="sm" />
            {renderFooter(entry)}
          </div>
        )
      })}
    </div>
  )
}
