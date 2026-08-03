'use client'

import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { MemberSquadModal } from './member-squad-modal'
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
// mas los puntos ya "bancados" de los que vendiste. Pulsar una fila abre
// la plantilla de ese miembro en una ventana emergente (mismo patron que
// el detalle de equipo en Clasificacion).
export function EquipoRankingView({
  currentUserId,
  currentJornada,
  members,
  roster,
  playersById,
  wallets,
}: EquipoRankingViewProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const walletByUser = new Map(wallets.map(w => [w.user_id, w]))

  const ranking = members
    .map(member => {
      const memberRoster = roster.filter(r => r.user_id === member.user_id)
      const rawTotal = memberRoster.reduce((sum, r) => {
        if (r.status === 'sold') return sum + r.banked_points
        const player = playersById.get(r.player_id)
        const current = player ? Math.max(0, player.season_points - r.points_at_acquisition) : 0
        return sum + current
      }, 0)
      const ownedCount = memberRoster.filter(r => r.status === 'owned').length
      const negativeBalance = (walletByUser.get(member.user_id)?.balance ?? 0) <= 0
      const total = negativeBalance ? 0 : rawTotal
      return { member, total, negativeBalance, ownedCount, memberRoster }
    })
    .sort((a, b) => b.total - a.total)

  if (members.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-muted text-sm">Aún no hay jugadores en esta quiniela.</p>
      </div>
    )
  }

  const selected = ranking.find(r => r.member.user_id === selectedUserId)
  const selectedFormation: EquipoFormation = selectedUserId
    ? walletByUser.get(selectedUserId)?.formation ?? '1-2-2'
    : '1-2-2'

  return (
    <div className="space-y-2.5">
      {ranking.map(({ member, total, negativeBalance, ownedCount }, i) => (
        <button
          key={member.id}
          type="button"
          onClick={() => setSelectedUserId(member.user_id)}
          className="card !p-0 overflow-hidden w-full flex items-center gap-3 px-4 py-3 text-left"
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
              {member.user_id === currentUserId && <span className="text-[10px] text-muted font-normal">(tú)</span>}
              {member.role === 'admin' && <span className="badge badge-admin">ADMIN</span>}
            </p>
            <p className="text-[11px] text-muted">{ownedCount}/9 jugadores</p>
            {negativeBalance && (
              <p className="text-[10px] text-red-300 font-bold">⚠️ Saldo negativo, no puntúa</p>
            )}
          </div>
          <span className="font-display text-lg text-gold">{total}pts</span>
        </button>
      ))}

      <MemberSquadModal
        member={selected?.member ?? null}
        isMe={selectedUserId === currentUserId}
        roster={selected?.memberRoster ?? []}
        playersById={playersById}
        formation={selectedFormation}
        currentJornada={currentJornada}
        onClose={() => setSelectedUserId(null)}
      />
    </div>
  )
}
