'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Flag } from '@/components/ui/flag'
import { Avatar } from '@/components/ui/avatar'
import { jornadaLabelForMatch, jornadaDeadline, isJornadaOpen as computeIsJornadaOpen } from '@/lib/jornada'
import { scoreMatch } from '@/lib/scoring'
import type { PoolMember, Match, Result } from '@/types'

interface OpenPhase {
  id: string
  pool_id: string
  phase: string
  is_open: boolean
}

type Tab = 'results' | 'members'

interface LeagueAdminPanelProps {
  poolId: string
  members: (PoolMember & { username: string; avatar_url?: string | null })[]
  openPhases: OpenPhase[]
  matches: Match[]
  results: Result[]
  currentUserId: string
}

function jornadaLabel(match: Match, matches: Match[]) {
  return jornadaLabelForMatch(match, matches)
}

export function LeagueAdminPanel({
  poolId,
  members: initialMembers,
  openPhases: initialPhases,
  matches: initialMatches,
  results: initialResults,
  currentUserId,
}: LeagueAdminPanelProps) {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('results')
  const [members, setMembers] = useState(initialMembers)
  const [openPhases, setOpenPhases] = useState(initialPhases)
  const [matches, setMatches] = useState(initialMatches)
  const [results, setResults] = useState(initialResults)
  const [loading, setLoading] = useState<string | null>(null)
  const [openJornada, setOpenJornada] = useState<string | null>(null)
  const [completedOpen, setCompletedOpen] = useState(false)

  // 38 jornadas fijas (1ª vuelta 1-19, 2ª vuelta 20-38), independiente de
  // cuantos partidos haya cargados todavia para cada una.
  const allJornadaSlots = useMemo(() => Array.from({ length: 38 }, (_, i) => `Jornada ${i + 1}`), [])
  const primeraVueltaLabels = allJornadaSlots.slice(0, 19)
  const segundaVueltaLabels = allJornadaSlots.slice(19, 38)
  const [openVuelta, setOpenVuelta] = useState<'primera' | 'segunda' | null>('primera')

  const isJornadaCompleted = (label: string) => {
    const jornadaMatches = matches.filter(match => jornadaLabel(match, matches) === label)
    return jornadaMatches.length > 0 && jornadaMatches.every(match => results.some(r => r.match_id === match.id))
  }

  const pending = members.filter(member => member.status === 'pending')
  const approved = members.filter(member => member.status === 'approved')

  const isJornadaOpen = (label: string) => computeIsJornadaOpen(matches, label, openPhases)

  const handleApprove = async (memberId: string) => {
    setLoading(memberId)
    try {
      const member = members.find(m => m.id === memberId)
      await supabase.from('pool_members').update({ status: 'approved' }).eq('id', memberId)
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'approved' } : m))

      if (member) {
        await supabase.from('notifications').upsert({
          pool_id: poolId,
          scope: 'global',
          type: 'member_joined',
          title: 'Nuevo miembro',
          body: `${member.username} se ha unido a la porra.`,
          related_user_id: member.user_id,
          dedupe_key: `member_joined:${member.user_id}`,
        }, { onConflict: 'pool_id,dedupe_key' })
      }
    } catch (err) {
      console.error('Error approving member:', err)
      toast.error('Error al aceptar el usuario. Intenta de nuevo.')
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
      toast.error('Error al rechazar el usuario. Intenta de nuevo.')
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
      toast.error('Error al cambiar la jornada. Intenta de nuevo.')
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
        : { match_id: matchId, home_score: homeScore, away_score: awayScore, source: 'manual' as const }

      setResults(prev => [...prev.filter(result => result.match_id !== matchId), updated as Result])

      await supabase.from('results').upsert({
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        source: 'manual',
      }, { onConflict: 'match_id' })

      await notifyPointsEarned(matchId, homeScore, awayScore)
    } catch (err) {
      console.error('Error setting result:', err)
      toast.error('Error al guardar el resultado. Intenta de nuevo.')
    }
  }

  const notifyPointsEarned = async (matchId: string, homeScore: number, awayScore: number) => {
    const match = matches.find(item => item.id === matchId)
    if (!match) return

    const { data: preds } = await supabase
      .from('predictions')
      .select('pool_id, user_id, home_score, away_score, users(username)')
      .eq('match_id', matchId)
    if (!preds) return

    const displayHome = match.home_team || match.home || '?'
    const displayAway = match.away_team || match.away || '?'
    const jornadaNum = jornadaLabel(match, matches)

    for (const pred of preds as unknown as Array<{ pool_id: string; user_id: string; home_score: number; away_score: number; users: { username: string } | null }>) {
      const pts = scoreMatch(pred, { home_score: homeScore, away_score: awayScore }, match)
      if (pts <= 0) continue
      await supabase.from('notifications').upsert({
        pool_id: pred.pool_id,
        scope: 'global',
        type: 'points_earned',
        title: 'Puntos conseguidos',
        body: `${pred.users?.username ?? 'Un usuario'} consiguió ${pts} pto${pts === 1 ? '' : 's'} en ${displayHome} vs ${displayAway} (${jornadaNum}).`,
        related_match_id: matchId,
        related_user_id: pred.user_id,
        dedupe_key: `points_earned:${matchId}:${pred.user_id}`,
      }, { onConflict: 'pool_id,dedupe_key' })
    }
  }

  const handleToggleBonus = async (matchId: string) => {
    setLoading(`bonus-${matchId}`)
    try {
      const match = matches.find(item => item.id === matchId)
      const wasBonus = match?.is_bonus ?? false
      const { error } = await supabase.rpc('toggle_bonus_match', { target_match_id: matchId })
      if (error) throw error

      setMatches(prev => prev.map(item => {
        if (item.id === matchId) return { ...item, is_bonus: !wasBonus }
        if (!wasBonus && item.jornada === match?.jornada) return { ...item, is_bonus: false }
        return item
      }))
    } catch (err) {
      console.error('Error toggling bonus match:', err)
      toast.error('Error al cambiar el partido bonus. Intenta de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-black text-2xl tracking-wide text-gold">⚙️ ADMIN</h1>

      <div className="flex gap-1.5 flex-wrap">
        {([
          ['results', 'Resultados'],
          ['members', `Miembros${pending.length > 0 ? ` (${pending.length})` : ''}`],
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
                      <p className="text-xs text-muted">{new Date(member.created_at).toLocaleString('es')}</p>
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
            <h2 className="font-bold text-sm uppercase tracking-wide mb-3">👥 Miembros de ChampionsG&apos;s</h2>
            <div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-6">
              {approved.map(member => {
                const isMe = member.user_id === currentUserId
                return (
                  <div
                    key={member.id}
                    className={cn(
                      'relative flex flex-col items-center rounded-xl border px-1.5 pt-2.5 pb-2 w-24 aspect-[3/4] flex-shrink-0',
                      isMe ? 'border-gold/50 bg-gold/[0.06]' : 'bg-surface-2 border-border'
                    )}
                  >
                    {member.role === 'admin' && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 badge badge-admin text-[8px] px-1.5 py-0.5">
                        ADMIN
                      </span>
                    )}
                    <div className="mt-1 text-xs font-bold text-cream text-center truncate max-w-full leading-tight">
                      {member.username}
                      {isMe && <span className="text-muted font-normal"> (tú)</span>}
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <div className="rounded-full border border-border/60 bg-surface-2 p-0.5">
                        <Avatar username={member.username} avatarUrl={member.avatar_url} size="lg" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'results' && (() => {
        const renderJornadaBlock = (label: string) => {
          const jornadaMatches = matches.filter(match => jornadaLabel(match, matches) === label)
          const hasMatches = jornadaMatches.length > 0
          const isOpen = openJornada === label
          const filledCount = jornadaMatches.filter(match => results.some(r => r.match_id === match.id)).length

          return (
            <div key={label} className="border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => hasMatches && setOpenJornada(isOpen ? null : label)}
                disabled={!hasMatches}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-surface-2 transition-colors',
                  hasMatches ? 'hover:bg-surface' : 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className="font-black text-sm tracking-wide text-gold">{label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[10px] text-muted font-normal">
                    {hasMatches ? `${filledCount}/${jornadaMatches.length} cargados` : 'Sin partidos todavía'}
                  </span>
                  {hasMatches && <ChevronDown size={16} className={cn('text-muted transition-transform', isOpen && 'rotate-180')} />}
                </span>
              </button>
              {hasMatches && isOpen && (() => {
                const jornadaIsOpen = isJornadaOpen(label)
                const deadline = jornadaDeadline(matches, label)
                return (
              <div className="space-y-2 p-3">
                <button
                  type="button"
                  onClick={() => handleToggleJornada(label, jornadaIsOpen)}
                  disabled={loading === `jornada-${label}`}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50',
                    jornadaIsOpen ? 'bg-green-900 text-green-300' : 'bg-surface-2 text-muted hover:bg-surface'
                  )}
                >
                  <div>{jornadaIsOpen ? '✅ ABIERTA' : '🔒 CERRADA'}</div>
                  <div className="font-normal opacity-75 mt-0.5">
                    Cierra: {Number.isFinite(deadline) ? new Date(deadline).toLocaleString('es') : 'sin fecha'}
                  </div>
                </button>
                {jornadaMatches.map(match => {
                  const result = results.find(item => item.match_id === match.id)
                  const isBonus = match.is_bonus ?? false
                  return (
                    <div key={match.id} className={cn('bg-surface-2 border rounded-xl p-3 shadow-sm shadow-black/10', isBonus ? 'border-gold' : 'border-border')}>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-1.5">
                        <div className="flex flex-col items-center gap-1 text-center text-xs font-semibold">
                          <Flag team={match.home_team || match.home || ''} size="sm" />
                          <span className="leading-tight line-clamp-2">{match.home_team || match.home || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 pt-1">
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
                        <div className="flex flex-col items-center gap-1 text-center text-xs font-semibold">
                          <Flag team={match.away_team || match.away || ''} size="sm" />
                          <span className="leading-tight line-clamp-2">{match.away_team || match.away || '-'}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[10px] text-muted">
                          {match.date}
                        </p>
                        <button
                          onClick={() => handleToggleBonus(match.id)}
                          disabled={loading === `bonus-${match.id}`}
                          className={cn(
                            'text-[10px] font-bold px-2 py-1 rounded-full transition-colors disabled:opacity-50',
                            isBonus ? 'bg-gold text-background' : 'bg-surface text-muted hover:text-gold'
                          )}
                        >
                          {isBonus ? '⭐ Partido bonus' : 'Marcar como bonus'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
                )
              })()}
            </div>
          )
        }

        const renderVuelta = (key: 'primera' | 'segunda', title: string, labels: string[]) => {
          const completed = labels.filter(isJornadaCompleted)
          const incomplete = labels.filter(label => !isJornadaCompleted(label))
          const isOpen = openVuelta === key

          return (
            <div className="border border-gold/40 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenVuelta(isOpen ? null : key)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gold/10 hover:bg-gold/15 transition-colors"
              >
                <span className="font-black text-sm tracking-wide text-gold">{title}</span>
                <ChevronDown size={16} className={cn('text-gold transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="space-y-2 p-3">
                  {completed.length > 0 && (
                    <div className="border border-gold/40 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCompletedOpen(o => !o)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-gold/10 hover:bg-gold/15 transition-colors"
                      >
                        <span className="font-black text-sm tracking-wide text-gold">
                          Jornadas completadas ({completed.length})
                        </span>
                        <ChevronDown size={16} className={cn('text-gold transition-transform', completedOpen && 'rotate-180')} />
                      </button>
                      {completedOpen && (
                        <div className="space-y-2 p-3 bg-black/10">
                          {completed.map(label => renderJornadaBlock(label))}
                        </div>
                      )}
                    </div>
                  )}
                  {incomplete.map(label => renderJornadaBlock(label))}
                </div>
              )}
            </div>
          )
        }

        return (
          <div className="card">
            <h2 className="font-bold text-sm uppercase tracking-wide mb-1">⚽ Resultados de jornada</h2>
            <p className="text-xs text-muted mb-4">
              Introduce el marcador final de cada partido. Estos resultados alimentan el ranking.
            </p>
            <div className="space-y-2">
              {renderVuelta('primera', '1ª Vuelta', primeraVueltaLabels)}
              {renderVuelta('segunda', '2ª Vuelta', segundaVueltaLabels)}
            </div>
          </div>
        )
      })()}
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