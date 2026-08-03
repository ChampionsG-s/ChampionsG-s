'use client'

import { useMemo, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateBreakdown } from '@/lib/scoring'
import { quizRankingBonus } from '@/lib/quiz'
import { teamRouletteSpinWon, TEAM_ROULETTE_WIN_BONUS } from '@/lib/team-roulette'
import { buildUserPointsHistory } from '@/lib/points-history'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { UserPointsHistoryModal } from './user-points-history-modal'
import type { PoolMember, Prediction, Result, Match, GiftSpin, Duel, QuizResponse, TeamRouletteSpin } from '@/types'

interface RankingTableProps {
  poolId: string
  members: (PoolMember & { username: string; avatar_url?: string | null })[]
  predictions: Prediction[]
  results: Result[]
  matches: Match[]
  giftSpins: GiftSpin[]
  duels: Duel[]
  quizResponses: QuizResponse[]
  teamRouletteSpins: TeamRouletteSpin[]
  currentUserId: string
}

// Puestos 4-10: bloque propio, separado del resto. Puestos 11 en
// adelante: un unico bloque continuo. Dentro de cada cuadricula, las
// tarjetas alternan dos tintes oscuros muy sutiles para que un puesto se
// distinga del contiguo, sin romper la estetica dorada/marino.
const RANKING_ALT_TINTS = [
  'bg-slate-800/30 border-slate-600/30',
  'bg-indigo-950/35 border-indigo-800/30',
]

const PODIUM_STYLE = {
  1: {
    label: 'ORO',
    ring: 'border-gold',
    card: 'border-gold shadow-[0_0_24px_rgba(212,160,23,0.45)]',
    badge: 'bg-gold text-background',
    labelClass: 'bg-gold/15 text-gold border-gold/40',
    pts: 'text-gold',
  },
  2: {
    label: 'PLATA',
    ring: 'border-slate-300',
    card: 'border-slate-300/70 shadow-[0_8px_22px_rgba(0,0,0,0.4)]',
    badge: 'bg-slate-300 text-background',
    labelClass: 'bg-slate-300/15 text-slate-200 border-slate-300/30',
    pts: 'text-slate-300',
  },
  3: {
    label: 'BRONCE',
    ring: 'border-orange-700',
    card: 'border-orange-700/70 shadow-[0_8px_22px_rgba(0,0,0,0.4)]',
    badge: 'bg-orange-700 text-cream',
    labelClass: 'bg-orange-700/15 text-orange-300 border-orange-700/30',
    pts: 'text-orange-400',
  },
} as const

