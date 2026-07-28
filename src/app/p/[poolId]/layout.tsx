import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PoolShell } from '@/components/layout/pool-shell'

export default async function PoolLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: pool } = await supabase
    .from('pools')
    .select('*')
    .eq('id', poolId)
    .single()

  if (!pool) notFound()

  const { data: membership } = await supabase
    .from('pool_members')
    .select('*')
    .eq('pool_id', poolId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) redirect('/pools')

  if (membership.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⏳</div>
          <h2 className="font-bold text-xl text-gold mb-2">Solicitud pendiente</h2>
          <p className="text-muted text-sm leading-relaxed">
            Tu solicitud para unirte a <strong className="text-cream">{pool.name}</strong> está
            pendiente de aprobación por el administrador.
          </p>
        </div>
      </div>
    )
  }

  if (membership.status === 'rejected') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="font-bold text-xl text-red-400 mb-2">Solicitud rechazada</h2>
          <p className="text-muted text-sm">
            Tu solicitud para unirte a esta porra fue rechazada.
          </p>
        </div>
      </div>
    )
  }

  const [{ data: appUser }, { count: unreadPersonalCount }] = await Promise.all([
    supabase.from('users').select('username, avatar_url').eq('id', user.id).single(),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('pool_id', poolId)
      .eq('scope', 'personal')
      .eq('user_id', user.id)
      .is('read_at', null),
  ])

  return (
    <PoolShell
      pool={pool}
      membership={membership}
      username={appUser?.username ?? ''}
      avatarUrl={appUser?.avatar_url}
      unreadPersonalCount={unreadPersonalCount ?? 0}
    >
      {children}
    </PoolShell>
  )
}