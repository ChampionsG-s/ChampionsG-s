import type { EquipoRoster, EquipoPlayer, EquipoFormation } from '@/types'

export const FORMATIONS: Record<EquipoFormation, { def: number; med: number; del: number }> = {
  '1-2-2': { def: 1, med: 2, del: 2 },
  '2-1-2': { def: 2, med: 1, del: 2 },
}

export const BENCH_SIZE = 3
export const SELL_RATIO = 0.65
export const POACH_JORNADAS_REQUIRED = 2
export const DIRECT_BUY_MIN_PRICE = 700

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

// Precio de "compra ya"/fichaje directo: minimo 700, aunque el jugador sea
// muy barato (los baratos son justo los que puntuan poco por jugar poco).
export function poachPrice(coinPrice: number): number {
  return Math.max(DIRECT_BUY_MIN_PRICE, Math.round((coinPrice * 1.5) / 10) * 10)
}

export function jornadasUntilPoachable(acquiredJornada: number, currentJornada: number): number {
  return Math.max(0, POACH_JORNADAS_REQUIRED - (currentJornada - acquiredJornada))
}
