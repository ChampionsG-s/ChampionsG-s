import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PoolsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Single-pool mode: users always land in ChampionsG's jornadas.
  const { data: championsPool } = await supabase
    .from('pools')
    .select('id, name')
    .or("name.eq.ChampionsG's,name.eq.ChampionsG´s")
    .limit(1)
    .maybeSingle()

  if (!championsPool) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-bold text-gold">Porra no configurada</h1>
          <p className="text-muted text-sm">
            No se encontro la porra principal ChampionsG&apos;s. Pide al administrador que la cree.
          </p>
        </div>
      </main>
    )
  }

  const { data: membership } = await supabase
    .from('pool_members')
    .select('id')
    .eq('pool_id', championsPool.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-bold text-gold">Sin acceso a la porra</h1>
          <p className="text-muted text-sm">
            Tu usuario aun no pertenece a ChampionsG&apos;s. Contacta con un administrador.
          </p>
        </div>
      </main>
    )
  }

  redirect(`/p/${championsPool.id}/jornadas`)
}
