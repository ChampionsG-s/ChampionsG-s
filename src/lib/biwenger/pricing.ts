// Escala el precio real de Biwenger (rango observado ~150.000 a 24.690.000,
// mediana ~1.040.000) a nuestra economia de 10.000 monedas. Normaliza en
// logaritmo porque el rango real es muy asimetrico, y aplica una curva
// (GAMMA) para que solo las estrellas de verdad se acerquen al techo:
// Mbappe (24.690.000) cae en 8.000, el mas barato en 100.
const BIWENGER_MIN = 150_000
const BIWENGER_MAX = 24_690_000
const COIN_MIN = 100
const COIN_MAX = 8_000
const GAMMA = 1.8

export function biwengerPriceToCoins(biwengerPrice: number): number {
  const clamped = Math.min(Math.max(biwengerPrice, BIWENGER_MIN), BIWENGER_MAX)
  const norm = (Math.log(clamped) - Math.log(BIWENGER_MIN)) / (Math.log(BIWENGER_MAX) - Math.log(BIWENGER_MIN))
  const coins = COIN_MIN + (COIN_MAX - COIN_MIN) * Math.pow(norm, GAMMA)
  return Math.round(coins / 10) * 10
}
