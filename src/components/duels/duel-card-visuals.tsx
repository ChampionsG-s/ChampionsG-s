'use client'

import { cn } from '@/lib/utils'
import { rankLabel } from '@/lib/duels'
import type { DuelSuit } from '@/types'

// Cartas reales: fotos de una baraja española Fournier de 1878 (dominio
// publico, Fournier Museum of Playing Cards / Wikimedia Commons), no
// dibujos aproximados. Archivos en public/cards/{palo}-{rango}.webp.

export function DeckStack() {
  return (
    <div className="flex justify-center">
      <div className="relative w-14 h-20">
        <div className="absolute inset-0 rounded-md overflow-hidden translate-x-1.5 translate-y-1 rotate-6 shadow-[0_4px_10px_rgba(0,0,0,0.4)]">
          <img src="/cards/back.webp" alt="" className="w-full h-full object-cover opacity-80" />
        </div>
        <div className="absolute inset-0 rounded-md overflow-hidden translate-x-0.5 translate-y-0.5 -rotate-3 shadow-[0_4px_10px_rgba(0,0,0,0.4)]">
          <img src="/cards/back.webp" alt="" className="w-full h-full object-cover opacity-90" />
        </div>
        <div className="absolute inset-0 rounded-md overflow-hidden shadow-[0_4px_10px_rgba(0,0,0,0.4)] border border-gold/40">
          <img src="/cards/back.webp" alt="" className="w-full h-full object-cover" />
        </div>
      </div>
    </div>
  )
}

// Carta con giro 3D: arranca boca abajo (dorso) y al revelarse hace un
// arco hacia arriba mientras gira sobre el eje Y, como si se levantara
// del mazo y se diera vuelta a mano, hasta mostrar la foto real.
export function PlayingCardFlip({ rank, suit, revealed }: { rank: number | null; suit: DuelSuit | null; revealed: boolean }) {
  return (
    <div className="duel-flip-perspective w-16 h-24">
      <div className={cn('duel-flip-inner', revealed && 'duel-flip-revealed')}>
        <div className="duel-flip-face duel-flip-back overflow-hidden">
          <img src="/cards/back.webp" alt="" className="w-full h-full object-cover" />
        </div>
        <div className="duel-flip-face duel-flip-front overflow-hidden">
          {rank !== null && suit !== null && (
            <img
              src={`/cards/${suit}-${rank}.webp`}
              alt={`${rankLabel(rank)} de ${suit}`}
              className="w-full h-full object-cover"
            />
          )}
        </div>
      </div>
    </div>
  )
}
