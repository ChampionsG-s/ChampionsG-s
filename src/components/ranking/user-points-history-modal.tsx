'use client'

import { X } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import type { UserPointsHistory } from '@/lib/points-history'

interface UserPointsHistoryModalProps {
  username: string
  avatarUrl?: string | null
  total: number
  history: UserPointsHistory
  onClose: () => void
}

function PointsPill({ points }: { points: number }) {
  return (
    <span
      className={cn(
        'text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0',
        points > 0 ? 'bg-green-900 text-green-300' : points < 0 ? 'bg-red-900 text-red-300' : 'bg-surface-2 text-muted'
      )}
    >
      {points > 0 ? `+${points}` : points} pt{Math.abs(points) !== 1 ? 's' : ''}
    </span>
  )
}

// Historial de puntos de un usuario: predicciones agrupadas por jornada
// (con cualquier mini-juego que le haya tocado esa misma jornada debajo),
// mas los duelos aparte al final ya que no estan atados a una jornada.
export function UserPointsHistoryModal({ username, avatarUrl, total, history, onClose }: UserPointsHistoryModalProps) {
  const hasContent = history.jornadas.length > 0 || history.duels.length > 0

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gold/30 bg-[linear-gradient(155deg,rgba(29,47,83,0.55),rgba(10,15,30,0.98)_45%,rgba(7,11,22,0.99)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5 flex-shrink-0">
          <Avatar username={username} avatarUrl={avatarUrl} size="md" />
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-lg tracking-wide text-cream truncate">{username}</h3>
            <p className="text-xs text-muted">Historial de puntos</p>
          </div>
          <span className="font-display text-xl text-gold flex-shrink-0">{total} pts</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-2.5">
          {!hasContent && (
            <p className="text-sm text-muted text-center py-6">Todavía no hay puntos que mostrar.</p>
          )}

          {history.jornadas.map(j => (
            <div key={j.number} className="rounded-xl border border-border bg-black/25 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-cream">{j.label}</span>
                <PointsPill points={j.matchPoints} />
              </div>
              {j.games.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
                  {j.games.map((g, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 pl-1">
                      <span className="text-xs text-muted flex items-center gap-1.5">
                        <span>{g.icon}</span>
                        <span>{g.label}</span>
                      </span>
                      <PointsPill points={g.points} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {history.duels.length > 0 && (
            <div className="rounded-xl border border-border bg-black/25 px-3.5 py-2.5">
              <p className="font-bold text-sm text-cream mb-2">⚔️ Duelos</p>
              <div className="space-y-1.5">
                {history.duels.map((d, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">
                      {d.won ? 'Ganó a' : 'Perdió contra'} <span className="font-semibold text-cream">{d.opponentUsername}</span>
                    </span>
                    <PointsPill points={d.points} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
