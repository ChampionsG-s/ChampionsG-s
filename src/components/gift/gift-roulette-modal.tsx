'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Gift } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { GIFT_OUTCOMES } from '@/lib/gift'
import { cn } from '@/lib/utils'

const SEG_W = 92
const OUTCOMES_LEN = GIFT_OUTCOMES.length
const SPIN_LAPS = 12 // vueltas completas que recorre cada giro antes de frenar
const REPEATS = 40 // largo total de la tira (debe cubrir varias vueltas + margen)
const STRIP = Array.from({ length: REPEATS }, () => GIFT_OUTCOMES).flat()
const START_INDEX = 10 * OUTCOMES_LEN + 2 // reposo inicial, alineado en "0"
// Si la posicion actual se acerca al final de la tira (relevante solo para
// el admin, que puede girar sin limite), la reciclamos por debajo sin
// animar: al ser ciclica cada OUTCOMES_LEN casillas, el color visible no
// cambia, solo el numero de indice interno.
const MAX_INDEX = STRIP.length - (SPIN_LAPS + 6) * OUTCOMES_LEN
// Curva tipo "apertura de caja": arranca muy rapido y frena en seco al
// final, simulando inercia (mucho recorrido resuelto en el primer tramo,
// luego una desaceleracion larga hasta pararse del todo).
const SPIN_EASING = 'cubic-bezier(0.08, 0.75, 0.15, 1)'
const SPIN_DURATION_MS = 5500

interface GiftRouletteModalProps {
  poolId: string
  block: number
  existingDelta: number | null
  unlocked: boolean
  isAdmin?: boolean
  onClose: () => void
  onSpun: (delta: number) => void
}

