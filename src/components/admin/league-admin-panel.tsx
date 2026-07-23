'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/flag'
import type { PoolMember, Match, Result } from '@/types'

interface OpenPhase {
  id: string
  pool_id: string
  phase: string
  is_open: boolean
}

type Tab = 'members' | 'jornadas' | 'results'

interface LeagueAdminPanelProps {
  poolId: string
  members: (PoolMember & { username: string })[]
  openPhases: OpenPhase[]
  matches: Match[]
  results: Result[]
  currentUserId: string
}

function getMatchRange(matchList: Match[]): number {
  if (matchList.length === 0) return 10
  const maxMatch = Math.max(...matchList.map(m => m.match_number))
  const totalMatches = matchList.length
  
  if (maxMatch <= 8 && totalMatches <= 8) return 8
  else if (maxMatch <= 16 && totalMatches <= 16) return 8
  else if (maxMatch <= 24 && totalMatches <= 24) return 12
  else if (maxMatch <= 32 && totalMatches <= 32) return 16
  else return 10
}

function jornadaLabel(match: Match, matches: Match[]) {
  if (match.jornada) return `Jornada ${match.jornada}`
  if (match.group_name?.trim()) return match.group_name.trim()
  const range = getMatchRange(matches)
  return `Jornada ${Math.max(1, Math.ceil(match.match_number / range))}`
}

function jornadaDeadline(matches: Match[], label: string) {
  const items = matches.filter(match => jornadaLabel(match, matches) === label)
  return items.reduce((earliest, match) => {
    const time = new Date(match.match_date || match.date || '').getTime()
    return Number.isFinite(time) && time < earliest ? time : earliest
  }, Number.POSITIVE_INFINITY)
}

