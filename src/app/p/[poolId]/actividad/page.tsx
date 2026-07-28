import { createClient } from '@/lib/supabase/server'
import { ActividadView } from '@/components/actividad/actividad-view'
import { allJornadaLabels, jornadaLabelForMatch, isJornadaOpen } from '@/lib/jornada'
import type { Match, Notification } from '@/types'

export default async function ActividadPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user!.id

  const [matchesRes, predsRes] = await Promise.all([
    supabase.from('matches').select('*').order('jornada', { ascending: true, nullsFirst: false }).order('match_number', { ascending: true }),
    supabase.from('predictions').select('match_id').eq('pool_id', poolId).eq('user_id', userId),
  ])

  const matches: Match[] = matchesRes.data ?? []
  const predictedMatchIds = new Set((predsRes.data ?? []).map(p => p.match_id))

  // Aviso personal de "jornada cerrada": se genera perezosamente la primera vez que el
  // usuario visita Actividad tras el cierre (no hay cron). dedupe_key lo hace idempotente.
  const closedJornadasWithPreds = allJornadaLabels(matches).filter(label => {
    if (isJornadaOpen(matches, label)) return false
    return matches.some(m => jornadaLabelForMatch(m, matches) === label && predictedMatchIds.has(m.id))
  })

  if (closedJornadasWithPreds.length > 0) {
    await supabase.from('notifications').upsert(
      closedJornadasWithPreds.map(label => ({
        pool_id: poolId,
        user_id: userId,
        scope: 'personal' as const,
        type: 'jornada_closed',
        title: 'Jornada cerrada',
        body: `La ${label} se ha cerrado. Ya puedes ver las apuestas de todos en el ranking.`,
        dedupe_key: `jornada_closed:${userId}:${label}`,
      })),
      { onConflict: 'pool_id,dedupe_key', ignoreDuplicates: true }
    )
  }

  const [personalRes, globalRes] = await Promise.all([
    supabase
      .from('notifications')
      .select('*')
      .eq('pool_id', poolId)
      .eq('scope', 'personal')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('notifications')
      .select('*')
      .eq('pool_id', poolId)
      .eq('scope', 'global')
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  return (
    <ActividadView
      personal={(personalRes.data ?? []) as Notification[]}
      global={(globalRes.data ?? []) as Notification[]}
    />
  )
}
