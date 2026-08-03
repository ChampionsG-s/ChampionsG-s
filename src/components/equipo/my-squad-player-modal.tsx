'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Flag } from '@/components/ui/flag'
import { PlayerPhoto } from './player-photo'
import { ConfirmModal } from './confirm-modal'
import { SELL_RATIO, type EquipoEntry } from '@/lib/equipo/formation'

const POSITION_LABEL: Record<number, string> = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' }

interface MySquadPlayerModalProps {
  entry: EquipoEntry | null
  onClose: () => void
  isLastInPosition?: boolean
}

// Ficha de un jugador de TU PROPIA plantilla (se abre al pulsar su carta),
// con la opcion de venderlo por venta rapida (65% de lo que pagaste, la
// misma penalizacion que si nadie te lo hubiera comprado directamente).
export function MySquadPlayerModal({ entry, onClose, isLastInPosition }: MySquadPlayerModalProps) {
  const supabase = createClient()
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [selling, setSelling] = useState(false)

  if (!entry) return null
  const { roster, player } = entry
  const sellPrice = Math.round(player.coin_price * SELL_RATIO)

  const handleSellConfirmed = async () => {
    setSelling(true)
    const { error } = await supabase.rpc('equipo_sell_player', { target_roster_id: roster.id })
    setSelling(false)
    setConfirming(false)
    if (error) {
      toast.error(error.message)
      return
    }
    onClose()
    router.refresh()
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-gold/30 bg-[linear-gradient(155deg,rgba(29,47,83,0.55),rgba(10,15,30,0.98)_45%,rgba(7,11,22,0.99)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
            <h3 className="font-display text-lg tracking-wide text-cream">Tu jugador</h3>
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
              <p className="text-[10px] text-muted uppercase tracking-wide">Venta rápida (65% de lo pagado)</p>
              <p className="font-display text-2xl text-gold">{sellPrice.toLocaleString('es-ES')}</p>
            </div>

            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="w-full py-3 rounded-xl font-display text-lg tracking-wide bg-red-900/50 border border-red-700 text-red-200 hover:bg-red-900/70 transition-colors"
            >
              Vender rápido
            </button>
          </div>
        </div>
      </div>

      {confirming && (
        <ConfirmModal
          title={isLastInPosition ? '¡Cuidado!' : '¿Seguro?'}
          message={
            isLastInPosition
              ? `${player.name} es tu único jugador de ${POSITION_LABEL[player.position] ?? 'esa posición'}. Si lo vendes por ${sellPrice.toLocaleString('es-ES')} monedas te quedarás sin nadie ahí — ya no se asigna un reemplazo gratis automático.`
              : `Vas a vender a ${player.name} por ${sellPrice.toLocaleString('es-ES')} monedas (65% de lo que pagaste, por venta rápida).`
          }
          confirmLabel={`Vender · ${sellPrice.toLocaleString('es-ES')}`}
          loading={selling}
          onConfirm={handleSellConfirmed}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}
