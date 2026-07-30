import { createClient } from '@/lib/supabase/server'
import { RankingView } from '@/components/ranking/ranking-view'

export default async function RankingPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [membersRes, usersRes, predsRes, resultsRes, matchesRes, equipoRosterRes, equipoPlayersRes] = await Promise.all([
    supabase.from('pool_members').select('*').eq('pool_id', poolId).eq('status', 'approved'),
    supabase.from('users').select('*'),
    supabase.from('predictions').select('*').eq('pool_id', poolId),
    supabase.from('results').select('*'),
    supabase.from('matches').select('*'),
    supabase.from('equipo_roster').select('*').eq('pool_id', poolId),
    supabase.from('biwenger_players').select('*'),
  ])

  const usersMap = new Map((usersRes.data ?? []).map(u => [u.id, u]))
  const members = (membersRes.data ?? []).map(m => ({
    ...m,
    username: usersMap.get(m.user_id)?.username ?? 'Desconocido',
    avatar_url: usersMap.get(m.user_id)?.avatar_url ?? null,
  }))

  return (
    <RankingView
      poolId={poolId}
      members={members}
      predictions={predsRes.data ?? []}
      results={resultsRes.data ?? []}
      matches={matchesRes.data ?? []}
      currentUserId={user!.id}
      equipoRoster={equipoRosterRes.data ?? []}
      equipoPlayers={equipoPlayersRes.data ?? []}
    />
  )
}
