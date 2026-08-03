// Ruleta "regalo": cada bloque de GIFT_BLOCK_SIZE jornadas desbloquea una
// pestana extra (al lado de la ultima jornada del bloque) donde cada usuario
// puede girar una vez para sumar/restar puntos a su ranking.

export const GIFT_BLOCK_SIZE = 3

export interface GiftOutcome {
  delta: number
  color: string
  label: string
}

// Orden fijo de la tira de colores (igual para todos los giros); el resultado
// real lo decide el servidor, esto es solo la representacion visual.
export const GIFT_OUTCOMES: GiftOutcome[] = [
  { delta: 2, color: '#22c55e', label: '+2 puntos' },
  { delta: 1, color: '#3b82f6', label: '+1 punto' },
  { delta: 0, color: '#64748b', label: '0 puntos' },
  { delta: -1, color: '#f97316', label: '-1 punto' },
  { delta: -2, color: '#ef4444', label: '-2 puntos' },
]

// Dado el numero de una jornada (1-indexado), a que bloque de regalo
// pertenece (bloque 1 = jornadas 1-3, bloque 2 = 4-6, ...).
export function giftBlockForJornadaNumber(jornadaNumber: number): number {
  return Math.floor((jornadaNumber - 1) / GIFT_BLOCK_SIZE) + 1
}

// True si esta es la ultima jornada de su bloque (donde debe aparecer la
// pestana de regalo justo despues).
export function isLastJornadaOfGiftBlock(jornadaNumber: number): boolean {
  return jornadaNumber % GIFT_BLOCK_SIZE === 0
}
