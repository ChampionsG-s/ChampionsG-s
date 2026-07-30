'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Flag } from '@/components/ui/flag'
import { PlayerPhoto } from './player-photo'
import { poachPrice, jornadasUntilPoachable, type EquipoEntry } from '@/lib/equipo/formation'

const POSITION_LABEL: Record<number, string> = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' }

interface PlayerDetailModalProps {
  entry: EquipoEntry | null
  currentJornada: number
  onClose: () => void
}

// Ficha de un jugador de la plantilla de OTRO miembro (se abre al pulsar
// su carta desde el ranking de Equipo), con la misma logica de fichaje
// directo que las cartas del mercado: si ya lleva 2 jornadas con su dueno
// se puede comprar ya; si no, se ve bloqueado pero con el precio que
// costara en cuanto se desbloquee.
export function PlayerDetailModal({ entry, currentJornada, onClose }: PlayerDetailModalProps) {
  const supabase = createClient()
  const router = useRouter()
  const [buying, setBuying] = useState(false)

  if (!entry) return null
  const { roster, player } = entry
  const price = poachPrice(player.coin_price)
  const remaining = jornadasUntilPoachable(roster.acquired_jornada, currentJornada)
  const locked = remaining > 0

  const handlePoach = async () => {
    if (!confirm(`¿Fichar a ${player.name} por ${price.toLocaleString('es-ES')} monedas?`)) return
    setBuying(true)
    const { error } = await supabase.rpc('equipo_poach_player', { target_roster_id: roster.id })
    setBuying(false)
    if (error) {
      alert(error.message)
      return
    }
    onClose()
    router.refresh()
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
          <h3 className="font-display text-lg tracking-wide text-cream">Ficha del jugador</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <PlayerPhoto name={player.name} photoUrl={player.photo_url} heroPhotoUrl={player.hero_photo_url} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-base text-cream truncate">{player.name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Flag team={player.team_name} size="sm" />
                <span className="text-xs text-muted truncate">{player.team_name}</span>
                <span className="badge bg-surface-2 border border-border text-muted text-[9px] flex-shrink-0">
                  {POSITION_LABEL[player.position] ?? '?'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-black/25 border border-white/10 py-3 text-center">
            <p className="text-[10px] text-muted uppercase tracking-wide">
              {locked ? 'Precio cuando se desbloquee' : 'Precio de fichaje'}
            </p>
            <p className="font-display text-2xl text-gold">{price.toLocaleString('es-ES')}</p>
          </div>

          {locked ? (
            <div className="text-center space-y-1.5 rounded-xl border border-border bg-surface-2/60 py-3 px-2">
              <span className="badge bg-surface-2 border border-border text-muted">Bloqueado</span>
              <p className="text-xs text-muted">
                Podrás ficharlo dentro de {remaining} jornada{remaining !== 1 ? 's' : ''} por{' '}
                <span className="text-cream font-bold">{price.toLocaleString('es-ES')}</span> monedas.
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={buying}
              onClick={handlePoach}
              className="w-full py-3 rounded-xl font-display text-lg tracking-wide bg-gradient-to-b from-gold-2 to-gold text-background shadow-md shadow-gold/20 disabled:opacity-50"
            >
              {buying ? 'Fichando...' : `Fichar ya · ${price.toLocaleString('es-ES')}`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
