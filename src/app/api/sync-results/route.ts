import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ─── Team name mapping: football-data.org (English) → our DB (Spanish) ────────
const API_MAP: Record<string, string> = {
  'Spain': 'España', 'France': 'Francia', 'Germany': 'Alemania', 'Brazil': 'Brasil',
  'Argentina': 'Argentina', 'Portugal': 'Portugal', 'England': 'Inglaterra',
  'Netherlands': 'Países Bajos', 'Belgium': 'Bélgica', 'Croatia': 'Croacia',
  'Uruguay': 'Uruguay', 'Colombia': 'Colombia', 'Morocco': 'Marruecos',
  'Senegal': 'Senegal', 'Japan': 'Japón', 'South Korea': 'Corea del Sur',
  'Korea Republic': 'Corea del Sur', 'Republic of Korea': 'Corea del Sur',
  'Australia': 'Australia', 'Mexico': 'México', 'United States': 'Estados Unidos',
  'USA': 'Estados Unidos', 'Canada': 'Canadá', 'Saudi Arabia': 'Arabia Saudí',
  'Iran': 'Irán', 'IR Iran': 'Irán', 'Ecuador': 'Ecuador', 'Switzerland': 'Suiza',
  'Ghana': 'Ghana', 'Tunisia': 'Túnez', 'South Africa': 'Sudáfrica',
  'Czech Republic': 'República Checa', 'Czechia': 'República Checa',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina', 'Bosnia-Herzegovina': 'Bosnia y Herzegovina',
  'Qatar': 'Qatar',
  'Haiti': 'Haití', 'Scotland': 'Escocia', 'Paraguay': 'Paraguay',
  'Turkey': 'Turquía', 'Türkiye': 'Turquía',
  "Ivory Coast": 'Costa de Marfil', "Côte d'Ivoire": 'Costa de Marfil',
  'Sweden': 'Suecia', 'New Zealand': 'Nueva Zelanda', 'Egypt': 'Egipto',
  'Cape Verde': 'Cabo Verde', 'Cape Verde Islands': 'Cabo Verde',
  'Iraq': 'Irak', 'Norway': 'Noruega',
  'Algeria': 'Argelia', 'Austria': 'Austria', 'Jordan': 'Jordania',
  'DR Congo': 'RD Congo', 'Congo DR': 'RD Congo', 'Uzbekistan': 'Uzbekistán',
  'Panama': 'Panamá', 'Curacao': 'Curaçao', 'Serbia': 'Serbia',
}

export async function GET(request: Request) {
  // Optional: protect this endpoint with a secret, e.g. for cron jobs
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.FOOTBALL_DATA_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'No API token configured' }, { status: 500 })
  }

  // Service role client — bypasses RLS, needed to write results across all pools
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED',
      { headers: { 'X-Auth-Token': token }, cache: 'no-store' }
    )

    if (!response.ok) {
      return NextResponse.json({ error: 'football-data.org error', status: response.status }, { status: 502 })
    }

    const data = await response.json()

    // Get all matches and all pools once
    const [{ data: matches }, { data: pools }] = await Promise.all([
      supabase.from('matches').select('id, home, away, phase'),
      supabase.from('pools').select('id'),
    ])

    if (!matches || !pools) {
      return NextResponse.json({ error: 'Could not load matches or pools' }, { status: 500 })
    }

    const groupMatches = matches.filter(m => m.phase === 'grupos')
    const knockoutMatches = matches.filter(m => m.phase !== 'grupos')

    let matchedFixtures = 0
    let upserts = 0
    const errors: string[] = []
    const unmatched: { rawHome: string; rawAway: string; mappedHome: string; mappedAway: string }[] = []

    // Pre-fetch all knockout team assignments across all pools, grouped by pool
    const { data: allMatchTeams, error: matchTeamsError } = await supabase
      .from('pool_match_teams')
      .select('pool_id, match_id, real_home, real_away')

    if (matchTeamsError) {
      console.error('Error fetching pool_match_teams:', matchTeamsError)
    }

    const matchTeamsByPool = new Map<string, typeof allMatchTeams>()
    for (const mt of allMatchTeams ?? []) {
      if (!matchTeamsByPool.has(mt.pool_id)) matchTeamsByPool.set(mt.pool_id, [])
      matchTeamsByPool.get(mt.pool_id)!.push(mt)
    }

    for (const apiMatch of data.matches ?? []) {
      const rawHome = apiMatch.homeTeam?.name ?? ''
      const rawAway = apiMatch.awayTeam?.name ?? ''
      const home = API_MAP[rawHome] ?? rawHome
      const away = API_MAP[rawAway] ?? rawAway
      const score = apiMatch.score?.fullTime

      if (score?.home === null || score?.home === undefined || score?.away === null || score?.away === undefined) {
        continue
      }

      // ── Try direct match (works for group stage, where home/away are fixed) ──
      const directMatch = groupMatches.find(m =>
        (m.home === home && m.away === away) || (m.home === away && m.away === home)
      )

      if (directMatch) {
        matchedFixtures++
        const isFlipped = directMatch.home === away

        const rows = pools.map(p => ({
          pool_id: p.id,
          match_id: directMatch.id,
          home_score: isFlipped ? score.away : score.home,
          away_score: isFlipped ? score.home : score.away,
          source: 'api' as const,
        }))

        const { error } = await supabase.from('results').upsert(rows, { onConflict: 'pool_id,match_id' })
        if (error) errors.push(`${home} vs ${away}: ${error.message}`)
        else upserts += rows.length

        continue
      }

      // ── Try knockout match: compare against each pool's real team assignment ──
      let foundInAnyPool = false

      for (const pool of pools) {
        const poolTeams = matchTeamsByPool.get(pool.id) ?? []
        const teamMatch = poolTeams.find(mt =>
          (mt.real_home === home && mt.real_away === away) ||
          (mt.real_home === away && mt.real_away === home)
        )
        if (!teamMatch) continue

        foundInAnyPool = true
        const isFlipped = teamMatch.real_home === away

        const { error } = await supabase.from('results').upsert({
          pool_id: pool.id,
          match_id: teamMatch.match_id,
          home_score: isFlipped ? score.away : score.home,
          away_score: isFlipped ? score.home : score.away,
          source: 'api',
        }, { onConflict: 'pool_id,match_id' })

        if (error) errors.push(`[knockout ${pool.id}] ${home} vs ${away}: ${error.message}`)
        else upserts++
      }

      if (foundInAnyPool) {
        matchedFixtures++
      } else {
        unmatched.push({ rawHome, rawAway, mappedHome: home, mappedAway: away })
      }
    }

    return NextResponse.json({
      ok: true,
      totalApiMatches: data.matches?.length ?? 0,
      matchedFixtures,
      poolsUpdated: pools.length,
      totalUpserts: upserts,
      unmatchedFixtures: unmatched.length > 0 ? unmatched : undefined,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: 'Internal error', details: String(error) }, { status: 500 })
  }
}