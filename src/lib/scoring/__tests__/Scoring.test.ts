import { describe, it, expect } from 'vitest'
import { scoreMatch, scoreAwards, scoreSpain } from '../index'
import { AWARDS, SPAIN_FIELDS } from '@/lib/data/matches'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePred(h: number, a: number) {
  return { home_score: h, away_score: a }
}

function makeResult(h: number, a: number) {
  return { home_score: h, away_score: a }
}

function makeMatch(phase: string, ptsExact: number, ptsWinner: number) {
  return {
    id: 'test-match',
    phase,
    pts_exact: ptsExact,
    pts_winner: ptsWinner,
    home: 'TeamA',
    away: 'TeamB',
  } as any
}

function makeAwardPred(award_id: string, value: string) {
  return { id: 'x', pool_id: 'p', user_id: 'u', created_at: '', award_id, value } as any
}

function makeAwardResult(award_id: string, value: string) {
  return { id: 'x', award_id, value } as any
}

function makeSpainPred(field_id: string, value: string) {
  return { id: 'x', pool_id: 'p', user_id: 'u', created_at: '', field_id, value } as any
}

function makeSpainResult(field_id: string, value: string) {
  return { id: 'x', field_id, value } as any
}

const GROUP_MATCH = makeMatch('grupos', 3, 1)
const R32_MATCH = makeMatch('32avos', 5, 2)
const QUARTER_MATCH = makeMatch('cuartos', 6, 3)
const SEMI_MATCH = makeMatch('semis', 8, 4)
const FINAL_MATCH = makeMatch('final', 10, 5)

// ─── scoreMatch ───────────────────────────────────────────────────────────────

describe('scoreMatch — Fase de grupos', () => {
  it('predicción exacta da 3 puntos', () => {
    expect(scoreMatch(makePred(2, 1), makeResult(2, 1), GROUP_MATCH)).toBe(3)
  })

  it('acertar el ganador (sin marcador exacto) da 1 punto', () => {
    expect(scoreMatch(makePred(3, 1), makeResult(2, 0), GROUP_MATCH)).toBe(1)
  })

  it('empate exacto da 3 puntos', () => {
    expect(scoreMatch(makePred(1, 1), makeResult(1, 1), GROUP_MATCH)).toBe(3)
  })

  it('acertar que hay empate (sin marcador exacto) da 1 punto', () => {
    expect(scoreMatch(makePred(0, 0), makeResult(2, 2), GROUP_MATCH)).toBe(1)
  })

  it('fallo total da 0 puntos', () => {
    expect(scoreMatch(makePred(2, 0), makeResult(0, 2), GROUP_MATCH)).toBe(0)
  })

  it('predecir empate cuando gana alguien da 0 puntos', () => {
    expect(scoreMatch(makePred(1, 1), makeResult(2, 0), GROUP_MATCH)).toBe(0)
  })

  it('predecir victoria cuando hay empate da 0 puntos', () => {
    expect(scoreMatch(makePred(2, 1), makeResult(0, 0), GROUP_MATCH)).toBe(0)
  })

  it('0-0 exacto da 3 puntos', () => {
    expect(scoreMatch(makePred(0, 0), makeResult(0, 0), GROUP_MATCH)).toBe(3)
  })
})

describe('scoreMatch — 32avos de final (5/2)', () => {
  it('predicción exacta da 5 puntos', () => {
    expect(scoreMatch(makePred(2, 1), makeResult(2, 1), R32_MATCH)).toBe(5)
  })

  it('acertar ganador da 2 puntos', () => {
    expect(scoreMatch(makePred(3, 0), makeResult(1, 0), R32_MATCH)).toBe(2)
  })

  it('fallo total da 0 puntos', () => {
    expect(scoreMatch(makePred(0, 2), makeResult(2, 0), R32_MATCH)).toBe(0)
  })
})

describe('scoreMatch — Cuartos de final (6/3)', () => {
  it('predicción exacta da 6 puntos', () => {
    expect(scoreMatch(makePred(1, 0), makeResult(1, 0), QUARTER_MATCH)).toBe(6)
  })

  it('acertar ganador da 3 puntos', () => {
    expect(scoreMatch(makePred(2, 0), makeResult(1, 0), QUARTER_MATCH)).toBe(3)
  })
})

describe('scoreMatch — Semifinal (8/4)', () => {
  it('predicción exacta da 8 puntos', () => {
    expect(scoreMatch(makePred(3, 2), makeResult(3, 2), SEMI_MATCH)).toBe(8)
  })

  it('acertar ganador da 4 puntos', () => {
    expect(scoreMatch(makePred(1, 0), makeResult(2, 0), SEMI_MATCH)).toBe(4)
  })
})

describe('scoreMatch — Final (10/5)', () => {
  it('predicción exacta da 10 puntos', () => {
    expect(scoreMatch(makePred(2, 0), makeResult(2, 0), FINAL_MATCH)).toBe(10)
  })

  it('acertar ganador da 5 puntos', () => {
    expect(scoreMatch(makePred(3, 1), makeResult(1, 0), FINAL_MATCH)).toBe(5)
  })

  it('fallo total da 0 puntos', () => {
    expect(scoreMatch(makePred(0, 1), makeResult(1, 0), FINAL_MATCH)).toBe(0)
  })
})

// ─── scoreAwards ──────────────────────────────────────────────────────────────