// Ruleta "regalo": una tira horizontal de colores gira hacia la izquierda
// (como si la ruleta se moviera hacia la derecha bajo un puntero fijo),
// arranca rapido y se frena por "inercia" hasta caer justo en el resultado
// que ya decidio el servidor via RPC gift_spin (nunca se calcula en el
// cliente). Al caer, el color ganador queda resaltado con un pulso de brillo,
// estilo apertura de caja.
export function GiftRouletteModal({ poolId, block, existingDelta, unlocked, isAdmin, onClose, onSpun }: GiftRouletteModalProps) {
  const supabase = createClient()
  const router = useRouter()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const targetIndexRef = useRef<number | null>(null)
  // Posicion actual (indice dentro de STRIP) que esta centrada bajo el
  // puntero. Persiste entre giros para que cada giro nuevo arranque desde
  // donde quedo el anterior, en vez de saltar siempre al mismo sitio.
  const positionRef = useRef<number>(START_INDEX)
  const [spinning, setSpinning] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [translate, setTranslate] = useState(0)
  const [landedIndex, setLandedIndex] = useState<number | null>(null)
  const [result, setResult] = useState<number | null>(existingDelta)
  const [error, setError] = useState<string | null>(null)

  const alreadySpun = existingDelta !== null

  const translateForIndex = (targetIndex: number) => {
    const containerWidth = viewportRef.current?.getBoundingClientRect().width ?? 320
    const targetCenter = targetIndex * SEG_W + SEG_W / 2
    return containerWidth / 2 - targetCenter
  }

  useEffect(() => {
    if (existingDelta !== null) {
      const outcomeIndex = GIFT_OUTCOMES.findIndex(o => o.delta === existingDelta)
      const idx = positionRef.current - (positionRef.current % OUTCOMES_LEN) + outcomeIndex
      positionRef.current = idx
      setTranslate(translateForIndex(idx))
      setLandedIndex(idx)
    } else {
      setTranslate(translateForIndex(positionRef.current)) // reposo centrado en el "0"
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingDelta])

  const handleSpin = async () => {
    if (spinning || alreadySpun) return
    setError(null)
    setResult(null)
    setLandedIndex(null)
    setShaking(true)
    setTimeout(() => setShaking(false), 320)

    const { data, error: rpcError } = await supabase.rpc('gift_spin', {
      target_pool: poolId,
      target_block: block,
    })

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    const delta = data as number
    const outcomeIndex = GIFT_OUTCOMES.findIndex(o => o.delta === delta)

    // Si nos quedamos sin margen (solo puede pasar con giros ilimitados de
    // admin), reciclamos la posicion por debajo antes de girar: al ser
    // ciclica, el color que se ve no cambia, solo el indice interno.
    let base = positionRef.current
    if (base > MAX_INDEX) {
      base = base % OUTCOMES_LEN
      positionRef.current = base
      setTranslate(translateForIndex(base))
    }

    const currentCol = base % OUTCOMES_LEN
    const forward = (outcomeIndex - currentCol + OUTCOMES_LEN) % OUTCOMES_LEN
    const targetIndex = base + SPIN_LAPS * OUTCOMES_LEN + forward
    targetIndexRef.current = targetIndex
    positionRef.current = targetIndex

    setSpinning(true)
    // Doble rAF: obliga al navegador a pintar el estado de reposo (con la
    // transicion ya activada, pero el recorrido reciclado si aplico) ANTES
    // de mover la tira al destino final. Si ambos cambios se aplicaran en
    // el mismo pintado, el navegador podria saltar directo sin animar.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTranslate(translateForIndex(targetIndex))
      })
    })
  }

  const handleTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== 'transform' || targetIndexRef.current === null) return
    const delta = GIFT_OUTCOMES[targetIndexRef.current % GIFT_OUTCOMES.length].delta
    setLandedIndex(targetIndexRef.current)
    setResult(delta)
    setSpinning(false)
    onSpun(delta)
    router.refresh()
  }

  const resultOutcome = result !== null ? GIFT_OUTCOMES.find(o => o.delta === result) : null

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
            <Gift size={20} className="text-gold" /> Ruleta regalo
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {!unlocked ? (
          <div className="p-4 space-y-4">
            <div className="rounded-xl border border-border bg-black/25 py-8 text-center space-y-2">
              <p className="text-3xl">🔒</p>
              <p className="font-display text-lg text-cream">Aún no puedes jugar</p>
              <p className="text-xs text-muted px-4">
                Esta ruleta se desbloquea cuando la jornada anterior esté abierta para apostar.
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
        ) : (
        <div className="p-4 space-y-4">
          <p className="text-xs text-muted text-center">
            Gira la ruleta y observa cómo los colores pasan. ¡Donde se detenga es lo que te toca!
          </p>

          <div className="rounded-xl bg-black/25 border border-white/10 p-3">
            <p className="text-[11px] font-bold text-cream mb-2">📋 Leyenda:</p>
            <div className="space-y-1.5">
              {GIFT_OUTCOMES.map(o => (
                <div key={o.delta} className="flex items-center gap-2 text-xs">
                  <span className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: o.color }} />
                  <span className="text-cream font-semibold">{o.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={cn('relative', shaking && 'gift-shake')}>
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 z-10 text-gold text-lg leading-none drop-shadow">▼</div>
            <div ref={viewportRef} className="relative h-20 overflow-hidden rounded-xl border border-border bg-black/40">
              <div
                className="absolute inset-y-0 left-1/2 z-10 border-x-2 border-gold pointer-events-none"
                style={{ width: SEG_W, transform: 'translateX(-50%)' }}
              />
              <div
                className="flex h-full"
                data-gift-track="true"
                onTransitionEnd={handleTrackTransitionEnd}
                style={{
                  transform: `translateX(${translate}px)`,
                  transition: spinning ? `transform ${SPIN_DURATION_MS}ms ${SPIN_EASING}` : 'none',
                }}
              >
                {STRIP.map((o, i) => {
                  const isLanded = landedIndex === i
                  const isDimmed = landedIndex !== null && !isLanded
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex-shrink-0 h-full flex items-center justify-center font-display text-xl text-white transition-opacity duration-300',
                        isLanded && 'gift-win-pulse ring-2 ring-white z-10',
                        isDimmed && 'opacity-30'
                      )}
                      style={{ width: SEG_W, backgroundColor: o.color }}
                    >
                      {o.delta > 0 ? `+${o.delta}` : o.delta}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-400 text-center">{error}</p>}

          {result !== null && resultOutcome && (
            <div className="space-y-3">
              <div
                className="rounded-xl py-2.5 text-center font-display text-base tracking-wide text-white"
                style={{ backgroundColor: resultOutcome.color }}
              >
                Color ganador: {resultOutcome.label}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 py-4 text-center space-y-1">
                <p className="text-2xl">🎉</p>
                <p
                  className={cn(
                    'font-display text-2xl',
                    resultOutcome.delta > 0 ? 'text-green-400' : resultOutcome.delta < 0 ? 'text-red-400' : 'text-cream'
                  )}
                >
                  {resultOutcome.delta > 0 ? `+${resultOutcome.delta}` : resultOutcome.delta} puntos
                </p>
                <p
                  className={cn(
                    'text-sm font-bold',
                    resultOutcome.delta > 0 ? 'text-green-400' : resultOutcome.delta < 0 ? 'text-red-400' : 'text-muted'
                  )}
                >
                  {resultOutcome.delta > 0
                    ? `¡Ganaste ${resultOutcome.delta} punto${resultOutcome.delta !== 1 ? 's' : ''}!`
                    : resultOutcome.delta < 0
                      ? `Perdiste ${Math.abs(resultOutcome.delta)} punto${Math.abs(resultOutcome.delta) !== 1 ? 's' : ''}`
                      : 'No ganaste ni perdiste puntos'}
                </p>
              </div>
            </div>
          )}

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
