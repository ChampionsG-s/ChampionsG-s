'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { scoreMatch } from '@/lib/scoring'
import { JORNADAS } from '@/lib/data/matches'
import { Flag } from '@/components/ui/flag'
import { cn } from '@/lib/utils'
import type { Match, Result, Prediction, PoolMember, PoolMatchTeams } from '@/types'

interface OpenPhase { phase: string; is_open: boolean }

interface MatchesListProps {
  poolId: string
  matches: Match[]
  results: Result[]
  predictions: Prediction[]
  openPhases: OpenPhase[]
  membership: PoolMember
  matchTeams: PoolMatchTeams[]
}

export function MatchesList({
  poolId,
  matches,
  results: initialResults,
  predictions: initialPredictions,
  openPhases: initialOpenPhases,
  membership,
  matchTeams: initialMatchTeams,
}: MatchesListProps) {
  const [results, setResults] = useState<Result[]>(initialResults)
  const [predictions, setPredictions] = useState<Prediction[]>(initialPredictions)
  const [openPhases, setOpenPhases] = useState<OpenPhase[]>(initialOpenPhases)
  const [matchTeams, setMatchTeams] = useState<PoolMatchTeams[]>(initialMatchTeams)
  const [jornada, setJornada] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const supabase = createClient()

  const [localLocked, setLocalLocked] = useState(membership.locked_matches)
  const isLocked = localLocked
  const isAdmin = membership.role === 'admin'

  useEffect(() => {
    const channel = supabase
      .channel(`matches-${poolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results', filter: `pool_id=eq.${poolId}` },
        (payload) => {
          setResults(prev => {
            const filtered = prev.filter(r => r.id !== (payload.new as Result)?.id)
            return payload.eventType === 'DELETE' ? filtered : [...filtered, payload.new as Result]
          })
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_open_phases', filter: `pool_id=eq.${poolId}` },
        (payload) => {
          setOpenPhases(prev => prev.map(op =>
            op.phase === (payload.new as OpenPhase).phase ? payload.new as OpenPhase : op
          ))
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_match_teams', filter: `pool_id=eq.${poolId}` },
        (payload) => {
          setMatchTeams(prev => {
            const filtered = prev.filter(mt => mt.id !== (payload.new as PoolMatchTeams)?.id)
            return payload.eventType === 'DELETE' ? filtered : [...filtered, payload.new as PoolMatchTeams]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, poolId])

  const getMatchRange = (matchList: Match[]): number => {
    if (matchList.length === 0) return 10
    const maxMatch = Math.max(...matchList.map(m => m.match_number))
    const totalMatches = matchList.length
    
    if (maxMatch <= 8 && totalMatches <= 8) return 8
    else if (maxMatch <= 16 && totalMatches <= 16) return 8
    else if (maxMatch <= 24 && totalMatches <= 24) return 12
    else if (maxMatch <= 32 && totalMatches <= 32) return 16
    else return 10
  }

  const jornadaForMatch = (match: Match) => {
    if (match.jornada) return `Jornada ${match.jornada}`
    if (match.group_name?.trim()) return match.group_name.trim()
    const range = getMatchRange(matches)
    return `Jornada ${Math.max(1, Math.ceil(match.match_number / range))}`
  }
  
  const jornadas = useMemo(() => {
    // Primero intenta agrupar por jornada (campo de la BD)
    const byJornada = Array.from(new Set(
      matches
        .filter(m => m.jornada !== null && m.jornada !== undefined)
        .map(m => m.jornada!)
    )).sort((a, b) => a - b)
    
    if (byJornada.length > 0) {
      return byJornada.map(j => `Jornada ${j}`)
    }
    
    // Fallback: intenta agrupar por group_name
    const byGroupName = Array.from(new Set(
      matches
        .filter(m => m.group_name?.trim())
        .map(m => m.group_name!.trim())
    ))
    
    if (byGroupName.length > 0) {
      return byGroupName
    }
    
    // Si no hay jornada ni group_name, calcula por match_number
    if (matches.length === 0) return ['Jornada 1']
    
    const range = getMatchRange(matches)
    
    const calculated = Array.from(new Set(
      matches.map(m => `Jornada ${Math.max(1, Math.ceil(m.match_number / range))}`)
    )).sort((a, b) => {
      const numA = parseInt(a.split(' ')[1])
      const numB = parseInt(b.split(' ')[1])
      return numA - numB
    })
    
    return calculated.length > 0 ? calculated : ['Jornada 1']
  }, [matches])
  const jornadaDeadline = (label: string) => {
    const items = matches.filter(m => jornadaForMatch(m) === label)
    return items.reduce((earliest, match) => {
      const time = new Date(match.match_date || match.date || '').getTime()
      return Number.isFinite(time) && time < earliest ? time : earliest
    }, Number.POSITIVE_INFINITY)
  }
  const isJornadaOpen = (label: string) => {
    const manual = openPhases.find(op => op.phase === label)?.is_open
    if (manual !== undefined) return manual
    const deadline = jornadaDeadline(label)
    return Number.isFinite(deadline) ? Date.now() < deadline : true
  }
  const getPred = (matchId: string) => predictions.find(p => p.match_id === matchId)
  const getResult = (matchId: string) => results.find(r => r.match_id === matchId)
  const getRealTeams = (matchId: string) => matchTeams.find(mt => mt.match_id === matchId)

  const handlePrediction = useCallback(async (matchId: string, side: 'home_score' | 'away_score', value: string) => {
    const match = matches.find(m => m.id === matchId)
    if (!match || isLocked || !isJornadaOpen(jornadaForMatch(match))) return
    try {
      const num = value === '' ? 0 : Math.min(30, Math.max(0, parseInt(value) || 0))
      const existing = predictions.find(p => p.match_id === matchId)
      const homeScore = side === 'home_score' ? num : (existing?.home_score ?? 0)
      const awayScore = side === 'away_score' ? num : (existing?.away_score ?? 0)
      const updated = existing
        ? { ...existing, home_score: homeScore, away_score: awayScore }
        : { match_id: matchId, pool_id: poolId, user_id: membership.user_id, home_score: homeScore, away_score: awayScore }

      setPredictions(prev => [...prev.filter(p => p.match_id !== matchId), updated as Prediction])

      await supabase.from('predictions').upsert({
        pool_id: poolId,
        user_id: membership.user_id,
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
      }, { onConflict: 'pool_id,user_id,match_id' })
    } catch (err) {
      console.error('Error saving prediction:', err)
      alert('Error al guardar la predicción. Intenta de nuevo.')
    }
  }, [isLocked, predictions, poolId, membership.user_id, supabase, matches])

  const handleLock = async () => {
    setSaving(true)
    try {
      await supabase
        .from('pool_members')
        .update({ locked_matches: true })
        .eq('pool_id', poolId)
        .eq('user_id', membership.user_id)
      setLocalLocked(true)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Error locking predictions:', err)
      alert('Error al bloquear predicciones. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const visibleMatches = jornada
    ? matches.filter(m => jornadaForMatch(m) === jornada)
    : matches.filter(m => jornadaForMatch(m) === jornadas[0])

  const currentJornada = jornada || jornadas[0]
  const currentOpen = isJornadaOpen(currentJornada)

  return (
    <div className="space-y-4">
      {!currentOpen ? (
        <div className="bg-blue-900/30 border border-blue-700 rounded-xl px-4 py-3 text-sm">
          🔒 Jornada cerrada · Ya no se puede apostar en esta jornada
        </div>
      ) : (
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl px-4 py-3 text-sm text-amber-200">
          ⚠️ Las apuestas se cierran cuando llegue la fecha límite de la jornada
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {jornadas.map((label) => {
            const open = isJornadaOpen(label)
            const active = currentJornada === label
            return (
              <button
                key={label}
                onClick={() => setJornada(label)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-bold transition-all',
                  active
                    ? 'bg-gold text-background'
                    : open
                      ? 'border border-border text-muted hover:border-gold hover:text-gold'
                      : 'border border-border text-border cursor-not-allowed opacity-50'
                )}
              >
                {label} {!open && '🔒'}
              </button>
            )
          })}
        </div>

        <a href={`/p/${poolId}/ver`} className="text-xs font-bold text-gold hover:text-cream transition-colors">
          Ver apuestas
        </a>
      </div>

      {isAdmin && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl px-4 py-2 text-xs text-red-300 font-bold uppercase tracking-wide">
          Admin — controla los resultados y la apertura de cada jornada
        </div>
      )}

      <div className="space-y-2">
        {visibleMatches.map(m => (
          <MatchCard
            key={m.id}
            match={m}
            realTeams={getRealTeams(m.id)}
            pred={getPred(m.id)}
            result={getResult(m.id)}
            isLocked={isLocked || !currentOpen}
            onPred={handlePrediction}
          />
        ))}
      </div>

      {!isLocked && (
        <div className="fixed bottom-16 left-0 right-0 z-30 bg-surface-2 border-t border-gold px-4 py-3 shadow-2xl">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-amber-200">
              {currentOpen ? (saved ? '✓ Guardado' : '💡 Puedes bloquear tus apuestas cuando quieras') : '🔒 Jornada cerrada · Bloquea para poder ver apuestas ajenas'}
            </span>
            <button onClick={handleLock} disabled={saving} className="btn-primary text-sm disabled:opacity-50">
              {saving ? 'Guardando...' : '🔒 Bloquear apuestas'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Match Card ───────────────────────────────────────────────────────────────

interface MatchCardProps {
  match: Match
  realTeams?: PoolMatchTeams
  pred?: Prediction
  result?: Result
  isLocked: boolean
  onPred: (id: string, side: 'home_score' | 'away_score', v: string) => void
}

function MatchCard({ match, realTeams, pred, result, isLocked, onPred }: MatchCardProps) {
  const hasResult = !!result
  const hasPred = !!pred
  const pts = hasPred && hasResult ? scoreMatch(pred, result, match) : null
  const displayHome = realTeams?.real_home || match.home_team || match.home || '?'
  const displayAway = realTeams?.real_away || match.away_team || match.away || '?'
  const jornadaLabel = match.jornada ? `Jornada ${match.jornada}` : (match.group_name?.trim() || `Jornada ${Math.max(1, Math.ceil(match.match_number / 10))}`)

  const ptsExactValue = match.pts_exact ?? 3

  const cardClass = cn(
    'bg-surface-2 border rounded-xl p-3 transition-colors',
    pts !== null && pts === ptsExactValue && 'border-green-700 bg-green-950/30',
    pts !== null && pts > 0 && pts < ptsExactValue && 'border-amber-700 bg-amber-950/20',
    pts === null && 'border-border',
  )

  const dateStr = match.match_date || match.date || ''
  const dateDisplay = dateStr ? new Date(dateStr).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }) : '?'

  return (
    <div className={cardClass}>
      <div className="text-center text-xs text-muted mb-2 flex items-center justify-center gap-2">
        <span>{jornadaLabel}</span>
        <span>·</span>
        <span>{dateDisplay}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-sm overflow-hidden">
          <Flag team={displayHome} />
          <span className="truncate">{displayHome}</span>
        </div>

        <div className="flex flex-col items-center gap-1 min-w-[100px]">
          {hasResult && (
            <div className="font-black text-2xl text-gold tracking-widest leading-none">
              {result!.home_score}–{result!.away_score}
              {result!.source === 'api' && <span className="ml-1 text-[9px] text-green-400 font-normal">⚡</span>}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <ScoreInput value={pred?.home_score} disabled={isLocked || hasResult} onChange={(v) => onPred(match.id, 'home_score', v)} />
            <span className="text-muted font-bold text-sm">:</span>
            <ScoreInput value={pred?.away_score} disabled={isLocked || hasResult} onChange={(v) => onPred(match.id, 'away_score', v)} />
          </div>
          {pts !== null && (
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              pts === match.pts_exact ? 'bg-green-900 text-green-300' : pts > 0 ? 'bg-amber-900 text-amber-300' : 'bg-red-900 text-red-300'
            )}>
              {pts}pt{pts !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-[9px] text-muted">Exacto=3pts · Ganador=1pt</span>
        </div>

        <div className="flex items-center gap-1.5 font-semibold text-sm overflow-hidden flex-row-reverse">
          <Flag team={displayAway} />
          <span className="truncate text-right">{displayAway}</span>
        </div>
      </div>
    </div>
  )
}

interface ScoreInputProps {
  value?: number
  disabled?: boolean
  onChange: (v: string) => void
  adminStyle?: boolean
}

function ScoreInput({ value, disabled, onChange, adminStyle }: ScoreInputProps) {
  const [localValue, setLocalValue] = useState<string>(value !== undefined ? String(value) : '')

  // Sync from parent only when the prop actually changes externally
  // (e.g. realtime update from another tab), not on every keystroke
  useEffect(() => {
    setLocalValue(value !== undefined ? String(value) : '')
  }, [value])

  return (
    <input
      type="number"
      min={0}
      max={30}
      value={localValue}
      disabled={disabled}
      placeholder="–"
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={(e) => onChange(e.target.value)}
      className={cn(
        'w-9 h-9 text-center rounded-lg font-black text-lg outline-none transition-colors',
        adminStyle
          ? 'bg-red-950 border border-red-800 text-red-300 w-8 h-8 text-sm'
          : 'bg-surface border border-border text-cream focus:border-gold disabled:opacity-35 disabled:cursor-not-allowed'
      )}
    />
  )
}