describe('scoreAwards', () => {
  const goldenBall = AWARDS.find(a => a.id === 'golden_ball')!
  const champion = AWARDS.find(a => a.id === 'champion')!
  const goldenGlove = AWARDS.find(a => a.id === 'golden_glove')!

  it('acierto exacto da los puntos del premio', () => {
    expect(scoreAwards(
      [makeAwardPred('golden_ball', 'Lamine Yamal')],
      [makeAwardResult('golden_ball', 'Lamine Yamal')]
    )).toBe(goldenBall.pts)
  })

  it('fallo da 0 puntos', () => {
    expect(scoreAwards(
      [makeAwardPred('golden_ball', 'Kylian Mbappé')],
      [makeAwardResult('golden_ball', 'Lamine Yamal')]
    )).toBe(0)
  })

  it('comparación es case-insensitive', () => {
    expect(scoreAwards(
      [makeAwardPred('golden_ball', 'lamine yamal')],
      [makeAwardResult('golden_ball', 'Lamine Yamal')]
    )).toBe(goldenBall.pts)
  })

  it('ignora espacios extra al inicio y final', () => {
    expect(scoreAwards(
      [makeAwardPred('golden_ball', '  Lamine Yamal  ')],
      [makeAwardResult('golden_ball', 'Lamine Yamal')]
    )).toBe(goldenBall.pts)
  })

  it('acumula puntos de múltiples aciertos', () => {
    expect(scoreAwards(
      [
        makeAwardPred('golden_ball', 'Lamine Yamal'),
        makeAwardPred('champion', 'España'),
        makeAwardPred('golden_glove', 'Unai Simón'),
      ],
      [
        makeAwardResult('golden_ball', 'Lamine Yamal'),
        makeAwardResult('champion', 'España'),
        makeAwardResult('golden_glove', 'Unai Simón'),
      ]
    )).toBe(goldenBall.pts + champion.pts + goldenGlove.pts)
  })

  it('premio no conocido (id inválido) da 0 puntos', () => {
    expect(scoreAwards(
      [makeAwardPred('invented_award', 'Alguien')],
      [makeAwardResult('invented_award', 'Alguien')]
    )).toBe(0)
  })

  it('predicción vacía da 0 puntos aunque el resultado coincida', () => {
    expect(scoreAwards(
      [makeAwardPred('golden_ball', '')],
      [makeAwardResult('golden_ball', '')]
    )).toBe(0)
  })

  it('sin resultados oficiales da 0 puntos', () => {
    expect(scoreAwards(
      [makeAwardPred('golden_ball', 'Lamine Yamal')],
      []
    )).toBe(0)
  })
})

// ─── scoreSpain ───────────────────────────────────────────────────────────────

describe('scoreSpain', () => {
  const s1Field = SPAIN_FIELDS.find(f => f.id === 'es_s1')!
  const faseField = SPAIN_FIELDS.find(f => f.id === 'es_fase')!
  const g1Field = SPAIN_FIELDS.find(f => f.id === 'es_g1')!

  it('acierto exacto da los puntos del campo', () => {
    expect(scoreSpain(
      [makeSpainPred('es_s1', 'Mikel Oyarzabal')],
      [makeSpainResult('es_s1', 'Mikel Oyarzabal')]
    )).toBe(s1Field.pts)
  })

  it('fallo da 0 puntos', () => {
    expect(scoreSpain(
      [makeSpainPred('es_s1', 'Lamine Yamal')],
      [makeSpainResult('es_s1', 'Mikel Oyarzabal')]
    )).toBe(0)
  })

  it('comparación es case-insensitive', () => {
    expect(scoreSpain(
      [makeSpainPred('es_fase', 'campeón')],
      [makeSpainResult('es_fase', 'CAMPEÓN')]
    )).toBe(faseField.pts)
  })

  it('ignora espacios extra', () => {
    expect(scoreSpain(
      [makeSpainPred('es_g1', '  España  ')],
      [makeSpainResult('es_g1', 'España')]
    )).toBe(g1Field.pts)
  })

  it('acumula puntos de múltiples aciertos', () => {
    expect(scoreSpain(
      [
        makeSpainPred('es_s1', 'Mikel Oyarzabal'),
        makeSpainPred('es_fase', 'CAMPEÓN'),
        makeSpainPred('es_g1', 'España'),
      ],
      [
        makeSpainResult('es_s1', 'Mikel Oyarzabal'),
        makeSpainResult('es_fase', 'CAMPEÓN'),
        makeSpainResult('es_g1', 'España'),
      ]
    )).toBe(s1Field.pts + faseField.pts + g1Field.pts)
  })

  it('campo no conocido (id inválido) da 0 puntos', () => {
    expect(scoreSpain(
      [makeSpainPred('invented_field', 'algo')],
      [makeSpainResult('invented_field', 'algo')]
    )).toBe(0)
  })

  it('sin resultados oficiales da 0 puntos', () => {
    expect(scoreSpain(
      [makeSpainPred('es_s1', 'Mikel Oyarzabal')],
      []
    )).toBe(0)
  })

  it('valor numérico (goles, victorias) se compara correctamente', () => {
    const golesField = SPAIN_FIELDS.find(f => f.id === 'es_goals')!
    expect(scoreSpain(
      [makeSpainPred('es_goals', '15')],
      [makeSpainResult('es_goals', '15')]
    )).toBe(golesField.pts)
  })
})