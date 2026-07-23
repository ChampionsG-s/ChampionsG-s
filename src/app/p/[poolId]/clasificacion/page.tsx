import { createClient } from '@/lib/supabase/server'
import { GroupStandings } from '@/components/groups/group-standings'

export default async function ClasificacionPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()

  const [matchesRes, resultsRes] = await Promise.all([
    supabase.from('matches').select('*').order('match_number'),
    supabase.from('results').select('*').eq('pool_id', poolId),
  ])

  return (
    <GroupStandings
      poolId={poolId}
      matches={matchesRes.data ?? []}
      results={resultsRes.data ?? []}
    />
  )
}