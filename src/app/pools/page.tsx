import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function StatusScreen({ icon, title, body, tone }: { icon: string; title: string; body: string; tone: 'amber' | 'red' | 'muted' }) {
  const toneClass = tone === 'amber'
    ? 'border-amber-800/60 bg-amber-900/20'
    : tone === 'red'
      ? 'border-red-800/60 bg-red-900/20'
      : 'border-border bg-surface'

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className={`max-w-md w-full text-center space-y-3 rounded-2xl border px-6 py-8 ${toneClass}`}>
        <p className="text-3xl">{icon}</p>
        <h1 className="font-display text-xl tracking-wide text-cream">{title}</h1>
        <p className="text-muted text-sm">{body}</p>
      </div>
    </main>
  )
}

export default async function PoolsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Se usa el cliente admin (bypassa RLS) porque un usuario con solicitud
  // "pending" (o sin membresia) todavia no puede leer la fila de pools ni
  // la suya propia via las policies normales -- necesitamos distinguir
  // "pendiente de aprobar" de "sin solicitud" para mostrar el mensaje
  // correcto, no solo redirigir o fallar en seco.
  const admin = createAdminClient()

  const { data: championsPool } = await admin
    .from('pools')
    .select('id, name')
    .or("name.eq.ChampionsG's,name.eq.ChampionsG´s")
    .limit(1)
    .maybeSingle()

  if (!championsPool) {
    return (
      <StatusScreen
        icon="⚠️"
        tone="muted"
        title="Porra no configurada"
        body="No se encontró la porra principal ChampionsG's. Pide al administrador que la cree."
      />
    )
  }

  const { data: membership } = await admin
    .from('pool_members')
    .select('id, status')
    .eq('pool_id', championsPool.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    return (
      <StatusScreen
        icon="🔒"
        tone="muted"
        title="Sin acceso a la porra"
        body="Tu usuario aún no pertenece a ChampionsG's. Contacta con un administrador."
      />
    )
  }

  if (membership.status === 'pending') {
    return (
      <StatusScreen
        icon="⏳"
        tone="amber"
        title="Solicitud pendiente"
        body="Tu solicitud para unirte a ChampionsG's está esperando la aprobación de un administrador. Vuelve a intentarlo en un rato."
      />
    )
  }

  if (membership.status === 'rejected') {
    return (
      <StatusScreen
        icon="✕"
        tone="red"
        title="Solicitud rechazada"
        body="Un administrador rechazó tu solicitud para unirte a ChampionsG's. Contacta con él si crees que es un error."
      />
    )
  }

  redirect(`/p/${championsPool.id}/jornadas`)
}
