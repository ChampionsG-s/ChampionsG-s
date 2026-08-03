import { createClient } from '@/lib/supabase/server'
import { MatchesList } from '@/components/matches/matches-list'
import { computeMemberTotals } from '@/lib/ranking-totals'

export default async function JornadasPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    matchesRes, resultsRes, predsRes, openPhasesRes, membershipRes, matchTeamsRes, giftSpinsRes,
    incomingDuelsRes, outgoingDuelsRes, readyToDrawDuelsRes, unreadDuelNotifsRes, usersRes, poolMembersRes,
    allPredsRes, allGiftSpinsRes, allDuelsRes, quizQuestionsRes, allQuizResponsesRes, allTeamRouletteSpinsRes,
  ] = await Promise.all([
    supabase.from('matches').select('*').order('jornada', { ascending: true, nullsFirst: false }).order('match_number', { ascending: true }),
    supabase.from('results').select('*'),
    supabase.from('predictions').select('*').eq('pool_id', poolId).eq('user_id', user!.id),
    supabase.from('pool_open_phases').select('*').eq('pool_id', poolId),
    supabase.from('pool_members').select('*').eq('pool_id', poolId).eq('user_id', user!.id).single(),
    supabase.from('pool_match_teams').select('*').eq('pool_id', poolId),
    supabase.from('gift_spins').select('*').eq('pool_id', poolId).eq('user_id', user!.id),
    supabase.from('duels').select('*').eq('pool_id', poolId).eq('opponent_id', user!.id).eq('status', 'pending'),
    supabase.from('duels').select('*').eq('pool_id', poolId).eq('challenger_id', user!.id).eq('status', 'pending'),
    supabase.from('duels').select('*').eq('pool_id', poolId).eq('status', 'accepted')
      .or(`and(challenger_id.eq.${user!.id},challenger_card1_rank.is.null),and(opponent_id.eq.${user!.id},opponent_card1_rank.is.null)`),
    supabase.from('notifications').select('*').eq('pool_id', poolId).eq('user_id', user!.id)
      .in('type', ['duel_resolved', 'duel_declined']).is('read_at', null),
    supabase.from('users').select('*'),
    supabase.from('pool_members').select('*').eq('pool_id', poolId).eq('status', 'approved'),
    supabase.from('predictions').select('*').eq('pool_id', poolId),
    supabase.from('gift_spins').select('*').eq('pool_id', poolId),
    supabase.from('duels').select('*').eq('pool_id', poolId),
    supabase.from('quiz_questions').select('*'),
    supabase.from('quiz_responses').select('*').eq('pool_id', poolId),
    supabase.from('team_roulette_spins').select('*').eq('pool_id', poolId),
  ])

  const usersMap = new Map((usersRes.data ?? []).map(u => [u.id, u]))
  const membersForTotals = (poolMembersRes.data ?? []).map(m => ({
    user_id: m.user_id,
    username: usersMap.get(m.user_id)?.username ?? 'Desconocido',
    avatar_url: usersMap.get(m.user_id)?.avatar_url ?? null,
  }))
  const memberTotals = computeMemberTotals(
    membersForTotals,
    allPredsRes.data ?? [],
    resultsRes.data ?? [],
    matchesRes.data ?? [],
    allGiftSpinsRes.data ?? [],
    allDuelsRes.data ?? [],
    allQuizResponsesRes.data ?? [],
    allTeamRouletteSpinsRes.data ?? []
  )

  const allDuelsMap = new Map((allDuelsRes.data ?? []).map(d => [d.id, d]))
  const resolvedNotifications = (unreadDuelNotifsRes.data ?? [])
    .map(n => {
      const duelId = n.dedupe_key.split(':')[1]
      const duel = duelId ? allDuelsMap.get(duelId) : undefined
      return duel ? { notificationId: n.id, duel } : null
    })
    .filter((r): r is { notificationId: string; duel: NonNullable<typeof r>['duel'] } => r !== null)

  return (
    <MatchesList
      poolId={poolId}
      matches={matchesRes.data ?? []}
      results={resultsRes.data ?? []}
      predictions={predsRes.data ?? []}
      openPhases={openPhasesRes.data ?? []}
      membership={membershipRes.data!}
      matchTeams={matchTeamsRes.data ?? []}
      giftSpins={giftSpinsRes.data ?? []}
      incomingDuels={incomingDuelsRes.data ?? []}
      outgoingDuels={outgoingDuelsRes.data ?? []}
      readyToDrawDuels={readyToDrawDuelsRes.data ?? []}
      resolvedDuelNotifications={resolvedNotifications}
      users={usersRes.data ?? []}
      memberTotals={memberTotals}
      quizQuestions={quizQuestionsRes.data ?? []}
      quizResponses={(allQuizResponsesRes.data ?? []).filter(r => r.user_id === user!.id)}
      teamRouletteSpins={(allTeamRouletteSpinsRes.data ?? []).filter(s => s.user_id === user!.id)}
    />
  )
}