export function RankingTable({
  poolId,
  members,
  predictions,
  results: initialResults,
  matches,
  giftSpins,
  duels,
  quizResponses,
  teamRouletteSpins,
  currentUserId,
}: RankingTableProps) {
  const supabase = createClient()
  const [results, setResults] = useState(initialResults)
  const [historyUserId, setHistoryUserId] = useState<string | null>(null)

  const usernameByUserId = useMemo(() => new Map(members.map(m => [m.user_id, m.username])), [members])

  useEffect(() => {
    const channel = supabase
      .channel(`ranking-${poolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' },
        (payload) => {
          setResults(prev => {
            const filtered = prev.filter(r => r.id !== (payload.new as Result)?.id)
            return payload.eventType === 'DELETE' ? filtered : [...filtered, payload.new as Result]
          })
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, poolId])

  const resultsMap = useMemo(() => new Map(results.map(r => [r.match_id, r])), [results])

  const giftBonusByUser = useMemo(() => {
    const map = new Map<string, number>()
    for (const spin of giftSpins) {
      map.set(spin.user_id, (map.get(spin.user_id) ?? 0) + spin.delta)
    }
    return map
  }, [giftSpins])

  const duelBonusByUser = useMemo(() => {
    const map = new Map<string, number>()
    for (const duel of duels) {
      if (duel.status !== 'resolved' || !duel.winner_id) continue
      const loserId = duel.winner_id === duel.challenger_id ? duel.opponent_id : duel.challenger_id
      map.set(duel.winner_id, (map.get(duel.winner_id) ?? 0) + 2)
      map.set(loserId, (map.get(loserId) ?? 0) - 2)
    }
    return map
  }, [duels])

  const quizBonusByUser = useMemo(() => {
    const correctCounts = new Map<string, number>()
    for (const response of quizResponses) {
      if (!response.is_correct) continue
      correctCounts.set(response.user_id, (correctCounts.get(response.user_id) ?? 0) + 1)
    }
    const map = new Map<string, number>()
    for (const [userId, count] of correctCounts) map.set(userId, quizRankingBonus(count))
    return map
  }, [quizResponses])

  const teamRouletteBonusByUser = useMemo(() => {
    const map = new Map<string, number>()
    for (const spin of teamRouletteSpins) {
      if (!teamRouletteSpinWon(spin, results)) continue
      map.set(spin.user_id, (map.get(spin.user_id) ?? 0) + TEAM_ROULETTE_WIN_BONUS)
    }
    return map
  }, [teamRouletteSpins, results])

  const ranking = useMemo(() => {
    return members
      .map(member => {
        const userPreds = predictions.filter(p => p.user_id === member.user_id)

        const breakdown = calculateBreakdown(
          userPreds, resultsMap, matches,
          [], [],
          [], []
        )

        const giftBonus = giftBonusByUser.get(member.user_id) ?? 0
        const duelBonus = duelBonusByUser.get(member.user_id) ?? 0
        const quizBonus = quizBonusByUser.get(member.user_id) ?? 0
        const teamRouletteBonus = teamRouletteBonusByUser.get(member.user_id) ?? 0

        return {
          member, ...breakdown, giftBonus, duelBonus, quizBonus, teamRouletteBonus,
          total: breakdown.total + giftBonus + duelBonus + quizBonus + teamRouletteBonus,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [members, predictions, resultsMap, matches, giftBonusByUser, duelBonusByUser, quizBonusByUser, teamRouletteBonusByUser])

  const top3 = ranking.slice(0, 3)
  const rest = ranking.slice(3)

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl tracking-wide text-gold px-1">Ranking</h2>

      {ranking.length === 0 && (
        <p className="text-muted text-sm px-1">Sin jugadores aún.</p>
      )}

      {top3.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-gold/45 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src="/videos/shield-celebration.mp4" type="video/mp4" />
          </video>
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,11,22,0.55),rgba(7,11,22,0.82)_65%,rgba(7,11,22,0.95)_100%)]" />

          <div className="relative flex items-end justify-center gap-2.5 sm:gap-4 px-3 sm:px-8 pt-8 pb-4">
            {[1, 0, 2].map((idx) => {
              const entry = top3[idx]
              const place = (idx + 1) as 1 | 2 | 3

              if (!entry) return <div key={place} className="flex-1 max-w-[130px]" />

              const style = PODIUM_STYLE[place]
              const isFirst = place === 1

              return (
                <button
                  key={entry.member.id}
                  type="button"
                  onClick={() => setHistoryUserId(entry.member.user_id)}
                  className={cn(
                    'relative flex-1 max-w-[130px] flex flex-col items-center rounded-2xl border-2 bg-black/45 backdrop-blur-[2px] px-2 sm:px-3 pb-3 transition-transform active:scale-[0.97]',
                    style.card,
                    isFirst ? 'pt-9 -translate-y-2' : 'pt-8'
                  )}
                >
                  <div className={cn('absolute -top-6 left-1/2 -translate-x-1/2 rounded-full border-[3px] bg-surface-2 p-0.5', style.ring)}>
                    <Avatar
                      username={entry.member.username}
                      avatarUrl={entry.member.avatar_url}
                      size={isFirst ? 'lg' : 'md'}
                    />
                    <span
                      className={cn(
                        'absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black',
                        style.badge
                      )}
                    >
                      {place}
                    </span>
                  </div>
                  <div className="mt-2 text-xs sm:text-sm font-bold text-cream text-center truncate max-w-full">
                    {entry.member.username}
                  </div>
                  <span className={cn('mt-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full border', style.labelClass)}>
                    {style.label}
                  </span>
                  <div className={cn('mt-1.5 font-display text-xl tracking-wide leading-none', isFirst && 'text-2xl', style.pts)}>
                    {entry.total} <span className="text-[10px] font-sans text-muted">pts</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {rest.length > 0 && (() => {
        const withPos = rest.map((entry, i) => ({ entry, pos: i + 4 }))

        const renderCard = ({ entry, pos }: { entry: (typeof withPos)[number]['entry']; pos: number }, idx: number) => {
          const isMe = entry.member.user_id === currentUserId
          return (
            <button
              key={entry.member.id}
              type="button"
              onClick={() => setHistoryUserId(entry.member.user_id)}
              className={cn(
                'relative flex flex-col items-center rounded-xl border px-1.5 pt-2.5 pb-2 w-24 aspect-[3/4] flex-shrink-0 transition-transform active:scale-[0.97]',
                isMe ? 'border-gold/50 bg-gold/[0.06]' : RANKING_ALT_TINTS[idx % RANKING_ALT_TINTS.length]
              )}
            >
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-surface-2 border border-border/60 flex items-center justify-center text-[9px] font-black text-muted">
                {pos}
              </span>
              <div className="mt-1 text-xs font-bold text-cream text-center truncate max-w-full leading-tight">
                {entry.member.username}
              </div>
              <div className="flex-1 flex items-center justify-center">
                <div className="rounded-full border border-border/60 bg-surface-2 p-0.5">
                  <Avatar username={entry.member.username} avatarUrl={entry.member.avatar_url} size="lg" />
                </div>
              </div>
              <div className="font-display text-sm text-cream leading-none">
                {entry.total}pts
              </div>
            </button>
          )
        }

        return (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted uppercase tracking-wide px-1">
              Puestos {withPos[0].pos}–{withPos[withPos.length - 1].pos}
            </p>
            <div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-6">
              {withPos.map((item, i) => renderCard(item, i))}
            </div>
          </div>
        )
      })()}

      <div className="card">
        <h3 className="font-bold text-sm text-gold mb-3">Sistema de puntos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {[
            ['1pt', 'Signo acertado (1 / X / 2) en partido normal'],
            ['⭐ 3 / 1pts', 'Partido bonus: exacto / solo signo'],
            ['0pts', 'Fallo'],
            ['Cierre', 'Cada jornada se cierra sola al llegar la fecha de su primer partido'],
            ['Ver', 'Las apuestas de una jornada se revelan cuando cierra'],
            ['🧠 +2pts', 'Quiz: cada 2 aciertos acumulados suman 2 puntos'],
            ['🔀 +1pt', 'Ruleta de equipos: si el equipo que te toca gana su partido'],
          ].map(([pts, label]) => (
            <div key={label} className="flex gap-2.5 items-start">
              <span className="font-bold text-gold min-w-[64px] shrink-0">{pts}</span>
              <span className="text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {historyUserId !== null && (() => {
        const entry = ranking.find(r => r.member.user_id === historyUserId)
        if (!entry) return null
        const history = buildUserPointsHistory(historyUserId, {
          predictions, results, matches, giftSpins, duels, quizResponses, teamRouletteSpins, usernameByUserId,
        })
        return (
          <UserPointsHistoryModal
            username={entry.member.username}
            avatarUrl={entry.member.avatar_url}
            total={entry.total}
            history={history}
            onClose={() => setHistoryUserId(null)}
          />
        )
      })()}
    </div>
  )
}
