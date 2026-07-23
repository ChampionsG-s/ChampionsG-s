import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeagueAdminPanel } from '@/components/admin/league-admin-panel'

export default async function AdminPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('pool_members')
    .select('*')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role !== 'admin') {
    redirect(`/p/${poolId}/jornadas`)
  }

  const [membersRes, usersRes, openPhasesRes, matchesRes, resultsRes] = await Promise.all([
    supabase.from('pool_members').select('*').eq('pool_id', poolId).order('joined_at'),
    supabase.from('users').select('*'),
    supabase.from('pool_open_phases').select('*').eq('pool_id', poolId),
    supabase.from('matches').select('*').order('match_number'),
    supabase.from('results').select('*').eq('pool_id', poolId),
  ])

  // Join members with usernames
  const usersMap = new Map((usersRes.data ?? []).map(u => [u.id, u.username]))
  const members = (membersRes.data ?? []).map(m => ({
    ...m,
    username: usersMap.get(m.user_id) ?? 'Desconocido',
  }))

  const matchesData = matchesRes.data ?? []

  return (
    <LeagueAdminPanel
      poolId={poolId}
      members={members}
      openPhases={openPhasesRes.data ?? []}
      matches={matchesData}
      results={resultsRes.data ?? []}
      currentUserId={user.id}
    />
  )
}