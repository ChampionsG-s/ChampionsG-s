'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AWARDS, ALL_TEAMS } from '@/lib/data/matches'
import { cn } from '@/lib/utils'
import type { AwardPrediction, AwardResult, PoolMember } from '@/types'

interface AwardsPredictionsViewProps {
  poolId: string
  predictions: AwardPrediction[]
  results: AwardResult[]
  squad: string[]
  membership: PoolMember
}

// Notable players from other top teams, for autocomplete on player-type awards
const NOTABLE_PLAYERS = [
  'Kylian Mbappé', 'Antoine Griezmann', 'Ousmane Dembélé', 'Vinicius Jr', 'Rodrygo', 'Raphinha',
  'Lionel Messi', 'Julián Álvarez', 'Lautaro Martínez', 'Bruno Fernandes', 'Rafael Leão',
  'Florian Wirtz', 'Jamal Musiala', 'Jude Bellingham', 'Harry Kane', 'Bukayo Saka',
  'Erling Haaland', 'Martin Ødegaard', 'Luka Modrić', 'Kevin De Bruyne', 'Romelu Lukaku',
  'Son Heung-min', 'Achraf Hakimi', 'Mohammed Kudus',
]

export function AwardsPredictionsView({ poolId, predictions: initialPreds, results: initialResults, squad, membership }: AwardsPredictionsViewProps) {
  const supabase = createClient()
  const [predictions, setPredictions] = useState(initialPreds)
  const [results, setResults] = useState(initialResults)
  const [localLocked, setLocalLocked] = useState(membership.locked_awards)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const allPlayers = Array.from(new Set([...squad, ...NOTABLE_PLAYERS])).sort((a, b) => a.localeCompare(b))

  useEffect(() => {
    const channel = supabase
      .channel(`awards-global`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_award_results' },
        (payload) => {
          setResults(prev => {
            const filtered = prev.filter(r => r.id !== (payload.new as AwardResult)?.id)
            return payload.eventType === 'DELETE' ? filtered : [...filtered, payload.new as AwardResult]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const getPred = (awardId: string) => predictions.find(p => p.award_id === awardId)?.value ?? ''
  const getResult = (awardId: string) => results.find(r => r.award_id === awardId)?.value

  const handleChange = useCallback(async (awardId: string, value: string) => {
    if (localLocked) return
    setPredictions(prev => [...prev.filter(p => p.award_id !== awardId), { pool_id: poolId, user_id: membership.user_id, award_id: awardId, value } as AwardPrediction])

    try {
      await supabase.from('award_predictions').upsert({
        pool_id: poolId,
        user_id: membership.user_id,
        award_id: awardId,
        value,
      }, { onConflict: 'pool_id,user_id,award_id' })
    } catch (err) {
      console.error('Error saving award prediction:', err)
      alert('Error al guardar la predicción de premio. Intenta de nuevo.')
    }
  }, [localLocked, poolId, membership.user_id, supabase])

  const handleLock = async () => {
    setSaving(true)
    try {
      await supabase.from('pool_members').update({ locked_awards: true }).eq('pool_id', poolId).eq('user_id', membership.user_id)
      setLocalLocked(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Error locking awards predictions:', err)
      alert('Error al bloquear predicciones. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-black text-lg tracking-wide text-gold mb-1">🏅 Premios Oficiales FIFA</h2>
        <p className="text-xs text-muted">Autocompletado con jugadores del Mundial. Campo libre.</p>
      </div>

      {localLocked ? (
        <div className="bg-blue-900/30 border border-blue-700 rounded-xl px-4 py-3 text-sm">
          🔒 Predicciones de premios bloqueadas
        </div>
      ) : (
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl px-4 py-3 text-sm text-amber-200">
          ⚠️ Al guardar quedarán <strong>bloqueadas definitivamente</strong>
        </div>
      )}

      <div className="space-y-2">
        {AWARDS.map(award => (
          <AwardRow
            key={award.id}
            award={award}
            value={getPred(award.id)}
            official={getResult(award.id)}
            options={award.type === 'team' ? ALL_TEAMS : allPlayers}
            disabled={localLocked}
            onChange={(v) => handleChange(award.id, v)}
          />
        ))}
      </div>

      {!localLocked && (
        <div className="fixed bottom-16 left-0 right-0 z-30 bg-surface-2 border-t border-gold px-4 py-3 shadow-2xl">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-amber-200">
              {saved ? '✓ Guardado y bloqueado para siempre' : '⚠️ Guardar bloqueará definitivamente'}
            </span>
            <button onClick={handleLock} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
              {saving ? 'Guardando...' : '🔒 Bloquear premios'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Award row ──────────────────────────────────────────────────────────────────

interface AwardRowProps {
  award: typeof AWARDS[number]
  value: string
  official?: string
  options: string[]
  disabled: boolean
  onChange: (v: string) => void
}

function AwardRow({ award, value, official, options, disabled, onChange }: AwardRowProps) {
  const [local, setLocal] = useState(value)
  const hasOfficial = !!official
  const correct = hasOfficial && value.trim().toLowerCase() === official!.trim().toLowerCase()
  const listId = `award-${award.id}`

  useEffect(() => { setLocal(value) }, [value])

  return (
    <div className="bg-surface-2 border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{award.icon}</span>
        <div className="flex-1">
          <p className="font-semibold text-sm">{award.label}</p>
          <p className="text-xs text-muted">{award.desc}</p>
        </div>
        <span className="text-sm font-black text-gold bg-gold/10 px-2 py-0.5 rounded-lg">+{award.pts}pts</span>
      </div>
      <div className="flex items-center gap-2">
        <datalist id={listId}>{options.map(o => <option key={o} value={o} />)}</datalist>
        <input
          className={cn('input flex-1', hasOfficial && (correct ? 'border-green-700 bg-green-950/30' : 'border-red-800'))}
          list={listId}
          value={local}
          disabled={disabled || hasOfficial}
          placeholder="Tu predicción..."
          onChange={(e) => setLocal(e.target.value)}
          onBlur={(e) => onChange(e.target.value)}
        />
        <span className={cn(
          'text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap',
          hasOfficial ? (correct ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300') : 'bg-blue-900 text-blue-300'
        )}>
          {hasOfficial ? (correct ? `✓ +${award.pts}pts` : official) : 'Pendiente'}
        </span>
      </div>
    </div>
  )
}
