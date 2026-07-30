import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchLaLigaData } from './client'
import { BIWENGER_TEAM_MAP } from './team-map'
import { biwengerPriceToCoins } from './pricing'

// Descarga la lista completa de jugadores de LaLiga desde Biwenger y la
// vuelca en la cache global `biwenger_players` (upsert por id). Usa el
// cliente de rol de servicio: se llama solo desde el servidor.
export async function syncBiwengerPlayers(admin: SupabaseClient): Promise<{ synced: number }> {
  const data = await fetchLaLigaData()
  const teamNameById = new Map(Object.values(data.teams).map(t => [t.id, t.name]))
  const players = Object.values(data.players)
  const syncedAt = new Date().toISOString()

  const rows = players.flatMap(p => {
    const biwengerTeamName = teamNameById.get(p.teamID)
    const teamName = biwengerTeamName ? BIWENGER_TEAM_MAP[biwengerTeamName] : undefined
    if (!teamName) return []
    // La API tambien devuelve entrenadores (position 5) y otras entradas que
    // no son jugadores de campo; biwenger_players.position solo admite 1-4.
    if (p.position < 1 || p.position > 4) return []

    return [{
      id: p.id,
      name: p.name,
      slug: p.slug,
      team_name: teamName,
      biwenger_team_id: p.teamID,
      position: p.position,
      status: p.status ?? 'ok',
      biwenger_price: p.price,
      coin_price: biwengerPriceToCoins(p.price),
      season_points: p.points ?? 0,
      photo_url: `https://cdn.biwenger.com/i/p/${p.id}.png`,
      hero_photo_url: p.iconHero ? `https://cdn.biwenger.com/${p.iconHero}` : null,
      synced_at: syncedAt,
    }]
  })

  if (rows.length === 0) return { synced: 0 }

  const { error } = await admin.from('biwenger_players').upsert(rows, { onConflict: 'id' })
  if (error) throw error

  return { synced: rows.length }
}
