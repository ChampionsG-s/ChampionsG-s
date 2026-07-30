import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncBiwengerPlayers } from '@/lib/biwenger/sync'
import { isJornadaFullyClosed } from '@/lib/jornada'
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
  // "Cerrada" aqui significa que ya termino su ULTIMO partido (no que
  // empezo el primero, como en el bloqueo de apuestas de la quiniela).
  const { data: matchesData } = await supabase.from('matches').select('*')
  const allMatches = (matchesData ?? []) as Match[]

  const closedJornadaNums = Array.from(new Set(
    allMatches.filter(m => m.jornada != null).map(m => m.jornada as number)
  ))
    .filter(num => isJornadaFullyClosed(allMatches, num))
    .sort((a, b) => b - a)
    .slice(0, JORNADA_LOOKBACK)

  for (const num of closedJornadaNums) {
    await supabase.rpc('equipo_grant_jornada_rewards', { target_pool: poolId, target_jornada: num })
  }

  const currentJornada = closedJornadaNums[0] ?? 0

  const [membersRes, usersRes] = await Promise.all([
    supabase.from('pool_members').select('*').eq('pool_id', poolId).eq('status', 'approved'),
    supabase.from('users').select('*'),
  ])

  // Si quien mira la pagina es admin del pool, rellena de un tiron la
  // wallet + plantilla inicial de cualquier miembro que aun no la tenga
  // (para poder probar el fichaje entre jugadores sin que cada uno tenga
  // que entrar antes a Equipo). Idempotente: no toca a quien ya la tiene.
  const isAdmin = membersRes.data?.some(m => m.user_id === user!.id && m.role === 'admin') ?? false
  if (isAdmin) {
    const { error } = await supabase.rpc('equipo_seed_all_members', { target_pool: poolId })
    if (error) console.error('Error rellenando plantillas del pool:', error)
  }

  const [walletsRes, cycleRes, listingsRes, bidsRes, rosterRes, playersRes] = await Promise.all([
    supabase.from('equipo_wallets').select('*').eq('pool_id', poolId),
    supabase.from('equipo_market_cycles').select('*').eq('pool_id', poolId).is('resolved_at', null).maybeSingle(),
    supabase.from('equipo_market_listings').select('*').eq('pool_id', poolId).eq('status', 'open'),
    supabase.from('equipo_bids').select('*').eq('pool_id', poolId),
    supabase.from('equipo_roster').select('*').eq('pool_id', poolId),
    supabase.from('biwenger_players').select('*'),
  ])

  const usersMap = new Map((usersRes.data ?? []).map(u => [u.id, u]))
  const members = (membersRes.data ?? []).map(m => ({
    ...m,
    username: usersMap.get(m.user_id)?.username ?? 'Desconocido',
    avatar_url: usersMap.get(m.user_id)?.avatar_url ?? null,
  }))

  return (
    <EquipoView
      poolId={poolId}
      currentUserId={user!.id}
      currentJornada={currentJornada}
      members={members}
      wallet={wallet as EquipoWallet | null}
      wallets={walletsRes.data ?? []}
      cycle={cycleRes.data}
      listings={listingsRes.data ?? []}
      bids={bidsRes.data ?? []}
      roster={rosterRes.data ?? []}
      players={playersRes.data ?? []}
    />
  )
}
