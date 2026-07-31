import type { EquipoRoster, EquipoPlayer, EquipoFormation } from '@/types'

export const FORMATIONS: Record<EquipoFormation, { def: number; med: number; del: number }> = {
  '1-2-2': { def: 1, med: 2, del: 2 },
  '2-1-2': { def: 2, med: 1, del: 2 },
  '2-2-1': { def: 2, med: 2, del: 1 },
}

export const BENCH_SIZE = 3
export const SELL_RATIO = 0.65
export const POACH_JORNADAS_REQUIRED = 2

export type EquipoEntry = { roster: EquipoRoster; player: EquipoPlayer }

export interface FormationSlots {
  gk: EquipoEntry[]
  def: EquipoEntry[]
  med: EquipoEntry[]
  del: EquipoEntry[]
  bench: EquipoEntry[]
}

// Reparte los jugadores en propiedad de un usuario en el once (portero +
// lineas segun la formacion elegida) y el banquillo, segun la eleccion
// EXPLICITA del usuario (is_starter, movida por drag & drop) — ya no se
// calcula automaticamente por precio.
export function splitFormation(
  roster: EquipoRoster[],
  playersById: Map<number, EquipoPlayer>,
  formation: EquipoFormation
): FormationSlots {
  const shape = FORMATIONS[formation]

  const withPlayer: EquipoEntry[] = roster
    .filter(r => r.status === 'owned')
    .map(r => ({ roster: r, player: playersById.get(r.player_id) }))
    .filter((x): x is EquipoEntry => !!x.player)

  const byPos = (pos: number) => withPlayer.filter(x => x.player.position === pos)
  const isStarter = (e: EquipoEntry) => e.roster.is_starter

  const gks = byPos(1)
  const defs = byPos(2)
  const meds = byPos(3)
  const dels = byPos(4)

  const starterGk = gks.filter(isStarter).slice(0, 1)
  const starterDef = defs.filter(isStarter).slice(0, shape.def)
  const starterMed = meds.filter(isStarter).slice(0, shape.med)
  const starterDel = dels.filter(isStarter).slice(0, shape.del)

  const starterIds = new Set([...starterGk, ...starterDef, ...starterMed, ...starterDel].map(x => x.roster.id))
  const bench = withPlayer.filter(x => !starterIds.has(x.roster.id))

  return { gk: starterGk, def: starterDef, med: starterMed, del: starterDel, bench }
}

// Precio de "compra ya"/fichaje directo: siempre 1.5x el valor del jugador.
// Antes tenia un suelo de 700 aparte, que para los jugadores baratos rompia
// la proporcion (podia llegar a ser mas de 3x en vez de 1.5x); ahora el
// suelo real viene de COIN_MIN en pricing.ts, aplicado de forma consistente.
export function poachPrice(coinPrice: number): number {
  return Math.round((coinPrice * 1.5) / 10) * 10
}

export function jornadasUntilPoachable(acquiredJornada: number, currentJornada: number): number {
  return Math.max(0, POACH_JORNADAS_REQUIRED - (currentJornada - acquiredJornada))
}
