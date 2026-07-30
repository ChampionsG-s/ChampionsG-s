'use client'

import { Avatar } from '@/components/ui/avatar'
import type { PoolMember, EquipoRoster, EquipoPlayer } from '@/types'

interface RankingEquipoViewProps {
  members: (PoolMember & { username: string; avatar_url?: string | null })[]
  roster: EquipoRoster[]
  players: EquipoPlayer[]
}

const medals = ['🥇', '🥈', '🥉']

export function RankingEquipoView({ members, roster, players }: RankingEquipoViewProps) {
  const playersById = new Map(players.map(p => [p.id, p]))

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
      return { member, total, ownedCount }
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
    <div className="card !p-0 overflow-hidden">
      <div className="divide-y divide-border/60">
        {ranking.map(({ member, total, ownedCount }, i) => (
          <div key={member.id} className="flex items-center gap-3 px-4 py-3">
            <span className="w-7 text-center flex-shrink-0">
              {medals[i]
                ? <span className="text-lg leading-none">{medals[i]}</span>
                : <span className="text-muted font-bold text-sm">{i + 1}</span>}
            </span>
            <Avatar username={member.username} avatarUrl={member.avatar_url} size="md" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm flex items-center gap-1 flex-wrap">
                {member.username}
                {member.role === 'admin' && <span className="badge badge-admin">ADMIN</span>}
              </p>
              <p className="text-[11px] text-muted">{ownedCount}/5 jugadores</p>
            </div>
            <span className="font-display text-lg text-gold">{total}pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}