export function LeagueAdminPanel({
  poolId,
  members: initialMembers,
  openPhases: initialPhases,
  matches,
  results: initialResults,
  currentUserId,
}: LeagueAdminPanelProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('members')
  const [members, setMembers] = useState(initialMembers)
  const [openPhases, setOpenPhases] = useState(initialPhases)
  const [results, setResults] = useState(initialResults)
  const [loading, setLoading] = useState<string | null>(null)

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
    
    // Si no hay group_name, calcula por match_number
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

  const pending = members.filter(member => member.status === 'pending')
  const approved = members.filter(member => member.status === 'approved')

  const isJornadaOpen = (label: string) => openPhases.find(open => open.phase === label)?.is_open ?? (Date.now() < jornadaDeadline(matches, label))

  const handleApprove = async (memberId: string) => {
    setLoading(memberId)
    try {
      await supabase.from('pool_members').update({ status: 'approved' }).eq('id', memberId)
      setMembers(prev => prev.map(member => member.id === memberId ? { ...member, status: 'approved' } : member))
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
      setMembers(prev => prev.filter(member => member.id !== memberId))
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
      const updated = { locked_matches: !currentLocked }
      await supabase.from('pool_members').update(updated).eq('id', memberId)
      setMembers(prev => prev.map(member => member.id === memberId ? { ...member, ...updated } : member))
    } catch (err) {
      console.error('Error toggling lock:', err)
      alert('Error al cambiar el bloqueo. Intenta de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  const handleToggleJornada = async (label: string, current: boolean) => {
    setLoading(`jornada-${label}`)
    try {
      await supabase.from('pool_open_phases').upsert({ pool_id: poolId, phase: label, is_open: !current }, { onConflict: 'pool_id,phase' })
      setOpenPhases(prev => {
        const rest = prev.filter(item => item.phase !== label)
        return [...rest, { id: label, pool_id: poolId, phase: label, is_open: !current }]
      })
    } catch (err) {
      console.error('Error toggling jornada:', err)
      alert('Error al cambiar la jornada. Intenta de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  const handleSetResult = async (matchId: string, side: 'home_score' | 'away_score', value: string) => {
    if (value === '') return
    try {
      const num = Math.min(30, Math.max(0, parseInt(value) || 0))
      const existing = results.find(result => result.match_id === matchId)
      const homeScore = side === 'home_score' ? num : (existing?.home_score ?? 0)
      const awayScore = side === 'away_score' ? num : (existing?.away_score ?? 0)
      const updated = existing
        ? { ...existing, home_score: homeScore, away_score: awayScore }
        : { match_id: matchId, pool_id: poolId, home_score: homeScore, away_score: awayScore, source: 'manual' as const }

      setResults(prev => [...prev.filter(result => result.match_id !== matchId), updated as Result])

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

  return (
    <div className="space-y-4">
      <h1 className="font-black text-2xl tracking-wide text-gold">⚙️ ADMIN</h1>

      <div className="flex gap-1.5 flex-wrap">
        {([
          ['members', `👥 Miembros${pending.length > 0 ? ` (${pending.length})` : ''}`],
          ['jornadas', '🗓️ Jornadas'],
          ['results', '⚽ Resultados'],
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
                {pending.map(member => (
                  <div key={member.id} className="flex items-center gap-3 bg-surface-2 rounded-lg px-3 py-2.5">
                    <div className="flex-1">
                      <p className="font-bold text-sm">{member.username}</p>
                      <p className="text-xs text-muted">{new Date(member.joined_at).toLocaleString('es')}</p>
                    </div>
                    <button
                      onClick={() => handleApprove(member.id)}
                      disabled={loading === member.id}
                      className="text-xs font-bold bg-green-900 text-green-300 hover:bg-green-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      ✓ Aceptar
                    </button>
                    <button
                      onClick={() => handleReject(member.id)}
                      disabled={loading === member.id}
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
            <h2 className="font-bold text-sm uppercase tracking-wide mb-3">👥 Miembros de la quiniela</h2>
            <div className="space-y-2">
              {approved.map(member => {
                const isLocked = member.locked_matches
                const isMe = member.user_id === currentUserId
                return (
                  <div key={member.id} className="flex items-center gap-3 bg-surface-2 rounded-lg px-3 py-2.5">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm">{member.username}</span>
                        {member.role === 'admin' && <span className="badge badge-admin">ADMIN</span>}
                        {isMe && <span className="text-xs text-muted">(tú)</span>}
                      </div>
                      <p className="text-xs text-muted">{isLocked ? '🔒 Bloqueado' : '🔓 Sin bloquear'}</p>
                    </div>
                    <button
                      onClick={() => handleToggleLock(member.id, isLocked)}
                      disabled={loading === member.id}
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

      {tab === 'jornadas' && (
        <div className="card border-red-900">
          <h2 className="font-bold text-sm text-red-300 uppercase tracking-wide mb-3">🗓️ Control de jornadas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {jornadas.map(label => {
              const open = isJornadaOpen(label)
              const deadline = jornadaDeadline(matches, label)
              return (
                <button
                  key={label}
                  onClick={() => handleToggleJornada(label, open)}
                  disabled={loading === `jornada-${label}`}
                  className={cn(
                    'text-left px-3 py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50',
                    open ? 'bg-green-900 text-green-300' : 'bg-surface-2 text-muted hover:bg-surface'
                  )}
                >
                  <div>{open ? '✅ ABIERTA' : '🔒 CERRADA'}</div>
                  <div className="font-normal opacity-75 mt-0.5">{label}</div>
                  <div className="font-normal opacity-75 mt-0.5">
                    Cierra: {Number.isFinite(deadline) ? new Date(deadline).toLocaleString('es') : 'sin fecha'}
                  </div>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted mt-3">
            💡 Las apuestas se cierran al llegar la fecha del primer partido de cada jornada. Este control te permite abrir o cerrar manualmente si hace falta.
          </p>
        </div>
      )}

      {tab === 'results' && (
        <div className="card">
          <h2 className="font-bold text-sm uppercase tracking-wide mb-1">⚽ Resultados de jornada</h2>
          <p className="text-xs text-muted mb-4">
            Introduce el marcador final de cada partido. Estos resultados alimentan el ranking.
          </p>
          <div className="space-y-5">
            {jornadas.map(label => {
              const jornadaMatches = matches.filter(match => jornadaLabel(match, matches) === label)
              if (jornadaMatches.length === 0) return null

              return (
                <div key={label}>
                  <div className="font-black text-sm tracking-wide text-gold mb-2">{label}</div>
                  <div className="space-y-2">
                    {jornadaMatches.map(match => {
                      const result = results.find(item => item.match_id === match.id)
                      return (
                        <div key={match.id} className="bg-surface-2 border border-border rounded-lg p-3">
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            <div className="flex items-center gap-1.5 text-sm font-semibold overflow-hidden">
                              <Flag team={match.home_team || match.home || ''} size="sm" />
                              <span className="truncate">{match.home_team || match.home || '-'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <ResultInput
                                value={result?.home_score}
                                onSave={(value) => handleSetResult(match.id, 'home_score', value)}
                              />
                              <span className="text-muted font-bold">:</span>
                              <ResultInput
                                value={result?.away_score}
                                onSave={(value) => handleSetResult(match.id, 'away_score', value)}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 text-sm font-semibold overflow-hidden flex-row-reverse">
                              <Flag team={match.away_team || match.away || ''} size="sm" />
                              <span className="truncate text-right">{match.away_team || match.away || '-'}</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted mt-2">
                            {match.date}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultInput({ value, onSave }: { value?: number; onSave: (v: string) => void }) {
  const [local, setLocal] = useState<string>(value !== undefined ? String(value) : '')

  return (
    <input
      type="number"
      min={0}
      max={30}
      value={local}
      placeholder="–"
      onChange={(event) => setLocal(event.target.value)}
      onBlur={(event) => {
        if (event.target.value === '') {
          setLocal('')
        } else {
          onSave(event.target.value)
        }
      }}
      className="w-10 h-10 text-center rounded-lg font-black text-lg outline-none bg-surface border border-border text-cream focus:border-gold"
    />
  )
}