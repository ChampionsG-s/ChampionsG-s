'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { scoreMatch, signFromScores, SIGN_TO_CANONICAL_SCORE, type MatchSign } from '@/lib/scoring'
import { jornadaLabelForMatch, isJornadaOpen as computeIsJornadaOpen, type OpenPhase } from '@/lib/jornada'
import { JORNADAS } from '@/lib/data/matches'
import { isLastJornadaOfGiftBlock, giftBlockForJornadaNumber } from '@/lib/gift'
import { isFirstJornadaOfQuizBlock, quizBlockForJornadaNumber } from '@/lib/quiz'
import { teamRouletteSpinWon } from '@/lib/team-roulette'
import { GiftRouletteModal } from '@/components/gift/gift-roulette-modal'
import { QuizModal } from '@/components/quiz/quiz-modal'
import { TeamRouletteModal, type TeamRouletteEntry } from '@/components/team-roulette/team-roulette-modal'
import { PendingDuelsPanel } from '@/components/duels/pending-duels-panel'
import { ChallengeModal } from '@/components/duels/challenge-modal'
import { DuelRevealModal } from '@/components/duels/duel-reveal-modal'
import { rankValue } from '@/lib/duels'
import type { MemberTotal } from '@/lib/ranking-totals'
import { Flag } from '@/components/ui/flag'
import { cn } from '@/lib/utils'
import type { Match, Result, Prediction, PoolMember, PoolMatchTeams, GiftSpin, Duel, DuelSuit, AppUser, QuizQuestion, QuizResponse, TeamRouletteSpin } from '@/types'

interface MatchesListProps {
  poolId: string
  matches: Match[]
  results: Result[]
  predictions: Prediction[]
  openPhases: OpenPhase[]
  membership: PoolMember
  matchTeams: PoolMatchTeams[]
  giftSpins: GiftSpin[]
  incomingDuels: Duel[]
  outgoingDuels: Duel[]
  readyToDrawDuels: Duel[]
  resolvedDuelNotifications: { notificationId: string; duel: Duel }[]
  users: AppUser[]
  memberTotals: MemberTotal[]
  quizQuestions: QuizQuestion[]
  quizResponses: QuizResponse[]
  teamRouletteSpins: TeamRouletteSpin[]
}

