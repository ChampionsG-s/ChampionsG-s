'use client'

import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/flag'
import { PlayerPhoto } from './player-photo'
import type { EquipoEntry } from '@/lib/equipo/formation'

interface SlotGridProps {
  count: number
  items: EquipoEntry[]
  emptyLabel: string
  renderFooter: (entry: EquipoEntry) => React.ReactNode
  draggable?: boolean
  onDropEntry?: (draggedRosterId: string, targetEntry: EquipoEntry | null) => void
  onCardClick?: (entry: EquipoEntry) => void
}

export function SlotGrid({ count, items, emptyLabel, renderFooter, draggable, onDropEntry, onCardClick }: SlotGridProps) {
  const handleDragStart = (e: React.DragEvent, rosterId: string) => {
    e.dataTransfer.setData('text/plain', rosterId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!draggable) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetEntry: EquipoEntry | null) => {
    if (!draggable) return
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    if (draggedId) onDropEntry?.(draggedId, targetEntry)
  }

  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {Array.from({ length: count }).map((_, i) => {
        const entry = items[i]
        if (!entry) {
          return (
            <div
              key={i}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, null)}
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
            draggable={draggable}
            onDragStart={draggable ? (e) => handleDragStart(e, entry.roster.id) : undefined}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, entry)}
            onClick={onCardClick ? () => onCardClick(entry) : undefined}
            className={cn(
              'w-[76px] flex flex-col items-center gap-1 rounded-xl border border-gold/50 bg-black/40 backdrop-blur-[1px] p-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.4)]',
              draggable && 'cursor-grab active:cursor-grabbing',
              onCardClick && 'cursor-pointer hover:border-gold transition-colors'
            )}
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
