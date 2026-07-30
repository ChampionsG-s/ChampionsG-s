import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncBiwengerPlayers } from '@/lib/biwenger/sync'
import { isJornadaOpen } from '@/lib/jornada'
import { EquipoView } from '@/components/equipo/equipo-view'
import type { Match, EquipoWallet } from '@/types'

const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000
const JORNADA_LOOKBACK = 5

export default async function EquipoPage({
  params,
}: {
  params: Promise<{ poolId: string }>
}) {
  const { poolId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Sincronizacion perezosa de jugadores de Biwenger (cache global, no por pool).
  const { data: freshest } = await supabase
    .from('biwenger_players')
    .select('synced_at')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastSync = freshest?.synced_at ? new Date(freshest.synced_at).getTime() : 0
  if (Date.now() - lastSync > SYNC_INTERVAL_MS) {
    try {
      await syncBiwengerPlayers(createAdminClient())
    } catch (err) {
      console.error('Error sincronizando jugadores de Biwenger:', err)
    }
  }

  const { data: wallet } = await supabase.rpc('equipo_ensure_wallet', { target_pool: poolId })
  await supabase.rpc('equipo_sync_market', { target_pool: poolId })

  // Reparte premios de jornadas ya cerradas que aun no se hayan pagado
  // (idempotente: la propia RPC ignora las que ya tienen dedupe_key).
  const [matchesRes, openPhasesRes] = await Promise.all([
    supabase.from('matches').select('*'),
    supabase.from('pool_open_phases').select('*').eq('pool_id', poolId),
  ])
  const allMatches = (matchesRes.data ?? []) as Match[]
  const openPhases = openPhasesRes.data ?? []

  const closedJornadaNums = Array.from(new Set(
    allMatches.filter(m => m.jornada != null).map(m => m.jornada as number)
  ))
    .filter(num => !isJornadaOpen(allMatches, `Jornada ${num}`, openPhases))
    .sort((a, b) => b - a)
    .slice(0, JORNADA_LOOKBACK)

  for (const num of closedJornadaNums) {
    await supabase.rpc('equipo_grant_jornada_rewards', { target_pool: poolId, target_jornada: num })
  }

  const [cycleRes, listingsRes, bidsRes, rosterRes, playersRes] = await Promise.all([
    supabase.from('equipo_market_cycles').select('*').eq('pool_id', poolId).is('resolved_at', null).maybeSingle(),
    supabase.from('equipo_market_listings').select('*').eq('pool_id', poolId).eq('status', 'open'),
    supabase.from('equipo_bids').select('*').eq('pool_id', poolId),
    supabase.from('equipo_roster').select('*').eq('pool_id', poolId),
    supabase.from('biwenger_players').select('*'),
  ])

  return (
    <EquipoView
      poolId={poolId}
      currentUserId={user!.id}
      wallet={wallet as EquipoWallet | null}
      cycle={cycleRes.data}
      listings={listingsRes.data ?? []}
      bids={bidsRes.data ?? []}
      roster={rosterRes.data ?? []}
      players={playersRes.data ?? []}
    />
  )
}