export function MatchesList({
  poolId,
  matches,
  results: initialResults,
  predictions: initialPredictions,
  openPhases: initialOpenPhases,
  membership,
  matchTeams: initialMatchTeams,
  giftSpins: initialGiftSpins,
  incomingDuels,
  outgoingDuels,
  readyToDrawDuels,
  resolvedDuelNotifications,
  users,
  memberTotals,
  quizQuestions,
  quizResponses: initialQuizResponses,
  teamRouletteSpins: initialTeamRouletteSpins,
}: MatchesListProps) {
  const [results, setResults] = useState<Result[]>(initialResults)
  const [predictions, setPredictions] = useState<Prediction[]>(initialPredictions)
  const [openPhases, setOpenPhases] = useState<OpenPhase[]>(initialOpenPhases)
  const [matchTeams, setMatchTeams] = useState<PoolMatchTeams[]>(initialMatchTeams)
  const [giftSpins, setGiftSpins] = useState<GiftSpin[]>(initialGiftSpins)
  const [quizResponses, setQuizResponses] = useState<QuizResponse[]>(initialQuizResponses)
  const [teamRouletteSpins, setTeamRouletteSpins] = useState<TeamRouletteSpin[]>(initialTeamRouletteSpins)
  const [openGift, setOpenGift] = useState<{ block: number; unlocked: boolean } | null>(null)
  const [openQuiz, setOpenQuiz] = useState<{ block: number; unlocked: boolean } | null>(null)
  const [openTeamRoulette, setOpenTeamRoulette] = useState<{ jornadaNumber: number; jornadaLabel: string; unlocked: boolean } | null>(null)
  const [challengeOpen, setChallengeOpen] = useState<{ unlocked: boolean } | null>(null)
  const [testDuel, setTestDuel] = useState<Duel | null>(null)
  const usersMap = new Map(users.map(u => [u.id, { username: u.username, avatar_url: u.avatar_url }]))
  const [jornada, setJornada] = useState<string>(() => {
    const firstOpen = JORNADAS.find(label => computeIsJornadaOpen(matches, label, initialOpenPhases))
    if (firstOpen) return firstOpen
    for (let i = JORNADAS.length - 1; i >= 0; i--) {
      if (matches.some(m => jornadaLabelForMatch(m, matches) === JORNADAS[i])) return JORNADAS[i]
    }
    return JORNADAS[0]
  })
  const activeTabRef = useRef<HTMLButtonElement | null>(null)
  const [savingJornada, setSavingJornada] = useState(false)
  const [savedJornada, setSavedJornada] = useState<string | null>(null)
  const [committedMatchIds, setCommittedMatchIds] = useState<Set<string>>(
    () => new Set(initialPredictions.map(p => p.match_id))
  )
  const supabase = createClient()

  const isAdmin = membership.role === 'admin'

  // Genera un duelo falso (nunca se guarda en la base) solo para que el
  // admin pueda probar la animacion de cartas sin tener que retar de
  // verdad a nadie.
  const buildTestDuel = (): Duel => {
    const suits: DuelSuit[] = ['oros', 'copas', 'espadas', 'bastos']
    const randomCard = () => ({
      rank: Math.floor(Math.random() * 10) + 1,
      suit: suits[Math.floor(Math.random() * suits.length)],
    })
    const c1 = randomCard(), c2 = randomCard(), c3 = randomCard(), c4 = randomCard()
    const myTotal = rankValue(c1.rank) + rankValue(c2.rank)
    const rivalTotal = rankValue(c3.rank) + rankValue(c4.rank)
    const fakeOpponentId = 'test-opponent'
    const winner = myTotal > rivalTotal ? membership.user_id : rivalTotal > myTotal ? fakeOpponentId : null
    const now = new Date().toISOString()
    return {
      id: 'test-duel',
      pool_id: poolId,
      challenger_id: membership.user_id,
      opponent_id: fakeOpponentId,
      status: 'resolved',
      challenger_card1_rank: c1.rank, challenger_card1_suit: c1.suit,
      challenger_card2_rank: c2.rank, challenger_card2_suit: c2.suit,
      opponent_card1_rank: c3.rank, opponent_card1_suit: c3.suit,
      opponent_card2_rank: c4.rank, opponent_card2_suit: c4.suit,
      winner_id: winner,
      created_at: now,
      resolved_at: now,
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel(`matches-${poolId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results' },
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

  const jornadaForMatch = (match: Match) => jornadaLabelForMatch(match, matches)
  const jornadas = JORNADAS
  const isJornadaOpen = (label: string) => computeIsJornadaOpen(matches, label, openPhases)
  const getPred = (matchId: string) => predictions.find(p => p.match_id === matchId)
  const getResult = (matchId: string) => results.find(r => r.match_id === matchId)
  const getRealTeams = (matchId: string) => matchTeams.find(mt => mt.match_id === matchId)

  const buildTeamRouletteEntries = (label: string): TeamRouletteEntry[] => {
    const jornadaMatches = matches.filter(m => jornadaForMatch(m) === label)
    return jornadaMatches.flatMap(m => {
      const realTeams = getRealTeams(m.id)
      const home = realTeams?.real_home || m.home_team || m.home || '?'
      const away = realTeams?.real_away || m.away_team || m.away || '?'
      return [
        { matchId: m.id, side: 'home' as const, name: home },
        { matchId: m.id, side: 'away' as const, name: away },
      ]
    })
  }

  const handlePrediction = useCallback((matchId: string, side: 'home_score' | 'away_score', value: string) => {
    const match = matches.find(m => m.id === matchId)
    if (!match || !isJornadaOpen(jornadaForMatch(match))) return
    const num = value === '' ? 0 : Math.min(30, Math.max(0, parseInt(value) || 0))
    const existing = predictions.find(p => p.match_id === matchId)
    const homeScore = side === 'home_score' ? num : (existing?.home_score ?? 0)
    const awayScore = side === 'away_score' ? num : (existing?.away_score ?? 0)
    const updated = existing
      ? { ...existing, home_score: homeScore, away_score: awayScore }
      : { match_id: matchId, pool_id: poolId, user_id: membership.user_id, home_score: homeScore, away_score: awayScore }

    setPredictions(prev => [...prev.filter(p => p.match_id !== matchId), updated as Prediction])
    setSavedJornada(null)
  }, [predictions, poolId, membership.user_id, matches])

  const handleSignPrediction = useCallback((matchId: string, sign: MatchSign) => {
    const match = matches.find(m => m.id === matchId)
    if (!match || !isJornadaOpen(jornadaForMatch(match))) return
    const { home_score: homeScore, away_score: awayScore } = SIGN_TO_CANONICAL_SCORE[sign]
    const existing = predictions.find(p => p.match_id === matchId)
    const updated = existing
      ? { ...existing, home_score: homeScore, away_score: awayScore }
      : { match_id: matchId, pool_id: poolId, user_id: membership.user_id, home_score: homeScore, away_score: awayScore }

    setPredictions(prev => [...prev.filter(p => p.match_id !== matchId), updated as Prediction])
    setSavedJornada(null)
  }, [predictions, poolId, membership.user_id, matches])

  const visibleMatches = jornada
    ? matches.filter(m => jornadaForMatch(m) === jornada)
    : matches.filter(m => jornadaForMatch(m) === jornadas[0])

  const currentJornada = jornada || jornadas[0]
  const currentOpen = isJornadaOpen(currentJornada)
  const bettableMatches = visibleMatches.filter(m => !getResult(m.id))
  const allBetsFilled = bettableMatches.length > 0 && bettableMatches.every(m => getPred(m.id))
  // Una jornada se ve como "resumen" (tabla compacta) si el usuario ya tiene
  // pronostico ahi y no queda nada pendiente de guardar: o bien ya se
  // guardo (committedMatchIds), o bien el partido ya tiene resultado (no
  // tiene sentido seguir mostrando el formulario de apuesta editable).
  const isJornadaCommitted = visibleMatches.length > 0
    && visibleMatches.some(m => getPred(m.id))
    && visibleMatches.every(m => committedMatchIds.has(m.id) || !!getResult(m.id))
  const jornadaTotalPoints = visibleMatches.reduce((sum, m) => {
    const pred = getPred(m.id)
    const result = getResult(m.id)
    return pred && result ? sum + scoreMatch(pred, result, m) : sum
  }, 0)

  const handleSaveBets = useCallback(async () => {
    const toSave = bettableMatches
      .map(m => predictions.find(p => p.match_id === m.id))
      .filter((p): p is Prediction => !!p)

    if (toSave.length === 0) return

    setSavingJornada(true)
    try {
      await Promise.all(toSave.map(p =>
        supabase.from('predictions').upsert({
          pool_id: poolId,
          user_id: membership.user_id,
          match_id: p.match_id,
          home_score: p.home_score,
          away_score: p.away_score,
        }, { onConflict: 'pool_id,user_id,match_id' })
      ))

      await supabase.from('notifications').upsert({
        pool_id: poolId,
        user_id: membership.user_id,
        scope: 'personal',
        type: 'prediction_saved',
        title: 'Apuestas guardadas',
        body: `Guardaste tus apuestas de ${currentJornada} (${toSave.length} partido${toSave.length !== 1 ? 's' : ''}).`,
        dedupe_key: `prediction_saved:${membership.user_id}:${currentJornada}:${Date.now()}`,
      }, { onConflict: 'pool_id,dedupe_key' })

      setSavedJornada(currentJornada)
      setCommittedMatchIds(prev => {
        const next = new Set(prev)
        toSave.forEach(p => next.add(p.match_id))
        return next
      })
    } catch (err) {
      console.error('Error saving bets:', err)
      toast.error('Error al guardar las apuestas. Intenta de nuevo.')
    } finally {
      setSavingJornada(false)
    }
  }, [bettableMatches, predictions, supabase, poolId, membership.user_id, currentJornada])

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ inline: 'start', block: 'nearest' })
  }, [])

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl px-4 py-3 text-sm border',
          isJornadaCommitted
            ? 'bg-green-900/20 border-green-800/60 text-green-200'
            : currentOpen
              ? 'bg-amber-900/20 border-amber-800/60 text-amber-200'
              : 'bg-blue-900/20 border-blue-800/60 text-blue-200'
        )}
      >
        <span>{isJornadaCommitted ? '✅' : currentOpen ? '⚠️' : '🔒'}</span>
        <span className="text-xs sm:text-sm">
          {isJornadaCommitted
            ? 'Ya apostaste en esta jornada · Tus pronósticos quedaron bloqueados'
            : currentOpen
              ? 'Las apuestas se cierran cuando llegue la fecha límite de la jornada'
              : 'Jornada cerrada · Ya no se puede apostar en esta jornada'}
        </span>
      </div>

      <PendingDuelsPanel
        incomingDuels={incomingDuels}
        outgoingDuels={outgoingDuels}
        readyToDrawDuels={readyToDrawDuels}
        resolvedNotifications={resolvedDuelNotifications}
        currentUserId={membership.user_id}
        usersMap={usersMap}
      />

      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 py-0.5 snap-x scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {jornadas.map((label, i) => {
          const open = isJornadaOpen(label)
          const active = currentJornada === label
          const jornadaNumber = i + 1
          const giftBlock = isLastJornadaOfGiftBlock(jornadaNumber) ? giftBlockForJornadaNumber(jornadaNumber) : null
          const spun = giftBlock !== null ? giftSpins.find(g => g.block_number === giftBlock) : undefined
          const isDuelSlot = jornadaNumber % 3 === 2
          return (
            <div key={label} className="flex gap-1.5 flex-shrink-0">
              <button
                ref={active ? activeTabRef : undefined}
                onClick={() => setJornada(label)}
                title={label}
                className={cn(
                  'snap-start flex-shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full text-xs font-bold transition-all',
                  active
                    ? 'bg-gradient-to-b from-gold-2 to-gold text-background shadow-md shadow-gold/20'
                    : open
                      ? 'border border-border text-muted hover:border-gold hover:text-gold'
                      : 'border border-orange-950 bg-orange-950/70 text-orange-800 cursor-not-allowed'
                )}
              >
                {label} {!open && '🔒'}
              </button>
              {isFirstJornadaOfQuizBlock(jornadaNumber) && (() => {
                const quizBlock = quizBlockForJornadaNumber(jornadaNumber)
                const answered = quizResponses.find(r => r.block_number === quizBlock)
                return (
                  <button
                    onClick={() => setOpenQuiz({ block: quizBlock, unlocked: open })}
                    title={open ? 'Quiz' : 'Quiz (aún bloqueado)'}
                    className={cn(
                      'snap-start flex-shrink-0 whitespace-nowrap px-3 py-2 rounded-full text-xs font-bold transition-all border',
                      !open
                        ? 'border-border/40 text-muted/50'
                        : answered
                          ? 'border-border text-muted hover:border-gold hover:text-gold'
                          : 'border-gold/60 bg-gold/10 text-gold shadow-[0_0_10px_rgba(212,160,23,0.25)] animate-pulse'
                    )}
                  >
                    🧠
                  </button>
                )
              })()}
              {giftBlock !== null && (
                <button
                  onClick={() => setOpenGift({ block: giftBlock, unlocked: open })}
                  title={open ? 'Ruleta regalo' : 'Ruleta regalo (aún bloqueada)'}
                  className={cn(
                    'snap-start flex-shrink-0 whitespace-nowrap px-3 py-2 rounded-full text-xs font-bold transition-all border',
                    !open
                      ? 'border-border/40 text-muted/50'
                      : spun
                        ? 'border-border text-muted hover:border-gold hover:text-gold'
                        : 'border-gold/60 bg-gold/10 text-gold shadow-[0_0_10px_rgba(212,160,23,0.25)] animate-pulse'
                  )}
                >
                  🎁
                </button>
              )}
              {giftBlock !== null && (() => {
                const spunTeam = teamRouletteSpins.find(s => s.jornada_number === jornadaNumber)
                return (
                  <button
                    onClick={() => setOpenTeamRoulette({ jornadaNumber, jornadaLabel: label, unlocked: open })}
                    title={open ? 'Ruleta de equipos' : 'Ruleta de equipos (aún bloqueada)'}
                    className={cn(
                      'snap-start flex-shrink-0 whitespace-nowrap px-3 py-2 rounded-full text-xs font-bold transition-all border',
                      !open
                        ? 'border-border/40 text-muted/50'
                        : spunTeam
                          ? 'border-border text-muted hover:border-gold hover:text-gold'
                          : 'border-gold/60 bg-gold/10 text-gold shadow-[0_0_10px_rgba(212,160,23,0.25)] animate-pulse'
                    )}
                  >
                    🔀
                  </button>
                )
              })()}
              {isDuelSlot && (
                <button
                  onClick={() => setChallengeOpen({ unlocked: open })}
                  title={open ? 'Retar a un duelo' : 'Retar a un duelo (aún bloqueado)'}
                  className={cn(
                    'snap-start flex-shrink-0 whitespace-nowrap px-3 py-2 rounded-full text-xs font-bold transition-all border',
                    open
                      ? 'border-border text-muted hover:border-gold hover:text-gold'
                      : 'border-border/40 text-muted/50'
                  )}
                >
                  ⚔️
                </button>
              )}
            </div>
          )
        })}
      </div>

      {isAdmin && (
        <div className="bg-red-900/15 border border-red-900/50 rounded-xl px-4 py-2.5 text-xs text-red-300 font-bold uppercase tracking-wide flex items-center justify-between gap-2">
          <span>Admin — controla los resultados y la apertura de cada jornada</span>
          <button
            type="button"
            onClick={() => setTestDuel(buildTestDuel())}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg border border-red-700/60 text-red-200 normal-case font-bold hover:bg-red-900/30 transition-colors"
          >
            🧪 Probar duelo
          </button>
        </div>
      )}

      {isJornadaCommitted ? (
        <div className="card !p-0 overflow-hidden divide-y divide-border/60">
          {visibleMatches.map(m => (
            <BetSummaryRow
              key={m.id}
              match={m}
              realTeams={getRealTeams(m.id)}
              pred={getPred(m.id)}
              result={getResult(m.id)}
            />
          ))}
          <div className="flex items-center justify-between px-4 py-3 bg-surface-2/40">
            <span className="text-xs font-bold text-muted uppercase tracking-wide">Puntuación total</span>
            <span className="font-display text-lg text-gold">{jornadaTotalPoints}pts</span>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {visibleMatches.map(m => (
              <MatchCard
                key={m.id}
                match={m}
                realTeams={getRealTeams(m.id)}
                pred={getPred(m.id)}
                result={getResult(m.id)}
                isLocked={!currentOpen}
                onPred={handlePrediction}
                onSignPred={handleSignPrediction}
              />
            ))}
          </div>

          {currentOpen && bettableMatches.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                disabled={!allBetsFilled || savingJornada}
                onClick={handleSaveBets}
                className={cn(
                  'relative w-full overflow-hidden rounded-2xl py-3.5 font-display text-xl tracking-[0.15em] transition-all duration-300 border',
                  allBetsFilled && !savingJornada
                    ? 'bg-gradient-to-b from-gold-2 to-gold border-gold text-background shadow-[0_10px_30px_rgba(212,160,23,0.4)] active:scale-[0.98]'
                    : 'bg-surface border-border text-muted cursor-not-allowed opacity-60'
                )}
              >
                {allBetsFilled && !savingJornada && (
                  <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                )}
                <span className="flex items-center justify-center gap-2">
                  {savingJornada ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      GUARDANDO...
                    </>
                  ) : savedJornada === currentJornada ? (
                    <>
                      <Check size={20} strokeWidth={3} />
                      ¡APOSTADO!
                    </>
                  ) : (
                    'BET'
                  )}
                </span>
              </button>
              {!allBetsFilled && !savingJornada && savedJornada !== currentJornada && (
                <p className="text-center text-[11px] text-muted mt-1.5">
                  Completa un pronóstico en cada partido para poder apostar
                </p>
              )}
            </div>
          )}
        </>
      )}

      {openGift !== null && (
        <GiftRouletteModal
          poolId={poolId}
          block={openGift.block}
          unlocked={openGift.unlocked}
          existingDelta={giftSpins.find(g => g.block_number === openGift.block)?.delta ?? null}
          isAdmin={isAdmin}
          onClose={() => setOpenGift(null)}
          onSpun={(delta) => {
            // Los giros del admin son ilimitados y no se persisten (ver
            // migracion 020): no los marcamos como "ya girado" localmente
            // para que pueda seguir probando sin cambiar de usuario.
            if (isAdmin) return
            setGiftSpins(prev => [...prev, {
              id: `local-${openGift.block}`,
              pool_id: poolId,
              user_id: membership.user_id,
              block_number: openGift.block,
              delta,
              created_at: new Date().toISOString(),
            }])
          }}
        />
      )}

      {openQuiz !== null && (
        <QuizModal
          key={openQuiz.block}
          poolId={poolId}
          currentUserId={membership.user_id}
          block={openQuiz.block}
          question={quizQuestions.find(q => q.block_number === openQuiz.block) ?? null}
          existingResponse={quizResponses.find(r => r.block_number === openQuiz.block) ?? null}
          unlocked={openQuiz.unlocked}
          isAdmin={isAdmin}
          quizPoints={quizResponses.filter(r => r.is_correct).length}
          onClose={() => setOpenQuiz(null)}
          onAnswered={(response) => {
            setQuizResponses(prev => [...prev.filter(r => r.block_number !== response.block_number), response])
          }}
        />
      )}

      {openTeamRoulette !== null && (() => {
        const spin = teamRouletteSpins.find(s => s.jornada_number === openTeamRoulette.jornadaNumber) ?? null
        const winStatus = spin === null ? null : results.some(r => r.match_id === spin.match_id)
          ? (teamRouletteSpinWon(spin, results) ? 'won' : 'lost')
          : 'pending'
        return (
          <TeamRouletteModal
            key={openTeamRoulette.jornadaNumber}
            poolId={poolId}
            currentUserId={membership.user_id}
            jornadaNumber={openTeamRoulette.jornadaNumber}
            jornadaLabel={openTeamRoulette.jornadaLabel}
            entries={buildTeamRouletteEntries(openTeamRoulette.jornadaLabel)}
            existingSpin={spin}
            winStatus={winStatus}
            unlocked={openTeamRoulette.unlocked}
            isAdmin={isAdmin}
            onClose={() => setOpenTeamRoulette(null)}
            onSpun={(newSpin) => {
              if (isAdmin) return
              setTeamRouletteSpins(prev => [...prev.filter(s => s.jornada_number !== newSpin.jornada_number), newSpin])
            }}
          />
        )
      })()}

      {challengeOpen !== null && (
        <ChallengeModal
          poolId={poolId}
          currentUserId={membership.user_id}
          memberTotals={memberTotals}
          unlocked={challengeOpen.unlocked}
          onClose={() => setChallengeOpen(null)}
        />
      )}

      {testDuel !== null && (
        <DuelRevealModal
          duel={testDuel}
          currentUserId={membership.user_id}
          usersMap={new Map([...usersMap, ['test-opponent', { username: 'Rival de prueba', avatar_url: null }]])}
          onClose={() => setTestDuel(null)}
        />
      )}
    </div>
  )
}

// ─── Bet Summary Row ───────────────────────────────────────────────────────────

interface BetSummaryRowProps {
  match: Match
  realTeams?: PoolMatchTeams
  pred?: Prediction
  result?: Result
}

function BetSummaryRow({ match, realTeams, pred, result }: BetSummaryRowProps) {
  const isBonus = match.is_bonus ?? false
  const displayHome = realTeams?.real_home || match.home_team || match.home || '?'
  const displayAway = realTeams?.real_away || match.away_team || match.away || '?'
  const dateStr = match.match_date || match.date || ''
  const dateDisplay = dateStr
    ? new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) +
      ' · ' +
      new Date(dateStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '?'
  const pickLabel = pred
    ? (isBonus ? `${pred.home_score}-${pred.away_score}` : signFromScores(pred.home_score, pred.away_score))
    : '—'

  const hasResult = !!result
  const pts = pred && result ? scoreMatch(pred, result, match) : null
  const ptsExactValue = match.pts_exact ?? 3
  const isFullHit = pts !== null && (isBonus ? pts === ptsExactValue : pts > 0)

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-4 py-2.5">
      <div className="flex-1 min-w-0 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <Flag team={displayHome} size="sm" className="flex-shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-cream truncate">{displayHome}</span>
          <span className="text-muted text-xs font-normal flex-shrink-0">vs</span>
          <span className="text-xs sm:text-sm font-semibold text-cream truncate">{displayAway}</span>
          <Flag team={displayAway} size="sm" className="flex-shrink-0" />
        </div>
        <p className="text-[10px] text-muted mt-0.5">{dateDisplay}</p>
      </div>
      <span
        className={cn(
          'flex-shrink-0 font-black text-xs px-2.5 py-1 rounded-full border',
          isBonus
            ? 'bg-gold/12 text-gold border-gold/40'
            : 'bg-surface-2 text-cream border-border'
        )}
      >
        {pickLabel}
      </span>
      {hasResult && (
        <span className="flex-shrink-0 font-display text-sm text-gold px-1">
          {result!.home_score}–{result!.away_score}
        </span>
      )}
      {pts !== null && (
        <span
          className={cn(
            'flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full',
            isFullHit ? 'bg-green-900 text-green-300' : pts > 0 ? 'bg-amber-900 text-amber-300' : 'bg-red-900 text-red-300'
          )}
        >
          {pts}pt{pts !== 1 ? 's' : ''}
        </span>
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
  onSignPred: (id: string, sign: MatchSign) => void
}

function MatchCard({ match, realTeams, pred, result, isLocked, onPred, onSignPred }: MatchCardProps) {
  const hasResult = !!result
  const hasPred = !!pred
  const isBonus = match.is_bonus ?? false
  const pts = hasPred && hasResult ? scoreMatch(pred, result, match) : null
  const displayHome = realTeams?.real_home || match.home_team || match.home || '?'
  const displayAway = realTeams?.real_away || match.away_team || match.away || '?'
  const jornadaLabel = match.jornada ? `Jornada ${match.jornada}` : (match.group_name?.trim() || `Jornada ${Math.max(1, Math.ceil(match.match_number / 10))}`)

  const ptsExactValue = match.pts_exact ?? 3
  const ptsWinnerValue = match.pts_winner ?? 1
  // Para partidos normales solo hay "acierto" o "fallo" (no hay nivel intermedio de exactitud)
  const isFullHit = pts !== null && (isBonus ? pts === ptsExactValue : pts > 0)

  const cardClass = cn(
    'relative overflow-hidden rounded-2xl border px-2.5 sm:px-5 py-2.5 sm:py-3 shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition-all duration-300',
    isBonus
      ? 'border-gold/60 bg-[linear-gradient(160deg,rgba(212,160,23,0.20),rgba(10,14,24,0.92)_35%,rgba(7,11,22,0.95)_100%)]'
      : 'border-slate-700/80 bg-[linear-gradient(155deg,rgba(29,47,83,0.42),rgba(10,15,30,0.95)_45%,rgba(7,11,22,0.95)_100%)]',
    isFullHit && 'border-green-500/80 shadow-[0_14px_36px_rgba(8,117,63,0.35)]',
    pts !== null && pts > 0 && !isFullHit && 'border-amber-500/70 shadow-[0_14px_36px_rgba(180,118,8,0.30)]',
    pts === 0 && 'border-red-500/55 shadow-[0_14px_36px_rgba(148,23,23,0.28)]',
  )

  const dateStr = match.match_date || match.date || ''
  const dateDisplay = dateStr ? new Date(dateStr).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }) : '?'

  return (
    <div className={cardClass}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(255,255,255,0.16),transparent_38%)]" />
      <div aria-hidden className={cn(
        'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent',
        isBonus && 'via-gold/80'
      )} />
      {isBonus && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(212,160,23,0.24),transparent_38%)]" />
          <div aria-hidden className="pointer-events-none absolute left-3 top-3 h-2 w-2 rounded-full bg-gold/70 shadow-[0_0_10px_rgba(212,160,23,0.9)]" />
          <div aria-hidden className="pointer-events-none absolute right-3 top-3 h-2 w-2 rounded-full bg-gold/70 shadow-[0_0_10px_rgba(212,160,23,0.9)]" />
          <div aria-hidden className="pointer-events-none absolute left-3 bottom-3 h-2 w-2 rounded-full bg-gold/70 shadow-[0_0_10px_rgba(212,160,23,0.9)]" />
          <div aria-hidden className="pointer-events-none absolute right-3 bottom-3 h-2 w-2 rounded-full bg-gold/70 shadow-[0_0_10px_rgba(212,160,23,0.9)]" />
        </>
      )}

      <div className={cn(
        'text-center text-[10px] text-muted mb-1.5 flex items-center justify-center gap-1.5',
        isBonus && 'text-gold/85'
      )}>
        <span>{jornadaLabel}</span>
        <span className="opacity-50">·</span>
        <span>{dateDisplay}</span>
        {isBonus && (
          <span className="ml-1 badge bg-gradient-to-r from-[#8a6915] to-[#d4a017] text-background border border-gold/70 shadow-[0_0_14px_rgba(212,160,23,0.45)] flex items-center gap-1.5 px-2.5 py-1">
            <span>⭐</span>
            <span className="tracking-wide">BONUS</span>
          </span>
        )}
      </div>

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-1 sm:gap-2">
        <div className={cn(
          'flex flex-col items-center gap-1 text-center rounded-2xl border border-white/10 bg-black/15 py-1.5 px-1 sm:px-2',
          isBonus && 'border-gold/35 bg-gradient-to-b from-[#1e1a0d]/75 to-black/35 shadow-[inset_0_0_0_1px_rgba(212,160,23,0.15)]'
        )}>
          <Flag team={displayHome} size="lg" className="w-11 h-11 sm:w-14 sm:h-14 drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]" />
          <span className="font-bold text-xs leading-tight line-clamp-2">{displayHome}</span>
        </div>

        <div className={cn(
          'flex flex-col items-center gap-1 min-w-[96px] sm:min-w-[116px] rounded-2xl border border-white/12 bg-black/30 px-1.5 sm:px-2.5 py-1.5 backdrop-blur-[1px]',
          isBonus && 'border-gold/40 bg-gradient-to-b from-[#2c220e]/85 to-[#0c0f17]/85 shadow-[inset_0_0_0_1px_rgba(212,160,23,0.24)]'
        )}>
          {hasResult && (
            <div className="font-display text-2xl text-gold tracking-widest leading-none">
              {result!.home_score}–{result!.away_score}
              {result!.source === 'api' && <span className="ml-1 text-[9px] text-green-400 font-sans font-normal">⚡</span>}
            </div>
          )}
          {isBonus ? (
            <div className="flex items-center gap-1.5">
              <ScoreInput value={pred?.home_score} disabled={isLocked || hasResult} onChange={(v) => onPred(match.id, 'home_score', v)} />
              <span className="text-muted font-bold text-sm">:</span>
              <ScoreInput value={pred?.away_score} disabled={isLocked || hasResult} onChange={(v) => onPred(match.id, 'away_score', v)} />
            </div>
          ) : (
            <SignSelector
              value={pred ? signFromScores(pred.home_score, pred.away_score) : undefined}
              disabled={isLocked || hasResult}
              onChange={(sign) => onSignPred(match.id, sign)}
            />
          )}
          {pts !== null && (
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              isFullHit ? 'bg-green-900 text-green-300' : pts > 0 ? 'bg-amber-900 text-amber-300' : 'bg-red-900 text-red-300'
            )}>
              {pts}pt{pts !== 1 ? 's' : ''}
            </span>
          )}
          <span className={cn('text-[8px] text-muted text-center leading-tight', isBonus && 'text-gold/85')}>
            {isBonus ? `Exacto=${ptsExactValue}pts · Signo=${ptsWinnerValue}pt` : `Acierto de signo (1X2)=${ptsWinnerValue}pt`}
          </span>
        </div>

        <div className={cn(
          'flex flex-col items-center gap-1 text-center rounded-2xl border border-white/10 bg-black/15 py-1.5 px-1 sm:px-2',
          isBonus && 'border-gold/35 bg-gradient-to-b from-[#1e1a0d]/75 to-black/35 shadow-[inset_0_0_0_1px_rgba(212,160,23,0.15)]'
        )}>
          <Flag team={displayAway} size="lg" className="w-11 h-11 sm:w-14 sm:h-14 drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]" />
          <span className="font-bold text-xs leading-tight line-clamp-2">{displayAway}</span>
        </div>
      </div>
    </div>
  )
}

interface SignSelectorProps {
  value?: MatchSign
  disabled?: boolean
  onChange: (sign: MatchSign) => void
}

function SignSelector({ value, disabled, onChange }: SignSelectorProps) {
  const signs: MatchSign[] = ['1', 'X', '2']
  return (
    <div className="flex items-center gap-1">
      {signs.map((sign) => (
        <button
          key={sign}
          type="button"
          disabled={disabled}
          onClick={() => onChange(sign)}
          className={cn(
            'w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-black text-sm transition-all border active:scale-95',
            value === sign
              ? 'bg-gradient-to-b from-gold-2 to-gold border-gold text-background shadow-sm shadow-gold/30'
              : 'bg-surface border-border text-cream hover:border-gold',
            disabled && 'opacity-35 cursor-not-allowed hover:border-border active:scale-100'
          )}
        >
          {sign}
        </button>
      ))}
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
        'w-9 h-9 sm:w-10 sm:h-10 text-center rounded-xl font-black text-lg outline-none transition-colors',
        adminStyle
          ? 'bg-red-950 border border-red-800 text-red-300 w-8 h-8 text-sm'
          : 'bg-surface border border-border text-cream focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-35 disabled:cursor-not-allowed'
      )}
    />
  )
}