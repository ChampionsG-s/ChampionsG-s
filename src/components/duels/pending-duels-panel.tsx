'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DuelRevealModal } from './duel-reveal-modal'
import { DuelDrawModal } from './duel-draw-modal'
import type { Duel } from '@/types'

interface ResolvedNotification {
  notificationId: string
  duel: Duel
}

interface PendingDuelsPanelProps {
  incomingDuels: Duel[]
  outgoingDuels: Duel[]
  readyToDrawDuels: Duel[]
  resolvedNotifications: ResolvedNotification[]
  currentUserId: string
  usersMap: Map<string, { username: string; avatar_url?: string | null }>
}

// Panel de duelos en /jornadas: retos que te hicieron (aceptar/rechazar),
// retos tuyos esperando respuesta, duelos ya aceptados donde podes entrar
// a sacar tus cartas, y avisos de resultados que todavia no viste. El
// juego en si (sacar/revelar cartas) se muestra en una ventana emergente,
// igual que la ruleta regalo.
export function PendingDuelsPanel({
  incomingDuels,
  outgoingDuels,
  readyToDrawDuels,
  resolvedNotifications,
  currentUserId,
  usersMap,
}: PendingDuelsPanelProps) {
  const supabase = createClient()
  const router = useRouter()
  const [respondingId, setRespondingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissedNotifIds, setDismissedNotifIds] = useState<Set<string>>(new Set())
  const [drawTarget, setDrawTarget] = useState<Duel | null>(null)
  const [revealTarget, setRevealTarget] = useState<{ duel: Duel; notificationId?: string } | null>(null)

  const visibleResolved = resolvedNotifications.filter(r => !dismissedNotifIds.has(r.notificationId))

  if (
    incomingDuels.length === 0 &&
    outgoingDuels.length === 0 &&
    readyToDrawDuels.length === 0 &&
    visibleResolved.length === 0 &&
    !drawTarget &&
    !revealTarget
  ) {
    return null
  }

  const handleRespond = async (duelId: string, accept: boolean) => {
    setRespondingId(duelId)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('respond_duel', { target_duel: duelId, accept })
    setRespondingId(null)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    // Al aceptar, el duelo queda "accepted" (sin cartas todavia): entramos
    // directo a sacar las nuestras.
    if (accept) setDrawTarget(data as Duel)
    router.refresh()
  }

  const dismissNotification = async (notificationId: string) => {
    setDismissedNotifIds(prev => new Set(prev).add(notificationId))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId)
  }

  const closeReveal = () => {
    if (revealTarget?.notificationId) dismissNotification(revealTarget.notificationId)
    setRevealTarget(null)
  }

  return (
    <div className="space-y-2.5">
      {incomingDuels.map(duel => {
        const challenger = usersMap.get(duel.challenger_id)
        return (
          <div
            key={duel.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-gold/40 bg-gold/[0.06] px-4 py-3"
          >
            <span className="text-sm text-cream">
              ⚔️ <span className="font-bold">{challenger?.username ?? 'Alguien'}</span> te retó a un duelo de cartas
            </span>
            <div className="flex gap-1.5 flex-shrink-0">
              <button
                type="button"
                disabled={respondingId === duel.id}
                onClick={() => handleRespond(duel.id, true)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-b from-gold-2 to-gold text-background disabled:opacity-50"
              >
                Aceptar
              </button>
              <button
                type="button"
                disabled={respondingId === duel.id}
                onClick={() => handleRespond(duel.id, false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-border text-cream hover:border-red-500 disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          </div>
        )
      })}

      {outgoingDuels.map(duel => {
        const opponent = usersMap.get(duel.opponent_id)
        return (
          <div key={duel.id} className="rounded-xl border border-border bg-black/20 px-4 py-3 text-sm text-muted">
            ⏳ Esperando que <span className="font-bold text-cream">{opponent?.username ?? 'tu rival'}</span> responda tu duelo
          </div>
        )
      })}

      {readyToDrawDuels.map(duel => {
        const rivalId = duel.challenger_id === currentUserId ? duel.opponent_id : duel.challenger_id
        const rivalName = usersMap.get(rivalId)?.username ?? 'tu rival'
        return (
          <button
            key={duel.id}
            type="button"
            onClick={() => setDrawTarget(duel)}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-gold/40 bg-gold/[0.06] px-4 py-3 text-left hover:bg-gold/10 transition-colors"
          >
            <span className="text-sm text-cream">⚔️ Podés sacar tus cartas contra <span className="font-bold">{rivalName}</span></span>
            <span className="text-xs font-bold text-gold flex-shrink-0">Entrar</span>
          </button>
        )
      })}

      {error && <p className="text-xs text-red-400 px-1">{error}</p>}

      {visibleResolved.map(({ notificationId, duel }) => {
        const rivalId = duel.challenger_id === currentUserId ? duel.opponent_id : duel.challenger_id
        const rivalName = usersMap.get(rivalId)?.username ?? 'tu rival'
        return (
          <button
            key={notificationId}
            type="button"
            onClick={() => setRevealTarget({ duel, notificationId })}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-gold/40 bg-gold/[0.06] px-4 py-3 text-left hover:bg-gold/10 transition-colors"
          >
            <span className="text-sm text-cream">⚔️ Tu duelo contra <span className="font-bold">{rivalName}</span> ya se resolvió</span>
            <span className="text-xs font-bold text-gold flex-shrink-0">Ver resultado</span>
          </button>
        )
      })}

      {drawTarget && (
        <DuelDrawModal
          duel={drawTarget}
          currentUserId={currentUserId}
          usersMap={usersMap}
          onClose={() => setDrawTarget(null)}
        />
      )}

      {revealTarget && (
        <DuelRevealModal
          duel={revealTarget.duel}
          currentUserId={currentUserId}
          usersMap={usersMap}
          onClose={closeReveal}
        />
      )}
    </div>
  )
}
