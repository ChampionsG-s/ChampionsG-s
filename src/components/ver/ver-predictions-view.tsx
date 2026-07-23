'use client'

import { useState } from 'react'
import { scoreMatch } from '@/lib/scoring'
import { SPAIN_FIELDS, AWARDS, PHASE_INFO } from '@/lib/data/matches'
import { Flag } from '@/components/ui/flag'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import type { PoolMember, Match, Result, Prediction, AwardResult, AwardPrediction, SpainResult, SpainPrediction, PoolMatchTeams } from '@/types'

interface VerPredictionsViewProps {
  currentUserId: string
  currentMembership: PoolMember
  members: (PoolMember & { username: string })[]
  matches: Match[]
  results: Result[]
  predictions: Prediction[]
  awardResults: AwardResult[]
  awardPredictions: AwardPrediction[]
  spainResults: SpainResult[]
  spainPredictions: SpainPrediction[]
  matchTeams: PoolMatchTeams[]
}

export function VerPredictionsView({
  currentUserId,
  currentMembership,
  members,
  matches,
  results,
  predictions,
  awardResults,
  awardPredictions,
  spainResults,
  spainPredictions,
  matchTeams,
}: VerPredictionsViewProps) {
  const isFullyLocked = currentMembership.locked_matches && currentMembership.locked_spain && currentMembership.locked_awards

  if (!isFullyLocked) {
    const missing = []
    if (!currentMembership.locked_matches) missing.push('🎯 Partidos')
    if (!currentMembership.locked_spain) missing.push('🇪🇸 España')
    if (!currentMembership.locked_awards) missing.push('🏅 Premios')

    return (
      <div className="card border-red-900">
        <h2 className="font-black text-lg text-red-300 mb-2">🔒 Acceso bloqueado</h2>
        <p className="text-sm text-muted">Para ver las predicciones de los demás necesitas guardar todas las secciones.</p>
        <p className="text-sm text-amber-200 mt-2">Pendiente: {missing.join(', ')}</p>
      </div>
    )
  }

  const others = members.filter(m => m.user_id !== currentUserId)

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-black text-lg tracking-wide text-gold mb-1">👁 Predicciones de tus amigos</h2>
        <p className="text-xs text-muted">Solo ves a quienes ya han bloqueado las tres secciones.</p>
      </div>

      {others.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted text-sm">Aún no hay más jugadores en esta porra.</p>
        </div>
      ) : (
        others.map(member => (
          <UserPredictionsCard
            key={member.id}
            member={member}
            matches={matches}
            results={results}
            predictions={predictions.filter(p => p.user_id === member.user_id)}
            awardResults={awardResults}
            awardPredictions={awardPredictions.filter(p => p.user_id === member.user_id)}
            spainResults={spainResults}
            spainPredictions={spainPredictions.filter(p => p.user_id === member.user_id)}
            matchTeams={matchTeams}
          />
        ))
      )}
    </div>
  )
}

// ─── Per-user collapsible card ─────────────────────────────────────────────────

interface UserPredictionsCardProps {
  member: PoolMember & { username: string }
  matches: Match[]
  results: Result[]
  predictions: Prediction[]
  awardResults: AwardResult[]
  awardPredictions: AwardPrediction[]
  spainResults: SpainResult[]
  spainPredictions: SpainPrediction[]
  matchTeams: PoolMatchTeams[]
}

const PHASE_ORDER_DISPLAY = ['grupos', '32avos', 'octavos', 'cuartos', 'semis', '3er', 'final']

