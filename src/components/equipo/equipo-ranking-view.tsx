'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { MemberSquadView } from './member-squad-view'
import type { PoolMember, EquipoRoster, EquipoPlayer, EquipoWallet, EquipoFormation } from '@/types'

interface EquipoRankingViewProps {
  currentUserId: string
  currentJornada: number
  members: (PoolMember & { username: string; avatar_url?: string | null })[]
  roster: EquipoRoster[]
  players: EquipoPlayer[]
  playersById: Map<number, EquipoPlayer>
  wallets: EquipoWallet[]
}

const medals = ['🥇', '🥈', '🥉']

// Ranking del juego de Equipo (independiente del ranking de la quiniela):
// puntos = suma de lo que ha aportado cada jugador (actual season_points
// menos los puntos que tenia al ficharlo) mientras estuvo en tu plantilla,
// mas los puntos ya "bancados" de los que vendiste. Cada fila se puede
// expandir para ver la plantilla de ese miembro y ficharle jugadores.
export function EquipoRankingView({
  currentUserId,
  currentJornada,
  members,
  roster,
  playersById,
  wallets,
}: EquipoRankingViewProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const walletByUser = new Map(wallets.map(w => [w.user_id, w]))

  const ranking = members
    .map(member => {
      const memberRoster = roster.filter(r => r.user_id === member.user_id)
      const total = memberRoster.reduce((sum, r) => {
        if (r.status === 'sold') return sum + r.banked_points
        const player = playersById.get(r.player_id)
        const current = player ? Math.max(0, player.season_points - r.points_at_acquisition) : 0
        return sum + current
      }, 0)
      const ownedCount = memberRoster.filter(r => r.status === 'owned').length
      return { member, total, ownedCount, memberRoster }
    })
    .sort((a, b) => b.total - a.total)

  if (members.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-muted text-sm">Aún no hay jugadores en esta quiniela.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {ranking.map(({ member, total, ownedCount, memberRoster }, i) => {
        const isExpanded = expanded === member.user_id
        const formation: EquipoFormation = walletByUser.get(member.user_id)?.formation ?? '1-2-2'
        const isMe = member.user_id === currentUserId

        return (
          <div key={member.id} className="card !p-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isExpanded ? null : member.user_id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <span className="w-7 text-center flex-shrink-0">
                {medals[i]
                  ? <span className="text-lg leading-none">{medals[i]}</span>
                  : <span className="text-muted font-bold text-sm">{i + 1}</span>}
              </span>
              <Avatar username={member.username} avatarUrl={member.avatar_url} size="md" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm flex items-center gap-1 flex-wrap">
                  {member.username}
                  {isMe && <span className="text-[10px] text-muted font-normal">(tú)</span>}
                  {member.role === 'admin' && <span className="badge badge-admin">ADMIN</span>}
                </p>
                <p className="text-[11px] text-muted">{ownedCount}/9 jugadores</p>
              </div>
              <span className="font-display text-lg text-gold">{total}pts</span>
            </button>

            {isExpanded && (
              <div className="border-t border-border/60 p-3">
                {isMe ? (
                  <p className="text-center text-xs text-muted py-4">
                    Esta es tu plantilla — gestiónala desde la pestaña &quot;Mi plantilla&quot;.
                  </p>
                ) : (
                  <MemberSquadView
                    roster={memberRoster}
                    playersById={playersById}
                    formation={formation}
                    currentJornada={currentJornada}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
