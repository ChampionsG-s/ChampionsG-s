'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Swords } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/avatar'
import type { MemberTotal } from '@/lib/ranking-totals'

interface ChallengeModalProps {
  poolId: string
  currentUserId: string
  memberTotals: MemberTotal[]
  unlocked: boolean
  onClose: () => void
}

// Ventana de reto: lista a todos los miembros del pool con sus puntos
// (mismo total que ven en Ranking) para elegir a quien retar a un duelo
// de cartas. Aparece en /jornadas, no en Ranking. Solo esta disponible
// mientras la jornada de su bloque (2, 5, 8...) este abierta, igual que
// la ruleta regalo.
export function ChallengeModal({ poolId, currentUserId, memberTotals, unlocked, onClose }: ChallengeModalProps) {
  const supabase = createClient()
  const router = useRouter()
  const [challengingId, setChallengingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const others = memberTotals.filter(m => m.user_id !== currentUserId)

  const handleChallenge = async (opponentId: string, username: string) => {
    setChallengingId(opponentId)
    setError(null)
    const { error: rpcError } = await supabase.rpc('create_duel', { target_pool: poolId, target_opponent: opponentId })
    setChallengingId(null)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setSentTo(username)
    router.refresh()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gold/30 bg-[linear-gradient(155deg,rgba(29,47,83,0.55),rgba(10,15,30,0.98)_45%,rgba(7,11,22,0.99)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 flex-shrink-0">
          <h3 className="font-display text-lg tracking-wide text-cream flex items-center gap-2">
            <Swords size={20} className="text-gold" /> Retar a un duelo
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {!unlocked ? (
          <div className="p-4">
            <div className="rounded-xl border border-border bg-black/25 py-8 text-center space-y-2">
              <p className="text-3xl">🔒</p>
              <p className="font-display text-lg text-cream">Aún no puedes retar</p>
              <p className="text-xs text-muted px-4">
                El reto se desbloquea cuando la jornada anterior esté abierta para apostar.
              </p>
            </div>
          </div>
        ) : (
        <div className="p-4 space-y-3 overflow-y-auto">
          <p className="text-xs text-muted text-center">
            Cada uno saca 2 cartas de la baraja española; quien saque más puntos le quita 2 al otro.
          </p>

          {sentTo && (
            <p className="text-xs font-bold text-green-400 text-center bg-green-900/20 border border-green-800/60 rounded-lg py-2">
              ¡Reto enviado a {sentTo}!
            </p>
          )}
          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          <div className="rounded-xl border border-white/10 bg-black/25 divide-y divide-border/60 overflow-hidden">
            {others.map(m => (
              <div key={m.user_id} className="flex items-center gap-3 px-3.5 py-2.5">
                <Avatar username={m.username} avatarUrl={m.avatar_url} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-cream truncate">{m.username}</p>
                  <p className="text-[11px] text-muted">{m.total}pts</p>
                </div>
                <button
                  type="button"
                  disabled={challengingId === m.user_id}
                  onClick={() => handleChallenge(m.user_id, m.username)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-b from-gold-2 to-gold text-background disabled:opacity-50"
                >
                  {challengingId === m.user_id ? '...' : 'Retar'}
                </button>
              </div>
            ))}
            {others.length === 0 && (
              <p className="text-xs text-muted text-center py-4">No hay otros miembros para retar todavía.</p>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
