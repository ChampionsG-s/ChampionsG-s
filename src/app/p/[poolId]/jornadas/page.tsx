import { createClient } from '@/lib/supabase/server'
import { MatchesList } from '@/components/matches/matches-list'

export default async function JornadasPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [matchesRes, resultsRes, predsRes, openPhasesRes, membershipRes, matchTeamsRes] = await Promise.all([
    supabase.from('matches').select('*').order('match_number'),
    supabase.from('results').select('*').eq('pool_id', poolId),
    supabase.from('predictions').select('*').eq('pool_id', poolId).eq('user_id', user!.id),
    supabase.from('pool_open_phases').select('*').eq('pool_id', poolId),
    supabase.from('pool_members').select('*').eq('pool_id', poolId).eq('user_id', user!.id).single(),
    supabase.from('pool_match_teams').select('*').eq('pool_id', poolId),
  ])

  return (
    <MatchesList
      poolId={poolId}
      matches={matchesRes.data ?? []}
      results={resultsRes.data ?? []}
      predictions={predsRes.data ?? []}
      openPhases={openPhasesRes.data ?? []}
      membership={membershipRes.data!}
      matchTeams={matchTeamsRes.data ?? []}
    />
  )
}