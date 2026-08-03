'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Shuffle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TEAM_ROULETTE_WIN_BONUS } from '@/lib/team-roulette'
import { Flag } from '@/components/ui/flag'
import { cn } from '@/lib/utils'
import type { TeamRouletteSpin, TeamSide } from '@/types'

export interface TeamRouletteEntry {
  matchId: string
  side: TeamSide
  name: string
}

interface TeamRouletteModalProps {
  poolId: string
  currentUserId: string
  jornadaNumber: number
  jornadaLabel: string
  entries: TeamRouletteEntry[]
  existingSpin: TeamRouletteSpin | null
  winStatus: 'pending' | 'won' | 'lost' | null
  unlocked: boolean
  isAdmin?: boolean
  onClose: () => void
  onSpun: (spin: TeamRouletteSpin) => void
}

const SHUFFLE_MS = 1600
const SHUFFLE_TICK_MS = 90

// Ruleta de equipos: al girar, el cliente muestra un "barajeo" visual de
// nombres al azar (solo estetico) mientras el servidor decide de verdad
// que equipo toca (RPC team_roulette_spin, protegido igual que
// gift_spin para que nadie pueda elegir el favorito). El admin puede
// repetir el giro sin limite para probar: sus giros no se guardan.
export function TeamRouletteModal({
  poolId, currentUserId, jornadaNumber, jornadaLabel, entries, existingSpin, winStatus, unlocked, isAdmin, onClose, onSpun,
}: TeamRouletteModalProps) {
  const supabase = createClient()
  const router = useRouter()
  const effectivelyUnlocked = unlocked || !!isAdmin
  const [spinning, setSpinning] = useState(false)
  const [shuffleName, setShuffleName] = useState<string | null>(null)
  const [result, setResult] = useState<TeamRouletteEntry | null>(
    existingSpin && !isAdmin ? { matchId: existingSpin.match_id, side: existingSpin.team_side, name: existingSpin.team_name } : null
  )
  const [error, setError] = useState<string | null>(null)
  const shuffleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => { if (shuffleTimerRef.current) clearInterval(shuffleTimerRef.current) }
  }, [])

  const alreadySpun = !isAdmin && existingSpin !== null

  const handleSpin = async () => {
    if (spinning || alreadySpun || entries.length === 0) return
    setError(null)
    setResult(null)
    setSpinning(true)

    shuffleTimerRef.current = setInterval(() => {
      setShuffleName(entries[Math.floor(Math.random() * entries.length)].name)
    }, SHUFFLE_TICK_MS)

    const [rpcResult] = await Promise.all([
      supabase.rpc('team_roulette_spin', { target_pool: poolId, target_jornada: jornadaNumber }),
      new Promise(resolve => setTimeout(resolve, SHUFFLE_MS)),
    ])

    if (shuffleTimerRef.current) { clearInterval(shuffleTimerRef.current); shuffleTimerRef.current = null }
    setSpinning(false)

    const { data, error: rpcError } = rpcResult
    if (rpcError || !data || data.length === 0) {
      setError(rpcError?.message ?? 'Error al girar la ruleta.')
      return
    }

    const row = data[0] as { match_id: string; team_side: TeamSide; team_name: string }
    const picked: TeamRouletteEntry = { matchId: row.match_id, side: row.team_side, name: row.team_name }
    setResult(picked)

    if (!isAdmin) {
      onSpun({
        id: `local-${jornadaNumber}`,
        pool_id: poolId,
        user_id: currentUserId,
        jornada_number: jornadaNumber,
        match_id: picked.matchId,
        team_side: picked.side,
        team_name: picked.name,
        created_at: new Date().toISOString(),
      })
      router.refresh()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-gold/30 bg-[linear-gradient(155deg,rgba(29,47,83,0.55),rgba(10,15,30,0.98)_45%,rgba(7,11,22,0.99)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
          <h3 className="font-display text-lg tracking-wide text-cream flex items-center gap-2">
            <Shuffle size={20} className="text-gold" /> Ruleta de equipos
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {!effectivelyUnlocked ? (
          <div className="p-4 space-y-4">
            <div className="rounded-xl border border-border bg-black/25 py-8 text-center space-y-2">
              <p className="text-3xl">🔒</p>
              <p className="font-display text-lg text-cream">Aún no puedes jugar</p>
              <p className="text-xs text-muted px-4">
                Esta ruleta se desbloquea cuando la jornada esté abierta para apostar.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl font-bold text-sm border border-border text-cream hover:border-gold transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-4 space-y-4">
            <div className="rounded-xl border border-border bg-black/25 py-8 text-center space-y-2">
              <p className="text-3xl">🚧</p>
              <p className="font-display text-lg text-cream">Sin partidos todavía</p>
              <p className="text-xs text-muted px-4">Vuelve más tarde, aún no hay partidos cargados en {jornadaLabel}.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl font-bold text-sm border border-border text-cream hover:border-gold transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {isAdmin && (
              <p className="text-[10px] font-bold uppercase tracking-wide text-red-300 bg-red-900/20 border border-red-900/50 rounded-lg px-2.5 py-1.5 text-center">
                Modo admin: no se guarda ni afecta al ranking
              </p>
            )}

            <p className="text-xs text-muted text-center">
              Te toca al azar un equipo de {jornadaLabel}. Si gana su partido, sumas {TEAM_ROULETTE_WIN_BONUS} punto extra.
            </p>

            <div
              className={cn(
                'rounded-2xl border bg-black/30 py-8 px-4 flex flex-col items-center gap-3 transition-all',
                spinning ? 'border-gold/40' : result ? 'border-green-500/60' : 'border-border'
              )}
            >
              {spinning ? (
                <>
                  <Flag team={shuffleName ?? ''} size="lg" />
                  <p className="font-display text-lg text-cream animate-pulse">{shuffleName ?? '...'}</p>
                </>
              ) : result ? (
                <>
                  <Flag team={result.name} size="lg" />
                  <p className="font-display text-xl text-gold tracking-wide">{result.name}</p>
                  {winStatus === 'won' && (
                    <span className="text-xs font-bold text-green-400">🎉 ¡Ganó! +{TEAM_ROULETTE_WIN_BONUS} punto</span>
                  )}
                  {winStatus === 'lost' && (
                    <span className="text-xs font-bold text-red-400">No ganó su partido</span>
                  )}
                  {winStatus === 'pending' && (
                    <span className="text-xs font-bold text-muted text-center px-2">
                      Si gana {result.name}, obtienes {TEAM_ROULETTE_WIN_BONUS} punto extra para el ranking
                    </span>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted">Toca girar para conocer tu equipo</p>
              )}
            </div>

            {error && <p className="text-xs text-red-400 text-center">{error}</p>}

            {!alreadySpun && (result === null || isAdmin) ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={spinning}
                  onClick={handleSpin}
                  className="flex-1 py-3 rounded-xl font-display text-lg tracking-wide bg-gradient-to-b from-gold-2 to-gold text-background shadow-md shadow-gold/20 disabled:opacity-50"
                >
                  {spinning ? 'Girando...' : result !== null ? 'Girar otra vez (admin)' : 'Girar Ruleta'}
                </button>
                <button
                  type="button"
                  disabled={spinning}
                  onClick={onClose}
                  className="px-5 py-3 rounded-xl font-bold text-sm border border-border text-cream hover:border-gold transition-colors disabled:opacity-50"
                >
                  {result !== null ? 'Cerrar' : 'Saltar'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-xl font-bold text-sm border border-border text-cream hover:border-gold transition-colors"
              >
                Cerrar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
