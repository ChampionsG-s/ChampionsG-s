// Baraja española: 1-7, sota(8), caballo(9), rey(10), x4 palos. Las
// figuras (sota/caballo/rey) valen 10 puntos; el resto vale su numero.
// El reto solo esta disponible mientras la jornada de su bloque (2, 5,
// 8...) este abierta, igual que la ruleta regalo. Las imagenes reales de
// las cartas (baraja Fournier de 1878, dominio publico) viven en
// public/cards/{palo}-{rango}.webp.

export function rankLabel(rank: number): string {
  if (rank === 8) return 'Sota'
  if (rank === 9) return 'Caballo'
  if (rank === 10) return 'Rey'
  return String(rank)
}

export function rankValue(rank: number): number {
  return rank <= 7 ? rank : 10
}
