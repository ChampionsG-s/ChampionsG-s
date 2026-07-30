'use client'

import { X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { MemberSquadView } from './member-squad-view'
import type { PoolMember, EquipoRoster, EquipoPlayer, EquipoFormation } from '@/types'

interface MemberSquadModalProps {
  member: (PoolMember & { username: string; avatar_url?: string | null }) | null
  isMe: boolean
  roster: EquipoRoster[]
  playersById: Map<number, EquipoPlayer>
  formation: EquipoFormation
  currentJornada: number
  onClose: () => void
}

export function MemberSquadModal({
  member,
  isMe,
  roster,
  playersById,
  formation,
  currentJornada,
  onClose,
}: MemberSquadModalProps) {
  if (!member) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-gold/30 bg-[linear-gradient(155deg,rgba(29,47,83,0.55),rgba(10,15,30,0.98)_45%,rgba(7,11,22,0.99)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 backdrop-blur-md px-4 py-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar username={member.username} avatarUrl={member.avatar_url} size="md" />
            <h3 className="font-display text-xl tracking-wide text-cream truncate">{member.username}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {isMe ? (
            <p className="text-center text-xs text-muted py-8">
              Esta es tu plantilla — gestiónala desde la pestaña &quot;Mi plantilla&quot;.
            </p>
          ) : (
            <MemberSquadView
              roster={roster}
              playersById={playersById}
              formation={formation}
              currentJornada={currentJornada}
            />
          )}
        </div>
      </div>
    </div>
  )
}
