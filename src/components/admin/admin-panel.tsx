'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { PHASE_INFO, PHASE_ORDER, ALL_TEAMS } from '@/lib/data/matches'
import { Flag } from '@/components/ui/flag'
import type { PoolMember, PoolSpainSquadPlayer, Match, PoolMatchTeams, Result } from '@/types'

interface OpenPhase { id: string; pool_id: string; phase: string; is_open: boolean }

interface AdminPanelProps {
  poolId: string
  members: (PoolMember & { username: string })[]
  openPhases: OpenPhase[]
  squad: PoolSpainSquadPlayer[]
  matches: Match[]
  matchTeams: PoolMatchTeams[]
  results: Result[]
  currentUserId: string
}

type Tab = 'members' | 'rounds' | 'teams' | 'results' | 'squad'

export function AdminPanel({
  poolId,
  members: initialMembers,
  openPhases: initialPhases,
  squad: initialSquad,
  matches,
  matchTeams: initialMatchTeams,
  results: initialResults,
  currentUserId,
}: AdminPanelProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('members')
  const [members, setMembers] = useState(initialMembers)
  const [openPhases, setOpenPhases] = useState(initialPhases)
  const [squad, setSquad] = useState(initialSquad)
  const [matchTeams, setMatchTeams] = useState(initialMatchTeams)
  const [results, setResults] = useState(initialResults)
  const [newPlayer, setNewPlayer] = useState('')
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    const channel = supabase
      .channel(`admin-${poolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_members', filter: `pool_id=eq.${poolId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setMembers(prev => prev.map(m => m.id === (payload.new as PoolMember).id ? { ...m, ...payload.new } : m))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, poolId])

  const pending = members.filter(m => m.status === 'pending')
  const approved = members.filter(m => m.status === 'approved')

  const handleApprove = async (memberId: string) => {
    setLoading(memberId)
    try {
      await supabase.from('pool_members').update({ status: 'approved' }).eq('id', memberId)
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'approved' } : m))
    } catch (err) {
      console.error('Error approving member:', err)
      alert('Error al aceptar el usuario. Intenta de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async (memberId: string) => {
    if (!confirm('¿Rechazar a este usuario?')) return
    setLoading(memberId)
    try {
      await supabase.from('pool_members').update({ status: 'rejected' }).eq('id', memberId)
      setMembers(prev => prev.filter(m => m.id !== memberId))
    } catch (err) {
      console.error('Error rejecting member:', err)
      alert('Error al rechazar el usuario. Intenta de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  const handleToggleLock = async (memberId: string, currentLocked: boolean) => {
    setLoading(memberId)
    try {
      const updated = { locked_matches: !currentLocked, locked_spain: !currentLocked, locked_awards: !currentLocked }
      await supabase.from('pool_members').update(updated).eq('id', memberId)
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...updated } : m))
    } catch (err) {
      console.error('Error toggling lock:', err)
      alert('Error al cambiar el bloqueo. Intenta de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  const handleTogglePhase = async (phase: string, current: boolean) => {
    setLoading(`phase-${phase}`)
    try {
      await supabase.from('pool_open_phases').update({ is_open: !current }).eq('pool_id', poolId).eq('phase', phase)
      setOpenPhases(prev => prev.map(p => p.phase === phase ? { ...p, is_open: !current } : p))
    } catch (err) {
      console.error('Error toggling phase:', err)
      alert('Error al cambiar la ronda. Intenta de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  const handleAddPlayer = async () => {
    const name = newPlayer.trim()
    if (!name) return
    try {
      const { data } = await supabase.from('pool_spain_squad').insert({ pool_id: poolId, name }).select().single()
      if (data) {
        setSquad(prev => [...prev, data as PoolSpainSquadPlayer].sort((a, b) => a.name.localeCompare(b.name)))
        setNewPlayer('')
      }
    } catch (err) {
      console.error('Error adding player:', err)
      alert('Error al agregar jugador. Intenta de nuevo.')
    }
  }

  const handleRemovePlayer = async (id: string) => {
    try {
      await supabase.from('pool_spain_squad').delete().eq('id', id)
      setSquad(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      console.error('Error removing player:', err)
      alert('Error al remover jugador. Intenta de nuevo.')
    }
  }

  const handleSetResult = async (matchId: string, side: 'home_score' | 'away_score', value: string) => {
    if (value === '') return // Don't save if field is empty
    try {
      const num = Math.min(30, Math.max(0, parseInt(value) || 0))
      const existing = results.find(r => r.match_id === matchId)
      const homeScore = side === 'home_score' ? num : (existing?.home_score ?? 0)
      const awayScore = side === 'away_score' ? num : (existing?.away_score ?? 0)
      const updated = existing
        ? { ...existing, home_score: homeScore, away_score: awayScore }
        : { match_id: matchId, pool_id: poolId, home_score: homeScore, away_score: awayScore, source: 'manual' as const }

      setResults(prev => [...prev.filter(r => r.match_id !== matchId), updated as Result])

      await supabase.from('results').upsert({
        pool_id: poolId,
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        source: 'manual',
      }, { onConflict: 'pool_id,match_id' })
    } catch (err) {
      console.error('Error setting result:', err)
      alert('Error al guardar el resultado. Intenta de nuevo.')
    }
  }

  const handleDeleteResult = async (matchId: string) => {
    if (!confirm('¿Borrar el resultado de este partido?')) return
    try {
      const existing = results.find(r => r.match_id === matchId)
      if (!existing?.id) return
      await supabase.from('results').delete().eq('id', existing.id)
      setResults(prev => prev.filter(r => r.match_id !== matchId))
    } catch (err) {
      console.error('Error deleting result:', err)
      alert('Error al borrar el resultado. Intenta de nuevo.')
    }
  }

  const handleSetMatchTeam = async (matchId: string, side: 'real_home' | 'real_away', value: string) => {
    try {
      const existing = matchTeams.find(mt => mt.match_id === matchId)
      const updated = existing
        ? { ...existing, [side]: value }
        : { pool_id: poolId, match_id: matchId, real_home: side === 'real_home' ? value : null, real_away: side === 'real_away' ? value : null }

      setMatchTeams(prev => [...prev.filter(mt => mt.match_id !== matchId), updated as PoolMatchTeams])

      await supabase.from('pool_match_teams').upsert({
        pool_id: poolId,
        match_id: matchId,
        ...(existing ? { real_home: existing.real_home, real_away: existing.real_away } : {}),
        [side]: value,
      }, { onConflict: 'pool_id,match_id' })
    } catch (err) {
      console.error('Error setting match team:', err)
      alert('Error al asignar equipo. Intenta de nuevo.')
    }
  }

  const openKnockoutPhases = PHASE_ORDER.filter(p => p !== 'grupos' && openPhases.find(op => op.phase === p)?.is_open)

  return (
    <div className="space-y-4">
      <h1 className="font-black text-2xl tracking-wide text-gold">⚙️ ADMIN</h1>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {([
          ['members', `👥 Miembros${pending.length > 0 ? ` (${pending.length})` : ''}`],
          ['rounds', '⚡ Rondas'],
          ['teams', '🏟️ Equipos'],
          ['results', '⚽ Resultados'],
          ['squad', '🇪🇸 Plantilla'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-bold transition-all',
              tab === key ? 'bg-gold text-background' : 'border border-border text-muted hover:border-gold hover:text-gold'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* MEMBERS TAB */}
      {tab === 'members' && (
        <div className="space-y-4">
          <div className={cn('card', pending.length > 0 && 'border-amber-700')}>
            <h2 className="font-bold text-sm text-amber-300 uppercase tracking-wide mb-3">
              🔔 Solicitudes pendientes {pending.length > 0 && `(${pending.length})`}
            </h2>
            {pending.length === 0 ? (
              <p className="text-muted text-sm">✅ Sin solicitudes pendientes</p>
            ) : (
              <div className="space-y-2">
                {pending.map(m => (
                  <div key={m.id} className="flex items-center gap-3 bg-surface-2 rounded-lg px-3 py-2.5">
                    <div className="flex-1">
                      <p className="font-bold text-sm">{m.username}</p>
                      <p className="text-xs text-muted">{new Date(m.joined_at).toLocaleString('es')}</p>
                    </div>
                    <button
                      onClick={() => handleApprove(m.id)}
                      disabled={loading === m.id}
                      className="text-xs font-bold bg-green-900 text-green-300 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      ✓ Aceptar
                    </button>
                    <button
                      onClick={() => handleReject(m.id)}
                      disabled={loading === m.id}
                      className="text-xs font-bold bg-red-900 text-red-300 hover:bg-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      ✕ Rechazar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="font-bold text-sm uppercase tracking-wide mb-3">👥 Miembros de la porra</h2>
            <div className="space-y-2">
              {approved.map(m => {
                const isLocked = m.locked_matches && m.locked_spain && m.locked_awards
                const isMe = m.user_id === currentUserId
                return (
                  <div key={m.id} className="flex items-center gap-3 bg-surface-2 rounded-lg px-3 py-2.5">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm">{m.username}</span>
                        {m.role === 'admin' && <span className="badge badge-admin">ADMIN</span>}
                        {isMe && <span className="text-xs text-muted">(tú)</span>}
                      </div>
                      <p className="text-xs text-muted">{isLocked ? '🔒 Bloqueado' : '🔓 Sin bloquear'}</p>
                    </div>
                    <button
                      onClick={() => handleToggleLock(m.id, isLocked)}
                      disabled={loading === m.id}
                      className={cn(
                        'text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50',
                        isLocked ? 'bg-blue-900 text-blue-300 hover:bg-blue-700' : 'bg-amber-900 text-amber-300 hover:bg-amber-700'
                      )}
                    >
                      {isLocked ? '🔓 Desbloquear' : '🔒 Bloquear'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ROUNDS TAB */}
      {tab === 'rounds' && (
        <div className="card border-red-900">
          <h2 className="font-bold text-sm text-red-300 uppercase tracking-wide mb-3">⚡ Control de rondas</h2>
          <div className="grid grid-cols-2 gap-2">
            {PHASE_ORDER.filter(p => p !== '3er').map(phase => {
              const phaseObj = openPhases.find(p => p.phase === phase)
              const isOpen = phase === 'grupos' ? true : (phaseObj?.is_open ?? false)
              const info = PHASE_INFO[phase]
              return (
                <button
                  key={phase}
                  onClick={() => phase !== 'grupos' && handleTogglePhase(phase, isOpen)}
                  disabled={phase === 'grupos' || loading === `phase-${phase}`}
                  className={cn(
                    'text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50',
                    isOpen ? 'bg-green-900 text-green-300' : 'bg-surface-2 text-muted hover:bg-surface',
                    phase === 'grupos' && 'cursor-default'
                  )}
                >
                  <div>{isOpen ? '✅ ABIERTA' : '🔒 CERRADA'}</div>
                  <div className="font-normal opacity-75 mt-0.5">{info?.full ?? phase}</div>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted mt-3">
            💡 Abre cada ronda cuando terminen los partidos anteriores. La fase de grupos está siempre abierta.
          </p>
        </div>
      )}

      {/* TEAMS TAB (knockout real team assignment) */}
      {tab === 'teams' && (
        <div className="card">
          <h2 className="font-bold text-sm uppercase tracking-wide mb-1">🏟️ Equipos reales en eliminatorias</h2>
          <p className="text-xs text-muted mb-4">
            Asigna los equipos clasificados a cada partido. Los usuarios los verán con nombre y bandera real al predecir.
          </p>
          {openKnockoutPhases.length === 0 ? (
            <p className="text-muted text-sm">Abre alguna ronda eliminatoria desde la pestaña ⚡ Rondas para empezar a asignar equipos.</p>
          ) : (
            openKnockoutPhases.map(ph => {
              const phMatches = ph === 'semis'
                ? matches.filter(m => m.phase === 'semis' || m.phase === '3er')
                : matches.filter(m => m.phase === ph)
              return (
                <div key={ph} className="mb-5">
                  <div className="font-black text-sm tracking-wide text-gold mb-2">{PHASE_INFO[ph]?.full}</div>
                  <div className="space-y-2">
                    {phMatches.map(m => {
                      const teams = matchTeams.find(mt => mt.match_id === m.id)
                      return (
                        <div key={m.id} className="bg-surface-2 border border-border rounded-lg p-3">
                          <p className="text-[10px] text-muted font-bold mb-2">
                            {m.date} · <span className="text-gold">{m.home}</span> vs <span className="text-gold">{m.away}</span>
                          </p>
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            <TeamCombobox
                              value={teams?.real_home ?? ''}
                              onChange={(v) => handleSetMatchTeam(m.id, 'real_home', v)}
                              placeholder="Equipo local..."
                            />
                            <span className="text-muted text-xs font-bold">vs</span>
                            <TeamCombobox
                              value={teams?.real_away ?? ''}
                              onChange={(v) => handleSetMatchTeam(m.id, 'real_away', v)}
                              placeholder="Equipo visitante..."
                            />
                          </div>
                          {teams?.real_home && teams?.real_away && (
                            <div className="flex items-center gap-2 mt-2 text-xs">
                              <Flag team={teams.real_home} size="sm" />
                              <span className="font-semibold">{teams.real_home}</span>
                              <span className="text-muted">vs</span>
                              <Flag team={teams.real_away} size="sm" />
                              <span className="font-semibold">{teams.real_away}</span>
                              <span className="text-green-400 ml-1">✓</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* RESULTS TAB — manual entry for knockout results */}
      {tab === 'results' && (
        <div className="card">
          <h2 className="font-bold text-sm uppercase tracking-wide mb-1">⚽ Resultados eliminatorias</h2>
          <p className="text-xs text-muted mb-4">
            Introduce los resultados al final de los 90' (o 120' si hay prórroga). <strong className="text-amber-300">No incluyas penaltis</strong> — solo el marcador real del partido.
          </p>
          {openKnockoutPhases.length === 0 ? (
            <p className="text-muted text-sm">Abre alguna ronda eliminatoria desde ⚡ Rondas para poder introducir resultados.</p>
          ) : (
            openKnockoutPhases.map(ph => {
              const phMatches = ph === 'semis'
                ? matches.filter(m => m.phase === 'semis' || m.phase === '3er')
                : matches.filter(m => m.phase === ph)
              return (
                <div key={ph} className="mb-5">
                  <div className="font-black text-sm tracking-wide text-gold mb-2">{PHASE_INFO[ph]?.full}</div>
                  <div className="space-y-2">
                    {phMatches.map(m => {
                      const teams = matchTeams.find(mt => mt.match_id === m.id)
                      const result = results.find(r => r.match_id === m.id)
                      const displayHome = teams?.real_home || m.home_team || m.home || ''
                      const displayAway = teams?.real_away || m.away_team || m.away || ''
                      return (
                        <div key={m.id} className="bg-surface-2 border border-border rounded-lg p-3">
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            <div className="flex items-center gap-1.5 text-sm font-semibold overflow-hidden">
                              <Flag team={displayHome} size="sm" />
                              <span className="truncate">{displayHome}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <ResultInput
                                value={result?.home_score}
                                onSave={(v) => handleSetResult(m.id, 'home_score', v)}
                              />
                              <span className="text-muted font-bold">:</span>
                              <ResultInput
                                value={result?.away_score}
                                onSave={(v) => handleSetResult(m.id, 'away_score', v)}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-semibold overflow-hidden flex-row-reverse">
                              <Flag team={displayAway} size="sm" />
                              <span className="truncate text-right">{displayAway}</span>
                            </div>
                          </div>
                          {result && (
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-[10px] text-green-400">
                                ✓ Guardado: {result.home_score}–{result.away_score}
                              </p>
                              <button
                                onClick={() => handleDeleteResult(m.id)}
                                className="text-[10px] text-red-400 hover:text-red-300 font-bold"
                              >
                                ✕ Borrar resultado
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* SQUAD TAB */}
      {tab === 'squad' && (
        <div className="card">
          <h2 className="font-bold text-sm uppercase tracking-wide mb-1">🇪🇸 Plantilla España</h2>
          <p className="text-xs text-muted mb-3">
            Actualiza cuando se publique la convocatoria oficial de Luis de la Fuente.
          </p>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {squad.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 bg-surface-2 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="flex-1 truncate">{p.name}</span>
                <button onClick={() => handleRemovePlayer(p.id)} className="text-red-400 hover:text-red-300 font-bold ml-1">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input text-sm"
              value={newPlayer}
              onChange={e => setNewPlayer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddPlayer()}
              placeholder="Nombre del jugador..."
            />
            <button onClick={handleAddPlayer} className="btn-primary text-sm whitespace-nowrap">
              + Añadir
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Team combobox with datalist ───────────────────────────────────────────────

function TeamCombobox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [local, setLocal] = useState(value)
  const listId = `teams-${placeholder.replace(/\s/g, '')}`

  return (
    <div>
      <datalist id={listId}>
        {ALL_TEAMS.map(t => <option key={t} value={t} />)}
      </datalist>
      <input
        className="input text-xs py-1.5"
        list={listId}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

// ─── Result Input — controlled, allows clearing ───────────────────────────────

function ResultInput({ value, onSave }: { value?: number; onSave: (v: string) => void }) {
  const [local, setLocal] = useState<string>(value !== undefined ? String(value) : '')

  useEffect(() => {
    setLocal(value !== undefined ? String(value) : '')
  }, [value])

  return (
    <input
      type="number"
      min={0}
      max={30}
      value={local}
      placeholder="–"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={(e) => {
        if (e.target.value === '') {
          setLocal('')
        } else {
          onSave(e.target.value)
        }
      }}
      className="w-10 h-10 text-center rounded-lg font-black text-lg outline-none bg-surface border border-border text-cream focus:border-gold"
    />
  )
}