function UserPredictionsCard({
  member, matches, results, predictions,
  awardResults, awardPredictions, spainResults, spainPredictions, matchTeams,
}: UserPredictionsCardProps) {
  const [open, setOpen] = useState(false)
  const [openPhase, setOpenPhase] = useState<string | null>(null)
  const [openSection, setOpenSection] = useState<'spain' | 'awards' | null>(null)

  const isFullyLocked = member.locked_matches && member.locked_spain && member.locked_awards

  if (!isFullyLocked) {
    return (
      <div className="card opacity-50">
        <p className="font-bold text-sm">{member.username}</p>
        <p className="text-xs text-muted mt-1">Todavía no ha bloqueado todas las secciones</p>
      </div>
    )
  }

  const resultsMap = new Map(results.map(r => [r.match_id, r]))
  const matchTeamsMap = new Map(matchTeams.map(mt => [mt.match_id, mt]))

  let matchTotal = 0
  predictions.forEach(p => {
    const m = matches.find(mm => mm.id === p.match_id)
    const r = resultsMap.get(p.match_id)
    if (m && r) matchTotal += scoreMatch(p, r, m)
  })

  let awardTotal = 0
  awardPredictions.forEach(p => {
    const official = awardResults.find(r => r.award_id === p.award_id)?.value
    const award = AWARDS.find(a => a.id === p.award_id)
    if (official && award && p.value.trim().toLowerCase() === official.trim().toLowerCase()) awardTotal += award.pts
  })

  let spainTotal = 0
  spainPredictions.forEach(p => {
    const official = spainResults.find(r => r.field_id === p.field_id)?.value
    const field = SPAIN_FIELDS.find(f => f.id === p.field_id)
    if (official && field && p.value.toString().trim().toLowerCase() === official.toString().trim().toLowerCase()) spainTotal += field.pts
  })

  const total = matchTotal + awardTotal + spainTotal

  // Build phases that have predictions
  const predictedMatchIds = new Set(predictions.map(p => p.match_id))
  const phasesWithPreds = PHASE_ORDER_DISPLAY.filter(ph => {
    const phMatches = ph === 'semis'
      ? matches.filter(m => m.phase === 'semis' || m.phase === '3er')
      : matches.filter(m => m.phase === ph)
    return phMatches.some(m => predictedMatchIds.has(m.id))
  })

  // Points per phase
  function phaseMatchPoints(ph: string) {
    const phMatches = ph === 'semis'
      ? matches.filter(m => m.phase === 'semis' || m.phase === '3er')
      : matches.filter(m => m.phase === ph)
    let pts = 0
    phMatches.forEach(m => {
      const pred = predictions.find(p => p.match_id === m.id)
      const r = resultsMap.get(m.id)
      if (pred && r) pts += scoreMatch(pred, r, m)
    })
    return pts
  }

  return (
    <div className="card">
      {/* Header — user + total */}
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2">
        <span className="font-bold text-sm flex-1 text-left flex items-center gap-1.5">
          {member.username}
          {member.role === 'admin' && <span className="badge badge-admin">ADMIN</span>}
        </span>
        <span className="font-black text-xl text-gold">{total}pts</span>
        <ChevronDown size={16} className={cn('text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-3 space-y-1.5">
          {/* Phase sections */}
          {phasesWithPreds.map(ph => {
            const phMatches = ph === 'semis'
              ? matches.filter(m => m.phase === 'semis' || m.phase === '3er')
              : matches.filter(m => m.phase === ph)
            const phPreds = phMatches.filter(m => predictedMatchIds.has(m.id))
            const phPts = phaseMatchPoints(ph)
            const isOpenPhase = openPhase === ph

            return (
              <div key={ph} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenPhase(isOpenPhase ? null : ph)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface-2 hover:bg-surface transition-colors"
                >
                  <span className="text-xs font-bold flex-1 text-left">
                    {PHASE_INFO[ph]?.full ?? ph}
                  </span>
                  <span className="text-xs font-bold text-gold">{phPts}pts</span>
                  <ChevronDown size={14} className={cn('text-muted transition-transform', isOpenPhase && 'rotate-180')} />
                </button>

                {isOpenPhase && (
                  <div className="p-2 space-y-1.5">
                    {phPreds.map(m => {
                      const pred = predictions.find(p => p.match_id === m.id)!
                      const result = resultsMap.get(m.id)
                      const pts = result ? scoreMatch(pred, result, m) : null
                      const realTeams = matchTeamsMap.get(m.id)
                      const displayHome = realTeams?.real_home || m.home_team || m.home || '?'
                      const displayAway = realTeams?.real_away || m.away_team || m.away || '?'
                      const ptsExactValue = m.pts_exact ?? 3
                      return (
                        <div key={m.id} className="bg-background border border-border rounded-lg px-2.5 py-2">
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Flag team={displayHome} size="sm" />
                              <span className="truncate">{displayHome}</span>
                            </div>
                            <div className="flex flex-col items-center gap-0.5 min-w-[70px]">
                              {result && (
                                <span className="font-black text-sm text-gold">{result.home_score}–{result.away_score}</span>
                              )}
                              <span className="font-bold text-muted">{pred.home_score}–{pred.away_score}</span>
                              {pts !== null && (
                                <span className={cn(
                                  'text-[10px] font-bold px-1.5 rounded-full',
                                  pts === ptsExactValue ? 'bg-green-900 text-green-300' : pts > 0 ? 'bg-amber-900 text-amber-300' : 'bg-red-900 text-red-300'
                                )}>
                                  {pts}pts
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-row-reverse">
                              <Flag team={displayAway} size="sm" />
                              <span className="truncate text-right">{displayAway}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Spain section */}
          {spainPredictions.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenSection(openSection === 'spain' ? null : 'spain')}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface-2 hover:bg-surface transition-colors"
              >
                <span className="text-xs font-bold flex-1 text-left">🇪🇸 España</span>
                <span className="text-xs font-bold text-gold">{spainTotal}pts</span>
                <ChevronDown size={14} className={cn('text-muted transition-transform', openSection === 'spain' && 'rotate-180')} />
              </button>
              {openSection === 'spain' && (
                <div className="p-2 space-y-1">
                  {spainPredictions.map(p => {
                    const field = SPAIN_FIELDS.find(f => f.id === p.field_id)
                    if (!field) return null
                    const official = spainResults.find(r => r.field_id === p.field_id)?.value
                    const correct = official && p.value.trim().toLowerCase() === official.trim().toLowerCase()
                    return (
                      <div key={p.field_id} className="flex items-center justify-between text-xs py-1.5 border-b border-surface last:border-0">
                        <span className="text-muted">{field.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{p.value}</span>
                          {official && (
                            <span className={cn('text-[10px] font-bold px-1.5 rounded-full', correct ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300')}>
                              {correct ? `+${field.pts}pts` : '✗'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Awards section */}
          {awardPredictions.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setOpenSection(openSection === 'awards' ? null : 'awards')}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface-2 hover:bg-surface transition-colors"
              >
                <span className="text-xs font-bold flex-1 text-left">🏅 Premios FIFA</span>
                <span className="text-xs font-bold text-gold">{awardTotal}pts</span>
                <ChevronDown size={14} className={cn('text-muted transition-transform', openSection === 'awards' && 'rotate-180')} />
              </button>
              {openSection === 'awards' && (
                <div className="p-2 space-y-1">
                  {awardPredictions.map(p => {
                    const award = AWARDS.find(a => a.id === p.award_id)
                    if (!award) return null
                    const official = awardResults.find(r => r.award_id === p.award_id)?.value
                    const correct = official && p.value.trim().toLowerCase() === official.trim().toLowerCase()
                    return (
                      <div key={p.award_id} className="flex items-center justify-between text-xs py-1.5 border-b border-surface last:border-0">
                        <span className="text-muted">{award.icon} {award.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{p.value}</span>
                          {official && (
                            <span className={cn('text-[10px] font-bold px-1.5 rounded-full', correct ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300')}>
                              {correct ? `+${award.pts}pts` : '✗'}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}