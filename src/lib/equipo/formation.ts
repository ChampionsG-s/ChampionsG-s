import type { EquipoRoster, EquipoPlayer, EquipoFormation } from '@/types'

export const FORMATIONS: Record<EquipoFormation, { def: number; med: number; del: number }> = {
  '1-2-2': { def: 1, med: 2, del: 2 },
  '2-1-2': { def: 2, med: 1, del: 2 },
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
// lineas segun la formacion elegida) y el banquillo. El once siempre se
// llena con los jugadores mejor valorados de cada posicion (mayor
// coin_price), asi que fichar un jugador mejor lo mete automaticamente de
// titular y manda al peor al banquillo.
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

  const byPos = (pos: number) =>
    withPlayer.filter(x => x.player.position === pos).sort((a, b) => b.player.coin_price - a.player.coin_price)

  const gks = byPos(1)
  const defs = byPos(2)
  const meds = byPos(3)
  const dels = byPos(4)

  const starterIds = new Set([
    ...gks.slice(0, 1).map(x => x.roster.id),
    ...defs.slice(0, shape.def).map(x => x.roster.id),
    ...meds.slice(0, shape.med).map(x => x.roster.id),
    ...dels.slice(0, shape.del).map(x => x.roster.id),
  ])
  const bench = withPlayer.filter(x => !starterIds.has(x.roster.id))

  return {
    gk: gks.slice(0, 1),
    def: defs.slice(0, shape.def),
    med: meds.slice(0, shape.med),
    del: dels.slice(0, shape.del),
    bench,
  }
}

export function poachPrice(coinPrice: number): number {
  return Math.max(coinPrice + 10, Math.round((coinPrice * 1.5) / 10) * 10)
}

export function jornadasUntilPoachable(acquiredJornada: number, currentJornada: number): number {
  return Math.max(0, POACH_JORNADAS_REQUIRED - (currentJornada - acquiredJornada))
}
