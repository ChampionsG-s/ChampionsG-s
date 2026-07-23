import { createClient } from '@/lib/supabase/server'
import { RankingTable } from '@/components/ranking/ranking-table'

export default async function RankingPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [membersRes, usersRes, predsRes, resultsRes, matchesRes] = await Promise.all([
    supabase.from('pool_members').select('*').eq('pool_id', poolId).eq('status', 'approved'),
    supabase.from('users').select('*'),
    supabase.from('predictions').select('*').eq('pool_id', poolId),
    supabase.from('results').select('*').eq('pool_id', poolId),
    supabase.from('matches').select('*'),
  ])

  const usersMap = new Map((usersRes.data ?? []).map(u => [u.id, u.username]))
  const members = (membersRes.data ?? []).map(m => ({
    ...m,
    username: usersMap.get(m.user_id) ?? 'Desconocido',
  }))

  return (
    <RankingTable
      poolId={poolId}
      members={members}
      predictions={predsRes.data ?? []}
      results={resultsRes.data ?? []}
      matches={matchesRes.data ?? []}
      currentUserId={user!.id}
    />
  )
}
