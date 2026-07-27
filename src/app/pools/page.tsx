import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PoolsView } from '@/components/pools/pools-view'

export default async function PoolsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [membershipsRes, platformAdminRes, appUserRes] = await Promise.all([
    supabase.from('pool_members').select('*, pools(*)').eq('user_id', user.id),
    supabase.from('platform_admins').select('id').eq('id', user.id).maybeSingle(),
    supabase.from('users').select('username, avatar_url').eq('id', user.id).single(),
  ])

  return (
    <PoolsView
      memberships={membershipsRes.data ?? []}
      userId={user.id}
      isPlatformAdmin={!!platformAdminRes.data}
      username={appUserRes.data?.username ?? ''}
      avatarUrl={appUserRes.data?.avatar_url}
    />
  )
}
