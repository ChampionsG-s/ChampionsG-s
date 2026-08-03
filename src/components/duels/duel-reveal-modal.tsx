'use client'

import { useState } from 'react'
import { X, Swords } from 'lucide-react'
import { rankValue } from '@/lib/duels'
import { DeckStack, PlayingCardFlip } from './duel-card-visuals'
import { cn } from '@/lib/utils'
import type { Duel } from '@/types'

interface DuelRevealModalProps {
  duel: Duel
  currentUserId: string
  usersMap: Map<string, { username: string; avatar_url?: string | null }>
  onClose: () => void
}

// Ventana emergente para RE-VER el resultado de un duelo ya resuelto
// (ambas manos ya se sacaron). Las cartas arrancan boca abajo, apiladas
// como un mazo, y se van "levantando" de a una ronda por vez con un giro
// 3D ("Mostrar carta 1" revela la primera de ambos, "Mostrar carta 2" la
// segunda) hasta declarar el resultado.
export function DuelRevealModal({ duel, currentUserId, usersMap, onClose }: DuelRevealModalProps) {
  const [revealed, setRevealed] = useState(0)

  const isChallenger = duel.challenger_id === currentUserId
  const rivalId = isChallenger ? duel.opponent_id : duel.challenger_id
  const rivalName = usersMap.get(rivalId)?.username ?? 'Rival'

  const myCard1Rank = isChallenger ? duel.challenger_card1_rank : duel.opponent_card1_rank
  const myCard1Suit = isChallenger ? duel.challenger_card1_suit : duel.opponent_card1_suit
  const myCard2Rank = isChallenger ? duel.challenger_card2_rank : duel.opponent_card2_rank
  const myCard2Suit = isChallenger ? duel.challenger_card2_suit : duel.opponent_card2_suit
  const rivalCard1Rank = isChallenger ? duel.opponent_card1_rank : duel.challenger_card1_rank
  const rivalCard1Suit = isChallenger ? duel.opponent_card1_suit : duel.challenger_card1_suit
  const rivalCard2Rank = isChallenger ? duel.opponent_card2_rank : duel.challenger_card2_rank
  const rivalCard2Suit = isChallenger ? duel.opponent_card2_suit : duel.challenger_card2_suit

  const myTotal = rankValue(myCard1Rank!) + rankValue(myCard2Rank!)
  const rivalTotal = rankValue(rivalCard1Rank!) + rankValue(rivalCard2Rank!)
  const isTie = duel.winner_id === null
  const iWon = duel.winner_id === currentUserId
  const fullyRevealed = revealed >= 2

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
            <Swords size={20} className="text-gold" /> Duelo vs {rivalName}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!fullyRevealed && <DeckStack />}

          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <div className={cn('text-center rounded-xl px-2.5 py-2.5', fullyRevealed && iWon && 'ring-2 ring-green-400/70')}>
              <p className="text-[11px] font-bold text-muted uppercase tracking-wide mb-2">Vos</p>
              <div className="flex gap-2 justify-center">
                <PlayingCardFlip rank={myCard1Rank} suit={myCard1Suit} revealed={revealed >= 1} />
                <PlayingCardFlip rank={myCard2Rank} suit={myCard2Suit} revealed={revealed >= 2} />
              </div>
              <p className="font-display text-2xl text-cream mt-2">{fullyRevealed ? myTotal : '?'}</p>
            </div>
            <span className="text-gold font-black text-lg">VS</span>
            <div className={cn('text-center rounded-xl px-2.5 py-2.5', fullyRevealed && !iWon && !isTie && 'ring-2 ring-red-400/70')}>
              <p className="text-[11px] font-bold text-muted uppercase tracking-wide mb-2">{rivalName}</p>
              <div className="flex gap-2 justify-center">
                <PlayingCardFlip rank={rivalCard1Rank} suit={rivalCard1Suit} revealed={revealed >= 1} />
                <PlayingCardFlip rank={rivalCard2Rank} suit={rivalCard2Suit} revealed={revealed >= 2} />
              </div>
              <p className="font-display text-2xl text-cream mt-2">{fullyRevealed ? rivalTotal : '?'}</p>
            </div>
          </div>

          {fullyRevealed && (
            <p
              className={cn(
                'text-center font-display text-lg tracking-wide',
                isTie ? 'text-cream' : iWon ? 'text-green-400' : 'text-red-400'
              )}
            >
              {isTie
                ? '🤝 Empate — nadie gana ni pierde puntos'
                : iWon
                  ? `🏆 ¡Ganaste! Le quitaste 2 puntos a ${rivalName}`
                  : `💀 Perdiste — ${rivalName} te quitó 2 puntos`}
            </p>
          )}

          {revealed < 2 ? (
            <button
              type="button"
              onClick={() => setRevealed(r => r + 1)}
              className="w-full py-3 rounded-xl font-display text-lg tracking-wide bg-gradient-to-b from-gold-2 to-gold text-background shadow-md shadow-gold/20"
            >
              Mostrar carta {revealed + 1}
            </button>
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
      </div>
    </div>
  )
}
