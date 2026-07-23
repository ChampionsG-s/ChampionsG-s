'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { SPAIN_FIELDS } from '@/lib/data/matches'
import { cn } from '@/lib/utils'
import type { SpainPrediction, SpainResult, PoolMember } from '@/types'

interface SpainPredictionsViewProps {
  poolId: string
  predictions: SpainPrediction[]
  results: SpainResult[]
  squad: string[]
  membership: PoolMember
}

const SECTIONS = [
  { title: '👟 Goleadores de España', desc: 'Solo jugadores de la plantilla oficial española', fields: ['es_s1', 'es_s2', 'es_s3', 'es_s4'] },
  { title: '📊 Clasificación Grupo H', desc: 'España · Cabo Verde · Arabia Saudí · Uruguay', fields: ['es_g1', 'es_g2', 'es_g3'] },
  { title: '🗺️ Trayectoria España', desc: '', fields: ['es_fase', 'es_expyn'] },
  { title: '🟥 Expulsados España', desc: '', fields: ['es_exp1', 'es_exp2'] },
  { title: '📈 Estadísticas totales', desc: '', fields: ['es_goals', 'es_wins'] },
]

export function SpainPredictionsView({ poolId, predictions: initialPreds, results: initialResults, squad, membership }: SpainPredictionsViewProps) {
  const supabase = createClient()
  const [predictions, setPredictions] = useState(initialPreds)
  const [results, setResults] = useState(initialResults)
  const [localLocked, setLocalLocked] = useState(membership.locked_spain)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const channel = supabase
      .channel(`spain-global`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_spain_results' },
        (payload) => {
          setResults(prev => {
            const filtered = prev.filter(r => r.id !== (payload.new as SpainResult)?.id)
            return payload.eventType === 'DELETE' ? filtered : [...filtered, payload.new as SpainResult]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const getPred = (fieldId: string) => predictions.find(p => p.field_id === fieldId)?.value ?? ''
  const getResult = (fieldId: string) => results.find(r => r.field_id === fieldId)?.value

  const handleChange = useCallback(async (fieldId: string, value: string) => {
    if (localLocked) return
    setPredictions(prev => [...prev.filter(p => p.field_id !== fieldId), { pool_id: poolId, user_id: membership.user_id, field_id: fieldId, value } as SpainPrediction])

    try {
      await supabase.from('spain_predictions').upsert({
        pool_id: poolId,
        user_id: membership.user_id,
        field_id: fieldId,
        value,
      }, { onConflict: 'pool_id,user_id,field_id' })
    } catch (err) {
      console.error('Error saving spain prediction:', err)
      alert('Error al guardar la predicción. Intenta de nuevo.')
    }
  }, [localLocked, poolId, membership.user_id, supabase])

  const handleLock = async () => {
    setSaving(true)
    try {
      await supabase.from('pool_members').update({ locked_spain: true }).eq('pool_id', poolId).eq('user_id', membership.user_id)
      setLocalLocked(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Error locking spain predictions:', err)
      alert('Error al bloquear predicciones. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#c60b1e] via-[#aa151b] to-[#f1bf00] rounded-xl p-5 text-center border-2 border-white/20">
        <div className="text-4xl">🇪🇸</div>
        <h2 className="font-black text-2xl tracking-widest text-white mt-1">PREDICCIONES ESPAÑA</h2>
        <p className="text-xs text-white/80 mt-1">Grupo H · Cabo Verde · Arabia Saudí · Uruguay</p>
      </div>

      {localLocked ? (
        <div className="bg-blue-900/30 border border-blue-700 rounded-xl px-4 py-3 text-sm">
          🔒 Predicciones de España bloqueadas
        </div>
      ) : (
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl px-4 py-3 text-sm text-amber-200">
          ⚠️ Al guardar quedarán <strong>bloqueadas definitivamente</strong>
        </div>
      )}

      {SECTIONS.map(section => (
        <div key={section.title} className="card">
          <h3 className="font-bold text-sm text-gold mb-1">{section.title}</h3>
          {section.desc && <p className="text-xs text-muted mb-3">{section.desc}</p>}
          <div className="space-y-2">
            {section.fields.map(fieldId => {
              const field = SPAIN_FIELDS.find(f => f.id === fieldId)!
              return (
                <FieldRow
                  key={fieldId}
                  field={field}
                  value={getPred(fieldId)}
                  official={getResult(fieldId)}
                  squad={squad}
                  disabled={localLocked}
                  onChange={(v) => handleChange(fieldId, v)}
                />
              )
            })}
          </div>
        </div>
      ))}

      {!localLocked && (
        <div className="fixed bottom-16 left-0 right-0 z-30 bg-surface-2 border-t border-gold px-4 py-3 shadow-2xl">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-amber-200">
              {saved ? '✓ Guardado y bloqueado para siempre' : '⚠️ Guardar bloqueará definitivamente'}
            </span>
            <button onClick={handleLock} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
              {saving ? 'Guardando...' : '🔒 Bloquear España'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Field row ─────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: typeof SPAIN_FIELDS[number]
  value: string
  official?: string
  squad: string[]
  disabled: boolean
  onChange: (v: string) => void
}

function FieldRow({ field, value, official, squad, disabled, onChange }: FieldRowProps) {
  const [local, setLocal] = useState(value)
  const hasOfficial = !!official
  const correct = hasOfficial && value.trim().toLowerCase() === official!.trim().toLowerCase()
  const listId = `field-${field.id}`

  useEffect(() => { setLocal(value) }, [value])

  return (
    <div className="bg-surface-2 border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1">
          <p className="font-semibold text-sm">{field.label}</p>
          {field.desc && <p className="text-xs text-muted">{field.desc}</p>}
        </div>
        <span className="text-sm font-black text-gold bg-gold/10 px-2 py-0.5 rounded-lg">+{field.pts}pts</span>
      </div>
      <div className="flex items-center gap-2">
        {field.type === 'select' ? (
          <select
            className={cn('input flex-1', hasOfficial && (correct ? 'border-green-700 bg-green-950/30' : 'border-red-800'))}
            value={local}
            disabled={disabled || hasOfficial}
            onChange={(e) => { setLocal(e.target.value); onChange(e.target.value) }}
          >
            <option value="">— Tu predicción —</option>
            {field.options!.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : field.type === 'number' ? (
          <input
            type="number"
            min={0}
            className={cn('input flex-1', hasOfficial && (correct ? 'border-green-700 bg-green-950/30' : 'border-red-800'))}
            value={local}
            disabled={disabled || hasOfficial}
            placeholder="Número..."
            onChange={(e) => setLocal(e.target.value)}
            onBlur={(e) => onChange(e.target.value)}
          />
        ) : (
          <>
            <datalist id={listId}>{squad.map(p => <option key={p} value={p} />)}</datalist>
            <input
              className={cn('input flex-1', hasOfficial && (correct ? 'border-green-700 bg-green-950/30' : 'border-red-800'))}
              list={listId}
              value={local}
              disabled={disabled || hasOfficial}
              placeholder="Escribe un nombre..."
              onChange={(e) => setLocal(e.target.value)}
              onBlur={(e) => onChange(e.target.value)}
            />
          </>
        )}
        <span className={cn(
          'text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap',
          hasOfficial ? (correct ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300') : 'bg-blue-900 text-blue-300'
        )}>
          {hasOfficial ? (correct ? `✓ +${field.pts}pts` : official) : 'Pendiente'}
        </span>
      </div>
    </div>
  )
}
